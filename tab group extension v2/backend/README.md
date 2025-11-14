# Better Auth backend

A tiny Fastify app that wires [Better Auth](https://better-auth.com/) with a SQLite-based storage
layer. It exposes both the built-in Better Auth routes (`/auth/...`) and the custom tab group session
APIs used by the extension.

## Environment variables
Create an `.env` file next to `package.json` with:

```
BETTER_AUTH_SECRET="your-long-random-secret"
BETTER_AUTH_BASE_URL="http://localhost:8788"
BETTER_AUTH_SMTP_HOST="smtp.example.com"
BETTER_AUTH_SMTP_PORT=587
BETTER_AUTH_SMTP_USER="apikey"
BETTER_AUTH_SMTP_PASS="secret"
BETTER_AUTH_EMAIL_FROM="Tab Sync <no-reply@example.com>"
```

Update the SMTP configuration to match your provider. For local testing you can use tools such as
[Ethereal Email](https://ethereal.email/) or [MailHog](https://github.com/mailhog/MailHog).

## Commands
- `npm run dev` – Start the Fastify development server with automatic restarts.
- `npm start` – Run the server in production mode.
- `npm test` – Placeholder script for future unit tests.

## Extending the data model
`src/db.js` contains a very small wrapper around `better-sqlite3` to store sessions keyed by user ID.
Swap the implementation with a managed database or KV of your choice. Just ensure that the exported
functions `listSessions`, `saveSession` and `deleteSession` keep the same signature.

