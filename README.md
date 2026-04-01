# MLB 2026 Run Endings Tracker

A small full-stack app for a season-long MLB game:

- each person gets **2 teams**
- you need to collect every final run total from **0 through 13**
- first player to collect all 14 run endings wins

The UI highlights acquired run endings in green for each team and shows totals acquired vs. remaining.

## Tech stack

- **Frontend:** React + Vite (`frontend/`)
- **Backend:** Node.js + Express (`backend/`)
- **Data source:** MLB Stats API (`statsapi.mlb.com`)

## Scoring rules in this app

- Only **final** regular-season games are counted.
- A run ending is "acquired" when one of your teams finishes a game with that run total.
- Each team tracks its own `0..13` progress.
- Each player also has a **combined** progress value across their two teams.

## Project structure

```text
mlb-track/
  backend/
    src/
      config.js     # player names, team assignments, team map
      server.js     # API and scoring logic
  frontend/
    src/
      App.jsx       # UI rendering and data fetch
      App.css       # app styling
  package.json      # workspace scripts
```

## Local development

### Requirements

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Run both frontend and backend

```bash
npm run dev
```

### App URLs

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000/api/scoreboard`

## Useful scripts

From repository root:

- `npm run dev` - run frontend + backend together
- `npm run dev:frontend` - run only frontend
- `npm run dev:backend` - run only backend
- `npm run build` - build frontend for production

## API endpoints

- `GET /api/scoreboard`
  - Returns season, run targets (`0..13`), and player/team progress.
- `GET /api/config`
  - Returns configured players, teams, and season settings.

## Editing players and teams

Update `backend/src/config.js`:

- `PLAYERS`: participant names and `teamCodes` (2 per player)
- `TEAMS`: code -> MLB team id and display name
- `SEASON`: currently set to `2026`

After editing config, restart backend if needed.

## Deployment (simple approach)

A practical way to share this with friends:

- deploy backend on **Render**
- deploy frontend on **Vercel** or **Netlify**
- share the frontend URL

If you deploy, make sure frontend requests point to your deployed backend URL.

## Notes and limitations

- MLB API response structure can change over time.
- Early in the season, many run endings will still be missing.
- Ties are not special-cased; only final run totals matter.
