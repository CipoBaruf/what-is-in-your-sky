import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import { createNodeResolver, flatConfigs as importX } from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// PLAN §11: typescript-eslint strict + react-hooks. R5 adds the PLAN §3
// module-boundary rules (`import-x/no-restricted-paths`, one zone per row of
// the table), the `Date` ban for the deterministic directories (§9.3, D-15)
// and the app-wide ban on canvas / WebGL modules (FR-GUIDE-5). Test files are
// exempt from the boundary rules: a test may wire anything together.

const SRC = ['src/**/*.{ts,tsx}'];
const TESTS = ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'];
const DOME = 'src/ui/components/guide/skychart/dome/**';

/** FR-GUIDE-5: the charts are DOM text and SVG only; nothing may pull in a canvas or WebGL renderer. */
const NO_CANVAS_WEBGL = { group: ['*canvas*', '*webgl*'], caseSensitive: false, message: 'No canvas / WebGL (FR-GUIDE-5, PLAN §3).' };
/** D-16: `@glyphcss/react` is confined to the dome directory. */
const NO_GLYPHCSS = { name: '@glyphcss/react', message: `Only ${DOME} may import @glyphcss/react (PLAN §3, D-16).` };
const NO_REACT = { group: ['react', 'react-dom', 'react/*', 'react-dom/*'], message: 'This directory must not import React (PLAN §3).' };

/** `no-restricted-imports` is not merged across config blocks, so every block restates the app-wide bans. */
const restrictedImports = (extra = {}) => [
  'error',
  { paths: [NO_GLYPHCSS, ...(extra.paths ?? [])], patterns: [NO_CANVAS_WEBGL, ...(extra.patterns ?? [])] },
];

const zone = (target, from, except) => ({ target: `./${target}`, from: `./${from}`, ...(except ? { except } : {}), message: `${target} must not import ${from} (PLAN §3).` });

export default defineConfig([
  globalIgnores(['dist/', 'node_modules/', 'coverage/', 'playwright-report/', 'test-results/']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.strict, tseslint.configs.stylistic, reactHooks.configs.flat.recommended],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      '@typescript-eslint/no-restricted-imports': restrictedImports(),
    },
  },
  {
    // PLAN §3 dependency rules, one zone per table row. `except` paths are relative to `from`.
    files: SRC,
    ignores: TESTS,
    extends: [importX.recommended, importX.typescript],
    settings: { 'import-x/resolver-next': [createNodeResolver({ extensions: ['.ts', '.tsx', '.js', '.json'] })] },
    rules: {
      'import-x/no-unresolved': 'off', // the TypeScript compiler already checks this
      'import-x/no-restricted-paths': [
        'error',
        {
          basePath: import.meta.dirname,
          zones: [
            zone('src/physics', 'src/data'),
            zone('src/physics', 'src/state'),
            zone('src/physics', 'src/ui'),
            zone('src/physics', 'src/worker'),
            zone('src/physics', 'src/lib'),
            zone('src/worker', 'src/data'),
            zone('src/worker', 'src/state'),
            zone('src/worker', 'src/ui'),
            zone('src/worker', 'src/lib'),
            zone('src/data', 'src/state'),
            zone('src/data', 'src/ui'),
            zone('src/data', 'src/worker'),
            zone('src/data', 'src/lib'),
            zone('src/data', 'src/physics', ['./time.ts']), // D-21: the dependency-free epoch parser
            zone('src/state', 'src/ui'),
            zone('src/state', 'src/physics', ['./constants.ts']), // D-27: the thresholds the protocol carries
            zone('src/state', 'src/worker', ['./protocol.ts']), // types only; the worker file is referenced by URL
            zone('src/lib', 'src/state'),
            zone('src/lib', 'src/data'),
            zone('src/lib', 'src/ui'),
            zone('src/lib', 'src/worker'),
            zone('src/ui', 'src/data'),
            zone('src/ui', 'src/worker'),
            zone('src/ui', 'src/physics'),
            zone('src/model', 'src', ['./model']), // shared types import nothing but each other
          ],
        },
      ],
    },
  },
  {
    // Directories that must not import React at all (PLAN §3).
    files: ['src/physics/**', 'src/worker/**', 'src/data/**', 'src/lib/**', 'src/model/**'],
    ignores: TESTS,
    rules: { '@typescript-eslint/no-restricted-imports': restrictedImports({ patterns: [NO_REACT] }) },
  },
  {
    // `src/lib` may use physics types only (PLAN §3).
    files: ['src/lib/**'],
    ignores: TESTS,
    rules: {
      '@typescript-eslint/no-restricted-imports': restrictedImports({
        patterns: [NO_REACT, { group: ['**/physics/**', '**/physics'], allowTypeImports: true, message: 'src/lib may import physics types only (PLAN §3).' }],
      }),
    },
  },
  {
    // PLAN §9.3 / D-15: time enters as a parameter; nothing here may read the clock.
    files: ['src/physics/**', 'src/worker/**', 'src/lib/**'],
    ignores: [...TESTS, 'src/physics/time.ts'], // time.ts is the epoch-ms <-> Date converter itself
    rules: { 'no-restricted-globals': ['error', { name: 'Date', message: 'No Date in src/physics, src/worker or src/lib: time is a parameter (PLAN D-15, §9.3).' }] },
  },
  {
    // The only place @glyphcss/react may be imported (PLAN §3, D-16).
    files: [DOME],
    rules: { '@typescript-eslint/no-restricted-imports': ['error', { patterns: [NO_CANVAS_WEBGL] }] },
  },
]);
