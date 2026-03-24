import { expectedScore } from './elo.js';

export interface MatchmakingPlayer {
	id: number;
	elo: number;
}

/**
 * Returns the player with the closest ELO to the given player (excluding self).
 */
export function suggestOpponent1v1(
	playerId: number,
	allPlayers: MatchmakingPlayer[]
): MatchmakingPlayer | null {
	const others = allPlayers.filter((p) => p.id !== playerId);
	if (others.length === 0) return null;

	const self = allPlayers.find((p) => p.id === playerId);
	if (!self) return null;

	return others.reduce((best, candidate) =>
		Math.abs(candidate.elo - self.elo) < Math.abs(best.elo - self.elo) ? candidate : best
	);
}

export interface TeamSuggestion {
	team1: MatchmakingPlayer[];
	team2: MatchmakingPlayer[];
	eloDiff: number;
}

/**
 * Splits players into two balanced teams minimising |avgElo(team1) - avgElo(team2)|.
 * Tries all combinations for ≤8 players; random-samples for larger pools.
 */
export function suggestTeams2v2(allPlayers: MatchmakingPlayer[]): TeamSuggestion | null {
	if (allPlayers.length < 4) return null;

	const teamSize = Math.floor(allPlayers.length / 2);
	const avgElo = (players: MatchmakingPlayer[]) =>
		players.reduce((sum, p) => sum + p.elo, 0) / players.length;

	const score = (team1: MatchmakingPlayer[], team2: MatchmakingPlayer[]) =>
		Math.abs(avgElo(team1) - avgElo(team2));

	if (allPlayers.length <= 8) {
		// Exhaustive search over all combinations
		const indices = allPlayers.map((_, i) => i);
		const combinations = getCombinations(indices, teamSize);

		let best: TeamSuggestion | null = null;

		for (const combo of combinations) {
			const team1 = combo.map((i) => allPlayers[i]);
			const team2 = allPlayers.filter((_, i) => !combo.includes(i)).slice(0, teamSize);
			const diff = score(team1, team2);

			if (best === null || diff < best.eloDiff) {
				best = { team1, team2, eloDiff: diff };
			}
		}

		return best;
	} else {
		// Random sampling for larger pools
		const SAMPLES = 500;
		let best: TeamSuggestion | null = null;

		for (let i = 0; i < SAMPLES; i++) {
			const shuffled = [...allPlayers].sort(() => Math.random() - 0.5);
			const team1 = shuffled.slice(0, teamSize);
			const team2 = shuffled.slice(teamSize, teamSize * 2);
			const diff = score(team1, team2);

			if (best === null || diff < best.eloDiff) {
				best = { team1, team2, eloDiff: diff };
			}
		}

		return best;
	}
}

/**
 * Returns the win probability for player A against player B (0–100).
 */
export function winProbability(ratingA: number, ratingB: number): number {
	return Math.round(expectedScore(ratingA, ratingB) * 100);
}

function getCombinations<T>(arr: T[], size: number): T[][] {
	if (size === 0) return [[]];
	if (arr.length < size) return [];

	const [first, ...rest] = arr;
	const withFirst = getCombinations(rest, size - 1).map((combo) => [first, ...combo]);
	const withoutFirst = getCombinations(rest, size);

	return [...withFirst, ...withoutFirst];
}
