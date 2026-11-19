tzdata 2026f, from https://data.iana.org/time-zones/tzdata-latest.tar.gz (downloaded 2026-11-18).

`zone.tab`, `zone1970.tab` and `backward` are copied unchanged (`zone.tab` added 2026-11-19 from the same release, V216-15). The tz data is in the public domain (tzdata's `LICENSE`).
`scripts/build-zones.ts` reads them to write `src/data/zones/zones.txt` (PLAN D-1173); nothing here ships.
To update: replace the three files from a newer release, change the version above, and run `npm run build:zones`.
