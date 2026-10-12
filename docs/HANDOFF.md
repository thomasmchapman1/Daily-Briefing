# Handoff: Daily Briefing ("The Morning"), iPhone web app

## Overview
A personal morning briefing for one person. It's a single scrolling page laid out like a newspaper, with four sections: **Weather**, **The Day** (calendar), **Scripture** (Bible reading) and **Training** (workout). It runs as an installable web app (PWA) on iPhone: added to the home screen from Safari, it opens full-screen.

The approved direction is **option 1a, "The Morning Paper"** in `Daily Briefing.dc.html`. Ignore options 1b and 1c in that file.

## About the design files
The files in this bundle are **design references made in HTML**. They're prototypes that show the intended look and behaviour, not production code. Rebuild the design as a small standalone web app. No codebase exists yet. Recommended stack: **Vite + React + TypeScript**, plain CSS using the tokens below, `vite-plugin-pwa` for the manifest and service worker, and deploy to Vercel or Netlify. Something lighter is fine if it stays simple.

To view the reference, open `Daily Briefing.dc.html` in a browser and find the phone labelled **1a**.

## Fidelity
**High-fidelity.** Colours, type, spacing, copy and interactions are final. Recreate them closely. The phone bezel, notch and fake status bar are mockup chrome only. Don't build them. Use the real iOS status bar (see PWA below).

## Screen: Briefing (the only screen)

### Page frame
- Designed at 390pt wide (iPhone 14/15). Make it fluid from 360 to 430pt, with max-width 480px centred on larger screens.
- Background `#f3f2f2`, text `#201f1d`.
- Horizontal padding 26px. Top padding is `env(safe-area-inset-top)` + 8px. Bottom padding is 48px + `env(safe-area-inset-bottom)`.
- One vertical scroll. Sections are stacked, separated by 1px hairlines in `--color-divider` (`#201f1d` at 16% alpha).

### Section kicker (shared by all sections)
Lora 400, 11px, letter-spacing 0.14em, uppercase, colour `#7d5411`. It sits on a row with `justify-content: space-between`. The right side holds a meta label in Lora 11px, colour `#605d5d`.

### 1. Masthead
- Centred, bottom border 1px solid `#201f1d`, padding-bottom 10px.
- Line 1: `Vol. XLII · No. 284`. Lora 11px, letter-spacing 0.18em, uppercase, `#605d5d`. **No.** is the day of the year.
- Line 2: `The Morning`. Cormorant Garamond 400, 44px, line-height 1, margin 6px 0 4px.
- Line 3: a three-column row (space-between) showing weekday · full date · city, e.g. `Sunday` · `11 October 2026` · `Brooklyn`. Lora 11px, tabular numerals, top border 1px divider, padding-top 7px, margin-top 8px.

### 2. Weather
- Padding 20px 0. Kicker: `Weather`.
- Row (flex, align end, gap 14px):
  - Temperature `58°`: Cormorant 400, 72px, line-height 0.9, tabular.
  - Beside it, with padding-bottom 6px:
    - Condition `Partly cloudy`: Cormorant 600, 20px, line-height 1.1.
    - Meta `High 64° · Low 47° · Rain 10%`: Lora 13px, `#605d5d`.
- Summary paragraph: Lora 14px, line-height 1.5, justified, `text-wrap: pretty`, margin 12px 0 14px. Generate it from the forecast data, e.g. "A light-jacket morning. Clouds thin by noon and the afternoon stays dry; wind from the northwest at 6 mph."
- Hourly strip: a 6-column grid with top and bottom 1px dividers. Each cell is centred with 8px vertical padding:
  - Hour (`8a`, `10a`, `12p`, `2p`, `4p`, `6p`): Lora 11px, `#605d5d`.
  - Temp: Cormorant 20px, tabular.
  - Show every 2 hours, starting from the current hour rounded up.

