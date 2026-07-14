/**
 * Shared test utilities and helpers
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import * as vscode from 'vscode';
import { CustomScript, ScriptItem, BulkSequence } from '../types';

/**
 * Create a mock VS Code workspace configuration
 */
export function createMockWorkspaceConfiguration(
  settings: Record<string, unknown> = {}
): {
  get: (key: string, defaultValue?: unknown) => unknown;
  update: (key: string, value: unknown) => Promise<void>;
  has: (key: string) => boolean;
  inspect: () => undefined;
} {
  return {
    get: (key: string, defaultValue?: unknown) => {
      return settings[key] !== undefined ? settings[key] : defaultValue;
    },
    update: async (key: string, value: unknown) => {
      settings[key] = value;
    },
    has: (key: string) => settings[key] !== undefined,
    inspect: () => undefined,
  };
}

/**
 * Create a mock ScriptItem for testing
 */
export function createMockScriptItem(
  overrides: Partial<ScriptItem> = {}
): ScriptItem {
  return {
    type: 'npm-script',
    label: 'test-script',
    command: 'echo "test"',
    projectPath: '',
    ...overrides,
  };
}

/**
 * Create a mock CustomScript for testing
 */
export function createMockCustomScript(
  overrides: Partial<CustomScript> = {}
): CustomScript {
  return {
    id: 'test-id-123',
    name: 'test-custom',
    command: 'echo "custom"',
    projectPath: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock BulkSequence for testing
 */
export function createMockBulkSequence(
  overrides: Partial<BulkSequence> = {}
): BulkSequence {
  return {
    id: 'seq-id-123',
    name: 'test-sequence',
    scriptIds: [':npm:build', ':npm:test'],
    order: [0, 1],
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Wait for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a temporary test workspace folder
 */
export async function createTestWorkspace(): Promise<vscode.Uri> {
  // This would typically create a temporary directory
  // For now, return a mock URI
  return vscode.Uri.file('/tmp/test-workspace');
}

/**
 * Clean up test workspace
 */
export async function cleanupTestWorkspace(_workspaceUri: vscode.Uri): Promise<void> {
  // This would typically delete the temporary directory
  // For now, this is a no-op
}
