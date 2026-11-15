# Skill workflow coverage

| Skill stage | Desktop app |
| --- | --- |
| Establish direction | Installed theme inventory, multiple wallpaper inputs, optional AI description |
| Compare palettes | Three options with identical terminal text, selection, active/inactive outlines and shell pill; wallpaper preview and hex values |
| Build theme | Named new theme, editable desktop roles and semantic colours, text contrast checks, local projects |
| Deliver | Portable archive or explicit install/apply confirmation; existing themes are preserved |
| Verify | Readback of active `colors.toml`, `hyprctl configerrors`, integration report and manual visual checks |
| Extra app sync | VS Code and Cursor IDE, installed-app detection, JSONC-preserving settings edits, generated theme extension |
| Recovery | Durable journal before editing files, original settings bytes retained, undo/keep workflow |

## Deliberate first-release limits

- Fonts, app restarts, app-specific visual inspection, Cloudroom palettes/native menus, and arbitrary application repair remain manual. No claim of live computed-colour verification is made.
- Uses the default per-user VS Code and Cursor IDE locations, not profiles, VSCodium, Flatpak or custom data directories. Existing editor `workbench.colorCustomizations` can override the generated theme.
- Existing Omarchy hooks are preserved and run by Omarchy. Their side effects cannot be reversed by Studio’s file backups.
- No AI provider login/OAuth integration. Providers use a user-supplied API key or an unauthenticated local endpoint. Only a Chat Completions response format is supported. The provider must return three palettes; malformed output is rejected.
- Saved projects reference wallpaper paths; use exported packages to move the actual assets to another machine.
- Undo is for the most recent uncommitted Studio application. Keep ends that undo window but retains backup files. Existing themes cannot be overwritten; use a new name for each installed variant.
- Supports modern Omarchy `colors.toml` templates and Linux x86_64. Other versions/architectures require testing before support is claimed.
