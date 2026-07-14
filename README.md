# Comander - VS Code npm Script Manager

Comander is a Visual Studio Code extension that enhances the Node.js developer experience by providing an intuitive interface for discovering, managing, and executing npm scripts.

## Features

- **Automatic Script Discovery**: Scans all package.json files in your workspace
- **One-Click Execution**: Execute npm scripts with a single button click
- **Parameterized Execution**: Add arguments to scripts with persistent parameter storage
- **Custom Scripts**: Create and manage custom scripts outside of package.json
- **Bulk Execution**: Execute multiple scripts in sequence with custom ordering
- **Multi-Project Support**: Works seamlessly with monorepos and multi-project workspaces

## Requirements

- Visual Studio Code 1.85.0 or higher
- Node.js and npm installed on your system

## Extension Settings

This extension contributes the following settings:

- `comander.scriptParameters`: Saved parameters for scripts
- `comander.customScripts`: Custom user-defined scripts
- `comander.bulkSequences`: Saved bulk execution sequences

## Keyboard Shortcuts

- `Ctrl+Shift+R` (Mac: `Cmd+Shift+R`): Execute most recent script

## Installation

### From VSIX Package

1. Download the `.vsix` file from releases
2. Open VS Code
3. Go to Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X`)
4. Click the `...` menu at the top of the Extensions view
5. Select "Install from VSIX..."
6. Choose the downloaded `.vsix` file

### From Source

```bash
# Clone the repository
git clone https://github.com/comander/comander-vscode.git
cd comander-vscode

# Install dependencies
npm install

# Package the extension
npx vsce package

# Install the generated .vsix file
code --install-extension comander-0.1.0.vsix
```

## Development

### Setup

```bash
npm install
```

### Compile

```bash
npm run compile
```

### Watch Mode

```bash
npm run watch
```

### Run Tests

```bash
npm test
```

### Lint

```bash
npm run lint
```

## Packaging for Distribution

To create a `.vsix` package for distribution:

```bash
# Install vsce if not already installed
npm install -g @vscode/vsce

# Package the extension
npx vsce package
```

This will create a `comander-0.1.0.vsix` file that can be shared and installed.

### Requirements for Packaging

- All TypeScript files must compile without errors
- LICENSE file must be present (MIT license included)
- README.md with features and installation instructions
- Valid repository field in package.json

## License

MIT - See LICENSE file for details
