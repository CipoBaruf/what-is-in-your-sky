/**
 * R14 spike items 5 and 6: a production build of the dome alone, code-split
 * behind `React.lazy` the way R15 will split it, so `rollup-plugin-visualizer`
 * reports the gzipped chart chunk, and `vite preview` serves it under the
 * strict CSP from `public/_headers` to see what the colour mode and the
 * library's own style injection do under `style-src 'self'`.
 */
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import '../spike.css';

const DomeChunk = lazy(() => import('./DomeChunk'));

const root = document.getElementById('root');
if (!root) throw new Error('no #root');
createRoot(root).render(
  <StrictMode>
    <Suspense fallback={<p>loading…</p>}>
      <DomeChunk />
    </Suspense>
  </StrictMode>,
);
