import { query, run } from '$lib/db';
import { updateElo1v1, updateElo2v2 } from '$lib/elo';

export interface Tournament {
	id: number;
	name: string;
	type: '1v1' | '2v2';
	status: 'registration' | 'group_stage' | 'knockout' | 'complete';
	winner_id: number | null;
	created_at: string;
}

export interface TournamentParticipant {
	id: number;
	tournament_id: number;
	player1_id: number;
	player2_id: number | null;
	eliminated: number;
	p1_name: string;
	p2_name: string | null;
}

export interface GroupStandingsRow {
	rank: number;
	participant_id: number;
	player1_id: number;
	player2_id: number | null;
	label: string;
	played: number;
	won: number;
	lost: number;
	drawn: number;
	points: number;
}

export interface BracketMatch {
	id: number;
	tournament_round: string;
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

// Static bracket progression: which round/slot the winner feeds into
const NEXT_ROUND: Record<string, { round: string; slot: 1 | 2 }> = {
	QF1: { round: 'SF1', slot: 1 },
	QF2: { round: 'SF1', slot: 2 },
	QF3: { round: 'SF2', slot: 1 },
	QF4: { round: 'SF2', slot: 2 },
	SF1: { round: 'F', slot: 1 },
	SF2: { round: 'F', slot: 2 }
};

let tournaments = $state<Tournament[]>([]);

function refresh(): void {
	tournaments = query<Tournament>('SELECT * FROM tournaments ORDER BY created_at DESC');
}

export function getAllTournaments(): Tournament[] {
	return tournaments;
}

export function getTournament(id: number): Tournament | undefined {
	return query<Tournament>('SELECT * FROM tournaments WHERE id = ?', [id])[0];
}

/** Create a tournament and return its new ID. */
export function createTournament(name: string, type: '1v1' | '2v2'): number {
	const trimmed = name.trim();
	if (!trimmed) throw new Error('Tournament name cannot be empty');
	run('INSERT INTO tournaments (name, type) VALUES (?, ?)', [trimmed, type]);
	refresh();
	const result = query<{ id: number }>('SELECT last_insert_rowid() AS id');
	return result[0]?.id ?? 0;
}

export function getParticipants(tournamentId: number): TournamentParticipant[] {
	return query<TournamentParticipant>(
		`SELECT tp.id, tp.tournament_id, tp.player1_id, tp.player2_id, tp.eliminated,
		        p1.name AS p1_name, p2.name AS p2_name
		 FROM tournament_participants tp
		 JOIN players p1 ON tp.player1_id = p1.id
		 LEFT JOIN players p2 ON tp.player2_id = p2.id
		 WHERE tp.tournament_id = ?
		 ORDER BY tp.id`,
		[tournamentId]
	);
}

/** Register a participant. For 1v1 omit player2Id; for 2v2 supply both. */
export function registerParticipant(
	tournamentId: number,
	player1Id: number,
	player2Id?: number
): void {
	const tournament = getTournament(tournamentId);
	if (!tournament) throw new Error('Tournament not found');
	if (tournament.status !== 'registration') throw new Error('Tournament is not in registration phase');
	run(
		'INSERT INTO tournament_participants (tournament_id, player1_id, player2_id) VALUES (?, ?, ?)',
		[tournamentId, player1Id, player2Id ?? null]
	);
}

export function removeParticipant(tournamentId: number, participantId: number): void {
	const tournament = getTournament(tournamentId);
	if (!tournament) throw new Error('Tournament not found');
	if (tournament.status !== 'registration') throw new Error('Tournament is not in registration phase');
	run('DELETE FROM tournament_participants WHERE id = ? AND tournament_id = ?', [
		participantId,
		tournamentId
	]);
}

/** Transition to group_stage and generate the round-robin schedule. */
export function startTournament(tournamentId: number): void {
	const tournament = getTournament(tournamentId);
	if (!tournament) throw new Error('Tournament not found');
	if (tournament.status !== 'registration') throw new Error('Tournament is not in registration phase');
	const participants = getParticipants(tournamentId);
	if (participants.length < 2) throw new Error('Need at least 2 participants to start');
	run("UPDATE tournaments SET status = 'group_stage' WHERE id = ?", [tournamentId]);
	generateGroupSchedule(tournamentId);
	refresh();
}

/** Create round-robin group matches (each participant vs every other, once). */
export function generateGroupSchedule(tournamentId: number): void {
	const tournament = getTournament(tournamentId);
	if (!tournament) throw new Error('Tournament not found');
	const participants = getParticipants(tournamentId);

	for (let i = 0; i < participants.length; i++) {
		for (let j = i + 1; j < participants.length; j++) {
			const p1 = participants[i];
			const p2 = participants[j];
			if (tournament.type === '1v1') {
				run(
					`INSERT INTO matches (type, player1_id, player2_id, score1, score2, tournament_id, tournament_round)
					 VALUES ('1v1', ?, ?, -1, -1, ?, 'group')`,
					[p1.player1_id, p2.player1_id, tournamentId]
				);
			} else {
				run(
					`INSERT INTO matches
					   (type, team1_p1_id, team1_p2_id, team2_p1_id, team2_p2_id, score1, score2, tournament_id, tournament_round)
					 VALUES ('2v2', ?, ?, ?, ?, -1, -1, ?, 'group')`,
					[p1.player1_id, p1.player2_id, p2.player1_id, p2.player2_id, tournamentId]
				);
			}
		}
	}
}

/** Points-based standings (win=3, draw=1, loss=0) for played group matches. */
export function getGroupStandings(tournamentId: number): GroupStandingsRow[] {
	const tournament = getTournament(tournamentId);
	if (!tournament) return [];
	const participants = getParticipants(tournamentId);
	if (!participants.length) return [];

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

	// Only consider matches that have been played (score >= 0)
	const matches = query<MatchRow>(
		`SELECT type, score1, score2, player1_id, player2_id,
		        team1_p1_id, team1_p2_id, team2_p1_id, team2_p2_id
		 FROM matches
		 WHERE tournament_id = ? AND tournament_round = 'group' AND score1 >= 0 AND score2 >= 0`,
		[tournamentId]
	);

	type Stats = {
		participant_id: number;
		player1_id: number;
		player2_id: number | null;
		label: string;
		won: number;
		lost: number;
		drawn: number;
	};

	const statsMap = new Map<number, Stats>();
	for (const p of participants) {
		const label =
			p.player2_id !== null ? `${p.p1_name} & ${p.p2_name}` : (p.p1_name ?? `Player ${p.player1_id}`);
		statsMap.set(p.id, {
			participant_id: p.id,
			player1_id: p.player1_id,
			player2_id: p.player2_id,
			label,
			won: 0,
			lost: 0,
			drawn: 0
		});
	}

	for (const match of matches) {
		for (const p of participants) {
			let onTeam1: boolean;
			if (tournament.type === '1v1') {
				if (match.player1_id !== p.player1_id && match.player2_id !== p.player1_id) continue;
				onTeam1 = match.player1_id === p.player1_id;
			} else {
				// team1_p1_id is always the participant's player1_id (set in generateGroupSchedule)
				if (match.team1_p1_id !== p.player1_id && match.team2_p1_id !== p.player1_id) continue;
				onTeam1 = match.team1_p1_id === p.player1_id;
			}

			const stats = statsMap.get(p.id)!;
			if (match.score1 === match.score2) {
				stats.drawn++;
			} else if (onTeam1 ? match.score1 > match.score2 : match.score2 > match.score1) {
				stats.won++;
			} else {
				stats.lost++;
			}
		}
	}

	const rows = Array.from(statsMap.values())
		.map((s) => ({
			...s,
			played: s.won + s.lost + s.drawn,
			points: s.won * 3 + s.drawn
		}))
		.sort((a, b) => b.points - a.points || b.won - a.won || a.lost - b.lost);

	return rows.map((r, i) => ({ rank: i + 1, ...r }));
}

/**
 * Seed knockout bracket from top N group-stage finishers.
 * topN should be 2, 4, or 8. Seeding: 1 vs N, 2 vs N-1, etc.
 * Creates first-round matches with real players, and stub matches
 * (score=-1, no players) for subsequent rounds.
 */
export function generateKnockoutBracket(tournamentId: number, topN: number): void {
	const tournament = getTournament(tournamentId);
	if (!tournament) throw new Error('Tournament not found');

	const standings = getGroupStandings(tournamentId);
	const seeds = standings.slice(0, Math.min(topN, standings.length));
	if (seeds.length < 2) throw new Error('Need at least 2 participants for knockout');

	let firstRound: string;
	if (topN >= 8) firstRound = 'QF';
	else if (topN >= 4) firstRound = 'SF';
	else firstRound = 'F';

	const pairCount = Math.floor(seeds.length / 2);
	for (let i = 0; i < pairCount; i++) {
		const p1 = seeds[i];
		const p2 = seeds[seeds.length - 1 - i];
		const roundLabel = firstRound === 'F' ? 'F' : `${firstRound}${i + 1}`;

		if (tournament.type === '1v1') {
			run(
				`INSERT INTO matches (type, player1_id, player2_id, score1, score2, tournament_id, tournament_round)
				 VALUES ('1v1', ?, ?, -1, -1, ?, ?)`,
				[p1.player1_id, p2.player1_id, tournamentId, roundLabel]
			);
		} else {
			run(
				`INSERT INTO matches
				   (type, team1_p1_id, team1_p2_id, team2_p1_id, team2_p2_id, score1, score2, tournament_id, tournament_round)
				 VALUES ('2v2', ?, ?, ?, ?, -1, -1, ?, ?)`,
				[p1.player1_id, p1.player2_id, p2.player1_id, p2.player2_id, tournamentId, roundLabel]
			);
		}
	}

	// Create stub matches for later rounds
	const stubRounds: string[] = [];
	if (firstRound === 'QF') stubRounds.push('SF1', 'SF2', 'F');
	else if (firstRound === 'SF') stubRounds.push('F');

	for (const roundLabel of stubRounds) {
		if (tournament.type === '1v1') {
			run(
				`INSERT INTO matches (type, player1_id, player2_id, score1, score2, tournament_id, tournament_round)
				 VALUES ('1v1', NULL, NULL, -1, -1, ?, ?)`,
				[tournamentId, roundLabel]
			);
		} else {
			run(
				`INSERT INTO matches
				   (type, team1_p1_id, team1_p2_id, team2_p1_id, team2_p2_id, score1, score2, tournament_id, tournament_round)
				 VALUES ('2v2', NULL, NULL, NULL, NULL, -1, -1, ?, ?)`,
				[tournamentId, roundLabel]
			);
		}
	}

	run("UPDATE tournaments SET status = 'knockout' WHERE id = ?", [tournamentId]);
	refresh();
}

/** Save match score, update ELO, and advance the bracket. */
export function recordTournamentMatch(matchId: number, score1: number, score2: number): void {
	interface FullMatch {
		id: number;
		type: string;
		tournament_id: number | null;
		tournament_round: string | null;
		player1_id: number | null;
		player2_id: number | null;
		team1_p1_id: number | null;
		team1_p2_id: number | null;
		team2_p1_id: number | null;
		team2_p2_id: number | null;
	}

	const matchRows = query<FullMatch>('SELECT * FROM matches WHERE id = ?', [matchId]);
	if (!matchRows.length) throw new Error('Match not found');
	const match = matchRows[0];
	if (!match.tournament_id) throw new Error('Not a tournament match');

	const tournament = getTournament(match.tournament_id);
	if (!tournament) throw new Error('Tournament not found');

	// Persist scores
	run('UPDATE matches SET score1 = ?, score2 = ? WHERE id = ?', [score1, score2, matchId]);

	// ELO update helper
	const getPlayer = (id: number) =>
		query<{ id: number; elo: number; games_played: number }>(
			'SELECT id, elo, games_played FROM players WHERE id = ?',
			[id]
		)[0];

	if (score1 !== score2) {
		if (tournament.type === '1v1' && match.player1_id && match.player2_id) {
			const p1 = getPlayer(match.player1_id);
			const p2 = getPlayer(match.player2_id);
			if (p1 && p2) {
				const [winner, loser] = score1 > score2 ? [p1, p2] : [p2, p1];
				const result = updateElo1v1(
					{ id: winner.id, elo: winner.elo, games: winner.games_played },
					{ id: loser.id, elo: loser.elo, games: loser.games_played }
				);
				run('UPDATE players SET elo = ?, games_played = games_played + 1 WHERE id = ?', [
					result.newWinnerElo,
					result.winnerId
				]);
				run('UPDATE players SET elo = ?, games_played = games_played + 1 WHERE id = ?', [
					result.newLoserElo,
					result.loserId
				]);
				run(
					'INSERT INTO elo_history (player_id, elo, delta, match_id) VALUES (?, ?, ?, ?)',
					[result.winnerId, result.newWinnerElo, result.newWinnerElo - winner.elo, matchId]
				);
				run(
					'INSERT INTO elo_history (player_id, elo, delta, match_id) VALUES (?, ?, ?, ?)',
					[result.loserId, result.newLoserElo, result.newLoserElo - loser.elo, matchId]
				);
			}
		} else if (
			tournament.type === '2v2' &&
			match.team1_p1_id &&
			match.team1_p2_id &&
			match.team2_p1_id &&
			match.team2_p2_id
		) {
			const t1p1 = getPlayer(match.team1_p1_id);
			const t1p2 = getPlayer(match.team1_p2_id);
			const t2p1 = getPlayer(match.team2_p1_id);
			const t2p2 = getPlayer(match.team2_p2_id);
			if (t1p1 && t1p2 && t2p1 && t2p2) {
				const origMap = new Map([t1p1, t1p2, t2p1, t2p2].map((p) => [p.id, p]));
				const result = updateElo2v2(
					[
						{ id: t1p1.id, elo: t1p1.elo, games: t1p1.games_played },
						{ id: t1p2.id, elo: t1p2.elo, games: t1p2.games_played }
					],
					[
						{ id: t2p1.id, elo: t2p1.elo, games: t2p1.games_played },
						{ id: t2p2.id, elo: t2p2.elo, games: t2p2.games_played }
					],
					score1 > score2
				);
				for (const pr of [...result.team1Results, ...result.team2Results]) {
					const orig = origMap.get(pr.id)!;
					run('UPDATE players SET elo = ?, games_played = games_played + 1 WHERE id = ?', [
						pr.newElo,
						pr.id
					]);
					run('INSERT INTO elo_history (player_id, elo, delta, match_id) VALUES (?, ?, ?, ?)', [
						pr.id,
						pr.newElo,
						pr.newElo - orig.elo,
						matchId
					]);
				}
			}
		}
	} else {
		// Draw: increment games_played only
		const pids: number[] = [];
		if (tournament.type === '1v1') {
			if (match.player1_id) pids.push(match.player1_id);
			if (match.player2_id) pids.push(match.player2_id);
		} else {
			if (match.team1_p1_id) pids.push(match.team1_p1_id);
			if (match.team1_p2_id) pids.push(match.team1_p2_id);
			if (match.team2_p1_id) pids.push(match.team2_p1_id);
			if (match.team2_p2_id) pids.push(match.team2_p2_id);
		}
		for (const pid of pids) {
			run('UPDATE players SET games_played = games_played + 1 WHERE id = ?', [pid]);
		}
	}

	// Advance the bracket (only for knockout rounds, not the final)
	const round = match.tournament_round;
	if (round && round !== 'group' && round !== 'F' && score1 !== score2) {
		const nextInfo = NEXT_ROUND[round];
		if (nextInfo) {
			const nextMatches = query<{ id: number }>(
				'SELECT id FROM matches WHERE tournament_id = ? AND tournament_round = ?',
				[match.tournament_id, nextInfo.round]
			);
			if (nextMatches.length > 0) {
				const nextId = nextMatches[0].id;
				if (tournament.type === '1v1') {
					const winnerId = score1 > score2 ? match.player1_id : match.player2_id;
					if (nextInfo.slot === 1) {
						run('UPDATE matches SET player1_id = ? WHERE id = ?', [winnerId, nextId]);
					} else {
						run('UPDATE matches SET player2_id = ? WHERE id = ?', [winnerId, nextId]);
					}
				} else {
					const winnerP1 = score1 > score2 ? match.team1_p1_id : match.team2_p1_id;
					const winnerP2 = score1 > score2 ? match.team1_p2_id : match.team2_p2_id;
					if (nextInfo.slot === 1) {
						run('UPDATE matches SET team1_p1_id = ?, team1_p2_id = ? WHERE id = ?', [
							winnerP1,
							winnerP2,
							nextId
						]);
					} else {
						run('UPDATE matches SET team2_p1_id = ?, team2_p2_id = ? WHERE id = ?', [
							winnerP1,
							winnerP2,
							nextId
						]);
					}
				}
			}
		}
		// Mark loser as eliminated
		if (tournament.type === '1v1') {
			const loserId = score1 > score2 ? match.player2_id : match.player1_id;
			if (loserId) {
				run(
					'UPDATE tournament_participants SET eliminated = 1 WHERE tournament_id = ? AND player1_id = ?',
					[match.tournament_id, loserId]
				);
			}
		}
	}

	// Final match — mark tournament complete
	if (round === 'F' && score1 !== score2) {
		const winnerId =
			tournament.type === '1v1'
				? score1 > score2
					? match.player1_id
					: match.player2_id
				: score1 > score2
					? match.team1_p1_id
					: match.team2_p1_id;

		const loserId =
			tournament.type === '1v1'
				? score1 > score2
					? match.player2_id
					: match.player1_id
				: null;

		if (loserId) {
			run(
				'UPDATE tournament_participants SET eliminated = 1 WHERE tournament_id = ? AND player1_id = ?',
				[match.tournament_id, loserId]
			);
		}

		run("UPDATE tournaments SET status = 'complete', winner_id = ? WHERE id = ?", [
			winnerId,
			match.tournament_id
		]);
		refresh();
	}
}

/** Return all knockout bracket matches (non-group) for a tournament, with player names. */
export function getTournamentBracket(tournamentId: number): BracketMatch[] {
	return query<BracketMatch>(
		`SELECT m.id, m.tournament_round, m.type, m.score1, m.score2, m.played_at,
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
		 WHERE m.tournament_id = ? AND m.tournament_round != 'group'
		 ORDER BY m.id`,
		[tournamentId]
	);
}

/** Return all group-stage matches for a tournament, with player names. */
export function getGroupMatches(tournamentId: number): BracketMatch[] {
	return query<BracketMatch>(
		`SELECT m.id, m.tournament_round, m.type, m.score1, m.score2, m.played_at,
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
		 WHERE m.tournament_id = ? AND m.tournament_round = 'group'
		 ORDER BY m.id`,
		[tournamentId]
	);
}

/** Call once after DB is initialised to populate the reactive state. */
export function loadTournaments(): void {
	refresh();
}
