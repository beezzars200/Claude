# Care About Cahir

A community site for Cahir, Co. Tipperary — events, businesses and news in
one place, kept up to date by the people who live there.

- **Public site**: browse events, businesses and news, and submit new ones.
- **Submissions**: anything the public submits lands in a review queue —
  nothing goes live until an admin approves it.
- **Admin panel**: review/approve/reject submissions, edit or remove live
  listings, and add "curated" listings directly (for content pulled in from
  other Cahir pages/sites — the council, tourism board, GAA club, Facebook
  groups, etc.). Curated listings publish immediately since an admin is
  vouching for them.

There's no automated scraper pulling content in from other sites — that's a
separate, fragile thing to build per-source (most of those sites don't have
APIs, and scraping HTML breaks the moment they redesign). The "add curated
listing" form is the practical stand-in: fast enough to manually pull
something in from Facebook/the council site/etc. in under a minute. If a
particular source turns out to be a steady stream of content, a scraper for
just that one source can be added later.

## Stack

Express + EJS + MySQL (`mysql2`), matching the conventions already used by
`ticket-system` elsewhere in this repo. Session-based admin auth
(`express-session` + `express-mysql-session`), single admin account via
environment variables — no user accounts needed for a site this size.

## Local development

```bash
cd careaboutcahir
npm install
cp .env.example .env   # fill in DB credentials and a real SESSION_SECRET
npm run dev             # nodemon, restarts on file changes
```

You need a MySQL/MariaDB database reachable with the `.env` credentials —
the app creates the `listings` table itself on boot (see `initDb()` in
`app.js`; `db/schema.sql` documents the same schema for reference).

Visit `http://localhost:3000` for the public site and
`http://localhost:3000/admin/login` for the admin panel.

## Deploying on Railway

This repo already has a Railway service wired up for `ticket-system`
(see the root `nixpacks.toml` / `Dockerfile` — those are unrelated to this
project and untouched). This project deploys as a **second, separate
Railway service** in the same project:

1. In Railway, **New Service → Deploy from GitHub repo**, same repo.
2. Set the service's **Root Directory** to `careaboutcahir`. Railway's
   Nixpacks builder will auto-detect the Node app from `package.json` — no
   extra Dockerfile/nixpacks.toml needed inside this folder.
3. **Attach a MySQL database** to this service (Railway → New → Database →
   MySQL). Railway injects `MYSQL_URL`/`DATABASE_URL` automatically, which
   `db/connection.js` picks up — no manual DB config needed.
4. Set environment variables on the service:
   - `SESSION_SECRET` — long random string
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD` — your admin login
   - `SITE_NAME` — optional, defaults to "Care About Cahir"
5. Deploy. First boot creates the `listings` table automatically.

Once it's live, point your domain (e.g. `careaboutcahir.ie` or similar) at
this Railway service via a custom domain in the service settings.

## Content model

Everything — events, businesses, and news — lives in one `listings` table,
distinguished by a `type` column, because they share the same lifecycle:
submitted → reviewed → published. Each row also has:

- `source`: `community` (public submission) or `curated` (admin-added)
- `status`: `pending` / `approved` / `rejected`

Only `approved` listings are ever shown on the public site.
