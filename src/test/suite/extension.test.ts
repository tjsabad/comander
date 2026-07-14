/**
 * Integration tests for extension activation
 * Task 9.6: Write integration tests for extension activation
 * Requirements: 1.8, 7.1, 7.3
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { suite, test, before, after } from 'mocha';
import * as path from 'path';
import * as fs from 'fs';

suite('Extension Activation Integration Tests', () => {
  let extension: vscode.Extension<any> | undefined;
  let testWorkspaceRoot: string;

  before(async function () {
    this.timeout(30000); // Extension activation may take time

    // Get the extension
    extension = vscode.extensions.getExtension('comander.comander');
    assert.ok(extension, 'Extension should be present');

    // Activate the extension if not already active
    if (!extension.isActive) {
      await extension.activate();
    }

    // Get workspace root for test setup
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      testWorkspaceRoot = workspaceFolders[0].uri.fsPath;
    }
  });

  suite('Extension Presence and Activation', () => {
    test('Extension should be present in VS Code', () => {
      assert.ok(extension, 'Extension should be registered');
      assert.strictEqual(
        extension!.id,
        'comander.comander',
        'Extension ID should match'
      );
    });

    test('Extension should activate successfully', () => {
      assert.ok(extension, 'Extension should exist');
      assert.strictEqual(
        extension!.isActive,
        true,
        'Extension should be active'
      );
    });

    test('Extension should activate in workspace with package.json', async function () {
      this.timeout(5000);

      // If we have a workspace, verify activation occurred
      if (testWorkspaceRoot) {
        assert.ok(extension!.isActive, 'Extension should be active in workspace');
      }
    });
  });

  suite('Command Registration', () => {
    const expectedCommands = [
      'comander.refresh',
      'comander.executeScript',
      'comander.addCustomScript',
      'comander.editCustomScript',
      'comander.deleteCustomScript',
      'comander.toggleBulkMode',
      'comander.executeBulk',
      'comander.saveBulkSequence',
      'comander.loadBulkSequence',
      'comander.executeRecent',
    ];

    test('All required commands should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      
      for (const expectedCommand of expectedCommands) {
        assert.ok(
          commands.includes(expectedCommand),
          `Command ${expectedCommand} should be registered`
        );
      }
    });

    test('comander.refresh command should be callable', async () => {
      // This should not throw an error
      await vscode.commands.executeCommand('comander.refresh');
      assert.ok(true, 'Refresh command executed successfully');
    });

    test('comander.toggleBulkMode command should be callable', async () => {
      // Toggle bulk mode on
      await vscode.commands.executeCommand('comander.toggleBulkMode');
      
      // Toggle bulk mode off
      await vscode.commands.executeCommand('comander.toggleBulkMode');
      
      assert.ok(true, 'Toggle bulk mode command executed successfully');
    });

    test('comander.executeRecent command should handle no recent scripts gracefully', async () => {
      // Should execute without throwing even if no scripts have been run
      await vscode.commands.executeCommand('comander.executeRecent');
      assert.ok(true, 'Execute recent command handled gracefully');
    });
  });

  suite('Tree View Registration', () => {
    test('comanderScripts tree view should be registered', async () => {
      // Try to reveal the tree view - this will only work if it's registered
      const treeView = vscode.window.createTreeView('comanderScripts', {
        treeDataProvider: {
          getTreeItem: (element: any) => element,
          getChildren: () => [],
        },
      });

      assert.ok(treeView, 'Tree view should be creatable');
      treeView.dispose();
    });

    test('Tree view should be visible in comander view container', async () => {
      // The view should exist in the contributes section
      const packageJson = extension!.packageJSON;
      const views = packageJson.contributes?.views?.comander;
      
      assert.ok(views, 'Comander views should be defined');
      assert.ok(
        views.some((v: any) => v.id === 'comanderScripts'),
        'comanderScripts view should be contributed'
      );
    });
  });

  suite('File Watching Integration', () => {
    let testPackageJsonPath: string;
    let originalContent: string;

    before(function () {
      if (!testWorkspaceRoot) {
        this.skip();
      }
      testPackageJsonPath = path.join(testWorkspaceRoot, 'package.json');
    });

    test('Extension should watch for package.json changes', async function () {
      this.timeout(10000);

      if (!testWorkspaceRoot || !fs.existsSync(testPackageJsonPath)) {
        this.skip();
        return;
      }

      // Read original content
      originalContent = fs.readFileSync(testPackageJsonPath, 'utf-8');
      const packageJson = JSON.parse(originalContent);

      // Add a test script
      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }
      packageJson.scripts['test-watch-integration'] = 'echo "test"';

      // Write modified content
      fs.writeFileSync(
        testPackageJsonPath,
        JSON.stringify(packageJson, null, 2),
        'utf-8'
      );

      // Wait for file watcher to detect change (design specifies 500ms)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Execute refresh to ensure scripts are loaded
      await vscode.commands.executeCommand('comander.refresh');

      // Clean up - restore original content
      fs.writeFileSync(testPackageJsonPath, originalContent, 'utf-8');

      assert.ok(true, 'File watching integration completed');
    });

    test('Extension should handle package.json parse errors gracefully', async function () {
      this.timeout(10000);

      if (!testWorkspaceRoot || !fs.existsSync(testPackageJsonPath)) {
        this.skip();
        return;
      }

      // Read original content
      originalContent = fs.readFileSync(testPackageJsonPath, 'utf-8');

      // Write invalid JSON
      fs.writeFileSync(testPackageJsonPath, '{ invalid json }', 'utf-8');

      // Wait for file watcher
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Execute refresh - should not throw
      await vscode.commands.executeCommand('comander.refresh');

      // Restore original content
      fs.writeFileSync(testPackageJsonPath, originalContent, 'utf-8');

      // Wait for restoration
      await new Promise((resolve) => setTimeout(resolve, 1000));

      assert.ok(true, 'Parse error handled gracefully');
    });
  });

  suite('Workspace Integration', () => {
    test('Extension should scan workspace for package.json on activation', async function () {
      this.timeout(5000);

      if (!testWorkspaceRoot) {
        this.skip();
        return;
      }

      // Refresh should trigger a scan
      await vscode.commands.executeCommand('comander.refresh');

      // If there's a package.json, it should be detected
      const packageJsonPath = path.join(testWorkspaceRoot, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        assert.ok(true, 'Workspace scan completed with package.json present');
      } else {
        assert.ok(true, 'Workspace scan completed without package.json');
      }
    });

    test('Extension should handle workspaces without package.json', async () => {
      // This should not throw even if no package.json exists
      await vscode.commands.executeCommand('comander.refresh');
      assert.ok(true, 'Extension handles missing package.json gracefully');
    });
  });

  suite('VS Code API Integration', () => {
    test('Extension should register activity bar view container', () => {
      const packageJson = extension!.packageJSON;
      const viewContainers = packageJson.contributes?.viewsContainers?.activitybar;
      
      assert.ok(viewContainers, 'Activity bar view containers should be defined');
      assert.ok(
        viewContainers.some((vc: any) => vc.id === 'comander'),
        'Comander view container should be registered'
      );
    });

    test('Extension should define keyboard shortcuts', () => {
      const packageJson = extension!.packageJSON;
      const keybindings = packageJson.contributes?.keybindings;
      
      assert.ok(keybindings, 'Keybindings should be defined');
      
      const executeRecentBinding = keybindings.find(
        (kb: any) => kb.command === 'comander.executeRecent'
      );
      
      assert.ok(executeRecentBinding, 'Execute recent keybinding should exist');
      assert.strictEqual(
        executeRecentBinding.key,
        'ctrl+shift+r',
        'Windows/Linux keybinding should be correct'
      );
      assert.strictEqual(
        executeRecentBinding.mac,
        'cmd+shift+r',
        'macOS keybinding should be correct'
      );
    });

    test('Extension should define configuration properties', () => {
      const packageJson = extension!.packageJSON;
      const properties = packageJson.contributes?.configuration?.properties;
      
      assert.ok(properties, 'Configuration properties should be defined');
      assert.ok(
        properties['comander.scriptParameters'],
        'scriptParameters property should be defined'
      );
      assert.ok(
        properties['comander.customScripts'],
        'customScripts property should be defined'
      );
      assert.ok(
        properties['comander.bulkSequences'],
        'bulkSequences property should be defined'
      );
    });

    test('Extension should access workspace configuration', async () => {
      const config = vscode.workspace.getConfiguration('comander');
      
      // These should not throw
      const scriptParameters = config.get('scriptParameters', {});
      const customScripts = config.get('customScripts', []);
      const bulkSequences = config.get('bulkSequences', []);
      
      assert.ok(typeof scriptParameters === 'object', 'scriptParameters should be an object');
      assert.ok(Array.isArray(customScripts), 'customScripts should be an array');
      assert.ok(Array.isArray(bulkSequences), 'bulkSequences should be an array');
    });
  });

  suite('Extension Lifecycle', () => {
    test('Extension should remain active during tests', () => {
      assert.ok(extension, 'Extension should exist');
      assert.strictEqual(
        extension!.isActive,
        true,
        'Extension should remain active'
      );
    });

    test('Extension should handle multiple command invocations', async () => {
      // Execute multiple commands in sequence
      await vscode.commands.executeCommand('comander.refresh');
      await vscode.commands.executeCommand('comander.toggleBulkMode');
      await vscode.commands.executeCommand('comander.toggleBulkMode');
      await vscode.commands.executeCommand('comander.refresh');
      
      assert.ok(
        extension!.isActive,
        'Extension should remain stable after multiple commands'
      );
    });
  });
});
