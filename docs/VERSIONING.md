# Version Management

This document describes how to manage static asset versions in the PitchSignal.

## Overview

The PitchSignal uses a date-based versioning system (`YYYYMMDD`) for static assets. This ensures cache busting when deploying new versions.

### Files Managed

1. **`version.json`** - Central version configuration
2. **`templates/index.html`** - Script and stylesheet versions
3. **`static/sw.js`** - Service Worker cache name
4. **`static/js/app.js`** - Service Worker registration

## Usage

### View Current Version

```bash
node scripts/update-versions.js
```

### Increment Version (by 1 day)

```bash
node scripts/update-versions.js --bump
```

### Set Specific Version

```bash
node scripts/update-versions.js --set 20260626
```

## Version Format

- Format: `YYYYMMDD`
- Example: `20260626` (June 26, 2026)

## Deployment Workflow

1. Make your code changes
2. Run the version bump script:
   ```bash
   node scripts/update-versions.js --bump
   ```
3. Commit the changes:
   ```bash
   git add -A
   git commit -m "chore: bump version to $(cat version.json | grep version | cut -d'"' -f4)"
   ```
4. Deploy as usual

## How It Works

1. **Cache Busting**: Each version number is appended as a query parameter (`?v=YYYYMMDD`) to static assets
2. **Service Worker**: The cache name includes the version (`worldcup-vYYYYMMDD`)
3. **Automatic Updates**: When the version changes, browsers will fetch new assets instead of using cached versions

## Manual Updates (Not Recommended)

If you need to manually update versions:

1. Edit `version.json` with the new version
2. Update all `?v=` parameters in `templates/index.html`
3. Update `CACHE_NAME` in `static/sw.js`
4. Update Service Worker registration in `static/js/app.js`

## Troubleshooting

### Browser Not Loading New Assets

1. Check if the version was updated in `version.json`
2. Verify the HTML file has the new version numbers
3. Clear browser cache or use hard refresh (Ctrl+Shift+R)
4. Check Service Worker cache in DevTools > Application > Service Workers

### Service Worker Not Updating

1. Check if `CACHE_NAME` in `sw.js` matches the version in `version.json`
2. Unregister the Service Worker in DevTools > Application > Service Workers
3. Reload the page

## Notes

- The version management script does not modify `package.json` or other configuration files
- The script is designed for a no-build tool environment
- All changes are made in-place to ensure consistency