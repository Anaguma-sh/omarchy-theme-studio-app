# Release an AppImage

1. Update `package.json`, the lockfile and version labels in the interface and README.
2. Run `npm ci`, `npm test`, `npm run check`, and the Electron smoke test in a desktop session.
3. Run `npm run dist` on Linux x86_64. Run the resulting AppImage and check wallpaper selection, project save/open and export. Use a disposable Omarchy user/session to check applying and undo before expanding platform support.
4. Publish the tested build with the GitHub CLI commands below.

Optional automation: copy `docs/github-actions.yml` to `.github/workflows/build.yml` using a GitHub credential with the `workflow` scope. The current publishing credential cannot create workflows, so the template is provided without enabling it. Once installed, it builds test artifacts for pushes and pull requests and publishes an AppImage with a SHA-256 checksum for version tags.

The GitHub workflow needs no API-provider secrets. Release write permission is scoped to its release job. Never add API keys or personal wallpapers to a release.

To publish an already-tested local build with GitHub CLI:

```bash
sha256sum dist/*.AppImage > dist/SHA256SUMS
# Run from the repository after pushing its version tag.
gh release create v0.3.0 dist/*.AppImage dist/SHA256SUMS --title 'Omarchy Theme Studio 0.3.0' --notes-file docs/RELEASE-NOTES.md
```

Production dependencies are limited to `jsonc-parser`. Run `npm audit --omit=dev` for the shipped dependency tree. Electron-builder also pulls development-only Windows/macOS packaging dependencies; review those separately when updating the build toolchain.

## Update compatibility

Every stable release must include its versioned x86_64 AppImage and a `SHA256SUMS` file with a line containing that asset’s basename. The built-in updater reads the public latest-release API and only selects assets in this repository’s version-tag download path. Publish stable releases only after testing. No updater-specific manifest is required by this app’s full-download updater.

Test the AppImage CLI with `DISPLAY` and `WAYLAND_DISPLAY` unset. Check `--version`, generation and export, then install under a temporary HOME and run the generated wrapper. Test update checks and a real release download in an isolated installation before declaring update support verified.
