export function getKFactor(gamesPlayed: number): number {
	if (gamesPlayed < 10) return 32;
	if (gamesPlayed <= 30) return 24;
	return 16;
}

export function expectedScore(ratingA: number, ratingB: number): number {
	return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export interface EloPlayer {
	id: number;
	elo: number;
	games: number;
}

export interface Elo1v1Result {
	winnerId: number;
	newWinnerElo: number;
	loserId: number;
	newLoserElo: number;
}

export function updateElo1v1(winner: EloPlayer, loser: EloPlayer): Elo1v1Result {
	const k = getKFactor(winner.games);
	const expected = expectedScore(winner.elo, loser.elo);
	const delta = Math.round(k * (1 - expected));

	return {
		winnerId: winner.id,
		newWinnerElo: winner.elo + delta,
		loserId: loser.id,
		newLoserElo: loser.elo - delta
	};
}

export interface Elo2v2PlayerResult {
	id: number;
	newElo: number;
}

export interface Elo2v2Result {
	team1Results: Elo2v2PlayerResult[];
	team2Results: Elo2v2PlayerResult[];
}

export function updateElo2v2(
	team1: [EloPlayer, EloPlayer],
	team2: [EloPlayer, EloPlayer],
	team1Won: boolean
): Elo2v2Result {
	const avgElo1 = (team1[0].elo + team1[1].elo) / 2;
	const avgElo2 = (team2[0].elo + team2[1].elo) / 2;

	const avgGames1 = (team1[0].games + team1[1].games) / 2;
	const avgGames2 = (team2[0].games + team2[1].games) / 2;

	const k1 = getKFactor(Math.round(avgGames1));
	const k2 = getKFactor(Math.round(avgGames2));

	const expected1 = expectedScore(avgElo1, avgElo2);
	const score1 = team1Won ? 1 : 0;
	const score2 = team1Won ? 0 : 1;

	const delta1 = Math.round(k1 * (score1 - expected1));
	const delta2 = Math.round(k2 * (score2 - (1 - expected1)));

	return {
		team1Results: team1.map((p) => ({ id: p.id, newElo: p.elo + delta1 })),
		team2Results: team2.map((p) => ({ id: p.id, newElo: p.elo + delta2 }))
	};
}
