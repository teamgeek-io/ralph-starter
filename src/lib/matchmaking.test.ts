import { describe, it, expect } from 'vitest';
import {
	suggestOpponent1v1,
	suggestTeams2v2,
	winProbability
} from './matchmaking.js';
import type { MatchmakingPlayer } from './matchmaking.js';

const players: MatchmakingPlayer[] = [
	{ id: 1, elo: 1000 },
	{ id: 2, elo: 1050 },
	{ id: 3, elo: 1200 },
	{ id: 4, elo: 800 }
];

describe('suggestOpponent1v1', () => {
	it('returns the player with closest ELO', () => {
		const result = suggestOpponent1v1(1, players); // id:1 elo:1000
		expect(result?.id).toBe(2); // id:2 elo:1050 — closest to 1000
	});

	it('excludes self', () => {
		const result = suggestOpponent1v1(1, players);
		expect(result?.id).not.toBe(1);
	});

	it('returns null when no other players exist', () => {
		const result = suggestOpponent1v1(1, [{ id: 1, elo: 1000 }]);
		expect(result).toBeNull();
	});

	it('returns null when player id not found', () => {
		const result = suggestOpponent1v1(99, players);
		expect(result).toBeNull();
	});
});

describe('suggestTeams2v2', () => {
	it('returns null when fewer than 4 players', () => {
		expect(suggestTeams2v2([{ id: 1, elo: 1000 }, { id: 2, elo: 1100 }])).toBeNull();
	});

	it('returns two teams with equal size', () => {
		const result = suggestTeams2v2(players);
		expect(result).not.toBeNull();
		expect(result!.team1).toHaveLength(2);
		expect(result!.team2).toHaveLength(2);
	});

	it('produces the most balanced split by average ELO', () => {
		// players: 1000, 1050, 1200, 800
		// best split: [1000,1200] vs [1050,800] → avg 1100 vs 925 → diff 175
		// OR: [1000,1050] vs [1200,800] → avg 1025 vs 1000 → diff 25 ✓
		const result = suggestTeams2v2(players);
		expect(result!.eloDiff).toBeLessThanOrEqual(25);
	});

	it('does not include the same player on both teams', () => {
		const result = suggestTeams2v2(players)!;
		const team1Ids = result.team1.map((p) => p.id);
		const team2Ids = result.team2.map((p) => p.id);
		const overlap = team1Ids.filter((id) => team2Ids.includes(id));
		expect(overlap).toHaveLength(0);
	});

	it('handles larger player pools via sampling', () => {
		const largePlayers: MatchmakingPlayer[] = Array.from({ length: 10 }, (_, i) => ({
			id: i + 1,
			elo: 1000 + i * 50
		}));
		const result = suggestTeams2v2(largePlayers);
		expect(result).not.toBeNull();
		expect(result!.team1).toHaveLength(5);
		expect(result!.team2).toHaveLength(5);
	});
});

describe('winProbability', () => {
	it('returns 50 for equal ratings', () => {
		expect(winProbability(1000, 1000)).toBe(50);
	});

	it('returns > 50 when ratingA > ratingB', () => {
		expect(winProbability(1200, 1000)).toBeGreaterThan(50);
	});

	it('returns < 50 when ratingA < ratingB', () => {
		expect(winProbability(800, 1000)).toBeLessThan(50);
	});

	it('returns a value between 0 and 100', () => {
		expect(winProbability(2000, 800)).toBeGreaterThanOrEqual(0);
		expect(winProbability(2000, 800)).toBeLessThanOrEqual(100);
	});
});
