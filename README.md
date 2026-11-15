# Omarchy Theme Studio

A standalone Linux desktop app for designing and applying Omarchy themes. Start from wallpapers or an installed theme, compare three palettes, refine the colours, then export or apply. Guided and advanced modes share the same project.

## Download and run

Download **Omarchy-Theme-Studio-0.3.0-x86_64.AppImage** from [GitHub Releases](https://github.com/Anaguma-sh/omarchy-theme-studio-app/releases/latest).

Allow the file to run as a program and open it. Choose **Install & updates → Install on this computer**. Studio creates a permanent installation, desktop launcher and `omarchy-theme-studio` terminal command. No administrator password is needed.

Or install directly from a terminal:

```bash
chmod +x Omarchy-Theme-Studio-0.3.0-x86_64.AppImage
./Omarchy-Theme-Studio-0.3.0-x86_64.AppImage install
omarchy-theme-studio
```

The executable lives at `~/.local/share/omarchy-theme-studio/app.AppImage`; a wrapper is installed at `~/.local/bin/omarchy-theme-studio`. If that directory is not on your PATH, use the full wrapper path or log in again. Existing launcher/desktop files are backed up once with a `.before-studio-install` suffix.

No Node.js, API key or Studio account is needed to run the download or CLI. This release targets **x86_64 Omarchy desktops** with `colors.toml` theme templates. Older Omarchy releases and ARM machines are not tested. If FUSE is unavailable, try `./Omarchy-Theme-Studio-0.3.0-x86_64.AppImage --appimage-extract-and-run`. Do not run as root or disable the sandbox.

## App updates

Studio checks GitHub Releases when it opens and shows a notification when an update is available. This check can be disabled in **Install & updates**. Checks contact GitHub; they do not send projects, AI credentials or wallpapers. Offline startup remains usable.

Choose **Download & install update**, then save your project and choose **Restart installed Studio**. Downloads are checked against the release SHA-256 checksum before replacing the installed executable. The previous executable is retained; use **Restore previous app version** or `omarchy-theme-studio rollback --yes` to recover. Updates do not automatically restart the app or alter your theme/projects. The checksum verifies integrity against the same GitHub release; it is not an independent publisher signature.

Versions before 0.3.0 need one manual download of this release to gain in-app installation and updates. Updates require the built-in permanent installation and access to GitHub.

## Terminal commands

No command opens the desktop app. Commands also work directly on the downloaded AppImage, and headless commands need neither a display nor a separate Node.js installation.

```bash
omarchy-theme-studio --help
omarchy-theme-studio --version
omarchy-theme-studio themes
omarchy-theme-studio agents
omarchy-theme-studio generate --name Forest --colors '#223344,#88aa77' --output forest.json
omarchy-theme-studio generate --name Amber --agent codex --prompt 'Slate navy and warm amber' --output amber.json
omarchy-theme-studio export forest.json --output forest.tar.gz
omarchy-theme-studio apply forest.json --apps cursor --yes
omarchy-theme-studio verify forest.json
omarchy-theme-studio undo --yes
omarchy-theme-studio keep
omarchy-theme-studio update --check
omarchy-theme-studio update --yes
omarchy-theme-studio rollback --yes
```

`generate` supports `--wallpaper FILE` (repeat up to eight times), `--base THEME`, `--choice 1|2|3`, `--model MODEL`, and `--response FILE` for copied AI output. Wallpaper extraction in the CLI uses ImageMagick’s `magick` command; colour samples, saved projects, AI and the GUI do not need it. CLI `prompt --prompt 'your direction'` prints a portable AI request. Custom harnesses use `--agent custom --command EXECUTABLE --args '["--print"]'`.

Existing generated-project and export files are not silently overwritten. `apply`, `undo`, `update` and `rollback` ask for confirmation in an interactive terminal; scripts must supply `--yes`. App updates and theme edits use separate locks, with desktop and CLI theme operations sharing the same journal and lock. Projects and theme backups remain after app updates or rollback.

## What it does

- Extract a shared palette from up to eight local PNG, JPEG or WebP wallpapers.
- Start from an installed theme, compare three consistent previews, and edit normal and semantic colours.
- Check foreground, muted and selected text against a 4.5:1 contrast target. Applying is blocked when those checks fail.
- Save editable projects and export `.tar.gz` themes with `colors.toml`, wallpapers and install instructions.
- Install under a **new name**, apply with `omarchy theme set`, compare the staged palette and run `hyprctl configerrors`.
- Optionally install a generated colour theme in **VS Code** and **Cursor IDE**, preserving comments and unrelated settings. Reload those editors after applying. Cursor Agents is a separate surface and is not covered.
- Undo the last application or keep it. File backups persist in the app’s user-data directory. Later edits to editor settings block undo instead of being silently overwritten.

Omarchy generates desktop and terminal settings with its own installed templates and runs its normal app integrations and existing hooks. Studio does not add another sync hook. Extra editor syncing happens only when applying through Studio. Restarting applications and verifying their rendered appearance remain manual. The preview is illustrative; compositor transparency and app-specific overrides can alter the result.

Cloudroom, Codex, Zen, GTK and other app-specific repair workflows in the original skill are **not additional Studio integrations in v0.3**. Omarchy may already support some of them. The app reports what it checks without claiming whole-desktop visual verification. External hooks can make changes outside Studio’s backup scope.

## Optional AI: subscriptions, any harness, or API

An API key is **not required** for prompts. Choose one of three connection modes:

1. **Signed-in agent.** Install and sign in to an agent in your terminal, then choose it in Studio. Presets are included for Codex, Claude Code, Gemini CLI and OpenCode. Studio launches the official CLI and reuses its login and provider configuration without copying credentials. Leave the model blank to use the harness default, or enter any model that connection supports. Claude Code and OpenCode also expose a named-agent field.
2. **Copy/paste.** Copy Studio’s request into any AI chat, agent or model you already use. Paste its response back into Studio to compare and edit the palettes. This works with subscription apps that have no automation interface.
3. **API or local server.** An optional Chat Completions endpoint for API users and local servers. The API key can be blank for servers that do not require authentication. A chat website such as `https://openai.com/` is not an API endpoint; Studio explains which connection to use instead.

### Signed-in agents

| Harness | Sign in outside Studio | Model selection |
| --- | --- | --- |
| Codex | `codex login` | Saved default or `--model` value |
| Claude Code | Run `claude` and sign in | Saved default or model name/alias |
| Gemini CLI | Run `gemini` and sign in | Saved default or model name |
| OpenCode | Connect your provider in OpenCode | Saved default or `provider/model` |
| Other harness | Set it up in its own app | Custom command arguments |

Codex can reuse a ChatGPT login, and Claude Code supports its own Claude account login. See the official [Codex authentication guide](https://developers.openai.com/codex/auth), [Claude authentication guide](https://code.claude.com/docs/en/authentication), [Gemini setup](https://geminicli.com/docs/get-started/), and [OpenCode automation docs](https://opencode.ai/docs/cli/). Subscription eligibility, available models and usage limits are controlled by each provider. Studio does not supply a universal login or bypass provider access rules.

### Other harnesses and agents

Choose **Custom command**. Enter an executable name or absolute path and a JSON array of arguments. For example, a harness supporting `--print` and stdin could use `["--print"]`. Studio sends the request to stdin unless an argument contains `{prompt}`. `{model}` substitutes your model field, and `{output}` supplies a temporary output-file path for harnesses that write their final answer to a file. Example arguments for such a tool: `["--model", "{model}", "--output", "{output}", "{prompt}"]`.

The command runs without a shell in a temporary directory. It must exit and return three palettes as JSON, either on stdout or in `{output}`. Plain JSON, markdown-fenced JSON and common response envelopes/JSON event streams are accepted. Interactive-only tools can use copy/paste instead. Prompts run for at most three minutes and can be cancelled. Studio does not install or configure harnesses for you.

Studio supplies only your description and extracted hex colour samples. Images and wallpaper paths are not included. The selected harness manages its own context, permissions, history and billing; custom commands run with your user permissions. Built-in presets use text-only or read-only options where available. Studio’s API keys stay in memory and are not saved in projects or settings. Local palette generation always works without an AI connection.

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

Tests use temporary directories and mocked desktop commands; they do not alter your active theme. `npm start -- --smoke-test` exercises navigation, palette selection, advanced mode and the copy/paste exchange with desktop changes disabled.

See [release instructions](docs/RELEASING.md) and [workflow coverage](docs/WORKFLOW.md). MIT licensed; bundled third-party software retains its own licences. Wallpaper rights remain with their owners.
