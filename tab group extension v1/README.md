# Tab Group Extension v1 — Universal Key Sync

This version of the tab group exporter focuses on a very small and simple deployment story.  
Users type a shared universal key inside the popup UI and every browser that knows that key has
access to the same set of tab group sessions. There is no authentication layer – if somebody knows
the key they can read or overwrite its sessions – so it is best suited for lightweight personal
setups.

## Features
- Export all tab groups in the current profile into a portable JSON representation.
- Persist sessions to a remote key-value store keyed by a user-defined universal key.
- Restore sessions on any machine by entering the same universal key.
- Basic session management: rename, delete and restore individual snapshots.

## Project layout
```
tab group extension v1/
├── README.md
├── backend
│   ├── README.md
│   ├── package.json
│   ├── server.js
│   └── storage.json
└── extension
    ├── config.js
    ├── manifest.json
    ├── popup.css
    ├── popup.html
    └── popup.js
```

The backend folder contains a minimal Express server that implements a `/:key/sessions` REST
surface. The extension folder holds the Manifest V3 implementation. They are intentionally decoupled;
any HTTP key-value service that follows the same contract will work.

## Running the backend
1. Install dependencies: `npm install`
2. Start the API: `npm run dev`
3. Update the popup configuration (`extension/config.js`) so that `API_BASE_URL` matches the server
   URL (defaults to `http://localhost:8787`).

The bundled development server stores data in `storage.json`. Feel free to swap it with a managed
service such as Upstash, Deta Base or Redis by re-implementing the helper functions inside
`server.js`.

## Loading the extension
1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and pick the `extension` directory.
4. Enter a memorable universal key (for example, a randomly generated passphrase) and start saving
   sessions.

## Universal key API contract
All network operations hit the following endpoints relative to `API_BASE_URL`:

| Method & path                     | Description                              |
|----------------------------------|------------------------------------------|
| `GET /sessions/:key`             | Fetch all sessions stored under `:key`.  |
| `POST /sessions/:key`            | Upsert a session. Body: `{ session }`.   |
| `DELETE /sessions/:key/:id`      | Delete a session.                        |

Each session matches the schema created by `popup.js`.

## Notes & improvements
- The popup aggressively validates input to avoid losing work when the network fails.
- The local Chrome storage only keeps the universal key and user preferences – session data is
  fetched on demand.
- The fetch helpers bubble up descriptive errors so the UI can surface them.
- All async tab creation steps run serially to guarantee that groups are created in the requested
  order. Because Chrome limits concurrent group creation, this sequencing avoids race conditions
  observed in the original project.

