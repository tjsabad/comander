/**
 * Script List View Provider - renders the tree view of scripts
 * Task 7.1 Implementation
 * Requirements: 1.2, 1.5, 2.1, 5.1, 7.1, 7.7
 */

import * as vscode from 'vscode';
import { ScriptItem, ScriptCollection, CustomScript } from './types';
import { generateScriptId } from './utils';

export class ScriptListProvider implements vscode.TreeDataProvider<ScriptItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    ScriptItem | undefined | null | void
  > = new vscode.EventEmitter<ScriptItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    ScriptItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  /** Current script collection from scanner */
  private scriptCollection: ScriptCollection = {
    projects: new Map(),
    errors: [],
  };

  /** Custom scripts from manager */
  private customScripts: CustomScript[] = [];

  /** Last execution timestamps for scripts */
  private lastExecutionTimes: Map<string, Date> = new Map();

  /** Bulk execution mode flag */
  private bulkModeEnabled = false;

  /** Selected scripts for bulk execution */
  private selectedScripts: Set<string> = new Set();

  /** Order of selected scripts for bulk execution (array of script IDs in order) */
  private scriptOrder: string[] = [];

  /**
   * Update the script collection and refresh tree view
   * Requirements: 1.2, 1.3
   */
  updateScripts(scriptCollection: ScriptCollection, customScripts: CustomScript[]): void {
    this.scriptCollection = scriptCollection;
    this.customScripts = customScripts;
    this.refresh();
  }

  /**
   * Update last execution timestamp for a script
   * Requirement: 7.1
   */
  updateLastExecution(scriptId: string): void {
    this.lastExecutionTimes.set(scriptId, new Date());
    this.refresh();
  }

  /**
   * Refresh the tree view
   * Requirement: 7.1
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get children for hierarchical tree rendering
   * Requirements: 1.2, 1.5
   * 
   * Root level: project nodes + "Custom Scripts" node
   * Project level: npm scripts
   * Custom Scripts level: categories or scripts
   * Category level: custom scripts in that category
   */
  getChildren(element?: ScriptItem): ScriptItem[] {
    if (!element) {
      // Root level: return project nodes (npm scripts) + category nodes (custom scripts)
      const nodes = this.getProjectNodes();
      
      // Add category nodes for custom scripts
      const categoryNodes = this.getCategoryNodes();
      nodes.push(...categoryNodes);
      
      return nodes;
    }

    // Category node - show scripts in that category
    if (element.type === 'category') {
      return this.getScriptsForCategory(element.category || '');
    }

    // Project node - show npm scripts only
    if (element.type === 'project') {
      return this.getNpmScriptNodesForProject(element.projectPath || '');
    }

    // Scripts don't have children
    return [];
  }

  /**
   * Get TreeItem for rendering with icons, buttons, and metadata
   * Requirements: 2.1, 5.1, 7.1, 7.7
   */
  getTreeItem(element: ScriptItem): vscode.TreeItem {
    if (element.type === 'project') {
      return this.createProjectTreeItem(element);
    }

    if (element.type === 'category') {
      return this.createCategoryTreeItem(element);
    }

    return this.createScriptTreeItem(element);
  }

  /**
   * Toggle bulk execution mode
   * Requirement: 6.2, 6.3
   */
  toggleBulkMode(): void {
    this.bulkModeEnabled = !this.bulkModeEnabled;
    
    // Clear selections and order when toggling off
    if (!this.bulkModeEnabled) {
      this.selectedScripts.clear();
      this.scriptOrder = [];
    }
    
    this.refresh();
  }

  /**
   * Get selected scripts for bulk execution
   * Requirement: 6.2
   */
  getSelectedScripts(): ScriptItem[] {
    const selected: ScriptItem[] = [];

    // If we have a custom order, use it
    if (this.scriptOrder.length > 0) {
      for (const scriptId of this.scriptOrder) {
        if (this.selectedScripts.has(scriptId)) {
          const scriptItem = this.findScriptById(scriptId);
          if (scriptItem) {
            selected.push(scriptItem);
          }
        }
      }
      return selected;
    }

    // Otherwise, return in default order
    // Iterate through all projects and scripts to find selected ones
    for (const [projectPath, projectScripts] of this.scriptCollection.projects) {
      for (const [scriptName, command] of projectScripts.scripts) {
        const scriptItem: ScriptItem = {
          type: 'npm-script',
          label: scriptName,
          command,
          projectPath,
        };
        const scriptId = generateScriptId(scriptItem);
        
        if (this.selectedScripts.has(scriptId)) {
          selected.push(scriptItem);
        }
      }
    }

    // Add selected custom scripts
    for (const customScript of this.customScripts) {
      const scriptItem: ScriptItem = {
        type: 'custom-script',
        label: customScript.name,
        command: customScript.command,
        projectPath: customScript.projectPath,
        id: customScript.id,
      };
      const scriptId = generateScriptId(scriptItem);
      
      if (this.selectedScripts.has(scriptId)) {
        selected.push(scriptItem);
      }
    }

    return selected;
  }

  /**
   * Toggle script selection for bulk execution
   * Requirement: 6.3
   */
  toggleScriptSelection(scriptId: string): void {
    if (this.selectedScripts.has(scriptId)) {
      this.selectedScripts.delete(scriptId);
    } else {
      this.selectedScripts.add(scriptId);
    }
    this.refresh();
  }

  /**
   * Handle checkbox state changes from TreeView
   * This is called automatically by VS Code when a checkbox is clicked
   * Requirement: 6.3
   */
  handleCheckboxChange(items: ReadonlyArray<[ScriptItem, vscode.TreeItemCheckboxState]>): void {
    for (const [item, state] of items) {
      if (item.type === 'npm-script' || item.type === 'custom-script') {
        const scriptId = generateScriptId(item);
        if (state === vscode.TreeItemCheckboxState.Checked) {
          this.selectedScripts.add(scriptId);
          // Add to order if not already present
          if (!this.scriptOrder.includes(scriptId)) {
            this.scriptOrder.push(scriptId);
          }
        } else {
          this.selectedScripts.delete(scriptId);
          // Remove from order
          this.scriptOrder = this.scriptOrder.filter(id => id !== scriptId);
        }
      }
    }
    this.refresh();
  }

  /**
   * Set custom order for selected scripts
   * Requirement: 6.4
   */
  setScriptOrder(orderedScriptIds: string[]): void {
    this.scriptOrder = orderedScriptIds;
    this.refresh();
  }

  /**
   * Get the current script order
   * Requirement: 6.4
   */
  getScriptOrder(): string[] {
    return [...this.scriptOrder];
  }

  /**
   * Get count of selected scripts
   */
  getSelectedScriptCount(): number {
    return this.selectedScripts.size;
  }

  /**
   * Check if bulk mode is enabled
   */
  isBulkModeEnabled(): boolean {
    return this.bulkModeEnabled;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get project nodes for root level (npm scripts only, not custom scripts)
   * Requirements: 1.5, 7.1
   */
  private getProjectNodes(): ScriptItem[] {
    const projectPaths = new Set<string>();

    // Collect all project paths from npm scripts only
    for (const projectPath of this.scriptCollection.projects.keys()) {
      projectPaths.add(projectPath);
    }

    // Create project nodes, filtering out those with 0 scripts
    const projectNodes: ScriptItem[] = [];
    
    for (const projectPath of Array.from(projectPaths).sort()) {
      // Skip projects with no scripts
      const scripts = this.getNpmScriptNodesForProject(projectPath);
      if (scripts.length === 0) {
        continue;
      }

      // Get package name from package.json
      const projectScripts = this.scriptCollection.projects.get(projectPath);
      let label = projectPath || '(root)';
      
      if (projectScripts) {
        const packageName = this.getPackageName(projectScripts.packageJsonPath);
        if (packageName) {
          label = packageName;
        } else if (projectPath) {
          label = projectPath;
        } else {
          label = '(root)';
        }
      }
      
      projectNodes.push({
        type: 'project' as const,
        label,
        projectPath,
      });
    }

    return projectNodes;
  }

  /**
   * Get package name from package.json file
   */
  private getPackageName(packageJsonPath: string): string | null {
    try {
      const fs = require('fs');
      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);
      return packageJson.name || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get npm script nodes for a specific project (npm scripts only)
   * Requirements: 1.2, 5.1, 7.1
   */
  private getNpmScriptNodesForProject(projectPath: string): ScriptItem[] {
    const scripts: ScriptItem[] = [];

    // Add npm scripts from package.json
    const projectScripts = this.scriptCollection.projects.get(projectPath);
    if (projectScripts) {
      for (const [scriptName, command] of projectScripts.scripts) {
        const scriptItem: ScriptItem = {
          type: 'npm-script',
          label: scriptName,
          command,
          projectPath,
        };
        
        // Add last execution timestamp if available
        const scriptId = generateScriptId(scriptItem);
        const lastExecuted = this.lastExecutionTimes.get(scriptId);
        if (lastExecuted) {
          scriptItem.lastExecuted = lastExecuted;
        }

        scripts.push(scriptItem);
      }
    }

    // Sort scripts alphabetically
    scripts.sort((a, b) => a.label.localeCompare(b.label));

    return scripts;
  }

  /**
   * Get category nodes - for custom scripts only
   */
  private getCategoryNodes(): ScriptItem[] {
    const nodes: ScriptItem[] = [];
    const categorized: Map<string, CustomScript[]> = new Map();

    // Group custom scripts by category
    for (const customScript of this.customScripts) {
      // Use actual category name, or "Uncategorized" if not set
      const category = customScript.category && customScript.category.trim() 
        ? customScript.category.trim() 
        : 'Uncategorized';
      
      if (!categorized.has(category)) {
        categorized.set(category, []);
      }
      categorized.get(category)!.push(customScript);
    }

    // Add category nodes (sorted, with "Uncategorized" last), but only if they have scripts
    const sortedCategories = Array.from(categorized.keys()).sort((a, b) => {
      // Put "Uncategorized" at the end
      if (a === 'Uncategorized') return 1;
      if (b === 'Uncategorized') return -1;
      return a.localeCompare(b);
    });
    
    for (const category of sortedCategories) {
      const scriptsInCategory = categorized.get(category) || [];
      // Only add category if it has scripts
      if (scriptsInCategory.length > 0) {
        nodes.push({
          type: 'category',
          label: category,
          category,
        });
      }
    }

    return nodes;
  }

  /**
   * Get all existing category names (excluding "Uncategorized")
   */
  getExistingCategories(): string[] {
    const categories = new Set<string>();
    
    for (const customScript of this.customScripts) {
      if (customScript.category && customScript.category.trim()) {
        categories.add(customScript.category.trim());
      }
    }
    
    return Array.from(categories).sort();
  }

  /**
   * Get scripts for a specific category
   */
  private getScriptsForCategory(category: string): ScriptItem[] {
    const scripts: ScriptItem[] = [];

    for (const customScript of this.customScripts) {
      // Match category, treating empty/missing as "Uncategorized"
      const scriptCategory = customScript.category && customScript.category.trim() 
        ? customScript.category.trim() 
        : 'Uncategorized';
      
      if (scriptCategory === category) {
        const scriptItem: ScriptItem = {
          type: 'custom-script',
          label: customScript.name,
          command: customScript.command,
          projectPath: customScript.projectPath,
          category: customScript.category,
          id: customScript.id,
        };
        
        const scriptId = generateScriptId(scriptItem);
        const lastExecuted = this.lastExecutionTimes.get(scriptId);
        if (lastExecuted) {
          scriptItem.lastExecuted = lastExecuted;
        }

        scripts.push(scriptItem);
      }
    }

    // Sort scripts alphabetically
    scripts.sort((a, b) => a.label.localeCompare(b.label));

    return scripts;
  }

  /**
   * Create TreeItem for project node
   * Requirements: 1.5, 7.7
   */
  private createProjectTreeItem(element: ScriptItem): vscode.TreeItem {
    const projectCount = this.getNpmScriptNodesForProject(element.projectPath || '').length;
    const treeItem = new vscode.TreeItem(
      element.label,
      vscode.TreeItemCollapsibleState.Collapsed
    );

    treeItem.description = `${projectCount} script${projectCount !== 1 ? 's' : ''}`;
    // Apply themed folder icon (Requirement: 7.7)
    treeItem.iconPath = new vscode.ThemeIcon(
      'folder',
      new vscode.ThemeColor('charts.yellow')
    );
    treeItem.contextValue = 'project';

    // Collapse by default if multiple projects exist (Requirement: 7.1)
    const projectNodes = this.getProjectNodes();
    if (projectNodes.length > 1) {
      treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    } else {
      treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    }

    return treeItem;
  }

  /**
   * Create TreeItem for category node
   */
  private createCategoryTreeItem(element: ScriptItem): vscode.TreeItem {
    const categoryScripts = this.getScriptsForCategory(element.category || '');
    const treeItem = new vscode.TreeItem(
      element.label,
      vscode.TreeItemCollapsibleState.Expanded
    );

    treeItem.description = `${categoryScripts.length} script${categoryScripts.length !== 1 ? 's' : ''}`;
    treeItem.iconPath = new vscode.ThemeIcon(
      'folder',
      new vscode.ThemeColor('charts.orange')
    );
    treeItem.contextValue = 'category';

    return treeItem;
  }

  /**
   * Create TreeItem for script node with buttons and metadata
   * Requirements: 2.1, 5.1, 7.1, 7.7
   */
  private createScriptTreeItem(element: ScriptItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(element.label);
    const scriptId = generateScriptId(element);

    // Apply VS Code theme icons with semantic colors (Requirement: 7.7)
    if (element.type === 'custom-script') {
      // Use charts.blue for custom scripts to differentiate them
      treeItem.iconPath = new vscode.ThemeIcon(
        'file-code',
        new vscode.ThemeColor('charts.blue')
      );
    } else {
      // Use charts.green for npm scripts
      treeItem.iconPath = new vscode.ThemeIcon(
        'symbol-event',
        new vscode.ThemeColor('charts.green')
      );
    }

    // Add last execution timestamp to description (Requirement: 7.1)
    if (element.lastExecuted) {
      const timeStr = this.formatTimestamp(element.lastExecuted);
      treeItem.description = `Last run: ${timeStr}`;
    } else {
      treeItem.description = element.command;
    }

    // Set tooltip with command details
    treeItem.tooltip = new vscode.MarkdownString();
    treeItem.tooltip.appendMarkdown(`**${element.label}**\n\n`);
    treeItem.tooltip.appendCodeblock(element.command || '', 'bash');
    if (element.lastExecuted) {
      treeItem.tooltip.appendMarkdown(`\n\nLast executed: ${element.lastExecuted.toLocaleString()}`);
    }

    // Set context value for conditional button visibility
    if (element.type === 'custom-script') {
      treeItem.contextValue = 'custom-script';
    } else {
      treeItem.contextValue = 'npm-script';
    }

    // Add checkboxes in bulk mode (Requirement: 6.3)
    if (this.bulkModeEnabled) {
      treeItem.checkboxState = this.selectedScripts.has(scriptId)
        ? vscode.TreeItemCheckboxState.Checked
        : vscode.TreeItemCheckboxState.Unchecked;
    }

    return treeItem;
  }

  /**
   * Format timestamp for display
   * Shows relative time for recent executions, absolute time for older ones
   */
  private formatTimestamp(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMinutes < 1) {
      return 'just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  /**
   * Find a script by its ID
   * Helper for ordering functionality
   */
  private findScriptById(scriptId: string): ScriptItem | null {
    // Check npm scripts
    for (const [projectPath, projectScripts] of this.scriptCollection.projects) {
      for (const [scriptName, command] of projectScripts.scripts) {
        const scriptItem: ScriptItem = {
          type: 'npm-script',
          label: scriptName,
          command,
          projectPath,
        };
        
        if (generateScriptId(scriptItem) === scriptId) {
          return scriptItem;
        }
      }
    }

    // Check custom scripts
    for (const customScript of this.customScripts) {
      const scriptItem: ScriptItem = {
        type: 'custom-script',
        label: customScript.name,
        command: customScript.command,
        projectPath: customScript.projectPath,
        id: customScript.id,
      };
      
      if (generateScriptId(scriptItem) === scriptId) {
        return scriptItem;
      }
    }

    return null;
  }
}
