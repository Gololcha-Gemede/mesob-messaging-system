# Mesob Connect - Internal Message Management System

Full-stack app for internal organizational correspondence, formal letters, message tracking, and direct messages between users.

## Stack

- **Client:** React 19 + Vite (`client/`)
- **Server:** Express 5 + MySQL (`server/`)

## Quick Start

1. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your MySQL credentials and a strong `JWT_SECRET`.

2. Create the database once:
   ```bash
   mysql -u root -p < server/setup-database.sql
   ```

3. Install dependencies:
   ```bash
   npm install
   cd client && npm install
   cd ../server && npm install
   ```

4. Run the app in two terminals:
   ```bash
   npm run server
   npm run client
   ```
   - API: `http://localhost:5000`
   - App: `http://localhost:5173`

## Main Features

- Compose formal letters with templates, PDFs, and attachments
- Inbox, sent, and drafts with filters
- Message tracking and event history
- Direct-message style 1-to-1 mail through Compose
- Admin user and department management

## Configuration

The client and server read configuration from the repo-root `.env`. The server also supports an optional `server/.env` for backend-only deployments.

| Variable | Purpose |
|----------|---------|
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection |
| `JWT_SECRET` | Token signing |
| `PORT` | API server port |
| `CORS_ORIGIN` | Comma-separated browser origins allowed to call the API |
| `CSP_CONNECT_SRC` | Space-separated API/SSE origins allowed by Content Security Policy |
| `UPLOAD_DIR` | Upload directory relative to `server/` |
| `VITE_DEV_HOST`, `VITE_DEV_PORT` | Vite development server host and port |
| `VITE_PROXY_TARGET` | API target used by the Vite dev proxy |
| `VITE_API_BASE_URL` | Optional browser API base URL; blank uses same-origin `/api` and `/uploads` |
| `ALLOW_PUBLIC_REGISTER` | `true` to allow public registration; default off |

## Project Structure

```text
client/
  src/
    components/
    config/
    hooks/
    pages/
    utils/
server/
  config/
  controllers/
  middleware/
  models/
  routes/
  services/
  utils/
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run server` | Start API with nodemon |
| `npm run client` | Start Vite dev server |
| `npm run build` | Build the client for production |

## Notes

- User accounts are normally created by an admin from the Admin panel.
- Uploaded files are stored under `server/uploads/` by default and are not committed to git.
