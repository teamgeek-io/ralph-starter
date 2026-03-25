# Foosball Tournament App — PRD

## Overview

A frontend-only foosball tournament management app built with **Svelte 5** (runes API) + **SvelteKit** (static/SPA mode) + **TypeScript** + **Tailwind CSS**. All data is stored in-browser using **sql.js** (SQLite compiled to WebAssembly), persisted to `localStorage` as a serialised binary blob. There is no backend.

Supports both **1v1** and **2v2** match formats. Rankings use an **ELO rating system**. Matchmaking is **skill-based** (ELO-balanced). Tournaments use **round robin group stage + knockout finals**.

---

## Stack

- Svelte 5 (runes: `$state`, `$derived`, `$effect`) — no legacy stores
- SvelteKit with `@sveltejs/adapter-static` (SPA mode, no SSR)
- TypeScript
- Tailwind CSS v4
- sql.js (`@jlongster/sql.js` or `sql.js` npm package) — WASM SQLite
- Persistence: `db.export()` → base64 → `localStorage` on every write; restore on app load

---

## Database Schema

```sql
CREATE TABLE players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  elo INTEGER NOT NULL DEFAULT 1000,
  games_played INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('1v1', '2v2')),
  player1_id INTEGER, player2_id INTEGER,   -- 1v1
  team1_p1_id INTEGER, team1_p2_id INTEGER, -- 2v2
  team2_p1_id INTEGER, team2_p2_id INTEGER, -- 2v2
  score1 INTEGER NOT NULL,
  score2 INTEGER NOT NULL,
  played_at TEXT NOT NULL DEFAULT (datetime('now')),
  league_id INTEGER,
  tournament_id INTEGER,
  tournament_round TEXT
);

CREATE TABLE leagues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  season TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE league_players (
  league_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  PRIMARY KEY (league_id, player_id)
);

CREATE TABLE tournaments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('1v1', '2v2')),
  status TEXT NOT NULL DEFAULT 'registration' CHECK(status IN ('registration', 'group_stage', 'knockout', 'complete')),
  winner_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tournament_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  player1_id INTEGER NOT NULL,
  player2_id INTEGER,  -- null for 1v1
  eliminated INTEGER NOT NULL DEFAULT 0
);
```

---

### Important fix BUGS

- [x] app.js:16 SyntaxError: The requested module '/node_modules/sql.js/dist/sql-wasm-browser.js?v=b2a998a8' does not provide an export named 'default' (at db.ts:1:8) — **Fixed**: root cause was `optimizeDeps.exclude: ['sql.js']` in `vite.config.ts` preventing Vite's CJS→ESM conversion. Removed the exclusion so Vite pre-bundles sql.js via esbuild; reverted db.ts to a clean static `import initSqlJs from 'sql.js'`.

- [x] db.ts:1 Uncaught (in promise) SyntaxError: The requested module '/node_modules/sql.js/dist/sql-wasm-browser.js?v=b2a998a8' does not provide an export named 'default' (at db.ts:1:8) — same root cause, resolved by the fix above.

- [x] db.ts:107 Uncaught (in promise) TypeError: initSqlJs is not a function — **Fixed**: the dynamic-import workaround (`mod.default ?? mod`) resolved to a non-callable namespace object because sql.js was excluded from pre-bundling. Fixed by removing `optimizeDeps.exclude: ['sql.js']` from `vite.config.ts` and restoring the static import.

--

## Tasks

Complete tasks in order. Mark each task done by changing `[ ]` to `[x]`. After all tasks are done, output `<promise>COMPLETE</promise>`.

### Phase 1 — Project Scaffold

- [x] **TASK-01**: Initialise a SvelteKit project with Svelte 5, TypeScript, Tailwind CSS v4, and `@sveltejs/adapter-static`. Configure `svelte.config.js` for SPA mode (`fallback: '404.html'`). Commit as `feat: init sveltekit project`.

- [x] **TASK-02**: Install and configure `sql.js`. Create `src/lib/db.ts` that initialises the WASM SQLite engine, runs the schema migrations on first load, and exposes `query()`, `run()`, `save()`, and `load()` helpers. Persist the DB with `save()` (serialize → base64 → localStorage key `foosball_db`) and restore with `load()` on app boot. Write a basic smoke test (console assertion). Commit as `feat: add sql.js sqlite persistence`.

### Phase 2 — Player Management

- [x] **TASK-03**: Create the Players data layer in `src/lib/stores/players.svelte.ts` using Svelte 5 runes. Expose: `createPlayer(name)`, `updatePlayer(id, name)`, `deletePlayer(id)`, `getPlayer(id)`, `getAllPlayers()` (sorted by ELO desc). Commit as `feat: player data layer`.

- [x] **TASK-04**: Build the Players UI. Route `/players` shows the global leaderboard (rank, name, ELO, games played, win rate). Route `/players/new` shows a creation form. Route `/players/[id]` shows a player profile with: ELO badge, win/loss/draw stats, ELO change history chart (last 20 matches), and recent match list. Commit as `feat: player management UI`.

