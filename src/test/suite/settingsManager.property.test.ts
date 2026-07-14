/**
 * Property-based tests for SettingsManager
 * Task 2.2 - Property 7: Parameter persistence round-trip
 * **Validates: Requirements 3.4, 3.6, 3.8, 3.9**
 */

import { expect } from 'chai';
import * as fc from 'fast-check';
import * as vscode from 'vscode';
import { SettingsManager } from '../../settingsManager';

describe('SettingsManager - Property-Based Tests', () => {
  let mockContext: vscode.ExtensionContext;
  let settingsManager: SettingsManager;
  let mockSettings: Record<string, unknown>;

  beforeEach(() => {
    // Initialize mock settings storage
    mockSettings = {};

    // Create a minimal mock ExtensionContext
    mockContext = {
      subscriptions: [],
      workspaceState: {} as any,
      globalState: {} as any,
      extensionUri: vscode.Uri.file('/mock/extension'),
      extensionPath: '/mock/extension',
      asAbsolutePath: (relativePath: string) => `/mock/extension/${relativePath}`,
      storagePath: '/mock/storage',
      globalStoragePath: '/mock/global-storage',
      logPath: '/mock/log',
      extensionMode: vscode.ExtensionMode.Test,
    } as any;

    settingsManager = new SettingsManager(mockContext);
  });

  describe('Property 7: Parameter persistence round-trip', () => {
    it('should save and retrieve parameters with exact same values', () => {
      // Custom arbitrary for valid project paths and script names
      const projectPathArbitrary = fc.string({ minLength: 0, maxLength: 100 });
      const scriptNameArbitrary = fc.string({ minLength: 1, maxLength: 100 });
      const parametersArbitrary = fc.string({ minLength: 0, maxLength: 500 });

      fc.assert(
        fc.asyncProperty(
          fc.record({
            projectPath: projectPathArbitrary,
            scriptName: scriptNameArbitrary,
            parameters: parametersArbitrary,
          }),
          async (data) => {
            // Mock vscode.workspace.getConfiguration() for this test
            const getConfigurationStub = (vscode.workspace as any).getConfiguration;
            const originalGetConfiguration = getConfigurationStub;

            try {
              // Override getConfiguration to use our mock settings
              (vscode.workspace as any).getConfiguration = () => ({
                get: (key: string, defaultValue?: unknown) => {
                  return mockSettings[key] !== undefined
                    ? mockSettings[key]
                    : defaultValue;
                },
                update: async (
                  key: string,
                  value: unknown,
                  _target?: vscode.ConfigurationTarget
                ) => {
                  mockSettings[key] = value;
                },
                has: (key: string) => mockSettings[key] !== undefined,
                inspect: () => undefined,
              });

              // Clear settings before each test
              mockSettings = {};

              // Property: Saving and then retrieving should return exact same value
              await settingsManager.setParameters(
                data.projectPath,
                data.scriptName,
                data.parameters
              );
              const retrieved = settingsManager.getParameters(
                data.projectPath,
                data.scriptName
              );

              expect(retrieved).to.equal(data.parameters);
            } finally {
              // Restore original getConfiguration
              (vscode.workspace as any).getConfiguration = originalGetConfiguration;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return null after clearing parameters', () => {
      const projectPathArbitrary = fc.string({ minLength: 0, maxLength: 100 });
      const scriptNameArbitrary = fc.string({ minLength: 1, maxLength: 100 });
      const parametersArbitrary = fc.string({ minLength: 0, maxLength: 500 });

      fc.assert(
        fc.asyncProperty(
          fc.record({
            projectPath: projectPathArbitrary,
            scriptName: scriptNameArbitrary,
            parameters: parametersArbitrary,
          }),
          async (data) => {
            // Mock vscode.workspace.getConfiguration()
            const getConfigurationStub = (vscode.workspace as any).getConfiguration;
            const originalGetConfiguration = getConfigurationStub;

            try {
              (vscode.workspace as any).getConfiguration = () => ({
                get: (key: string, defaultValue?: unknown) => {
                  return mockSettings[key] !== undefined
                    ? mockSettings[key]
                    : defaultValue;
                },
                update: async (
                  key: string,
                  value: unknown,
                  _target?: vscode.ConfigurationTarget
                ) => {
                  mockSettings[key] = value;
                },
                has: (key: string) => mockSettings[key] !== undefined,
                inspect: () => undefined,
              });

              // Clear settings before each test
              mockSettings = {};

              // Property: After saving, clearing, and then retrieving, result should be null
              await settingsManager.setParameters(
                data.projectPath,
                data.scriptName,
                data.parameters
              );

              // Verify it was saved
              const retrievedBefore = settingsManager.getParameters(
                data.projectPath,
                data.scriptName
              );
              expect(retrievedBefore).to.equal(data.parameters);

              // Clear parameters
              await settingsManager.removeParameters(
                data.projectPath,
                data.scriptName
              );

              // Verify it returns null after clearing
              const retrievedAfter = settingsManager.getParameters(
                data.projectPath,
                data.scriptName
              );
              expect(retrievedAfter).to.be.null;
            } finally {
              (vscode.workspace as any).getConfiguration = originalGetConfiguration;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multiple scripts with independent parameter storage', () => {
      // Test that multiple scripts can have different parameters stored independently
      const scriptDataArbitrary = fc.array(
        fc.record({
          projectPath: fc.string({ minLength: 0, maxLength: 50 }),
          scriptName: fc.string({ minLength: 1, maxLength: 50 }),
          parameters: fc.string({ minLength: 0, maxLength: 200 }),
        }),
        { minLength: 1, maxLength: 10 }
      );

      fc.assert(
        fc.asyncProperty(scriptDataArbitrary, async (scripts) => {
          const originalGetConfiguration = (vscode.workspace as any).getConfiguration;

          try {
            (vscode.workspace as any).getConfiguration = () => ({
              get: (key: string, defaultValue?: unknown) => {
                return mockSettings[key] !== undefined
                  ? mockSettings[key]
                  : defaultValue;
              },
              update: async (
                key: string,
                value: unknown,
                _target?: vscode.ConfigurationTarget
              ) => {
                mockSettings[key] = value;
              },
              has: (key: string) => mockSettings[key] !== undefined,
              inspect: () => undefined,
            });

            mockSettings = {};

            // Save all parameters
            for (const script of scripts) {
              await settingsManager.setParameters(
                script.projectPath,
                script.scriptName,
                script.parameters
              );
            }

            // Verify all parameters are independently retrievable
            for (const script of scripts) {
              const retrieved = settingsManager.getParameters(
                script.projectPath,
                script.scriptName
              );
              expect(retrieved).to.equal(script.parameters);
            }
          } finally {
            (vscode.workspace as any).getConfiguration = originalGetConfiguration;
          }
        }),
        { numRuns: 50 }
      );
    });

    it('should return null for non-existent script parameters', () => {
      const projectPathArbitrary = fc.string({ minLength: 0, maxLength: 100 });
      const scriptNameArbitrary = fc.string({ minLength: 1, maxLength: 100 });

      fc.assert(
        fc.property(
          fc.record({
            projectPath: projectPathArbitrary,
            scriptName: scriptNameArbitrary,
          }),
          (data) => {
            const originalGetConfiguration = (vscode.workspace as any).getConfiguration;

            try {
              (vscode.workspace as any).getConfiguration = () => ({
                get: (key: string, defaultValue?: unknown) => {
                  return mockSettings[key] !== undefined
                    ? mockSettings[key]
                    : defaultValue;
                },
                update: async (
                  key: string,
                  value: unknown,
                  _target?: vscode.ConfigurationTarget
                ) => {
                  mockSettings[key] = value;
                },
                has: (key: string) => mockSettings[key] !== undefined,
                inspect: () => undefined,
              });

              mockSettings = {};

              // Property: Retrieving parameters that were never set should return null
              const retrieved = settingsManager.getParameters(
                data.projectPath,
                data.scriptName
              );
              expect(retrieved).to.be.null;
            } finally {
              (vscode.workspace as any).getConfiguration = originalGetConfiguration;
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
