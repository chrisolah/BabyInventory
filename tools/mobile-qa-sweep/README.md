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

## Two scripts

- `public-sweep.mjs` — hits prod (https://sprigloop.com) for unauthenticated routes.
  Zero setup, runs anywhere you have network. **Start here.**
- `authed-sweep.mjs` — hits local dev (http://localhost:5173) for authed routes.
  Requires a one-time `auth-record.mjs` run to capture your sign-in state.
  Add later if/when public sweep findings are addressed.

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

## Running the authed sweep (later)

```bash
# 1. Boot your dev server in another terminal
npm run dev

# 2. One-time: capture your auth state by signing in manually
node tools/mobile-qa-sweep/auth-record.mjs
# (a browser opens — sign in, then close it)

# 3. Run the sweep
node tools/mobile-qa-sweep/authed-sweep.mjs
```

The auth state is stored in `tools/mobile-qa-sweep/.auth-state.json`. It's
gitignored. Re-record whenever your session expires.
