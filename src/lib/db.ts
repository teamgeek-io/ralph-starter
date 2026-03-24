import type { Database, QueryExecResult, SqlValue } from 'sql.js';

const STORAGE_KEY = 'foosball_db';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  elo INTEGER NOT NULL DEFAULT 1000,
  games_played INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('1v1', '2v2')),
  player1_id INTEGER, player2_id INTEGER,
  team1_p1_id INTEGER, team1_p2_id INTEGER,
  team2_p1_id INTEGER, team2_p2_id INTEGER,
  score1 INTEGER NOT NULL,
  score2 INTEGER NOT NULL,
  played_at TEXT NOT NULL DEFAULT (datetime('now')),
  league_id INTEGER,
  tournament_id INTEGER,
  tournament_round TEXT
);

CREATE TABLE IF NOT EXISTS leagues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  season TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS league_players (
  league_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  PRIMARY KEY (league_id, player_id)
);

CREATE TABLE IF NOT EXISTS tournaments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('1v1', '2v2')),
  status TEXT NOT NULL DEFAULT 'registration' CHECK(status IN ('registration', 'group_stage', 'knockout', 'complete')),
  winner_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tournament_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  player1_id INTEGER NOT NULL,
  player2_id INTEGER,
  eliminated INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS elo_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  elo INTEGER NOT NULL,
  delta INTEGER NOT NULL DEFAULT 0,
  match_id INTEGER,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

let db: Database | null = null;

let readyResolve!: () => void;
const readyPromise = new Promise<void>((resolve) => {
	readyResolve = resolve;
});

/** Resolves once initDb() has completed successfully. */
export function whenReady(): Promise<void> {
	return readyPromise;
}

/** Serialise DB to base64 and persist to localStorage. */
export function save(): void {
	if (!db) return;
	const data = db.export();
	const b64 = btoa(String.fromCharCode(...data));
	localStorage.setItem(STORAGE_KEY, b64);
}

/** Deserialise base64 from localStorage into a Uint8Array. Returns null if not found. */
function loadFromStorage(): Uint8Array | null {
	const b64 = localStorage.getItem(STORAGE_KEY);
	if (!b64) return null;
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

/** Initialise sql.js, restore persisted DB (or create fresh), run schema migrations. */
export async function initDb(): Promise<void> {
	// sql.js browser bundle uses CJS exports; handle both CJS and ESM module shapes
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const mod = await import('sql.js');
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const initSqlJs: (config: object) => Promise<{ Database: new (data?: ArrayLike<number>) => Database }> =
		(mod as any).default ?? mod;
	const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });

	const existing = loadFromStorage();
	db = existing ? new SQL.Database(existing) : new SQL.Database();

	db.run(SCHEMA);
	save();

	// Smoke test
	const result = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
	const tables = (result[0]?.values ?? []).map((r) => r[0] as string);
	console.assert(tables.includes('players'), 'DB smoke test: players table missing');
	console.assert(tables.includes('matches'), 'DB smoke test: matches table missing');
	console.log('[db] Initialised. Tables:', tables.join(', '));

	readyResolve();
}

/** Execute a SELECT query and return rows as plain objects. */
export function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
	if (!db) throw new Error('DB not initialised. Call initDb() first.');
	const results: QueryExecResult[] = db.exec(sql, params as never);
	if (!results.length) return [];
	const { columns, values } = results[0];
	return values.map((row: SqlValue[]) => {
		const obj: Record<string, unknown> = {};
		(columns as string[]).forEach((col: string, i: number) => (obj[col] = row[i]));
		return obj as T;
	});
}

/** Execute an INSERT / UPDATE / DELETE statement and persist. */
export function run(sql: string, params: unknown[] = []): void {
	if (!db) throw new Error('DB not initialised. Call initDb() first.');
	db.run(sql, params as never);
	save();
}

/** Return the raw Database instance for advanced use. */
export function getDb(): Database {
	if (!db) throw new Error('DB not initialised. Call initDb() first.');
	return db;
}
