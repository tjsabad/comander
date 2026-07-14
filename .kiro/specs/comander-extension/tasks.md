# Implementation Plan: Comander VS Code Extension

## Overview

This implementation plan breaks down the Comander VS Code extension into discrete coding tasks. The extension will be built using TypeScript and the VS Code Extension API, following the architecture defined in the design document. The implementation follows a layered approach: core infrastructure and data models first, then individual components, followed by integration and testing.

## Tasks

- [x] 1. Set up project structure and core infrastructure
  - Create VS Code extension project structure with TypeScript
  - Configure package.json with extension metadata, activation events, and commands
  - Define TypeScript interfaces for all data models (ScriptCollection, ProjectScripts, ScriptItem, CustomScript, BulkSequence, etc.)
  - Set up build configuration (tsconfig.json, webpack if needed)
  - Configure extension manifest with view containers, views, and command palette entries
  - Set up testing framework (Mocha, Chai, Sinon) and test scripts
  - _Requirements: 7.1, 7.3_

- [x] 2. Implement Settings Manager
  - [x] 2.1 Create SettingsManager class with methods for reading and writing workspace settings
    - Implement getParameters, setParameters, removeParameters methods
    - Implement getCustomScripts, setCustomScripts methods
    - Implement getBulkSequences, setBulkSequences methods
    - Add error handling for read/write failures with graceful fallback
    - _Requirements: 3.4, 3.6, 3.8, 3.9, 4.5, 5.5, 6.10_

  - [x] 2.2 Write property test for Settings Manager
    - **Property 7: Parameter persistence round-trip**
    - **Validates: Requirements 3.4, 3.6, 3.8, 3.9**
    - Test that saving and retrieving parameters returns exact same values
    - Test that clearing parameters results in null retrieval

  - [x] 2.3 Write unit tests for Settings Manager
    - Test read/write operations for all settings types
    - Test error handling for corrupted settings
    - Test fallback to default values on load failure
    - _Requirements: 3.4, 3.5, 3.7, 4.5, 5.5, 6.10_

- [x] 3. Implement Script Scanner
  - [x] 3.1 Create ScriptScanner class with workspace scanning logic
    - Implement scan method using vscode.workspace.findFiles with node_modules exclusion
    - Implement parsePackageJson method with JSON parsing and error handling
    - Implement workspace file watcher with 500ms debounce using FileSystemWatcher
    - Group scripts by relative project path from workspace root
    - Handle multiple package.json files and empty scripts sections
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [x] 3.2 Write property test for Script Scanner
    - **Property 1: Workspace scanning completeness**
    - **Validates: Requirements 1.1**
    - Test that all package.json files are discovered regardless of depth

  - [x] 3.3 Write property test for parse error handling
    - **Property 2: Parse error handling**
    - **Validates: Requirements 1.4**
    - Test that invalid JSON produces ParseError without crashing

  - [x] 3.4 Write property test for multi-project grouping
    - **Property 3: Multi-project grouping**
    - **Validates: Requirements 1.5**
    - Test that scripts are correctly grouped by project path

  - [x] 3.5 Write unit tests for Script Scanner
    - Test package.json discovery with various workspace structures
    - Test file watch event handling and debounce behavior
    - Test error scenarios (missing files, permission errors)
    - _Requirements: 1.1, 1.3, 1.4, 1.5_

