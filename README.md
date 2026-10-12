# The Morning Briefing

A personal morning briefing laid out like a newspaper: **Weather**, **The Day** (calendar), **Scripture**, **Training** and a daily **Check-in** on one scrolling page, plus a **Progress** page for the OKC Marathon 2027 plan. It's an installable PWA for iPhone. The design spec is in [`docs/HANDOFF.md`](docs/HANDOFF.md) (option 1a, "The Morning Paper"). The prototype is in [`docs/design/`](docs/design/).

Built with Vite, React and TypeScript, plain CSS, and `vite-plugin-pwa`. Calendar parsing runs in one small serverless function.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173. /api/ics is served by the Vite dev server
npm test           # unit tests (ICS parsing, scripture, weather, training plan, stats, sync)
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
- **Translation**, **personal worship link** (defaults to familyworship.io; empty hides the links).
- **Goal weight** and **goal waist** (175 lb and 32 in), shown on the progress page.
- **Training log sync passcode**: see *Training log and cloud sync* below.

Settings, read history, the training log and the last briefing are kept in `localStorage` under the `morning:` prefix.

## How it works

| Section | Source |
| --- | --- |
| Weather | [Open-Meteo](https://open-meteo.com) (°F, mph, no key). Summary sentence generated in `src/weather/summary.ts`. |
| The Day | Google Calendar API, read-only: `api/google/*` → `server/google.ts`. Or an ICS link → `POST /api/ics` (`api/ics.ts` → `server/icsEvents.ts`, using `ical.js`). It expands recurring events, exceptions and time zones, and returns only today's events. The private link goes in the request body, not the URL. |
| Scripture | `src/scripture/`: a verse of the day from `plans/verse-a-day.json`, with text from [bible-api.com](https://bible-api.com) (KJV by default). The reference and the **Personal worship** button open the worship link. |
| Training | `src/fitness/plan.ts`: the 28-week OKC Marathon plan (12 Oct 2026 to race day, 25 Apr 2027) with every week's lifting weights and runs. Mon lower-body lift, Tue easy run, Wed upper-body lift, Thu quality run, Sat long run, Fri and Sun off. Cutback weeks, the peak and the taper set the number of sets. |
| Check-in, Progress | `src/fitness/`: the daily log (`log.ts`), averages, rates, estimated maxes and mileage (`stats.ts`), and storage plus sync (`useFitnessLog.ts`). |

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

## Training log and cloud sync

**Training** shows the day's session from the plan. Tap the circle to tick off a lift or run: blank sets fill in with the planned numbers. Tap the name to open warm-up sets, last time's numbers, and fields for each set's weight and reps (or a run's distance, time, heart rate and effort; pace is calculated). The arrows next to the date move to other days, so you can log something late or look ahead.

**Check-in** records weight, waist, body fat, sleep, resting heart rate, calories, protein and notes for the same day.

**Progress & plan** (the button under Training) shows:
- weight with a 7-day average against the plan's line and your goal
- waist against the plan's milestones
- weekly rate of loss, with the plan's calorie rules (under 0.3 lb a week for three weeks: trim 150–200 kcal; over 1 lb a week: eat more)
- estimated 1-rep maxes against your starting maxes and targets
- miles per week, planned against actual, and recent runs
- this week's schedule and the milestones
- backup (JSON), CSV export and restore

The log is saved on the device. To sync it between devices and keep it safe if Safari's data is cleared:

1. In Vercel, open the project → **Storage** → **Create Database** → **Blob** → create it and connect it to this project (all environments). This adds `BLOB_STORE_ID` (older stores add `BLOB_READ_WRITE_TOKEN`); the sync function signs in with the project's own Vercel identity, so there's no token to copy. The log is stored as a private blob, `training/log.json`. (Upstash Redis works too: it sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`.)
2. **Settings → Environment Variables**: add `SYNC_KEY`, a passphrase of your choice.
3. Redeploy. In the app, open settings and enter the same passphrase as the **Training log sync passcode** on each device.

Sync runs when the app opens, when it returns to the foreground, and shortly after each edit (`POST /api/sync`, `server/sync.ts`). Days merge by last edit, and Blob writes are conditional, so two devices syncing at once can't overwrite each other's days.

## Notes and open items

- The HTML prototype and its design system are in `docs/design/` (open `Daily Briefing.dc.html` and find phone **1a**). The app uses the design system's `styles.css` verbatim as `src/ds/styles.css`, except for its Google Fonts import. App-specific styles sit on top of it in `src/styles.css`.
- The app icon is a placeholder ("M" in Cormorant). Replace `public/apple-touch-icon.png` and `public/icon-*.png`, or edit and re-run `npm run gen:icons` (needs Playwright).
- Fonts are self-hosted through `@fontsource` (the same Google Fonts files), so they work offline.
- The masthead counts issues from Monday 12 October 2026 (Vol. I · No. 1). The issue number goes up daily and the volume each anniversary. Change `FIRST_ISSUE` in `src/components/Masthead.tsx`.
- Not built yet: Web Push.
