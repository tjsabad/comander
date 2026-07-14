/**
 * Script Executor - executes scripts in VS Code terminals
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.7, 2.8, 3.2, 3.3
 */

import * as vscode from 'vscode';
import { IScriptExecutor, ScriptItem, ExecutionResult } from './types';
import { generateScriptId } from './utils';

/**
 * Tracks execution state for a single script
 */
interface ExecutionState {
  terminal: vscode.Terminal;
  script: ScriptItem;
  startTime: number;
  exitCode?: number;
  statusBarItem?: vscode.StatusBarItem;
}

/**
 * ScriptExecutor manages terminal-based script execution
 * - Creates VS Code terminals for each script execution
 * - Tracks active executions to prevent concurrent runs
 * - Constructs npm commands with proper parameter formatting
 * - Captures exit codes when available
 * - Checks npm availability before first execution
 */
export class ScriptExecutor implements IScriptExecutor {
  /** Map of scriptId to execution state */
  private activeExecutions: Map<string, ExecutionState> = new Map();

  /** Most recently executed script (for keyboard shortcut) */
  private mostRecentScript: ScriptItem | null = null;

  /** Whether npm availability has been checked */
  private npmChecked = false;

  /** Whether npm is available in PATH */
  private npmAvailable = false;

  /**
   * Execute a script with optional parameters
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.8, 3.2, 3.3
   */
  async execute(
    script: ScriptItem,
    parameters?: string
  ): Promise<ExecutionResult> {
    const scriptId = generateScriptId(script);
    const startTime = Date.now();

    // Check if script is already executing (Requirement 2.5)
    if (this.isExecuting(scriptId)) {
      throw new Error(`Script "${script.label}" is already executing`);
    }

    // Check npm availability before first execution (Requirement 2.7)
    if (!this.npmChecked) {
      await this.checkNpmAvailability();
    }

    if (!this.npmAvailable) {
      throw new Error(
        'npm is not available in PATH. Please install Node.js and npm.'
      );
    }

    // Construct command with proper format (Requirements 3.2, 3.3)
    const command = this.constructCommand(script, parameters);

    // Create terminal for this execution (Requirements 2.2, 2.8)
    const terminal = vscode.window.createTerminal({
      name: `Comander: ${script.label}`,
      cwd: script.projectPath
        ? vscode.workspace.workspaceFolders?.[0].uri.fsPath + '/' + script.projectPath
        : vscode.workspace.workspaceFolders?.[0].uri.fsPath,
    });

    // Create and show status bar item (Requirement 7.8)
    const statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    statusBarItem.text = `$(sync~spin) Running: ${script.label}`;
    statusBarItem.tooltip = `Executing script: ${script.label}`;
    statusBarItem.show();

    // Track execution state
    this.activeExecutions.set(scriptId, {
      terminal,
      script,
      startTime,
      statusBarItem,
    });

    // Store as most recent script (Requirement 7.2)
    this.mostRecentScript = script;

    // Show terminal and send command (Requirement 2.3)
    terminal.show();
    terminal.sendText(command);

    // Listen for terminal close to capture exit code (Requirement 2.4)
    return new Promise<ExecutionResult>((resolve) => {
      const disposable = vscode.window.onDidCloseTerminal(
        (closedTerminal) => {
          if (closedTerminal === terminal) {
            const state = this.activeExecutions.get(scriptId);
            if (state) {
              const duration = Date.now() - state.startTime;
              // Try to get exit code (may not be available in all cases)
              const exitCode = closedTerminal.exitStatus?.code ?? 0;

              // Clear status bar indicator (Requirement 7.8)
              if (state.statusBarItem) {
                state.statusBarItem.dispose();
              }

              // Clean up
              this.activeExecutions.delete(scriptId);
              disposable.dispose();

              resolve({
                success: exitCode === 0,
                exitCode,
                duration,
                scriptName: script.label,
              });
            }
          }
        }
      );
    });
  }

  /**
   * Check if a script is currently executing
   * Requirement: 2.5
   */
  isExecuting(scriptId: string): boolean {
    return this.activeExecutions.has(scriptId);
  }

  /**
   * Terminate an executing script
   */
  terminate(scriptId: string): void {
    const state = this.activeExecutions.get(scriptId);
    if (state) {
      // Dispose status bar item (Requirement 7.8)
      if (state.statusBarItem) {
        state.statusBarItem.dispose();
      }
      state.terminal.dispose();
      this.activeExecutions.delete(scriptId);
    }
  }

  /**
   * Get the most recently executed script
   * Requirement: 7.2
   */
  getMostRecentScript(): ScriptItem | null {
    return this.mostRecentScript;
  }

  /**
   * Construct npm command with proper format
   * Requirements: 3.2, 3.3
   * Format: npm run <scriptName> -- <parameters>
   */
  private constructCommand(script: ScriptItem, parameters?: string): string {
    if (script.type === 'custom-script') {
      // Custom scripts use the command directly
      if (parameters && parameters.trim().length > 0) {
        return `${script.command} ${parameters}`;
      }
      return script.command || '';
    }

    // npm scripts use "npm run" format
    const baseCommand = `npm run ${script.label}`;

    // Add parameters after double-dash separator if provided (Requirement 3.3)
    if (parameters && parameters.trim().length > 0) {
      return `${baseCommand} -- ${parameters}`;
    }

    return baseCommand;
  }

  /**
   * Check if npm is available in system PATH
   * Requirement: 2.7
   */
  private async checkNpmAvailability(): Promise<void> {
    this.npmChecked = true;

    try {
      // Try to run npm --version to check availability
      const result = await new Promise<boolean>((resolve) => {
        const terminal = vscode.window.createTerminal({
          name: 'npm-check',
          hideFromUser: true,
        });

        terminal.sendText('npm --version && exit 0 || exit 1');

        const disposable = vscode.window.onDidCloseTerminal(
          (closedTerminal) => {
            if (closedTerminal === terminal) {
              const exitCode = closedTerminal.exitStatus?.code ?? 1;
              disposable.dispose();
              resolve(exitCode === 0);
            }
          }
        );

        // Timeout after 5 seconds
        setTimeout(() => {
          terminal.dispose();
          disposable.dispose();
          resolve(false);
        }, 5000);
      });

      this.npmAvailable = result;
    } catch (error) {
      this.npmAvailable = false;
    }
  }
}