- [x] 4. Implement Custom Script Manager
  - [x] 4.1 Create CustomScriptManager class with CRUD operations
    - Implement create method with validation (name uniqueness, length limits, non-empty checks)
    - Implement update method with same validation rules
    - Implement delete method with settings persistence
    - Implement list and get methods
    - Generate UUIDs for custom script IDs
    - Enforce 50 scripts per workspace limit
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.7, 4.8, 4.9, 5.1, 5.2, 5.4, 5.6, 5.7, 5.8, 5.9_

  - [x] 4.2 Write property test for input validation
    - **Property 8: Input validation**
    - **Validates: Requirements 4.2, 4.3, 4.7, 5.6, 5.7, 5.8, 5.9**
    - Test validation for name and command length limits
    - Test validation for empty/whitespace strings
    - Test validation for duplicate names

  - [x] 4.3 Write property test for CRUD persistence
    - **Property 9: Custom script CRUD persistence**
    - **Validates: Requirements 4.5, 5.3, 5.5**
    - Test create-retrieve round-trip
    - Test update-retrieve round-trip
    - Test delete operation

  - [x] 4.4 Write property test for parameter preservation on rename
    - **Property 10: Parameter preservation on rename**
    - **Validates: Requirements 5.11**
    - Test that renaming preserves parameter associations

  - [x] 4.5 Write unit tests for Custom Script Manager
    - Test CRUD operations with various input combinations
    - Test validation error messages
    - Test uniqueness checking logic
    - Test 50 script limit enforcement
    - _Requirements: 4.1, 4.2, 4.3, 4.7, 4.8, 4.9, 5.6, 5.7, 5.8, 5.9_

- [x] 5. Implement Script Executor
  - [x] 5.1 Create ScriptExecutor class with terminal-based execution
    - Implement execute method that creates VS Code terminals
    - Implement command construction with format: `npm run <scriptName> -- <parameters>`
    - Track active executions in a Map<scriptId, Terminal>
    - Implement isExecuting and terminate methods
    - Capture exit codes using terminal.exitStatus when available
    - Check npm availability before first execution
    - Store most recent script for keyboard shortcut
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.7, 2.8, 3.2, 3.3_

  - [x] 5.2 Write property test for execution state tracking
    - **Property 4: Execution state tracking**
    - **Validates: Requirements 2.5**
    - Test that execution buttons are disabled while executing

  - [x] 5.3 Write property test for concurrent terminal isolation
    - **Property 5: Concurrent terminal isolation**
    - **Validates: Requirements 2.8**
    - Test that concurrent executions use unique terminals

  - [x] 5.4 Write property test for command construction
    - **Property 6: Command construction format**
    - **Validates: Requirements 3.2, 3.3**
    - Test command format with and without parameters

  - [x] 5.5 Write unit tests for Script Executor
    - Test terminal creation and command execution
    - Test execution state tracking
    - Test npm availability check
    - Test error handling for terminal creation failures
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement Script List View Provider
  - [x] 7.1 Create ScriptListProvider class implementing TreeDataProvider
    - Implement getChildren to render hierarchical tree (projects as parent nodes, scripts as children)
    - Implement getTreeItem with proper icons, buttons, and contextValue
    - Implement refresh method to update tree view
    - Add execution, edit, and delete inline buttons using TreeItem command property
    - Display last execution timestamp for each script
    - Collapse project nodes by default if multiple projects exist
    - Apply VS Code theme icons ($(play), $(edit), $(trash))
    - _Requirements: 1.2, 1.5, 2.1, 5.1, 7.1, 7.7_

  - [x] 7.2 Implement bulk execution mode toggle
    - Add toggle button in tree view header
    - Enable checkbox display when bulk mode is active
    - Track selected scripts in a Set
    - _Requirements: 6.2, 6.3_

  - [x] 7.3 Write unit tests for Script List View Provider
    - Test tree item generation for various script collections
    - Test hierarchical rendering with multiple projects
    - Test bulk mode toggle behavior
    - Test button visibility based on script type
    - _Requirements: 1.2, 1.5, 2.1, 6.2, 6.3_

