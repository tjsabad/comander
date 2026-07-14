/**
 * Property-based tests for BulkExecutor
 * Task 8.4 - Property 12: Bulk execution failure halting
 * **Validates: Requirements 6.6**
 */

import { expect } from 'chai';
import * as fc from 'fast-check';
import * as sinon from 'sinon';
import { BulkExecutor } from '../../bulkExecutor';
import { ScriptExecutor } from '../../scriptExecutor';
import { SettingsManager } from '../../settingsManager';
import { ScriptItem, ExecutionResult } from '../../types';

describe('BulkExecutor - Property-Based Tests', () => {
  let bulkExecutor: BulkExecutor;
  let scriptExecutor: ScriptExecutor;
  let settingsManager: SettingsManager;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    scriptExecutor = new ScriptExecutor();
    settingsManager = {} as SettingsManager;
    bulkExecutor = new BulkExecutor(scriptExecutor, settingsManager);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Property 12: Bulk execution failure halting', () => {
    /**
     * **Validates: Requirements 6.6**
     * 
     * Property: For any bulk execution sequence containing a script that returns
     * a non-zero exit code, execution SHALL halt immediately after the failing script,
     * no subsequent scripts in the sequence SHALL execute, and an error notification
     * SHALL indicate the failing script name and its position in the sequence.
     */

    it('should halt execution immediately when any script fails with non-zero exit code', async () => {
      const scriptNameArbitrary = fc.string({ minLength: 1, maxLength: 50 });
      const commandArbitrary = fc.string({ minLength: 1, maxLength: 100 });
      const projectPathArbitrary = fc.string({ minLength: 0, maxLength: 50 });
      const scriptTypeArbitrary = fc.constantFrom('npm-script', 'custom-script');

      const scriptArbitrary = fc.record({
        type: scriptTypeArbitrary,
        label: scriptNameArbitrary,
        command: commandArbitrary,
        projectPath: projectPathArbitrary,
      }) as fc.Arbitrary<ScriptItem>;

      const bulkSequenceArbitrary = fc.record({
        scripts: fc.array(scriptArbitrary, { minLength: 2, maxLength: 10 }),
        failureIndex: fc.nat(),
        failureExitCode: fc.integer({ min: 1, max: 255 }),
      });

      await fc.assert(
        fc.asyncProperty(bulkSequenceArbitrary, async (data) => {
          const { scripts, failureExitCode } = data;
          const failureIndex = data.failureIndex % scripts.length;
          const order = Array.from({ length: scripts.length }, (_, i) => i);

          const executeStub = sandbox.stub(scriptExecutor, 'execute');

          for (let i = 0; i < scripts.length; i++) {
            if (i < failureIndex) {
              executeStub.onCall(i).resolves({
                success: true,
                exitCode: 0,
                duration: 100,
                scriptName: scripts[i].label,
              } as ExecutionResult);
            } else if (i === failureIndex) {
              executeStub.onCall(i).resolves({
                success: false,
                exitCode: failureExitCode,
                duration: 100,
                scriptName: scripts[i].label,
              } as ExecutionResult);
            }
          }

          const result = await bulkExecutor.executeBulk(scripts, order);

          expect(executeStub.callCount).to.equal(failureIndex + 1);
          expect(result.failedScript).to.exist;
          expect(result.failedScript?.name).to.equal(scripts[failureIndex].label);
          expect(result.failedScript?.exitCode).to.equal(failureExitCode);
          expect(result.failedScript?.index).to.equal(failureIndex);
          expect(result.successfulScripts).to.equal(failureIndex);
          expect(result.totalScripts).to.equal(scripts.length);
          expect(result.timedOutScript).to.be.undefined;

          executeStub.restore();
        }),
        { numRuns: 100 }
      );
    });
  });
});
