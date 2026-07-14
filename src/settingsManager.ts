/**
 * Settings Manager - handles persistence of extension settings
 * Manages workspace settings for script parameters, custom scripts, and bulk sequences
 */

import * as vscode from 'vscode';
import {
  ISettingsManager,
  CustomScript,
  CustomScriptSerialized,
  BulkSequence,
  BulkSequenceSerialized,
} from './types';

/**
 * Settings Manager implementation
 * Persists extension data in workspace settings (.vscode/settings.json)
 * Handles read/write failures gracefully with fallback to defaults
 */
export class SettingsManager implements ISettingsManager {
  private static readonly scriptParametersKey = 'comander.scriptParameters';
  private static readonly customScriptsKey = 'comander.customScripts';
  private static readonly bulkSequencesKey = 'comander.bulkSequences';

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Validate and repair settings on extension activation
   * Filters out corrupted entries and resets to defaults if unrecoverable
   * Logs all recovery actions
   * Requirements: 3.7, 4.5, 5.5, 6.10
   */
  async validateAndRepairSettings(): Promise<void> {
    console.log('Starting settings validation and repair...');
    let repairCount = 0;

    // Validate and repair script parameters
    try {
      const parametersRepaired = await this.validateAndRepairParameters();
      if (parametersRepaired) {
        repairCount++;
        console.log('Script parameters repaired');
      }
    } catch (error) {
      console.error('Failed to validate script parameters:', error);
      vscode.window.showWarningMessage(
        'Failed to validate script parameters. They have been reset to defaults.'
      );
    }

    // Validate and repair custom scripts
    try {
      const scriptsRepaired = await this.validateAndRepairCustomScripts();
      if (scriptsRepaired) {
        repairCount++;
        console.log('Custom scripts repaired');
      }
    } catch (error) {
      console.error('Failed to validate custom scripts:', error);
      vscode.window.showWarningMessage(
        'Failed to validate custom scripts. They have been reset to defaults.'
      );
    }

    // Validate and repair bulk sequences
    try {
      const sequencesRepaired = await this.validateAndRepairBulkSequences();
      if (sequencesRepaired) {
        repairCount++;
        console.log('Bulk sequences repaired');
      }
    } catch (error) {
      console.error('Failed to validate bulk sequences:', error);
      vscode.window.showWarningMessage(
        'Failed to validate bulk sequences. They have been reset to defaults.'
      );
    }

    if (repairCount > 0) {
      console.log(`Settings validation completed. Repaired ${repairCount} setting(s).`);
      vscode.window.showInformationMessage(
        `Comander settings repaired. ${repairCount} corrupted setting(s) were fixed.`
      );
    } else {
      console.log('Settings validation completed. No repairs needed.');
    }
  }

  /**
   * Validate and repair script parameters
   * @returns true if repairs were made, false otherwise
   */
  private async validateAndRepairParameters(): Promise<boolean> {
    const config = vscode.workspace.getConfiguration();
    const allParameters = config.get<unknown>(
      SettingsManager.scriptParametersKey
    );

    // If parameters are missing or null, nothing to validate
    if (!allParameters) {
      return false;
    }

    // Check if parameters have the correct structure
    if (typeof allParameters !== 'object' || Array.isArray(allParameters)) {
      console.warn(
        'Script parameters have invalid structure. Resetting to defaults.'
      );
      await config.update(
        SettingsManager.scriptParametersKey,
        {},
        vscode.ConfigurationTarget.Workspace
      );
      return true;
    }

    let needsRepair = false;
    const repairedParameters: Record<string, Record<string, string>> = {};

    // Validate each project's parameters
    for (const [projectPath, projectParams] of Object.entries(allParameters)) {
      if (
        typeof projectPath !== 'string' ||
        typeof projectParams !== 'object' ||
        projectParams === null ||
        Array.isArray(projectParams)
      ) {
        console.warn(`Removing corrupted project parameters: ${projectPath}`);
        needsRepair = true;
        continue;
      }

      const validParams: Record<string, string> = {};
      for (const [scriptName, params] of Object.entries(projectParams)) {
        if (typeof scriptName === 'string' && typeof params === 'string') {
          validParams[scriptName] = params;
        } else {
          console.warn(
            `Removing corrupted parameter entry: ${projectPath}:${scriptName}`
          );
          needsRepair = true;
        }
      }

      // Only include project if it has valid parameters
      if (Object.keys(validParams).length > 0) {
        repairedParameters[projectPath] = validParams;
      }
    }

    // Save repaired parameters if needed
    if (needsRepair) {
      await config.update(
        SettingsManager.scriptParametersKey,
        repairedParameters,
        vscode.ConfigurationTarget.Workspace
      );
    }

    return needsRepair;
  }

