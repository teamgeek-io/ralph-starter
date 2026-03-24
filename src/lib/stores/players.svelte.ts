import { query, run } from '$lib/db';

export interface Player {
	id: number;
	name: string;
	elo: number;
	games_played: number;
	created_at: string;
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
