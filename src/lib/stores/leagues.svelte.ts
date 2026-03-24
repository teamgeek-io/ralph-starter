import { query, run } from '$lib/db';

export interface League {
	id: number;
	name: string;
	season: string | null;
	active: number;
	created_at: string;
}

export interface LeaguePlayer {
	league_id: number;
	player_id: number;
	name: string;
	elo: number;
}

export interface LeagueStandingsRow {
	rank: number;
	player_id: number;
	player: string;
	played: number;
	won: number;
	lost: number;
	drawn: number;
	points: number;
	elo: number;
}

let leagues = $state<League[]>([]);

function refresh(): void {
	leagues = query<League>('SELECT * FROM leagues ORDER BY active DESC, created_at DESC');
}

export function getAllLeagues(): League[] {
	return leagues;
}

export function getLeague(id: number): League | undefined {
	return query<League>('SELECT * FROM leagues WHERE id = ?', [id])[0];
}

export function createLeague(name: string, season?: string): void {
	const trimmed = name.trim();
	if (!trimmed) throw new Error('League name cannot be empty');
	run('INSERT INTO leagues (name, season) VALUES (?, ?)', [trimmed, season?.trim() ?? null]);
	refresh();
}

export function updateLeague(id: number, name: string, season?: string, active?: number): void {
	const trimmed = name.trim();
	if (!trimmed) throw new Error('League name cannot be empty');
	run('UPDATE leagues SET name = ?, season = ?, active = ? WHERE id = ?', [
		trimmed,
		season?.trim() ?? null,
		active ?? 1,
		id
	]);
	refresh();
}

export function deleteLeague(id: number): void {
	run('DELETE FROM league_players WHERE league_id = ?', [id]);
	run('DELETE FROM leagues WHERE id = ?', [id]);
	refresh();
}

export function addPlayerToLeague(leagueId: number, playerId: number): void {
	run('INSERT OR IGNORE INTO league_players (league_id, player_id) VALUES (?, ?)', [
		leagueId,
		playerId
	]);
}

export function removePlayerFromLeague(leagueId: number, playerId: number): void {
	run('DELETE FROM league_players WHERE league_id = ? AND player_id = ?', [leagueId, playerId]);
}

export function getLeaguePlayers(leagueId: number): LeaguePlayer[] {
	return query<LeaguePlayer>(
		`SELECT lp.league_id, lp.player_id, p.name, p.elo
		 FROM league_players lp
		 JOIN players p ON lp.player_id = p.id
		 WHERE lp.league_id = ?
		 ORDER BY p.elo DESC`,
		[leagueId]
	);
}

export function getLeagueStandings(leagueId: number): LeagueStandingsRow[] {
	interface RawRow {
		player_id: number;
		player: string;
		elo: number;
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

	const members = getLeaguePlayers(leagueId);
	if (!members.length) return [];

	// Pull all matches for this league
	const matches = query<RawRow>(
		`SELECT p.id AS player_id, p.name AS player, p.elo,
		        m.type, m.score1, m.score2,
		        m.player1_id, m.player2_id,
		        m.team1_p1_id, m.team1_p2_id,
		        m.team2_p1_id, m.team2_p2_id
		 FROM league_players lp
		 JOIN players p ON lp.player_id = p.id
		 JOIN matches m ON m.league_id = ?
		   AND (
		     m.player1_id = p.id OR m.player2_id = p.id OR
		     m.team1_p1_id = p.id OR m.team1_p2_id = p.id OR
		     m.team2_p1_id = p.id OR m.team2_p2_id = p.id
		   )
		 WHERE lp.league_id = ?`,
		[leagueId, leagueId]
	);

	// Aggregate stats per player
	const statsMap = new Map<
		number,
		{ player_id: number; player: string; elo: number; won: number; lost: number; drawn: number }
	>();

	for (const member of members) {
		statsMap.set(member.player_id, {
			player_id: member.player_id,
			player: member.name,
			elo: member.elo,
			won: 0,
			lost: 0,
			drawn: 0
		});
	}

	// Track processed match IDs per player to avoid double-counting
	const processed = new Map<number, Set<string>>();

	for (const row of matches) {
		const pid = row.player_id;
		if (!statsMap.has(pid)) continue;

		const matchKey = `${row.type}-${row.score1}-${row.score2}-${row.player1_id ?? ''}-${row.player2_id ?? ''}-${row.team1_p1_id ?? ''}-${row.team1_p2_id ?? ''}-${row.team2_p1_id ?? ''}-${row.team2_p2_id ?? ''}`;

		if (!processed.has(pid)) processed.set(pid, new Set());
		const seen = processed.get(pid)!;
		if (seen.has(matchKey)) continue;
		seen.add(matchKey);

		const stats = statsMap.get(pid)!;
		const onTeam1 =
			row.type === '1v1'
				? row.player1_id === pid
				: row.team1_p1_id === pid || row.team1_p2_id === pid;

		if (row.score1 === row.score2) {
			stats.drawn++;
		} else if (onTeam1 ? row.score1 > row.score2 : row.score2 > row.score1) {
			stats.won++;
		} else {
			stats.lost++;
		}
	}

	const rows = Array.from(statsMap.values())
		.map((s) => ({
			...s,
			played: s.won + s.lost + s.drawn,
			points: s.won * 3 + s.drawn
		}))
		.sort((a, b) => b.points - a.points || b.elo - a.elo);

	return rows.map((r, i) => ({ rank: i + 1, ...r }));
}

/** Call once after DB is initialised to populate the reactive state. */
export function loadLeagues(): void {
	refresh();
}
