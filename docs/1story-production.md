# 1story production deployment

This document describes the production Docker package for the commercial 1story fork.

## Production configuration

Use:

- `compose.production.yml`
- a private `.env.production`
- a TLS reverse proxy in front of `127.0.0.1:3000`

Do not use the repository's generic `compose.yml` as the public 1story deployment stack.

## Isolation

The production Compose project is named `one_story_prod`.

This intentionally separates production containers and named volumes from the development stack.

The production stack uses:

- one application container;
- PostgreSQL 17;
- a dedicated PostgreSQL named volume;
- a dedicated application-data named volume.

Redis and S3-compatible storage are not part of the V1 production stack. The application uses persistent local storage at `/app/data`.

## Network exposure

PostgreSQL is not published to the host.

The application is published only on:

`127.0.0.1:3000`

Do not expose port 3000 directly to the public internet. Put a TLS reverse proxy in front of it.

## Production environment

Copy:

`production.env.example`

to:

`.env.production`

Generate independent 64-character hexadecimal values for:

- `POSTGRES_PASSWORD`
- `AUTH_SECRET`
- `ENCRYPTION_SECRET`

Set `APP_URL` to the final public HTTPS origin.

Example:

`https://cv.example.com`

Do not change `AUTH_SECRET` after users have active sessions unless invalidating those sessions is intentional.

## Start command

Run production Compose with the production environment explicitly supplied:

`docker compose --env-file .env.production -f compose.production.yml up -d --build`

## Health

Check:

`docker compose --env-file .env.production -f compose.production.yml ps`

and:

`http://127.0.0.1:3000/api/health`

The application should not be exposed publicly until HTTPS, the final domain and production email configuration have been completed.

## Backups

Before every production update, back up:

- the PostgreSQL volume/database;
- the application-data volume.

Application-container replacement must not replace either persistent volume.
