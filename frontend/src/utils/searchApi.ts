import { api } from './api';
import { getImageUrl } from './getImageUrl';

export interface SearchSuggestionProduct {
  name: string;
  slug: string;
  brand: string;
  image?: string | null;
  min_price: number;
  max_price: number;
}

export interface SearchSuggestions {
  history: string[];
  products: SearchSuggestionProduct[];
}

// ─── Debounce + AbortController ───────────────────────────────────────────────
// We keep a single abort controller ref so every new keystroke cancels the
// previous in-flight request before firing a new one.
// The debounce timer lives here so the hook in Header.tsx stays clean.

let _abortController: AbortController | null = null;
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced suggestions fetch.
 *
 * - Waits `delay` ms after the last call before hitting the network.
 * - Cancels any previous in-flight request via AbortController.
 * - Returns a stable Promise; resolves with null if the call was superseded.
 *
 * @param query  Search string (empty = show history only)
 * @param delay  Debounce wait in ms (default 400)
 */
export function fetchSuggestions(
  query: string,
  delay = 400,
): Promise<SearchSuggestions | null> {
  // Clear previous debounce timer
  if (_debounceTimer !== null) {
    clearTimeout(_debounceTimer);
  }

  return new Promise((resolve, reject) => {
    _debounceTimer = setTimeout(async () => {
      // Cancel the previous in-flight HTTP request
      if (_abortController) {
        _abortController.abort();
      }
      _abortController = new AbortController();

      try {
        const res = await api.get<SearchSuggestions>('/search/suggestions', {
          params: { q: query },
          signal: _abortController.signal,
        });

        const data: SearchSuggestions = {
          ...res.data,
          products: res.data.products.map((p) => ({
            ...p,
            image: p.image ? getImageUrl(p.image) : null,
          })),
        };
        resolve(data);
      } catch (err: any) {
        // Cancelled requests are NOT errors — resolve with null so the caller
        // knows to simply keep the previous suggestions on screen.
        if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
          resolve(null);
        } else {
          reject(err);
        }
      }
    }, delay);
  });
}

export const searchApi = {
  /**
   * Immediate (non-debounced) suggestions fetch.
   * Prefer `fetchSuggestions()` for keystroke-driven calls.
   */
  suggestions: async (query?: string): Promise<SearchSuggestions> => {
    const res = await api.get<SearchSuggestions>('/search/suggestions', {
      params: { q: query ?? '' },
    });
    return {
      ...res.data,
      products: res.data.products.map((p) => ({
        ...p,
        image: p.image ? getImageUrl(p.image) : null,
      })),
    };
  },

  /**
   * Fire-and-forget search log.
   * Only called on explicit submit (Enter / Search button / item click).
   */
  log: async (query: string): Promise<void> => {
    // Swallow errors — logging should never block UX
    await api.post('/search/history', { query }).catch(() => undefined);
  },
};