- [x] 8. Implement Bulk Executor
  - [x] 8.1 Create BulkExecutor class with sequential execution logic
    - Implement executeBulk method that executes scripts sequentially using ScriptExecutor
    - Implement 300-second timeout per script using Promise.race
    - Halt execution on first non-zero exit code
    - Track execution progress and generate BulkResult
    - _Requirements: 6.5, 6.6, 6.7, 6.8_

  - [x] 8.2 Implement bulk sequence management
    - Implement saveSequence method with validation (name length 1-100 chars, 2-100 scripts)
    - Implement loadSequence and listSequences methods
    - Implement deleteSequence method
    - Validate sequence references and detect missing scripts
    - Persist sequences using SettingsManager
    - _Requirements: 6.9, 6.10, 6.11, 6.12_

  - [x] 8.3 Write property test for bulk execution order
    - **Property 11: Bulk execution order**
    - **Validates: Requirements 6.5**
    - Test that scripts execute in specified order

  - [x] 8.4 Write property test for failure halting
    - **Property 12: Bulk execution failure halting**
    - **Validates: Requirements 6.6**
    - Test that execution halts on non-zero exit code

  - [x] 8.5 Write property test for sequence persistence
    - **Property 13: Bulk sequence persistence round-trip**
    - **Validates: Requirements 6.9, 6.10, 6.11**
    - Test save-load round-trip for sequences

  - [x] 8.6 Write property test for missing script detection
    - **Property 14: Missing script detection in sequences**
    - **Validates: Requirements 6.12**
    - Test warning generation for missing scripts

  - [x] 8.7 Write unit tests for Bulk Executor
    - Test sequential execution logic
    - Test timeout handling
    - Test failure halting behavior
    - Test sequence save/load operations
    - _Requirements: 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12_

- [x] 9. Implement extension activation and command registration
  - [x] 9.1 Create extension activation logic in extension.ts
    - Implement activate function that initializes all components
    - Register ScriptListProvider with tree view
    - Register all commands (execute, add custom script, edit, delete, bulk execute, etc.)
    - Initialize ScriptScanner and start file watching
    - Load custom scripts and bulk sequences from settings on activation
    - _Requirements: 1.8, 4.1, 4.6, 5.1, 6.1, 6.2, 7.1_

  - [x] 9.2 Implement keyboard shortcut handlers
    - Register Ctrl+Shift+R (Cmd+Shift+R on macOS) for most recent script execution
    - Retrieve most recent script from ScriptExecutor and execute
    - Handle case where no script has been executed yet
    - _Requirements: 7.2, 7.4_

  - [x] 9.3 Implement parameter input prompts
    - Show input box when executing scripts
    - Pre-fill with saved parameters from SettingsManager
    - Save new parameters after execution
    - Handle empty input to clear saved parameters
    - _Requirements: 3.1, 3.4, 3.6, 3.8, 3.9, 3.10_

  - [x] 9.4 Implement custom script creation/edit UI
    - Create multi-step input prompts for name and command
    - Show validation errors for invalid inputs
    - Handle cancellation at any step
    - _Requirements: 4.1, 4.2, 4.3, 4.8, 5.4, 5.6, 5.7, 5.8, 5.9, 5.10_

  - [x] 9.5 Implement bulk execution UI
    - Create bulk sequence selection and ordering interface
    - Implement drag-and-drop or arrow button reordering
    - Show "Start Bulk Execution" button when scripts are selected
    - Implement "Save Sequence" prompt with name input
    - Create dropdown menu for loading saved sequences
    - _Requirements: 6.1, 6.4, 6.5, 6.9, 6.11_

  - [x] 9.6 Write integration tests for extension activation
    - Test extension activation in test workspace
    - Test command registration
    - Test tree view rendering
    - Test file watching integration
    - _Requirements: 1.8, 7.1, 7.3_