  /**
   * Validate and repair custom scripts
   * @returns true if repairs were made, false otherwise
   */
  private async validateAndRepairCustomScripts(): Promise<boolean> {
    const config = vscode.workspace.getConfiguration();
    const customScripts = config.get<unknown>(
      SettingsManager.customScriptsKey
    );

    // If custom scripts are missing or null, nothing to validate
    if (!customScripts) {
      return false;
    }

    // Check if custom scripts is an array
    if (!Array.isArray(customScripts)) {
      console.warn(
        'Custom scripts have invalid structure. Resetting to defaults.'
      );
      await config.update(
        SettingsManager.customScriptsKey,
        [],
        vscode.ConfigurationTarget.Workspace
      );
      return true;
    }

    let needsRepair = false;
    const repairedScripts: CustomScriptSerialized[] = [];

    // Validate each custom script
    for (const script of customScripts) {
      // Check if script is an object
      if (typeof script !== 'object' || script === null) {
        console.warn('Removing corrupted custom script: not an object');
        needsRepair = true;
        continue;
      }

      // Validate required fields
      const {
        id,
        name,
        command,
        projectPath,
        createdAt,
        updatedAt,
      } = script as Record<string, unknown>;

      // Check for required string fields
      if (
        typeof id !== 'string' ||
        typeof name !== 'string' ||
        typeof command !== 'string' ||
        typeof projectPath !== 'string' ||
        typeof createdAt !== 'string' ||
        typeof updatedAt !== 'string'
      ) {
        console.warn(
          `Removing corrupted custom script: missing or invalid fields - ${typeof id === 'string' ? id : 'unknown'}`
        );
        needsRepair = true;
        continue;
      }

      // Validate field constraints
      if (
        id.trim().length === 0 ||
        name.trim().length === 0 ||
        name.length > 100 ||
        command.trim().length === 0 ||
        command.length > 500
      ) {
        console.warn(
          `Removing corrupted custom script: constraint violation - ${id}`
        );
        needsRepair = true;
        continue;
      }

      // Validate date strings
      const createdDate = new Date(createdAt);
      const updatedDate = new Date(updatedAt);
      if (isNaN(createdDate.getTime()) || isNaN(updatedDate.getTime())) {
        console.warn(
          `Removing corrupted custom script: invalid date format - ${id}`
        );
        needsRepair = true;
        continue;
      }

      // Script is valid, keep it
      repairedScripts.push({
        id,
        name,
        command,
        projectPath,
        createdAt,
        updatedAt,
      });
    }

    // Check for duplicate IDs and remove them
    const seenIds = new Set<string>();
    const dedupedScripts: CustomScriptSerialized[] = [];
    for (const script of repairedScripts) {
      if (seenIds.has(script.id)) {
        console.warn(`Removing duplicate custom script ID: ${script.id}`);
        needsRepair = true;
      } else {
        seenIds.add(script.id);
        dedupedScripts.push(script);
      }
    }

    // Enforce 50 script limit
    if (dedupedScripts.length > 50) {
      console.warn(
        `Custom scripts exceed limit of 50. Keeping first 50 scripts.`
      );
      dedupedScripts.splice(50);
      needsRepair = true;
    }

    // Save repaired scripts if needed
    if (needsRepair) {
      await config.update(
        SettingsManager.customScriptsKey,
        dedupedScripts,
        vscode.ConfigurationTarget.Workspace
      );
    }

    return needsRepair;
  }

