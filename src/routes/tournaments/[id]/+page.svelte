<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { whenReady } from '$lib/db';
	import {
		getTournament,
		getParticipants,
		registerParticipant,
		removeParticipant,
		startTournament,
		getGroupStandings,
		getGroupMatches,
		generateKnockoutBracket,
		recordTournamentMatch,
		getTournamentBracket,
		loadTournaments,
		type Tournament,
		type TournamentParticipant,
		type GroupStandingsRow,
		type BracketMatch
	} from '$lib/stores/tournaments.svelte';
	import { getAllPlayers, loadPlayers, type Player } from '$lib/stores/players.svelte';

	const id = $derived(Number($page.params.id));

	let tournament = $state<Tournament | undefined>(undefined);
	let participants = $state<TournamentParticipant[]>([]);
	let allPlayers = $state<Player[]>([]);
	let standings = $state<GroupStandingsRow[]>([]);
	let groupMatches = $state<BracketMatch[]>([]);
	let bracketMatches = $state<BracketMatch[]>([]);

	// Registration: add participant form
	let addPlayer1Id = $state('');
	let addPlayer2Id = $state('');
	let addError = $state('');

	// Score inputs: map from matchId → { score1, score2 }
	let scoreInputs = $state<Record<number, { s1: string; s2: string }>>({});
	let recordError = $state<Record<number, string>>({});

	let startError = $state('');
	let advanceError = $state('');

	function initScoreInputs(matches: BracketMatch[]) {
		const updated = { ...scoreInputs };
		for (const m of matches) {
			if (!updated[m.id]) {
				updated[m.id] = { s1: '0', s2: '0' };
			}
		}
		scoreInputs = updated;
	}

	function refresh() {
		tournament = getTournament(id);
		if (!tournament) return;
		participants = getParticipants(id);
		allPlayers = getAllPlayers();
		if (tournament.status === 'group_stage') {
			standings = getGroupStandings(id);
			groupMatches = getGroupMatches(id);
			initScoreInputs(groupMatches);
		}
		if (tournament.status === 'knockout' || tournament.status === 'complete') {
			bracketMatches = getTournamentBracket(id);
			initScoreInputs(bracketMatches);
		}
	}

	onMount(async () => {
		await whenReady();
		loadTournaments();
		loadPlayers();
		refresh();
	});

	$effect(() => {
		// Re-read tournament when id changes
		void id;
		refresh();
	});

	// Players not yet registered as participants (for 1v1)
	const registeredPlayerIds = $derived(
		new Set(participants.flatMap((p) => [p.player1_id, p.player2_id].filter((x) => x !== null) as number[]))
	);

	const availablePlayers = $derived(
		allPlayers.filter((p) => !registeredPlayerIds.has(p.id))
	);

	function handleAddParticipant() {
		addError = '';
		const p1 = Number(addPlayer1Id);
		if (!p1) {
			addError = 'Please select a player.';
			return;
		}
		if (tournament?.type === '2v2') {
			const p2 = Number(addPlayer2Id);
			if (!p2) {
				addError = 'Please select both players for the team.';
				return;
			}
			if (p1 === p2) {
				addError = 'Both players must be different.';
				return;
			}
			try {
				registerParticipant(id, p1, p2);
				addPlayer1Id = '';
				addPlayer2Id = '';
				refresh();
			} catch (err) {
				addError = (err as Error).message;
			}
		} else {
			try {
				registerParticipant(id, p1);
				addPlayer1Id = '';
				refresh();
			} catch (err) {
				addError = (err as Error).message;
			}
		}
	}

	function handleRemoveParticipant(participantId: number) {
		try {
			removeParticipant(id, participantId);
			refresh();
		} catch (err) {
			addError = (err as Error).message;
		}
	}

	function handleStartTournament() {
		startError = '';
		try {
			startTournament(id);
			refresh();
		} catch (err) {
			startError = (err as Error).message;
		}
	}

	const canStart = $derived(
		tournament?.type === '2v2' ? participants.length >= 2 : participants.length >= 2
	);

	function getScoreInput(matchId: number): { s1: string; s2: string } {
		if (!scoreInputs[matchId]) {
			scoreInputs = { ...scoreInputs, [matchId]: { s1: '0', s2: '0' } };
		}
		return scoreInputs[matchId];
	}

	function handleRecordMatch(matchId: number) {
		recordError = { ...recordError, [matchId]: '' };
		const inp = scoreInputs[matchId] ?? { s1: '0', s2: '0' };
		const s1 = parseInt(inp.s1, 10);
		const s2 = parseInt(inp.s2, 10);
		if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
			recordError = { ...recordError, [matchId]: 'Scores must be non-negative numbers.' };
			return;
		}
		try {
			recordTournamentMatch(matchId, s1, s2);
			refresh();
		} catch (err) {
			recordError = { ...recordError, [matchId]: (err as Error).message };
		}
	}

	const allGroupMatchesPlayed = $derived(
		groupMatches.length > 0 && groupMatches.every((m) => m.score1 >= 0 && m.score2 >= 0)
	);

	function handleAdvanceToKnockout() {
		advanceError = '';
		const n = participants.length;
		const topN = n <= 3 ? 2 : n <= 7 ? 4 : 8;
		try {
			generateKnockoutBracket(id, topN);
			refresh();
		} catch (err) {
			advanceError = (err as Error).message;
		}
	}

	// Bracket helpers
	function bracketTeam1Label(m: BracketMatch): string {
		if (tournament?.type === '1v1') return m.p1_name ?? 'TBD';
		return [m.t1p1_name, m.t1p2_name].filter(Boolean).join(' & ') || 'TBD';
	}

	function bracketTeam2Label(m: BracketMatch): string {
		if (tournament?.type === '1v1') return m.p2_name ?? 'TBD';
		return [m.t2p1_name, m.t2p2_name].filter(Boolean).join(' & ') || 'TBD';
	}

	function isMatchPlayed(m: BracketMatch): boolean {
		return m.score1 >= 0 && m.score2 >= 0;
	}

	function isMatchPlayable(m: BracketMatch): boolean {
		if (isMatchPlayed(m)) return false;
		if (tournament?.type === '1v1') return m.player1_id !== null && m.player2_id !== null;
		return m.team1_p1_id !== null && m.team2_p1_id !== null;
	}

	// Group bracket matches by round in display order
	const bracketByRound = $derived(() => {
		const order = ['QF1', 'QF2', 'QF3', 'QF4', 'SF1', 'SF2', 'F'];
		const map = new Map<string, BracketMatch[]>();
		for (const m of bracketMatches) {
			const r = m.tournament_round;
			if (!map.has(r)) map.set(r, []);
			map.get(r)!.push(m);
		}
		// Build ordered result with display names
		const roundLabels: Record<string, string> = {
			QF1: 'Quarter-Final 1', QF2: 'Quarter-Final 2',
			QF3: 'Quarter-Final 3', QF4: 'Quarter-Final 4',
			SF1: 'Semi-Final 1', SF2: 'Semi-Final 2',
			F: 'Final'
		};
		const result: Array<{ key: string; label: string; matches: BracketMatch[] }> = [];
		for (const key of order) {
			if (map.has(key)) {
				result.push({ key, label: roundLabels[key] ?? key, matches: map.get(key)! });
			}
		}
		return result;
	});

	// Winner label for complete phase
	const winnerLabel = $derived(() => {
		if (!tournament || tournament.status !== 'complete' || tournament.winner_id === null) return null;
		const wp = participants.find((p) => p.player1_id === tournament!.winner_id);
		if (!wp) return null;
		if (tournament.type === '2v2' && wp.player2_id !== null) {
			return `${wp.p1_name} & ${wp.p2_name}`;
		}
		return wp.p1_name ?? `Player ${tournament.winner_id}`;
	});

	function statusBadgeClass(status: Tournament['status']): string {
		switch (status) {
			case 'registration': return 'bg-blue-100 text-blue-700';
			case 'group_stage': return 'bg-yellow-100 text-yellow-700';
			case 'knockout': return 'bg-orange-100 text-orange-700';
			case 'complete': return 'bg-green-100 text-green-700';
		}
	}

	function statusLabel(status: Tournament['status']): string {
		switch (status) {
			case 'registration': return 'Registration';
			case 'group_stage': return 'Group Stage';
			case 'knockout': return 'Knockout';
			case 'complete': return 'Complete';
		}
	}

	function rankMedal(rank: number): string {
		if (rank === 1) return '🥇';
		if (rank === 2) return '🥈';
		if (rank === 3) return '🥉';
		return String(rank);
	}

	function groupMatchTeam1(m: BracketMatch): string {
		if (tournament?.type === '1v1') return m.p1_name ?? '?';
		return [m.t1p1_name, m.t1p2_name].filter(Boolean).join(' & ') || '?';
	}

	function groupMatchTeam2(m: BracketMatch): string {
		if (tournament?.type === '1v1') return m.p2_name ?? '?';
		return [m.t2p1_name, m.t2p2_name].filter(Boolean).join(' & ') || '?';
	}
