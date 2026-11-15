## Omarchy Theme Studio 0.3.0

- Built-in per-user installer with permanent app storage, desktop launcher and terminal command. No sudo needed.
- Automatic startup update checks, with an opt-out. Download updates in the app and restart when ready.
- SHA-256 verification before replacement, previous executable backup and app rollback.
- Headless CLI for generation, signed-in agents, copied AI responses, export, theme apply/undo/keep, verification, installation, updates and app rollback.
- Shared locking prevents desktop and CLI theme operations from editing the same journal concurrently.
- Added only the install/update controls needed for these features. The broader UI/UX review remains a separate session with the user.

Download this release manually once if you are on 0.2.0 or earlier. Open it and select Install & updates → Install on this computer, or run the AppImage with `install`. Future releases can be downloaded from inside Studio.

No API key is required for signed-in agent or copy/paste modes. Local generation remains available without an AI connection.

Automated tests cover installation, checksum failures, update/rollback, locks, CLI generation/export and the existing theme/agent workflows. Desktop and AppImage smoke checks exercise the interface. Wallpaper extraction in the CLI requires ImageMagick; other headless commands use the bundled runtime.
