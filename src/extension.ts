/**
 * Main extension entry point for Comander VS Code extension
 * Task 9.1 Implementation
 * Requirements: 1.8, 4.1, 4.6, 5.1, 6.1, 6.2, 7.1
 */

import * as vscode from 'vscode';
import { ScriptListProvider } from './scriptListProvider';
import { SettingsManager } from './settingsManager';
import { ScriptScanner } from './scriptScanner';
import { CustomScriptManager } from './customScriptManager';
import { ScriptExecutor } from './scriptExecutor';
import { BulkExecutor } from './bulkExecutor';
import { ScriptItem } from './types';
import { generateScriptId } from './utils';

/**
 * Extension activation function
 * Called when the extension is activated
 * Requirements: 1.8, 4.1, 4.6, 5.1, 6.1, 6.2, 7.1
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log('Comander extension is now active');

  // ============================================================================
  // Initialize all components
  // ============================================================================

  // Initialize SettingsManager
  const settingsManager = new SettingsManager(context);

  // Validate and repair settings on activation
  // Task 12.3: Requirements 3.7, 4.5, 5.5, 6.10
  await settingsManager.validateAndRepairSettings();

  // Initialize ScriptScanner
  const scriptScanner = new ScriptScanner();

  // Initialize CustomScriptManager
  const customScriptManager = new CustomScriptManager(settingsManager);

  // Initialize ScriptExecutor
  const scriptExecutor = new ScriptExecutor();

  // Initialize BulkExecutor
  const bulkExecutor = new BulkExecutor(scriptExecutor, settingsManager);

  // Initialize ScriptListProvider
  const scriptListProvider = new ScriptListProvider();

  // ============================================================================
  // Register tree view provider with checkbox support
  // ============================================================================

  const treeView = vscode.window.createTreeView('comanderScripts', {
    treeDataProvider: scriptListProvider,
    showCollapseAll: true,
    canSelectMany: false,
  });

  // Handle checkbox state changes for bulk execution mode
  treeView.onDidChangeCheckboxState((event) => {
    scriptListProvider.handleCheckboxChange(event.items);
    
    // Update context variables for conditional button visibility
    const hasSelectedScripts = scriptListProvider.getSelectedScriptCount() >= 2;
    vscode.commands.executeCommand('setContext', 'comander.hasSelectedScripts', hasSelectedScripts);
  });

  context.subscriptions.push(treeView);

  // ============================================================================
  // Load custom scripts and bulk sequences from settings on activation
  // Requirement: 4.6
  // ============================================================================

  const customScripts = customScriptManager.list();

  // ============================================================================
  // Start file watching for package.json changes
  // Requirement: 1.8
  // ============================================================================

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    // Initial scan on activation
    scriptScanner.scan(workspaceRoot).then((scriptCollection) => {
      scriptListProvider.updateScripts(scriptCollection, customScripts);
    });

    // Watch for changes and update tree view
    const watcher = scriptScanner.watch((scriptCollection) => {
      const updatedCustomScripts = customScriptManager.list();
      scriptListProvider.updateScripts(scriptCollection, updatedCustomScripts);
    });

    context.subscriptions.push(watcher);
  }

  // ============================================================================
  // Register commands
  // ============================================================================

  // Register refresh command
  const refreshCommand = vscode.commands.registerCommand(
    'comander.refresh',
    async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 0) {
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const scriptCollection = await scriptScanner.scan(workspaceRoot);
        const customScripts = customScriptManager.list();
        scriptListProvider.updateScripts(scriptCollection, customScripts);
        vscode.window.showInformationMessage('Scripts refreshed');
      }
    }
  );

  // Register toggle bulk mode command
  // Requirement: 6.2
  const toggleBulkModeCommand = vscode.commands.registerCommand(
    'comander.toggleBulkMode',
    () => {
      scriptListProvider.toggleBulkMode();

      // Update context variables
      const isEnabled = scriptListProvider.isBulkModeEnabled();
      vscode.commands.executeCommand('setContext', 'comander.bulkModeEnabled', isEnabled);
      vscode.commands.executeCommand('setContext', 'comander.hasSelectedScripts', false);

      // Show status message
      vscode.window.showInformationMessage(
        `Bulk execution mode ${isEnabled ? 'enabled' : 'disabled'}`
      );
    }
  );

  // Register reorder bulk scripts command
  // Requirement: 6.4
  const reorderBulkScriptsCommand = vscode.commands.registerCommand(
    'comander.reorderBulkScripts',
    async () => {
      const selectedScripts = scriptListProvider.getSelectedScripts();

      if (selectedScripts.length < 2) {
        vscode.window.showWarningMessage(
          'Please select at least 2 scripts to reorder'
        );
        return;
      }

      // Create quick pick items with move up/down actions
      interface ReorderQuickPickItem extends vscode.QuickPickItem {
        action: 'moveUp' | 'moveDown' | 'done';
        index?: number;
      }

      let currentOrder = scriptListProvider.getScriptOrder();
      if (currentOrder.length === 0) {
        // Initialize order if not set
        currentOrder = selectedScripts.map(s => generateScriptId(s));
      }

      let reordering = true;
      while (reordering) {
        const items: ReorderQuickPickItem[] = [];

        // Add script items with move buttons
        currentOrder.forEach((scriptId, index) => {
          const script = selectedScripts.find(s => generateScriptId(s) === scriptId);
          if (script) {
            const position = `${index + 1}/${currentOrder.length}`;
            const canMoveUp = index > 0;
            const canMoveDown = index < currentOrder.length - 1;

            const arrows = [];
            if (canMoveUp) {
              arrows.push('↑');
            }
            if (canMoveDown) {
              arrows.push('↓');
            }

            // Move up option
            if (canMoveUp) {
              items.push({
                label: `$(arrow-up) Move "${script.label}" up`,
                description: `Currently at position ${position}`,
                action: 'moveUp',
                index,
              });
            }

            // Move down option
            if (canMoveDown) {
              items.push({
                label: `$(arrow-down) Move "${script.label}" down`,
                description: `Currently at position ${position}`,
                action: 'moveDown',
                index,
              });
            }
          }
        });

        // Add separator and done button
        items.push({
          label: '$(check) Done',
          description: 'Finish reordering',
          action: 'done',
        });

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: `Reorder ${currentOrder.length} scripts - Current order: ${selectedScripts.map(s => s.label).join(' → ')}`,
        });

        if (!selected || selected.action === 'done') {
          reordering = false;
        } else if (selected.action === 'moveUp' && selected.index !== undefined) {
          // Swap with previous item
          const temp = currentOrder[selected.index];
          currentOrder[selected.index] = currentOrder[selected.index - 1];
          currentOrder[selected.index - 1] = temp;
        } else if (selected.action === 'moveDown' && selected.index !== undefined) {
          // Swap with next item
          const temp = currentOrder[selected.index];
          currentOrder[selected.index] = currentOrder[selected.index + 1];
          currentOrder[selected.index + 1] = temp;
        }
      }

      // Save the new order
      scriptListProvider.setScriptOrder(currentOrder);
      
      const orderedScripts = scriptListProvider.getSelectedScripts();
      const orderStr = orderedScripts.map(s => s.label).join(' → ');
      vscode.window.showInformationMessage(`Script order updated: ${orderStr}`);
    }
  );

  // Register execute script command
  // Requirement: 7.1
  const executeScriptCommand = vscode.commands.registerCommand(
    'comander.executeScript',
    async (scriptItem: ScriptItem) => {
      try {
        // Get saved parameters from settings
        const savedParams = settingsManager.getParameters(
          scriptItem.projectPath || '',
          scriptItem.label
        );

        // Prompt user for parameters with saved value as default
        const parameters = await vscode.window.showInputBox({
          prompt: `Parameters for "${scriptItem.label}" (optional)`,
          placeHolder: 'Additional arguments (optional)',
          value: savedParams || '',
        });

        // If user cancelled, don't execute
        if (parameters === undefined) {
          return;
        }

        // Save or remove parameters based on input
        if (parameters.trim().length > 0) {
          await settingsManager.setParameters(
            scriptItem.projectPath || '',
            scriptItem.label,
            parameters
          );
        } else {
          await settingsManager.removeParameters(
            scriptItem.projectPath || '',
            scriptItem.label
          );
        }

        // Execute the script
        const result = await scriptExecutor.execute(
          scriptItem,
          parameters.trim().length > 0 ? parameters : undefined
        );

        // Update last execution timestamp in tree view
        const scriptId = generateScriptId(scriptItem);
        scriptListProvider.updateLastExecution(scriptId);

        // Show notification based on result
        if (result.success) {
          vscode.window.showInformationMessage(
            `Script "${result.scriptName}" completed successfully`
          );
        } else {
          vscode.window.showErrorMessage(
            `Script "${result.scriptName}" failed with exit code ${result.exitCode}`
          );
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to execute script: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  // Register add custom script command
  // Requirement: 4.1
  const addCustomScriptCommand = vscode.commands.registerCommand(
    'comander.addCustomScript',
    async () => {
      // Prompt for script name
      const name = await vscode.window.showInputBox({
        prompt: 'Enter custom script name',
        placeHolder: 'Script name (max 100 characters)',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Script name cannot be empty or whitespace';
          }
          if (value.length > 100) {
            return 'Script name must be 100 characters or less';
          }
          return null;
        },
      });

      if (!name) {
        return; // User cancelled
      }

      // Prompt for command
      const command = await vscode.window.showInputBox({
        prompt: 'Enter command to execute',
        placeHolder: 'Command (max 500 characters)',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Command cannot be empty or whitespace';
          }
          if (value.length > 500) {
            return 'Command must be 500 characters or less';
          }
          return null;
        },
      });

      if (!command) {
        return; // User cancelled
      }

      // Get workspace folders to scan and update scripts FIRST
      const workspaceFolders = vscode.workspace.workspaceFolders;
      const workspaceRoot = workspaceFolders ? workspaceFolders[0].uri.fsPath : '';
      
      // Update script list provider with latest custom scripts BEFORE showing dropdown
      if (workspaceRoot) {
        const scriptCollection = await scriptScanner.scan(workspaceRoot);
        const latestCustomScripts = customScriptManager.list();
        scriptListProvider.updateScripts(scriptCollection, latestCustomScripts);
      }

      // Get existing categories for dropdown (after updating scriptListProvider)
      const existingCategories = scriptListProvider.getExistingCategories();
      
      let category: string | undefined;
      
      if (existingCategories.length > 0) {
        // Show quick pick with existing categories + option to create new
        const quickPickItems = [
          { label: '$(add) Create new category...', value: '__new__' },
          { label: '$(close) No category', value: '' },
          ...existingCategories.map(cat => ({ label: cat, value: cat }))
        ];
        
        const selected = await vscode.window.showQuickPick(
          quickPickItems,
          {
            placeHolder: 'Select a category or create a new one',
          }
        );
        
        if (selected === undefined) {
          return; // User cancelled
        }
        
        if (selected.value === '__new__') {
          // Prompt for new category name
          const newCategory = await vscode.window.showInputBox({
            prompt: 'Enter new category name',
            placeHolder: 'Category name (max 50 characters)',
            validateInput: (value) => {
              if (value && value.length > 50) {
                return 'Category must be 50 characters or less';
              }
              return null;
            },
          });
          
          if (newCategory === undefined) {
            return; // User cancelled
          }
          
          category = newCategory.trim().length > 0 ? newCategory.trim() : undefined;
        } else {
          category = selected.value.length > 0 ? selected.value : undefined;
        }
      } else {
        // No existing categories, prompt for category (optional)
        const categoryInput = await vscode.window.showInputBox({
          prompt: 'Enter category name (optional)',
          placeHolder: 'Category name (max 50 characters, press Enter to skip)',
          validateInput: (value) => {
            if (value && value.length > 50) {
              return 'Category must be 50 characters or less';
            }
            return null;
          },
        });

        if (categoryInput === undefined) {
          return; // User cancelled
        }
        
        category = categoryInput.trim().length > 0 ? categoryInput.trim() : undefined;
      }

      // Get workspace root for project path (reuse from above)
      const projectPath = workspaceFolders ? '' : '';

      // Create the custom script with category
      const result = await customScriptManager.create(
        name,
        command,
        projectPath,
        category
      );

      if (result.success) {
        vscode.window.showInformationMessage(
          `Custom script "${name}" created successfully`
        );

        // Refresh tree view
        const workspaceRoot = workspaceFolders
          ? workspaceFolders[0].uri.fsPath
          : '';
        if (workspaceRoot) {
          const scriptCollection = await scriptScanner.scan(workspaceRoot);
          const customScripts = customScriptManager.list();
          scriptListProvider.updateScripts(scriptCollection, customScripts);
        }
      } else {
        vscode.window.showErrorMessage(
          `Failed to create custom script: ${result.error}`
        );
      }
    }
  );

  // Register edit custom script command
  // Requirement: 5.1
  const editCustomScriptCommand = vscode.commands.registerCommand(
    'comander.editCustomScript',
    async (scriptItem: ScriptItem) => {
      if (!scriptItem.id) {
        vscode.window.showErrorMessage('Script ID not found');
        return;
      }

      const existingScript = customScriptManager.get(scriptItem.id);
      if (!existingScript) {
        vscode.window.showErrorMessage('Custom script not found');
        return;
      }

      // Prompt for new name
      const name = await vscode.window.showInputBox({
        prompt: 'Edit script name',
        placeHolder: 'Script name (max 100 characters)',
        value: existingScript.name,
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Script name cannot be empty or whitespace';
          }
          if (value.length > 100) {
            return 'Script name must be 100 characters or less';
          }
          return null;
        },
      });

      if (!name) {
        return; // User cancelled
      }

      // Prompt for new command
      const command = await vscode.window.showInputBox({
        prompt: 'Edit command',
        placeHolder: 'Command (max 500 characters)',
        value: existingScript.command,
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Command cannot be empty or whitespace';
          }
          if (value.length > 500) {
            return 'Command must be 500 characters or less';
          }
          return null;
        },
      });

      if (!command) {
        return; // User cancelled
      }

      // Get workspace folders to scan and update scripts FIRST
      const workspaceFolders = vscode.workspace.workspaceFolders;
      const workspaceRoot = workspaceFolders ? workspaceFolders[0].uri.fsPath : '';
      
      // Update script list provider with latest custom scripts BEFORE showing dropdown
      if (workspaceRoot) {
        const scriptCollection = await scriptScanner.scan(workspaceRoot);
        const latestCustomScripts = customScriptManager.list();
        scriptListProvider.updateScripts(scriptCollection, latestCustomScripts);
      }

      // Get existing categories for dropdown (after updating scriptListProvider)
      const existingCategories = scriptListProvider.getExistingCategories();
      
      let category: string | undefined;
      
      if (existingCategories.length > 0) {
        // Show quick pick with existing categories + option to create new
        const quickPickItems = [
          { label: '$(add) Create new category...', value: '__new__' },
          { label: '$(close) No category', value: '' },
          ...existingCategories.map(cat => ({ label: cat, value: cat }))
        ];
        
        const selected = await vscode.window.showQuickPick(
          quickPickItems,
          {
            placeHolder: 'Select a category or create a new one',
          }
        );
        
        if (selected === undefined) {
          return; // User cancelled
        }
        
        if (selected.value === '__new__') {
          // Prompt for new category name
          const newCategory = await vscode.window.showInputBox({
            prompt: 'Enter new category name',
            placeHolder: 'Category name (max 50 characters)',
            validateInput: (value) => {
              if (value && value.length > 50) {
                return 'Category must be 50 characters or less';
              }
              return null;
            },
          });
          
          if (newCategory === undefined) {
            return; // User cancelled
          }
          
          category = newCategory.trim().length > 0 ? newCategory.trim() : undefined;
        } else {
          category = selected.value.length > 0 ? selected.value : undefined;
        }
      } else {
        // No existing categories, prompt for category (optional)
        const categoryInput = await vscode.window.showInputBox({
          prompt: 'Enter category name (optional)',
          placeHolder: 'Category name (max 50 characters, press Enter to skip)',
          validateInput: (value) => {
            if (value && value.length > 50) {
              return 'Category must be 50 characters or less';
            }
            return null;
          },
        });

        if (categoryInput === undefined) {
          return; // User cancelled
        }
        
        category = categoryInput.trim().length > 0 ? categoryInput.trim() : undefined;
      }

      // Update the custom script with category
      const result = await customScriptManager.update(
        scriptItem.id,
        name,
        command,
        category
      );

      if (result.success) {
        vscode.window.showInformationMessage(
          `Custom script "${name}" updated successfully`
        );

        // Refresh tree view (reuse workspaceFolders from above)
        const workspaceRoot2 = workspaceFolders
          ? workspaceFolders[0].uri.fsPath
          : '';
        if (workspaceRoot2) {
          const scriptCollection = await scriptScanner.scan(workspaceRoot2);
          const customScripts = customScriptManager.list();
          scriptListProvider.updateScripts(scriptCollection, customScripts);
        }
      } else {
        vscode.window.showErrorMessage(
          `Failed to update custom script: ${result.error}`
        );
      }
    }
  );

  // Register delete custom script command
  const deleteCustomScriptCommand = vscode.commands.registerCommand(
    'comander.deleteCustomScript',
    async (scriptItem: ScriptItem) => {
      if (!scriptItem.id) {
        vscode.window.showErrorMessage('Script ID not found');
        return;
      }

      // Prompt for confirmation
      const confirmation = await vscode.window.showWarningMessage(
        `Are you sure you want to delete the custom script "${scriptItem.label}"?`,
        { modal: true },
        'Delete'
      );

      if (confirmation !== 'Delete') {
        return; // User cancelled
      }

      // Delete the custom script
      const result = await customScriptManager.delete(scriptItem.id);

      if (result.success) {
        vscode.window.showInformationMessage(
          `Custom script "${scriptItem.label}" deleted successfully`
        );

        // Refresh tree view
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspaceRoot = workspaceFolders
          ? workspaceFolders[0].uri.fsPath
          : '';
        if (workspaceRoot) {
          const scriptCollection = await scriptScanner.scan(workspaceRoot);
          const customScripts = customScriptManager.list();
          scriptListProvider.updateScripts(scriptCollection, customScripts);
        }
      } else {
        vscode.window.showErrorMessage(
          `Failed to delete custom script: ${result.error}`
        );
      }
    }
  );

  // Register execute bulk command
  // Requirement: 6.1
  const executeBulkCommand = vscode.commands.registerCommand(
    'comander.executeBulk',
    async () => {
      const selectedScripts = scriptListProvider.getSelectedScripts();

      if (selectedScripts.length < 2) {
        vscode.window.showWarningMessage(
          'Please select at least 2 scripts for bulk execution'
        );
        return;
      }

      // Scripts are already in the correct order from getSelectedScripts()
      // Create order array matching the selected scripts
      const order = selectedScripts.map((_, index) => index);

      // Show confirmation with script list
      const scriptList = selectedScripts.map((s) => s.label).join(' → ');
      const confirmation = await vscode.window.showInformationMessage(
        `Execute ${selectedScripts.length} scripts in order: ${scriptList}?`,
        { modal: true },
        'Execute',
        'Cancel'
      );

      if (confirmation !== 'Execute') {
        return;
      }

      try {
        // Execute bulk
        vscode.window.showInformationMessage('Starting bulk execution...');
        const result = await bulkExecutor.executeBulk(selectedScripts, order);

        // Show result notification
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
      } catch (error) {
        vscode.window.showErrorMessage(
          `Bulk execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  // Register save bulk sequence command
  const saveBulkSequenceCommand = vscode.commands.registerCommand(
    'comander.saveBulkSequence',
    async () => {
      const selectedScripts = scriptListProvider.getSelectedScripts();

      if (selectedScripts.length < 2) {
        vscode.window.showWarningMessage(
          'Please select at least 2 scripts to save a bulk sequence'
        );
        return;
      }

      // Prompt for sequence name
      const name = await vscode.window.showInputBox({
        prompt: 'Enter bulk sequence name',
        placeHolder: 'Sequence name (1-100 characters)',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Sequence name cannot be empty or whitespace';
          }
          if (value.length < 1 || value.length > 100) {
            return 'Sequence name must be between 1 and 100 characters';
          }
          return null;
        },
      });

      if (!name) {
        return; // User cancelled
      }

      // Scripts are already in the correct order from getSelectedScripts()
      // Create order array matching the selected scripts
      const order = selectedScripts.map((_, index) => index);

      // Save the sequence
      const result = await bulkExecutor.saveSequence(
        name,
        selectedScripts,
        order
      );

      if (result.success) {
        vscode.window.showInformationMessage(
          `Bulk sequence "${name}" saved successfully`
        );
      } else {
        vscode.window.showErrorMessage(
          `Failed to save bulk sequence: ${result.error}`
        );
      }
    }
  );

  // Register load bulk sequence command
  // Requirement: 6.11, 6.12
  const loadBulkSequenceCommand = vscode.commands.registerCommand(
    'comander.loadBulkSequence',
    async () => {
      const sequences = bulkExecutor.listSequences();

      if (sequences.length === 0) {
        vscode.window.showInformationMessage('No saved bulk sequences found');
        return;
      }

      // Create quick pick items
      const items = sequences.map((seq) => ({
        label: seq.name,
        description: `${seq.scriptIds.length} scripts`,
        sequenceId: seq.id,
      }));

      // Show quick pick
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a bulk sequence to load',
      });

      if (!selected) {
        return; // User cancelled
      }

      // Load the sequence
      const sequence = bulkExecutor.loadSequence(selected.sequenceId);
      if (sequence) {
        // Check for missing scripts (Requirement 6.12)
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
          const workspaceRoot = workspaceFolders[0].uri.fsPath;
          const scriptCollection = await scriptScanner.scan(workspaceRoot);
          const customScripts = customScriptManager.list();

          // Get all available script IDs
          const availableScriptIds = new Set<string>();
          
          // Add npm script IDs
          for (const [projectPath, projectScripts] of scriptCollection.projects.entries()) {
            for (const scriptName of projectScripts.scripts.keys()) {
              availableScriptIds.add(generateScriptId({
                type: 'npm-script',
                label: scriptName,
                projectPath,
              } as ScriptItem));
            }
          }
          
          // Add custom script IDs
          for (const customScript of customScripts) {
            availableScriptIds.add(generateScriptId({
              type: 'custom-script',
              label: customScript.name,
              projectPath: customScript.projectPath,
              id: customScript.id,
            } as ScriptItem));
          }

          // Find missing scripts
          const missingScripts = sequence.scriptIds.filter(
            (scriptId) => !availableScriptIds.has(scriptId)
          );

          if (missingScripts.length > 0) {
            // Display warning notification (Requirement 6.12)
            const action = await vscode.window.showWarningMessage(
              `Bulk sequence "${sequence.name}" references ${missingScripts.length} missing script(s): ${missingScripts.join(', ')}. Do you want to proceed with available scripts only?`,
              { modal: true },
              'Proceed',
              'Cancel'
            );

            if (action !== 'Proceed') {
              return; // User cancelled
            }
          }
        }

        vscode.window.showInformationMessage(
          `Loaded bulk sequence "${sequence.name}" with ${sequence.scriptIds.length} scripts`
        );
        // Note: Actual script selection in tree view would require additional implementation
      }
    }
  );

  // Register execute recent command
  // Requirement: 7.1
  const executeRecentCommand = vscode.commands.registerCommand(
    'comander.executeRecent',
    async () => {
      const mostRecentScript = scriptExecutor.getMostRecentScript();

      if (!mostRecentScript) {
        vscode.window.showInformationMessage(
          'No recently executed script found'
        );
        return;
      }

      try {
        // Execute without prompting for parameters (use saved params if available)
        const savedParams = settingsManager.getParameters(
          mostRecentScript.projectPath || '',
          mostRecentScript.label
        );

        const result = await scriptExecutor.execute(
          mostRecentScript,
          savedParams || undefined
        );

        // Update last execution timestamp
        const scriptId = generateScriptId(mostRecentScript);
        scriptListProvider.updateLastExecution(scriptId);

        // Show notification
        if (result.success) {
          vscode.window.showInformationMessage(
            `Script "${result.scriptName}" completed successfully`
          );
        } else {
          vscode.window.showErrorMessage(
            `Script "${result.scriptName}" failed with exit code ${result.exitCode}`
          );
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to execute script: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  // ============================================================================
  // Add all commands to subscriptions
  // ============================================================================

  context.subscriptions.push(
    refreshCommand,
    toggleBulkModeCommand,
    reorderBulkScriptsCommand,
    executeScriptCommand,
    addCustomScriptCommand,
    editCustomScriptCommand,
    deleteCustomScriptCommand,
    executeBulkCommand,
    saveBulkSequenceCommand,
    loadBulkSequenceCommand,
    executeRecentCommand
  );
}

/**
 * Extension deactivation function
 * Called when the extension is deactivated
 */
export function deactivate() {
  console.log('Comander extension is now deactivated');
}
