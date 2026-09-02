/**
 * MSW handlers shared by both Vitest projects (PLAN §9.1, §9.3): CelesTrak is
 * routed to the dated OMM fixture; anything else is an error. `CATNR` requests
 * are rejected so FR-SAT-2's "never per object" rule is enforced in tests.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ElementGroup, OmmRecord } from '../../src/model';

export const OMM_FIXTURE_DATE = '2026-09-02';
export const CELESTRAK_GP = 'https://celestrak.org/NORAD/elements/gp.php';

export function ommFixturePath(group: ElementGroup, date: string = OMM_FIXTURE_DATE): string {
  return join(process.cwd(), 'tests', 'fixtures', 'omm', `${date}-${group}.json`);
}

export function loadOmmFixture(group: ElementGroup, date?: string): OmmRecord[] {
  return JSON.parse(readFileSync(ommFixturePath(group, date), 'utf8')) as OmmRecord[];
}

export const celestrakHandlers = [
  http.get(CELESTRAK_GP, ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.has('CATNR')) return HttpResponse.text('per-object requests are forbidden (FR-SAT-2)', { status: 400 });
    const group = url.searchParams.get('GROUP');
    if (group !== 'stations' && group !== 'visual') return HttpResponse.text('unknown group', { status: 404 });
    if (url.searchParams.get('FORMAT') !== 'json') return HttpResponse.text('only FORMAT=json is fixtured', { status: 400 });
    return HttpResponse.json(loadOmmFixture(group));
  }),
];

export const server = setupServer(...celestrakHandlers);
