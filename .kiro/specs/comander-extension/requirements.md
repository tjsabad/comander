# Requirements Document

## Introduction

Comander is a Visual Studio Code extension that enhances the developer experience for Node.js projects by providing an intuitive interface for discovering, managing, and executing npm scripts. The extension scans package.json files, displays available scripts with executable buttons, supports parameterized script execution with argument persistence, enables custom script management, and provides bulk execution capabilities for running multiple scripts in sequence.

## Glossary

- **Extension**: The Comander VS Code extension
- **Script_Scanner**: The component that reads and parses package.json files
- **Script_List**: The user interface component displaying available npm scripts
- **Script_Executor**: The component responsible for executing npm scripts
- **Custom_Script**: A user-defined script that is not in package.json
- **Script_Parameters**: Additional command-line arguments appended to npm scripts
- **Bulk_Executor**: The component that executes multiple scripts in sequence
- **Workspace**: The VS Code workspace containing Node.js projects
- **Package_File**: The package.json file containing npm scripts

## Requirements

### Requirement 1: Scan and Display Package.json Scripts

**User Story:** As a developer, I want to see all available npm scripts from my package.json file, so that I can quickly discover what scripts are available in my project.

#### Acceptance Criteria

1. WHEN the Extension is activated in a Workspace, THE Script_Scanner SHALL search for Package_Files in the Workspace root and all subdirectories excluding node_modules directories
2. WHEN the Script_Scanner successfully extracts scripts from a Package_File, THE Script_List SHALL display the scripts in a sidebar view with each script name and its corresponding command
3. WHEN the Package_File is modified, THE Script_Scanner SHALL re-scan the Package_File within 500 milliseconds and update the Script_List
4. IF the Package_File contains syntax errors, THEN THE Script_Scanner SHALL display an error message indicating the parsing failure with the file path
5. WHEN multiple Package_Files exist in the Workspace, THE Script_Scanner SHALL scan all Package_Files and group scripts by their project location using relative paths from the Workspace root
6. IF a Package_File contains an empty scripts section, THEN THE Script_List SHALL display a message indicating that no scripts are available for that project
7. IF a Package_File does not exist in the Workspace, THEN THE Script_List SHALL display a message indicating that no package.json files were found
8. WHEN a user opens a Workspace, THE Extension SHALL activate and trigger the Script_Scanner to scan for Package_Files

### Requirement 2: Execute Scripts with Buttons

**User Story:** As a developer, I want to execute npm scripts by clicking buttons next to them, so that I can run scripts without typing commands manually.

#### Acceptance Criteria

1. THE Script_List SHALL display an execution button next to each script entry
2. WHEN a user clicks an execution button, THE Script_Executor SHALL execute the corresponding npm script in a new VS Code terminal
3. WHEN a script is executing, THE Script_Executor SHALL stream the script output to the VS Code terminal in real-time
4. WHEN a script completes execution, THE Script_Executor SHALL display the exit code in the terminal
5. WHILE a script is executing, THE Extension SHALL disable the execution button for that script until execution completes or is terminated
6. IF a script execution fails with a non-zero exit code, THEN THE Script_Executor SHALL display an error notification with the script name and exit code
7. IF npm is not available in the system PATH, THEN THE Script_Executor SHALL display an error message indicating that npm is not installed or not accessible
8. WHEN multiple scripts are executed concurrently, THE Script_Executor SHALL create a separate terminal instance for each script execution

### Requirement 3: Handle Script Parameters

**User Story:** As a developer, I want to add additional arguments to npm scripts when executing them, so that I can customize script behavior without modifying package.json.

#### Acceptance Criteria

1. WHEN a user clicks an execution button for a script, THE Extension SHALL display an input field for Script_Parameters as a VS Code input box with placeholder text "Additional arguments (optional)"
2. WHEN a user provides Script_Parameters in the input field, THE Script_Executor SHALL pass the parameters to the npm run command
3. WHEN the Script_Executor passes Script_Parameters, THE Script_Executor SHALL append the parameters after a double-dash separator (--) following the npm script name
4. WHEN a user executes a script with Script_Parameters, THE Extension SHALL save the Script_Parameters in workspace settings associated with that script name and project path
5. IF the Extension fails to save Script_Parameters to workspace settings, THEN THE Extension SHALL display a warning notification and proceed with script execution
6. WHEN a user executes a previously parameterized script, THE Extension SHALL retrieve the saved Script_Parameters from workspace settings and pre-fill the input field
7. IF the Extension fails to retrieve saved Script_Parameters from workspace settings, THEN THE Extension SHALL display an empty input field and log the error
8. WHEN a user modifies Script_Parameters in the input field and executes the script, THE Extension SHALL update the stored Script_Parameters for that script in workspace settings
9. WHEN a user provides empty Script_Parameters for a previously parameterized script, THE Extension SHALL execute the script without appending parameters and remove the saved parameters from workspace settings
10. WHEN a user clears the Script_Parameters input field and confirms execution, THE Extension SHALL execute the script without parameters

### Requirement 4: Add Custom Scripts

**User Story:** As a developer, I want to create custom scripts that are not in package.json, so that I can define project-specific commands for my workflow.

#### Acceptance Criteria

