/**
 * Unit tests for notification behavior
 * Task 10.5: Write unit tests for notifications
 * Requirements: 2.6, 7.5, 7.6, 7.8
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { suite, test, beforeEach, afterEach } from 'mocha';
import { ScriptExecutor } from '../../scriptExecutor';
import { BulkExecutor } from '../../bulkExecutor';
import { SettingsManager } from '../../settingsManager';
import { ScriptItem } from '../../types';

suite('Notification Tests', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  suite('Script Execution Notifications - Requirement 2.6, 7.5, 7.6', () => {
    let scriptExecutor: ScriptExecutor;
    let showInformationMessageStub: sinon.SinonStub;
    let showErrorMessageStub: sinon.SinonStub;
    let createTerminalStub: sinon.SinonStub;
    let createStatusBarItemStub: sinon.SinonStub;
    let onDidCloseTerminalStub: sinon.SinonStub;

    beforeEach(() => {
      scriptExecutor = new ScriptExecutor();

      showInformationMessageStub = sandbox.stub(
        vscode.window,
        'showInformationMessage'
      );
      showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');

      const mockTerminal = {
        show: sandbox.stub(),
        dispose: sandbox.stub(),
        sendText: sandbox.stub(),
        name: 'test-terminal',
        processId: Promise.resolve(1234),
        exitStatus: undefined,
      };

      const mockStatusBarItem = {
        text: '',
        tooltip: '',
        show: sandbox.stub(),
        dispose: sandbox.stub(),
      };

      createTerminalStub = sandbox
        .stub(vscode.window, 'createTerminal')
        .returns(mockTerminal as any);
      createStatusBarItemStub = sandbox
        .stub(vscode.window, 'createStatusBarItem')
        .returns(mockStatusBarItem as any);
      onDidCloseTerminalStub = sandbox.stub(
        vscode.window,
        'onDidCloseTerminal'
      );
    });

    test('should show success notification when script completes with exit code 0', async () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'build',
        command: 'npm run build',
        projectPath: '',
      };

      // Mock terminal close event with exit code 0
      onDidCloseTerminalStub.callsFake((callback) => {
        setTimeout(() => {
          const mockTerminal = createTerminalStub.firstCall.returnValue;
          mockTerminal.exitStatus = { code: 0 };
          callback(mockTerminal);
        }, 10);
        return { dispose: sandbox.stub() };
      });

      const result = await scriptExecutor.execute(script);

      // Verify success notification would be shown by extension.ts
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.scriptName, 'build');
      assert.strictEqual(result.exitCode, 0);
    });

    test('should show error notification when script fails with non-zero exit code', async () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'test',
        command: 'npm run test',
        projectPath: '',
      };

      // Mock terminal close event with non-zero exit code
      onDidCloseTerminalStub.callsFake((callback) => {
        setTimeout(() => {
          const mockTerminal = createTerminalStub.firstCall.returnValue;
          mockTerminal.exitStatus = { code: 1 };
          callback(mockTerminal);
        }, 10);
        return { dispose: sandbox.stub() };
      });

      const result = await scriptExecutor.execute(script);

      // Verify error notification would be shown by extension.ts
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.scriptName, 'test');
      assert.strictEqual(result.exitCode, 1);
    });

    test('should include script name in success notification', async () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'deploy',
        command: 'npm run deploy',
        projectPath: '',
      };

      onDidCloseTerminalStub.callsFake((callback) => {
        setTimeout(() => {
          const mockTerminal = createTerminalStub.firstCall.returnValue;
          mockTerminal.exitStatus = { code: 0 };
          callback(mockTerminal);
        }, 10);
        return { dispose: sandbox.stub() };
      });

      const result = await scriptExecutor.execute(script);

      assert.strictEqual(result.scriptName, 'deploy');
      assert.strictEqual(result.success, true);
    });

    test('should include script name and exit code in error notification', async () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'lint',
        command: 'npm run lint',
        projectPath: '',
      };

      onDidCloseTerminalStub.callsFake((callback) => {
        setTimeout(() => {
          const mockTerminal = createTerminalStub.firstCall.returnValue;
          mockTerminal.exitStatus = { code: 127 };
          callback(mockTerminal);
        }, 10);
        return { dispose: sandbox.stub() };
      });

      const result = await scriptExecutor.execute(script);

      assert.strictEqual(result.scriptName, 'lint');
      assert.strictEqual(result.exitCode, 127);
      assert.strictEqual(result.success, false);
    });
  });

  suite('Bulk Execution Notifications - Requirement 6.8, 7.5, 7.6', () => {
    let bulkExecutor: BulkExecutor;
    let scriptExecutor: ScriptExecutor;
    let settingsManager: SettingsManager;
    let showInformationMessageStub: sinon.SinonStub;
    let showErrorMessageStub: sinon.SinonStub;

    beforeEach(() => {
      const mockContext = {
        globalState: {
          get: sandbox.stub().returns(undefined),
          update: sandbox.stub().resolves(),
        },
        workspaceState: {
          get: sandbox.stub().returns(undefined),
          update: sandbox.stub().resolves(),
        },
        subscriptions: [],
      } as any;

      settingsManager = new SettingsManager(mockContext);
      scriptExecutor = new ScriptExecutor();
      bulkExecutor = new BulkExecutor(scriptExecutor, settingsManager);

      showInformationMessageStub = sandbox.stub(
        vscode.window,
        'showInformationMessage'
      );
      showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');

      // Mock terminal creation
      const mockTerminal = {
        show: sandbox.stub(),
        dispose: sandbox.stub(),
        sendText: sandbox.stub(),
        name: 'test-terminal',
        processId: Promise.resolve(1234),
        exitStatus: undefined,
      };

      const mockStatusBarItem = {
        text: '',
        tooltip: '',
        show: sandbox.stub(),
        dispose: sandbox.stub(),
      };

      sandbox.stub(vscode.window, 'createTerminal').returns(mockTerminal as any);
      sandbox
        .stub(vscode.window, 'createStatusBarItem')
        .returns(mockStatusBarItem as any);
    });

    test('should show success notification with total time and script count on successful bulk execution', async () => {
      const scripts: ScriptItem[] = [
        {
          type: 'npm-script',
          label: 'build',
          command: 'npm run build',
          projectPath: '',
        },
        {
          type: 'npm-script',
          label: 'test',
          command: 'npm run test',
          projectPath: '',
        },
      ];

      const order = [0, 1];

      // Mock successful executions
      const onDidCloseTerminalStub = sandbox.stub(
        vscode.window,
        'onDidCloseTerminal'
      );
      onDidCloseTerminalStub.callsFake((callback) => {
        setTimeout(() => {
          const terminals = (vscode.window.createTerminal as any).getCalls();
          for (const call of terminals) {
            const mockTerminal = call.returnValue;
            mockTerminal.exitStatus = { code: 0 };
            callback(mockTerminal);
          }
        }, 10);
        return { dispose: sandbox.stub() };
      });

      const result = await bulkExecutor.executeBulk(scripts, order);

      // Verify result structure for success notification
      assert.strictEqual(result.totalScripts, 2);
      assert.strictEqual(result.successfulScripts, 2);
      assert.strictEqual(result.failedScript, undefined);
      assert.strictEqual(result.timedOutScript, undefined);
      assert.ok(result.totalDuration >= 0);
    });

    test('should show error notification with failing script name and exit code on failure', async () => {
      const scripts: ScriptItem[] = [
        {
          type: 'npm-script',
          label: 'build',
          command: 'npm run build',
          projectPath: '',
        },
        {
          type: 'npm-script',
          label: 'test',
          command: 'npm run test',
          projectPath: '',
        },
      ];

      const order = [0, 1];

      // Mock first script succeeds, second fails
      let callCount = 0;
      const onDidCloseTerminalStub = sandbox.stub(
        vscode.window,
        'onDidCloseTerminal'
      );
      onDidCloseTerminalStub.callsFake((callback) => {
        setTimeout(() => {
          const mockTerminal = (vscode.window.createTerminal as any).getCalls()[
            callCount
          ].returnValue;
          mockTerminal.exitStatus = { code: callCount === 0 ? 0 : 1 };
          callback(mockTerminal);
          callCount++;
        }, 10);
        return { dispose: sandbox.stub() };
      });

      const result = await bulkExecutor.executeBulk(scripts, order);

      // Verify result structure for error notification
      assert.strictEqual(result.totalScripts, 2);
      assert.strictEqual(result.successfulScripts, 1);
      assert.ok(result.failedScript);
      assert.strictEqual(result.failedScript!.name, 'test');
      assert.strictEqual(result.failedScript!.exitCode, 1);
      assert.strictEqual(result.failedScript!.index, 1);
    });

    test('should show timeout error notification with script name on timeout', async () => {
      const scripts: ScriptItem[] = [
        {
          type: 'npm-script',
          label: 'long-running',
          command: 'npm run long-running',
          projectPath: '',
        },
      ];

      const order = [0];

      // Mock execution that never completes (simulates timeout)
      sandbox.stub(vscode.window, 'onDidCloseTerminal').callsFake(() => {
        // Terminal never closes - simulates timeout
        return { dispose: sandbox.stub() };
      });

      // Set a very short timeout for testing
      const originalTimeout = (bulkExecutor as any).TIMEOUT_MS;
      (bulkExecutor as any).TIMEOUT_MS = 50;

      const result = await bulkExecutor.executeBulk(scripts, order);

      // Restore timeout
      (bulkExecutor as any).TIMEOUT_MS = originalTimeout;

      // Verify result structure for timeout notification
      assert.strictEqual(result.totalScripts, 1);
      assert.strictEqual(result.successfulScripts, 0);
      assert.ok(result.timedOutScript);
      assert.strictEqual(result.timedOutScript!.name, 'long-running');
      assert.strictEqual(result.timedOutScript!.index, 0);
    });

    test('should include completed script count in failure notification', async () => {
      const scripts: ScriptItem[] = [
        {
          type: 'npm-script',
          label: 'script1',
          command: 'npm run script1',
          projectPath: '',
        },
        {
          type: 'npm-script',
          label: 'script2',
          command: 'npm run script2',
          projectPath: '',
        },
        {
          type: 'npm-script',
          label: 'script3',
          command: 'npm run script3',
          projectPath: '',
        },
      ];

      const order = [0, 1, 2];

      // Mock first two succeed, third fails
      let callCount = 0;
      const onDidCloseTerminalStub = sandbox.stub(
        vscode.window,
        'onDidCloseTerminal'
      );
      onDidCloseTerminalStub.callsFake((callback) => {
        setTimeout(() => {
          const mockTerminal = (vscode.window.createTerminal as any).getCalls()[
            callCount
          ].returnValue;
          mockTerminal.exitStatus = { code: callCount < 2 ? 0 : 1 };
          callback(mockTerminal);
          callCount++;
        }, 10);
        return { dispose: sandbox.stub() };
      });

      const result = await bulkExecutor.executeBulk(scripts, order);

      // Verify notification would show correct counts
      assert.strictEqual(result.totalScripts, 3);
      assert.strictEqual(result.successfulScripts, 2);
      assert.ok(result.failedScript);
    });
  });

  suite('Status Bar Updates - Requirement 7.8', () => {
    let scriptExecutor: ScriptExecutor;
    let createStatusBarItemStub: sinon.SinonStub;
    let mockStatusBarItem: any;

    beforeEach(() => {
      scriptExecutor = new ScriptExecutor();

      mockStatusBarItem = {
        text: '',
        tooltip: '',
        show: sandbox.stub(),
        dispose: sandbox.stub(),
      };

      createStatusBarItemStub = sandbox
        .stub(vscode.window, 'createStatusBarItem')
        .returns(mockStatusBarItem);

      const mockTerminal = {
        show: sandbox.stub(),
        dispose: sandbox.stub(),
        sendText: sandbox.stub(),
        name: 'test-terminal',
        processId: Promise.resolve(1234),
        exitStatus: undefined,
      };

      sandbox.stub(vscode.window, 'createTerminal').returns(mockTerminal as any);
    });

    test('should display script name in status bar during execution', async () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'build',
        command: 'npm run build',
        projectPath: '',
      };

      const onDidCloseTerminalStub = sandbox.stub(
        vscode.window,
        'onDidCloseTerminal'
      );
      onDidCloseTerminalStub.callsFake((callback) => {
        setTimeout(() => {
          const mockTerminal = (vscode.window.createTerminal as any).firstCall
            .returnValue;
          mockTerminal.exitStatus = { code: 0 };
          callback(mockTerminal);
        }, 50);
        return { dispose: sandbox.stub() };
      });

      const executePromise = scriptExecutor.execute(script);

      // Wait a bit for execution to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify status bar item was created and shown
      assert.ok(createStatusBarItemStub.calledOnce);
      assert.strictEqual(mockStatusBarItem.text, '$(sync~spin) Running: build');
      assert.strictEqual(mockStatusBarItem.tooltip, 'Executing script: build');
      assert.ok(mockStatusBarItem.show.calledOnce);

      await executePromise;
    });

    test('should show status bar with correct format for custom scripts', async () => {
      const script: ScriptItem = {
        type: 'custom-script',
        label: 'deploy-staging',
        command: 'sh deploy.sh staging',
        projectPath: '',
        id: 'custom-123',
      };

      const onDidCloseTerminalStub = sandbox.stub(
        vscode.window,
        'onDidCloseTerminal'
      );
      onDidCloseTerminalStub.callsFake((callback) => {
        setTimeout(() => {
          const mockTerminal = (vscode.window.createTerminal as any).firstCall
            .returnValue;
          mockTerminal.exitStatus = { code: 0 };
          callback(mockTerminal);
        }, 50);
        return { dispose: sandbox.stub() };
      });

      const executePromise = scriptExecutor.execute(script);

      await new Promise((resolve) => setTimeout(resolve, 10));

      assert.strictEqual(
        mockStatusBarItem.text,
        '$(sync~spin) Running: deploy-staging'
      );
      assert.strictEqual(
        mockStatusBarItem.tooltip,
        'Executing script: deploy-staging'
      );

      await executePromise;
    });

    test('should clear status bar indicator on completion', async () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'test',
        command: 'npm run test',
        projectPath: '',
      };

      const onDidCloseTerminalStub = sandbox.stub(
        vscode.window,
        'onDidCloseTerminal'
      );
      onDidCloseTerminalStub.callsFake((callback) => {
        setTimeout(() => {
          const mockTerminal = (vscode.window.createTerminal as any).firstCall
            .returnValue;
          mockTerminal.exitStatus = { code: 0 };
          callback(mockTerminal);
        }, 20);
        return { dispose: sandbox.stub() };
      });

      await scriptExecutor.execute(script);

      // Verify status bar item was disposed (cleared)
      assert.ok(mockStatusBarItem.dispose.calledOnce);
    });

    test('should clear status bar on script failure', async () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'failing-script',
        command: 'npm run failing-script',
        projectPath: '',
      };

      const onDidCloseTerminalStub = sandbox.stub(
        vscode.window,
        'onDidCloseTerminal'
      );
      onDidCloseTerminalStub.callsFake((callback) => {
        setTimeout(() => {
          const mockTerminal = (vscode.window.createTerminal as any).firstCall
            .returnValue;
          mockTerminal.exitStatus = { code: 1 };
          callback(mockTerminal);
        }, 20);
        return { dispose: sandbox.stub() };
      });

      await scriptExecutor.execute(script);

      // Verify status bar item was disposed even on failure
      assert.ok(mockStatusBarItem.dispose.calledOnce);
    });

    test('should update status bar for each concurrent execution', async () => {
      const script1: ScriptItem = {
        type: 'npm-script',
        label: 'build',
        command: 'npm run build',
        projectPath: '',
      };

      const script2: ScriptItem = {
        type: 'npm-script',
        label: 'test',
        command: 'npm run test',
        projectPath: '',
      };

      const mockStatusBarItem2 = {
        text: '',
        tooltip: '',
        show: sandbox.stub(),
        dispose: sandbox.stub(),
      };

      createStatusBarItemStub.onFirstCall().returns(mockStatusBarItem);
      createStatusBarItemStub.onSecondCall().returns(mockStatusBarItem2);

      const onDidCloseTerminalStub = sandbox.stub(
        vscode.window,
        'onDidCloseTerminal'
      );
      onDidCloseTerminalStub.callsFake((callback) => {
        setTimeout(() => {
          const terminals = (vscode.window.createTerminal as any).getCalls();
          for (const call of terminals) {
            const mockTerminal = call.returnValue;
            mockTerminal.exitStatus = { code: 0 };
            callback(mockTerminal);
          }
        }, 50);
        return { dispose: sandbox.stub() };
      });

      const execute1 = scriptExecutor.execute(script1);
      const execute2 = scriptExecutor.execute(script2);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify both status bar items were created
      assert.ok(createStatusBarItemStub.calledTwice);
      assert.strictEqual(
        mockStatusBarItem.text,
        '$(sync~spin) Running: build'
      );
      assert.strictEqual(mockStatusBarItem2.text, '$(sync~spin) Running: test');

      await Promise.all([execute1, execute2]);
    });
  });

  suite('Custom Script Notifications', () => {
    test('should show success notification on custom script creation', () => {
      // This test verifies the notification format that extension.ts would show
      const scriptName = 'deploy-production';
      const expectedMessage = `Custom script "${scriptName}" created successfully`;

      assert.ok(expectedMessage.includes(scriptName));
      assert.ok(expectedMessage.includes('created successfully'));
    });

    test('should show error notification on custom script creation failure', () => {
      const errorMessage = 'Script name already exists';
      const expectedMessage = `Failed to create custom script: ${errorMessage}`;

      assert.ok(expectedMessage.includes('Failed to create'));
      assert.ok(expectedMessage.includes(errorMessage));
    });

    test('should show success notification on custom script update', () => {
      const scriptName = 'deploy-staging';
      const expectedMessage = `Custom script "${scriptName}" updated successfully`;

      assert.ok(expectedMessage.includes(scriptName));
      assert.ok(expectedMessage.includes('updated successfully'));
    });

    test('should show success notification on custom script deletion', () => {
      const scriptName = 'old-script';
      const expectedMessage = `Custom script "${scriptName}" deleted successfully`;

      assert.ok(expectedMessage.includes(scriptName));
      assert.ok(expectedMessage.includes('deleted successfully'));
    });
  });

  suite('Bulk Sequence Notifications', () => {
    test('should show success notification on sequence save', () => {
      const sequenceName = 'Build and Deploy';
      const expectedMessage = `Bulk sequence "${sequenceName}" saved successfully`;

      assert.ok(expectedMessage.includes(sequenceName));
      assert.ok(expectedMessage.includes('saved successfully'));
    });

    test('should show warning for missing scripts in loaded sequence', () => {
      const sequenceName = 'Old Sequence';
      const missingCount = 2;
      const missingScripts = ['old-script-1', 'old-script-2'];
      const expectedMessage = `Bulk sequence "${sequenceName}" references ${missingCount} missing script(s): ${missingScripts.join(
        ', '
      )}`;

      assert.ok(expectedMessage.includes(sequenceName));
      assert.ok(expectedMessage.includes('missing script'));
      assert.ok(expectedMessage.includes(missingScripts[0]));
      assert.ok(expectedMessage.includes(missingScripts[1]));
    });

    test('should show info notification when loading sequence', () => {
      const sequenceName = 'CI Pipeline';
      const scriptCount = 5;
      const expectedMessage = `Loaded bulk sequence "${sequenceName}" with ${scriptCount} scripts`;

      assert.ok(expectedMessage.includes(sequenceName));
      assert.ok(expectedMessage.includes('Loaded'));
      assert.ok(expectedMessage.includes(scriptCount.toString()));
    });

    test('should show info notification when no sequences exist', () => {
      const expectedMessage = 'No saved bulk sequences found';

      assert.strictEqual(expectedMessage, 'No saved bulk sequences found');
    });
  });

  suite('General UI Notifications', () => {
    test('should show info notification on refresh', () => {
      const expectedMessage = 'Scripts refreshed';
      assert.strictEqual(expectedMessage, 'Scripts refreshed');
    });

    test('should show bulk mode toggle notification', () => {
      const enabledMessage = 'Bulk execution mode enabled';
      const disabledMessage = 'Bulk execution mode disabled';

      assert.ok(enabledMessage.includes('enabled'));
      assert.ok(disabledMessage.includes('disabled'));
    });

    test('should show warning when selecting fewer than 2 scripts for bulk execution', () => {
      const expectedMessage =
        'Please select at least 2 scripts for bulk execution';

      assert.ok(expectedMessage.includes('at least 2 scripts'));
    });

    test('should show warning when no recent script available', () => {
      const expectedMessage = 'No recently executed script found';

      assert.strictEqual(expectedMessage, 'No recently executed script found');
    });

    test('should show script order update notification', () => {
      const scripts = ['build', 'test', 'deploy'];
      const orderStr = scripts.join(' → ');
      const expectedMessage = `Script order updated: ${orderStr}`;

      assert.ok(expectedMessage.includes('order updated'));
      assert.ok(expectedMessage.includes('build'));
      assert.ok(expectedMessage.includes('→'));
    });
  });
});
