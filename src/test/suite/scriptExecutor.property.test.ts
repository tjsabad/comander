/**
 * Property-based tests for ScriptExecutor
 * Task 5.2 - Property 4: Execution state tracking
 * **Validates: Requirements 2.5**
 * Task 5.4 - Property 6: Command construction format
 * **Validates: Requirements 3.2, 3.3**
 */

import { expect } from 'chai';
import * as fc from 'fast-check';
import { ScriptExecutor } from '../../scriptExecutor';
import { ScriptItem } from '../../types';
import { generateScriptId } from '../../utils';

describe('ScriptExecutor - Property-Based Tests', () => {
  let executor: ScriptExecutor;

  beforeEach(() => {
    executor = new ScriptExecutor();
  });

  describe('Property 4: Execution state tracking', () => {
    it('should mark script as executing when added to active executions', () => {
      // Custom arbitraries for valid script items
      const scriptTypeArbitrary = fc.constantFrom('npm-script', 'custom-script');
      const scriptNameArbitrary = fc.string({ minLength: 1, maxLength: 100 });
      const commandArbitrary = fc.string({ minLength: 1, maxLength: 500 });
      const projectPathArbitrary = fc.string({ minLength: 0, maxLength: 100 });

      const scriptArbitrary = fc.record({
        type: scriptTypeArbitrary,
        label: scriptNameArbitrary,
        command: commandArbitrary,
        projectPath: projectPathArbitrary,
      }) as fc.Arbitrary<ScriptItem>;

      fc.assert(
        fc.property(scriptArbitrary, (script) => {
          const scriptId = generateScriptId(script);

          // Property: Initially, script should not be executing
          expect(executor.isExecuting(scriptId)).to.be.false;

          // Simulate adding to active executions (as execute() would do)
          const mockTerminal = {} as any;
          (executor as any).activeExecutions.set(scriptId, {
            terminal: mockTerminal,
            script,
            startTime: Date.now(),
          });

          // Property: After adding to active executions, script should be executing
          expect(executor.isExecuting(scriptId)).to.be.true;

          // Clean up
          (executor as any).activeExecutions.delete(scriptId);
        }),
        { numRuns: 100 }
      );
    });

    it('should mark script as not executing when removed from active executions', () => {
      const scriptTypeArbitrary = fc.constantFrom('npm-script', 'custom-script');
      const scriptNameArbitrary = fc.string({ minLength: 1, maxLength: 100 });
      const commandArbitrary = fc.string({ minLength: 1, maxLength: 500 });
      const projectPathArbitrary = fc.string({ minLength: 0, maxLength: 100 });

      const scriptArbitrary = fc.record({
        type: scriptTypeArbitrary,
        label: scriptNameArbitrary,
        command: commandArbitrary,
        projectPath: projectPathArbitrary,
      }) as fc.Arbitrary<ScriptItem>;

      fc.assert(
        fc.property(scriptArbitrary, (script) => {
          const scriptId = generateScriptId(script);

          // Add to active executions
          const mockTerminal = { dispose: () => {} } as any;
          (executor as any).activeExecutions.set(scriptId, {
            terminal: mockTerminal,
            script,
            startTime: Date.now(),
          });

          // Verify it's executing
          expect(executor.isExecuting(scriptId)).to.be.true;

          // Property: After terminating, script should not be executing
          executor.terminate(scriptId);
          expect(executor.isExecuting(scriptId)).to.be.false;
        }),
        { numRuns: 100 }
      );
    });

    it('should track multiple scripts independently', () => {
      const scriptTypeArbitrary = fc.constantFrom('npm-script', 'custom-script');
      const scriptNameArbitrary = fc.string({ minLength: 1, maxLength: 50 });
      const commandArbitrary = fc.string({ minLength: 1, maxLength: 200 });
      const projectPathArbitrary = fc.string({ minLength: 0, maxLength: 50 });

      const scriptArbitrary = fc.record({
        type: scriptTypeArbitrary,
        label: scriptNameArbitrary,
        command: commandArbitrary,
        projectPath: projectPathArbitrary,
      }) as fc.Arbitrary<ScriptItem>;

      const scriptsArbitrary = fc.array(scriptArbitrary, {
        minLength: 2,
        maxLength: 10,
      });

      fc.assert(
        fc.property(scriptsArbitrary, (scripts) => {
          // Create unique scripts by generating unique IDs
          const uniqueScripts = scripts.filter(
            (script, index, self) =>
              index ===
              self.findIndex((s) => generateScriptId(s) === generateScriptId(script))
          );

          // Skip if we don't have at least 2 unique scripts
          if (uniqueScripts.length < 2) {
            return true;
          }

          const scriptIds = uniqueScripts.map(generateScriptId);

          // Property: Initially, no scripts should be executing
          for (const scriptId of scriptIds) {
            expect(executor.isExecuting(scriptId)).to.be.false;
          }

          // Add all scripts to active executions
          for (const script of uniqueScripts) {
            const scriptId = generateScriptId(script);
            const mockTerminal = { dispose: () => {} } as any;
            (executor as any).activeExecutions.set(scriptId, {
              terminal: mockTerminal,
              script,
              startTime: Date.now(),
            });
          }

          // Property: All scripts should be executing
          for (const scriptId of scriptIds) {
            expect(executor.isExecuting(scriptId)).to.be.true;
          }

          // Terminate half of the scripts
          const halfCount = Math.floor(uniqueScripts.length / 2);
          for (let i = 0; i < halfCount; i++) {
            executor.terminate(scriptIds[i]);
          }

          // Property: Terminated scripts should not be executing
          for (let i = 0; i < halfCount; i++) {
            expect(executor.isExecuting(scriptIds[i])).to.be.false;
          }

          // Property: Non-terminated scripts should still be executing
          for (let i = halfCount; i < uniqueScripts.length; i++) {
            expect(executor.isExecuting(scriptIds[i])).to.be.true;
          }

          // Clean up remaining scripts
          for (let i = halfCount; i < uniqueScripts.length; i++) {
            executor.terminate(scriptIds[i]);
          }

          // Property: After cleanup, no scripts should be executing
          for (const scriptId of scriptIds) {
            expect(executor.isExecuting(scriptId)).to.be.false;
          }
        }),
        { numRuns: 50 }
      );
    });

    it('should maintain execution state consistency across state transitions', () => {
      const scriptTypeArbitrary = fc.constantFrom('npm-script', 'custom-script');
      const scriptNameArbitrary = fc.string({ minLength: 1, maxLength: 100 });
      const commandArbitrary = fc.string({ minLength: 1, maxLength: 500 });
      const projectPathArbitrary = fc.string({ minLength: 0, maxLength: 100 });

      const scriptArbitrary = fc.record({
        type: scriptTypeArbitrary,
        label: scriptNameArbitrary,
        command: commandArbitrary,
        projectPath: projectPathArbitrary,
      }) as fc.Arbitrary<ScriptItem>;

      // Generate a sequence of state transitions (add/remove)
      const stateTransitionsArbitrary = fc.array(
        fc.record({
          script: scriptArbitrary,
          action: fc.constantFrom('add', 'remove'),
        }),
        { minLength: 1, maxLength: 20 }
      );

      fc.assert(
        fc.property(stateTransitionsArbitrary, (transitions) => {
          const currentlyExecuting = new Set<string>();

          for (const transition of transitions) {
            const scriptId = generateScriptId(transition.script);

            if (transition.action === 'add') {
              // Add to active executions
              const mockTerminal = { dispose: () => {} } as any;
              (executor as any).activeExecutions.set(scriptId, {
                terminal: mockTerminal,
                script: transition.script,
                startTime: Date.now(),
              });
              currentlyExecuting.add(scriptId);
            } else {
              // Remove from active executions
              executor.terminate(scriptId);
              currentlyExecuting.delete(scriptId);
            }

            // Property: isExecuting should always reflect the current state
            const isExecuting = executor.isExecuting(scriptId);
            const shouldBeExecuting = currentlyExecuting.has(scriptId);
            expect(isExecuting).to.equal(
              shouldBeExecuting,
              `Script ${scriptId} execution state mismatch after ${transition.action}`
            );
          }

          // Clean up any remaining executions
          for (const scriptId of currentlyExecuting) {
            executor.terminate(scriptId);
          }
        }),
        { numRuns: 50 }
      );
    });

    it('should return false for non-existent script IDs', () => {
      const scriptIdArbitrary = fc.string({ minLength: 1, maxLength: 200 });

      fc.assert(
        fc.property(scriptIdArbitrary, (scriptId) => {
          // Property: isExecuting should return false for any script ID not in active executions
          const isExecuting = executor.isExecuting(scriptId);
          expect(isExecuting).to.be.false;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 6: Command construction format', () => {
    // Arbitraries for generating valid script data
    const scriptNameArbitrary = fc
      .string({ minLength: 1, maxLength: 100 })
      .filter((s) => s.trim().length > 0 && !/\s/.test(s)); // No whitespace in script names

    const projectPathArbitrary = fc.string({ minLength: 0, maxLength: 100 });

    const commandArbitrary = fc
      .string({ minLength: 1, maxLength: 500 })
      .filter((s) => s.trim().length > 0);

    const parametersArbitrary = fc.string({ minLength: 0, maxLength: 200 });

    const nonEmptyParametersArbitrary = fc
      .string({ minLength: 1, maxLength: 200 })
      .filter((s) => s.trim().length > 0);

    it('should construct npm commands with double-dash separator if and only if parameters are non-empty', () => {
      fc.assert(
        fc.property(
          fc.record({
            scriptName: scriptNameArbitrary,
            projectPath: projectPathArbitrary,
            parameters: parametersArbitrary,
          }),
          (data) => {
            const script: ScriptItem = {
              type: 'npm-script',
              label: data.scriptName,
              command: 'some-command', // The actual command doesn't matter for npm scripts
              projectPath: data.projectPath,
            };

            // Access private method through reflection for testing
            const command = (executor as any).constructCommand(script, data.parameters);

            const hasNonEmptyParams = data.parameters && data.parameters.trim().length > 0;

            if (hasNonEmptyParams) {
              // If parameters are non-empty, command should have double-dash separator
              expect(command).to.include(' -- ');
              expect(command).to.equal(`npm run ${data.scriptName} -- ${data.parameters}`);
            } else {
              // If parameters are empty or whitespace, no double-dash separator
              expect(command).to.not.include(' -- ');
              expect(command).to.equal(`npm run ${data.scriptName}`);
            }
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should construct npm commands without double-dash when parameters are empty', () => {
      fc.assert(
        fc.property(
          fc.record({
            scriptName: scriptNameArbitrary,
            projectPath: projectPathArbitrary,
          }),
          (data) => {
            const script: ScriptItem = {
              type: 'npm-script',
              label: data.scriptName,
              command: 'some-command',
              projectPath: data.projectPath,
            };

            // Test with undefined parameters
            const commandUndefined = (executor as any).constructCommand(script, undefined);
            expect(commandUndefined).to.equal(`npm run ${data.scriptName}`);
            expect(commandUndefined).to.not.include(' -- ');

            // Test with empty string parameters
            const commandEmpty = (executor as any).constructCommand(script, '');
            expect(commandEmpty).to.equal(`npm run ${data.scriptName}`);
            expect(commandEmpty).to.not.include(' -- ');
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should construct npm commands with double-dash when parameters are non-empty', () => {
      fc.assert(
        fc.property(
          fc.record({
            scriptName: scriptNameArbitrary,
            projectPath: projectPathArbitrary,
            parameters: nonEmptyParametersArbitrary,
          }),
          (data) => {
            const script: ScriptItem = {
              type: 'npm-script',
              label: data.scriptName,
              command: 'some-command',
              projectPath: data.projectPath,
            };

            const command = (executor as any).constructCommand(script, data.parameters);

            // Must include double-dash separator
            expect(command).to.include(' -- ');

            // Must follow the exact format: npm run <scriptName> -- <parameters>
            expect(command).to.equal(`npm run ${data.scriptName} -- ${data.parameters}`);

            // Verify components
            expect(command).to.match(/^npm run /);
            expect(command).to.include(data.scriptName);
            expect(command).to.include(data.parameters);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should construct custom script commands by appending parameters directly', () => {
      fc.assert(
        fc.property(
          fc.record({
            scriptName: scriptNameArbitrary,
            scriptCommand: commandArbitrary,
            projectPath: projectPathArbitrary,
            parameters: parametersArbitrary,
          }),
          (data) => {
            const script: ScriptItem = {
              type: 'custom-script',
              label: data.scriptName,
              command: data.scriptCommand,
              projectPath: data.projectPath,
            };

            const command = (executor as any).constructCommand(script, data.parameters);

            const hasNonEmptyParams = data.parameters && data.parameters.trim().length > 0;

            if (hasNonEmptyParams) {
              // Custom scripts should append parameters with a space
              expect(command).to.equal(`${data.scriptCommand} ${data.parameters}`);
              // Custom scripts should NOT use npm run or double-dash
              expect(command).to.not.include('npm run');
              expect(command).to.not.include(' -- ');
            } else {
              // Without parameters, just use the command as-is
              expect(command).to.equal(data.scriptCommand);
              expect(command).to.not.include('npm run');
            }
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should not add double-dash separator for whitespace-only parameters', () => {
      fc.assert(
        fc.property(
          fc.record({
            scriptName: scriptNameArbitrary,
            projectPath: projectPathArbitrary,
            whitespace: fc
              .string({ minLength: 1, maxLength: 20 })
              .filter((s) => s.trim().length === 0), // Only whitespace
          }),
          (data) => {
            const script: ScriptItem = {
              type: 'npm-script',
              label: data.scriptName,
              command: 'some-command',
              projectPath: data.projectPath,
            };

            const command = (executor as any).constructCommand(script, data.whitespace);

            // Whitespace-only parameters should be treated as empty
            expect(command).to.equal(`npm run ${data.scriptName}`);
            expect(command).to.not.include(' -- ');
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should handle parameters with special characters correctly', () => {
      // Test that parameters with quotes, dashes, and other special chars are preserved
      fc.assert(
        fc.property(
          fc.record({
            scriptName: scriptNameArbitrary,
            projectPath: projectPathArbitrary,
            parameters: fc
              .string({ minLength: 1, maxLength: 100 })
              .filter((s) => s.trim().length > 0),
          }),
          (data) => {
            const script: ScriptItem = {
              type: 'npm-script',
              label: data.scriptName,
              command: 'some-command',
              projectPath: data.projectPath,
            };

            const command = (executor as any).constructCommand(script, data.parameters);

            // Parameters should be preserved exactly as provided
            expect(command).to.equal(`npm run ${data.scriptName} -- ${data.parameters}`);

            // Extract the parameters part from the command
            const expectedPrefix = `npm run ${data.scriptName} -- `;
            expect(command.startsWith(expectedPrefix)).to.be.true;

            const extractedParams = command.substring(expectedPrefix.length);
            expect(extractedParams).to.equal(data.parameters);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should handle both npm and custom scripts consistently across script types', () => {
      // Test that the construction logic is consistent for both script types
      fc.assert(
        fc.property(
          fc.record({
            scriptName: scriptNameArbitrary,
            scriptCommand: commandArbitrary,
            projectPath: projectPathArbitrary,
            parameters: parametersArbitrary,
            isCustomScript: fc.boolean(),
          }),
          (data) => {
            const script: ScriptItem = {
              type: data.isCustomScript ? 'custom-script' : 'npm-script',
              label: data.scriptName,
              command: data.scriptCommand,
              projectPath: data.projectPath,
            };

            const command = (executor as any).constructCommand(script, data.parameters);

            const hasNonEmptyParams = data.parameters && data.parameters.trim().length > 0;

            if (data.isCustomScript) {
              // Custom scripts use command directly
              if (hasNonEmptyParams) {
                expect(command).to.equal(`${data.scriptCommand} ${data.parameters}`);
              } else {
                expect(command).to.equal(data.scriptCommand);
              }
              expect(command).to.not.include('npm run');
            } else {
              // npm scripts use npm run format
              if (hasNonEmptyParams) {
                expect(command).to.equal(`npm run ${data.scriptName} -- ${data.parameters}`);
              } else {
                expect(command).to.equal(`npm run ${data.scriptName}`);
              }
              expect(command).to.include('npm run');
            }
          }
        ),
        { numRuns: 200 }
      );
    });

    it('should always produce a non-empty command string', () => {
      // Ensure command construction never produces an empty string
      fc.assert(
        fc.property(
          fc.record({
            scriptName: scriptNameArbitrary,
            scriptCommand: commandArbitrary,
            projectPath: projectPathArbitrary,
            parameters: parametersArbitrary,
            isCustomScript: fc.boolean(),
          }),
          (data) => {
            const script: ScriptItem = {
              type: data.isCustomScript ? 'custom-script' : 'npm-script',
              label: data.scriptName,
              command: data.scriptCommand,
              projectPath: data.projectPath,
            };

            const command = (executor as any).constructCommand(script, data.parameters);

            expect(command).to.be.a('string');
            expect(command.length).to.be.greaterThan(0);
            expect(command.trim().length).to.be.greaterThan(0);
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});
