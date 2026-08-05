# Weekly Routine & Nutrition

A static page showing the week's gym sessions, work location and meals. No
runtime dependencies and no CDNs — open `index.html` in a browser, or let GitHub
Pages serve it.

## Changing the plan

Everything you'd normally edit lives in **`schedule.js`**. The page renders
itself from that file, so you never have to touch markup to change a meal or a
time, and no rebuild is needed.

```js
{
  time: '12:30 - 13:30',   // "HH:MM - HH:MM", or '' for an untimed row
  icon: '🥗',              // emoji shown on the left
  text: 'Chicken & Green Salad + Oil',
  note: 'At Desk',         // optional grey aside
  tag: 'Lunch',            // pill on the right
  feature: true,           // optional — tints the row (used for gym + weigh-in)
}
```

Breakfast is the same every weekday, so it's defined once as the `BREAKFAST`
constant and reused. Change it there and all five days update.

Saturday and Sunday are stubs marked "No fixed plan yet". Fill in their `items`
arrays the same way as the weekdays whenever you want them planned.

Tag colours are looked up by name in `TAG_STYLES` (`app.js`). Known tags:
`Breakfast`, `Mid-Morning`, `Pre-Workout`, `Lunch`, `Dinner`, `Dinner (Refuel)`,
`Workout`, `Check-in`, `Flexible`. Anything else renders grey.

## What the page does on its own

- **Day picker** — opens on today and shows that one day. Pick another day to
  switch, or "Whole week" for every card at once. An untouched picker keeps
  following the real day, so a page left open overnight rolls over on its own;
  once you've chosen a day by hand it stays put.
- **Highlights today** — today's card gets a ring and a "Today" badge.
- **"Right now" banner** — reads the clock against today's rows and shows what
  you should be doing, or what's next. Refreshes every minute.
- **Live row** — on today's card, the row covering the current time is outlined.
- **Dark mode** — follows the device setting.
- **Add to home screen** — `manifest.webmanifest` installs it as a standalone
  app on a phone.
- **Print** — the print stylesheet drops the header gradient, banner and picker
  so a paper copy is readable in black and white. Printing captures whatever the
  picker is showing, so choose "Whole week" first for the full week.

## Rebuilding the stylesheet

`assets/app.css` is Tailwind, compiled and committed so the page works with no
build step. You only need to rebuild it if you add a **new Tailwind class** —
for example a new entry in `TAG_STYLES` or `ACCENTS`:

```sh
npm install     # once
npm run build   # or: npm run watch
```

The deploy workflow runs the same build, so a forgotten rebuild won't ship an
unstyled page — but a stale `assets/app.css` would show up if you opened
`index.html` straight from disk.

Class names in `app.js` are always written as complete literal strings rather
than built up by concatenation, because that's what lets Tailwind's scanner find
them.

## Files

| File | Purpose |
| --- | --- |
| `schedule.js` | **The plan.** The only file you normally edit |
| `index.html` | Page shell — header, containers, script tags |
| `app.js` | Renders cards, today highlighting, "right now" logic |
| `icons.js` | Font Awesome glyphs inlined as SVG paths (CC BY 4.0) |
| `src/tailwind.css` | Stylesheet source — emoji font stack and print rules |
| `assets/app.css` | Compiled output, committed |
| `manifest.webmanifest`, `icon.svg` | Home-screen install |

## Deployment

`.github/workflows/weekly-routine-pages.yml` publishes this folder to GitHub
Pages on every push to `main` or `claude/weekly-routine-page-xdwke5` that
touches `weekly-routine/`, so the live page is the site root.

The `github-pages` environment has a deployment branch policy, so the `deploy`
job is rejected — instantly, with no logs — when it runs from a branch that
policy doesn't list. `main` is allowed already, so merging is enough. To publish
straight from the feature branch instead, add it under
**Settings → Environments → github-pages → Deployment branches**, then re-run
the workflow.

This repository has one Pages site, and the World Cup chart deploys to it too
from `claude/world-cup-progress-chart-2tPSj`. The routine workflow copies that
chart into `/worldcup2026/` so publishing the routine doesn't take it offline.
The World Cup workflow doesn't do the same in reverse — if it ever runs again it
will replace the whole site, and re-running the routine workflow puts this page
back.