### Phase 3 — ELO Engine

- [x] **TASK-05**: Implement `src/lib/elo.ts`. Export:
  - `getKFactor(gamesPlayed: number): number` — returns 32 if <10 games, 24 if 10–30, 16 if >30
  - `expectedScore(ratingA: number, ratingB: number): number`
  - `updateElo1v1(winner: {id, elo, games}, loser: {id, elo, games}): {winnerId, newWinnerElo, loserId, newLoserElo}`
  - `updateElo2v2(team1: [{id,elo,games}, {id,elo,games}], team2: [...], team1Won: boolean)` — uses average team ELO; distributes delta equally to both teammates
  - Unit tests in `src/lib/elo.test.ts` using Vitest
  Commit as `feat: elo engine with tests`.

### Phase 4 — Matchmaking

- [x] **TASK-06**: Create `src/lib/matchmaking.ts`. Export:
  - `suggestOpponent1v1(playerId, allPlayers)` — returns the player with closest ELO (excluding self)
  - `suggestTeams2v2(allPlayers)` — splits players into two balanced teams minimising |avgElo(team1) - avgElo(team2)|; tries all combinations for ≤8 players, random-samples for larger pools
  - `winProbability(ratingA, ratingB): number` — expected score as a percentage
  Commit as `feat: matchmaking engine`.

- [x] **TASK-07**: Build the Quick Match UI at `/match/new`. Step 1: choose 1v1 or 2v2. Step 2: select players (auto-suggest but allow manual override); show ELO and win probability. Step 3: enter scores. Step 4: confirm — run ELO update, save match to DB, show ELO delta toast. Commit as `feat: quick match UI`.

### Phase 5 — Landing Page

- [x] **TASK-08**: Build a landing page at `/` (the app root). It should serve as a dashboard/home screen showing: a hero section with the app name and tagline, quick-action buttons (Quick Match, View Players, Leagues, Tournaments), a "Top Players" mini-leaderboard (top 5 by ELO), and a "Recent Matches" feed (last 5 matches with players and scores). Use Tailwind CSS for layout and style. Commit as `feat: landing page`.

### Phase 6 — League

- [x] **TASK-09**: Create the League data layer in `src/lib/stores/leagues.svelte.ts`. Expose: `createLeague`, `getLeague`, `getAllLeagues`, `addPlayerToLeague`, `removePlayerFromLeague`, `getLeagueStandings(leagueId)` (returns rows sorted by points, then ELO). Standings row: `{ rank, player, played, won, lost, drawn, points, elo }`. Commit as `feat: league data layer`.

- [x] **TASK-10-NAV**: Add a persistent navigation shell so users can move between all sections of the app.

- [x] **TASK-10**: Build League UI. Route `/leagues` lists all leagues (active first). Route `/leagues/new` has a creation form. Route `/leagues/[id]` shows the standings table, member list with add/remove controls, and a match history feed filtered to this league. Commit as `feat: league UI`.

### Phase 7 — Tournaments

- [x] **TASK-11**: Create the Tournament data layer in `src/lib/stores/tournaments.svelte.ts`. Expose:
  - `createTournament(name, type)`, `registerParticipant`, `startTournament`
  - `generateGroupSchedule(tournamentId)` — round-robin: each participant plays every other once; writes matches with `tournament_round = 'group'`
  - `getGroupStandings(tournamentId)` — points-based (win=3, draw=1, loss=0)
  - `generateKnockoutBracket(tournamentId, topN)` — takes top N from group stage; creates match stubs with rounds (QF/SF/F)
  - `recordTournamentMatch(matchId, score1, score2)` — saves score, updates ELO, advances bracket
  - `getTournamentBracket(tournamentId)` — returns structured bracket for rendering
  Commit as `feat: tournament data layer`.

- [x] **TASK-12**: Build Tournament UI. Route `/tournaments` lists all tournaments. Route `/tournaments/new` has creation + participant registration. Route `/tournaments/[id]` shows current phase: during group stage shows schedule + live standings; during knockout shows a bracket tree visualisation (SVG or CSS grid); when complete shows winner banner. Commit as `feat: tournament UI`.

### Phase 8 — UI Polish

- [ ] **TASK-13**: Add a persistent app shell: top navigation bar with links to Players, Leagues, Tournaments, and Quick Match. Add a dark mode toggle (persisted to localStorage). Ensure all pages are responsive (mobile-first). Add Tailwind `prose` typography and consistent card/button component styles. Commit as `feat: app shell and responsive layout`.

- [ ] **TASK-14**: Add toast notifications using a Svelte 5 rune-based store. Show toasts for: match recorded (with ELO delta), player created, tournament advanced. Add skeleton loading states for any async DB reads. Add empty-state illustrations/messages for empty leaderboard, no tournaments, etc. Commit as `feat: toasts, skeletons, empty states`.


