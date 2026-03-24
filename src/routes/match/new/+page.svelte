<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { whenReady, run, getDb } from '$lib/db';
	import { getAllPlayers, loadPlayers, type Player } from '$lib/stores/players.svelte';
	import { suggestOpponent1v1, suggestTeams2v2, winProbability } from '$lib/matchmaking';
	import { updateElo1v1, updateElo2v2 } from '$lib/elo';

	type Step = 'type' | 'players' | 'scores' | 'confirm' | 'done';

	let step = $state<Step>('type');
	let matchType = $state<'1v1' | '2v2'>('1v1');
	let ready = $state(false);
	let error = $state('');
	let submitting = $state(false);

	// 1v1 selections
	let p1Id = $state<number | null>(null);
	let p2Id = $state<number | null>(null);

	// 2v2 selections
	let t1p1Id = $state<number | null>(null);
	let t1p2Id = $state<number | null>(null);
	let t2p1Id = $state<number | null>(null);
	let t2p2Id = $state<number | null>(null);

	// Scores
	let score1 = $state(0);
	let score2 = $state(0);

	// ELO deltas shown on done screen
	let eloDeltas = $state<{ name: string; delta: number }[]>([]);

	let players = $derived(getAllPlayers());

	// Derived stats for display
	let winProb = $derived(
		matchType === '1v1' && p1Id && p2Id
			? winProbability(
					players.find((p) => p.id === p1Id)?.elo ?? 1000,
					players.find((p) => p.id === p2Id)?.elo ?? 1000
				)
			: null
	);

	let teamStats = $derived(
		matchType === '2v2' && t1p1Id && t1p2Id && t2p1Id && t2p2Id
			? (() => {
					const t1p1 = players.find((p) => p.id === t1p1Id);
					const t1p2 = players.find((p) => p.id === t1p2Id);
					const t2p1 = players.find((p) => p.id === t2p1Id);
					const t2p2 = players.find((p) => p.id === t2p2Id);
					if (!t1p1 || !t1p2 || !t2p1 || !t2p2) return null;
					const avg1 = Math.round((t1p1.elo + t1p2.elo) / 2);
					const avg2 = Math.round((t2p1.elo + t2p2.elo) / 2);
					return { avg1, avg2, prob1: winProbability(avg1, avg2) };
				})()
			: null
	);

	onMount(async () => {
		await whenReady();
		loadPlayers();
		ready = true;
	});

	function getPlayer(id: number | null): Player | undefined {
		return id != null ? players.find((p) => p.id === id) : undefined;
	}

	function autoSuggest1v1() {
		if (players.length < 2) return;
		if (!p1Id) p1Id = players[0].id;
		const suggested = suggestOpponent1v1(p1Id, players);
		p2Id = suggested?.id ?? players.find((p) => p.id !== p1Id)?.id ?? null;
	}

	function autoSuggest2v2() {
		if (players.length < 4) return;
		const suggestion = suggestTeams2v2(players);
		if (suggestion && suggestion.team1.length >= 2 && suggestion.team2.length >= 2) {
			t1p1Id = suggestion.team1[0].id;
			t1p2Id = suggestion.team1[1].id;
			t2p1Id = suggestion.team2[0].id;
			t2p2Id = suggestion.team2[1].id;
		}
	}

	function rebalance2v2() {
		const ids = [t1p1Id, t1p2Id, t2p1Id, t2p2Id].filter((id): id is number => id != null);
		const selected = players.filter((p) => ids.includes(p.id));
		if (selected.length < 4) return;
		const suggestion = suggestTeams2v2(selected);
		if (suggestion && suggestion.team1.length >= 2 && suggestion.team2.length >= 2) {
			t1p1Id = suggestion.team1[0].id;
			t1p2Id = suggestion.team1[1].id;
			t2p1Id = suggestion.team2[0].id;
			t2p2Id = suggestion.team2[1].id;
		}
	}

	function selectType(type: '1v1' | '2v2') {
		matchType = type;
		step = 'players';
		if (type === '1v1') autoSuggest1v1();
		else autoSuggest2v2();
	}

	function validatePlayers(): string {
		if (matchType === '1v1') {
			if (!p1Id || !p2Id) return 'Please select both players.';
			if (p1Id === p2Id) return 'Please select two different players.';
		} else {
			const ids = [t1p1Id, t1p2Id, t2p1Id, t2p2Id];
			if (ids.some((id) => !id)) return 'Please select all four players.';
			if (new Set(ids).size !== 4) return 'All four players must be different.';
		}
		return '';
	}

	function goToScores() {
		const err = validatePlayers();
		if (err) {
			error = err;
			return;
		}
		error = '';
		step = 'scores';
	}

	function goToConfirm() {
		error = '';
		step = 'confirm';
	}

	function getLastInsertId(): number {
		const result = getDb().exec('SELECT last_insert_rowid()');
		return result[0]?.values[0][0] as number;
	}

	function record1v1() {
		const p1 = getPlayer(p1Id)!;
		const p2 = getPlayer(p2Id)!;
		const isDraw = score1 === score2;

		run('INSERT INTO matches (type, player1_id, player2_id, score1, score2) VALUES (?, ?, ?, ?, ?)', [
			'1v1',
			p1.id,
			p2.id,
			score1,
			score2
		]);
		const matchId = getLastInsertId();

		if (!isDraw) {
			const [winner, loser] = score1 > score2 ? [p1, p2] : [p2, p1];
			const result = updateElo1v1(
				{ id: winner.id, elo: winner.elo, games: winner.games_played },
				{ id: loser.id, elo: loser.elo, games: loser.games_played }
			);
			const winDelta = result.newWinnerElo - winner.elo;
			const loseDelta = result.newLoserElo - loser.elo;

			run('UPDATE players SET elo = ?, games_played = games_played + 1 WHERE id = ?', [
				result.newWinnerElo,
				winner.id
			]);
			run('UPDATE players SET elo = ?, games_played = games_played + 1 WHERE id = ?', [
				result.newLoserElo,
				loser.id
			]);
			run(
				'INSERT INTO elo_history (player_id, elo, delta, match_id) VALUES (?, ?, ?, ?)',
				[winner.id, result.newWinnerElo, winDelta, matchId]
			);
			run(
				'INSERT INTO elo_history (player_id, elo, delta, match_id) VALUES (?, ?, ?, ?)',
				[loser.id, result.newLoserElo, loseDelta, matchId]
			);

			eloDeltas = [
				{ name: winner.name, delta: winDelta },
				{ name: loser.name, delta: loseDelta }
			];
		} else {
			run('UPDATE players SET games_played = games_played + 1 WHERE id = ?', [p1.id]);
			run('UPDATE players SET games_played = games_played + 1 WHERE id = ?', [p2.id]);
			eloDeltas = [
				{ name: p1.name, delta: 0 },
				{ name: p2.name, delta: 0 }
			];
		}
	}

	function record2v2() {
		const t1p1 = getPlayer(t1p1Id)!;
		const t1p2 = getPlayer(t1p2Id)!;
		const t2p1 = getPlayer(t2p1Id)!;
		const t2p2 = getPlayer(t2p2Id)!;
		const isDraw = score1 === score2;

		run(
			'INSERT INTO matches (type, team1_p1_id, team1_p2_id, team2_p1_id, team2_p2_id, score1, score2) VALUES (?, ?, ?, ?, ?, ?, ?)',
			['2v2', t1p1.id, t1p2.id, t2p1.id, t2p2.id, score1, score2]
		);
		const matchId = getLastInsertId();

		const allTeamPlayers = [t1p1, t1p2, t2p1, t2p2];

		if (!isDraw) {
			const team1Won = score1 > score2;
			const result = updateElo2v2(
				[
					{ id: t1p1.id, elo: t1p1.elo, games: t1p1.games_played },
					{ id: t1p2.id, elo: t1p2.elo, games: t1p2.games_played }
				],
				[
					{ id: t2p1.id, elo: t2p1.elo, games: t2p1.games_played },
					{ id: t2p2.id, elo: t2p2.elo, games: t2p2.games_played }
				],
				team1Won
			);

			const originalElos: Record<number, number> = {
				[t1p1.id]: t1p1.elo,
				[t1p2.id]: t1p2.elo,
				[t2p1.id]: t2p1.elo,
				[t2p2.id]: t2p2.elo
			};
			const allResults = [...result.team1Results, ...result.team2Results];

			for (const r of allResults) {
				const delta = r.newElo - originalElos[r.id];
				run('UPDATE players SET elo = ?, games_played = games_played + 1 WHERE id = ?', [
					r.newElo,
					r.id
				]);
				run(
					'INSERT INTO elo_history (player_id, elo, delta, match_id) VALUES (?, ?, ?, ?)',
					[r.id, r.newElo, delta, matchId]
				);
			}

			eloDeltas = allTeamPlayers.map((p) => {
				const r = allResults.find((r) => r.id === p.id)!;
				return { name: p.name, delta: r.newElo - originalElos[p.id] };
			});
		} else {
			for (const p of allTeamPlayers) {
				run('UPDATE players SET games_played = games_played + 1 WHERE id = ?', [p.id]);
			}
			eloDeltas = allTeamPlayers.map((p) => ({ name: p.name, delta: 0 }));
		}
	}

	function recordMatch() {
		submitting = true;
		error = '';
		try {
			if (matchType === '1v1') record1v1();
			else record2v2();
			loadPlayers();
			step = 'done';
		} catch (err) {
			error = (err as Error).message;
		} finally {
			submitting = false;
		}
	}
