import { readFileSync } from 'node:fs';

// Read the actual global import order. A missing/empty inventory is an error,
// never a way for a source gate to pass after moving its declarations.
export function readGlobalCss() {
  const app = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
  const imports = [...app.matchAll(/^import "\.\/(.*\.css)";/gm)].map(m => m[1]);
  if (!imports.length) throw new Error('No global CSS imports found');
  return imports.map(file => readFileSync(new URL(`../../src/${file}`, import.meta.url), 'utf8')).join('\n');
}
