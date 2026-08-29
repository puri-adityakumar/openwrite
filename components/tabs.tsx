// Phase 3.1 — Tabs component (new design system).
//
// Pinned by docs/ui-mockups.md:
//   - 4 tabs: Summary (default) · Claims · Authors · Audit
//   - Audit is a <a href> link to /paper/:slug/audit
//   - The active tab is controlled by the parent (LiveCockpit) so the
//     cockpit can pick a default for live vs seed
//   - Tabs are buttons that call onChange; the Audit tab navigates away,
//     so it is a link.
//   - Style: a 1px bottom border underlines the whole tab bar; the
//     active tab flips the bottom border to ink and the label to
//     ink, with a thin underline on top of the bar.

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
    <div data-testid="tabs">
      <div role="tablist" className="flex gap-1 border-b border-[var(--color-border)]">
        {TAB_ORDER.map((id) => {
          const label = TAB_LABEL[id];
          const isActive = id === active;
          const baseClass =
            "px-3 py-1.5 text-sm font-sans border-b-2 -mb-px transition-colors";
          const stateClass = isActive
            ? "border-[var(--color-foreground)] text-[var(--color-foreground)] font-medium"
            : "border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]";
          if (id === "audit") {
            return (
              <a
                key={id}
                role="tab"
                href={`/paper/${slug}/audit`}
                aria-selected={isActive}
                data-testid={`tab-${id}`}
                className={`${baseClass} ${stateClass} no-underline`}
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
              className={`${baseClass} ${stateClass} bg-transparent`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="mt-4" data-testid={`tab-panel-${active}`}>
        {panels[active]}
      </div>
    </div>
  );
}
