/**
 * Unit tests for ScriptScanner
 * Task 3.5 - Test package.json discovery, file watch event handling, and error scenarios
 * Requirements: 1.1, 1.3, 1.4, 1.5
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ScriptScanner } from '../../scriptScanner';
import { ScriptCollection, ProjectScripts, ParseError } from '../../types';

describe('ScriptScanner - Unit Tests', () => {
  let scanner: ScriptScanner;
  let findFilesStub: sinon.SinonStub;
  let createFileSystemWatcherStub: sinon.SinonStub;
  let mockWatcher: any;

  beforeEach(() => {
    scanner = new ScriptScanner();

    // Stub vscode.workspace.findFiles
    findFilesStub = sinon.stub(vscode.workspace, 'findFiles');

    // Create mock file system watcher
    mockWatcher = {
      onDidCreate: sinon.stub().returns({ dispose: sinon.stub() }),
      onDidChange: sinon.stub().returns({ dispose: sinon.stub() }),
      onDidDelete: sinon.stub().returns({ dispose: sinon.stub() }),
      dispose: sinon.stub(),
    };

    // Stub vscode.workspace.createFileSystemWatcher
    createFileSystemWatcherStub = sinon
      .stub(vscode.workspace, 'createFileSystemWatcher')
      .returns(mockWatcher);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Package.json Discovery', () => {
    describe('Various workspace structures', () => {
      it('should discover package.json in root workspace', async function () {
        const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comander-root-test-'));

        try {
          // Create root package.json
          const packageJsonPath = path.join(testDir, 'package.json');
          await fs.writeFile(
            packageJsonPath,
            JSON.stringify({
              name: 'root-project',
              scripts: { test: 'npm test', build: 'npm run build' },
            })
          );

          // Mock findFiles to return our file
          findFilesStub.resolves([vscode.Uri.file(packageJsonPath)]);

          // Mock workspace folders
          const mockWorkspaceFolder: vscode.WorkspaceFolder = {
            uri: vscode.Uri.file(testDir),
            name: 'test-workspace',
            index: 0,
          };

          const originalWorkspaceFolders = Object.getOwnPropertyDescriptor(
            vscode.workspace,
            'workspaceFolders'
          );

          Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            configurable: true,
            get: () => [mockWorkspaceFolder],
          });

          try {
            const result = await scanner.scan(testDir);

            expect(result.projects.size).to.equal(1);
            expect(result.errors.length).to.equal(0);

            const project = result.projects.get('');
            expect(project).to.exist;
            expect(project!.projectPath).to.equal('');
            expect(project!.scripts.size).to.equal(2);
            expect(project!.scripts.get('test')).to.equal('npm test');
            expect(project!.scripts.get('build')).to.equal('npm run build');
          } finally {
            if (originalWorkspaceFolders) {
              Object.defineProperty(vscode.workspace, 'workspaceFolders', originalWorkspaceFolders);
            }
          }
        } finally {
          await fs.rm(testDir, { recursive: true, force: true });
        }
      });

      it('should discover package.json in nested subdirectories', async function () {
        const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comander-nested-test-'));

        try {
          // Create nested structure
          await fs.mkdir(path.join(testDir, 'packages', 'app'), { recursive: true });
          await fs.mkdir(path.join(testDir, 'packages', 'lib'), { recursive: true });

          const appPackageJson = path.join(testDir, 'packages', 'app', 'package.json');
          const libPackageJson = path.join(testDir, 'packages', 'lib', 'package.json');

          await fs.writeFile(
            appPackageJson,
            JSON.stringify({ name: 'app', scripts: { start: 'npm start' } })
          );
          await fs.writeFile(
            libPackageJson,
            JSON.stringify({ name: 'lib', scripts: { build: 'npm run build' } })
          );

          findFilesStub.resolves([
            vscode.Uri.file(appPackageJson),
            vscode.Uri.file(libPackageJson),
          ]);

          const mockWorkspaceFolder: vscode.WorkspaceFolder = {
            uri: vscode.Uri.file(testDir),
            name: 'test-workspace',
            index: 0,
          };

          const originalWorkspaceFolders = Object.getOwnPropertyDescriptor(
            vscode.workspace,
            'workspaceFolders'
          );

          Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            configurable: true,
            get: () => [mockWorkspaceFolder],
          });

          try {
            const result = await scanner.scan(testDir);

            expect(result.projects.size).to.equal(2);
            expect(result.errors.length).to.equal(0);

            const appProject = result.projects.get('packages/app');
            const libProject = result.projects.get('packages/lib');

            expect(appProject).to.exist;
            expect(appProject!.projectPath).to.equal('packages/app');
            expect(appProject!.scripts.get('start')).to.equal('npm start');

            expect(libProject).to.exist;
            expect(libProject!.projectPath).to.equal('packages/lib');
            expect(libProject!.scripts.get('build')).to.equal('npm run build');
          } finally {
            if (originalWorkspaceFolders) {
              Object.defineProperty(vscode.workspace, 'workspaceFolders', originalWorkspaceFolders);
            }
          }
        } finally {
          await fs.rm(testDir, { recursive: true, force: true });
        }
      });

      it('should handle workspace with no package.json files', async function () {
        const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comander-empty-test-'));

        try {
          // Create empty workspace
          await fs.mkdir(path.join(testDir, 'src'), { recursive: true });

          findFilesStub.resolves([]);

          const result = await scanner.scan(testDir);

          expect(result.projects.size).to.equal(0);
          expect(result.errors.length).to.equal(0);
        } finally {
          await fs.rm(testDir, { recursive: true, force: true });
        }
      });

      it('should handle package.json with empty scripts section', async function () {
        const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comander-empty-scripts-test-'));

        try {
          const packageJsonPath = path.join(testDir, 'package.json');
          await fs.writeFile(
            packageJsonPath,
            JSON.stringify({ name: 'empty-scripts', scripts: {} })
          );

          findFilesStub.resolves([vscode.Uri.file(packageJsonPath)]);

          const mockWorkspaceFolder: vscode.WorkspaceFolder = {
            uri: vscode.Uri.file(testDir),
            name: 'test-workspace',
            index: 0,
          };

          const originalWorkspaceFolders = Object.getOwnPropertyDescriptor(
            vscode.workspace,
            'workspaceFolders'
          );

          Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            configurable: true,
            get: () => [mockWorkspaceFolder],
          });

          try {
            const result = await scanner.scan(testDir);

            expect(result.projects.size).to.equal(1);
            expect(result.errors.length).to.equal(0);

            const project = result.projects.get('');
            expect(project).to.exist;
            expect(project!.scripts.size).to.equal(0);
          } finally {
            if (originalWorkspaceFolders) {
              Object.defineProperty(vscode.workspace, 'workspaceFolders', originalWorkspaceFolders);
            }
          }
        } finally {
          await fs.rm(testDir, { recursive: true, force: true });
        }
      });

      it('should handle package.json without scripts section', async function () {
        const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comander-no-scripts-test-'));

        try {
          const packageJsonPath = path.join(testDir, 'package.json');
          await fs.writeFile(
            packageJsonPath,
            JSON.stringify({ name: 'no-scripts', version: '1.0.0' })
          );

          findFilesStub.resolves([vscode.Uri.file(packageJsonPath)]);

          const mockWorkspaceFolder: vscode.WorkspaceFolder = {
            uri: vscode.Uri.file(testDir),
            name: 'test-workspace',
            index: 0,
          };

          const originalWorkspaceFolders = Object.getOwnPropertyDescriptor(
            vscode.workspace,
            'workspaceFolders'
          );

          Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            configurable: true,
            get: () => [mockWorkspaceFolder],
          });

          try {
            const result = await scanner.scan(testDir);

            expect(result.projects.size).to.equal(1);
            expect(result.errors.length).to.equal(0);

            const project = result.projects.get('');
            expect(project).to.exist;
            expect(project!.scripts.size).to.equal(0);
          } finally {
            if (originalWorkspaceFolders) {
              Object.defineProperty(vscode.workspace, 'workspaceFolders', originalWorkspaceFolders);
            }
          }
        } finally {
          await fs.rm(testDir, { recursive: true, force: true });
        }
      });
    });
  });

  describe('File Watch Event Handling', () => {
    it('should create file system watcher for package.json files', () => {
      const callback = sinon.stub();

      scanner.watch(callback);

      expect(createFileSystemWatcherStub.calledOnce).to.be.true;
      expect(createFileSystemWatcherStub.firstCall.args[0]).to.equal('**/package.json');
    });

    it('should register listeners for create, change, and delete events', () => {
      const callback = sinon.stub();

      scanner.watch(callback);

      expect(mockWatcher.onDidCreate.calledOnce).to.be.true;
      expect(mockWatcher.onDidChange.calledOnce).to.be.true;
      expect(mockWatcher.onDidDelete.calledOnce).to.be.true;
    });

    it('should debounce file change events (500ms)', async function () {
      this.timeout(3000);

      const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comander-debounce-test-'));

      try {
        const packageJsonPath = path.join(testDir, 'package.json');
        await fs.writeFile(
          packageJsonPath,
          JSON.stringify({ name: 'test', scripts: { test: 'npm test' } })
        );

        findFilesStub.resolves([vscode.Uri.file(packageJsonPath)]);

        const mockWorkspaceFolder: vscode.WorkspaceFolder = {
          uri: vscode.Uri.file(testDir),
          name: 'test-workspace',
          index: 0,
        };

        const originalWorkspaceFolders = Object.getOwnPropertyDescriptor(
          vscode.workspace,
          'workspaceFolders'
        );

        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
          configurable: true,
          get: () => [mockWorkspaceFolder],
        });

        try {
          let callbackInvoked = 0;
          const callback = () => {
            callbackInvoked++;
          };

          // Start watching
          const disposable = scanner.watch(callback);

          // Get the change handler
          const changeHandler = mockWatcher.onDidChange.firstCall.args[0];

          // Trigger multiple rapid change events
          changeHandler();
          changeHandler();
          changeHandler();

          // Wait less than 500ms - callback should not be invoked yet
          await new Promise((resolve) => setTimeout(resolve, 300));
          expect(callbackInvoked).to.equal(0, 'Callback should not be invoked before debounce delay');

          // Wait for debounce delay (total 800ms)
          await new Promise((resolve) => setTimeout(resolve, 600));

          // Callback should be invoked exactly once despite multiple events
          expect(callbackInvoked).to.equal(1, 'Callback should be invoked exactly once after debounce');

          disposable.dispose();
        } finally {
          if (originalWorkspaceFolders) {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', originalWorkspaceFolders);
          }
        }
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });

    it('should dispose all watchers when disposable is called', () => {
      const callback = sinon.stub();
      const disposable = scanner.watch(callback);

      disposable.dispose();

      expect(mockWatcher.dispose.calledOnce).to.be.true;
    });

    it('should clear debounce timer on dispose', async function () {
      this.timeout(2000);

      const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comander-dispose-test-'));

      try {
        findFilesStub.resolves([]);

        const mockWorkspaceFolder: vscode.WorkspaceFolder = {
          uri: vscode.Uri.file(testDir),
          name: 'test-workspace',
          index: 0,
        };

        const originalWorkspaceFolders = Object.getOwnPropertyDescriptor(
          vscode.workspace,
          'workspaceFolders'
        );

        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
          configurable: true,
          get: () => [mockWorkspaceFolder],
        });

        try {
          let callbackInvoked = 0;
          const callback = () => {
            callbackInvoked++;
          };

          const disposable = scanner.watch(callback);

          // Get the change handler
          const changeHandler = mockWatcher.onDidChange.firstCall.args[0];

          // Trigger change event
          changeHandler();

          // Dispose immediately
          disposable.dispose();

          // Wait for would-be debounce delay
          await new Promise((resolve) => setTimeout(resolve, 600));

          // Callback should not be invoked because timer was cleared
          expect(callbackInvoked).to.equal(0, 'Callback should not be invoked after dispose');
        } finally {
          if (originalWorkspaceFolders) {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', originalWorkspaceFolders);
          }
        }
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });
  });

  describe('Error Scenarios', () => {
    it('should handle missing package.json file gracefully', async function () {
      const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comander-missing-test-'));

      try {
        const nonExistentPath = path.join(testDir, 'package.json');

        const result = await scanner.parsePackageJson(nonExistentPath);

        expect(result).to.have.property('error');
        const parseError = result as ParseError;
        expect(parseError.filePath).to.equal(nonExistentPath);
        expect(parseError.error).to.be.a('string');
        expect(parseError.error.length).to.be.greaterThan(0);
        expect(parseError.error.toLowerCase()).to.include('read');
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });

    it('should handle file permission errors', async function () {
      // Note: This test may behave differently on different platforms
      // On Windows, permission errors are harder to simulate
      if (os.platform() === 'win32') {
        this.skip();
        return;
      }

      const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comander-permission-test-'));

      try {
        const packageJsonPath = path.join(testDir, 'package.json');
        await fs.writeFile(packageJsonPath, JSON.stringify({ name: 'test' }));

        // Remove read permissions
        await fs.chmod(packageJsonPath, 0o000);

        const result = await scanner.parsePackageJson(packageJsonPath);

        // Restore permissions before cleanup
        await fs.chmod(packageJsonPath, 0o644);

        expect(result).to.have.property('error');
        const parseError = result as ParseError;
        expect(parseError.filePath).to.equal(packageJsonPath);
        expect(parseError.error).to.be.a('string');
        expect(parseError.error.toLowerCase()).to.satisfy(
          (msg: string) => msg.includes('permission') || msg.includes('eacces') || msg.includes('read'),
          'Error message should indicate permission or read failure'
        );
      } finally {
        // Ensure permissions are restored before cleanup
        try {
          const packageJsonPath = path.join(testDir, 'package.json');
          await fs.chmod(packageJsonPath, 0o644);
        } catch {
          // Ignore errors during cleanup
        }
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });

    it('should handle invalid JSON in package.json', async function () {
      const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comander-invalid-json-test-'));

      try {
        const packageJsonPath = path.join(testDir, 'package.json');
        await fs.writeFile(packageJsonPath, '{ invalid json content');

        const result = await scanner.parsePackageJson(packageJsonPath);

        expect(result).to.have.property('error');
        const parseError = result as ParseError;
        expect(parseError.filePath).to.equal(packageJsonPath);
        expect(parseError.error).to.be.a('string');
        expect(parseError.error.toLowerCase()).to.satisfy(
          (msg: string) => msg.includes('parse') || msg.includes('json'),
          'Error message should indicate JSON parse error'
        );
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });

    it('should handle workspace scan errors gracefully', async function () {
      const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comander-scan-error-test-'));

      try {
        // Make findFiles throw an error
        findFilesStub.rejects(new Error('Workspace scan failed'));

        const result = await scanner.scan(testDir);

        // Should return collection with error, not crash
        expect(result).to.have.property('projects');
        expect(result).to.have.property('errors');
        expect(result.errors.length).to.be.greaterThan(0);
        expect(result.errors[0].error).to.include('Failed to scan workspace');
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });

    it('should handle mixed valid and invalid package.json files', async function () {
      const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comander-mixed-test-'));

      try {
        // Create valid package.json
        const validPath = path.join(testDir, 'valid', 'package.json');
        await fs.mkdir(path.join(testDir, 'valid'), { recursive: true });
        await fs.writeFile(
          validPath,
          JSON.stringify({ name: 'valid', scripts: { test: 'npm test' } })
        );

        // Create invalid package.json
        const invalidPath = path.join(testDir, 'invalid', 'package.json');
        await fs.mkdir(path.join(testDir, 'invalid'), { recursive: true });
        await fs.writeFile(invalidPath, '{ broken json');

        findFilesStub.resolves([vscode.Uri.file(validPath), vscode.Uri.file(invalidPath)]);

        const mockWorkspaceFolder: vscode.WorkspaceFolder = {
          uri: vscode.Uri.file(testDir),
          name: 'test-workspace',
          index: 0,
        };

        const originalWorkspaceFolders = Object.getOwnPropertyDescriptor(
          vscode.workspace,
          'workspaceFolders'
        );

        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
          configurable: true,
          get: () => [mockWorkspaceFolder],
        });

        try {
          const result = await scanner.scan(testDir);

          // Should have 1 valid project and 1 error
          expect(result.projects.size).to.equal(1);
          expect(result.errors.length).to.equal(1);

          const validProject = result.projects.get('valid');
          expect(validProject).to.exist;
          expect(validProject!.scripts.get('test')).to.equal('npm test');

          expect(result.errors[0].filePath).to.equal(invalidPath);
          expect(result.errors[0].error).to.be.a('string');
        } finally {
          if (originalWorkspaceFolders) {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', originalWorkspaceFolders);
          }
        }
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });

    it('should handle non-string script values', async function () {
      const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comander-nonstring-test-'));

      try {
        const packageJsonPath = path.join(testDir, 'package.json');
        // Create package.json with non-string script values
        await fs.writeFile(
          packageJsonPath,
          JSON.stringify({
            name: 'test',
            scripts: {
              valid: 'npm test',
              invalid: 123,
              alsoInvalid: { nested: 'object' },
            },
          })
        );

        findFilesStub.resolves([vscode.Uri.file(packageJsonPath)]);

        const mockWorkspaceFolder: vscode.WorkspaceFolder = {
          uri: vscode.Uri.file(testDir),
          name: 'test-workspace',
          index: 0,
        };

        const originalWorkspaceFolders = Object.getOwnPropertyDescriptor(
          vscode.workspace,
          'workspaceFolders'
        );

        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
          configurable: true,
          get: () => [mockWorkspaceFolder],
        });

        try {
          const result = await scanner.scan(testDir);

          expect(result.projects.size).to.equal(1);
          expect(result.errors.length).to.equal(0);

          const project = result.projects.get('');
          expect(project).to.exist;

          // Only string script values should be included
          expect(project!.scripts.size).to.equal(1);
          expect(project!.scripts.get('valid')).to.equal('npm test');
          expect(project!.scripts.has('invalid')).to.be.false;
          expect(project!.scripts.has('alsoInvalid')).to.be.false;
        } finally {
          if (originalWorkspaceFolders) {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', originalWorkspaceFolders);
          }
        }
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });
  });

  describe('Relative Path Calculation', () => {
    it('should calculate correct relative paths for nested projects', async function () {
      const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comander-relative-test-'));

      try {
        const nestedPath = path.join(testDir, 'a', 'b', 'c', 'package.json');
        await fs.mkdir(path.join(testDir, 'a', 'b', 'c'), { recursive: true });
        await fs.writeFile(
          nestedPath,
          JSON.stringify({ name: 'nested', scripts: { test: 'npm test' } })
        );

        findFilesStub.resolves([vscode.Uri.file(nestedPath)]);

        const mockWorkspaceFolder: vscode.WorkspaceFolder = {
          uri: vscode.Uri.file(testDir),
          name: 'test-workspace',
          index: 0,
        };

        const originalWorkspaceFolders = Object.getOwnPropertyDescriptor(
          vscode.workspace,
          'workspaceFolders'
        );

        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
          configurable: true,
          get: () => [mockWorkspaceFolder],
        });

        try {
          const result = await scanner.scan(testDir);

          expect(result.projects.size).to.equal(1);

          // Project path should be relative to workspace root
          const project = result.projects.get('a/b/c');
          expect(project).to.exist;
          expect(project!.projectPath).to.equal('a/b/c');
        } finally {
          if (originalWorkspaceFolders) {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', originalWorkspaceFolders);
          }
        }
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });

    it('should normalize root project path to empty string', async function () {
      const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comander-root-path-test-'));

      try {
        const rootPath = path.join(testDir, 'package.json');
        await fs.writeFile(
          rootPath,
          JSON.stringify({ name: 'root', scripts: { test: 'npm test' } })
        );

        findFilesStub.resolves([vscode.Uri.file(rootPath)]);

        const mockWorkspaceFolder: vscode.WorkspaceFolder = {
          uri: vscode.Uri.file(testDir),
          name: 'test-workspace',
          index: 0,
        };

        const originalWorkspaceFolders = Object.getOwnPropertyDescriptor(
          vscode.workspace,
          'workspaceFolders'
        );

        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
          configurable: true,
          get: () => [mockWorkspaceFolder],
        });

        try {
          const result = await scanner.scan(testDir);

          expect(result.projects.size).to.equal(1);

          // Root project should have empty string as project path
          const project = result.projects.get('');
          expect(project).to.exist;
          expect(project!.projectPath).to.equal('');
        } finally {
          if (originalWorkspaceFolders) {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', originalWorkspaceFolders);
          }
        }
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });
  });
});
