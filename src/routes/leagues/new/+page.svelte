<script lang="ts">
	import { goto } from '$app/navigation';
	import { createLeague } from '$lib/stores/leagues.svelte';

	let name = $state('');
	let season = $state('');
	let error = $state('');
	let submitting = $state(false);

	function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		const trimmedName = name.trim();
		if (!trimmedName) {
			error = 'League name is required.';
			return;
		}
		submitting = true;
		try {
			createLeague(trimmedName, season.trim() || undefined);
			goto('/leagues');
		} catch (err) {
			error = (err as Error).message;
			submitting = false;
		}
	}
</script>

<div class="max-w-md mx-auto px-4 py-8">
	<div class="mb-6">
		<a href="/leagues" class="text-sm text-gray-500 hover:text-gray-700">← Back to Leagues</a>
	</div>

	<h1 class="text-2xl font-bold text-gray-900 mb-6">Create League</h1>

	<form
		onsubmit={handleSubmit}
		class="space-y-4 bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
	>
		<div>
			<label for="name" class="block text-sm font-medium text-gray-700 mb-1">League Name</label>
			<input
				id="name"
				type="text"
				bind:value={name}
				placeholder="e.g. Office Champions"
				class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				disabled={submitting}
			/>
		</div>

		<div>
			<label for="season" class="block text-sm font-medium text-gray-700 mb-1">
				Season <span class="text-gray-400 font-normal">(optional)</span>
			</label>
			<input
				id="season"
				type="text"
				bind:value={season}
				placeholder="e.g. Spring 2025"
				class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				disabled={submitting}
			/>
		</div>

		{#if error}
			<p class="text-red-600 text-sm">{error}</p>
		{/if}

		<button
			type="submit"
			disabled={submitting}
			class="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
		>
			{submitting ? 'Creating…' : 'Create League'}
		</button>
	</form>
</div>
