# Tab Group Extension v2 — Better Auth + managed storage

This iteration layers a minimal authentication workflow on top of the tab group exporter. Users sign
in with Better Auth (email + magic link by default) and all session data is stored on a backend that
only serves authenticated requests. It is therefore safer for multi-user environments while still
staying lightweight.

## Features
- Everything from v1: capture, restore, rename and delete tab group sessions.
- Authenticated sync powered by [Better Auth](https://better-auth.com/).
- Multi-device access without sharing secrets – logging into the extension on any profile unlocks the
  same saved sessions.
- Optional organizations/workspaces support if you enable the Better Auth plugin.

## Project layout
```
tab group extension v2/
├── README.md
├── backend
│   ├── README.md
│   ├── package.json
│   └── src
│       ├── auth.js
│       ├── db.js
│       └── server.js
└── extension
    ├── config.js
    ├── manifest.json
    ├── popup.css
    ├── popup.html
    └── popup.js
```

The backend is a simple Fastify server that wires Better Auth and a key-value storage adapter on top
of SQLite using `better-sqlite3`. Replace the storage module with your own implementation (Supabase,
Planetscale, etc.) by editing `db.js`.

## Running the backend locally
1. Rename `.env.example` to `.env` and fill in the required secrets.
2. Install dependencies: `npm install`
3. Run `npm run dev` to start the Better Auth server on <http://localhost:8788>.
4. Update the extension configuration to point at that URL.

By default the backend uses SQLite for durable storage. Remove the file `data.sqlite` to reset the
environment.

## Loading the extension
1. Build or run the backend.
2. Load the `extension` folder through `chrome://extensions` (Developer mode > Load unpacked).
3. Sign in through the popup. After the magic link is validated the popup remembers the session and
   automatically fetches tab group snapshots.

## API contract
All authenticated requests must include the Better Auth session token via the `Authorization` header.
The REST surface mirrors the universal key version but lives behind `/api` and requires auth.

| Method & path                | Description                            |
|-----------------------------|----------------------------------------|
| `POST /api/session`         | Upsert a tab group session.            |
| `GET /api/session`          | List sessions for the logged-in user.  |
| `DELETE /api/session/:id`   | Delete a session.                      |

## Why two implementations?
- **v1** is perfect for quick-and-dirty personal syncing.
- **v2** is better suited for collaborative setups or users that prefer email-based authentication.

Both share a majority of UI code so new features can be prototyped in v1 and then hardened in v2.

