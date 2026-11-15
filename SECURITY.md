# Security policy

Report vulnerabilities privately through GitHub private vulnerability reporting when available. Otherwise contact the repository owner privately; do not post credentials or exploit details in a public issue.

Only the current maintained release receives security fixes. Use 0.4.0 or newer. Older installers cannot retroactively enforce signed updates.

The owner is the only current write collaborator. Branch/tag rules allow repository admins to bypass; do not grant admin or write access to others if owner-only publishing is required. Outside contributors should fork and submit pull requests. The owner decides what to merge.

The app does not run as root. Direct AI mode requires bubblewrap; missing or failed isolation stops execution. The provider still receives the prompt and has networking, and its own credential is necessarily accessible to the selected agent. This is not a network firewall or a guarantee against malicious provider binaries or kernel vulnerabilities. Use copy/paste with untrusted harnesses. System/runtime directories are read-only; unrelated home files are not mounted. Provider state copies are temporary, so refreshed tokens are not written back to the host login.

Updates use an embedded Ed25519 public key to verify the exact checksum manifest before downloading/replacing the app. Release signing keys must remain outside the repository and backed up securely by the owner. A compromised signing key or owner account remains a security risk.
