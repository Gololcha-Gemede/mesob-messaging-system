# MESOB IMMS — Internal Message Management System

Full-stack app for internal organizational correspondence (formal letters, inbox, tracking) and direct messages between users.

## Stack

- **Client:** React 19 + Vite (`client/`)
- **Server:** Express 5 + MySQL (`server/`)

## Quick start

1. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your MySQL credentials and a strong `JWT_SECRET`.

2. Create the database (once):
   ```bash
   mysql -u root -p < server/setup-database.sql
   ```

3. Install dependencies:
   ```bash
   npm install
   cd client && npm install
   cd ../server && npm install
   ```

4. Run (two terminals):
   ```bash
   npm run server
   npm run client
   ```
   - API: http://localhost:5000  
   - App: http://localhost:5173 (proxies `/api` and `/uploads` to the server)

5. Sign in with sample users from `setup-database.sql` (change passwords before production).

## Main features

- Compose formal letters (templates, PDF, attachments)
- Inbox / sent / drafts with filters, flag, and archive
- Message tracking and event history
- Direct Message template — informal 1-to-1 mail via Compose (same inbox/sent flow as other templates)
- Admin: users and departments

## Configuration

| Variable | Purpose |
|----------|---------|
| `DB_*` | MySQL connection |
| `JWT_SECRET` | Token signing |
| `ALLOW_PUBLIC_REGISTER` | `true` to allow `POST /api/auth/register`; default off |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run server` | Start API with nodemon |
| `npm run client` | Start Vite dev server |
| `npm run build` | Build client for production |

## Notes

- User accounts are normally created by an **admin** via Admin → Register user.
- Uploaded files are stored under `server/uploads/` (not committed to git).
