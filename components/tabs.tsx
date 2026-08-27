// Phase 3.1 — Tabs component.
//
// Pinned by docs/ui-mockups.md:
//   - 4 tabs: Summary (default) · Claims · Authors · Audit
//   - Audit is a <a href> link to /paper/:slug/audit (Phase 5 wires the
//     live audit table; the link is live today but the page is a
//     timeline-only view until Phase 5)
//   - The active tab is controlled by the parent (LiveCockpit) so the
//     cockpit can pick a default for live vs seed
//   - Tabs are buttons that call onChange; the Audit tab is the
//     exception (it navigates away, so it is a link).

import type { ReactNode } from "react";

export type TabId = "summary" | "claims" | "authors" | "audit";
export type TabPanels = Record<TabId, ReactNode>;

const TAB_ORDER: TabId[] = ["summary", "claims", "authors", "audit"];
const TAB_LABEL: Record<TabId, string> = {
  summary: "Summary",
  claims: "Claims",
  authors: "Authors",
  audit: "Audit",
};

export function Tabs({
  slug,
  active,
  onChange,
  panels,
}: {
  slug: string;
  active: TabId;
  onChange: (next: TabId) => void;
  panels: TabPanels;
}) {
  return (
    <div className="mt-6" data-testid="tabs">
      <div role="tablist" className="flex gap-1 border-b border-[var(--border)]">
        {TAB_ORDER.map((id) => {
          const label = TAB_LABEL[id];
          const isActive = id === active;
          if (id === "audit") {
            return (
              <a
                key={id}
                role="tab"
                href={`/paper/${slug}/audit`}
                aria-selected={isActive}
                data-testid={`tab-${id}`}
                className={
                  "px-3 py-1.5 text-sm rounded-t " +
                  (isActive
                    ? "border border-b-0 border-[var(--border)] bg-[var(--panel)] text-[var(--accent)]"
                    : "text-[var(--muted)] hover:text-[var(--fg)]")
                }
              >
                {label}
              </a>
            );
          }
          return (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={isActive}
              data-testid={`tab-${id}`}
              onClick={() => onChange(id)}
              className={
                "px-3 py-1.5 text-sm rounded-t " +
                (isActive
                  ? "border border-b-0 border-[var(--border)] bg-[var(--panel)] text-[var(--accent)]"
                  : "text-[var(--muted)] hover:text-[var(--fg)]")
              }
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="mt-3" data-testid={`tab-panel-${active}`}>
        {panels[active]}
      </div>
    </div>
  );
}
