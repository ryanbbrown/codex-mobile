# Universal key API (development server)

The extension only needs a tiny JSON-over-HTTP API to share sessions. This directory bundles a
reference implementation powered by Express so you can start syncing tab groups immediately during
development.

## Endpoints
- `GET /sessions/:key` – Return `{ sessions: Session[] }`.
- `POST /sessions/:key` – Persist a session. The request body must be `{ session: Session }`.
- `DELETE /sessions/:key/:id` – Remove a session snapshot by ID.

Sessions are stored in `storage.json` using the following shape:

```ts
interface SessionTab {
  id: string;
  url: string;
  title: string;
  pinned: boolean;
}

interface SessionGroup {
  id: string;
  title: string;
  color: chrome.tabGroups.ColorEnum;
  collapsed: boolean;
  tabs: SessionTab[];
}

interface SessionSnapshot {
  id: string;
  name: string;
  createdAt: string;
  groups: SessionGroup[];
}
```

Feel free to swap the persistence layer with Redis, Cloudflare Workers KV, Deta Base or any other
service. The rest of the extension will continue to work as long as the endpoints above behave the
same way.

## Development scripts
- `npm run dev` – Start the API on <http://localhost:8787> and enable hot reloading via `nodemon`.
- `npm test` – Placeholder command to keep CI happy. Extend it with unit tests if you evolve this
  server beyond experimentation.

