# MPGB Premier League – Cricket Scoring App (PWA)

A premium dark UI cricket scoring web app (installable PWA) inspired by the screenshot you shared.
Runs offline in localStorage by default; optional Firebase hooks are prepared for realtime multi-user scoring.

## Features
- Live scoring: 0/1/2/4/6/W + NB/WD
- Overs, RR / RRR, target/need line
- Full scorecard screen
- Player stats + trophy cards
- Points table + NRR display
- PWA (install to home screen) + offline cache via Service Worker

## Run locally
Just open `index.html` in a browser.
For best results, use VS Code Live Server or any static server.

## Deploy on GitHub Pages
1. Put all files in repo root.
2. GitHub → Settings → Pages → Deploy from branch → `main` + `/root`
3. Open the Pages URL.

## Firebase (Optional Realtime)
Edit `js/firebase.js` and wire Firestore listeners (RT.onUpdate / RT.pushState).
If not configured, the app stays in offline/local mode.

## Customize
- Team names, overs limit: `js/rules-engine.js` → `newMatchDemo()`
- UI theme: `css/theme-dark.css`
