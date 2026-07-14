/**
 * Bulk Executor - manages bulk execution of multiple scripts
 * Requirements: 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12
 */

import { v4 as uuidv4 } from 'uuid';
import {
  IBulkExecutor,
  ScriptItem,
  BulkResult,
  BulkSequence,
  Result,
} from './types';
import { ScriptExecutor } from './scriptExecutor';
import { SettingsManager } from './settingsManager';
import { generateScriptId, validateSequenceName } from './utils';

export class BulkExecutor implements IBulkExecutor {
  constructor(
    private readonly scriptExecutor: ScriptExecutor,
    private readonly settingsManager: SettingsManager
  ) {}

  /**
   * Execute multiple scripts in bulk sequentially
   * Requirements: 6.5, 6.6, 6.7, 6.8
   */
  async executeBulk(
    scripts: ScriptItem[],
    order: number[]
  ): Promise<BulkResult> {
    const startTime = Date.now();
    let successfulScripts = 0;

    // Execute scripts sequentially according to the order array (Requirement 6.5)
    for (let i = 0; i < order.length; i++) {
      const scriptIndex = order[i];
      const script = scripts[scriptIndex];

      try {
        // Execute script with 300-second timeout (Requirement 6.7)
        const executionPromise = this.scriptExecutor.execute(script);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('TIMEOUT'));
          }, 300000); // 300 seconds
        });

        const result = await Promise.race([executionPromise, timeoutPromise]);

        // Check for non-zero exit code and halt (Requirement 6.6)
        if (!result.success) {
          const totalDuration = Date.now() - startTime;
          return {
            totalScripts: order.length,
            successfulScripts,
            failedScript: {
              name: script.label,
              exitCode: result.exitCode,
              index: i,
            },
            totalDuration,
          };
        }

        successfulScripts++;
      } catch (error) {
        // Handle timeout (Requirement 6.7)
        if (error instanceof Error && error.message === 'TIMEOUT') {
          const totalDuration = Date.now() - startTime;
          return {
            totalScripts: order.length,
            successfulScripts,
            timedOutScript: {
              name: script.label,
              index: i,
            },
            totalDuration,
          };
        }
        // Re-throw unexpected errors
        throw error;
      }
    }

    // All scripts completed successfully (Requirement 6.8)
    const totalDuration = Date.now() - startTime;
    return {
      totalScripts: order.length,
      successfulScripts,
      totalDuration,
    };
  }

  /**
   * Save a bulk execution sequence
   * Requirements: 6.9, 6.10
   */
  async saveSequence(
    name: string,
    scripts: ScriptItem[],
    order: number[]
  ): Promise<Result<BulkSequence>> {
    // Validate sequence name (1-100 characters)
    const nameError = validateSequenceName(name);
    if (nameError) {
      return { success: false, error: nameError };
    }

    // Validate script count (2-100 scripts)
    if (scripts.length < 2) {
      return {
        success: false,
        error: 'Bulk sequence must contain at least 2 scripts',
      };
    }

    if (scripts.length > 100) {
      return {
        success: false,
        error: 'Bulk sequence cannot contain more than 100 scripts',
      };
    }

    // Validate order array
    if (order.length !== scripts.length) {
      return {
        success: false,
        error: 'Order array length must match scripts array length',
      };
    }

    // Validate order indices are valid and unique
    const orderSet = new Set(order);
    if (orderSet.size !== order.length) {
      return {
        success: false,
        error: 'Order array contains duplicate indices',
      };
    }

    for (const index of order) {
      if (index < 0 || index >= scripts.length) {
        return {
          success: false,
          error: `Invalid order index: ${index}`,
        };
      }
    }

    // Generate script identifiers
    const scriptIds = scripts.map((script) => generateScriptId(script));

    // Create the bulk sequence
    const sequence: BulkSequence = {
      id: uuidv4(),
      name: name.trim(),
      scriptIds,
      order,
      createdAt: new Date(),
    };

    // Load existing sequences
    const sequences = this.settingsManager.getBulkSequences();

    // Add new sequence
    sequences.push(sequence);

    // Persist to settings
    await this.settingsManager.setBulkSequences(sequences);

    return { success: true, data: sequence };
  }

  /**
   * Load a saved bulk execution sequence
   * Requirements: 6.11
   */
  loadSequence(id: string): BulkSequence | null {
    const sequences = this.settingsManager.getBulkSequences();
    return sequences.find((seq) => seq.id === id) || null;
  }

  /**
   * List all saved bulk execution sequences
   * Requirements: 6.11
   */
  listSequences(): BulkSequence[] {
    return this.settingsManager.getBulkSequences();
  }

  /**
   * Delete a saved bulk execution sequence
   * Requirements: 6.10
   */
  async deleteSequence(id: string): Promise<Result<void>> {
    const sequences = this.settingsManager.getBulkSequences();

    // Find the sequence
    const index = sequences.findIndex((seq) => seq.id === id);
    if (index === -1) {
      return {
        success: false,
        error: `Sequence with id ${id} not found`,
      };
    }

    // Remove the sequence
    sequences.splice(index, 1);

    // Persist to settings
    await this.settingsManager.setBulkSequences(sequences);

    return { success: true, data: undefined };
  }
}
