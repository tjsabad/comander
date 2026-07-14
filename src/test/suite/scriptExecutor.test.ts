/**
 * Unit tests for ScriptExecutor
 * Task 5.1 implementation tests
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 3.2, 3.3
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ScriptExecutor } from '../../scriptExecutor';
import { ScriptItem } from '../../types';
import { generateScriptId } from '../../utils';

describe('ScriptExecutor', () => {
  let executor: ScriptExecutor;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    executor = new ScriptExecutor();
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Command Construction', () => {
    it('should construct npm command without parameters', () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'build',
        command: 'tsc',
        projectPath: '',
      };

      // Access private method through reflection for testing
      const command = (executor as any).constructCommand(script);
      expect(command).to.equal('npm run build');
    });

    it('should construct npm command with parameters using double-dash separator', () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'test',
        command: 'mocha',
        projectPath: '',
      };

      const command = (executor as any).constructCommand(script, '--grep "specific test"');
      expect(command).to.equal('npm run test -- --grep "specific test"');
    });

    it('should not add double-dash for empty parameters', () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'lint',
        command: 'eslint',
        projectPath: '',
      };

      const command = (executor as any).constructCommand(script, '');
      expect(command).to.equal('npm run lint');
    });

    it('should not add double-dash for whitespace-only parameters', () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'lint',
        command: 'eslint',
        projectPath: '',
      };

      const command = (executor as any).constructCommand(script, '   ');
      expect(command).to.equal('npm run lint');
    });

    it('should use command directly for custom scripts without parameters', () => {
      const script: ScriptItem = {
        type: 'custom-script',
        label: 'deploy',
        command: 'ssh user@server deploy.sh',
        projectPath: '',
      };

      const command = (executor as any).constructCommand(script);
      expect(command).to.equal('ssh user@server deploy.sh');
    });

    it('should append parameters to custom script command', () => {
      const script: ScriptItem = {
        type: 'custom-script',
        label: 'deploy',
        command: 'ssh user@server deploy.sh',
        projectPath: '',
      };

      const command = (executor as any).constructCommand(script, '--env production');
      expect(command).to.equal('ssh user@server deploy.sh --env production');
    });
  });

  describe('Execution State Tracking', () => {
    it('should return false for non-executing script', () => {
      const scriptId = ':npm:build';
      expect(executor.isExecuting(scriptId)).to.be.false;
    });

    it('should track executing scripts', () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'build',
        command: 'tsc',
        projectPath: '',
      };

      const scriptId = generateScriptId(script);

      // Initially not executing
      expect(executor.isExecuting(scriptId)).to.be.false;

      // After adding to active executions, should be executing
      const mockTerminal = {} as any;
      (executor as any).activeExecutions.set(scriptId, {
        terminal: mockTerminal,
        script,
        startTime: Date.now(),
      });

      expect(executor.isExecuting(scriptId)).to.be.true;
    });
  });

  describe('Most Recent Script', () => {
    it('should return null when no script has been executed', () => {
      expect(executor.getMostRecentScript()).to.be.null;
    });

    it('should store most recent script after execution tracking', () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'test',
        command: 'mocha',
        projectPath: '',
      };

      // Simulate storing the most recent script
      (executor as any).mostRecentScript = script;

      const recent = executor.getMostRecentScript();
      expect(recent).to.equal(script);
      expect(recent?.label).to.equal('test');
    });

    it('should update most recent script on subsequent executions', () => {
      const script1: ScriptItem = {
        type: 'npm-script',
        label: 'build',
        command: 'tsc',
        projectPath: '',
      };

      const script2: ScriptItem = {
        type: 'npm-script',
        label: 'test',
        command: 'mocha',
        projectPath: '',
      };

      (executor as any).mostRecentScript = script1;
      expect(executor.getMostRecentScript()?.label).to.equal('build');

      (executor as any).mostRecentScript = script2;
      expect(executor.getMostRecentScript()?.label).to.equal('test');
    });
  });

  describe('Terminate', () => {
    it('should remove script from active executions on terminate', () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'build',
        command: 'tsc',
        projectPath: '',
      };

      const scriptId = generateScriptId(script);
      const mockTerminal = { dispose: sinon.stub() } as any;

      (executor as any).activeExecutions.set(scriptId, {
        terminal: mockTerminal,
        script,
        startTime: Date.now(),
      });

      expect(executor.isExecuting(scriptId)).to.be.true;

      executor.terminate(scriptId);

      expect(executor.isExecuting(scriptId)).to.be.false;
      expect(mockTerminal.dispose.calledOnce).to.be.true;
    });

    it('should dispose status bar item on terminate - Requirement 7.8', () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'build',
        command: 'tsc',
        projectPath: '',
      };

      const scriptId = generateScriptId(script);
      const mockTerminal = { dispose: sinon.stub() } as any;
      const mockStatusBarItem = { dispose: sinon.stub() } as any;

      (executor as any).activeExecutions.set(scriptId, {
        terminal: mockTerminal,
        script,
        startTime: Date.now(),
        statusBarItem: mockStatusBarItem,
      });

      executor.terminate(scriptId);

      expect(mockStatusBarItem.dispose.calledOnce).to.be.true;
      expect(mockTerminal.dispose.calledOnce).to.be.true;
    });

    it('should handle terminating script without status bar item', () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'build',
        command: 'tsc',
        projectPath: '',
      };

      const scriptId = generateScriptId(script);
      const mockTerminal = { dispose: sinon.stub() } as any;

      (executor as any).activeExecutions.set(scriptId, {
        terminal: mockTerminal,
        script,
        startTime: Date.now(),
        statusBarItem: undefined,
      });

      // Should not throw
      expect(() => {
        executor.terminate(scriptId);
      }).to.not.throw();

      expect(mockTerminal.dispose.calledOnce).to.be.true;
    });

    it('should handle terminating non-existent script gracefully', () => {
      const scriptId = ':npm:nonexistent';

      // Should not throw
      expect(() => {
        executor.terminate(scriptId);
      }).to.not.throw();
    });
  });

  describe('Terminal Creation and Command Execution', () => {
    let createTerminalStub: sinon.SinonStub;
    let createStatusBarItemStub: sinon.SinonStub;
    let mockTerminal: any;
    let mockStatusBarItem: any;
    let onDidCloseTerminalStub: sinon.SinonStub;

    beforeEach(() => {
      mockTerminal = {
        show: sandbox.stub(),
        sendText: sandbox.stub(),
        dispose: sandbox.stub(),
        exitStatus: undefined,
      };

      mockStatusBarItem = {
        show: sandbox.stub(),
        dispose: sandbox.stub(),
        text: '',
        tooltip: '',
      };

      createTerminalStub = sandbox.stub(vscode.window, 'createTerminal').returns(mockTerminal);
      createStatusBarItemStub = sandbox.stub(vscode.window, 'createStatusBarItem').returns(mockStatusBarItem);
      onDidCloseTerminalStub = sandbox.stub(vscode.window, 'onDidCloseTerminal');
    });

    it('should create a terminal with correct name and cwd for npm script - Requirement 2.1, 2.2, 2.8', async () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'build',
        command: 'tsc',
        projectPath: 'project-a',
      };

      // Mock workspace folders
      const mockWorkspaceFolder = {
        uri: { fsPath: '/workspace' },
        name: 'workspace',
        index: 0,
      };
      sandbox.stub(vscode.workspace, 'workspaceFolders').value([mockWorkspaceFolder]);

      // Mock npm check and script terminals
      let scriptTerminalCreated = false;
      createTerminalStub.callsFake((config: any) => {
        if (config.name === 'npm-check') {
          const npmCheckTerminal = {
            ...mockTerminal,
            sendText: sandbox.stub().callsFake(() => {
              setTimeout(() => {
                (npmCheckTerminal as any).exitStatus = { code: 0 };
                const callback = onDidCloseTerminalStub.firstCall.args[0];
                callback(npmCheckTerminal);
              }, 5);
            }),
          };
          return npmCheckTerminal;
        } else {
          scriptTerminalCreated = true;
          return mockTerminal;
        }
      });

      // Mock terminal close event (simulate immediate completion)
      onDidCloseTerminalStub.callsFake((callback) => {
        return { dispose: () => {} };
      });

      const executePromise = executor.execute(script);

      // Wait a bit for async operations
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify script terminal was created
      expect(scriptTerminalCreated).to.be.true;

      // Verify terminal creation with correct configuration
      const scriptTerminalCall = createTerminalStub.getCalls().find(call => call.args[0].name === 'Comander: build');
      expect(scriptTerminalCall).to.not.be.undefined;
      const terminalConfig = scriptTerminalCall!.args[0];
      expect(terminalConfig.name).to.equal('Comander: build');
      expect(terminalConfig.cwd).to.equal('/workspace/project-a');

      // Verify terminal.show() was called - Requirement 2.3
      expect(mockTerminal.show.calledOnce).to.be.true;

      // Verify command was sent to terminal - Requirement 2.2
      expect(mockTerminal.sendText.calledOnce).to.be.true;
      expect(mockTerminal.sendText.firstCall.args[0]).to.equal('npm run build');
    });

    it('should create and show status bar item during execution - Requirement 7.8', async () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'build',
        command: 'tsc',
        projectPath: '',
      };

      const mockWorkspaceFolder = {
        uri: { fsPath: '/workspace' },
        name: 'workspace',
        index: 0,
      };
      sandbox.stub(vscode.workspace, 'workspaceFolders').value([mockWorkspaceFolder]);

      onDidCloseTerminalStub.callsFake((callback) => {
        setTimeout(() => {
          mockTerminal.exitStatus = { code: 0 };
          callback(mockTerminal);
        }, 10);
        return { dispose: () => {} };
      });

      await executor.execute(script);
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify status bar item was created
      expect(createStatusBarItemStub.calledOnce).to.be.true;
      const statusBarItemConfig = createStatusBarItemStub.firstCall.args;
      expect(statusBarItemConfig[0]).to.equal(vscode.StatusBarAlignment.Left);
      expect(statusBarItemConfig[1]).to.equal(100);

      // Verify status bar item text and tooltip
      expect(mockStatusBarItem.text).to.equal('$(sync~spin) Running: build');
      expect(mockStatusBarItem.tooltip).to.equal('Executing script: build');

      // Verify status bar item was shown
      expect(mockStatusBarItem.show.calledOnce).to.be.true;

      // Verify status bar item was disposed after completion
      expect(mockStatusBarItem.dispose.calledOnce).to.be.true;
    });

    it('should dispose status bar item on terminal close - Requirement 7.8', async () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'test',
        command: 'mocha',
        projectPath: '',
      };

      const mockWorkspaceFolder = {
        uri: { fsPath: '/workspace' },
        name: 'workspace',
        index: 0,
      };
      sandbox.stub(vscode.workspace, 'workspaceFolders').value([mockWorkspaceFolder]);

      onDidCloseTerminalStub.callsFake((callback) => {
        setTimeout(() => {
          mockTerminal.exitStatus = { code: 0 };
          callback(mockTerminal);
        }, 10);
        return { dispose: () => {} };
      });

      await executor.execute(script);
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify status bar item was disposed
      expect(mockStatusBarItem.dispose.calledOnce).to.be.true;
    });

    it('should use workspace root when projectPath is empty - Requirement 2.1', async () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'test',
        command: 'mocha',
        projectPath: '',
      };

      const mockWorkspaceFolder = {
        uri: { fsPath: '/workspace' },
        name: 'workspace',
        index: 0,
      };
      sandbox.stub(vscode.workspace, 'workspaceFolders').value([mockWorkspaceFolder]);

      // Mock npm check and script terminals
      let npmCheckCalled = false;
      createTerminalStub.callsFake((config: any) => {
        if (config.name === 'npm-check' && !npmCheckCalled) {
          npmCheckCalled = true;
          const npmCheckTerminal = {
            ...mockTerminal,
            sendText: sandbox.stub().callsFake(() => {
              setTimeout(() => {
                (npmCheckTerminal as any).exitStatus = { code: 0 };
                const callback = onDidCloseTerminalStub.getCalls()[0].args[0];
                callback(npmCheckTerminal);
              }, 5);
            }),
          };
          return npmCheckTerminal;
        }
        return mockTerminal;
      });

      onDidCloseTerminalStub.callsFake((callback) => {
        return { dispose: () => {} };
      });

      const executePromise = executor.execute(script);
      await new Promise(resolve => setTimeout(resolve, 50));

      const scriptTerminalCall = createTerminalStub.getCalls().find(call => call.args[0].name === 'Comander: test');
      expect(scriptTerminalCall).to.not.be.undefined;
      const terminalConfig = scriptTerminalCall!.args[0];
      expect(terminalConfig.cwd).to.equal('/workspace');
    });

    it('should create separate terminals for concurrent executions - Requirement 2.8', async () => {
      const script1: ScriptItem = {
        type: 'npm-script',
        label: 'build',
        command: 'tsc',
        projectPath: '',
      };

      const script2: ScriptItem = {
        type: 'npm-script',
        label: 'test',
        command: 'mocha',
        projectPath: '',
      };

      const mockWorkspaceFolder = {
        uri: { fsPath: '/workspace' },
        name: 'workspace',
        index: 0,
      };
      sandbox.stub(vscode.workspace, 'workspaceFolders').value([mockWorkspaceFolder]);

      // Create second mock terminal
      const mockTerminal2 = {
        show: sandbox.stub(),
        sendText: sandbox.stub(),
        dispose: sandbox.stub(),
        exitStatus: undefined,
      };

      const mockStatusBarItem2 = {
        show: sandbox.stub(),
        dispose: sandbox.stub(),
        text: '',
        tooltip: '',
      };

      let callCount = 0;
      createTerminalStub.callsFake((config: any) => {
        if (config.name === 'npm-check') {
          const npmCheckTerminal = {
            ...mockTerminal,
            sendText: sandbox.stub().callsFake(() => {
              setTimeout(() => {
                (npmCheckTerminal as any).exitStatus = { code: 0 };
                const callback = onDidCloseTerminalStub.firstCall.args[0];
                callback(npmCheckTerminal);
              }, 5);
            }),
          };
          return npmCheckTerminal;
        } else if (config.name === 'Comander: build') {
          return mockTerminal;
        } else {
          return mockTerminal2;
        }
      });

      createStatusBarItemStub.onFirstCall().returns(mockStatusBarItem);
      createStatusBarItemStub.onSecondCall().returns(mockStatusBarItem2);

      onDidCloseTerminalStub.callsFake((callback) => {
        // Don't auto-close terminals for this test
        return { dispose: () => {} };
      });

      // Start first execution
      const executePromise1 = executor.execute(script1);
      await new Promise(resolve => setTimeout(resolve, 20));

      // Start second execution (concurrent)
      const executePromise2 = executor.execute(script2);
      await new Promise(resolve => setTimeout(resolve, 20));

      // Verify terminals were created for both scripts
      const buildTerminalCall = createTerminalStub.getCalls().find(call => call.args[0].name === 'Comander: build');
      const testTerminalCall = createTerminalStub.getCalls().find(call => call.args[0].name === 'Comander: test');
      
      expect(buildTerminalCall).to.not.be.undefined;
      expect(testTerminalCall).to.not.be.undefined;

      // Verify both scripts are tracked as executing
      expect(executor.isExecuting(generateScriptId(script1))).to.be.true;
      expect(executor.isExecuting(generateScriptId(script2))).to.be.true;
    });

    it('should send command to terminal with parameters - Requirement 2.2, 3.2, 3.3', async () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'test',
        command: 'mocha',
        projectPath: '',
      };

      const mockWorkspaceFolder = {
        uri: { fsPath: '/workspace' },
        name: 'workspace',
        index: 0,
      };
      sandbox.stub(vscode.workspace, 'workspaceFolders').value([mockWorkspaceFolder]);

      // Mock npm check and script terminals
      let npmCheckCalled = false;
      createTerminalStub.callsFake((config: any) => {
        if (config.name === 'npm-check' && !npmCheckCalled) {
          npmCheckCalled = true;
          const npmCheckTerminal = {
            ...mockTerminal,
            sendText: sandbox.stub().callsFake(() => {
              setTimeout(() => {
                (npmCheckTerminal as any).exitStatus = { code: 0 };
                const callback = onDidCloseTerminalStub.getCalls()[0].args[0];
                callback(npmCheckTerminal);
              }, 5);
            }),
          };
          return npmCheckTerminal;
        }
        return mockTerminal;
      });

      onDidCloseTerminalStub.callsFake((callback) => {
        return { dispose: () => {} };
      });

      const executePromise = executor.execute(script, '--grep "integration"');
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockTerminal.sendText.calledOnce).to.be.true;
      expect(mockTerminal.sendText.firstCall.args[0]).to.equal('npm run test -- --grep "integration"');
    });

    it('should throw error when script is already executing - Requirement 2.5', async () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'build',
        command: 'tsc',
        projectPath: '',
      };

      const scriptId = generateScriptId(script);

      // Simulate script already executing
      (executor as any).activeExecutions.set(scriptId, {
        terminal: mockTerminal,
        script,
        startTime: Date.now(),
      });

      try {
        await executor.execute(script);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('already executing');
      }
    });
  });

  describe('npm Availability Check', () => {
    let createTerminalStub: sinon.SinonStub;
    let mockTerminal: any;
    let onDidCloseTerminalStub: sinon.SinonStub;

    beforeEach(() => {
      mockTerminal = {
        show: sandbox.stub(),
        sendText: sandbox.stub(),
        dispose: sandbox.stub(),
        exitStatus: undefined,
      };

      createTerminalStub = sandbox.stub(vscode.window, 'createTerminal').returns(mockTerminal);
      onDidCloseTerminalStub = sandbox.stub(vscode.window, 'onDidCloseTerminal');
    });

    it('should check npm availability before first execution - Requirement 2.7', async () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'build',
        command: 'tsc',
        projectPath: '',
      };

      const mockWorkspaceFolder = {
        uri: { fsPath: '/workspace' },
        name: 'workspace',
        index: 0,
      };
      sandbox.stub(vscode.workspace, 'workspaceFolders').value([mockWorkspaceFolder]);

      let npmCheckTerminalCreated = false;
      let scriptTerminalCreated = false;

      createTerminalStub.callsFake((config: any) => {
        if (config.name === 'npm-check') {
          npmCheckTerminalCreated = true;
          const checkTerminal = {
            ...mockTerminal,
            sendText: sandbox.stub().callsFake(() => {
              // Simulate npm check success
              setTimeout(() => {
                (checkTerminal as any).exitStatus = { code: 0 };
                // Trigger the onDidCloseTerminal callback
                const callback = onDidCloseTerminalStub.firstCall.args[0];
                callback(checkTerminal);
              }, 5);
            }),
          };
          return checkTerminal;
        } else {
          scriptTerminalCreated = true;
          return mockTerminal;
        }
      });

      onDidCloseTerminalStub.callsFake((callback) => {
        return { dispose: () => {} };
      });

      const executePromise = executor.execute(script);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify npm check terminal was created first
      expect(npmCheckTerminalCreated).to.be.true;
      expect(scriptTerminalCreated).to.be.true;

      // Verify npm check was performed
      expect(createTerminalStub.calledTwice).to.be.true;
    });

    it('should throw error when npm is not available - Requirement 2.7', async () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'build',
        command: 'tsc',
        projectPath: '',
      };

      const mockWorkspaceFolder = {
        uri: { fsPath: '/workspace' },
        name: 'workspace',
        index: 0,
      };
      sandbox.stub(vscode.workspace, 'workspaceFolders').value([mockWorkspaceFolder]);

      createTerminalStub.callsFake((config: any) => {
        if (config.name === 'npm-check') {
          const checkTerminal = {
            ...mockTerminal,
            sendText: sandbox.stub().callsFake(() => {
              // Simulate npm check failure
              setTimeout(() => {
                (checkTerminal as any).exitStatus = { code: 1 };
                const callback = onDidCloseTerminalStub.firstCall.args[0];
                callback(checkTerminal);
              }, 5);
            }),
          };
          return checkTerminal;
        }
        return mockTerminal;
      });

      onDidCloseTerminalStub.callsFake((callback) => {
        return { dispose: () => {} };
      });

      try {
        await executor.execute(script);
        await new Promise(resolve => setTimeout(resolve, 100));
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('npm is not available');
      }
    });

    it('should only check npm availability once - Requirement 2.7', async () => {
      const script1: ScriptItem = {
        type: 'npm-script',
        label: 'build',
        command: 'tsc',
        projectPath: '',
      };

      const script2: ScriptItem = {
        type: 'npm-script',
        label: 'test',
        command: 'mocha',
        projectPath: '',
      };

      const mockWorkspaceFolder = {
        uri: { fsPath: '/workspace' },
        name: 'workspace',
        index: 0,
      };
      sandbox.stub(vscode.workspace, 'workspaceFolders').value([mockWorkspaceFolder]);

      let npmCheckCount = 0;

      createTerminalStub.callsFake((config: any) => {
        if (config.name === 'npm-check') {
          npmCheckCount++;
          const checkTerminal = {
            ...mockTerminal,
            sendText: sandbox.stub().callsFake(() => {
              setTimeout(() => {
                (checkTerminal as any).exitStatus = { code: 0 };
                const callback = onDidCloseTerminalStub.firstCall.args[0];
                callback(checkTerminal);
              }, 5);
            }),
          };
          return checkTerminal;
        }
        return mockTerminal;
      });

      onDidCloseTerminalStub.callsFake((callback) => {
        return { dispose: () => {} };
      });

      // Execute first script
      const executePromise1 = executor.execute(script1);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Execute second script
      const executePromise2 = executor.execute(script2);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify npm was only checked once
      expect(npmCheckCount).to.equal(1);
    });
  });

  describe('Error Handling for Terminal Creation', () => {
    let createTerminalStub: sinon.SinonStub;

    beforeEach(() => {
      createTerminalStub = sandbox.stub(vscode.window, 'createTerminal');
    });

    it('should handle terminal creation failure gracefully - Requirement 2.7', async () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'build',
        command: 'tsc',
        projectPath: '',
      };

      const mockWorkspaceFolder = {
        uri: { fsPath: '/workspace' },
        name: 'workspace',
        index: 0,
      };
      sandbox.stub(vscode.workspace, 'workspaceFolders').value([mockWorkspaceFolder]);

      // Mock npm check to succeed
      const npmCheckTerminal = {
        show: sandbox.stub(),
        sendText: sandbox.stub().callsFake(() => {
          setTimeout(() => {
            (npmCheckTerminal as any).exitStatus = { code: 0 };
          }, 5);
        }),
        dispose: sandbox.stub(),
        exitStatus: undefined,
      };

      createTerminalStub.onFirstCall().returns(npmCheckTerminal);
      createTerminalStub.onSecondCall().throws(new Error('Terminal creation failed: too many terminals'));

      sandbox.stub(vscode.window, 'onDidCloseTerminal').callsFake((callback) => {
        setTimeout(() => {
          (npmCheckTerminal as any).exitStatus = { code: 0 };
          callback(npmCheckTerminal as any);
        }, 10);
        return { dispose: () => {} };
      });

      try {
        await executor.execute(script);
        await new Promise(resolve => setTimeout(resolve, 100));
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('Terminal creation failed');
      }
    });

    it('should handle missing workspace folders', async () => {
      const script: ScriptItem = {
        type: 'npm-script',
        label: 'build',
        command: 'tsc',
        projectPath: '',
      };

      // Mock no workspace folders
      sandbox.stub(vscode.workspace, 'workspaceFolders').value(undefined);

      const mockTerminal = {
        show: sandbox.stub(),
        sendText: sandbox.stub(),
        dispose: sandbox.stub(),
        exitStatus: undefined,
      };

      createTerminalStub.returns(mockTerminal);

      sandbox.stub(vscode.window, 'onDidCloseTerminal').callsFake((callback) => {
        return { dispose: () => {} };
      });

      // Should handle missing workspace folders gracefully
      // The implementation will pass undefined as cwd
      const executePromise = executor.execute(script);
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(createTerminalStub.called).to.be.true;
    });
  });
});
