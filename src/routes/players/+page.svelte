<script lang="ts">
	import { onMount } from 'svelte';
	import { whenReady } from '$lib/db';
	import { getLeaderboard, type LeaderboardRow } from '$lib/stores/players.svelte';

	let rows = $state<LeaderboardRow[]>([]);

	onMount(async () => {
		await whenReady();
		rows = getLeaderboard();
	});

	function eloBadge(elo: number): string {
		if (elo >= 1150) return 'bg-yellow-100 text-yellow-800';
		if (elo >= 1050) return 'bg-green-100 text-green-800';
		if (elo >= 950) return 'bg-blue-100 text-blue-800';
		return 'bg-gray-100 text-gray-500';
	}

	function winRate(row: LeaderboardRow): string {
		if (!row.games_played) return '—';
		return `${Math.round((row.wins / row.games_played) * 100)}%`;
	}
</script>

<div class="max-w-4xl mx-auto px-4 py-8">
	<div class="flex items-center justify-between mb-6">
		<h1 class="text-3xl font-bold text-gray-900">Players</h1>
		<a
			href="/players/new"
			class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
		>
			+ Add Player
		</a>
	</div>

	{#if rows.length === 0}
		<div class="text-center py-20 text-gray-400">
			<div class="text-6xl mb-4">🏓</div>
			<p class="text-lg font-medium text-gray-600">No players yet</p>
			<p class="text-sm mt-1">Add the first player to get started.</p>
			<a
				href="/players/new"
				class="mt-5 inline-block px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
			>
				Add Player
			</a>
		</div>
	{:else}
		<div class="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
			<table class="w-full text-sm">
				<thead class="bg-gray-50 text-gray-500 uppercase text-xs tracking-wider">
					<tr>
						<th class="px-4 py-3 text-left w-12">#</th>
						<th class="px-4 py-3 text-left">Player</th>
						<th class="px-4 py-3 text-right">ELO</th>
						<th class="px-4 py-3 text-right">Games</th>
						<th class="px-4 py-3 text-right">Win Rate</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100 bg-white">
					{#each rows as row, i}
						<tr class="hover:bg-gray-50 transition-colors">
							<td class="px-4 py-3 text-gray-400 font-mono text-xs">{i + 1}</td>
							<td class="px-4 py-3">
								<a href="/players/{row.id}" class="font-medium text-gray-900 hover:text-blue-600">
									{row.name}
								</a>
							</td>
							<td class="px-4 py-3 text-right">
								<span class="px-2 py-0.5 rounded-full text-xs font-semibold {eloBadge(row.elo)}">
									{row.elo}
								</span>
							</td>
							<td class="px-4 py-3 text-right text-gray-600">{row.games_played}</td>
							<td class="px-4 py-3 text-right text-gray-600">{winRate(row)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
