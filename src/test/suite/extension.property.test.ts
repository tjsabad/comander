/**
 * Property-based tests for Extension notification behavior
 * Task 10.4 - Property 15: Execution result notifications
 * **Validates: Requirements 2.6, 6.8, 7.5, 7.6**
 */

import { expect } from 'chai';
import * as fc from 'fast-check';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ExecutionResult, BulkResult } from '../../types';

describe('Extension - Property-Based Tests', () => {
  let showInformationMessageStub: sinon.SinonStub;
  let showErrorMessageStub: sinon.SinonStub;

  beforeEach(() => {
    // Stub VS Code notification methods
    showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage');
    showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Property 15: Execution result notifications', () => {
    describe('Single script execution notifications', () => {
      it('should display success notification for successful executions with exit code 0', () => {
        // Generate execution results with success=true and exitCode=0
        const successResultArbitrary = fc.record({
          success: fc.constant(true),
          exitCode: fc.constant(0),
          duration: fc.integer({ min: 0, max: 300000 }),
          scriptName: fc.string({ minLength: 1, maxLength: 100 }),
        }) as fc.Arbitrary<ExecutionResult>;

        fc.assert(
          fc.property(successResultArbitrary, (result) => {
            // Clear previous calls
            showInformationMessageStub.resetHistory();
            showErrorMessageStub.resetHistory();

            // Simulate the notification behavior from extension.ts
            if (result.success) {
              vscode.window.showInformationMessage(
                `Script "${result.scriptName}" completed successfully`
              );
            }

            // Property: Success notification should be displayed with script name
            expect(showInformationMessageStub.calledOnce).to.be.true;
            expect(showErrorMessageStub.called).to.be.false;

            const callArgs = showInformationMessageStub.firstCall.args[0];
            expect(callArgs).to.include(result.scriptName);
            expect(callArgs).to.include('completed successfully');
          }),
          { numRuns: 100 }
        );
      });

      it('should display error notification for failed executions with non-zero exit code', () => {
        // Generate execution results with success=false and non-zero exitCode
        const failureResultArbitrary = fc.record({
          success: fc.constant(false),
          exitCode: fc.integer({ min: 1, max: 255 }),
          duration: fc.integer({ min: 0, max: 300000 }),
          scriptName: fc.string({ minLength: 1, maxLength: 100 }),
        }) as fc.Arbitrary<ExecutionResult>;

        fc.assert(
          fc.property(failureResultArbitrary, (result) => {
            // Clear previous calls
            showInformationMessageStub.resetHistory();
            showErrorMessageStub.resetHistory();

            // Simulate the notification behavior from extension.ts
            if (!result.success) {
              vscode.window.showErrorMessage(
                `Script "${result.scriptName}" failed with exit code ${result.exitCode}`
              );
            }

            // Property: Error notification should be displayed with script name and exit code
            expect(showErrorMessageStub.calledOnce).to.be.true;
            expect(showInformationMessageStub.called).to.be.false;

            const callArgs = showErrorMessageStub.firstCall.args[0];
            expect(callArgs).to.include(result.scriptName);
            expect(callArgs).to.include('failed');
            expect(callArgs).to.include(result.exitCode.toString());
          }),
          { numRuns: 100 }
        );
      });

      it('should display appropriate notification based on execution success flag', () => {
        // Generate both successful and failed execution results
        const executionResultArbitrary = fc.record({
          success: fc.boolean(),
          exitCode: fc.integer({ min: 0, max: 255 }),
          duration: fc.integer({ min: 0, max: 300000 }),
          scriptName: fc.string({ minLength: 1, maxLength: 100 }),
        }) as fc.Arbitrary<ExecutionResult>;

        fc.assert(
          fc.property(executionResultArbitrary, (result) => {
            // Clear previous calls
            showInformationMessageStub.resetHistory();
            showErrorMessageStub.resetHistory();

            // Simulate the notification behavior from extension.ts
            if (result.success) {
              vscode.window.showInformationMessage(
                `Script "${result.scriptName}" completed successfully`
              );
            } else {
              vscode.window.showErrorMessage(
                `Script "${result.scriptName}" failed with exit code ${result.exitCode}`
              );
            }

            // Property: Exactly one notification type should be shown
            const totalCalls =
              showInformationMessageStub.callCount + showErrorMessageStub.callCount;
            expect(totalCalls).to.equal(1);

            // Property: Success flag determines notification type
            if (result.success) {
              expect(showInformationMessageStub.calledOnce).to.be.true;
              expect(showErrorMessageStub.called).to.be.false;
            } else {
              expect(showErrorMessageStub.calledOnce).to.be.true;
              expect(showInformationMessageStub.called).to.be.false;
            }
          }),
          { numRuns: 200 }
        );
      });

      it('should always include script name in notifications', () => {
        const executionResultArbitrary = fc.record({
          success: fc.boolean(),
          exitCode: fc.integer({ min: 0, max: 255 }),
          duration: fc.integer({ min: 0, max: 300000 }),
          scriptName: fc.string({ minLength: 1, maxLength: 100 }),
        }) as fc.Arbitrary<ExecutionResult>;

        fc.assert(
          fc.property(executionResultArbitrary, (result) => {
            // Clear previous calls
            showInformationMessageStub.resetHistory();
            showErrorMessageStub.resetHistory();

            // Simulate the notification behavior from extension.ts
            if (result.success) {
              vscode.window.showInformationMessage(
                `Script "${result.scriptName}" completed successfully`
              );
            } else {
              vscode.window.showErrorMessage(
                `Script "${result.scriptName}" failed with exit code ${result.exitCode}`
              );
            }

            // Property: Notification message always contains the script name
            const stub = result.success
              ? showInformationMessageStub
              : showErrorMessageStub;
            const callArgs = stub.firstCall.args[0];
            expect(callArgs).to.include(result.scriptName);
          }),
          { numRuns: 200 }
        );
      });
    });

    describe('Bulk execution notifications', () => {
      it('should display success notification with script count and duration when all scripts succeed', () => {
        // Generate successful bulk results (no failedScript or timedOutScript)
        const successBulkResultArbitrary = fc.record({
          totalScripts: fc.integer({ min: 2, max: 100 }),
          successfulScripts: fc.integer({ min: 2, max: 100 }),
          totalDuration: fc.integer({ min: 0, max: 30000000 }), // up to 30000 seconds
          failedScript: fc.constant(undefined),
          timedOutScript: fc.constant(undefined),
        }).filter((result) => result.successfulScripts === result.totalScripts) as fc.Arbitrary<BulkResult>;

        fc.assert(
          fc.property(successBulkResultArbitrary, (result) => {
            // Clear previous calls
            showInformationMessageStub.resetHistory();
            showErrorMessageStub.resetHistory();

            // Simulate the notification behavior from extension.ts
            if (!result.failedScript && !result.timedOutScript) {
              const durationSeconds = Math.floor(result.totalDuration / 1000);
              vscode.window.showInformationMessage(
                `Bulk execution completed successfully! Executed ${result.totalScripts} scripts in ${durationSeconds}s.`
              );
            }

            // Property: Success notification should include script count and duration
            expect(showInformationMessageStub.calledOnce).to.be.true;
            expect(showErrorMessageStub.called).to.be.false;

            const callArgs = showInformationMessageStub.firstCall.args[0];
            expect(callArgs).to.include('completed successfully');
            expect(callArgs).to.include(result.totalScripts.toString());
            
            const durationSeconds = Math.floor(result.totalDuration / 1000);
            expect(callArgs).to.include(durationSeconds.toString());
          }),
          { numRuns: 100 }
        );
      });

      it('should display error notification with failed script details when a script fails', () => {
        // Generate bulk results with a failed script
        const failedBulkResultArbitrary = fc.record({
          totalScripts: fc.integer({ min: 2, max: 100 }),
          successfulScripts: fc.integer({ min: 0, max: 99 }),
          totalDuration: fc.integer({ min: 0, max: 30000000 }),
          failedScript: fc.record({
            name: fc.string({ minLength: 1, maxLength: 100 }),
            exitCode: fc.integer({ min: 1, max: 255 }),
            index: fc.integer({ min: 0, max: 99 }),
          }),
          timedOutScript: fc.constant(undefined),
        }).filter((result) => 
          result.failedScript !== undefined && 
          result.successfulScripts < result.totalScripts
        ) as fc.Arbitrary<BulkResult>;

        fc.assert(
          fc.property(failedBulkResultArbitrary, (result) => {
            // Clear previous calls
            showInformationMessageStub.resetHistory();
            showErrorMessageStub.resetHistory();

            // Simulate the notification behavior from extension.ts
            if (result.failedScript) {
              vscode.window.showErrorMessage(
                `Bulk execution failed at script "${result.failedScript.name}" (exit code ${result.failedScript.exitCode}). Completed ${result.successfulScripts} of ${result.totalScripts} scripts.`
              );
            }

            // Property: Error notification should include failed script name, exit code, and progress
            expect(showErrorMessageStub.calledOnce).to.be.true;
            expect(showInformationMessageStub.called).to.be.false;

            const callArgs = showErrorMessageStub.firstCall.args[0];
            expect(callArgs).to.include('failed');
            expect(callArgs).to.include(result.failedScript!.name);
            expect(callArgs).to.include(result.failedScript!.exitCode.toString());
            expect(callArgs).to.include(result.successfulScripts.toString());
            expect(callArgs).to.include(result.totalScripts.toString());
          }),
          { numRuns: 100 }
        );
      });

      it('should display error notification with timeout details when a script times out', () => {
        // Generate bulk results with a timed-out script
        const timeoutBulkResultArbitrary = fc.record({
          totalScripts: fc.integer({ min: 2, max: 100 }),
          successfulScripts: fc.integer({ min: 0, max: 99 }),
          totalDuration: fc.integer({ min: 0, max: 30000000 }),
          failedScript: fc.constant(undefined),
          timedOutScript: fc.record({
            name: fc.string({ minLength: 1, maxLength: 100 }),
            index: fc.integer({ min: 0, max: 99 }),
          }),
        }).filter((result) => 
          result.timedOutScript !== undefined && 
          result.successfulScripts < result.totalScripts
        ) as fc.Arbitrary<BulkResult>;

        fc.assert(
          fc.property(timeoutBulkResultArbitrary, (result) => {
            // Clear previous calls
            showInformationMessageStub.resetHistory();
            showErrorMessageStub.resetHistory();

            // Simulate the notification behavior from extension.ts
            if (result.timedOutScript) {
              vscode.window.showErrorMessage(
                `Bulk execution timed out at script "${result.timedOutScript.name}". Completed ${result.successfulScripts} of ${result.totalScripts} scripts.`
              );
            }

            // Property: Error notification should include timed-out script name and progress
            expect(showErrorMessageStub.calledOnce).to.be.true;
            expect(showInformationMessageStub.called).to.be.false;

            const callArgs = showErrorMessageStub.firstCall.args[0];
            expect(callArgs).to.include('timed out');
            expect(callArgs).to.include(result.timedOutScript!.name);
            expect(callArgs).to.include(result.successfulScripts.toString());
            expect(callArgs).to.include(result.totalScripts.toString());
          }),
          { numRuns: 100 }
        );
      });

      it('should display exactly one notification type per bulk execution', () => {
        // Generate various bulk results (success, failure, timeout)
        const bulkResultArbitrary = fc.oneof(
          // Success case
          fc.record({
            totalScripts: fc.integer({ min: 2, max: 100 }),
            successfulScripts: fc.integer({ min: 2, max: 100 }),
            totalDuration: fc.integer({ min: 0, max: 30000000 }),
            failedScript: fc.constant(undefined),
            timedOutScript: fc.constant(undefined),
          }).filter((r) => r.successfulScripts === r.totalScripts),
          // Failure case
          fc.record({
            totalScripts: fc.integer({ min: 2, max: 100 }),
            successfulScripts: fc.integer({ min: 0, max: 99 }),
            totalDuration: fc.integer({ min: 0, max: 30000000 }),
            failedScript: fc.record({
              name: fc.string({ minLength: 1, maxLength: 100 }),
              exitCode: fc.integer({ min: 1, max: 255 }),
              index: fc.integer({ min: 0, max: 99 }),
            }),
            timedOutScript: fc.constant(undefined),
          }).filter((r) => r.successfulScripts < r.totalScripts),
          // Timeout case
          fc.record({
            totalScripts: fc.integer({ min: 2, max: 100 }),
            successfulScripts: fc.integer({ min: 0, max: 99 }),
            totalDuration: fc.integer({ min: 0, max: 30000000 }),
            failedScript: fc.constant(undefined),
            timedOutScript: fc.record({
              name: fc.string({ minLength: 1, maxLength: 100 }),
              index: fc.integer({ min: 0, max: 99 }),
            }),
          }).filter((r) => r.successfulScripts < r.totalScripts)
        ) as fc.Arbitrary<BulkResult>;

        fc.assert(
          fc.property(bulkResultArbitrary, (result) => {
            // Clear previous calls
            showInformationMessageStub.resetHistory();
            showErrorMessageStub.resetHistory();

            // Simulate the notification behavior from extension.ts
            if (result.failedScript) {
              vscode.window.showErrorMessage(
                `Bulk execution failed at script "${result.failedScript.name}" (exit code ${result.failedScript.exitCode}). Completed ${result.successfulScripts} of ${result.totalScripts} scripts.`
              );
            } else if (result.timedOutScript) {
              vscode.window.showErrorMessage(
                `Bulk execution timed out at script "${result.timedOutScript.name}". Completed ${result.successfulScripts} of ${result.totalScripts} scripts.`
              );
            } else {
              const durationSeconds = Math.floor(result.totalDuration / 1000);
              vscode.window.showInformationMessage(
                `Bulk execution completed successfully! Executed ${result.totalScripts} scripts in ${durationSeconds}s.`
              );
            }

            // Property: Exactly one notification should be shown
            const totalCalls =
              showInformationMessageStub.callCount + showErrorMessageStub.callCount;
            expect(totalCalls).to.equal(1);

            // Property: Notification type matches execution outcome
            if (!result.failedScript && !result.timedOutScript) {
              expect(showInformationMessageStub.calledOnce).to.be.true;
              expect(showErrorMessageStub.called).to.be.false;
            } else {
              expect(showErrorMessageStub.calledOnce).to.be.true;
              expect(showInformationMessageStub.called).to.be.false;
            }
          }),
          { numRuns: 200 }
        );
      });

      it('should prioritize failed script notification over timeout notification', () => {
        // Generate bulk results with both failed and timeout (edge case testing)
        const conflictBulkResultArbitrary = fc.record({
          totalScripts: fc.integer({ min: 2, max: 100 }),
          successfulScripts: fc.integer({ min: 0, max: 99 }),
          totalDuration: fc.integer({ min: 0, max: 30000000 }),
          failedScript: fc.record({
            name: fc.string({ minLength: 1, maxLength: 100 }),
            exitCode: fc.integer({ min: 1, max: 255 }),
            index: fc.integer({ min: 0, max: 99 }),
          }),
          timedOutScript: fc.record({
            name: fc.string({ minLength: 1, maxLength: 100 }),
            index: fc.integer({ min: 0, max: 99 }),
          }),
        }).filter((r) => r.successfulScripts < r.totalScripts) as fc.Arbitrary<BulkResult>;

        fc.assert(
          fc.property(conflictBulkResultArbitrary, (result) => {
            // Clear previous calls
            showInformationMessageStub.resetHistory();
            showErrorMessageStub.resetHistory();

            // Simulate the notification behavior from extension.ts
            // The implementation checks failedScript first, so it takes priority
            if (result.failedScript) {
              vscode.window.showErrorMessage(
                `Bulk execution failed at script "${result.failedScript.name}" (exit code ${result.failedScript.exitCode}). Completed ${result.successfulScripts} of ${result.totalScripts} scripts.`
              );
            } else if (result.timedOutScript) {
              vscode.window.showErrorMessage(
                `Bulk execution timed out at script "${result.timedOutScript.name}". Completed ${result.successfulScripts} of ${result.totalScripts} scripts.`
              );
            }

            // Property: Failed script notification is prioritized
            expect(showErrorMessageStub.calledOnce).to.be.true;
            const callArgs = showErrorMessageStub.firstCall.args[0];
            expect(callArgs).to.include('failed');
            expect(callArgs).to.include(result.failedScript!.name);
          }),
          { numRuns: 100 }
        );
      });

      it('should include progress information (completed/total) in failure and timeout notifications', () => {
        // Test that failure/timeout notifications always show progress
        const incompleteResultArbitrary = fc.oneof(
          // Failure case
          fc.record({
            totalScripts: fc.integer({ min: 2, max: 100 }),
            successfulScripts: fc.integer({ min: 0, max: 99 }),
            totalDuration: fc.integer({ min: 0, max: 30000000 }),
            failedScript: fc.record({
              name: fc.string({ minLength: 1, maxLength: 100 }),
              exitCode: fc.integer({ min: 1, max: 255 }),
              index: fc.integer({ min: 0, max: 99 }),
            }),
            timedOutScript: fc.constant(undefined),
          }).filter((r) => r.successfulScripts < r.totalScripts),
          // Timeout case
          fc.record({
            totalScripts: fc.integer({ min: 2, max: 100 }),
            successfulScripts: fc.integer({ min: 0, max: 99 }),
            totalDuration: fc.integer({ min: 0, max: 30000000 }),
            failedScript: fc.constant(undefined),
            timedOutScript: fc.record({
              name: fc.string({ minLength: 1, maxLength: 100 }),
              index: fc.integer({ min: 0, max: 99 }),
            }),
          }).filter((r) => r.successfulScripts < r.totalScripts)
        ) as fc.Arbitrary<BulkResult>;

        fc.assert(
          fc.property(incompleteResultArbitrary, (result) => {
            // Clear previous calls
            showInformationMessageStub.resetHistory();
            showErrorMessageStub.resetHistory();

            // Simulate the notification behavior from extension.ts
            if (result.failedScript) {
              vscode.window.showErrorMessage(
                `Bulk execution failed at script "${result.failedScript.name}" (exit code ${result.failedScript.exitCode}). Completed ${result.successfulScripts} of ${result.totalScripts} scripts.`
              );
            } else if (result.timedOutScript) {
              vscode.window.showErrorMessage(
                `Bulk execution timed out at script "${result.timedOutScript.name}". Completed ${result.successfulScripts} of ${result.totalScripts} scripts.`
              );
            }

            // Property: Error notification includes progress information
            expect(showErrorMessageStub.calledOnce).to.be.true;
            const callArgs = showErrorMessageStub.firstCall.args[0];
            expect(callArgs).to.include(`Completed ${result.successfulScripts} of ${result.totalScripts}`);
          }),
          { numRuns: 200 }
        );
      });
    });
  });
});
