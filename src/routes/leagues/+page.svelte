<script lang="ts">
	import { onMount } from 'svelte';
	import { whenReady } from '$lib/db';
	import { getAllLeagues, loadLeagues, type League } from '$lib/stores/leagues.svelte';

	let leagues = $state<League[]>([]);

	onMount(async () => {
		await whenReady();
		loadLeagues();
		leagues = getAllLeagues();
	});

	$effect(() => {
		leagues = getAllLeagues();
	});
</script>

<div class="max-w-4xl mx-auto px-4 py-8">
	<div class="flex items-center justify-between mb-6">
		<div>
			<a href="/" class="text-sm text-gray-500 hover:text-gray-700">← Home</a>
			<h1 class="text-3xl font-bold text-gray-900 mt-1">Leagues</h1>
		</div>
		<a
			href="/leagues/new"
			class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
		>
			+ New League
		</a>
	</div>

	{#if leagues.length === 0}
		<div class="text-center py-20 text-gray-400">
			<div class="text-6xl mb-4">🏆</div>
			<p class="text-lg font-medium text-gray-600">No leagues yet</p>
			<p class="text-sm mt-1">Create a league to start tracking standings.</p>
			<a
				href="/leagues/new"
				class="mt-5 inline-block px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
			>
				Create League
			</a>
		</div>
	{:else}
		<div class="grid gap-4">
			{#each leagues as league}
				<a
					href="/leagues/{league.id}"
					class="block bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all"
				>
					<div class="flex items-center justify-between">
						<div>
							<div class="flex items-center gap-2">
								<h2 class="text-lg font-semibold text-gray-900">{league.name}</h2>
								{#if league.active}
									<span class="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Active</span>
								{:else}
									<span class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">Inactive</span>
								{/if}
							</div>
							{#if league.season}
								<p class="text-sm text-gray-500 mt-0.5">Season: {league.season}</p>
							{/if}
						</div>
						<span class="text-gray-400 text-lg">→</span>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
