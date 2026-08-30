// Surface marks — inline SVG marks for each of the six product
// surfaces. 24x24, currentColor so the .rcp-surface-mark class can
// shift them from gray to indigo on card hover.

type MarkProps = { className?: string };

export function SurfaceMarkPipeline({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <path d="M3 7h6l-2-2M21 17h-6l2 2M3 12h18M9 12l3 4 3-4M9 12l3-4 3 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SurfaceMarkPages({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="11" y="3" width="6" height="6" rx="1" />
      <rect x="19" y="3" width="2" height="6" rx="1" />
      <rect x="3" y="11" width="6" height="6" rx="1" />
      <rect x="11" y="11" width="6" height="6" rx="1" />
      <rect x="19" y="11" width="2" height="6" rx="1" />
      <rect x="3" y="19" width="6" height="2" rx="1" />
      <rect x="11" y="19" width="6" height="2" rx="1" />
    </svg>
  );
}

export function SurfaceMarkTable({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
      <line x1="3" y1="3" x2="3" y2="21" />
      <line x1="14" y1="3" x2="14" y2="21" />
    </svg>
  );
}

export function SurfaceMarkDrawer({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="6" y1="9" x2="9" y2="9" strokeLinecap="round" />
      <line x1="6" y1="13" x2="9" y2="13" strokeLinecap="round" />
      <line x1="15" y1="9" x2="18" y2="9" strokeLinecap="round" />
      <line x1="15" y1="13" x2="18" y2="13" strokeLinecap="round" />
    </svg>
  );
}

export function SurfaceMarkTimeline({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
      <circle cx="6" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="18" cy="12" r="1.5" fill="currentColor" />
      <line x1="6" y1="8" x2="6" y2="16" strokeLinecap="round" />
      <line x1="18" y1="8" x2="18" y2="16" strokeLinecap="round" />
    </svg>
  );
}

export function SurfaceMarkSignal({ className }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <path d="M3 12h3l2-5 3 10 2-5h8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}