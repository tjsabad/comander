# Icon Creation Instructions

The extension currently packages without an icon. To add the "CmdR" icon:

## Quick Solution: Use an Online Tool

### Using Canva (Free)
1. Go to https://www.canva.com
2. Create Custom Size: 128x128 pixels
3. Add rectangle, fill with blue (#0078d4)
4. Add text "CmdR" in white, bold, centered
5. Download as PNG
6. Save to `resources/comander-icon.png`

### Using Photopea (Free, No Account)
1. Go to https://www.photopea.com
2. File → New → 128x128 pixels
3. Fill background with blue (#0078d4)
4. Add text layer "CmdR" (white, bold, Arial ~42px)
5. File → Export As → PNG
6. Save to `resources/comander-icon.png`

## Command Line Solutions

### If you have ImageMagick
```bash
cd resources
magick -size 128x128 xc:"#0078d4" \
  -gravity center \
  -pointsize 42 \
  -font Arial-Bold \
  -fill white \
  -annotate +0+0 "CmdR" \
  comander-icon.png
```

### If you have rsvg-convert
```bash
cd resources
# Install first: brew install librsvg
rsvg-convert -w 128 -h 128 comander-icon.svg -o comander-icon.png
```

## After Creating the Icon

1. Save the PNG as `resources/comander-icon.png`
2. Update `package.json` to add:
   ```json
   "icon": "resources/comander-icon.png",
   ```
3. Run `npx vsce package` to create the VSIX

## Icon Specifications

- **Size**: 128x128 pixels
- **Format**: PNG
- **Background**: Blue (#0078d4)
- **Text**: "CmdR" in white, bold
- **Font**: Arial or similar sans-serif
- **Text Size**: ~42px for good visibility

The icon represents **CmdR** = Command Runner
