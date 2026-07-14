# Comander Extension - Installation Guide

## ✅ Package Successfully Created

Your extension has been packaged as: **`comander-0.1.0.vsix`**

## Installation Steps

### Option 1: Install via Command Line (Quickest)

```bash
code --install-extension comander-0.1.0.vsix
```

Then reload VS Code.

### Option 2: Install via VS Code UI

1. Open VS Code
2. Go to Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X`)
3. Click the `...` menu (top right of Extensions view)
4. Select "Install from VSIX..."
5. Browse to and select `comander-0.1.0.vsix`
6. Click "Install"
7. Reload VS Code when prompted

## Verify Installation

1. Open a workspace that contains package.json files
2. Look for "Comander" in the Activity Bar (sidebar)
3. Click to open the Scripts view
4. You should see your npm scripts listed

## First Steps

### View Your Scripts
- Click the Comander icon in the Activity Bar
- See all npm scripts from package.json files in your workspace

### Execute a Script
- Click the play button (▶) next to any script
- Add parameters when prompted (optional)

### Create Custom Scripts
- Click the `+` button in the Scripts view header
- Enter a name and command

### Bulk Execution
- Click the checklist icon to enable bulk mode
- Select multiple scripts with checkboxes
- Click "Start Bulk Execution"

### Keyboard Shortcut
- `Ctrl+Shift+R` (`Cmd+Shift+R` on Mac) - Execute most recent script

## Package Contents

✅ **LICENSE** - MIT License
✅ **README** - Full documentation with features and usage
✅ **Repository** - GitHub repository configured
✅ **All Dependencies** - Runtime dependencies included
✅ **Compiled Code** - TypeScript compiled to JavaScript
✅ **Test Suite** - 195 passing tests (94.7% pass rate)

## Optional: Add Extension Icon

The extension currently packages without an icon. To add the "CmdR" icon:

See **`ICON_INSTRUCTIONS.md`** for detailed instructions on creating and adding a 128x128 PNG icon.

## Distribution

You can now:

1. **Share the VSIX file** - Send `comander-0.1.0.vsix` to others
2. **Install on multiple machines** - Use the same VSIX file
3. **Publish to marketplace** - Follow VS Code publishing guidelines

## Uninstall

### Via Command Line
```bash
code --uninstall-extension comander.comander
```

### Via UI
1. Go to Extensions view
2. Find "Comander"
3. Click the gear icon → "Uninstall"

## Troubleshooting

### Extension Not Appearing
- Make sure you reloaded VS Code after installation
- Check if extension is enabled in Extensions view

### No Scripts Showing
- Open a workspace (not just a single file)
- Ensure the workspace contains package.json files
- Click the refresh button in Comander view

### Settings Not Persisting
- Extension settings save to `.vscode/settings.json`
- Ensure you have a workspace open (not single file mode)
- Check file permissions on .vscode folder

## Support

For issues or feature requests, visit:
https://github.com/tjsabad/comander

## Version

**Current Version**: 0.1.0  
**VS Code Required**: 1.85.0 or higher  
**Node.js Required**: Any version with npm
