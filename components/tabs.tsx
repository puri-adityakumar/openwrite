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
//
// Workspace redesign (3-pane cockpit): the tab set is now configurable
// via the optional `order`/`labels` props. The default is unchanged
// (Summary · Claims · Authors · Audit) so the existing contract keeps
// passing; the analysis pane passes its own set (Summary · Claims ·
// Graphs · Audit) and folds Authors into the Summary panel.

import type { ReactNode } from "react";

export type TabId = "summary" | "claims" | "authors" | "graphs" | "audit";
export type TabPanels = Partial<Record<TabId, ReactNode>>;

const TAB_ORDER: TabId[] = ["summary", "claims", "authors", "audit"];
const TAB_LABEL: Record<TabId, string> = {
  summary: "Summary",
  claims: "Claims",
  authors: "Authors",
  graphs: "Graphs",
  audit: "Audit",
};

export function Tabs({
  slug,
  active,
  onChange,
  panels,
  order = TAB_ORDER,
  labels = TAB_LABEL,
}: {
  slug: string;
  active: TabId;
  onChange: (next: TabId) => void;
  panels: TabPanels;
  order?: TabId[];
  labels?: Record<TabId, string>;
}) {
  return (
    <div data-testid="tabs">
      <div role="tablist" className="flex gap-1 border-b border-[var(--color-border)]">
        {order.map((id) => {
          const label = labels[id];
          const isActive = id === active;
          const baseClass =
            "px-3 py-2 text-sm font-heading border-b-2 -mb-px transition-colors";
          const stateClass = isActive
            ? "border-[var(--accent-indigo)] text-[var(--color-foreground)] font-semibold"
            : "border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] font-medium";
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
