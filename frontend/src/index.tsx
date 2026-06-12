import "./index.css";
import { createRoot } from "react-dom/client";
import { App } from "./App";

// ── One-time migration: clear old localStorage-persisted store data ──────────
// Previous versions persisted cart & products with DUMMY data (IDs like 'v1').
// These must be wiped so they don't re-hydrate stale entries.
const STALE_KEYS = ["koremobile-cart", "koremobile-products"];
STALE_KEYS.forEach((key) => localStorage.removeItem(key));

const rootEl = document.getElementById("root");
if (!rootEl) {
	throw new Error("Root element not found");
}

createRoot(rootEl).render(<App />);