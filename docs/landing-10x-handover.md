# Landing Page — 10x Bolder Pass Handover

## Status

- **Branch:** `feat/landing-redesign` in `/Users/aditya/Projects/openwrite-landing`
- **Commit:** `9bc01cc feat(landing): 10x bolder pass with Fraunces serif, indigo accent, and stateful gate chrome`
- **PR:** #15 (https://github.com/puri-adityakumar/openwrite/pull/15) — pushed, description updated
- **Build:** ✅ `next build` green (25 routes); `tsc --noEmit` clean
- **Tests:** Landing code untouched; 58 vitest failures are all DB/env-dependent (`lib/db.ts` `DATABASE_URL not set`), unrelated to this commit
- **Visual verification:** 10 PNGs in `/tmp/landing-10x-final/` (5 viewports + 5 per-section)

## Direction (one line)

**Same restraint at the system level, but every moment that earns it gets to be loud.**

PR #15 shipped a deliberately restrained editorial design (Raleway 300, muted zebra, no glow, no gradients, no animated type). The 10x pass pushes past "quiet" into confident: bolder type pairing, one bounded accent color, asymmetric layout, stateful interactive chrome, an inverted CTA panel.

## The 5 biggest shifts from PR #15

| # | Shift | Mechanism |
|---|---|---|
| 1 | **Add Fraunces (display serif)** for hero accent, receipt numerals, pull-quote. Raleway promoted 300 → 500. | `next/font/google` self-hosted, variable opsz + wght |
| 2 | **Add deep indigo accent** — first new color in the system. | `var(--accent-indigo)` tokens, reserved for hero word, "REVERSIBLE" chip, surface mark hover, CTA button |
| 3 | **Hero gets asymmetric grid** (6/-1/5 floating). | `grid-cols-12` + `-translate-y-10` on sign-in card |
| 4 | **Gates get stateful chrome** — three real interactive mocks. | HoldToAllow, DiffBar, SaveToggle (new components) |
| 5 | **CTA panel inverts** — full-bleed `--cta-grad`, Fraunces display label, indigo button. | Section V leaves the muted zebra pattern |

## Files added (8)

- `components/landing/Logo.tsx` — brand mark (carried over from prior session)
- `components/landing/hooks/useCountUp.ts` — vanilla rAF tween + IntersectionObserver + snap-to-final
- `components/landing/motion/SignatureBeat.tsx` — hero wipe + Fraunces word fade-up
- `components/landing/motion/HoldToAllow.tsx` — radial progress with `aria-valuenow`
- `components/landing/motion/CounterStat.tsx` — receipt stat wrapper
- `components/landing/motion/PaperMarquee.tsx` — CSS-only marquee band
- `components/landing/surfaces/marks.tsx` — six 24×24 inline SVG marks
- `scripts/screenshot-landing.mjs` — Playwright render harness

## Files modified (9)

- `app/globals.css` — tokens, easing palette, 7 keyframes, utility classes (`.rcp-display`, `.btn-indigo`, `.rcp-cockpit-glow`, `.rcp-cta-panel`, `.rcp-gate-card`, `.card-hoverable`)
- `app/layout.tsx` — Google Fonts import now includes Fraunces
- `components/Landing.tsx` — composes `<PaperMarquee />` between Surfaces and Gates
- `components/landing/CtaSection.tsx` — inverted gradient panel, Fraunces title, indigo button, terminal snippet
- `components/landing/GatesSection.tsx` — HoldToAllow, DiffBar, SaveToggle, severity left border
- `components/landing/Hero.tsx` — asymmetric grid, Fraunces "Recap" + accent underline, floating sign-in card, glow
- `components/landing/ReceiptSection.tsx` — Fraunces italic pull-quote, indigo left-rule, count-up, arrow draw
- `components/landing/SurfacesSection.tsx` — per-surface SVG marks + hover accent + deep-link strip
- `components/landing/landing.css` — pruned to just reveal + cockpit-frame (the rest moved to globals.css)

## Tokens added (globals.css)

```css
/* Type */
--font-serif: 'Fraunces', Georgia, 'Times New Roman', serif;

/* Easing palette */
--ease-out:        cubic-bezier(0.16, 1, 0.3, 1);  /* already there */
--ease-in-out:     cubic-bezier(0.65, 0, 0.35, 1);
--ease-spring:     cubic-bezier(0.34, 1.56, 0.64, 1);
--ease-snap:       cubic-bezier(0.4, 0, 0.2, 1);
--ease-settle:     cubic-bezier(0.22, 1, 0.36, 1);
--ease-quint-out:  cubic-bezier(0.22, 1, 0.36, 1);
--ease-marquee:    linear;

/* Duration vocabulary */
--dur-fast:      200ms;
--dur-base:      400ms;
--dur-reveal:    600ms;
--dur-signature: 1600ms;
--dur-countup:   1100ms;
--dur-hold:      3000ms;

/* Brand accent */
--accent-indigo:        hsl(243 75% 58%);   /* light */
--accent-indigo-hover:  hsl(243 75% 50%);
--accent-indigo-soft:   hsl(243 75% 58% / 0.10);

/* Dark variants (and the @media prefers-color-scheme block) */
--accent-indigo:        hsl(243 90% 70%);   /* dark */
--accent-indigo-hover:  hsl(243 90% 78%);
--accent-indigo-soft:   hsl(243 90% 70% / 0.18);

/* Gradients (two only) */
--receipt-grad: linear-gradient(135deg, indigo-soft, transparent, green-soft);
--cta-grad:     linear-gradient(180deg, dark-indigo, near-black);
```

## Keyframes added (globals.css)

All gated by a matching `prefers-reduced-motion: reduce` block.

