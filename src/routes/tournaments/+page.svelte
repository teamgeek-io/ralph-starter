<script lang="ts">
	import { onMount } from 'svelte';
	import { whenReady } from '$lib/db';
	import {
		getAllTournaments,
		getParticipants,
		loadTournaments,
		type Tournament
	} from '$lib/stores/tournaments.svelte';

	let tournaments = $state<Tournament[]>([]);
	let participantCounts = $state<Record<number, number>>({});

	function refresh() {
		const all = getAllTournaments();
		const order: Record<Tournament['status'], number> = {
			registration: 0,
			group_stage: 1,
			knockout: 2,
			complete: 3
		};
		tournaments = [...all].sort((a, b) => order[a.status] - order[b.status]);
		const counts: Record<number, number> = {};
		for (const t of tournaments) {
			counts[t.id] = getParticipants(t.id).length;
		}
		participantCounts = counts;
	}

	onMount(async () => {
		await whenReady();
		loadTournaments();
		refresh();
	});

	$effect(() => {
		refresh();
	});

	function statusBadgeClass(status: Tournament['status']): string {
		switch (status) {
			case 'registration':
				return 'bg-blue-100 text-blue-700';
			case 'group_stage':
				return 'bg-yellow-100 text-yellow-700';
			case 'knockout':
				return 'bg-orange-100 text-orange-700';
			case 'complete':
				return 'bg-green-100 text-green-700';
		}
	}

	function statusLabel(status: Tournament['status']): string {
		switch (status) {
			case 'registration':
				return 'Registration';
			case 'group_stage':
				return 'Group Stage';
			case 'knockout':
				return 'Knockout';
			case 'complete':
				return 'Complete';
		}
	}
</script>

<div class="max-w-4xl mx-auto px-4 py-8">
	<div class="flex items-center justify-between mb-6">
		<div>
			<a href="/" class="text-sm text-gray-500 hover:text-gray-700">← Home</a>
			<h1 class="text-3xl font-bold text-gray-900 mt-1">Tournaments</h1>
		</div>
		<a
			href="/tournaments/new"
			class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
		>
			+ New Tournament
		</a>
	</div>

	{#if tournaments.length === 0}
		<div class="text-center py-20 text-gray-400">
			<div class="text-6xl mb-4">🏆</div>
			<p class="text-lg font-medium text-gray-600">No tournaments yet</p>
			<p class="text-sm mt-1">Create a tournament to get started.</p>
			<a
				href="/tournaments/new"
				class="mt-5 inline-block px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
			>
				Create Tournament
			</a>
		</div>
	{:else}
		<div class="grid gap-4">
			{#each tournaments as tournament}
				<a
					href="/tournaments/{tournament.id}"
					class="block bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all"
				>
					<div class="flex items-center justify-between">
						<div>
							<div class="flex items-center gap-2">
								<h2 class="text-lg font-semibold text-gray-900">{tournament.name}</h2>
								<span
									class="px-2 py-0.5 rounded-full text-xs font-medium {statusBadgeClass(tournament.status)}"
								>
									{statusLabel(tournament.status)}
								</span>
								<span class="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
									{tournament.type}
								</span>
							</div>
							<p class="text-sm text-gray-500 mt-0.5">
								{participantCounts[tournament.id] ?? 0}
								{tournament.type === '2v2' ? 'teams' : 'participants'}
							</p>
						</div>
						<span class="text-gray-400 text-lg">→</span>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
