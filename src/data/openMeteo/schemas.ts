import { z } from '../zod';

/**
 * The Open-Meteo forecast response for the PLAN §7.3 request
 * (`timeformat=unixtime`, four hourly cloud variables). Only the fields the
 * app reads are pinned; the rest of the body is ignored. Values can be
 * `null` for hours the model has no data for.
 */
const pctSeries = z.array(z.number().nullable());

export const forecastResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string().min(1),
  timezone_abbreviation: z.string().optional(),
  utc_offset_seconds: z.number().optional(),
  hourly: z.object({
    time: z.array(z.number()),
    cloud_cover: pctSeries,
    cloud_cover_low: pctSeries.optional(),
    cloud_cover_mid: pctSeries.optional(),
    cloud_cover_high: pctSeries.optional(),
  }),
});
export type ForecastResponse = z.infer<typeof forecastResponseSchema>;

/** Open-Meteo's error body (HTTP 400): `{ "error": true, "reason": "..." }`. */
export const forecastErrorSchema = z.object({ error: z.literal(true), reason: z.string() });

/** A `WeatherSnapshot` as stored in `localStorage` (`wiys:wx:v1`); anything else is dropped. */
export const storedSnapshotSchema = z.object({
  provider: z.literal('open-meteo'),
  lat: z.number(),
  lon: z.number(),
  cellKey: z.string(),
  fetchedAt: z.number(),
  timeZone: z.string().min(1),
  hourly: z.array(
    z.object({
      t: z.number(),
      totalPct: z.number(),
      lowPct: z.number().optional(),
      midPct: z.number().optional(),
      highPct: z.number().optional(),
    }),
  ),
});
export type StoredSnapshot = z.infer<typeof storedSnapshotSchema>;
export const storedCacheSchema = z.record(z.string(), storedSnapshotSchema);