  /**
   * Validate and repair bulk sequences
   * @returns true if repairs were made, false otherwise
   */
  private async validateAndRepairBulkSequences(): Promise<boolean> {
    const config = vscode.workspace.getConfiguration();
    const bulkSequences = config.get<unknown>(
      SettingsManager.bulkSequencesKey
    );

    // If bulk sequences are missing or null, nothing to validate
    if (!bulkSequences) {
      return false;
    }

    // Check if bulk sequences is an array
    if (!Array.isArray(bulkSequences)) {
      console.warn(
        'Bulk sequences have invalid structure. Resetting to defaults.'
      );
      await config.update(
        SettingsManager.bulkSequencesKey,
        [],
        vscode.ConfigurationTarget.Workspace
      );
      return true;
    }

    let needsRepair = false;
    const repairedSequences: BulkSequenceSerialized[] = [];

    // Validate each bulk sequence
    for (const sequence of bulkSequences) {
      // Check if sequence is an object
      if (typeof sequence !== 'object' || sequence === null) {
        console.warn('Removing corrupted bulk sequence: not an object');
        needsRepair = true;
        continue;
      }

      // Validate required fields
      const {
        id,
        name,
        scriptIds,
        order,
        createdAt,
      } = sequence as Record<string, unknown>;

      // Check for required fields with correct types
      if (
        typeof id !== 'string' ||
        typeof name !== 'string' ||
        !Array.isArray(scriptIds) ||
        !Array.isArray(order) ||
        typeof createdAt !== 'string'
      ) {
        console.warn(
          `Removing corrupted bulk sequence: missing or invalid fields - ${typeof id === 'string' ? id : 'unknown'}`
        );
        needsRepair = true;
        continue;
      }

      // Validate field constraints
      if (
        id.trim().length === 0 ||
        name.trim().length === 0 ||
        name.length < 1 ||
        name.length > 100
      ) {
        console.warn(
          `Removing corrupted bulk sequence: constraint violation - ${id}`
        );
        needsRepair = true;
        continue;
      }

      // Validate scriptIds array (must be array of strings)
      if (!scriptIds.every((scriptId) => typeof scriptId === 'string')) {
        console.warn(
          `Removing corrupted bulk sequence: invalid scriptIds - ${id}`
        );
        needsRepair = true;
        continue;
      }

      // Validate order array (must be array of numbers)
      if (!order.every((idx) => typeof idx === 'number' && !isNaN(idx))) {
        console.warn(
          `Removing corrupted bulk sequence: invalid order array - ${id}`
        );
        needsRepair = true;
        continue;
      }

      // Validate scriptIds length constraints (2-100 scripts)
      if (scriptIds.length < 2 || scriptIds.length > 100) {
        console.warn(
          `Removing corrupted bulk sequence: invalid script count - ${id}`
        );
        needsRepair = true;
        continue;
      }

      // Validate date string
      const createdDate = new Date(createdAt);
      if (isNaN(createdDate.getTime())) {
        console.warn(
          `Removing corrupted bulk sequence: invalid date format - ${id}`
        );
        needsRepair = true;
        continue;
      }

      // Sequence is valid, keep it
      repairedSequences.push({
        id,
        name,
        scriptIds,
        order,
        createdAt,
      });
    }

    // Check for duplicate IDs and remove them
    const seenIds = new Set<string>();
    const dedupedSequences: BulkSequenceSerialized[] = [];
    for (const sequence of repairedSequences) {
      if (seenIds.has(sequence.id)) {
        console.warn(`Removing duplicate bulk sequence ID: ${sequence.id}`);
        needsRepair = true;
      } else {
        seenIds.add(sequence.id);
        dedupedSequences.push(sequence);
      }
    }

    // Save repaired sequences if needed
    if (needsRepair) {
      await config.update(
        SettingsManager.bulkSequencesKey,
        dedupedSequences,
        vscode.ConfigurationTarget.Workspace
      );
    }

    return needsRepair;
  }

  /**
   * Get saved parameters for a specific script
   * @param projectPath Relative path from workspace root
   * @param scriptName Script name
   * @returns Saved parameters or null if not found
   */
  getParameters(projectPath: string, scriptName: string): string | null {
    try {
      const config = vscode.workspace.getConfiguration();
      const allParameters = config.get<Record<string, Record<string, string>>>(
        SettingsManager.scriptParametersKey,
        {}
      );

      // Parameters are stored as: { [projectPath]: { [scriptName]: parameters } }
      const projectParameters = allParameters[projectPath];
      if (!projectParameters) {
        return null;
      }

      return projectParameters[scriptName] || null;
    } catch (error) {
      console.error(
        `Failed to retrieve parameters for ${projectPath}:${scriptName}`,
        error
      );
      return null;
    }
  }

  /**
   * Save parameters for a specific script
   * @param projectPath Relative path from workspace root
   * @param scriptName Script name
   * @param parameters Parameters string to save
   */
  async setParameters(
    projectPath: string,
    scriptName: string,
    parameters: string
  ): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration();
      const allParameters = config.get<Record<string, Record<string, string>>>(
        SettingsManager.scriptParametersKey,
        {}
      );

      // Ensure project path exists in the structure
      if (!allParameters[projectPath]) {
        allParameters[projectPath] = {};
      }

      // Set the parameters
      allParameters[projectPath][scriptName] = parameters;

