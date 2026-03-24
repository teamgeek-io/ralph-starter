<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { whenReady } from '$lib/db';
	import {
		getLeague,
		updateLeague,
		deleteLeague,
		getLeaguePlayers,
		getLeagueStandings,
		addPlayerToLeague,
		removePlayerFromLeague,
		type League,
		type LeaguePlayer,
		type LeagueStandingsRow
	} from '$lib/stores/leagues.svelte';
	import { getAllPlayers, loadPlayers, getRecentMatches, type RecentMatchRow } from '$lib/stores/players.svelte';
	import { query } from '$lib/db';

	const id = $derived(Number($page.params.id));

	let league = $state<League | undefined>(undefined);
	let standings = $state<LeagueStandingsRow[]>([]);
	let members = $state<LeaguePlayer[]>([]);
	let allPlayers = $state(getAllPlayers());
	let recentMatches = $state<RecentMatchRow[]>([]);

	let addPlayerId = $state('');
	let editMode = $state(false);
	let editName = $state('');
	let editSeason = $state('');
	let editActive = $state(true);
	let editError = $state('');
	let confirmDelete = $state(false);

	function refresh() {
		league = getLeague(id);
		standings = getLeagueStandings(id);
		members = getLeaguePlayers(id);
		allPlayers = getAllPlayers();
		// League-scoped recent matches
		recentMatches = query<RecentMatchRow>(
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
			 WHERE m.league_id = ?
			 ORDER BY m.played_at DESC LIMIT 20`,
			[id]
		);
	}

	onMount(async () => {
		await whenReady();
		loadPlayers();
		refresh();
	});

	function startEdit() {
		if (!league) return;
		editName = league.name;
		editSeason = league.season ?? '';
		editActive = Boolean(league.active);
		editError = '';
		editMode = true;
	}

	function saveEdit() {
		editError = '';
		if (!editName.trim()) {
			editError = 'League name is required.';
			return;
		}
		try {
			updateLeague(id, editName.trim(), editSeason.trim() || undefined, editActive ? 1 : 0);
			editMode = false;
			refresh();
		} catch (err) {
			editError = (err as Error).message;
		}
	}

	function handleDelete() {
		deleteLeague(id);
		goto('/leagues');
	}

	function handleAddPlayer() {
		const pid = Number(addPlayerId);
		if (!pid) return;
		addPlayerToLeague(id, pid);
		addPlayerId = '';
		refresh();
	}

	function handleRemovePlayer(playerId: number) {
		removePlayerFromLeague(id, playerId);
		refresh();
	}

	const nonMembers = $derived(
		allPlayers.filter((p) => !members.some((m) => m.player_id === p.id))
	);

	function eloBadge(elo: number): string {
		if (elo >= 1150) return 'bg-yellow-100 text-yellow-800';
		if (elo >= 1050) return 'bg-green-100 text-green-800';
		if (elo >= 950) return 'bg-blue-100 text-blue-800';
		return 'bg-gray-100 text-gray-500';
	}

	function rankMedal(rank: number): string {
		if (rank === 1) return '🥇';
		if (rank === 2) return '🥈';
		if (rank === 3) return '🥉';
		return String(rank);
	}

	function matchLabel(m: RecentMatchRow): string {
		if (m.type === '1v1') {
			return `${m.p1_name ?? '?'} vs ${m.p2_name ?? '?'}`;
		}
		const t1 = [m.t1p1_name, m.t1p2_name].filter(Boolean).join(' & ');
		const t2 = [m.t2p1_name, m.t2p2_name].filter(Boolean).join(' & ');
		return `${t1} vs ${t2}`;
	}

	function relativeTime(dateStr: string): string {
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return `${mins}m ago`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs}h ago`;
		return `${Math.floor(hrs / 24)}d ago`;
	}
</script>

<div class="max-w-4xl mx-auto px-4 py-8 space-y-8">
	<!-- Back -->
	<a href="/leagues" class="text-sm text-gray-500 hover:text-gray-700">← Back to Leagues</a>

	{#if !league}
		<div class="text-center py-20 text-gray-400">
			<p class="text-lg">League not found.</p>
		</div>
	{:else}
		<!-- Header -->
		<div class="flex items-start justify-between gap-4">
			{#if editMode}
				<div class="flex-1 bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
					<input
						type="text"
						bind:value={editName}
						placeholder="League name"
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
					<input
						type="text"
						bind:value={editSeason}
						placeholder="Season (optional)"
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
					<label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
						<input type="checkbox" bind:checked={editActive} class="rounded" />
						Active league
					</label>
					{#if editError}
						<p class="text-red-600 text-sm">{editError}</p>
					{/if}
					<div class="flex gap-2">
						<button
							onclick={saveEdit}
							class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
						>Save</button>
						<button
							onclick={() => (editMode = false)}
							class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
						>Cancel</button>
					</div>
				</div>
			{:else}
				<div>
					<div class="flex items-center gap-2">
						<h1 class="text-3xl font-bold text-gray-900">{league.name}</h1>
						{#if league.active}
							<span class="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Active</span>
						{:else}
							<span class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">Inactive</span>
						{/if}
					</div>
					{#if league.season}
						<p class="text-sm text-gray-500 mt-1">Season: {league.season}</p>
					{/if}
				</div>
				<div class="flex gap-2">
					<button
						onclick={startEdit}
						class="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
					>Edit</button>
					{#if confirmDelete}
						<button
							onclick={handleDelete}
							class="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
						>Confirm Delete</button>
						<button
							onclick={() => (confirmDelete = false)}
							class="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
						>Cancel</button>
					{:else}
						<button
							onclick={() => (confirmDelete = true)}
							class="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 transition-colors"
						>Delete</button>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Standings -->
		<div>
			<h2 class="text-xl font-semibold text-gray-900 mb-3">Standings</h2>
			{#if standings.length === 0}
				<div class="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
					<p class="text-4xl mb-2">📋</p>
					<p class="text-sm">No standings yet. Add players and record matches in this league.</p>
				</div>
			{:else}
				<div class="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
					<table class="w-full text-sm">
						<thead class="bg-gray-50 text-gray-500 uppercase text-xs tracking-wider">
							<tr>
								<th class="px-4 py-3 text-left w-10">#</th>
								<th class="px-4 py-3 text-left">Player</th>
								<th class="px-4 py-3 text-right">P</th>
								<th class="px-4 py-3 text-right">W</th>
								<th class="px-4 py-3 text-right">D</th>
								<th class="px-4 py-3 text-right">L</th>
								<th class="px-4 py-3 text-right">Pts</th>
								<th class="px-4 py-3 text-right">ELO</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 bg-white">
							{#each standings as row}
								<tr class="hover:bg-gray-50 transition-colors">
									<td class="px-4 py-3 text-center">{rankMedal(row.rank)}</td>
									<td class="px-4 py-3 font-medium text-gray-900">
										<a href="/players/{row.player_id}" class="hover:text-blue-600">{row.player}</a>
									</td>
									<td class="px-4 py-3 text-right text-gray-600">{row.played}</td>
									<td class="px-4 py-3 text-right text-green-600 font-medium">{row.won}</td>
									<td class="px-4 py-3 text-right text-gray-500">{row.drawn}</td>
									<td class="px-4 py-3 text-right text-red-500">{row.lost}</td>
									<td class="px-4 py-3 text-right font-bold text-gray-900">{row.points}</td>
									<td class="px-4 py-3 text-right">
										<span class="px-2 py-0.5 rounded-full text-xs font-semibold {eloBadge(row.elo)}">
											{row.elo}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<!-- Members -->
		<div>
			<h2 class="text-xl font-semibold text-gray-900 mb-3">Members</h2>
			<div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
				{#if members.length === 0}
					<div class="p-6 text-center text-gray-400 text-sm">No members yet.</div>
				{:else}
					<ul class="divide-y divide-gray-100">
						{#each members as member}
							<li class="flex items-center justify-between px-5 py-3">
								<div class="flex items-center gap-3">
									<a href="/players/{member.player_id}" class="font-medium text-gray-900 hover:text-blue-600">
										{member.name}
									</a>
									<span class="px-2 py-0.5 rounded-full text-xs font-semibold {eloBadge(member.elo)}">
										{member.elo}
									</span>
								</div>
								<button
									onclick={() => handleRemovePlayer(member.player_id)}
									class="text-xs text-red-500 hover:text-red-700 hover:underline"
								>Remove</button>
							</li>
						{/each}
					</ul>
				{/if}

				<!-- Add player -->
				{#if nonMembers.length > 0}
					<div class="border-t border-gray-100 px-5 py-3 flex items-center gap-3 bg-gray-50">
						<select
							bind:value={addPlayerId}
							class="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							<option value="">— Select player to add —</option>
							{#each nonMembers as p}
								<option value={p.id}>{p.name} ({p.elo})</option>
							{/each}
						</select>
						<button
							onclick={handleAddPlayer}
							disabled={!addPlayerId}
							class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
						>Add</button>
					</div>
				{/if}
			</div>
		</div>

		<!-- Match History -->
		<div>
			<h2 class="text-xl font-semibold text-gray-900 mb-3">Match History</h2>
			{#if recentMatches.length === 0}
				<div class="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
					<p class="text-4xl mb-2">⚽</p>
					<p class="text-sm">No matches recorded for this league yet.</p>
					<a
						href="/match/new"
						class="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
					>Record Match</a>
				</div>
			{:else}
				<div class="space-y-2">
					{#each recentMatches as m}
						<div class="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center justify-between shadow-sm">
							<div>
								<p class="font-medium text-gray-900 text-sm">{matchLabel(m)}</p>
								<p class="text-xs text-gray-400 mt-0.5">{relativeTime(m.played_at)}</p>
							</div>
							<div class="flex items-center gap-2">
								<span class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs font-medium">{m.type}</span>
								<span class="text-lg font-bold text-gray-900">{m.score1} – {m.score2}</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