1. THE Extension SHALL provide an interface to add Custom_Scripts
2. WHEN a user adds a Custom_Script, THE Extension SHALL prompt for a script name with maximum length of 100 characters and a command with maximum length of 500 characters
3. IF a Custom_Script name or command contains only whitespace or is empty, THEN THE Extension SHALL reject the input and display an error message indicating that the field cannot be empty
4. WHEN a Custom_Script is created, THE Script_List SHALL display the Custom_Script alongside package.json scripts
5. THE Extension SHALL persist Custom_Scripts in workspace settings
6. WHEN the Workspace is reopened, THE Extension SHALL load and display previously created Custom_Scripts
7. IF a Custom_Script name is not unique within the project scope, THEN THE Extension SHALL reject the Custom_Script and display an error message indicating that the name already exists
8. WHEN a user cancels the Custom_Script creation prompt, THE Extension SHALL not create a Custom_Script and SHALL not modify the Script_List
9. THE Extension SHALL support a maximum of 50 Custom_Scripts per workspace

### Requirement 5: Manage Custom Scripts

**User Story:** As a developer, I want to delete, rename, and edit custom scripts, so that I can maintain my custom script library.

#### Acceptance Criteria

1. THE Script_List SHALL display edit and delete buttons next to each Custom_Script
2. WHEN a user clicks the delete button for a Custom_Script, THE Extension SHALL prompt for confirmation before deletion
3. WHEN a user confirms deletion, THE Extension SHALL remove the Custom_Script from the Script_List and workspace settings
4. WHEN a user clicks the edit button, THE Extension SHALL display an interface to modify the Custom_Script name with maximum length of 100 characters and command with maximum length of 500 characters
5. WHEN a user saves edited Custom_Script changes, THE Extension SHALL update the Custom_Script in workspace settings
6. IF a user attempts to save a Custom_Script name that is empty or contains only whitespace, THEN THE Extension SHALL reject the change and display an error message indicating that the name cannot be empty
7. IF a user attempts to save a Custom_Script name that exceeds 100 characters, THEN THE Extension SHALL reject the change and display an error message indicating the maximum length
8. IF a user attempts to save a Custom_Script name that already exists, THEN THE Extension SHALL reject the change and display an error message indicating that the name already exists
9. IF a user attempts to save a Custom_Script command that is empty or contains only whitespace, THEN THE Extension SHALL reject the change and display an error message indicating that the command cannot be empty
10. WHEN a user cancels the Custom_Script edit prompt, THE Extension SHALL not modify the Custom_Script
11. THE Extension SHALL preserve saved Script_Parameters when a Custom_Script is renamed

### Requirement 6: Bulk Script Execution

**User Story:** As a developer, I want to select multiple scripts and execute them in a specific order, so that I can automate complex workflows that require sequential script execution.

#### Acceptance Criteria

1. THE Extension SHALL provide a bulk execution interface where users can select between 2 and 100 scripts
2. THE Extension SHALL provide a bulk execution mode toggle button in the Script_List header
3. WHEN bulk execution mode is enabled, THE Script_List SHALL display checkboxes next to each script for selection
4. WHEN a user selects multiple scripts, THE Bulk_Executor SHALL allow the user to specify execution order using drag-and-drop reordering or up/down arrow buttons
5. WHEN a user clicks a "Start Bulk Execution" button, THE Bulk_Executor SHALL execute the selected scripts sequentially in the specified order
6. WHEN a script in the bulk execution sequence returns a non-zero exit code, THE Bulk_Executor SHALL halt execution and display an error notification indicating which script failed with the exit code
7. WHEN a script in the bulk execution sequence exceeds 300 seconds execution time, THE Bulk_Executor SHALL halt execution and display a timeout error notification
8. WHEN all scripts in the bulk execution sequence complete with zero exit codes, THE Bulk_Executor SHALL display a success notification with the total execution time and number of scripts executed
9. THE Bulk_Executor SHALL provide a "Save Sequence" button to save bulk execution sequences with a name between 1 and 100 characters for reuse
10. WHEN a user saves a bulk execution sequence, THE Extension SHALL persist the sequence name, script identifiers, and execution order in workspace settings
11. WHEN a user selects a saved bulk execution sequence from a dropdown menu, THE Bulk_Executor SHALL restore the script selection and execution order
12. IF a saved bulk execution sequence references scripts that no longer exist, THEN THE Extension SHALL display a warning notification listing the missing scripts and allow the user to proceed with available scripts or cancel

### Requirement 7: Visual Studio Code Integration

**User Story:** As a developer, I want the extension to integrate seamlessly with VS Code, so that I can access script management features within my familiar development environment.

#### Acceptance Criteria

1. THE Extension SHALL register a custom view in the VS Code Explorer sidebar that displays the script list with script names and last execution timestamps
2. THE Extension SHALL register a keyboard shortcut Ctrl+Shift+R (Cmd+Shift+R on macOS) to execute the most recently run script
3. THE Extension SHALL register a keyboard shortcut Ctrl+Shift+P followed by "Comander" (Cmd+Shift+P on macOS) to open the Comander view
4. IF a keyboard shortcut conflicts with existing bindings, THEN THE Extension SHALL log a warning and allow VS Code's default conflict resolution
5. WHEN a script execution completes with exit code 0, THEN THE Extension SHALL display a success notification with the script name
6. WHEN a script execution fails with a non-zero exit code, THEN THE Extension SHALL display an error notification with the script name and exit code
7. THE Extension SHALL apply VS Code theme colors for text, backgrounds, and icons in the Script_List interface
8. WHILE a script is executing, THE Extension SHALL display a progress indicator in the VS Code status bar showing the executing script name
