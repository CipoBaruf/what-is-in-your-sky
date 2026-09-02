/**
 * R4 (FR-X-3, PLAN D-24): the app's schemas are built with zod's JIT off, so
 * no `new Function` probe or compiled parser runs under the strict CSP.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from './zod';
import { catalogSchema } from './catalog/schema';

describe('src/data/zod', () => {
  it('turns the JIT off before any schema is built', () => {
    expect(z.config().jitless).toBe(true);
    expect(z.core.util.allowsEval.value).toBe(false);
  });

  it('still validates the catalog through the runtime parser', () => {
    const catalog = JSON.parse(readFileSync('src/data/catalog/catalog.json', 'utf8')) as unknown;
    expect(catalogSchema.safeParse(catalog).success).toBe(true);
    expect(catalogSchema.safeParse([{ noradId: 'not a number' }]).success).toBe(false);
  });

  it('is the only module under src that imports zod directly', () => {
    const importers: string[] = [];
    for (const entry of readdirSync('src', { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) continue;
      const path = join(entry.parentPath, entry.name);
      if (/from ['"]zod['"]/.test(readFileSync(path, 'utf8'))) importers.push(path);
    }
    expect(importers).toEqual(['src/data/zod.ts']);
  });
});
