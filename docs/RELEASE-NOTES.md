## Omarchy Theme Studio 0.4.0 — security update

- Imported wallpaper references require renewed authorisation. Symbolic links, non-images and excessive dimensions are rejected.
- Update manifests require an Ed25519 publisher signature as well as SHA-256 verification. Forged or unsigned releases are rejected.
- Agent commands run through mandatory bubblewrap isolation with a filtered environment and temporary provider-specific login copies. Unrelated home files and environment secrets are not exposed. Networking is retained for providers; keychain-only and unsupported custom setups can use copy/paste.
- Patched build-tool dependency overrides remove the reported minimatch advisory.
- Owner-only branch/tag rules and read-only default Actions permissions are active on the upstream repository.

Download and install 0.4.0 directly once to establish signed-update trust. The signing protection cannot be retrofitted into older running versions. Bubblewrap is required for direct agent mode; there is no unsafe fallback. The broader UI/UX review remains deferred.