### 3. The Day (calendar)
- Kicker: `The Day`. Right meta: `4 engagements` (the count of today's events).
- Each event is a row: grid `58px 1fr 16px`, gap 10px, padding 11px 0, bottom 1px divider, align baseline, the whole row is tappable.
  - Time `9:30`: Cormorant 600, 17px, tabular. Use 12-hour format with no am/pm. All-day events show `All day`.
  - Title: Lora 15px.
  - Chevron `›`: 14px, colour `#b68235`. It rotates 0° → 90° when expanded, with `transition: transform .2s`.
- **Expanded:** location and notes appear under the title as Lora 12px, line-height 1.5, `#605d5d`, margin-top 4px. Only one event is open at a time, and tapping the open row closes it.
- Sample copy:
  - 9:30 Morning service — Grace Fellowship, 410 Union St
  - 12:30 Lunch with Sarah & Tom — Juniper Kitchen
  - 4:00 Call Mom — FaceTime
  - 7:00 Plan the week — Desk · 30 min
- **Empty state:** `Nothing scheduled. An open day.` in Cormorant italic, 17px.

### 4. Scripture
- Padding 22px 0. Kicker: `Scripture · Day 284`. Right meta: `41-day streak`, which rises to 42 once today is marked read.
- Passage reference `Psalm 23 · Luke 15:11–32`: Cormorant 600, 24px, line-height 1.15, margin 8px 0 2px.
- Quote: a blockquote with margin 14px 0, padding-left 14px, left border 1px `#b68235`, Cormorant italic 400, 20px, line-height 1.35. It shows the first 2–3 verses of the first passage, in curly quotes.
- Attribution `Psalm 23:1–3 · KJV · about 6 min`: Lora 12px, `#605d5d`, margin-bottom 14px.
- Full-width button:
  - Unread: `Mark as read`, using `.btn .btn-primary` (accent outline).
  - Read: `✓ Read today`, using `.btn .btn-secondary`.
  - Tapping toggles between the two.
- **Tapping the passage reference** should open the full text in a reader view. This isn't in the mock. Build a minimal version: same type, Cormorant 21px, line-height 1.42, justified.

### 5. Training
- Kicker: `Training`. Right meta: `0 of 4 done`.
- Title `Lower body`: Cormorant 600, 24px.
- Meta `Week 6 · Day 3 · about 50 min`: Lora 12px, `#605d5d`, margin-bottom 8px.
- Each exercise is a row: flex, gap 12px, padding 11px 0, bottom divider, tappable.
  - 22px circle with a 1px `#b68235` border. Shows `✓` in `#7d5411` when done.
  - Name: Lora 15px.
  - Spec on the right: Lora 13px, tabular, `#605d5d`.
  - **Done state:** name and spec drop to 45% opacity and the name is struck through.
- Sample: Back squat 4 × 6 · 185 lb / Romanian deadlift 3 × 8 · 135 lb / Walking lunge 3 × 12 · 40 lb / Plank 3 × 45 s.
- **Rest day:** title `Rest day` and no rows.

### 6. Colophon
`— Fin —`, centred. Cormorant italic, 15px, `#605d5d`, padding-top 8px.

## Interactions & behaviour
- **Pull to refresh**, or refresh automatically when the app comes back to the foreground after more than 30 minutes. This re-fetches weather and calendar.
- **Loading:** show the last cached briefing straight away (stale-while-revalidate). Never show a blank page. On the first ever load, show hairline-ruled skeleton rows in each section.
- **Errors:** each section fails on its own. Weather shows `Forecast unavailable` under the kicker in Lora 13px, `#605d5d`. Calendar shows `Calendar couldn't be reached`. The rest of the page still renders.
- **Day rollover:** at local midnight, or on the next open, reset the read state and exercise ticks, move the plan day forward and update the masthead.
- **Focus:** `:focus-visible { outline: 2px solid #b68235; outline-offset: 2px }`.
- **Hover/press:** button tints come from the stylesheet. Tappable rows get `background: #fff3e4` while pressed.

## Data sources
- **Weather:** Open-Meteo (free, no key) at `api.open-meteo.com/v1/forecast`, using current temperature, hourly temperature, daily max/min, precipitation probability, wind and weather code. Units are °F and mph. Location comes from the browser's geolocation, with a fallback to a city saved in settings. Map weather codes to plain words ("Partly cloudy").
- **Calendar:** Google Calendar API (OAuth, read-only scope, today's events from the primary calendar or chosen calendars). Easier alternative: paste a private iCal/ICS link from Google or iCloud in settings and parse it on a tiny serverless function, because ICS links can't be fetched from the browser due to CORS. **Start with ICS.**
- **Scripture:** see the next section.
- **Workout:** a static JSON programme in the repo: `weeks[] → days[] → { title, minutes, exercises[{name, spec}] }`. It has a start date, and the current week/day is calculated from it.

## Bible reading must be a swappable module
The owner plans to **customise the Bible reading later** (translation, reading plan, possibly the layout). Build it so those changes are easy:
- Keep everything in one module, `scripture/`, with a single interface: `getToday(date) → { planDay, references[], excerpt, attribution, minutes }`.
- **Reading plan:** a JSON file, `plans/<id>.json`, mapping day number → references. Ship with one placeholder 365-day plan. The plan id, start date and translation go in a settings object rather than in code.
- **Text provider:** an adapter interface, e.g. `fetchPassage(ref, translation)`. Ship it with a public-domain KJV source, such as bible-api.com, which needs no key. Keep it easy to add ESV (api.esv.org) or API.Bible later.
- **Streak and read history** are stored separately from the plan, so changing plans doesn't reset history.
- Keep the Scripture section's layout in its own component.

## State
- `localStorage` (or IndexedDB):
  - `readLog: { [isoDate]: true }`, from which the streak is derived.
  - `workoutLog: { [isoDate]: { [exerciseIndex]: true } }`.
  - `settings: { city, lat, lon, icsUrl, plan, planStart, translation, programStart }`.
  - `cache: { weather, events, scripture, fetchedAt }`.
- UI only: `openEventIndex` (number or null).
- Settings screen: not designed. Add a plain one reached by tapping the masthead title, styled with the system's `.field` / `.input` classes.

## PWA / iPhone
- `manifest.webmanifest`:
  - `display: standalone`, `background_color` and `theme_color` `#f3f2f2`, `name` "The Morning".
- Add `apple-mobile-web-app-capable`, plus a status-bar style of `default` (dark text on the light ground).
- Add a 180×180 `apple-touch-icon`. The icon is a placeholder: a "M" in Cormorant on `#f3f2f2`, ask the owner for a final one.
- The service worker caches the app shell for offline opening.
- Optional later: Web Push for a morning "briefing ready" notification. This needs iOS 16.4+ and the app installed to the home screen.

## Design tokens
- **Colours:**
  - bg `#f3f2f2`, surface `#eae9e9`, text `#201f1d`, divider `rgba(32,31,29,.16)`.
  - accent `#b68235`, accent-700 `#7d5411` (accent-coloured text), accent-100 `#fff3e4` (pressed tint).
  - neutral-700 `#605d5d` (secondary text), neutral-900 `#2d2b2b`.
- **Fonts:** Cormorant Garamond 400/600 for headings and numerals; Lora 400/600 for body. Both from Google Fonts. Bold is never used. Numerals are tabular (`font-variant-numeric: tabular-nums`) wherever they're figures.
- **Radius:** 4px for buttons. Everything else is square. No fills: colour appears as strokes and rules.
- **Shadows:** none on the page.
- **Buttons:** copy `.btn`, `.btn-primary` and `.btn-secondary` from `_ds/.../styles.css`. They're outlined, transparent, with an accent border and hover and pressed tints.

## Assets
No images. The glyphs `›` and `✓` are text characters. For any new icons (settings, refresh), use Lucide.

## Files
- `Daily Briefing.dc.html`: the design reference (option **1a** only). Open it in a browser; it needs `support.js` and `_ds/` alongside it.
- `_ds/classical-…/styles.css`: the design system's tokens and button and field classes. It's the source of truth for the values above.