</script>

<div class="max-w-4xl mx-auto px-4 py-8 space-y-8">
	<a href="/tournaments" class="text-sm text-gray-500 hover:text-gray-700">← Back to Tournaments</a>

	{#if !tournament}
		<div class="text-center py-20 text-gray-400">
			<p class="text-lg">Tournament not found.</p>
		</div>
	{:else}
		<!-- Header -->
		<div class="flex items-center gap-3 flex-wrap">
			<h1 class="text-3xl font-bold text-gray-900">{tournament.name}</h1>
			<span class="px-2 py-0.5 rounded-full text-xs font-medium {statusBadgeClass(tournament.status)}">
				{statusLabel(tournament.status)}
			</span>
			<span class="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
				{tournament.type}
			</span>
		</div>

		<!-- ══ REGISTRATION PHASE ══ -->
		{#if tournament.status === 'registration'}
			<div>
				<h2 class="text-xl font-semibold text-gray-900 mb-3">Participants</h2>
				<div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
					{#if participants.length === 0}
						<div class="p-6 text-center text-gray-400 text-sm">No participants yet.</div>
					{:else}
						<ul class="divide-y divide-gray-100">
							{#each participants as p}
								<li class="flex items-center justify-between px-5 py-3">
									<span class="font-medium text-gray-900">
										{#if tournament.type === '2v2' && p.player2_id !== null}
											{p.p1_name} & {p.p2_name}
										{:else}
											{p.p1_name}
										{/if}
									</span>
									<button
										onclick={() => handleRemoveParticipant(p.id)}
										class="text-xs text-red-500 hover:text-red-700 hover:underline"
									>Remove</button>
								</li>
							{/each}
						</ul>
					{/if}

					<!-- Add participant -->
					<div class="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-3">
						{#if tournament.type === '1v1'}
							<div class="flex items-center gap-3">
								<select
									bind:value={addPlayer1Id}
									class="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="">— Select player —</option>
									{#each availablePlayers as p}
										<option value={p.id}>{p.name} ({p.elo})</option>
									{/each}
								</select>
								<button
									onclick={handleAddParticipant}
									disabled={!addPlayer1Id}
									class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
								>Add</button>
							</div>
						{:else}
							<div class="grid grid-cols-2 gap-2">
								<select
									bind:value={addPlayer1Id}
									class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="">— Player 1 —</option>
									{#each allPlayers as p}
										<option value={p.id}>{p.name} ({p.elo})</option>
									{/each}
								</select>
								<select
									bind:value={addPlayer2Id}
									class="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="">— Player 2 —</option>
									{#each allPlayers as p}
										<option value={p.id}>{p.name} ({p.elo})</option>
									{/each}
								</select>
							</div>
							<button
								onclick={handleAddParticipant}
								disabled={!addPlayer1Id || !addPlayer2Id}
								class="w-full px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
							>Add Team</button>
						{/if}
						{#if addError}
							<p class="text-red-600 text-sm">{addError}</p>
						{/if}
					</div>
				</div>
			</div>

			<!-- Start Tournament -->
			<div class="flex items-center gap-4">
				<button
					onclick={handleStartTournament}
					disabled={!canStart}
					class="px-5 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors"
				>
					Start Tournament
				</button>
				{#if !canStart}
					<p class="text-sm text-gray-500">Need at least 2 participants to start.</p>
				{/if}
				{#if startError}
					<p class="text-sm text-red-600">{startError}</p>
				{/if}
			</div>

		<!-- ══ GROUP STAGE PHASE ══ -->
		{:else if tournament.status === 'group_stage'}
			<!-- Standings -->
			<div>
				<h2 class="text-xl font-semibold text-gray-900 mb-3">Group Standings</h2>
				{#if standings.length === 0}
					<div class="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
						No standings yet.
					</div>
				{:else}
					<div class="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
						<table class="w-full text-sm">
							<thead class="bg-gray-50 text-gray-500 uppercase text-xs tracking-wider">
								<tr>
									<th class="px-4 py-3 text-left w-10">#</th>
									<th class="px-4 py-3 text-left">Team / Player</th>
									<th class="px-4 py-3 text-right">P</th>
									<th class="px-4 py-3 text-right">W</th>
									<th class="px-4 py-3 text-right">D</th>
									<th class="px-4 py-3 text-right">L</th>
									<th class="px-4 py-3 text-right">Pts</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100 bg-white">
								{#each standings as row}
									<tr class="hover:bg-gray-50 transition-colors">
										<td class="px-4 py-3 text-center">{rankMedal(row.rank)}</td>
										<td class="px-4 py-3 font-medium text-gray-900">{row.label}</td>
										<td class="px-4 py-3 text-right text-gray-600">{row.played}</td>
										<td class="px-4 py-3 text-right text-green-600 font-medium">{row.won}</td>
										<td class="px-4 py-3 text-right text-gray-500">{row.drawn}</td>
										<td class="px-4 py-3 text-right text-red-500">{row.lost}</td>
										<td class="px-4 py-3 text-right font-bold text-gray-900">{row.points}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>

			<!-- Match Schedule -->
			<div>
				<h2 class="text-xl font-semibold text-gray-900 mb-3">Group Matches</h2>
				<div class="space-y-2">
					{#each groupMatches as match}
						<div class="bg-white border border-gray-200 rounded-xl px-5 py-4 shadow-sm">
							<div class="flex items-center justify-between gap-4 flex-wrap">
								<div class="flex items-center gap-2 font-medium text-gray-900">
									<span>{groupMatchTeam1(match)}</span>
									<span class="text-gray-400">vs</span>
									<span>{groupMatchTeam2(match)}</span>
								</div>
								{#if isMatchPlayed(match)}
									<span class="text-lg font-bold text-gray-800">{match.score1} – {match.score2}</span>
								{:else if scoreInputs[match.id]}
									<div class="flex items-center gap-2">
										<input
											type="number"
											min="0"
											bind:value={scoreInputs[match.id].s1}
											class="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
										/>
										<span class="text-gray-400">–</span>
										<input
											type="number"
											min="0"
											bind:value={scoreInputs[match.id].s2}
											class="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
										/>
										<button
											onclick={() => handleRecordMatch(match.id)}
											class="px-3 py-1 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors"
										>Record</button>
									</div>
								{/if}
							</div>
							{#if recordError[match.id]}
								<p class="text-red-600 text-xs mt-1">{recordError[match.id]}</p>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<!-- Advance to Knockout -->
			{#if allGroupMatchesPlayed}
				<div class="flex items-center gap-4">
					<button
						onclick={handleAdvanceToKnockout}
						class="px-5 py-2.5 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition-colors"
					>
						Advance to Knockout
					</button>
					{#if advanceError}
						<p class="text-sm text-red-600">{advanceError}</p>
					{/if}
				</div>
			{/if}

		<!-- ══ KNOCKOUT PHASE ══ -->
		{:else if tournament.status === 'knockout' || tournament.status === 'complete'}
			<!-- Winner Banner -->
			{#if tournament.status === 'complete' && winnerLabel()}
				<div class="bg-gradient-to-r from-yellow-400 to-orange-400 rounded-2xl p-8 text-center text-white shadow-lg">
					<div class="text-5xl mb-3">🏆</div>
					<p class="text-sm font-medium uppercase tracking-wider opacity-90 mb-1">Tournament Winner</p>
					<p class="text-3xl font-bold">{winnerLabel()}</p>
				</div>
			{/if}

			<!-- Bracket -->
			<div>
				<h2 class="text-xl font-semibold text-gray-900 mb-4">
					{tournament.status === 'complete' ? 'Final Bracket' : 'Knockout Bracket'}
				</h2>

				{#if bracketMatches.length === 0}
					<div class="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
						No bracket matches found.
					</div>
				{:else}
					<div class="space-y-6">
						{#each bracketByRound() as { label, matches }}
							<div>
								<h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</h3>
								<div class="space-y-2">
									{#each matches as match}
										<div class="bg-white border border-gray-200 rounded-xl px-5 py-4 shadow-sm">
											<div class="flex items-center justify-between gap-4 flex-wrap">
												<div class="flex items-center gap-2 font-medium text-gray-900">
													<span class="{bracketTeam1Label(match) === 'TBD' ? 'text-gray-400 italic' : ''}">{bracketTeam1Label(match)}</span>
													<span class="text-gray-400">vs</span>
													<span class="{bracketTeam2Label(match) === 'TBD' ? 'text-gray-400 italic' : ''}">{bracketTeam2Label(match)}</span>
												</div>
												{#if isMatchPlayed(match)}
													<div class="flex items-center gap-2">
														<span class="text-lg font-bold text-gray-800">{match.score1} – {match.score2}</span>
													</div>
												{:else if isMatchPlayable(match) && scoreInputs[match.id]}
													<div class="flex items-center gap-2">
														<input
															type="number"
															min="0"
															bind:value={scoreInputs[match.id].s1}
															class="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
														/>
														<span class="text-gray-400">–</span>
														<input
															type="number"
															min="0"
															bind:value={scoreInputs[match.id].s2}
															class="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
														/>
														<button
															onclick={() => handleRecordMatch(match.id)}
															class="px-3 py-1 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors"
														>Record</button>
													</div>
												{:else}
													<span class="text-sm text-gray-400 italic">Awaiting previous results</span>
												{/if}
											</div>
											{#if recordError[match.id]}
												<p class="text-red-600 text-xs mt-1">{recordError[match.id]}</p>
											{/if}
										</div>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>
