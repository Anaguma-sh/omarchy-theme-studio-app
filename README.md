# Omarchy Theme Studio

A standalone Linux desktop app for designing and applying Omarchy themes. Start from wallpapers or an installed theme, compare three palettes, refine the colours, then export or apply. Guided and advanced modes share the same project.

## Download and run

Download **Omarchy-Theme-Studio-0.2.0-x86_64.AppImage** from [GitHub Releases](https://github.com/Anaguma-sh/omarchy-theme-studio-app/releases/latest).

In your file manager, allow the file to run as a program, then open it. Or use:

```bash
chmod +x Omarchy-Theme-Studio-0.2.0-x86_64.AppImage
./Omarchy-Theme-Studio-0.2.0-x86_64.AppImage
```

No Node.js, API key or account is needed to run the download. This release targets **x86_64 Omarchy desktops** with `colors.toml` theme templates. Older Omarchy releases and ARM machines are not tested. If FUSE is unavailable, try `./Omarchy-Theme-Studio-0.2.0-x86_64.AppImage --appimage-extract-and-run`. Do not run the app as root or disable its sandbox.

## What it does

- Extract a shared palette from up to eight local PNG, JPEG or WebP wallpapers.
- Start from an installed theme, compare three consistent previews, and edit normal and semantic colours.
- Check foreground, muted and selected text against a 4.5:1 contrast target. Applying is blocked when those checks fail.
- Save editable projects and export `.tar.gz` themes with `colors.toml`, wallpapers and install instructions.
- Install under a **new name**, apply with `omarchy theme set`, compare the staged palette and run `hyprctl configerrors`.
- Optionally install a generated colour theme in **VS Code** and **Cursor IDE**, preserving comments and unrelated settings. Reload those editors after applying. Cursor Agents is a separate surface and is not covered.
- Undo the last application or keep it. File backups persist in the app’s user-data directory. Later edits to editor settings block undo instead of being silently overwritten.

Omarchy generates desktop and terminal settings with its own installed templates and runs its normal app integrations and existing hooks. Studio does not add another sync hook. Extra editor syncing happens only when applying through Studio. Restarting applications and verifying their rendered appearance remain manual. The preview is illustrative; compositor transparency and app-specific overrides can alter the result.

Cloudroom, Codex, Zen, GTK and other app-specific repair workflows in the original skill are **not additional Studio integrations in v0.2**. Omarchy may already support some of them. The app reports what it checks without claiming whole-desktop visual verification. External hooks can make changes outside Studio’s backup scope.

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
