import type { BalanceStatus } from 'loom';

/** Display label per balance status — the actual comparison, envelope
 * mapping and threshold policy are engine-side domain logic (see
 * src/entities/balance.ts); this is only the label layer, the same split
 * eligibility.ts uses over engine/prerequisites.ts. Colors are static CSS
 * classes (.status-in/.status-watch/.status-off in provenance.page.ts),
 * matching the .status-valid/.status-invalid pattern already used by
 * entities/[id].page.ts, rather than JS-driven inline styles. */
export const STATUS_LABEL: Record<BalanceStatus, string> = {
  in: 'in envelope',
  watch: 'watch',
  off: 'off envelope',
};
