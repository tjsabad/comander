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

## License

MIT
