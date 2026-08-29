export function BrandFooter() {
  return (
    <footer className="border-t border-[var(--color-border)] mt-16">
      <div className="page-wide py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--color-muted-foreground)]">
        <span>
          Powered by <a href="https://trueforge.dev" className="underline">TrueForge</a> · Daytona · GMI · Qodo
        </span>
        <span>
          <a href="https://github.com/OnSyncLabs/Openwrite" className="underline">Source</a>
          {" · "}
          <a href="https://github.com/OnSyncLabs/Openwrite/blob/main/app/globals.css" className="underline">Design tokens</a>
        </span>
      </div>
    </footer>
  );
}
