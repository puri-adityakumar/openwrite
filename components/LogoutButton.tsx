"use client";

// LogoutButton — icon-only square that matches the GitHub and
// theme-toggle buttons in BrandHeader's right cluster. Same 40px
// square, same hairline border, same hover transition. Glyph is
// a door-and-arrow drawn inline so we don't add an icon dep.

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({ email }: { email?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Even if the request fails, send the user to the auth page so the
      // UI matches the (presumed) cleared cookie.
    }
    router.push("/auth");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={email ? `Sign out ${email}` : "Sign out"}
      title={email ? `Sign out ${email}` : "Sign out"}
      className="navbar-icon-btn"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* door frame */}
        <path d="M14 3h-6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" />
        {/* arrow shaft going right */}
        <path d="M10 17l5-5-5-5" />
        {/* arrow head */}
        <path d="M15 12H9" />
      </svg>
    </button>
  );
}