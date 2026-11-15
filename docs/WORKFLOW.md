# Skill workflow coverage

| Skill stage | Desktop app |
| --- | --- |
| Establish direction | Installed theme inventory, multiple wallpaper inputs, prompts via signed-in agents, custom commands, copy/paste or API |
| Compare palettes | Three options with identical terminal text, selection, active/inactive outlines and shell pill; wallpaper preview and hex values |
| Build theme | Named new theme, editable desktop roles and semantic colours, text contrast checks, local projects |
| Deliver | Portable archive or explicit install/apply confirmation; existing themes are preserved |
| Verify | Readback of active `colors.toml`, `hyprctl configerrors`, integration report and manual visual checks |
| Extra app sync | VS Code and Cursor IDE, installed-app detection, JSONC-preserving settings edits, generated theme extension |
| Recovery | Durable journal before editing files, original settings bytes retained, undo/keep workflow |

## Current limits

- Fonts, app restarts, app-specific visual inspection, Cloudroom palettes/native menus, and arbitrary application repair remain manual. No claim of live computed-colour verification is made.
- Uses the default per-user VS Code and Cursor IDE locations, not profiles, VSCodium, Flatpak or custom data directories. Existing editor `workbench.colorCustomizations` can override the generated theme.
- Existing Omarchy hooks are preserved and run by Omarchy. Their side effects cannot be reversed by Studio’s file backups.
- AI connections include signed-in CLI presets, custom harness commands, copy/paste and optional Chat Completions endpoints. Providers control subscription eligibility and model access. Studio does not implement a universal OAuth login. Agents authenticate in their own CLI; GUI-only tools can use copy/paste. Responses must contain three valid palettes.
- Saved projects reference wallpaper paths; use exported packages to move the actual assets to another machine.
- Undo is for the most recent uncommitted Studio application. Keep ends that undo window but retains backup files. Existing themes cannot be overwritten; use a new name for each installed variant.
- Supports modern Omarchy `colors.toml` templates and Linux x86_64. Other versions/architectures require testing before support is claimed.

## v0.2 validation

- 22 automated tests cover palette checks, theme application/undo, archive export, agent discovery, argument substitution, response formats, cancellation, timeouts, output limits and website-URL errors.
- Desktop and packaged-AppImage smoke checks cover navigation, advanced mode, wallpaper extraction, export and copy/paste palette import. Desktop changes and external agent launches are disabled in smoke checks.
- A live generation through an existing ChatGPT-authenticated Codex CLI succeeded without supplying an API key to Studio.
- Claude Code, Gemini CLI and OpenCode argument shapes were checked against installed CLI help and official documentation. Their live provider sessions were not tested. Custom adapters were tested with local fixture commands.

## v0.3 additions

Per-user installation, startup update checks, explicit download/restart, checksum verification, previous app recovery and a headless CLI. Desktop/CLI theme operations use the same journal and lock. The UI adds an Install & updates dialog; a broader UI/UX redesign is deferred for joint review.

The v0.3 test suite contains 32 tests, including installation/update integrity, rollback preservation, no unintended downgrades, CLI export and shared operation locks. Packaged CLI generation, wallpaper extraction, export, installation and wrapper launch were checked without a display.
