/**
 * Data models and interfaces for the Comander VS Code extension
 */

import * as vscode from 'vscode';

// ============================================================================
// Script Scanner Types
// ============================================================================

/**
 * Collection of all scripts discovered in the workspace
 */
export interface ScriptCollection {
  /** Map of project path to project scripts */
  projects: Map<string, ProjectScripts>;
  /** Parse errors encountered during scanning */
  errors: ParseError[];
}

/**
 * Scripts for a single project
 */
export interface ProjectScripts {
  /** Relative path from workspace root */
  projectPath: string;
  /** Absolute path to package.json */
  packageJsonPath: string;
  /** Map of script name to command */
  scripts: Map<string, string>;
}

/**
 * Error encountered while parsing a package.json file
 */
export interface ParseError {
  /** Path to the file that failed to parse */
  filePath: string;
  /** Error message */
  error: string;
}

// ============================================================================
// Script Item Types (Tree View)
// ============================================================================

/**
 * Item displayed in the script list tree view
 */
export interface ScriptItem {
  /** Type of script item */
  type: 'project' | 'npm-script' | 'custom-script' | 'category';
  /** Display label */
  label: string;
  /** Command to execute (for script types) */
  command?: string;
  /** Project path (relative from workspace root) */
  projectPath?: string;
  /** Category name (for organizing scripts) */
  category?: string;
  /** Last execution timestamp */
  lastExecuted?: Date;
  /** Icon path or theme icon */
  iconPath?: vscode.ThemeIcon;
  /** Unique script identifier */
  id?: string;
}

// ============================================================================
// Custom Script Types
// ============================================================================

/**
 * User-defined custom script
 */
export interface CustomScript {
  /** Unique identifier (UUID) */
  id: string;
  /** Script name (max 100 characters) */
  name: string;
  /** Command to execute (max 500 characters) */
  command: string;
  /** Project path (relative from workspace root) */
  projectPath: string;
  /** Category for organizing scripts (optional, max 50 characters) */
  category?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Serializable version of CustomScript for settings storage
 */
export interface CustomScriptSerialized {
  id: string;
  name: string;
  command: string;
  projectPath: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Execution Types
// ============================================================================

/**
 * Result of script execution
 */
export interface ExecutionResult {
  /** Whether execution was successful */
  success: boolean;
  /** Exit code from the script */
  exitCode: number;
  /** Execution duration in milliseconds */
  duration: number;
  /** Name of the executed script */
  scriptName: string;
}

// ============================================================================
// Bulk Execution Types
// ============================================================================

/**
 * Result of bulk execution
 */
export interface BulkResult {
  /** Total number of scripts in sequence */
  totalScripts: number;
  /** Number of successfully executed scripts */
  successfulScripts: number;
  /** Details of failed script, if any */
  failedScript?: {
    name: string;
    exitCode: number;
    index: number;
  };
  /** Details of timed-out script, if any */
  timedOutScript?: {
    name: string;
    index: number;
  };
  /** Total execution duration in milliseconds */
  totalDuration: number;
}

/**
 * Saved bulk execution sequence
 */
export interface BulkSequence {
  /** Unique identifier (UUID) */
  id: string;
  /** Sequence name (1-100 characters) */
  name: string;
  /** Array of script identifiers (format: projectPath:type:name) */
  scriptIds: string[];
  /** Execution order (array of indices) */
  order: number[];
  /** Creation timestamp */
  createdAt: Date;
}

/**
 * Serializable version of BulkSequence for settings storage
 */
export interface BulkSequenceSerialized {
  id: string;
  name: string;
  scriptIds: string[];
  order: number[];
  createdAt: string;
}

// ============================================================================
// Result Type (for operations that can fail)
// ============================================================================

/**
 * Result type for operations that can succeed or fail
 */
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ============================================================================
// Component Interface Types
// ============================================================================

/**
 * Script Scanner interface
 */
export interface IScriptScanner {
  /**
   * Scan workspace for package.json files and extract scripts
   */
  scan(workspaceRoot: string): Promise<ScriptCollection>;

  /**
   * Watch for file changes and trigger callback on changes
   */
  watch(callback: (scripts: ScriptCollection) => void): vscode.Disposable;

  /**
   * Parse a single package.json file
   */
  parsePackageJson(filePath: string): Promise<ProjectScripts | ParseError>;
}

/**
 * Script Executor interface
 */
export interface IScriptExecutor {
  /**
   * Execute a script with optional parameters
   */
  execute(script: ScriptItem, parameters?: string): Promise<ExecutionResult>;

  /**
   * Check if a script is currently executing
   */
  isExecuting(scriptId: string): boolean;

  /**
   * Terminate an executing script
   */
  terminate(scriptId: string): void;

  /**
   * Get the most recently executed script
   */
  getMostRecentScript(): ScriptItem | null;
}

/**
 * Custom Script Manager interface
 */
export interface ICustomScriptManager {
  /**
   * Create a new custom script
   */
  create(
    name: string,
    command: string,
    projectPath: string,
    category?: string
  ): Promise<Result<CustomScript>>;

  /**
   * Update an existing custom script
   */
  update(
    id: string,
    name: string,
    command: string,
    category?: string
  ): Promise<Result<CustomScript>>;

  /**
   * Delete a custom script
   */
  delete(id: string): Promise<Result<void>>;

  /**
   * List all custom scripts, optionally filtered by project
   */
  list(projectPath?: string): CustomScript[];

  /**
   * Get a specific custom script by ID
   */
  get(id: string): CustomScript | null;
}

/**
 * Bulk Executor interface
 */
export interface IBulkExecutor {
  /**
   * Execute multiple scripts in bulk
   */
  executeBulk(scripts: ScriptItem[], order: number[]): Promise<BulkResult>;

  /**
   * Save a bulk execution sequence
   */
  saveSequence(
    name: string,
    scripts: ScriptItem[],
    order: number[]
  ): Promise<Result<BulkSequence>>;

  /**
   * Load a saved bulk execution sequence
   */
  loadSequence(id: string): BulkSequence | null;

  /**
   * List all saved bulk execution sequences
   */
  listSequences(): BulkSequence[];

  /**
   * Delete a saved bulk execution sequence
   */
  deleteSequence(id: string): Promise<Result<void>>;
}

/**
 * Settings Manager interface
 */
export interface ISettingsManager {
  /**
   * Get saved parameters for a script
   */
  getParameters(projectPath: string, scriptName: string): string | null;

  /**
   * Set parameters for a script
   */
  setParameters(
    projectPath: string,
    scriptName: string,
    parameters: string
  ): Promise<void>;

  /**
   * Remove saved parameters for a script
   */
  removeParameters(projectPath: string, scriptName: string): Promise<void>;

  /**
   * Get all custom scripts
   */
  getCustomScripts(): CustomScript[];

  /**
   * Set all custom scripts
   */
  setCustomScripts(scripts: CustomScript[]): Promise<void>;

  /**
   * Get all bulk sequences
   */
  getBulkSequences(): BulkSequence[];

  /**
   * Set all bulk sequences
   */
  setBulkSequences(sequences: BulkSequence[]): Promise<void>;
}
