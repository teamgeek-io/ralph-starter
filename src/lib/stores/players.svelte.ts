import { query, run } from '$lib/db';

export interface Player {
	id: number;
	name: string;
	elo: number;
	games_played: number;
	created_at: string;
}

export interface LeaderboardRow {
	id: number;
	name: string;
	elo: number;
	games_played: number;
	wins: number;
}

export interface PlayerStats {
	wins: number;
	losses: number;
	draws: number;
	winRate: number;
}

export interface EloPoint {
	elo: number;
	delta: number;
	match_id: number | null;
	recorded_at: string;
}

export interface RecentMatchRow {
	id: number;
	type: string;
	score1: number;
	score2: number;
	played_at: string;
	player1_id: number | null;
	player2_id: number | null;
	team1_p1_id: number | null;
	team1_p2_id: number | null;
	team2_p1_id: number | null;
	team2_p2_id: number | null;
	p1_name: string | null;
	p2_name: string | null;
	t1p1_name: string | null;
	t1p2_name: string | null;
	t2p1_name: string | null;
	t2p2_name: string | null;
}

let players = $state<Player[]>([]);

function refresh(): void {
	players = query<Player>('SELECT * FROM players ORDER BY elo DESC');
}

export function getAllPlayers(): Player[] {
	return players;
}

export function getPlayer(id: number): Player | undefined {
	return query<Player>('SELECT * FROM players WHERE id = ?', [id])[0];
}

export function createPlayer(name: string): void {
	const trimmed = name.trim();
	if (!trimmed) throw new Error('Player name cannot be empty');
	run('INSERT INTO players (name) VALUES (?)', [trimmed]);
	refresh();
}

export function updatePlayer(id: number, name: string): void {
	const trimmed = name.trim();
	if (!trimmed) throw new Error('Player name cannot be empty');
	run('UPDATE players SET name = ? WHERE id = ?', [trimmed, id]);
	refresh();
}

export function deletePlayer(id: number): void {
	run('DELETE FROM players WHERE id = ?', [id]);
	refresh();
}

/** Call once after DB is initialised to populate the reactive state. */
export function loadPlayers(): void {
	refresh();
}

export function getLeaderboard(): LeaderboardRow[] {
	return query<LeaderboardRow>(`
		SELECT p.id, p.name, p.elo, p.games_played,
			(SELECT COUNT(*) FROM matches m
				WHERE (m.type='1v1' AND ((m.player1_id=p.id AND m.score1>m.score2) OR (m.player2_id=p.id AND m.score2>m.score1)))
				   OR (m.type='2v2' AND (((m.team1_p1_id=p.id OR m.team1_p2_id=p.id) AND m.score1>m.score2)
				                      OR ((m.team2_p1_id=p.id OR m.team2_p2_id=p.id) AND m.score2>m.score1)))
			) AS wins
		FROM players p
		ORDER BY p.elo DESC
	`);
}

export function getPlayerStats(id: number): PlayerStats {
	interface MatchRow {
		type: string;
		score1: number;
		score2: number;
		player1_id: number | null;
		player2_id: number | null;
		team1_p1_id: number | null;
		team1_p2_id: number | null;
		team2_p1_id: number | null;
		team2_p2_id: number | null;
	}
	const matches = query<MatchRow>(
		`SELECT type, score1, score2, player1_id, player2_id,
		        team1_p1_id, team1_p2_id, team2_p1_id, team2_p2_id
		 FROM matches
		 WHERE player1_id=? OR player2_id=? OR team1_p1_id=? OR team1_p2_id=? OR team2_p1_id=? OR team2_p2_id=?`,
		[id, id, id, id, id, id]
	);
	let wins = 0,
		losses = 0,
		draws = 0;
	for (const m of matches) {
		const onTeam1 =
			m.type === '1v1'
				? m.player1_id === id
				: m.team1_p1_id === id || m.team1_p2_id === id;
		if (m.score1 === m.score2) draws++;
		else if (onTeam1 ? m.score1 > m.score2 : m.score2 > m.score1) wins++;
		else losses++;
	}
	const total = wins + losses + draws;
	return { wins, losses, draws, winRate: total ? Math.round((wins / total) * 100) : 0 };
}

export function getPlayerEloHistory(id: number): EloPoint[] {
	return query<EloPoint>(
		`SELECT elo, delta, match_id, recorded_at
		 FROM elo_history WHERE player_id=? ORDER BY id DESC LIMIT 20`,
		[id]
	).reverse();
}

export function getPlayerRecentMatches(id: number): RecentMatchRow[] {
	return query<RecentMatchRow>(
		`SELECT m.id, m.type, m.score1, m.score2, m.played_at,
		        m.player1_id, m.player2_id,
		        m.team1_p1_id, m.team1_p2_id, m.team2_p1_id, m.team2_p2_id,
		        p1.name AS p1_name, p2.name AS p2_name,
		        tp1.name AS t1p1_name, tp2.name AS t1p2_name,
		        tp3.name AS t2p1_name, tp4.name AS t2p2_name
		 FROM matches m
		 LEFT JOIN players p1 ON m.player1_id = p1.id
		 LEFT JOIN players p2 ON m.player2_id = p2.id
		 LEFT JOIN players tp1 ON m.team1_p1_id = tp1.id
		 LEFT JOIN players tp2 ON m.team1_p2_id = tp2.id
		 LEFT JOIN players tp3 ON m.team2_p1_id = tp3.id
		 LEFT JOIN players tp4 ON m.team2_p2_id = tp4.id
		 WHERE m.player1_id=? OR m.player2_id=? OR m.team1_p1_id=? OR m.team1_p2_id=? OR m.team2_p1_id=? OR m.team2_p2_id=?
		 ORDER BY m.played_at DESC LIMIT 10`,
		[id, id, id, id, id, id]
	);
}

