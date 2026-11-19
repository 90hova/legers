# LEDGERS — Discord bot hosting platform

An original VaultCord-style control panel. Vercel hosts the Next.js dashboard/API; a separate persistent worker host runs bot containers.

## Architecture

- `apps/web`: Next.js App Router dashboard and API, deployable to Vercel.
- `apps/worker`: private Express service that manages isolated Docker containers.
- PostgreSQL: users, bot metadata, ownership, runtime state.
- Docker: one restricted container per bot. Bot source is never executed inside the Vercel function or worker process itself.

## Requirements

- Node.js 20+
- PostgreSQL
- A Linux host with Docker Engine for the worker
- Discord application credentials (OAuth2)
- A domain with HTTPS in production

## 1. Configure

Copy `.env.example` to `.env` and set every value. Use separate strong random secrets for `SESSION_SECRET` and `WORKER_SHARED_SECRET`.

`DATABASE_URL` must point to PostgreSQL. In Discord Developer Portal, add this redirect URL:
`https://YOUR-VERCEL-DOMAIN/api/auth/discord/callback`

For local development use:
`http://localhost:3000/api/auth/discord/callback`

## 2. Install and migrate

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

## 3. Deploy the web app to Vercel

- Import this repository into Vercel.
- Set the root directory to `apps/web` only if you configure the monorepo install/build commands accordingly; simplest is to deploy from the repository root with the included `vercel.json`.
- Add the environment variables from `.env.example` to Vercel.
- Run `npx prisma migrate deploy` as a release step (or run it from a trusted machine).
- Set `APP_URL` to your public Vercel URL.

Vercel does not run the bot processes. Do not try to keep Gateway connections alive in Vercel functions.

## 4. Run the persistent worker

On a separate Linux VPS:

```bash
cp .env.example .env
# Set WORKER_SHARED_SECRET, WORKER_PORT, WEB_APP_URL and BOT_DATA_DIR.
docker compose up -d --build worker
```

The worker needs access to Docker Engine. This is a high-trust component: keep port 8787 private, firewall it so only the web backend can reach it, and never expose the Docker socket over TCP. For stronger isolation, run the worker on a dedicated VM with no unrelated workloads.

Configure `WORKER_URL` in Vercel to the worker's private HTTPS endpoint. If the worker and Vercel cannot communicate over a private network, use a secure tunnel or a private service gateway; do not expose an unauthenticated worker.

## Upload format

Upload a `.zip` with `index.js`, `index.py`, or a custom `package.json` / `requirements.txt` at the archive root. Maximum upload size is controlled by `MAX_UPLOAD_BYTES`. Only Python and Node.js are supported by this starter. The runtime installs dependencies at container startup. Avoid native dependencies unless your image is extended to compile them.

For Node bots, `package.json` must include a `start` script. For Python bots, `requirements.txt` is optional and the entry point must be `index.py`.

## Security notes

- Treat uploaded bot code as untrusted. The worker runs each bot in its own Docker container with CPU, memory, PID, filesystem, and capability restrictions.
- The worker service is still privileged in the sense that it controls Docker. A compromise of the worker can compromise that host. Use a dedicated host, keep Docker and the OS patched, and restrict worker network access.
- Bot tokens are encrypted at rest with AES-256-GCM. Set `TOKEN_ENCRYPTION_KEY` to exactly 32 random bytes encoded as 64 hex characters.
- Never put bot tokens in browser local storage, URLs, logs, or source files.
- This is a starter platform, not a substitute for a professional multi-tenant sandbox/security review. Add malware scanning, quotas, abuse reporting, billing, audit logs, and per-user rate limits before public launch.

## Included features

- Discord OAuth2 login
- User-owned bot records
- Add bot by ZIP upload or token + runtime config
- Start / stop / restart / delete
- Live status polling and recent logs
- Encrypted bot token storage
- Worker-side container isolation and resource limits

## Limitations

The starter uses a simple single-worker control plane. It does not include billing, custom domains, public signup approval, team roles, backups, or a distributed scheduler. Do not market it as production-hardened until it has undergone security testing.
