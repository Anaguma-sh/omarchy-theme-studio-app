# Omarchy Theme Studio

A standalone Linux desktop app for designing and applying Omarchy themes. Start from wallpapers or an installed theme, compare three palettes, refine the colours, then export or apply. Guided and advanced modes share the same project.

## Download and run

Download **Omarchy-Theme-Studio-0.1.0-x86_64.AppImage** from [GitHub Releases](https://github.com/Anaguma-sh/omarchy-theme-studio-app/releases/latest).

In your file manager, allow the file to run as a program, then open it. Or use:

```bash
chmod +x Omarchy-Theme-Studio-0.1.0-x86_64.AppImage
./Omarchy-Theme-Studio-0.1.0-x86_64.AppImage
```

No Node.js, API key or account is needed to run the download. This release targets **x86_64 Omarchy desktops** with `colors.toml` theme templates. Older Omarchy releases and ARM machines are not tested. If FUSE is unavailable, try `./Omarchy-Theme-Studio-0.1.0-x86_64.AppImage --appimage-extract-and-run`. Do not run the app as root or disable its sandbox.

## What it does

- Extract a shared palette from up to eight local PNG, JPEG or WebP wallpapers.
- Start from an installed theme, compare three consistent previews, and edit normal and semantic colours.
- Check foreground, muted and selected text against a 4.5:1 contrast target. Applying is blocked when those checks fail.
- Save editable projects and export `.tar.gz` themes with `colors.toml`, wallpapers and install instructions.
- Install under a **new name**, apply with `omarchy theme set`, compare the staged palette and run `hyprctl configerrors`.
- Optionally install a generated colour theme in **VS Code** and **Cursor IDE**, preserving comments and unrelated settings. Reload those editors after applying. Cursor Agents is a separate surface and is not covered.
- Undo the last application or keep it. File backups persist in the app’s user-data directory. Later edits to editor settings block undo instead of being silently overwritten.

Omarchy generates desktop and terminal settings with its own installed templates and runs its normal app integrations and existing hooks. Studio does not add another sync hook. Extra editor syncing happens only when applying through Studio. Restarting applications and verifying their rendered appearance remain manual. The preview is illustrative; compositor transparency and app-specific overrides can alter the result.

Cloudroom, Codex, Zen, GTK and other app-specific repair workflows in the original skill are **not additional Studio integrations in v0.1**. Omarchy may already support some of them. The app reports what it checks without claiming whole-desktop visual verification. External hooks can make changes outside Studio’s backup scope.

## Optional AI

Expand **Optional AI** and enter your provider’s full Chat Completions URL, model name and API key. OpenAI-compatible providers and local servers are supported; for example, a local server may expose `http://localhost:11434/v1/chat/completions`.

Only your description and extracted hex colour samples are sent, when you click Generate. No images or local files are uploaded. Keys stay in memory and are not saved in projects or app settings. HTTPS is required except for loopback servers. A chat subscription is not an API credential. Provider availability, model support and costs depend on your provider. Local generation works without AI.

## Based on the Omarchy Theme Studio workflow

The original [Codex skill](https://github.com/Anaguma-sh/omarchy-theme-studio) is maintained in a separate repository. This desktop app runs independently and needs neither Codex nor the skill installed.

## Development

Node.js 22+ and npm are required for development only.

```bash
npm ci
npm test
npm run check
npm start
npm run dist
```

The AppImage is written to `dist/`. Electron bundles the runtime; the app uses plain HTML, CSS and JavaScript without a web server or frontend framework. On environments that set `ELECTRON_RUN_AS_NODE`, launch with `env -u ELECTRON_RUN_AS_NODE npm start`.

Tests use temporary directories and mocked desktop commands; they do not alter your active theme. `npm start -- --smoke-test` exercises navigation, palette selection and advanced mode with desktop changes disabled.

See [release instructions](docs/RELEASING.md) and [workflow coverage](docs/WORKFLOW.md). MIT licensed; bundled third-party software retains its own licences. Wallpaper rights remain with their owners.