| Keyframe | Where | Effect |
|---|---|---|
| `rcp-signature-wipe` | hero cockpit frame | `clip-path: inset(0 100% 0 0)` → `inset(0 0 0 0)`, 1.6s |
| `rcp-underline-draw` | hero "Recap" underline + receipt arrow | `stroke-dashoffset: 100 → 0`, 1.6s + 200ms delay |
| `rcp-rule-fill` | publish diff bars | `scaleX(0 → 1)`, 1.4s |
| `rcp-rule-rise` | receipt left accent rule | `scaleY(0 → 1)` from top, 1.2s |
| `rcp-trail-flow` | hero trail pills | translateX loop, 8s |
| `rcp-caret-blink` | terminal caret | opacity 0↔1, 1.1s |
| `rcp-marquee` | paper-title marquee | translateX 0 → -50%, 48s linear |

## Refuse list (locked)

- **KEEP**: no shadow-on-rest for cards, no neon, no em-dashes, no gradient buttons, AAA contrast floor, 44×44 tap targets
- **SOFTEN**: glow allowed only on hero cockpit frame + CTA button (max 2 glows/page)
- **DROP**: "no animated type", "no glow" (bounded exception)
- **ADD**: no indigo on text < 18px, no glow stacking, no entrance > 1.5s

## Risk callouts (locked from spec)

1. **Fraunces variable font**: ~80KB. Preload latin subset, `font-display: swap`, skip 9pt opsz cut.
2. **Count-up a11y**: announce only the final value to SR (the count-up updates `aria-hidden` text, not the visible number).
3. **Glow vs focus-visible**: hero cockpit glow must not consume focus ring (`outline-offset: 4px`).
4. **Save toggle**: `aria-checked` + off-screen label (color-only state fails WCAG 1.4.1).
5. **Indigo discipline**: paint it everywhere → Christmas tree. Reserve 5 uses only.

## A11y + reduced-motion

- Every new keyframe has a matching `prefers-reduced-motion: reduce` block that collapses animation, transform, clip-path, and stroke-dashoffset.
- `useCountUp` short-circuits to final value under reduced motion.
- `HoldToAllow` skips the tween and snaps to `Allowed` under reduced motion.
- `HeroHeadline` word spans use `.rcp-hero-word` class so reduced-motion override wins over inline `opacity: 0`.
- Card hover state (`card-hoverable`) is reduced-motion neutral.
- `forced-colors: active` rule at bottom of globals.css keeps the system ring and freezes indigo to `LinkText`.

## Verification artifacts

```
/tmp/landing-10x-final/
├── desktop-light.png       (1440×900 full page, light)
├── desktop-dark.png        (1440×900 full page, dark)
├── tablet-light.png        (820×1180)
├── mobile-light.png        (390×844)
├── mobile-dark.png         (390×844)
├── section-signin.png      (Hero crop)
├── section-surfaces.png    (Surfaces crop)
├── section-gates.png       (Gates crop, shows Verify gate)
├── section-receipt.png     (Receipt crop, shows Fraunces pull-quote + count-up)
└── section-open-cockpit.png (CTA panel crop, shows inverted Fraunces title)
```

## Specialist specs (parallel work artifacts)

```
/tmp/landing-10x-spec/
├── design-spec.md  (286 lines, 10 sections — landing-page 10y specialist)
└── motion-spec.md  (541 lines, 9 sections — motion/animation specialist)
```

Both specialists ran in parallel and reconciled 10 friction points (signature motion moments, glow budget, no-gradient-button rule, etc.). Use these as reference for any future iteration.

## Superdesign canvas

- Project: https://superdesign.dev/teams/f891e39a-2034-4275-bbc7-c0dd6d34eb2b/projects/cabc3fc2-4206-484a-8455-3793fc2e87f1
- Reference nodes uploaded: `fde63aef-3f57-4576-8211-32a3b891a18c` (light), `50bc1f85-8edf-4e5b-a23c-260fbf3845c4` (dark) from PR #15 baseline

## Server lifecycle

```bash
# Stop
cd /Users/aditya/Projects/openwrite-landing && lsof -ti :13100 | xargs -r kill -9

# Start (production)
cd /Users/aditya/Projects/openwrite-landing && npx next start -p 13100 &

# Dev mode
cd /Users/aditya/Projects/openwrite-landing && npx next dev -p 13000
```

## How to re-render screenshots

```bash
cd /Users/aditya/Projects/openwrite-landing && npx next start -p 13100 &
# In another terminal:
cd /Users/aditya/Projects/openwrite-landing && node scripts/screenshot-landing.mjs
# Output: /tmp/landing-10x-final/*.png
```

The script scroll-triggers every `IntersectionObserver` before capturing (fixes the Reveal fullPage race where off-screen sections stay `opacity: 0`).

## Known issues / next steps

1. **Theme persistence**: `app/layout.tsx` themeBootstrap ignores `prefers-color-scheme` and falls back to `light` unless `localStorage.rcp-theme` is set. The screenshot script's `addInitScript` doesn't always win the race. If dark-mode-first is desired, revisit themeBootstrap.
2. **Hero asymmetric translation**: at viewports < 1280px, the floating sign-in card can clip the right edge — current `-translate-y-10` only is safe at the design width. Add a `lg:-translate-x-6` or column-span reduction if narrower desktop variants become common.
3. **Test isolation**: vitest requires `DATABASE_URL` and `.env`. Landing changes don't affect this; just an operational note for the next dev.

## Next route in the design system sequence

Per the prior session's plan: **landing → signup → dashboard → paper/new → paper/[slug] → audit → export.**

The `feat/signup-redesign` worktree has the signup redesign work in progress (also on this machine at `/Users/aditya/Projects/openwrite-landing`). When the signup PR is ready, it should reuse the same Fraunces + indigo + motion vocabulary from this landing pass for visual consistency.