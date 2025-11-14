# codex-mobile

Multi-purpose repo to be used for projects being done from Codex on my phone.

## Tab group exporters

This repository now contains two cleaned-up takes on a Chrome tab group exporter:

| Folder | Description |
| --- | --- |
| [`tab group extension v1`](./tab%20group%20extension%20v1) | Universal key synchronisation. Any profile that knows the shared key can persist and restore sessions via a tiny key-value API. |
| [`tab group extension v2`](./tab%20group%20extension%20v2) | Better Auth protected sync. Users sign in with email/password and their sessions are stored behind an authenticated API. |

Each folder contains an MV3 extension (`extension/`) and a lightweight backend (`backend/`). The READMEs inside those folders explain how to run the services locally and how to load the extensions into Chrome.
