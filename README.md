# The Morning Briefing

A personal morning briefing laid out like a newspaper: **Weather**, **The Day** (calendar), **Scripture** and **Training** on one scrolling page. It's an installable PWA for iPhone. The design spec is in [`docs/HANDOFF.md`](docs/HANDOFF.md) (option 1a, "The Morning Paper"). The prototype is in [`docs/design/`](docs/design/).

Built with Vite, React and TypeScript, plain CSS, and `vite-plugin-pwa`. Calendar parsing runs in one small serverless function.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173. /api/ics is served by the Vite dev server
npm test           # unit tests (ICS parsing, scripture, weather, workout)
npm run build      # typecheck + production build into dist/
npm run preview    # serve the build, including the service worker and /api/ics
```

## Deploy (Vercel)

Import the repo in Vercel. `vercel.json` sets the Vite build, and `api/ics.ts` deploys as a serverless function automatically. Nothing else needs setting up: there are no API keys.

On the iPhone, open the site in Safari, then Share → **Add to Home Screen**. It opens full-screen with the normal iOS status bar.

## Settings

Tap the masthead title (**The Morning Briefing**) to open settings:

- **City**: shown on the masthead. Weather uses it when device location is off or denied. "Look up" geocodes it with Open-Meteo.
- **Calendar**: either **Google Calendar** (sign in with Google, then choose which calendars to show; this needs the one-time setup below) or an **iCal link** (a private ICS link from Google or iCloud; `webcal://…` links work too).
- **Translation**, **personal worship link** (defaults to familyworship.io; empty hides the links), **training programme start**.
- **Edit training plan**: choose a week, open a day, and change its title, minutes and exercises (add, remove or reorder). You can also add, copy or remove weeks, or reset to the original plan. Edits are saved on this device.
- **Import from Claude** (in the training plan editor): copy the ready-made prompt into any Claude chat (it can include your current plan), say what you want, and paste Claude's reply back. The app finds the plan in the reply, shows a preview, and loads it into the editor for you to save.

Settings, read history, workout ticks and the last briefing are kept in `localStorage` under the `morning:` prefix.

## How it works

| Section | Source |
| --- | --- |
| Weather | [Open-Meteo](https://open-meteo.com) (°F, mph, no key). Summary sentence generated in `src/weather/summary.ts`. |
| The Day | Google Calendar API, read-only: `api/google/*` → `server/google.ts`. Or an ICS link → `POST /api/ics` (`api/ics.ts` → `server/icsEvents.ts`, using `ical.js`). It expands recurring events, exceptions and time zones, and returns only today's events. The private link goes in the request body, not the URL. |
| Scripture | `src/scripture/`: a verse of the day from `plans/verse-a-day.json`, with text from [bible-api.com](https://bible-api.com) (KJV by default). The reference and the **Personal worship** button open the worship link. |
| Training | The plan edited in settings (stored on the device), or else the bundled `src/workout/program.json` (`weeks[] → days[] → { title, minutes, exercises[] }`). The current week and day count from the programme start date and loop at the end. A day with no exercises is a rest day. |

Loading is stale-while-revalidate. The last cached briefing shows instantly, and skeleton rows appear only on the very first load. Each section fails on its own. The app refreshes on pull-down, when it returns to the foreground after 30 minutes, and at local midnight. Read state and exercise ticks are keyed by date, so a new day starts fresh. The service worker precaches the app shell and the self-hosted fonts for offline opening.

## Google Calendar setup (one time)

The app signs in with Google itself, so it needs an OAuth client of its own:

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project (any name).
2. **APIs & Services → Library**: enable the **Google Calendar API**.
3. **Google Auth Platform → Branding**: fill in the app name and your email. Under **Audience**, choose **External**, then click **Publish app** so it's *In production*. In *Testing* mode, Google signs you out every 7 days. Google will warn you that the app is unverified when you sign in; that's expected for a personal app. Tap *Advanced → Go to …*.
4. **Google Auth Platform → Data access**: add the scope `…/auth/calendar.readonly`.
5. **Google Auth Platform → Clients → Create client**: choose *Web application*. Under **Authorized redirect URIs**, add `https://<your-domain>/api/google/callback` (for example `https://daily-briefing-murex.vercel.app/api/google/callback`). For local development, also add `http://localhost:5173/api/google/callback`.
6. In Vercel, go to **Project → Settings → Environment Variables** and add:
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from that client
   - `SESSION_SECRET`: any long random string, for example the output of `openssl rand -base64 32`
7. Redeploy. Then in the app, open settings (tap the title) and tap **Connect Google Calendar**.

How it works: after sign-in, Google's refresh token is encrypted with `SESSION_SECRET` and stored in an HttpOnly cookie that only `/api/google/*` receives. There's no database. Each refresh trades the token for a short-lived access token and reads today's events from the chosen calendars, skipping cancelled and declined ones. **Disconnect Google** in settings revokes the token.

## Scripture: verse of the day and personal worship

The Scripture section shows one verse a day and sends you to your worship site (familyworship.io by default) for personal worship. Tapping the verse reference or **Personal worship** opens the link. **Mark worship done** keeps the streak. Everything lives in `src/scripture/`:

- `plans/verse-a-day.json`: 365 well-known verses, one per calendar day, with no repeats. Genesis 1:1 falls on 1 January, Luke 2:11 on Christmas Day and Revelation 22:20 on 31 December; 29 February repeats 28 February. To change the list, edit `scripts/gen-verse-plan.mjs` and run `node scripts/gen-verse-plan.mjs`.
- `index.ts`: `getToday(date, settings)` and `dailyVerseSettings(date, translation)`. The module still accepts other plan files in `plans/`, so a reading plan can return later.
- `providers/`: implement `TextProvider.fetchPassage(ref, translation)` (for example for api.esv.org or API.Bible) and add it to `PROVIDERS` in `providers/index.ts`. Its translations then show up in settings.
- `history.ts`: the done log and streak.
- `ScriptureSection.tsx`: the layout.

## Notes and open items

- The HTML prototype and its design system are in `docs/design/` (open `Daily Briefing.dc.html` and find phone **1a**). The app uses the design system's `styles.css` verbatim as `src/ds/styles.css`, except for its Google Fonts import. App-specific styles sit on top of it in `src/styles.css`.
- The app icon is a placeholder ("M" in Cormorant). Replace `public/apple-touch-icon.png` and `public/icon-*.png`, or edit and re-run `npm run gen:icons` (needs Playwright).
- Fonts are self-hosted through `@fontsource` (the same Google Fonts files), so they work offline.
- The masthead counts issues from Monday 12 October 2026 (Vol. I · No. 1). The issue number goes up daily and the volume each anniversary. Change `FIRST_ISSUE` in `src/components/Masthead.tsx`.
- Not built yet: Web Push.
