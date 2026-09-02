import { z } from 'zod';

/**
 * The one place `zod` enters the app (PLAN D-26). zod 4 compiles object
 * parsers with `new Function` and probes for it once with a caught call; under
 * the strict CSP (`script-src 'self'`, no `unsafe-eval`) the probe itself is
 * reported as a `securitypolicyviolation` even though the throw is swallowed.
 * `jitless` skips the probe and the compiled fast path. It is read when a
 * schema is *built*, so every schema module must import `z` from here rather
 * than from `zod` directly, which makes this call run first.
 */
z.config({ jitless: true });

export { z };
