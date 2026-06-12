/**
 * getImageUrl — converts a relative backend image path to a full URL.
 *
 * The backend stores images as:  /static/products/abc123.jpg
 * The frontend runs on port 5173, the backend on port 8000.
 * Rendering <img src="/static/products/abc123.jpg"> tries to load from
 * the frontend origin (5173) — which 404s.
 *
 * This helper prepends the backend base host so the browser fetches
 * from http://127.0.0.1:8000/static/products/abc123.jpg
 */

function getBackendHost(): string {
  const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (apiBase) {
    // e.g. "http://127.0.0.1:8000/api/v1"  →  "http://127.0.0.1:8000"
    try {
      const u = new URL(apiBase);
      return u.origin; // "http://127.0.0.1:8000"
    } catch {
      // fall through
    }
  }
  return 'http://127.0.0.1:8000';
}

/**
 * Returns a fully-qualified image URL.
 * - If `url` is already absolute (starts with http/https) it is returned as-is.
 * - If `url` is relative (e.g. "/static/products/xxx.jpg") the backend host
 *   is prepended.
 * - If `url` is null/undefined/empty, returns an empty string (render a
 *   placeholder in your component instead of a broken image).
 */
export function getImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // relative path — prepend backend origin
  return `${getBackendHost()}${url.startsWith('/') ? '' : '/'}${url}`;
}