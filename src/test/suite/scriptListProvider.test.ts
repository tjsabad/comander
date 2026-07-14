/**
 * Unit tests for ScriptListProvider
 * Task 7.3 - Test tree item generation, hierarchical rendering, and bulk mode
 * Requirements: 1.2, 1.5, 2.1, 6.2, 6.3
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ScriptListProvider } from '../../scriptListProvider';
import { ScriptCollection, CustomScript, ScriptItem } from '../../types';
import { generateScriptId } from '../../utils';

describe('ScriptListProvider - Unit Tests', () => {
  let provider: ScriptListProvider;

  beforeEach(() => {
    provider = new ScriptListProvider();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Tree Item Generation', () => {
    it('should generate tree items for various script collections', () => {
      // Create script collection with multiple projects
      const scriptCollection: ScriptCollection = {
        projects: new Map([
          [
            '',
            {
              projectPath: '',
              packageJsonPath: '/workspace/package.json',
              scripts: new Map([
                ['build', 'npm run build'],
                ['test', 'npm test'],
              ]),
            },
          ],
          [
            'project-a',
            {
              projectPath: 'project-a',
              packageJsonPath: '/workspace/project-a/package.json',
              scripts: new Map([['start', 'npm start']]),
            },
          ],
        ]),
        errors: [],
      };

      const customScripts: CustomScript[] = [
        {
          id: 'custom-1',
          name: 'deploy',
          command: 'npm run deploy',
          projectPath: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      provider.updateScripts(scriptCollection, customScripts);

      // Get root level items (projects)
      const rootItems = provider.getChildren();
      expect(rootItems).to.have.length(2);
      expect(rootItems[0].type).to.equal('project');
      expect(rootItems[0].label).to.equal('(root)');
      expect(rootItems[1].label).to.equal('project-a');

      // Get children for root project
      const rootScripts = provider.getChildren(rootItems[0]);
      expect(rootScripts).to.have.length(3); // 2 npm + 1 custom
      expect(rootScripts.find((s) => s.label === 'build')).to.exist;
      expect(rootScripts.find((s) => s.label === 'test')).to.exist;
      expect(rootScripts.find((s) => s.label === 'deploy')).to.exist;

      // Get children for project-a
      const projectAScripts = provider.getChildren(rootItems[1]);
      expect(projectAScripts).to.have.length(1);
      expect(projectAScripts[0].label).to.equal('start');
    });

    it('should return empty array when no scripts are available', () => {
      const scriptCollection: ScriptCollection = {
        projects: new Map(),
        errors: [],
      };

      provider.updateScripts(scriptCollection, []);

      const rootItems = provider.getChildren();
      expect(rootItems).to.be.an('array').that.is.empty;
    });

    it('should handle projects with no scripts', () => {
      const scriptCollection: ScriptCollection = {
        projects: new Map([
          [
            'empty-project',
            {
              projectPath: 'empty-project',
              packageJsonPath: '/workspace/empty-project/package.json',
              scripts: new Map(),
            },
          ],
        ]),
        errors: [],
      };

      provider.updateScripts(scriptCollection, []);

      const rootItems = provider.getChildren();
      expect(rootItems).to.have.length(1);

      const emptyProjectScripts = provider.getChildren(rootItems[0]);
      expect(emptyProjectScripts).to.be.an('array').that.is.empty;
    });
  });

  describe('Hierarchical Rendering', () => {
    it('should render projects as parent nodes and scripts as children', () => {
      const scriptCollection: ScriptCollection = {
        projects: new Map([
          [
            '',
            {
              projectPath: '',
              packageJsonPath: '/workspace/package.json',
              scripts: new Map([['build', 'npm run build']]),
            },
          ],
        ]),
        errors: [],
      };

      provider.updateScripts(scriptCollection, []);

      // Root level should return project nodes
      const projects = provider.getChildren();
      expect(projects).to.have.length(1);
      expect(projects[0].type).to.equal('project');

      // Project children should return script nodes
      const scripts = provider.getChildren(projects[0]);
      expect(scripts).to.have.length(1);
      expect(scripts[0].type).to.equal('npm-script');
      expect(scripts[0].label).to.equal('build');

      // Script nodes should have no children
      const scriptChildren = provider.getChildren(scripts[0]);
      expect(scriptChildren).to.be.an('array').that.is.empty;
    });

    it('should collapse project nodes by default when multiple projects exist', () => {
      const scriptCollection: ScriptCollection = {
        projects: new Map([
          [
            '',
            {
              projectPath: '',
              packageJsonPath: '/workspace/package.json',
              scripts: new Map([['build', 'npm run build']]),
            },
          ],
          [
            'project-a',
            {
              projectPath: 'project-a',
              packageJsonPath: '/workspace/project-a/package.json',
              scripts: new Map([['test', 'npm test']]),
            },
          ],
        ]),
        errors: [],
      };

      provider.updateScripts(scriptCollection, []);

      const projects = provider.getChildren();
      const rootProjectTreeItem = provider.getTreeItem(projects[0]);

      expect(rootProjectTreeItem.collapsibleState).to.equal(
        vscode.TreeItemCollapsibleState.Collapsed
      );
    });

    it('should expand single project node by default', () => {
      const scriptCollection: ScriptCollection = {
        projects: new Map([
          [
            '',
            {
              projectPath: '',
              packageJsonPath: '/workspace/package.json',
              scripts: new Map([['build', 'npm run build']]),
            },
          ],
        ]),
        errors: [],
      };

      provider.updateScripts(scriptCollection, []);

      const projects = provider.getChildren();
      const rootProjectTreeItem = provider.getTreeItem(projects[0]);

      expect(rootProjectTreeItem.collapsibleState).to.equal(
        vscode.TreeItemCollapsibleState.Expanded
      );
    });

    it('should group npm and custom scripts under their project', () => {
      const scriptCollection: ScriptCollection = {
        projects: new Map([
          [
            'project-a',
            {
              projectPath: 'project-a',
              packageJsonPath: '/workspace/project-a/package.json',
              scripts: new Map([['build', 'npm run build']]),
            },
          ],
        ]),
        errors: [],
      };

      const customScripts: CustomScript[] = [
        {
          id: 'custom-1',
          name: 'deploy',
          command: './deploy.sh',
          projectPath: 'project-a',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'custom-2',
          name: 'cleanup',
          command: './cleanup.sh',
          projectPath: 'project-a',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      provider.updateScripts(scriptCollection, customScripts);

      const projects = provider.getChildren();
      expect(projects).to.have.length(1);

      const scripts = provider.getChildren(projects[0]);
      expect(scripts).to.have.length(3); // 1 npm + 2 custom
      expect(scripts.some((s) => s.type === 'npm-script')).to.be.true;
      expect(scripts.filter((s) => s.type === 'custom-script')).to.have.length(2);
    });
  });

  describe('TreeItem Properties', () => {
    it('should set proper icons for npm scripts', () => {
      const scriptItem: ScriptItem = {
        type: 'npm-script',
        label: 'build',
        command: 'npm run build',
        projectPath: '',
      };

      const scriptCollection: ScriptCollection = {
        projects: new Map([
          [
            '',
            {
              projectPath: '',
              packageJsonPath: '/workspace/package.json',
              scripts: new Map([['build', 'npm run build']]),
            },
          ],
        ]),
        errors: [],
      };

      provider.updateScripts(scriptCollection, []);
      const projects = provider.getChildren();
      const scripts = provider.getChildren(projects[0]);
      const treeItem = provider.getTreeItem(scripts[0]);

      expect(treeItem.iconPath).to.be.instanceOf(vscode.ThemeIcon);
      const themeIcon = treeItem.iconPath as vscode.ThemeIcon;
      expect(themeIcon.id).to.equal('symbol-event');
      // Verify theme color is applied for consistent theming (Requirement 7.7)
      expect(themeIcon.color).to.be.instanceOf(vscode.ThemeColor);
    });

    it('should set proper icons for custom scripts', () => {
      const customScripts: CustomScript[] = [
        {
          id: 'custom-1',
          name: 'deploy',
          command: './deploy.sh',
          projectPath: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const scriptCollection: ScriptCollection = {
        projects: new Map(),
        errors: [],
      };

      provider.updateScripts(scriptCollection, customScripts);
      const projects = provider.getChildren();
      const scripts = provider.getChildren(projects[0]);
      const treeItem = provider.getTreeItem(scripts[0]);

      expect(treeItem.iconPath).to.be.instanceOf(vscode.ThemeIcon);
      const themeIcon = treeItem.iconPath as vscode.ThemeIcon;
      expect(themeIcon.id).to.equal('file-code');
      // Verify theme color is applied for custom scripts (Requirement 7.7)
      expect(themeIcon.color).to.be.instanceOf(vscode.ThemeColor);
    });

    it('should set proper icons for project nodes', () => {
      const scriptCollection: ScriptCollection = {
        projects: new Map([
          [
            '',
            {
              projectPath: '',
              packageJsonPath: '/workspace/package.json',
              scripts: new Map([['build', 'npm run build']]),
            },
          ],
        ]),
        errors: [],
      };

      provider.updateScripts(scriptCollection, []);
      const projects = provider.getChildren();
      const treeItem = provider.getTreeItem(projects[0]);

      expect(treeItem.iconPath).to.be.instanceOf(vscode.ThemeIcon);
      const themeIcon = treeItem.iconPath as vscode.ThemeIcon;
      expect(themeIcon.id).to.equal('folder');
      // Verify theme color is applied for project folders (Requirement 7.7)
      expect(themeIcon.color).to.be.instanceOf(vscode.ThemeColor);
    });

    it('should set contextValue for npm scripts', () => {
      const scriptCollection: ScriptCollection = {
        projects: new Map([
          [
            '',
            {
              projectPath: '',
              packageJsonPath: '/workspace/package.json',
              scripts: new Map([['build', 'npm run build']]),
            },
          ],
        ]),
        errors: [],
      };

      provider.updateScripts(scriptCollection, []);
      const projects = provider.getChildren();
      const scripts = provider.getChildren(projects[0]);
      const treeItem = provider.getTreeItem(scripts[0]);

      expect(treeItem.contextValue).to.equal('npm-script');
    });

    it('should set contextValue for custom scripts', () => {
      const customScripts: CustomScript[] = [
        {
          id: 'custom-1',
          name: 'deploy',
          command: './deploy.sh',
          projectPath: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const scriptCollection: ScriptCollection = {
        projects: new Map(),
        errors: [],
      };

      provider.updateScripts(scriptCollection, customScripts);
      const projects = provider.getChildren();
      const scripts = provider.getChildren(projects[0]);
      const treeItem = provider.getTreeItem(scripts[0]);

      expect(treeItem.contextValue).to.equal('custom-script');
    });

    it('should display last execution timestamp', () => {
      const scriptCollection: ScriptCollection = {
        projects: new Map([
          [
            '',
            {
              projectPath: '',
              packageJsonPath: '/workspace/package.json',
              scripts: new Map([['build', 'npm run build']]),
            },
          ],
        ]),
        errors: [],
      };

      provider.updateScripts(scriptCollection, []);
      const projects = provider.getChildren();
      const scripts = provider.getChildren(projects[0]);

      // Update last execution time
      const scriptId = generateScriptId(scripts[0]);
      provider.updateLastExecution(scriptId);

      // Get updated tree item
      const updatedScripts = provider.getChildren(projects[0]);
      const treeItem = provider.getTreeItem(updatedScripts[0]);

      expect(treeItem.description).to.include('Last run:');
    });

    it('should show command in description when no execution timestamp', () => {
      const scriptCollection: ScriptCollection = {
        projects: new Map([
          [
            '',
            {
              projectPath: '',
              packageJsonPath: '/workspace/package.json',
              scripts: new Map([['build', 'npm run build']]),
            },
          ],
        ]),
        errors: [],
      };

      provider.updateScripts(scriptCollection, []);
      const projects = provider.getChildren();
      const scripts = provider.getChildren(projects[0]);
      const treeItem = provider.getTreeItem(scripts[0]);

      expect(treeItem.description).to.equal('npm run build');
    });
  });

  describe('Bulk Mode Toggle', () => {
    it('should toggle bulk mode on and off', () => {
      expect(provider.isBulkModeEnabled()).to.be.false;

      provider.toggleBulkMode();
      expect(provider.isBulkModeEnabled()).to.be.true;

      provider.toggleBulkMode();
      expect(provider.isBulkModeEnabled()).to.be.false;
    });

    it('should clear selections when toggling bulk mode off', () => {
      const scriptCollection: ScriptCollection = {
        projects: new Map([
          [
            '',
            {
              projectPath: '',
              packageJsonPath: '/workspace/package.json',
              scripts: new Map([['build', 'npm run build']]),
            },
          ],
        ]),
        errors: [],
      };

      provider.updateScripts(scriptCollection, []);
      provider.toggleBulkMode();

      const projects = provider.getChildren();
      const scripts = provider.getChildren(projects[0]);
      const scriptId = generateScriptId(scripts[0]);

      // Select a script
      provider.toggleScriptSelection(scriptId);
      expect(provider.getSelectedScripts()).to.have.length(1);

      // Toggle bulk mode off
      provider.toggleBulkMode();
      expect(provider.getSelectedScripts()).to.be.an('array').that.is.empty;
    });

    it('should display checkboxes when bulk mode is enabled', () => {
      const scriptCollection: ScriptCollection = {
        projects: new Map([
          [
            '',
            {
              projectPath: '',
              packageJsonPath: '/workspace/package.json',
              scripts: new Map([['build', 'npm run build']]),
            },
          ],
        ]),
        errors: [],
      };

      provider.updateScripts(scriptCollection, []);
      provider.toggleBulkMode();

      const projects = provider.getChildren();
      const scripts = provider.getChildren(projects[0]);
      const treeItem = provider.getTreeItem(scripts[0]);

      expect(treeItem.checkboxState).to.equal(vscode.TreeItemCheckboxState.Unchecked);
    });

    it('should not display checkboxes when bulk mode is disabled', () => {
      const scriptCollection: ScriptCollection = {
        projects: new Map([
          [
            '',
            {
              projectPath: '',
              packageJsonPath: '/workspace/package.json',
              scripts: new Map([['build', 'npm run build']]),
            },
          ],
        ]),
        errors: [],
      };

      provider.updateScripts(scriptCollection, []);

      const projects = provider.getChildren();
      const scripts = provider.getChildren(projects[0]);
      const treeItem = provider.getTreeItem(scripts[0]);

      expect(treeItem.checkboxState).to.be.undefined;
    });
  });

  describe('Script Selection', () => {
    it('should track selected scripts for bulk execution', () => {
      const scriptCollection: ScriptCollection = {
        projects: new Map([
          [
            '',
            {
              projectPath: '',
              packageJsonPath: '/workspace/package.json',
              scripts: new Map([
                ['build', 'npm run build'],
                ['test', 'npm test'],
              ]),
            },
          ],
        ]),
        errors: [],
      };

      provider.updateScripts(scriptCollection, []);
      provider.toggleBulkMode();

      const projects = provider.getChildren();
      const scripts = provider.getChildren(projects[0]);

      // Select scripts
      const script1Id = generateScriptId(scripts[0]);
      const script2Id = generateScriptId(scripts[1]);

      provider.toggleScriptSelection(script1Id);
      provider.toggleScriptSelection(script2Id);

      const selected = provider.getSelectedScripts();
      expect(selected).to.have.length(2);
    });

    it('should toggle script selection on and off', () => {
      const scriptCollection: ScriptCollection = {
        projects: new Map([
          [
            '',
            {
              projectPath: '',
              packageJsonPath: '/workspace/package.json',
              scripts: new Map([['build', 'npm run build']]),
            },
          ],
        ]),
        errors: [],
      };

      provider.updateScripts(scriptCollection, []);
      provider.toggleBulkMode();

      const projects = provider.getChildren();
      const scripts = provider.getChildren(projects[0]);
      const scriptId = generateScriptId(scripts[0]);

      // Select
      provider.toggleScriptSelection(scriptId);
      expect(provider.getSelectedScripts()).to.have.length(1);

      // Deselect
      provider.toggleScriptSelection(scriptId);
      expect(provider.getSelectedScripts()).to.be.an('array').that.is.empty;
    });

    it('should update checkbox state based on selection', () => {
      const scriptCollection: ScriptCollection = {
        projects: new Map([
          [
            '',
            {
              projectPath: '',
              packageJsonPath: '/workspace/package.json',
              scripts: new Map([['build', 'npm run build']]),
            },
          ],
        ]),
        errors: [],
      };

      provider.updateScripts(scriptCollection, []);
      provider.toggleBulkMode();

      const projects = provider.getChildren();
      const scripts = provider.getChildren(projects[0]);
      const scriptId = generateScriptId(scripts[0]);

      // Initially unchecked
      let treeItem = provider.getTreeItem(scripts[0]);
      expect(treeItem.checkboxState).to.equal(vscode.TreeItemCheckboxState.Unchecked);

      // Select and check again
      provider.toggleScriptSelection(scriptId);
      const updatedScripts = provider.getChildren(projects[0]);
      treeItem = provider.getTreeItem(updatedScripts[0]);
      expect(treeItem.checkboxState).to.equal(vscode.TreeItemCheckboxState.Checked);
    });

    it('should handle checkbox changes via handleCheckboxChange', () => {
      const scriptCollection: ScriptCollection = {
        projects: new Map([
          [
            '',
            {
              projectPath: '',
              packageJsonPath: '/workspace/package.json',
              scripts: new Map([
                ['build', 'npm run build'],
                ['test', 'npm test'],
              ]),
            },
          ],
        ]),
        errors: [],
      };

      provider.updateScripts(scriptCollection, []);
      provider.toggleBulkMode();

      const projects = provider.getChildren();
      const scripts = provider.getChildren(projects[0]);

      // Simulate checkbox changes
      provider.handleCheckboxChange([
        [scripts[0], vscode.TreeItemCheckboxState.Checked],
        [scripts[1], vscode.TreeItemCheckboxState.Checked],
      ]);

      const selected = provider.getSelectedScripts();
      expect(selected).to.have.length(2);

      // Simulate unchecking one script
      provider.handleCheckboxChange([
        [scripts[0], vscode.TreeItemCheckboxState.Unchecked],
      ]);

      const updatedSelected = provider.getSelectedScripts();
      expect(updatedSelected).to.have.length(1);
      expect(updatedSelected[0].label).to.equal('test');
    });

    it('should ignore checkbox changes for project nodes', () => {
      const scriptCollection: ScriptCollection = {
        projects: new Map([
          [
            '',
            {
              projectPath: '',
              packageJsonPath: '/workspace/package.json',
              scripts: new Map([['build', 'npm run build']]),
            },
          ],
        ]),
        errors: [],
      };

      provider.updateScripts(scriptCollection, []);
      provider.toggleBulkMode();

      const projects = provider.getChildren();

      // Try to "check" a project node (should be ignored)
      provider.handleCheckboxChange([
        [projects[0], vscode.TreeItemCheckboxState.Checked],
      ]);

      const selected = provider.getSelectedScripts();
      expect(selected).to.be.an('array').that.is.empty;
    });
  });

  describe('Refresh Behavior', () => {
    it('should fire change event on refresh', (done) => {
      let eventFired = false;

      provider.onDidChangeTreeData(() => {
        eventFired = true;
        expect(eventFired).to.be.true;
        done();
      });

      provider.refresh();
    });

    it('should refresh after updating scripts', (done) => {
      provider.onDidChangeTreeData(() => {
        done();
      });

      const scriptCollection: ScriptCollection = {
        projects: new Map(),
        errors: [],
      };

      provider.updateScripts(scriptCollection, []);
    });
  });

  describe('Alphabetical Sorting', () => {
    it('should sort scripts alphabetically within a project', () => {
      const scriptCollection: ScriptCollection = {
        projects: new Map([
          [
            '',
            {
              projectPath: '',
              packageJsonPath: '/workspace/package.json',
              scripts: new Map([
                ['test', 'npm test'],
                ['build', 'npm run build'],
                ['deploy', 'npm run deploy'],
                ['analyze', 'npm run analyze'],
              ]),
            },
          ],
        ]),
        errors: [],
      };

      provider.updateScripts(scriptCollection, []);
      const projects = provider.getChildren();
      const scripts = provider.getChildren(projects[0]);

      expect(scripts[0].label).to.equal('analyze');
      expect(scripts[1].label).to.equal('build');
      expect(scripts[2].label).to.equal('deploy');
      expect(scripts[3].label).to.equal('test');
    });

    it('should sort custom and npm scripts together alphabetically', () => {
      const scriptCollection: ScriptCollection = {
        projects: new Map([
          [
            '',
            {
              projectPath: '',
              packageJsonPath: '/workspace/package.json',
              scripts: new Map([
                ['test', 'npm test'],
                ['build', 'npm run build'],
              ]),
            },
          ],
        ]),
        errors: [],
      };

      const customScripts: CustomScript[] = [
        {
          id: 'custom-1',
          name: 'deploy',
          command: './deploy.sh',
          projectPath: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'custom-2',
          name: 'analyze',
          command: './analyze.sh',
          projectPath: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      provider.updateScripts(scriptCollection, customScripts);
      const projects = provider.getChildren();
      const scripts = provider.getChildren(projects[0]);

      // Should be: analyze, build, deploy, test (alphabetical)
      expect(scripts[0].label).to.equal('analyze');
      expect(scripts[1].label).to.equal('build');
      expect(scripts[2].label).to.equal('deploy');
      expect(scripts[3].label).to.equal('test');
    });
  });
});
