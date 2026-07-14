/**
 * Custom Script Manager - manages user-defined custom scripts
 * Implements CRUD operations with validation and persistence
 */

import { v4 as uuidv4 } from 'uuid';
import { ICustomScriptManager, CustomScript, Result } from './types';
import { SettingsManager } from './settingsManager';

// Constants for validation
const MAX_SCRIPTS_PER_WORKSPACE = 50;
const MAX_NAME_LENGTH = 100;
const MAX_COMMAND_LENGTH = 500;

export class CustomScriptManager implements ICustomScriptManager {
  constructor(private readonly settingsManager: SettingsManager) {}

  /**
   * Create a new custom script with validation
   * Validates: name uniqueness, length limits, non-empty checks
   * Requirements: 4.1, 4.2, 4.3, 4.7, 4.9
   */
  async create(
    name: string,
    command: string,
    projectPath: string
  ): Promise<Result<CustomScript>> {
    // Validate input
    const validation = this.validateInput(name, command);
    if (!validation.success) {
      return validation;
    }

    // Check workspace limit
    const allScripts = this.settingsManager.getCustomScripts();
    if (allScripts.length >= MAX_SCRIPTS_PER_WORKSPACE) {
      return {
        success: false,
        error: `Maximum of ${MAX_SCRIPTS_PER_WORKSPACE} custom scripts per workspace reached`,
      };
    }

    // Check name uniqueness within project scope
    const existingInProject = allScripts.filter(
      (s) => s.projectPath === projectPath
    );
    if (existingInProject.some((s) => s.name === name)) {
      return {
        success: false,
        error: 'Script name already exists in this project',
      };
    }

    // Create new custom script
    const now = new Date();
    const newScript: CustomScript = {
      id: uuidv4(),
      name: name.trim(),
      command: command.trim(),
      projectPath,
      createdAt: now,
      updatedAt: now,
    };

    // Persist to settings
    try {
      const updatedScripts = [...allScripts, newScript];
      await this.settingsManager.setCustomScripts(updatedScripts);
      return { success: true, data: newScript };
    } catch (error) {
      return {
        success: false,
        error: `Failed to save custom script: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Update an existing custom script with validation
   * Validates: name uniqueness, length limits, non-empty checks
   * Requirements: 5.4, 5.5, 5.6, 5.7, 5.8, 5.9
   */
  async update(
    id: string,
    name: string,
    command: string
  ): Promise<Result<CustomScript>> {
    // Validate input
    const validation = this.validateInput(name, command);
    if (!validation.success) {
      return validation;
    }

    // Find existing script
    const allScripts = this.settingsManager.getCustomScripts();
    const existingScript = allScripts.find((s) => s.id === id);
    
    if (!existingScript) {
      return {
        success: false,
        error: 'Custom script not found',
      };
    }

    // Check name uniqueness within project scope (excluding current script)
    const existingInProject = allScripts.filter(
      (s) => s.projectPath === existingScript.projectPath && s.id !== id
    );
    if (existingInProject.some((s) => s.name === name)) {
      return {
        success: false,
        error: 'Script name already exists in this project',
      };
    }

    // Update script
    const updatedScript: CustomScript = {
      ...existingScript,
      name: name.trim(),
      command: command.trim(),
      updatedAt: new Date(),
    };

    // Persist to settings
    try {
      const updatedScripts = allScripts.map((s) =>
        s.id === id ? updatedScript : s
      );
      await this.settingsManager.setCustomScripts(updatedScripts);
      return { success: true, data: updatedScript };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update custom script: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Delete a custom script
   * Requirements: 5.2, 5.3
   */
  async delete(id: string): Promise<Result<void>> {
    const allScripts = this.settingsManager.getCustomScripts();
    const scriptExists = allScripts.some((s) => s.id === id);

    if (!scriptExists) {
      return {
        success: false,
        error: 'Custom script not found',
      };
    }

    try {
      const updatedScripts = allScripts.filter((s) => s.id !== id);
      await this.settingsManager.setCustomScripts(updatedScripts);
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete custom script: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * List all custom scripts, optionally filtered by project
   * Requirements: 4.4, 4.6, 5.1
   */
  list(projectPath?: string): CustomScript[] {
    const allScripts = this.settingsManager.getCustomScripts();
    
    if (projectPath !== undefined) {
      return allScripts.filter((s) => s.projectPath === projectPath);
    }
    
    return allScripts;
  }

  /**
   * Get a specific custom script by ID
   * Requirements: 5.1
   */
  get(id: string): CustomScript | null {
    const allScripts = this.settingsManager.getCustomScripts();
    return allScripts.find((s) => s.id === id) || null;
  }

  /**
   * Validate custom script name and command
   * Checks for empty/whitespace-only strings and length limits
   * Requirements: 4.2, 4.3, 5.6, 5.7, 5.8, 5.9
   */
  private validateInput(
    name: string,
    command: string
  ): Result<never> {
    // Validate name is not empty or whitespace
    if (!name || name.trim().length === 0) {
      return {
        success: false,
        error: 'Script name cannot be empty or whitespace',
      };
    }

    // Validate name length
    if (name.trim().length > MAX_NAME_LENGTH) {
      return {
        success: false,
        error: `Script name must be ${MAX_NAME_LENGTH} characters or less`,
      };
    }

    // Validate command is not empty or whitespace
    if (!command || command.trim().length === 0) {
      return {
        success: false,
        error: 'Command cannot be empty or whitespace',
      };
    }

    // Validate command length
    if (command.trim().length > MAX_COMMAND_LENGTH) {
      return {
        success: false,
        error: `Command must be ${MAX_COMMAND_LENGTH} characters or less`,
      };
    }

    return { success: true } as Result<never>;
  }
}
