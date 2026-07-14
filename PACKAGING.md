# Packaging Guide for Comander VS Code Extension

## Package Requirements ✅

All requirements for packaging have been completed:

### 1. LICENSE ✅
- **File**: `LICENSE`
- **Type**: MIT License
- **Status**: Created and added to repository

### 2. README with Installation Instructions ✅
- **File**: `README.md`
- **Status**: Updated with comprehensive packaging and installation instructions
- **Includes**:
  - Installation from VSIX package
  - Installation from source
  - Packaging for distribution
  - Development setup

### 3. Icon ✅
- **File**: `resources/comander-icon.svg`
- **Display**: "CmdR" text on blue background
- **Format**: SVG (128x128)
- **Status**: Created and referenced in package.json

### 4. Repository Field ✅
- **package.json**: `repository` field added
- **URL**: https://github.com/tjsabad/comander.git
- **Status**: Configured

## Packaging Commands

### Create VSIX Package

```bash
# Ensure dependencies are installed
npm install

# Package the extension
npx vsce package
```

This will create: `comander-0.1.0.vsix`

### Install the Extension

```bash
# Install from VSIX file
code --install-extension comander-0.1.0.vsix
```

### Publish to VS Code Marketplace (Optional)

```bash
# Create publisher account first at https://marketplace.visualstudio.com/
# Get a Personal Access Token from Azure DevOps

# Login to publisher account
npx vsce login <publisher-name>

# Publish the extension
npx vsce publish
```

## Package Contents

The VSIX package includes:
- Compiled TypeScript code (out/ directory)
- Extension manifest (package.json)
- README and LICENSE
- Icon (resources/comander-icon.svg)
- All runtime dependencies

## Verification

Before packaging, verify:

```bash
# 1. TypeScript compiles without errors
npm run compile

# 2. Tests pass
npm test

# 3. No linting errors
npm run lint

# 4. Package can be created
npx vsce package
```

## Installation Testing

After creating the package:

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` or `Cmd+Shift+X`)
3. Click `...` menu → "Install from VSIX..."
4. Select `comander-0.1.0.vsix`
5. Reload VS Code
6. Open a workspace with package.json files
7. Look for "CmdR" (Comander) icon in Activity Bar

## Icon Details

The extension icon displays "CmdR" which:
- Represents **Cmd**R - Command Runner
- Uses the Activity Bar icon format (128x128 SVG)
- Blue background (#0078d4) for VS Code theme consistency
- Bold white text for readability
- Subtle command line accent for context

## Notes

- The extension requires VS Code 1.85.0 or higher
- Node.js and npm must be installed on the system
- The extension activates on startup for all workspaces
- Settings are persisted in workspace `.vscode/settings.json`
