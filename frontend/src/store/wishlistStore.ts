/**
 * wishlistStore.ts — DB-backed wishlist with optimistic UI
 *
 * Strategy:
 *  - Logged-in users  → all state lives in DB; store is just a cache.
 *  - Guest users      → items stored in localStorage (same as before).
 *  - On login         → call syncAfterLogin() to push local items to DB.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { wishlistApi, WishlistData } from '../utils/wishlistApi';

interface WishlistStore {
  // ── Server state (logged-in) ──────────────────────────────────────────────
  serverWishlist: WishlistData | null;
  isLoading: boolean;

  // ── Guest state (local-only, persisted to localStorage) ──────────────────
  guestItems: string[];   // product IDs as strings

  // ── Actions ───────────────────────────────────────────────────────────────

  /** Load wishlist from server (call on mount when user is logged in) */
  fetchWishlist: () => Promise<void>;

  /**
   * Toggle a product. Works for both logged-in and guest users.
   * Pass isLoggedIn=true when user is authenticated.
   */
  toggle: (productId: string, isLoggedIn: boolean) => Promise<void>;

  /** Is a product wishlisted? Works for both modes. */
  isWishlisted: (productId: string) => boolean;

  /** Rename wishlist (logged-in only) */
  updateTitle: (title: string) => Promise<void>;

  /** Toggle share link on/off (logged-in only) */
  updateVisibility: (isPublic: boolean) => Promise<void>;

  /** Clear entire wishlist (logged-in only) */
  clearWishlist: () => Promise<void>;

  /**
   * After login: push any guest items to DB, then load server wishlist.
   * Call this from your auth store right after a successful login.
   */
  syncAfterLogin: () => Promise<void>;

  /** After logout: clear server state (guest items stay in localStorage) */
  clearServerState: () => void;
}

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      serverWishlist: null,
      isLoading: false,
      guestItems: [],

      // ── fetchWishlist ────────────────────────────────────────────────────
      fetchWishlist: async () => {
        set({ isLoading: true });
        try {
          const data = await wishlistApi.getMyWishlist();
          set({ serverWishlist: data, isLoading: false });
        } catch {
          set({ isLoading: false });
        }
      },

      // ── isWishlisted ─────────────────────────────────────────────────────
      isWishlisted: (productId: string) => {
        const { serverWishlist, guestItems } = get();
        if (serverWishlist) {
          return serverWishlist.items.some(
            (item) => String(item.product_id) === productId
          );
        }
        return guestItems.includes(productId);
      },

      // ── toggle ───────────────────────────────────────────────────────────
      toggle: async (productId: string, isLoggedIn: boolean) => {
        if (!isLoggedIn) {
          // Guest mode — local only
          const { guestItems } = get();
          set({
            guestItems: guestItems.includes(productId)
              ? guestItems.filter((id) => id !== productId)
              : [...guestItems, productId],
          });
          return;
        }

        // Logged-in mode — optimistic update then sync
        const { serverWishlist } = get();
        const alreadyWishlisted = serverWishlist?.items.some(
          (item) => String(item.product_id) === productId
        );

        // Optimistic: flip immediately in local state
        if (serverWishlist) {
          const optimistic: WishlistData = alreadyWishlisted
            ? {
                ...serverWishlist,
                items: serverWishlist.items.filter(
                  (i) => String(i.product_id) !== productId
                ),
                item_count: serverWishlist.item_count - 1,
              }
            : {
                ...serverWishlist,
                // We add a placeholder; fetchWishlist will replace with real data
                items: [
                  ...serverWishlist.items,
                  {
                    id: -1,
                    product_id: Number(productId),
                    added_at: new Date().toISOString(),
                    product: {} as any,
                  },
                ],
                item_count: serverWishlist.item_count + 1,
              };
          set({ serverWishlist: optimistic });
        }

        try {
          let updated: WishlistData;
          if (alreadyWishlisted) {
            updated = await wishlistApi.removeItem(Number(productId));
          } else {
            updated = await wishlistApi.addItem(Number(productId));
          }
          set({ serverWishlist: updated });
        } catch {
          // Revert optimistic on failure — re-fetch
          try {
            const fresh = await wishlistApi.getMyWishlist();
            set({ serverWishlist: fresh });
          } catch {
            // network gone, leave optimistic state
          }
        }
      },

      // ── updateTitle ──────────────────────────────────────────────────────
      updateTitle: async (title: string) => {
        try {
          const updated = await wishlistApi.updateTitle(title);
          set({ serverWishlist: updated });
        } catch {
          // ignore — title non-critical
        }
      },

      // ── updateVisibility ─────────────────────────────────────────────────
      updateVisibility: async (isPublic: boolean) => {
        try {
          const updated = await wishlistApi.updateVisibility(isPublic);
          set({ serverWishlist: updated });
        } catch {
          // ignore
        }
      },

      // ── clearWishlist ────────────────────────────────────────────────────
      clearWishlist: async () => {
        const { serverWishlist } = get();
        if (!serverWishlist) return;

        // Optimistic clear
        set({
          serverWishlist: { ...serverWishlist, items: [], item_count: 0 },
        });

        try {
          await wishlistApi.clearAll();
        } catch {
          // Revert
          set({ serverWishlist });
        }
      },

      // ── syncAfterLogin ───────────────────────────────────────────────────
      syncAfterLogin: async () => {
        const { guestItems } = get();
        set({ isLoading: true });
        try {
          // Push each guest item to DB (backend deduplicates)
          for (const productId of guestItems) {
            try {
              await wishlistApi.addItem(Number(productId));
            } catch {
              // product may have been deleted — skip
            }
          }
          // Load final server state
          const data = await wishlistApi.getMyWishlist();
          set({ serverWishlist: data, guestItems: [], isLoading: false });
        } catch {
          set({ isLoading: false });
        }
      },

      // ── clearServerState ─────────────────────────────────────────────────
      clearServerState: () => {
        set({ serverWishlist: null });
      },
    }),
    {
      name: 'koremobile-wishlist',
      // Only persist guestItems — serverWishlist is always re-fetched
      partialize: (state) => ({ guestItems: state.guestItems }),
    }
  )
);