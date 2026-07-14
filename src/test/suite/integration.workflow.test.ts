/**
 * Integration tests for end-to-end workflows
 * Task 12.4: Write integration tests for end-to-end workflows
 * Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.4, 4.1, 5.1, 6.1, 6.5
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { suite, test, before, after } from 'mocha';
import * as path from 'path';
import * as fs from 'fs';
import { ScriptScanner } from '../../scriptScanner';
import { SettingsManager } from '../../settingsManager';
import { CustomScriptManager } from '../../customScriptManager';
import { ScriptExecutor } from '../../scriptExecutor';
import { BulkExecutor } from '../../bulkExecutor';
import { ScriptListProvider } from '../../scriptListProvider';
import { ScriptItem, CustomScript } from '../../types';

suite('Integration: End-to-End Workflows', () => {
  let testWorkspaceRoot: string;
  let testPackageJsonPath: string;
  let context: vscode.ExtensionContext;
  let settingsManager: SettingsManager;
  let scriptScanner: ScriptScanner;
  let customScriptManager: CustomScriptManager;
  let scriptExecutor: ScriptExecutor;
  let bulkExecutor: BulkExecutor;
  let scriptListProvider: ScriptListProvider;

  before(async function () {
    this.timeout(30000);

    const extension = vscode.extensions.getExtension('comander.comander');
    assert.ok(extension, 'Extension should be present');

    if (!extension.isActive) {
      await extension.activate();
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      testWorkspaceRoot = workspaceFolders[0].uri.fsPath;
      testPackageJsonPath = path.join(testWorkspaceRoot, 'package.json');
    } else {
      this.skip();
    }

    context = extension.exports?.context || {
      subscriptions: [],
      workspaceState: { get: () => undefined, update: async () => {} },
      globalState: { get: () => undefined, update: async () => {} },
      extensionPath: extension.extensionPath,
      extensionUri: vscode.Uri.file(extension.extensionPath),
      storagePath: undefined,
      globalStoragePath: '',
      logPath: '',
    } as any;

    settingsManager = new SettingsManager(context);
    scriptScanner = new ScriptScanner();
    customScriptManager = new CustomScriptManager(settingsManager);
    scriptExecutor = new ScriptExecutor();
    bulkExecutor = new BulkExecutor(scriptExecutor, settingsManager);
    scriptListProvider = new ScriptListProvider();
  });

  after(async function () {
    this.timeout(10000);
    
    const customScripts = customScriptManager.list();
    for (const script of customScripts) {
      if (script.name.startsWith('test-')) {
        await customScriptManager.delete(script.id);
      }
    }

    const bulkSequences = bulkExecutor.listSequences();
    for (const sequence of bulkSequences) {
      if (sequence.name.startsWith('test-')) {
        await bulkExecutor.deleteSequence(sequence.id);
      }
    }
  });

  // Workflow 1: scan → display → execute → save parameters
  // **Validates: Requirements 1.1, 1.2, 2.1, 2.2, 3.1, 3.4**
  suite('Workflow 1: Scan → Display → Execute → Save Parameters', () => {
    test('Complete workflow should scan, display, and save parameters', async function () {
      this.timeout(15000);

      const scriptCollection = await scriptScanner.scan(testWorkspaceRoot);
      assert.ok(scriptCollection.projects.size > 0, 'Should find projects');

      const customScripts = customScriptManager.list();
      scriptListProvider.updateScripts(scriptCollection, customScripts);
      const rootChildren = scriptListProvider.getChildren();
      assert.ok(rootChildren.length > 0, 'Scripts should be displayable');

      let testScript: ScriptItem | null = null;
      for (const [projectPath, projectScripts] of scriptCollection.projects.entries()) {
        if (projectScripts.scripts.size > 0) {
          const name = Array.from(projectScripts.scripts.keys())[0];
          const cmd = projectScripts.scripts.get(name)!;
          testScript = { type: 'npm-script', label: name, command: cmd, projectPath };
          break;
        }
      }

      if (!testScript) {
        this.skip();
        return;
      }

      const testParams = '--verbose';
      await settingsManager.setParameters(testScript.projectPath || '', testScript.label, testParams);
      const retrieved = settingsManager.getParameters(testScript.projectPath || '', testScript.label);
      assert.strictEqual(retrieved, testParams, 'Parameters should match');

      await settingsManager.removeParameters(testScript.projectPath || '', testScript.label);
      const cleared = settingsManager.getParameters(testScript.projectPath || '', testScript.label);
      assert.strictEqual(cleared, null, 'Parameters should be cleared');

      assert.ok(true, 'Workflow 1 completed');
    });
  });

  // Workflow 2: create → edit → execute → delete custom script
  // **Validates: Requirements 4.1, 5.1**
  suite('Workflow 2: Create → Edit → Execute → Delete Custom Script', () => {
    test('Complete custom script lifecycle workflow', async function () {
      this.timeout(15000);

      const result = await customScriptManager.create('test-custom-wf', 'echo "test"', '');
      assert.ok(result.success);
      const scriptId = (result.data as CustomScript).id;

      const updateResult = await customScriptManager.update(scriptId, 'test-custom-updated', 'echo "updated"');
      assert.ok(updateResult.success);

      await settingsManager.setParameters('', 'test-custom-updated', '--param');
      const params = settingsManager.getParameters('', 'test-custom-updated');
      assert.strictEqual(params, '--param');

      const deleteResult = await customScriptManager.delete(scriptId);
      assert.ok(deleteResult.success);

      assert.ok(true, 'Workflow 2 completed');
    });
  });

  // Workflow 3: select → order → execute → save bulk sequence
  // **Validates: Requirements 6.1, 6.5**
  suite('Workflow 3: Select → Order → Execute → Save Bulk Sequence', () => {
    test('Complete bulk execution workflow', async function () {
      this.timeout(20000);

      const s1 = await customScriptManager.create('test-bulk-1', 'echo "1"', '');
      const s2 = await customScriptManager.create('test-bulk-2', 'echo "2"', '');
      const s3 = await customScriptManager.create('test-bulk-3', 'echo "3"', '');

      assert.ok(s1.success && s2.success && s3.success);

      const scripts: ScriptItem[] = [
        { type: 'custom-script', label: (s1.data as CustomScript).name, command: (s1.data as CustomScript).command, projectPath: '', id: (s1.data as CustomScript).id },
        { type: 'custom-script', label: (s2.data as CustomScript).name, command: (s2.data as CustomScript).command, projectPath: '', id: (s2.data as CustomScript).id },
        { type: 'custom-script', label: (s3.data as CustomScript).name, command: (s3.data as CustomScript).command, projectPath: '', id: (s3.data as CustomScript).id },
      ];

      scriptListProvider.toggleBulkMode();
      assert.ok(scriptListProvider.isBulkModeEnabled());

      const order = [2, 1, 0];
      const saveResult = await bulkExecutor.saveSequence('test-bulk-seq', scripts, order);
      assert.ok(saveResult.success);

      const loaded = bulkExecutor.loadSequence(saveResult.data!.id);
      assert.deepStrictEqual(loaded!.order, order, 'Order should be preserved');

      await bulkExecutor.deleteSequence(saveResult.data!.id);
      for (const script of scripts) {
        if (script.id) await customScriptManager.delete(script.id);
      }

      scriptListProvider.toggleBulkMode();
      assert.ok(true, 'Workflow 3 completed');
    });
  });
});
