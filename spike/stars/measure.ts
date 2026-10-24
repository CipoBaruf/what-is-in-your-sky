/**
 * R111 (D-741): every number the spike can take without a phone, into
 * `docs/stars/measurements.md`, which `FINDINGS.md` quotes: the catalogue at
 * 4.5 (and at 5.5, V24-3's road not taken), the precession path against the
 * fixtures, the rate by D-62's method, the ink offsets, and the captures.
 *
 *   npm run spike:stars:measure
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe as describeCatalog, measureCatalog } from './catalog';
import { capture } from './capture';
import { describe as describePerf, measurePerf } from './perf';
import { describe as describePrecession, measurePrecession } from './precession';

const wider = describeCatalog(measureCatalog(5.5));
const catalog = describeCatalog(measureCatalog(4.5));
const precession = describePrecession(measurePrecession());
const perf = describePerf(await measurePerf());
const shots = await capture();

const out = resolve('docs/stars');
mkdirSync(out, { recursive: true });
writeFileSync(
  resolve(out, 'measurements.md'),
  `# Stars spike: measurements

Written by \`npm run spike:stars:measure\` (R111, PLAN D-741). \`FINDINGS.md\` quotes it; the phone's numbers are there, not here.

## The catalogue (item 1)

\`\`\`
${catalog}
\`\`\`

For comparison, V24-3's 5.5:

\`\`\`
${wider}
\`\`\`

## The precession path (item 3)

\`\`\`
${precession}
\`\`\`

## The rate, by D-62's method (item 2)

${perf}

## The captures (item 4)

${shots.map((name) => `- [\`${name}\`](captures/${name})`).join('\n')}
`,
);
console.log(`docs/stars/measurements.md: ${String(shots.length)} captures`);
