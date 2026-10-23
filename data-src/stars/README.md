# Star sources (v2.4)

The raw files `scripts/build-stars.ts` reads to write `src/data/stars/catalog.json` (SPEC FR-STAR-1). They are committed by the owner once, because task sessions have no network (V22-17's reason). They are never fetched at build time and never shipped as they are.

Retrieved 2026-10-23.

| File | What it is | Source | Licence |
|---|---|---|---|
| `bsc5-catalog.gz` | Yale Bright Star Catalogue, 5th revised edition (Hoffleit & Warren, 1991), 9110 records, fixed-width, as CDS ships it | https://cdsarc.cds.unistra.fr/ftp/V/50/catalog.gz | Public domain |
| `bsc5-ReadMe.txt` | The byte-by-byte format of the catalogue | https://cdsarc.cds.unistra.fr/ftp/V/50/ReadMe | Public domain |
| `d3-celestial-constellations.lines.json` | The constellation figures as GeoJSON line strings in RA/Dec degrees (89 features: Serpens is drawn as two) | https://github.com/ofrohn/d3-celestial, `data/constellations.lines.json` | BSD-3-Clause, `d3-celestial-LICENSE.txt` |
| `d3-celestial-LICENSE.txt` | That licence | https://github.com/ofrohn/d3-celestial, `LICENSE` | — |
| `iau-csn.txt` | The IAU WGSN catalogue of star names, fixed-width, joined to the catalogue by HD number | https://www.pas.rochester.edu/~emamajek/WGSN/IAU-CSN.txt | CC BY 4.0 |

Checked on retrieval: 904 records with V ≤ 4.5; every one of the figures' 893 endpoints is within 0.1° of a catalogue star (OQ-39's default and its test bound).

SHA-256:

```
3dc44b1e90be8fbe5bcc7656032560f51275f985c7e3f783c9028e1838ec7bed  bsc5-catalog.gz
44fd9c73e2eecad0beb47bdfa3f01c60fd43f93d6964198e31fcd48732de5b33  bsc5-ReadMe.txt
294f66bef5d5cf50b1e17f16d2efa1d97a15131612c68dd935adef6e7373e13c  d3-celestial-constellations.lines.json
a8c79239001ad4bea243d1796b85084e1fc39309c5c5a663930a1b46320254c6  d3-celestial-LICENSE.txt
84fac0c90f1b19abc491c2793469e0caa7b003ad1bc93a790ca41147010d0eb0  iau-csn.txt
```
