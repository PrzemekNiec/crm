import type { CSSProperties } from "react";

/**
 * Glass-morphism styles that react to the current theme via CSS custom properties.
 * Replace all local `const GLASS = { ... }` with imports from this module.
 */

export const GLASS: CSSProperties = {
  background: "var(--glass-bg)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid var(--glass-border)",
  boxShadow: "0 8px 32px 0 var(--glass-shadow)",
};

export const GLASS_CARD: CSSProperties = {
  background: "var(--glass-card-bg)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid var(--glass-card-border)",
  boxShadow: "0 4px 20px 0 var(--glass-shadow)",
};