</script>

<div class="max-w-lg mx-auto px-4 py-8">
	<!-- Back link -->
	{#if step !== 'done'}
		<div class="mb-6">
			{#if step === 'type'}
				<a href="/" class="text-sm text-gray-500 hover:text-gray-700">← Back</a>
			{:else if step === 'players'}
				<button
					onclick={() => (step = 'type')}
					class="text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
				>
					← Change type
				</button>
			{:else if step === 'scores'}
				<button
					onclick={() => (step = 'players')}
					class="text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
				>
					← Change players
				</button>
			{:else if step === 'confirm'}
				<button
					onclick={() => (step = 'scores')}
					class="text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
				>
					← Change scores
				</button>
			{/if}
		</div>
	{/if}

	<!-- Step indicator -->
	{#if step !== 'done'}
		<div class="flex items-center gap-2 mb-6">
			{#each ['type', 'players', 'scores', 'confirm'] as s, i}
				<div
					class="h-2 rounded-full flex-1 transition-colors {step === s
						? 'bg-blue-600'
						: ['type', 'players', 'scores', 'confirm'].indexOf(step) > i
							? 'bg-blue-300'
							: 'bg-gray-200'}"
				></div>
			{/each}
		</div>
	{/if}

	<!-- STEP 1: Choose match type -->
	{#if step === 'type'}
		<h1 class="text-2xl font-bold text-gray-900 mb-2">New Match</h1>
		<p class="text-gray-500 mb-6">Choose a match format</p>

		<div class="grid grid-cols-2 gap-4">
			<button
				onclick={() => selectType('1v1')}
				class="flex flex-col items-center justify-center gap-2 p-8 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all group cursor-pointer"
			>
				<span class="text-4xl">🥅</span>
				<span class="text-xl font-bold text-gray-800 group-hover:text-blue-700">1v1</span>
				<span class="text-sm text-gray-500">Head to head</span>
			</button>
			<button
				onclick={() => selectType('2v2')}
				class="flex flex-col items-center justify-center gap-2 p-8 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all group cursor-pointer"
			>
				<span class="text-4xl">⚽</span>
				<span class="text-xl font-bold text-gray-800 group-hover:text-blue-700">2v2</span>
				<span class="text-sm text-gray-500">Team match</span>
			</button>
		</div>
	{/if}

	<!-- STEP 2: Select players -->
	{#if step === 'players'}
		{#if !ready}
			<p class="text-gray-500">Loading players…</p>
		{:else if players.length < (matchType === '1v1' ? 2 : 4)}
			<div class="text-center py-8">
				<p class="text-gray-500 mb-4">
					You need at least {matchType === '1v1' ? '2' : '4'} players to record a match.
				</p>
				<a
					href="/players/new"
					class="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
				>
					Add Players
				</a>
			</div>
		{:else}
			<h1 class="text-2xl font-bold text-gray-900 mb-1">
				Select Players
				<span class="text-sm font-normal text-gray-400 ml-2">{matchType}</span>
			</h1>
			<p class="text-gray-500 mb-6">Auto-suggested by ELO — override as needed</p>

			{#if matchType === '1v1'}
				<div class="space-y-4">
					<!-- Player 1 -->
					<div class="bg-white border border-gray-200 rounded-xl p-4">
						<label
							for="p1-select"
							class="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2"
							>Player 1</label
						>
						<select
							id="p1-select"
							bind:value={p1Id}
							onchange={() => {
								const suggested = suggestOpponent1v1(p1Id!, players);
								if (suggested && suggested.id !== p2Id) p2Id = suggested.id;
							}}
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							{#each players as p}
								<option value={p.id}>{p.name} — {p.elo} ELO</option>
							{/each}
						</select>
					</div>

					<!-- Win probability -->
					{#if winProb != null}
						<div class="text-center text-sm text-gray-500">
							<span
								class="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-1"
							>
								<span class="font-semibold text-blue-700">{winProb}%</span> win chance for
								{getPlayer(p1Id)?.name}
								vs
								<span class="font-semibold text-blue-700">{100 - winProb}%</span> for
								{getPlayer(p2Id)?.name}
							</span>
						</div>
					{/if}

					<!-- Player 2 -->
					<div class="bg-white border border-gray-200 rounded-xl p-4">
						<label
							for="p2-select"
							class="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2"
							>Player 2</label
						>
						<select
							id="p2-select"
							bind:value={p2Id}
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							{#each players as p}
								<option value={p.id}>{p.name} — {p.elo} ELO</option>
							{/each}
						</select>
					</div>
				</div>
			{:else}
				<!-- 2v2 team selection -->
				<div class="space-y-4">
					<div class="grid grid-cols-2 gap-4">
						<!-- Team 1 -->
						<div class="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
							<div class="text-xs font-semibold text-blue-600 uppercase tracking-wide">Team 1</div>
							<select
								bind:value={t1p1Id}
								class="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
							>
								<option value={null}>— select —</option>
								{#each players as p}
									<option value={p.id}>{p.name} ({p.elo})</option>
								{/each}
							</select>
							<select
								bind:value={t1p2Id}
								class="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
							>
								<option value={null}>— select —</option>
								{#each players as p}
									<option value={p.id}>{p.name} ({p.elo})</option>
								{/each}
							</select>
							{#if t1p1Id && t1p2Id}
								<div class="text-xs text-blue-700 font-medium text-center">
									Avg ELO: {Math.round(
										((getPlayer(t1p1Id)?.elo ?? 1000) + (getPlayer(t1p2Id)?.elo ?? 1000)) / 2
									)}
								</div>
							{/if}
						</div>

						<!-- Team 2 -->
						<div class="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
							<div class="text-xs font-semibold text-red-600 uppercase tracking-wide">Team 2</div>
							<select
								bind:value={t2p1Id}
								class="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
							>
								<option value={null}>— select —</option>
								{#each players as p}
									<option value={p.id}>{p.name} ({p.elo})</option>
								{/each}
							</select>
							<select
								bind:value={t2p2Id}
								class="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
							>
								<option value={null}>— select —</option>
								{#each players as p}
									<option value={p.id}>{p.name} ({p.elo})</option>
								{/each}
							</select>
							{#if t2p1Id && t2p2Id}
								<div class="text-xs text-red-700 font-medium text-center">
									Avg ELO: {Math.round(
										((getPlayer(t2p1Id)?.elo ?? 1000) + (getPlayer(t2p2Id)?.elo ?? 1000)) / 2
									)}
								</div>
							{/if}
						</div>
					</div>

					<!-- Win probability for 2v2 -->
					{#if teamStats}
						<div class="text-center text-sm text-gray-500">
							<span
								class="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-1"
							>
								<span class="font-semibold text-blue-700">{teamStats.prob1}%</span> for Team 1 ·
								<span class="font-semibold text-red-700">{100 - teamStats.prob1}%</span> for Team 2
							</span>
						</div>
					{/if}

					<button
						onclick={rebalance2v2}
						class="w-full py-2 px-4 border border-blue-300 text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium cursor-pointer"
					>
						⚖️ Auto-balance teams
					</button>
				</div>
			{/if}

			{#if error}
				<p class="mt-4 text-red-600 text-sm">{error}</p>
			{/if}

			<button
				onclick={goToScores}
				class="mt-6 w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
			>
				Next: Enter Score →
			</button>
		{/if}
	{/if}

	<!-- STEP 3: Enter scores -->
	{#if step === 'scores'}
		<h1 class="text-2xl font-bold text-gray-900 mb-1">Enter Score</h1>
		<p class="text-gray-500 mb-6">What was the final score?</p>

		<div class="bg-white border border-gray-200 rounded-xl p-6">
			<div class="flex items-center gap-4">
				<!-- Team 1 / Player 1 label -->
				<div class="flex-1 text-center">
					{#if matchType === '1v1'}
						<div class="font-semibold text-gray-800">{getPlayer(p1Id)?.name}</div>
						<div class="text-xs text-gray-400">{getPlayer(p1Id)?.elo} ELO</div>
					{:else}
						<div class="font-semibold text-blue-700">Team 1</div>
						<div class="text-xs text-gray-500">
							{getPlayer(t1p1Id)?.name} & {getPlayer(t1p2Id)?.name}
						</div>
					{/if}
				</div>

				<!-- Score inputs -->
				<div class="flex items-center gap-3">
					<input
						type="number"
						bind:value={score1}
						min="0"
						class="w-16 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg py-2 focus:outline-none focus:border-blue-500"
					/>
					<span class="text-2xl font-bold text-gray-300">:</span>
					<input
						type="number"
						bind:value={score2}
						min="0"
						class="w-16 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg py-2 focus:outline-none focus:border-blue-500"
					/>
				</div>

				<!-- Team 2 / Player 2 label -->
				<div class="flex-1 text-center">
					{#if matchType === '1v1'}
						<div class="font-semibold text-gray-800">{getPlayer(p2Id)?.name}</div>
						<div class="text-xs text-gray-400">{getPlayer(p2Id)?.elo} ELO</div>
					{:else}
						<div class="font-semibold text-red-700">Team 2</div>
						<div class="text-xs text-gray-500">
							{getPlayer(t2p1Id)?.name} & {getPlayer(t2p2Id)?.name}
						</div>
					{/if}
				</div>
			</div>

			{#if score1 === score2}
				<p class="mt-4 text-center text-sm text-amber-600 bg-amber-50 rounded-lg py-2">
					⚠️ Draw — ELO ratings will not change
				</p>
			{/if}
		</div>

		<button
			onclick={goToConfirm}
			class="mt-6 w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
		>
			Review & Confirm →
		</button>
	{/if}

	<!-- STEP 4: Confirm -->
	{#if step === 'confirm'}
		<h1 class="text-2xl font-bold text-gray-900 mb-1">Confirm Match</h1>
		<p class="text-gray-500 mb-6">Review the details before saving</p>

		<div class="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
			<div class="flex items-center justify-between">
				<span class="text-sm text-gray-500">Format</span>
				<span
					class="font-semibold px-2 py-0.5 rounded text-sm {matchType === '1v1'
						? 'bg-blue-100 text-blue-700'
						: 'bg-purple-100 text-purple-700'}">{matchType}</span
				>
			</div>

			{#if matchType === '1v1'}
				<div class="flex items-center justify-between">
					<span class="font-medium text-gray-800">{getPlayer(p1Id)?.name}</span>
					<span class="text-2xl font-bold text-gray-700"
						>{score1} : {score2}</span
					>
					<span class="font-medium text-gray-800">{getPlayer(p2Id)?.name}</span>
				</div>
				{#if winProb != null}
					<div class="text-xs text-center text-gray-400">
						Pre-match: {winProb}% / {100 - winProb}% win probability
					</div>
				{/if}
			{:else}
				<div class="grid grid-cols-3 items-center gap-2">
					<div class="text-left">
						<div class="font-medium text-blue-700">{getPlayer(t1p1Id)?.name}</div>
						<div class="font-medium text-blue-700">{getPlayer(t1p2Id)?.name}</div>
					</div>
					<div class="text-2xl font-bold text-center text-gray-700">{score1} : {score2}</div>
					<div class="text-right">
						<div class="font-medium text-red-700">{getPlayer(t2p1Id)?.name}</div>
						<div class="font-medium text-red-700">{getPlayer(t2p2Id)?.name}</div>
					</div>
				</div>
				{#if teamStats}
					<div class="text-xs text-center text-gray-400">
						Pre-match: {teamStats.prob1}% / {100 - teamStats.prob1}% win probability
					</div>
				{/if}
			{/if}

			{#if score1 === score2}
				<p class="text-sm text-center text-amber-600">Draw — ELO unchanged</p>
			{:else}
				<p class="text-sm text-center text-green-600">
					ELO ratings will be updated after confirmation
				</p>
			{/if}
		</div>

		{#if error}
			<p class="mt-4 text-red-600 text-sm">{error}</p>
		{/if}

		<button
			onclick={recordMatch}
			disabled={submitting}
			class="mt-6 w-full py-3 px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors cursor-pointer"
		>
			{submitting ? 'Saving…' : '✅ Record Match'}
		</button>
	{/if}

	<!-- STEP 5: Done -->
	{#if step === 'done'}
		<div class="text-center py-4">
			<div class="text-5xl mb-4">🏆</div>
			<h1 class="text-2xl font-bold text-gray-900 mb-2">Match Recorded!</h1>
			<p class="text-gray-500 mb-6">ELO ratings have been updated</p>

			<!-- ELO delta cards -->
			<div class="grid grid-cols-2 gap-3 mb-8 text-left">
				{#each eloDeltas as { name, delta }}
					<div
						class="bg-white border rounded-xl p-4 {delta > 0
							? 'border-green-200'
							: delta < 0
								? 'border-red-200'
								: 'border-gray-200'}"
					>
						<div class="font-semibold text-gray-800 text-sm mb-1">{name}</div>
						<div
							class="text-xl font-bold {delta > 0
								? 'text-green-600'
								: delta < 0
									? 'text-red-600'
									: 'text-gray-400'}"
						>
							{delta > 0 ? '+' : ''}{delta === 0 ? '±0' : delta}
						</div>
						<div class="text-xs text-gray-400">ELO</div>
					</div>
				{/each}
			</div>

			<div class="flex gap-3">
				<button
					onclick={() => {
						step = 'type';
						p1Id = null;
						p2Id = null;
						t1p1Id = null;
						t1p2Id = null;
						t2p1Id = null;
						t2p2Id = null;
						score1 = 0;
						score2 = 0;
						eloDeltas = [];
					}}
					class="flex-1 py-2 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
				>
					New Match
				</button>
				<a
					href="/players"
					class="flex-1 py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-center"
				>
					View Leaderboard
				</a>
			</div>
		</div>
	{/if}
</div>
