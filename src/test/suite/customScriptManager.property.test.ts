/**
 * Property-based tests for CustomScriptManager
 * Task 4.3 - Property 9: Custom script CRUD persistence
 * **Validates: Requirements 4.5, 5.3, 5.5**
 */

import { expect } from 'chai';
import * as fc from 'fast-check';
import * as vscode from 'vscode';
import { CustomScriptManager } from '../../customScriptManager';
import { SettingsManager } from '../../settingsManager';
import { CustomScript } from '../../types';

describe('CustomScriptManager - Property-Based Tests', () => {
  let mockContext: vscode.ExtensionContext;
  let settingsManager: SettingsManager;
  let customScriptManager: CustomScriptManager;
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

    // Mock vscode.workspace.getConfiguration()
    (vscode.workspace as any).getConfiguration = () => ({
      get: (key: string, defaultValue?: unknown) => {
        return mockSettings[key] !== undefined ? mockSettings[key] : defaultValue;
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

    settingsManager = new SettingsManager(mockContext);
    customScriptManager = new CustomScriptManager(settingsManager);
  });

  describe('Property 9: Custom script CRUD persistence', () => {
    // Arbitraries for generating valid custom script data
    const validNameArbitrary = fc
      .string({ minLength: 1, maxLength: 100 })
      .filter((s) => s.trim().length > 0);

    const validCommandArbitrary = fc
      .string({ minLength: 1, maxLength: 500 })
      .filter((s) => s.trim().length > 0);

    const projectPathArbitrary = fc.string({ minLength: 0, maxLength: 100 });

    it('should create and then retrieve a script with the same properties', () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            name: validNameArbitrary,
            command: validCommandArbitrary,
            projectPath: projectPathArbitrary,
          }),
          async (data) => {
            // Clear mock settings before test
            mockSettings = {};

            // Create the script
            const createResult = await customScriptManager.create(
              data.name,
              data.command,
              data.projectPath
            );

            // Verify creation was successful
            expect(createResult.success).to.be.true;
            if (!createResult.success) {
              return; // Type guard
            }

            const createdScript = createResult.data;

            // Retrieve the script by ID
            const retrievedScript = customScriptManager.get(createdScript.id);

            // Verify the retrieved script matches the created script
            expect(retrievedScript).to.not.be.null;
            expect(retrievedScript?.id).to.equal(createdScript.id);
            expect(retrievedScript?.name).to.equal(data.name.trim());
            expect(retrievedScript?.command).to.equal(data.command.trim());
            expect(retrievedScript?.projectPath).to.equal(data.projectPath);
            expect(retrievedScript?.createdAt).to.be.instanceOf(Date);
            expect(retrievedScript?.updatedAt).to.be.instanceOf(Date);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should update a script and then retrieve it with updated values', () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            initialName: validNameArbitrary,
            initialCommand: validCommandArbitrary,
            projectPath: projectPathArbitrary,
            updatedName: validNameArbitrary,
            updatedCommand: validCommandArbitrary,
          }),
          async (data) => {
            // Clear mock settings before test
            mockSettings = {};

            // Create the script
            const createResult = await customScriptManager.create(
              data.initialName,
              data.initialCommand,
              data.projectPath
            );

            expect(createResult.success).to.be.true;
            if (!createResult.success) {
              return; // Type guard
            }

            const createdScript = createResult.data;

            // Update the script
            const updateResult = await customScriptManager.update(
              createdScript.id,
              data.updatedName,
              data.updatedCommand
            );

            // Verify update was successful
            expect(updateResult.success).to.be.true;
            if (!updateResult.success) {
              return; // Type guard
            }

            // Retrieve the script
            const retrievedScript = customScriptManager.get(createdScript.id);

            // Verify the retrieved script has updated values
            expect(retrievedScript).to.not.be.null;
            expect(retrievedScript?.id).to.equal(createdScript.id);
            expect(retrievedScript?.name).to.equal(data.updatedName.trim());
            expect(retrievedScript?.command).to.equal(data.updatedCommand.trim());
            expect(retrievedScript?.projectPath).to.equal(data.projectPath);

            // Verify updatedAt was changed
            expect(retrievedScript?.updatedAt.getTime()).to.be.at.least(
              createdScript.createdAt.getTime()
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should delete a script and then return null when retrieving it', () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            name: validNameArbitrary,
            command: validCommandArbitrary,
            projectPath: projectPathArbitrary,
          }),
          async (data) => {
            // Clear mock settings before test
            mockSettings = {};

            // Create the script
            const createResult = await customScriptManager.create(
              data.name,
              data.command,
              data.projectPath
            );

            expect(createResult.success).to.be.true;
            if (!createResult.success) {
              return; // Type guard
            }

            const createdScript = createResult.data;

            // Verify script exists before deletion
            const beforeDelete = customScriptManager.get(createdScript.id);
            expect(beforeDelete).to.not.be.null;

            // Delete the script
            const deleteResult = await customScriptManager.delete(createdScript.id);

            // Verify deletion was successful
            expect(deleteResult.success).to.be.true;

            // Attempt to retrieve the deleted script
            const afterDelete = customScriptManager.get(createdScript.id);

            // Verify the script no longer exists
            expect(afterDelete).to.be.null;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should persist CRUD operations across multiple scripts independently', () => {
      // Test that CRUD operations on multiple scripts don't interfere with each other
      const scriptDataArbitrary = fc.array(
        fc.record({
          name: validNameArbitrary,
          command: validCommandArbitrary,
          projectPath: projectPathArbitrary,
        }),
        { minLength: 2, maxLength: 10 }
      );

      fc.assert(
        fc.asyncProperty(scriptDataArbitrary, async (scripts) => {
          // Clear mock settings before test
          mockSettings = {};

          // Create all scripts
          const createdScripts: CustomScript[] = [];
          for (const script of scripts) {
            const result = await customScriptManager.create(
              script.name,
              script.command,
              script.projectPath
            );

            if (result.success) {
              createdScripts.push(result.data);
            }
          }

          // Skip if we couldn't create scripts due to duplicate names
          if (createdScripts.length === 0) {
            return;
          }

          // Verify all created scripts can be retrieved
          for (const created of createdScripts) {
            const retrieved = customScriptManager.get(created.id);
            expect(retrieved).to.not.be.null;
            expect(retrieved?.id).to.equal(created.id);
          }

          // Delete the first script
          if (createdScripts.length > 0) {
            const firstScript = createdScripts[0];
            const deleteResult = await customScriptManager.delete(firstScript.id);
            expect(deleteResult.success).to.be.true;

            // Verify first script is deleted
            expect(customScriptManager.get(firstScript.id)).to.be.null;

            // Verify other scripts still exist
            for (let i = 1; i < createdScripts.length; i++) {
              const retrieved = customScriptManager.get(createdScripts[i].id);
              expect(retrieved).to.not.be.null;
              expect(retrieved?.id).to.equal(createdScripts[i].id);
            }
          }
        }),
        { numRuns: 50 }
      );
    });

    it('should maintain persistence through settings manager', () => {
      // Verify that scripts persist through the settings manager (simulating workspace reload)
      fc.assert(
        fc.asyncProperty(
          fc.record({
            name: validNameArbitrary,
            command: validCommandArbitrary,
            projectPath: projectPathArbitrary,
          }),
          async (data) => {
            // Clear mock settings before test
            mockSettings = {};

            // Create the script
            const createResult = await customScriptManager.create(
              data.name,
              data.command,
              data.projectPath
            );

            expect(createResult.success).to.be.true;
            if (!createResult.success) {
              return; // Type guard
            }

            const createdScript = createResult.data;

            // Simulate workspace reload by creating a new CustomScriptManager
            // with the same SettingsManager (which retains the mock settings)
            const newCustomScriptManager = new CustomScriptManager(settingsManager);

            // Retrieve the script using the new manager
            const retrievedScript = newCustomScriptManager.get(createdScript.id);

            // Verify the script persisted
            expect(retrievedScript).to.not.be.null;
            expect(retrievedScript?.id).to.equal(createdScript.id);
            expect(retrievedScript?.name).to.equal(data.name.trim());
            expect(retrievedScript?.command).to.equal(data.command.trim());
            expect(retrievedScript?.projectPath).to.equal(data.projectPath);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty lists correctly', () => {
      // Verify that listing scripts when none exist returns empty array
      mockSettings = {};

      const scripts = customScriptManager.list();
      expect(scripts).to.be.an('array');
      expect(scripts.length).to.equal(0);
    });

    it('should filter list by project path correctly', () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: validNameArbitrary,
              command: validCommandArbitrary,
              projectPath: fc.oneof(
                fc.constant('project-a'),
                fc.constant('project-b'),
                fc.constant('')
              ),
            }),
            { minLength: 3, maxLength: 10 }
          ),
          async (scripts) => {
            // Clear mock settings before test
            mockSettings = {};

            // Create all scripts
            const createdScripts: CustomScript[] = [];
            for (const script of scripts) {
              const result = await customScriptManager.create(
                script.name,
                script.command,
                script.projectPath
              );

              if (result.success) {
                createdScripts.push(result.data);
              }
            }

            // Skip if we couldn't create scripts
            if (createdScripts.length === 0) {
              return;
            }

            // Test filtering by each project path
            const projectPaths = ['project-a', 'project-b', ''];
            for (const projectPath of projectPaths) {
              const filtered = customScriptManager.list(projectPath);

              // Verify all returned scripts have the correct project path
              for (const script of filtered) {
                expect(script.projectPath).to.equal(projectPath);
              }

              // Verify count matches expected
              const expectedCount = createdScripts.filter(
                (s) => s.projectPath === projectPath
              ).length;
              expect(filtered.length).to.equal(expectedCount);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
