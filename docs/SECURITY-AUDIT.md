# Security review — 0.4.0

Reviewed 15 November 2026. Scope: project/wallpaper imports, renderer/main IPC, command execution, agent environment/filesystem exposure, update trust, local file writes/backups, dependencies and upstream GitHub write permissions.

## Remediation

- Reproduced the old symlink/private-file export flaw with dummy data. GUI imports now skip all referenced paths until the user re-selects files; CLI requires explicit `--allow-wallpapers`. Export rejects symlinks, checks actual image type/dimensions, and copies bytes read from a no-follow file descriptor. Main-process image decoding receives validated bytes with size/pixel limits.
- Updates require an Ed25519-signed checksum manifest anchored by the packaged public key. A forged signature is rejected before the executable download. SHA-256 comparison remains required for the downloaded binary.
- Agent execution is mandatory bubblewrap isolation, with no unsafe fallback. Unrelated home files, SSH agent/desktop sockets and inherited environment secrets are hidden. Only the selected provider's small login/config files are copied into private temporary storage. Runtime paths are mounted read-only and provider networking is available.
- Patched minimatch build dependency overrides; audited the new image-header dependency as well. No reported vulnerabilities remain in the final npm audit, including development dependencies.
- Upstream owner is the only write collaborator; zero pending invitations and no deploy keys were found. Active all-branch and all-tag rules restrict create/update/delete to repository admins. Default Actions token permissions are read-only, with PR approval disabled. Current admin is the owner alone.

## Validation

36 tests cover prior theme/agent flows plus private-path access, forged image input, dimensions, signature rejection, isolated environment/home access, update/rollback and file locks. A live signed-in Codex generation succeeds under isolation. Packaged desktop smoke checks and no-display CLI checks are performed before publishing. Signed release checksums are verified locally before upload.

## Remaining boundaries

This is an internal code/dependency review, not an independent penetration test or proof of absence of vulnerabilities. Agents need access to their own provider credential and network; isolation does not prevent misuse of that credential by a malicious agent. OS-keychain, external helper and some custom harness integrations may require copy/paste. Native decoders, Electron, ImageMagick, bubblewrap and the kernel still need OS/runtime security updates. Administrators can change repo rules; owner-account/signing-key compromise cannot be solved by branch rules alone. The broader UI/UX review is separate.
