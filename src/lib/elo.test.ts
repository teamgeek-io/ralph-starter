import { describe, it, expect } from 'vitest';
import {
	getKFactor,
	expectedScore,
	updateElo1v1,
	updateElo2v2
} from './elo.js';

describe('getKFactor', () => {
	it('returns 32 for fewer than 10 games', () => {
		expect(getKFactor(0)).toBe(32);
		expect(getKFactor(9)).toBe(32);
	});

	it('returns 24 for 10–30 games', () => {
		expect(getKFactor(10)).toBe(24);
		expect(getKFactor(30)).toBe(24);
	});

	it('returns 16 for more than 30 games', () => {
		expect(getKFactor(31)).toBe(16);
		expect(getKFactor(100)).toBe(16);
	});
});

describe('expectedScore', () => {
	it('returns 0.5 for equal ratings', () => {
		expect(expectedScore(1000, 1000)).toBeCloseTo(0.5);
	});

	it('returns > 0.5 when ratingA > ratingB', () => {
		expect(expectedScore(1200, 1000)).toBeGreaterThan(0.5);
	});

	it('returns < 0.5 when ratingA < ratingB', () => {
		expect(expectedScore(800, 1000)).toBeLessThan(0.5);
	});

	it('expected score sums to 1 for both players', () => {
		const a = expectedScore(1200, 1000);
		const b = expectedScore(1000, 1200);
		expect(a + b).toBeCloseTo(1);
	});
});

describe('updateElo1v1', () => {
	it('increases winner ELO and decreases loser ELO', () => {
		const winner = { id: 1, elo: 1000, games: 5 };
		const loser = { id: 2, elo: 1000, games: 5 };
		const result = updateElo1v1(winner, loser);

		expect(result.newWinnerElo).toBeGreaterThan(1000);
		expect(result.newLoserElo).toBeLessThan(1000);
		expect(result.winnerId).toBe(1);
		expect(result.loserId).toBe(2);
	});

	it('gives smaller delta when winner has much higher ELO (expected win)', () => {
		const strongWinner = { id: 1, elo: 1400, games: 5 };
		const weakLoser = { id: 2, elo: 1000, games: 5 };
		const result1 = updateElo1v1(strongWinner, weakLoser);

		const evenWinner = { id: 1, elo: 1000, games: 5 };
		const evenLoser = { id: 2, elo: 1000, games: 5 };
		const result2 = updateElo1v1(evenWinner, evenLoser);

		const delta1 = result1.newWinnerElo - strongWinner.elo;
		const delta2 = result2.newWinnerElo - evenWinner.elo;
		expect(delta1).toBeLessThan(delta2);
	});

	it('uses correct K-factor based on games played', () => {
		const newWinner = { id: 1, elo: 1000, games: 5 };   // K=32
		const vetWinner = { id: 3, elo: 1000, games: 50 };  // K=16
		const loser     = { id: 2, elo: 1000, games: 5 };

		const newResult = updateElo1v1(newWinner, loser);
		const vetResult = updateElo1v1(vetWinner, loser);

		const newDelta = newResult.newWinnerElo - newWinner.elo;
		const vetDelta = vetResult.newWinnerElo - vetWinner.elo;
		expect(newDelta).toBeGreaterThan(vetDelta);
	});
});

describe('updateElo2v2', () => {
	it('adjusts all four players', () => {
		const team1: [typeof p, typeof p] = [
			{ id: 1, elo: 1000, games: 5 },
			{ id: 2, elo: 1000, games: 5 }
		];
		const team2: [typeof p, typeof p] = [
			{ id: 3, elo: 1000, games: 5 },
			{ id: 4, elo: 1000, games: 5 }
		];
		const p = { id: 0, elo: 0, games: 0 };

		const result = updateElo2v2(team1, team2, true);

		expect(result.team1Results).toHaveLength(2);
		expect(result.team2Results).toHaveLength(2);

		for (const r of result.team1Results) {
			expect(r.newElo).toBeGreaterThan(1000);
		}
		for (const r of result.team2Results) {
			expect(r.newElo).toBeLessThan(1000);
		}
	});

	it('distributes equal delta to both teammates', () => {
		const team1: [{ id: number; elo: number; games: number }, { id: number; elo: number; games: number }] = [
			{ id: 1, elo: 1000, games: 5 },
			{ id: 2, elo: 1000, games: 5 }
		];
		const team2: [{ id: number; elo: number; games: number }, { id: number; elo: number; games: number }] = [
			{ id: 3, elo: 1000, games: 5 },
			{ id: 4, elo: 1000, games: 5 }
		];

		const result = updateElo2v2(team1, team2, true);

		expect(result.team1Results[0].newElo).toBe(result.team1Results[1].newElo);
		expect(result.team2Results[0].newElo).toBe(result.team2Results[1].newElo);
	});

	it('correctly identifies winner and loser teams by id', () => {
		const team1: [{ id: number; elo: number; games: number }, { id: number; elo: number; games: number }] = [
			{ id: 1, elo: 1000, games: 5 },
			{ id: 2, elo: 1000, games: 5 }
		];
		const team2: [{ id: number; elo: number; games: number }, { id: number; elo: number; games: number }] = [
			{ id: 3, elo: 1000, games: 5 },
			{ id: 4, elo: 1000, games: 5 }
		];

		const result = updateElo2v2(team1, team2, false); // team2 wins

		for (const r of result.team1Results) {
			expect(r.newElo).toBeLessThan(1000);
		}
		for (const r of result.team2Results) {
			expect(r.newElo).toBeGreaterThan(1000);
		}
	});
});
