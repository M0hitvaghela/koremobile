/**
 * Cashfree JS SDK v3 integration.
 * Uses CDN: https://sdk.cashfree.com/js/v3/cashfree.js
 * Add this to your index.html <head>:
 *   <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
 */

declare global {
  interface Window {
    Cashfree: (config: { mode: 'sandbox' | 'production' }) => CashfreeInstance;
  }
}

interface CashfreeInstance {
  checkout: (options: {
    paymentSessionId: string;
    redirectTarget?: '_self' | '_blank' | '_top' | '_modal';
  }) => Promise<{ error?: { message: string }; redirect?: boolean }>;
}

let cashfreeInstance: CashfreeInstance | null = null;

export function initCashfree(): CashfreeInstance | null {
  if (typeof window === 'undefined' || !window.Cashfree) {
    console.error('[Cashfree] SDK not loaded. Add the script tag to index.html.');
    return null;
  }
  const mode = (import.meta.env.VITE_CASHFREE_ENV as 'sandbox' | 'production') || 'sandbox';
  cashfreeInstance = window.Cashfree({ mode });
  return cashfreeInstance;
}

/**
 * Open Cashfree payment checkout.
 * Redirects user to Cashfree-hosted payment page.
 * On success/failure Cashfree redirects to order_meta.return_url.
 */
export async function openCashfreeCheckout(paymentSessionId: string): Promise<void> {
  const cf = cashfreeInstance || initCashfree();
  if (!cf) {
    throw new Error('Cashfree SDK not available');
  }

  const result = await cf.checkout({
    paymentSessionId,
    redirectTarget: '_self',  // redirect in same tab
  });

  if (result?.error) {
    throw new Error(result.error.message || 'Payment failed');
  }
  // If redirect is true, the browser is navigating — nothing more needed
}