/**
 * Script Scanner - discovers and parses package.json files
 * Task 3.1 Implementation
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  IScriptScanner,
  ScriptCollection,
  ProjectScripts,
  ParseError,
} from './types';

export class ScriptScanner implements IScriptScanner {
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly debounceDelay = 500; // 500ms debounce

  /**
   * Scan workspace for package.json files, excluding hidden and node_modules directories
   * Excludes: node_modules, .git, .vscode, and any directory starting with .
   */
  async scan(workspaceRoot: string): Promise<ScriptCollection> {
    const collection: ScriptCollection = {
      projects: new Map<string, ProjectScripts>(),
      errors: [],
    };

    try {
      // Find all package.json files, excluding node_modules and hidden directories
      const packageJsonFiles = await vscode.workspace.findFiles(
        '**/package.json',
        '{**/node_modules/**,**/.*/**}'  // Exclude node_modules and hidden directories
      );

      // Parse each package.json file
      for (const fileUri of packageJsonFiles) {
        const result = await this.parsePackageJson(fileUri.fsPath);

        if ('error' in result) {
          // ParseError case
          collection.errors.push(result);
        } else {
          // ProjectScripts case
          collection.projects.set(result.projectPath, result);
        }
      }
    } catch (error) {
      // Handle any errors during file discovery
      collection.errors.push({
        filePath: workspaceRoot,
        error: `Failed to scan workspace: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    return collection;
  }

  /**
   * Watch for changes to package.json files, excluding hidden and node_modules directories
   * Implements 500ms debounce to avoid excessive re-scans
   */
  watch(callback: (scripts: ScriptCollection) => void): vscode.Disposable {
    // Create file system watcher for package.json files, excluding hidden directories
    const watcher = vscode.workspace.createFileSystemWatcher(
      '**/package.json'
    );

    // Debounced scan function
    const debouncedScan = async () => {
      // Clear existing timer if any
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      // Set new timer for 500ms debounce
      this.debounceTimer = setTimeout(async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
          const workspaceRoot = workspaceFolders[0].uri.fsPath;
          const scripts = await this.scan(workspaceRoot);
          callback(scripts);
        }
        this.debounceTimer = null;
      }, this.debounceDelay);
    };

    // Listen to file change events
    const onCreateDisposable = watcher.onDidCreate(debouncedScan);
    const onChangeDisposable = watcher.onDidChange(debouncedScan);
    const onDeleteDisposable = watcher.onDidDelete(debouncedScan);

    // Return composite disposable that cleans up all watchers
    return vscode.Disposable.from(
      watcher,
      onCreateDisposable,
      onChangeDisposable,
      onDeleteDisposable,
      {
        dispose: () => {
          if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
          }
        },
      }
    );
  }

  /**
   * Parse a single package.json file and extract scripts
   * Returns ParseError if file cannot be read or parsed
   */
  async parsePackageJson(
    filePath: string
  ): Promise<ProjectScripts | ParseError> {
    try {
      // Read file content
      const fileContent = await fs.readFile(filePath, 'utf-8');

      // Parse JSON
      let packageJson: { scripts?: Record<string, unknown> };
      try {
        packageJson = JSON.parse(fileContent);
      } catch (jsonError) {
        return {
          filePath,
          error: `JSON parse error: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`,
        };
      }

      // Extract scripts section (may be undefined or empty)
      const scripts = packageJson.scripts || {};

      // Calculate relative project path from workspace root
      const workspaceFolders = vscode.workspace.workspaceFolders;
      let projectPath = '';

      if (workspaceFolders && workspaceFolders.length > 0) {
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const fileDir = path.dirname(filePath);

        // Get relative path from workspace root to package.json directory
        projectPath = path.relative(workspaceRoot, fileDir);

        // Normalize empty string for root workspace
        if (projectPath === '.') {
          projectPath = '';
        }
      }

      // Convert scripts object to Map
      const scriptsMap = new Map<string, string>();
      for (const [name, command] of Object.entries(scripts)) {
        if (typeof command === 'string') {
          scriptsMap.set(name, command);
        }
      }

      return {
        projectPath,
        packageJsonPath: filePath,
        scripts: scriptsMap,
      };
    } catch (error) {
      // Handle file read errors or other unexpected errors
      return {
        filePath,
        error: `Failed to read or parse file: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
