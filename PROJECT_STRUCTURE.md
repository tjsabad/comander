# Comander VS Code Extension - Project Structure

## Overview

This document describes the project structure for the Comander VS Code extension.

## Directory Structure

```
comander/
├── .kiro/                      # Kiro spec files
│   └── specs/
│       └── comander-extension/
│           ├── requirements.md
│           ├── design.md
│           └── tasks.md
├── resources/                  # Extension resources
│   └── comander-icon.svg      # Extension icon
├── src/                        # Source code
│   ├── test/                  # Test files
│   │   ├── suite/            # Test suites
│   │   │   ├── index.ts      # Test suite configuration
│   │   │   └── extension.test.ts  # Basic extension tests
│   │   ├── runTest.ts        # Test runner
│   │   └── testUtils.ts      # Shared test utilities
│   ├── bulkExecutor.ts       # Bulk script execution
│   ├── customScriptManager.ts # Custom script management
│   ├── extension.ts          # Extension entry point
│   ├── scriptExecutor.ts     # Script execution
│   ├── scriptListProvider.ts # Tree view provider
│   ├── scriptScanner.ts      # Package.json scanner
│   ├── settingsManager.ts    # Settings persistence
│   ├── types.ts              # TypeScript interfaces
│   └── utils.ts              # Utility functions
├── out/                       # Compiled JavaScript (generated)
├── node_modules/              # Dependencies (generated)
├── .eslintrc.json            # ESLint configuration
├── .gitignore                # Git ignore rules
├── .vscodeignore             # VS Code extension ignore rules
├── CHANGELOG.md              # Version history
├── package.json              # Extension manifest and dependencies
├── package-lock.json         # Locked dependencies
├── PROJECT_STRUCTURE.md      # This file
├── README.md                 # Extension documentation
└── tsconfig.json             # TypeScript configuration
```

## Core Components

### 1. SettingsManager (`src/settingsManager.ts`)
- Handles persistence of extension settings
- Manages script parameters, custom scripts, and bulk sequences
- Uses VS Code workspace configuration API

### 2. ScriptScanner (`src/scriptScanner.ts`)
- Discovers package.json files in workspace
- Parses npm scripts from package.json
- Watches for file changes and updates script list

### 3. CustomScriptManager (`src/customScriptManager.ts`)
- CRUD operations for custom scripts
- Validates script names and commands
- Enforces limits (50 scripts max, character limits)

### 4. ScriptExecutor (`src/scriptExecutor.ts`)
- Executes scripts in VS Code terminals
- Tracks execution state
- Captures exit codes and output

### 5. ScriptListProvider (`src/scriptListProvider.ts`)
- Implements VS Code TreeDataProvider
- Renders hierarchical script view
- Handles bulk mode and selection

### 6. BulkExecutor (`src/bulkExecutor.ts`)
- Sequential execution of multiple scripts
- Timeout and failure handling
- Sequence save/load operations

## Data Models (`src/types.ts`)

All TypeScript interfaces and types are defined in `types.ts`:
- ScriptCollection, ProjectScripts, ParseError
- ScriptItem
- CustomScript, CustomScriptSerialized
- ExecutionResult
- BulkResult, BulkSequence, BulkSequenceSerialized
- Result<T> type for error handling
- Component interfaces (IScriptScanner, IScriptExecutor, etc.)

## Configuration Files

### package.json
- Extension manifest with metadata
- Commands, views, and keybindings
- Configuration schema for settings
- Dependencies and scripts

### tsconfig.json
- TypeScript compilation options
- Target: ES2020
- Module: commonjs
- Strict mode enabled

### .eslintrc.json
- ESLint rules for TypeScript
- TypeScript-specific linting rules
- Code style enforcement

## Testing

### Test Framework
- Mocha: Test runner
- Chai: Assertions
- Sinon: Mocking
- fast-check: Property-based testing

### Test Files
- `src/test/runTest.ts`: Test runner configuration
- `src/test/suite/index.ts`: Mocha configuration
- `src/test/suite/extension.test.ts`: Basic extension tests
- `src/test/testUtils.ts`: Shared test utilities

## Build Process

### Compile
```bash
npm run compile
```
Compiles TypeScript to JavaScript in `out/` directory.

### Watch Mode
```bash
npm run watch
```
Watches for file changes and recompiles automatically.

### Lint
```bash
npm run lint
```
Runs ESLint on source files.

### Test
```bash
npm test
```
Runs the test suite in VS Code extension host.

## Development Status

### ✅ Task 1: Project Structure (COMPLETED)
- VS Code extension project structure created
- TypeScript interfaces defined for all data models
- Build configuration set up (tsconfig.json)
- Testing framework configured (Mocha, Chai, Sinon, fast-check)
- Extension manifest configured with commands and views
- Placeholder files created for all components

### 🔄 Next Tasks
- Task 2: Implement Settings Manager
- Task 3: Implement Script Scanner
- Task 4: Implement Custom Script Manager
- Task 5: Implement Script Executor
- And so on...

## Notes

- All component files have placeholder implementations with TODO comments
- ESLint warnings for unused parameters are disabled in placeholder files
- The extension follows VS Code Extension API patterns
- All interfaces are defined upfront to support test-driven development
