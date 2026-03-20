/**
 * URL for files in `public/` when the app is hosted under a subpath (e.g. GitHub Pages: /lore/).
 * Set NEXT_PUBLIC_BASE_PATH=/lore at build. Leave unset for root deploys (Vercel, localhost).
 */
export function publicAssetPath(path) {
  const base = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}
