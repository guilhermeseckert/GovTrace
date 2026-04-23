# Coolify Deploy — Manual Workarounds

Operational cheat sheet for the GovTrace production deploy on Coolify (Hetzner).
Use this when the normal auto-deploy pipeline misbehaves.

## When Coolify auto-deploy no-ops

Symptom: a new commit is merged and pushed, Coolify shows the deployment as
"finished / success" in its UI, but the live site at https://govtrace.ca still
serves the old code.

Root cause: Coolify reuses Docker image layers aggressively. When its build
pack determines the layer set is unchanged (or "close enough"), it serves a
cached image and runs `docker compose up -d` without `--force-recreate`. The
container keeps its old image ID, and the new code never reaches production.

This is not a Coolify bug per se — it's an artifact of monorepo builds where
Vite chunk hashes change but the Docker layer inputs don't. The fix is to
force a full rebuild and container recreation by hand over SSH.

## Manual rebuild (SSH recipe)

SSH into the Coolify host, then `cd` into the project's compose directory
(Coolify stores each application under `/data/coolify/applications/<APP-ID>`;
run `ls /data/coolify/applications` if you don't remember the ID).

```bash
# 1. Force rebuild with no cache
docker compose build --no-cache web

# 2. Recreate the container with the fresh image
docker compose up -d --no-deps --force-recreate web
```

`--no-deps` avoids bouncing postgres. Only the `web` service is replaced; the
database stays running and connections continue untouched.

## Apply a Drizzle migration on prod

Drizzle writes migrations to `packages/db/drizzle/`. To apply a single SQL
migration file against the production DB, use `docker exec` with psql:

```bash
# Substitute XXXX_NAME.sql with the actual filename, and
# <postgres-container-name> with the value from `docker ps`
docker exec -i <postgres-container-name> \
  psql -U govtrace -d govtrace < packages/db/drizzle/XXXX_NAME.sql
```

Find the container name with `docker ps | grep postgres`. The migration file
path is relative to wherever you run the command, so copy the `.sql` file
onto the Coolify host first (or pipe via `ssh` from local).

## Verify a fix is live

The TanStack Start SSR response is gzipped by default. A naive `curl` against
govtrace.ca will show gzip-encoded bytes, not the HTML substring you expect.
Use `--compressed` (client-side decode) or pipe through `gunzip`:

```bash
# Replace DISTINCT_STRING_FROM_YOUR_FIX with a unique substring only the new
# code produces — e.g. a new CSS class name, a new copy change, etc.
curl -s --compressed https://govtrace.ca/ | grep -o 'DISTINCT_STRING_FROM_YOUR_FIX'

# Or, without --compressed:
curl -s https://govtrace.ca/ | gunzip | grep 'DISTINCT_STRING_FROM_YOUR_FIX'
```

Tip: pick a string that only exists in the new code, so a cached CDN / proxy
response cannot produce a false positive.

## Signs Coolify deployed but didn't actually update code

Quick checklist when a deploy "succeeded" but the site looks unchanged:

- `docker images | grep <app>` shows the same IMAGE ID / CREATED timestamp as
  before the deploy
- `docker ps` shows the container's `STATUS` uptime is older than the deploy
  time (i.e. it was never restarted)
- The "verify a fix is live" curl above returns no match for the new string
- The Coolify deploy log shows `CACHED` for every `docker build` layer
