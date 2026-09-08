# Deploy

The runbook for the one person who can run it. `README.md` says what the deployment *is*
in three lines, which is what a reader of the repository needs; this file is the rest —
the dashboard steps, the rename procedure and the checks — and it lives here because none
of it can be followed without the Cloudflare account it belongs to (FR-PUB-1 as amended
v1.3.3, SPEC V13-16).

`docs/RELEASE.md` is the release checklist that runs beside this: what to check on the
deployed site, the on-device dome performance check (FR-GUIDE-6) and the deploy-day
comparison against Heavens-Above.

## How it is wired

Hosting is Cloudflare Workers static assets wired to this repository through Workers
Builds (PLAN D-12 as amended in §2.5): a push to `main` builds and deploys production;
a push to any other branch, once *non-production branch builds* are enabled, uploads a
preview version with its own URL. `wrangler.jsonc` at the root holds the whole
configuration (assets-only Worker, `dist/` as the assets directory, no Worker script), so
the build never has to guess.

## How the project was created, once, in the dashboard

1. *Workers & Pages → Create → Import a repository*, pick `CipoBaruf/what-is-in-your-sky`.
2. Worker name `in-your-sky`, production branch `main`, build command
   `npm run build`, deploy command `npx wrangler deploy` (the defaults). No environment
   variables; the Node version comes from `.node-version` (24, the same as CI).
3. *Settings → Builds → Branch control*: enable non-production branch builds so every
   branch gets a preview version, aliased by branch name:
   `https://<branch>-in-your-sky.ezequiel-baruf.workers.dev`.

## Renaming the worker

The worker name is the first label of the URL and the account subdomain
(`ezequiel-baruf`) the second. The account subdomain can be changed only once per
account and already has been, so the worker name is the only part left to choose.
Renaming it in `wrangler.jsonc` creates a new worker instead of moving the existing one,
so a rename is three steps: change `name`, then in the dashboard point Workers Builds at
the new worker (*Settings → Build → Connected repository*) and delete the old worker once
the new one has served a green production build. Links to the old URL stop working;
Cloudflare does not redirect.

## Headers, and checking a deployment by hand

`public/_headers` is copied into `dist/` by Vite and parsed by Cloudflare at upload (it is
never served): the strict Content-Security-Policy, `Referrer-Policy` and `Permissions-Policy`
from PLAN §11 on every path, and a one-year immutable cache on the hashed files under
`/assets/`. `npm run preview` serves the same file the same way, and the Playwright suite
runs the app under it, so a CSP violation fails CI before it reaches the site. To check a
deployment by hand (replace the host with a preview URL to check a branch):

```
SITE=https://in-your-sky.ezequiel-baruf.workers.dev
curl -sI $SITE/ | grep -iE 'content-security-policy|referrer-policy|permissions-policy'
curl -sI $SITE/assets/$(curl -s $SITE/ | grep -oE 'assets/[^"]+\.js' | head -1 | cut -d/ -f2) | grep -i cache-control
```

The app makes requests only to its own origin and to the hosts named in `connect-src`
(CelesTrak and Open-Meteo). There is no analytics or tracking (spec FR-X-3); Workers
observability is off in `wrangler.jsonc`.

## Repository metadata

`docs/RELEASE.md` §10 carries the description, the topics, the homepage URL and the social
preview image path (FR-PUB-11). They are set in the GitHub UI and cannot be set from the
tree.
