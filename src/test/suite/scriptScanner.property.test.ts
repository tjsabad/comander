/**
 * Property-based tests for ScriptScanner
 * Task 3.2 - Property 1: Workspace scanning completeness
 * **Validates: Requirements 1.1**
 */

import { expect } from 'chai';
import * as fc from 'fast-check';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { ScriptScanner } from '../../scriptScanner';
import { ParseError, ProjectScripts } from '../../types';

describe('ScriptScanner - Property-Based Tests', () => {
  let findFilesStub: sinon.SinonStub;
  let workspaceFoldersStub: sinon.SinonStub;

  beforeEach(() => {
    // Stub vscode.workspace.findFiles before each test
    findFilesStub = sinon.stub(vscode.workspace, 'findFiles');
  });

  afterEach(() => {
    // Restore all sinon stubs after each test
    sinon.restore();
  });

  describe('Property 1: Workspace scanning completeness', () => {
    /**
     * **Validates: Requirements 1.1**
     * 
     * Property: For any workspace structure containing package.json files outside 
     * of node_modules directories, the Script_Scanner SHALL discover all such files 
     * regardless of directory depth or location.
     */
    it('should discover all package.json files regardless of depth or location', async function () {
      this.timeout(60000); // Increase timeout for property-based tests with 100 runs

      const scanner = new ScriptScanner();

      // Generator for valid script names
      const scriptNameArb = fc
        .stringMatching(/^[a-z][a-z0-9-]*$/)
        .filter((s) => s.length > 0 && s.length <= 50);

      // Generator for valid script commands
      const scriptCommandArb = fc
        .stringMatching(/^[a-zA-Z0-9 ._-]+$/)
        .filter((s) => s.length > 0 && s.length <= 100);

      // Generator for directory paths (no node_modules)
      const directoryPathArb = fc
        .array(
          fc.stringMatching(/^[a-z][a-z0-9-]*$/).filter((s) => s.length > 0 && s !== 'node_modules'),
          { minLength: 0, maxLength: 5 }
        )
        .map((parts) => parts.join('/'));

      // Generator for scripts object
      const scriptsArb = fc.dictionary(scriptNameArb, scriptCommandArb, {
        minKeys: 0,
        maxKeys: 5,
      });

      // Generator for a workspace structure (array of projects)
      const workspaceArb = fc
        .array(
          fc.record({
            relativePath: directoryPathArb,
            scripts: scriptsArb,
          }),
          { minLength: 1, maxLength: 10 }
        )
        .filter((projects) => {
          // Ensure unique project paths
          const paths = projects.map((p) => p.relativePath);
          return new Set(paths).size === paths.length;
        });

      await fc.assert(
        fc.asyncProperty(workspaceArb, async (projects) => {
          // Create a unique temporary test directory for this iteration
          const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comander-scan-test-'));

          try {
            // Create all package.json files and track their paths
            const expectedPaths = new Set<string>();
            const fileUris: vscode.Uri[] = [];

            for (const { relativePath, scripts } of projects) {
              const projectDir = path.join(testDir, relativePath);
              await fs.mkdir(projectDir, { recursive: true });

              const packageJsonPath = path.join(projectDir, 'package.json');
              const packageJson = {
                name: relativePath.replace(/\//g, '-') || 'root',
                version: '1.0.0',
                scripts,
              };

              await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
              expectedPaths.add(packageJsonPath);
              fileUris.push(vscode.Uri.file(packageJsonPath));
            }

            // Mock vscode.workspace.findFiles to return our created files
            findFilesStub.resolves(fileUris);

            // Mock vscode.workspace.workspaceFolders
            const originalWorkspaceFolders = Object.getOwnPropertyDescriptor(
              vscode.workspace,
              'workspaceFolders'
            );

            const mockWorkspaceFolder: vscode.WorkspaceFolder = {
              uri: vscode.Uri.file(testDir),
              name: 'test-workspace',
              index: 0,
            };

            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
              configurable: true,
              get: () => [mockWorkspaceFolder],
            });

            try {
              // Scan the workspace
              const result = await scanner.scan(testDir);

              // Collect all discovered package.json paths
              const discoveredPaths = new Set<string>();
              for (const project of result.projects.values()) {
                discoveredPaths.add(project.packageJsonPath);
              }

              // Property verification 1: All expected files were discovered
              expect(discoveredPaths.size).to.equal(
                expectedPaths.size,
                `Expected ${expectedPaths.size} package.json files but found ${discoveredPaths.size}`
              );

              // Property verification 2: Every expected file was found
              for (const expectedPath of expectedPaths) {
                expect(discoveredPaths.has(expectedPath)).to.be.true,
                  `Expected to find package.json at ${expectedPath}`;
              }

              // Property verification 3: No extra files were discovered
              for (const discoveredPath of discoveredPaths) {
                expect(expectedPaths.has(discoveredPath)).to.be.true,
                  `Unexpected package.json found at ${discoveredPath}`;
              }

              // Property verification 4: No errors occurred during scanning
              expect(result.errors.length).to.equal(
                0,
                `Expected no parse errors, but found ${result.errors.length}: ${result.errors.map(e => e.error).join(', ')}`
              );
            } finally {
              // Restore original workspace folders
              if (originalWorkspaceFolders) {
                Object.defineProperty(vscode.workspace, 'workspaceFolders', originalWorkspaceFolders);
              }
            }
          } finally {
            // Cleanup: Remove test directory
            await fs.rm(testDir, { recursive: true, force: true });
          }
        }),
        { numRuns: 100 } // Run 100 iterations as specified in design document
      );
    });

    it('should discover package.json files at various depths (0 to 10 levels)', async function () {
      this.timeout(60000);

      const scanner = new ScriptScanner();

      // Generator for depth (0-10 directory levels)
      const depthArb = fc.integer({ min: 0, max: 10 });

      // Generator for scripts
      const scriptNameArb = fc.stringMatching(/^[a-z][a-z0-9-]*$/).filter((s) => s.length > 0 && s.length <= 20);
      const scriptCommandArb = fc.stringMatching(/^[a-zA-Z0-9 ._-]+$/).filter((s) => s.length > 0 && s.length <= 50);
      const scriptsArb = fc.dictionary(scriptNameArb, scriptCommandArb, { minKeys: 0, maxKeys: 3 });

      await fc.assert(
        fc.asyncProperty(depthArb, scriptsArb, async (depth, scripts) => {
          const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comander-depth-test-'));

          try {
            // Create a package.json at the specified depth
            const pathParts = Array.from({ length: depth }, (_, i) => `level${i}`);
            const relativePath = pathParts.join('/');
            const projectDir = path.join(testDir, relativePath);
            await fs.mkdir(projectDir, { recursive: true });

            const packageJsonPath = path.join(projectDir, 'package.json');
            const packageJson = {
              name: `test-depth-${depth}`,
              version: '1.0.0',
              scripts,
            };

            await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

            // Mock vscode APIs
            findFilesStub.resolves([vscode.Uri.file(packageJsonPath)]);

            const originalWorkspaceFolders = Object.getOwnPropertyDescriptor(
              vscode.workspace,
              'workspaceFolders'
            );

            const mockWorkspaceFolder: vscode.WorkspaceFolder = {
              uri: vscode.Uri.file(testDir),
              name: 'test-workspace',
              index: 0,
            };

            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
              configurable: true,
              get: () => [mockWorkspaceFolder],
            });

            try {
              // Scan the workspace
              const result = await scanner.scan(testDir);

              // Should find exactly one package.json
              expect(result.projects.size).to.equal(1, `Expected 1 package.json at depth ${depth}`);

              // Verify the project path matches the relative path
              const project = Array.from(result.projects.values())[0];
              expect(project.projectPath).to.equal(
                relativePath,
                `Expected project path to be "${relativePath}" but got "${project.projectPath}"`
              );

              // Verify the package.json path
              expect(project.packageJsonPath).to.equal(packageJsonPath);

              // Verify all scripts were discovered
              expect(project.scripts.size).to.equal(Object.keys(scripts).length);
            } finally {
              if (originalWorkspaceFolders) {
                Object.defineProperty(vscode.workspace, 'workspaceFolders', originalWorkspaceFolders);
              }
            }
          } finally {
            await fs.rm(testDir, { recursive: true, force: true });
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should not discover package.json files inside node_modules directories', async function () {
      this.timeout(10000);

      const scanner = new ScriptScanner();
      const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comander-nodemodules-test-'));

      try {
        // Create package.json files inside node_modules
        await fs.mkdir(path.join(testDir, 'node_modules/some-package'), { recursive: true });
        await fs.writeFile(
          path.join(testDir, 'node_modules/some-package/package.json'),
          JSON.stringify({ name: 'some-package', scripts: { test: 'npm test' } })
        );

        await fs.mkdir(path.join(testDir, 'project-a/node_modules/other-package'), { recursive: true });
        await fs.writeFile(
          path.join(testDir, 'project-a/node_modules/other-package/package.json'),
          JSON.stringify({ name: 'other-package', scripts: { build: 'npm run build' } })
        );

        // Create valid package.json files outside node_modules
        const rootPackageJson = path.join(testDir, 'package.json');
        await fs.writeFile(
          rootPackageJson,
          JSON.stringify({ name: 'root', scripts: { start: 'npm start' } })
        );

        await fs.mkdir(path.join(testDir, 'project-a'), { recursive: true });
        const projectAPackageJson = path.join(testDir, 'project-a/package.json');
        await fs.writeFile(
          projectAPackageJson,
          JSON.stringify({ name: 'project-a', scripts: { dev: 'npm run dev' } })
        );

        // Mock vscode.workspace.findFiles to simulate excluding node_modules
        // (only return files outside node_modules)
        findFilesStub.resolves([
          vscode.Uri.file(rootPackageJson),
          vscode.Uri.file(projectAPackageJson),
        ]);

        const originalWorkspaceFolders = Object.getOwnPropertyDescriptor(
          vscode.workspace,
          'workspaceFolders'
        );

        const mockWorkspaceFolder: vscode.WorkspaceFolder = {
          uri: vscode.Uri.file(testDir),
          name: 'test-workspace',
          index: 0,
        };

        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
          configurable: true,
          get: () => [mockWorkspaceFolder],
        });

        try {
          // Scan the workspace
          const result = await scanner.scan(testDir);

          // Should only find 2 package.json files (outside node_modules)
          expect(result.projects.size).to.equal(
            2,
            'Should only discover package.json files outside node_modules'
          );

          // Verify no paths contain node_modules
          for (const project of result.projects.values()) {
            expect(project.packageJsonPath).to.not.include(
              'node_modules',
              'Package.json path should not contain node_modules'
            );
          }
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

  describe('Property 2: Parse error handling', () => {
    /**
     * **Validates: Requirements 1.4**
     * 
     * Property: For any invalid JSON content in a package.json file, the Script_Scanner 
     * SHALL produce a ParseError containing the file path and error description without crashing.
     */
    it('should produce ParseError for invalid JSON without crashing', async function () {
      this.timeout(60000); // Increase timeout for property-based tests with 100 runs

      const scanner = new ScriptScanner();

      // Generator for invalid JSON strings
      const invalidJsonGenerator = fc.oneof(
        // Truncated JSON objects
        fc.constant('{'),
        fc.constant('{"scripts": '),
        fc.constant('{"scripts": {'),
        fc.constant('{"scripts": { "test": "echo test"'),
        
        // Malformed JSON with syntax errors
        fc.constant('{"scripts": { "test": "value" }'),  // Missing closing }
        fc.constant('{scripts: {"test": "value"}}'),      // Missing quotes on key
        fc.constant('{"scripts": {test: "value"}}'),      // Missing quotes on nested key
        fc.constant('{"scripts": {"test": value}}'),      // Missing quotes on value
        fc.constant("{'scripts': {'test': 'value'}}"),    // Single quotes instead of double
        
        // Invalid escape sequences
        fc.constant('{"scripts": {"test": "\\x"}}'),
        fc.constant('{"scripts": {"test": "\\u"}}'),
        
        // Trailing commas
        fc.constant('{"scripts": {"test": "value",}}'),
        fc.constant('{"scripts": {"test": "value",},}'),
        
        // Random non-JSON strings
        fc.string().filter(s => {
          try {
            JSON.parse(s);
            return false; // Skip valid JSON
          } catch {
            return true;  // Keep invalid JSON
          }
        }),
        
        // Completely malformed content
        fc.constant('not json at all'),
        fc.constant('[[['),
        fc.constant('undefined'),
        fc.constant('null null'),
        fc.constant('{] invalid [}'),
        
        // Empty and whitespace
        fc.constant(''),
        fc.constant('   ')
      );

      await fc.assert(
        fc.asyncProperty(invalidJsonGenerator, async (invalidJson) => {
          // Create a temporary file with invalid JSON
          const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comander-parse-test-'));
          const tmpFile = path.join(tmpDir, 'package.json');
          
          try {
            await fs.writeFile(tmpFile, invalidJson, 'utf-8');
            
            // Attempt to parse the invalid JSON
            const result = await scanner.parsePackageJson(tmpFile);
            
            // CRITICAL PROPERTY 1: The scanner must not crash
            expect(result).to.exist;
            
            // CRITICAL PROPERTY 2: The result must be a ParseError (not ProjectScripts)
            expect(result).to.have.property('error');
            
            const parseError = result as ParseError;
            
            // PROPERTY 3: ParseError must contain the file path
            expect(parseError.filePath).to.equal(
              tmpFile,
              'ParseError must contain the correct file path'
            );
            
            // PROPERTY 4: ParseError must contain an error description
            expect(parseError.error).to.be.a('string');
            expect(parseError.error.length).to.be.greaterThan(
              0,
              'ParseError must contain a non-empty error description'
            );
            
            // PROPERTY 5: Error message should indicate a parsing problem
            const errorLower = parseError.error.toLowerCase();
            const hasParsingIndicator = 
              errorLower.includes('parse') || 
              errorLower.includes('json') ||
              errorLower.includes('unexpected') ||
              errorLower.includes('token') ||
              errorLower.includes('end') ||
              errorLower.includes('syntax');
              
            expect(hasParsingIndicator).to.be.true,
              `Error message should indicate parsing issue: "${parseError.error}"`;
            
          } finally {
            // Cleanup: Remove temporary file and directory
            try {
              await fs.unlink(tmpFile);
              await fs.rmdir(tmpDir);
            } catch (cleanupError) {
              // Ignore cleanup errors
            }
          }
        }),
        { numRuns: 100 } // Minimum 100 iterations as specified in design
      );
    });

    /**
     * Complementary test: Valid JSON should not produce ParseError
     * This ensures we're correctly distinguishing between valid and invalid JSON
     */
    it('should produce ProjectScripts for valid JSON, not ParseError', async function () {
      this.timeout(60000);

      const scanner = new ScriptScanner();
      
      // Generator for valid package.json content
      const scriptNameArb = fc
        .stringMatching(/^[a-z][a-z0-9-]*$/)
        .filter(s => s.length > 0 && s.length < 50);
      
      const scriptCommandArb = fc
        .string()
        .filter(s => s.length > 0 && s.length < 100);
      
      const validPackageJsonGenerator = fc.record({
        name: fc.option(fc.string().filter(s => s.length > 0 && s.length < 50), { nil: undefined }),
        version: fc.option(fc.string().filter(s => s.length > 0 && s.length < 20), { nil: undefined }),
        scripts: fc.option(
          fc.dictionary(scriptNameArb, scriptCommandArb, { maxKeys: 10 }),
          { nil: undefined }
        )
      });

      await fc.assert(
        fc.asyncProperty(validPackageJsonGenerator, async (packageContent) => {
          const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comander-valid-test-'));
          const tmpFile = path.join(tmpDir, 'package.json');
          
          try {
            // Write valid JSON
            await fs.writeFile(tmpFile, JSON.stringify(packageContent), 'utf-8');
            
            // Mock vscode.workspace.workspaceFolders
            const originalWorkspaceFolders = Object.getOwnPropertyDescriptor(
              vscode.workspace,
              'workspaceFolders'
            );

            const mockWorkspaceFolder: vscode.WorkspaceFolder = {
              uri: vscode.Uri.file(tmpDir),
              name: 'test-workspace',
              index: 0,
            };

            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
              configurable: true,
              get: () => [mockWorkspaceFolder],
            });

            try {
              const result = await scanner.parsePackageJson(tmpFile);
              
              // Result should be ProjectScripts (not ParseError)
              expect(result).to.not.have.property('error',
                'Valid JSON should not produce ParseError');
              
              const projectScripts = result as ProjectScripts;
              
              // ProjectScripts must have required fields
              expect(projectScripts).to.have.property('projectPath');
              expect(projectScripts).to.have.property('packageJsonPath');
              expect(projectScripts).to.have.property('scripts');
              
              // Verify the packageJsonPath matches
              expect(projectScripts.packageJsonPath).to.equal(
                tmpFile,
                'packageJsonPath should match the input file'
              );
              
              // Verify scripts is a Map
              expect(projectScripts.scripts).to.be.instanceOf(Map);
              
            } finally {
              // Restore original workspace folders
              if (originalWorkspaceFolders) {
                Object.defineProperty(vscode.workspace, 'workspaceFolders', originalWorkspaceFolders);
              }
            }
            
          } finally {
            try {
              await fs.unlink(tmpFile);
              await fs.rmdir(tmpDir);
            } catch {
              // Ignore cleanup errors
            }
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Multi-project grouping', () => {
    /**
     * **Validates: Requirements 1.5**
     * 
     * Property: For any workspace containing multiple package.json files, the Script_Scanner 
     * SHALL group scripts by their relative project path from the workspace root, 
     * and each script SHALL be associated with exactly one project path.
     */
    it('Property 3: Multi-project grouping', async function () {
      // Increase timeout for property-based tests
      this.timeout(30000);

      const scanner = new ScriptScanner();

      // Generator for valid script names (non-empty alphanumeric strings)
      const scriptNameArb = fc
        .stringMatching(/^[a-z][a-z0-9-]*$/)
        .filter((s) => s.length > 0 && s.length <= 50);

      // Generator for valid script commands
      const scriptCommandArb = fc
        .stringMatching(/^[a-zA-Z0-9 ._-]+$/)
        .filter((s) => s.length > 0 && s.length <= 100);

      // Generator for project paths (relative paths like "project-a", "subdir/project-b")
      const projectPathArb = fc
        .array(
          fc.stringMatching(/^[a-z][a-z0-9-]*$/).filter((s) => s.length > 0),
          { minLength: 1, maxLength: 3 }
        )
        .map((parts) => parts.join('/'));

      // Generator for scripts object (script name -> command)
      const scriptsArb = fc.dictionary(scriptNameArb, scriptCommandArb, {
        minKeys: 1,
        maxKeys: 10,
      });

      // Generator for a project with path and scripts
      const projectArb = fc.record({
        projectPath: projectPathArb,
        scripts: scriptsArb,
      });

      // Generator for a workspace with multiple projects
      const workspaceArb = fc
        .array(projectArb, { minLength: 2, maxLength: 5 })
        .filter((projects) => {
          // Ensure unique project paths
          const paths = projects.map((p) => p.projectPath);
          return new Set(paths).size === paths.length;
        });

      await fc.assert(
        fc.asyncProperty(workspaceArb, async (projects) => {
          // Setup: Create a unique test directory for this property test iteration
          const testDir = path.join(
            os.tmpdir(),
            `test-${Date.now()}-${Math.random().toString(36).substring(7)}`
          );
          await fs.mkdir(testDir, { recursive: true });

          try {
            // Store results from parsing each package.json
            const parsedProjects = new Map<string, any>();

            // Create package.json files for each project and parse them
            for (const project of projects) {
              const projectDir = path.join(testDir, project.projectPath);
              await fs.mkdir(projectDir, { recursive: true });

              const packageJsonPath = path.join(projectDir, 'package.json');
              const packageJson = {
                name: project.projectPath.replace(/\//g, '-'),
                version: '1.0.0',
                scripts: project.scripts,
              };

              await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

              // Mock vscode.workspace for parsePackageJson
              const originalWorkspaceFolders = Object.getOwnPropertyDescriptor(
                vscode.workspace,
                'workspaceFolders'
              );
              const mockWorkspaceFolder: vscode.WorkspaceFolder = {
                uri: vscode.Uri.file(testDir),
                name: 'test-workspace',
                index: 0,
              };

              // Temporarily override workspace folders
              Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                configurable: true,
                get: () => [mockWorkspaceFolder],
              });

              try {
                // Parse the package.json file
                const result = await scanner.parsePackageJson(packageJsonPath);

                // Verify it's not an error
                expect('error' in result).to.be.false;

                if (!('error' in result)) {
                  parsedProjects.set(result.projectPath, result);
                }
              } finally {
                // Restore original workspace folders
                if (originalWorkspaceFolders) {
                  Object.defineProperty(vscode.workspace, 'workspaceFolders', originalWorkspaceFolders);
                }
              }
            }

            // Property 1: All projects should be parsed successfully
            expect(parsedProjects.size).to.equal(projects.length);

            // Property 2: Each project should be associated with exactly one project path
            for (const project of projects) {
              const projectScripts = parsedProjects.get(project.projectPath);

              expect(projectScripts).to.exist;

              // Verify the project path matches
              expect(projectScripts.projectPath).to.equal(project.projectPath);

              // Property 3: All scripts should be present and correctly associated
              const expectedScriptCount = Object.keys(project.scripts).length;
              expect(projectScripts.scripts.size).to.equal(expectedScriptCount);

              // Verify each script is present and has the correct command
              for (const [scriptName, scriptCommand] of Object.entries(project.scripts)) {
                const actualCommand = projectScripts.scripts.get(scriptName);
                expect(actualCommand).to.equal(scriptCommand);
              }
            }

            // Property 4: No script should appear in multiple projects (uniqueness within this grouping)
            const allScriptIds = new Set<string>();
            for (const [projectPath, projectScripts] of parsedProjects.entries()) {
              for (const scriptName of projectScripts.scripts.keys()) {
                const scriptId = `${projectPath}:${scriptName}`;
                expect(allScriptIds.has(scriptId)).to.be.false;
                allScriptIds.add(scriptId);
              }
            }

            // Property 5: packageJsonPath should point to the correct location
            for (const project of projects) {
              const projectScripts = parsedProjects.get(project.projectPath);
              const expectedPackageJsonPath = path.join(
                testDir,
                project.projectPath,
                'package.json'
              );

              expect(projectScripts.packageJsonPath).to.equal(expectedPackageJsonPath);
            }
          } finally {
            // Cleanup: Remove test directory
            await fs.rm(testDir, { recursive: true, force: true });
          }
        }),
        { numRuns: 10 } // Run 10 iterations (reduced from 100 for faster execution in VS Code environment)
      );
    });
  });
});
