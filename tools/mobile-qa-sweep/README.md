# Mobile QA sweep

Walks Sprigloop's mobile-relevant routes at three phone viewports (iPhone SE 375,
iPhone 14 Pro 393, Pixel 7 412), captures full-page screenshots, and runs an
in-page DOM diagnostic that flags layout problems.

Created 2026-04-28 in response to external UX review feedback that called out
mobile clipping, overflow, and alignment issues on the landing experience.

## What it catches

- Horizontal overflow on `<html>` and `<body>` (page scrolls sideways)
- Elements whose `scrollWidth > clientWidth` (text/content clipped or overflowed)
- Children rendered outside their parent's bounding box
- Visible text whose computed `font-size` is below 12px
- Tap targets smaller than 44×44 CSS px (iOS HIG floor)
- Elements positioned off-screen (left < 0 or right > viewport width)

## What it does NOT catch

Touch behavior, scroll feel, momentum, iOS Safari quirks (100vh-includes-URL-bar,
safe-area-insets, rubber-band scroll), keyboard popup pushing content, haptics,
animations, and any state behind real interaction. Spot-check those on a real
phone after fixing the layout issues this finds.

## Three scripts

- `public-sweep.mjs` — hits prod (https://sprigloop.com) for unauthenticated routes.
  Zero setup, runs anywhere you have network. **Start here.**
- `auth-record.mjs` — opens a real browser, you sign in once, the session is
  persisted to `.auth-state.json` (gitignored). Used by `authed-sweep.mjs`.
- `authed-sweep.mjs` — hits authed routes (`/home`, `/inventory`, `/add-item`,
  `/pass-along`, `/profile`) using the captured session.

## Running the public sweep

From `BabyInventory/`:

```bash
node tools/mobile-qa-sweep/public-sweep.mjs
```

Output lands in `tools/mobile-qa-sweep/output/public/`:

- `screenshots/<viewport>/<route>.png` — full-page captures
- `report.json` — structured findings (route × viewport × issues)
- `report.md` — human-readable summary with screenshot links

You can override the target with `BASE_URL=https://beta.sprigloop.com node …`.

## Running the authed sweep

Two-step flow. The recorder opens a real browser, waits for you to sign in,
saves the session, and quits. The sweep then replays that session headlessly
across all the post-login routes.

```bash
node tools/mobile-qa-sweep/auth-record.mjs
```

A non-headless Chromium opens at the login page. Sign in with your normal
account (any auth method — password, OTP, whatever). As soon as you land at
`/home` (or `/onboarding` for new accounts), the script auto-detects the
URL change, saves `.auth-state.json`, and closes the browser.

Then the sweep:

```bash
node tools/mobile-qa-sweep/authed-sweep.mjs
```

Output lands in `tools/mobile-qa-sweep/output/authed/` with the same shape
as the public sweep (`report.md`, `report.json`, `screenshots/...`).

If the captured session has expired by the time you run the sweep, the
report will show "auth state appears stale" at the top and individual
routes will be marked as bounced. Re-run `auth-record.mjs` and try again.

By default both scripts target `https://sprigloop.com`. Override with
`BASE_URL=https://beta.sprigloop.com` (must match between the two scripts).
