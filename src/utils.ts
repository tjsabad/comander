/**
 * Utility functions for the Comander extension
 */

import { ScriptItem } from './types';

/**
 * Generate a unique script identifier
 * Format: projectPath:type:name
 */
export function generateScriptId(script: ScriptItem): string {
  const projectPath = script.projectPath || '';
  const type = script.type === 'custom-script' ? 'custom' : 'npm';
  return `${projectPath}:${type}:${script.label}`;
}

/**
 * Parse a script identifier back into components
 */
export function parseScriptId(scriptId: string): {
  projectPath: string;
  type: 'npm' | 'custom';
  name: string;
} | null {
  const parts = scriptId.split(':');
  if (parts.length !== 3) {
    return null;
  }

  const [projectPath, typeStr, name] = parts;
  const type = typeStr === 'custom' ? 'custom' : 'npm';

  return { projectPath, type, name };
}

/**
 * Validate script name
 */
export function validateScriptName(name: string): string | null {
  if (!name || name.trim().length === 0) {
    return 'Script name cannot be empty or whitespace';
  }

  if (name.length > 100) {
    return 'Script name must be 100 characters or less';
  }

  return null;
}

/**
 * Validate script command
 */
export function validateScriptCommand(command: string): string | null {
  if (!command || command.trim().length === 0) {
    return 'Command cannot be empty or whitespace';
  }

  if (command.length > 500) {
    return 'Command must be 500 characters or less';
  }

  return null;
}

/**
 * Validate bulk sequence name
 */
export function validateSequenceName(name: string): string | null {
  if (!name || name.trim().length === 0) {
    return 'Sequence name cannot be empty or whitespace';
  }

  if (name.length < 1 || name.length > 100) {
    return 'Sequence name must be between 1 and 100 characters';
  }

  return null;
}

/**
 * Format execution duration for display
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Debounce function for file watching
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
}