      // Update workspace settings
      await config.update(
        SettingsManager.scriptParametersKey,
        allParameters,
        vscode.ConfigurationTarget.Workspace
      );
    } catch (error) {
      console.error(
        `Failed to save parameters for ${projectPath}:${scriptName}`,
        error
      );
      vscode.window.showWarningMessage(
        `Failed to save parameters for script "${scriptName}". The script will execute, but parameters won't be persisted.`
      );
    }
  }

  /**
   * Remove saved parameters for a specific script
   * @param projectPath Relative path from workspace root
   * @param scriptName Script name
   */
  async removeParameters(
    projectPath: string,
    scriptName: string
  ): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration();
      const allParameters = config.get<Record<string, Record<string, string>>>(
        SettingsManager.scriptParametersKey,
        {}
      );

      // Check if project path exists
      if (!allParameters[projectPath]) {
        return; // Nothing to remove
      }

      // Delete the script parameters
      delete allParameters[projectPath][scriptName];

      // Clean up empty project objects
      if (Object.keys(allParameters[projectPath]).length === 0) {
        delete allParameters[projectPath];
      }

      // Update workspace settings
      await config.update(
        SettingsManager.scriptParametersKey,
        allParameters,
        vscode.ConfigurationTarget.Workspace
      );
    } catch (error) {
      console.error(
        `Failed to remove parameters for ${projectPath}:${scriptName}`,
        error
      );
      vscode.window.showWarningMessage(
        `Failed to clear parameters for script "${scriptName}".`
      );
    }
  }

  /**
   * Get all custom scripts from workspace settings
   * @returns Array of custom scripts (empty array on failure)
   */
  getCustomScripts(): CustomScript[] {
    try {
      const config = vscode.workspace.getConfiguration();
      const serialized = config.get<CustomScriptSerialized[]>(
        SettingsManager.customScriptsKey,
        []
      );

      // Deserialize: convert ISO date strings back to Date objects
      return serialized.map((s) => ({
        id: s.id,
        name: s.name,
        command: s.command,
        projectPath: s.projectPath,
        createdAt: new Date(s.createdAt),
        updatedAt: new Date(s.updatedAt),
      }));
    } catch (error) {
      console.error('Failed to retrieve custom scripts', error);
      return [];
    }
  }

  /**
   * Save all custom scripts to workspace settings
   * @param scripts Array of custom scripts to save
   */
  async setCustomScripts(scripts: CustomScript[]): Promise<void> {
    try {
      // Serialize: convert Date objects to ISO strings
      const serialized: CustomScriptSerialized[] = scripts.map((s) => ({
        id: s.id,
        name: s.name,
        command: s.command,
        projectPath: s.projectPath,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      }));

      const config = vscode.workspace.getConfiguration();
      await config.update(
        SettingsManager.customScriptsKey,
        serialized,
        vscode.ConfigurationTarget.Workspace
      );
    } catch (error) {
      console.error('Failed to save custom scripts', error);
      vscode.window.showWarningMessage(
        'Failed to persist custom scripts. Changes may be lost on workspace reload.'
      );
    }
  }

  /**
   * Get all bulk execution sequences from workspace settings
   * @returns Array of bulk sequences (empty array on failure)
   */
  getBulkSequences(): BulkSequence[] {
    try {
      const config = vscode.workspace.getConfiguration();
      const serialized = config.get<BulkSequenceSerialized[]>(
        SettingsManager.bulkSequencesKey,
        []
      );

      // Deserialize: convert ISO date strings back to Date objects
      return serialized.map((s) => ({
        id: s.id,
        name: s.name,
        scriptIds: s.scriptIds,
        order: s.order,
        createdAt: new Date(s.createdAt),
      }));
    } catch (error) {
      console.error('Failed to retrieve bulk sequences', error);
      return [];
    }
  }

  /**
   * Save all bulk execution sequences to workspace settings
   * @param sequences Array of bulk sequences to save
   */
  async setBulkSequences(sequences: BulkSequence[]): Promise<void> {
    try {
      // Serialize: convert Date objects to ISO strings
      const serialized: BulkSequenceSerialized[] = sequences.map((s) => ({
        id: s.id,
        name: s.name,
        scriptIds: s.scriptIds,
        order: s.order,
        createdAt: s.createdAt.toISOString(),
      }));

      const config = vscode.workspace.getConfiguration();
      await config.update(
        SettingsManager.bulkSequencesKey,
        serialized,
        vscode.ConfigurationTarget.Workspace
      );
    } catch (error) {
      console.error('Failed to save bulk sequences', error);
      vscode.window.showWarningMessage(
        'Failed to persist bulk sequences. Changes may be lost on workspace reload.'
      );
    }
  }
}