- [x] 10. Implement notification and status bar integration
  - [x] 10.1 Add execution result notifications
    - Show success notification on exit code 0 with script name
    - Show error notification on non-zero exit code with script name and exit code
    - Show bulk execution success notification with total time and script count
    - Show timeout error notification for bulk execution
    - Show failure notification for bulk execution with failing script details
    - _Requirements: 2.6, 6.6, 6.7, 6.8, 7.5, 7.6_

  - [x] 10.2 Add status bar progress indicator
    - Display executing script name in status bar while running
    - Clear status bar indicator on completion
    - _Requirements: 7.8_

  - [x] 10.3 Add error notifications for validation failures
    - Show validation error messages for custom script creation/editing
    - Show warning for settings persistence failures
    - Show error for npm availability issues
    - Show warning for missing scripts in bulk sequences
    - _Requirements: 2.7, 3.5, 4.3, 4.7, 5.6, 5.7, 5.8, 5.9, 6.12_

  - [x] 10.4 Write property test for execution notifications
    - **Property 15: Execution result notifications**
    - **Validates: Requirements 2.6, 6.8, 7.5, 7.6**
    - Test notification display for various execution results

  - [x] 10.5 Write unit tests for notifications
    - Test notification content for various scenarios
    - Test status bar updates during execution
    - _Requirements: 2.6, 7.5, 7.6, 7.8_

- [x] 11. Checkpoint - Integration verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Final integration and polish
  - [x] 12.1 Wire all components together in extension.ts
    - Connect ScriptScanner to ScriptListProvider refresh
    - Connect ScriptListProvider buttons to appropriate handlers
    - Connect keyboard shortcuts to ScriptExecutor
    - Ensure all error handling flows to user notifications
    - _Requirements: 1.2, 1.3, 2.1, 7.2_

  - [x] 12.2 Apply VS Code theming
    - Use VS Code theme colors for all UI elements
    - Test with light and dark themes
    - Apply theme icons consistently
    - _Requirements: 7.7_

  - [x] 12.3 Implement settings validation and repair on activation
    - Validate settings structure on extension activation
    - Filter out corrupted entries
    - Reset to defaults if settings are unrecoverable
    - Log all recovery actions
    - _Requirements: 3.7, 4.5, 5.5, 6.10_

  - [x] 12.4 Write integration tests for end-to-end workflows
    - Test complete workflow: scan → display → execute → save parameters
    - Test custom script workflow: create → edit → execute → delete
    - Test bulk execution workflow: select → order → execute → save sequence
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.4, 4.1, 5.1, 6.1, 6.5_

- [x] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property-based tests use fast-check with minimum 100 iterations per test
- Unit and integration tests use Mocha, Chai, and Sinon
- All TypeScript interfaces are defined in step 1 and used throughout implementation
- Extension follows VS Code Extension API patterns (TreeDataProvider, FileSystemWatcher, Terminal API)
- Settings persistence uses vscode.workspace.getConfiguration() API
- File watching includes 500ms debounce to avoid excessive re-scans
- Keyboard shortcuts may conflict with existing bindings; conflicts are logged but not fatal
- Terminal exit codes may not be reliably available due to VS Code API limitations
- Custom scripts are limited to 50 per workspace to prevent performance issues
- Bulk execution timeout is 300 seconds per script
- All saved data (custom scripts, parameters, sequences) persists in .vscode/settings.json

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "3.3", "3.4", "3.5", "4.2", "4.3", "4.4", "4.5", "5.1"] },
    { "id": 3, "tasks": ["5.2", "5.3", "5.4", "5.5", "7.1"] },
    { "id": 4, "tasks": ["7.2", "7.3", "8.1"] },
    { "id": 5, "tasks": ["8.2", "8.3", "8.4", "8.5", "8.6", "8.7"] },
    { "id": 6, "tasks": ["9.1"] },
    { "id": 7, "tasks": ["9.2", "9.3", "9.4", "9.5", "9.6"] },
    { "id": 8, "tasks": ["10.1", "10.2", "10.3"] },
    { "id": 9, "tasks": ["10.4", "10.5", "12.1"] },
    { "id": 10, "tasks": ["12.2", "12.3", "12.4"] }
  ]
}
```
