<script lang="ts">
	import { goto } from '$app/navigation';
	import { createPlayer } from '$lib/stores/players.svelte';

	let name = $state('');
	let error = $state('');
	let submitting = $state(false);

	function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		const trimmed = name.trim();
		if (!trimmed) {
			error = 'Player name is required.';
			return;
		}
		submitting = true;
		try {
			createPlayer(trimmed);
			goto('/players');
		} catch (err) {
			error = (err as Error).message;
			submitting = false;
		}
	}
</script>

<div class="max-w-md mx-auto px-4 py-8">
	<div class="mb-6">
		<a href="/players" class="text-sm text-gray-500 hover:text-gray-700">← Back to Players</a>
	</div>

	<h1 class="text-2xl font-bold text-gray-900 mb-6">Add Player</h1>

	<form onsubmit={handleSubmit} class="space-y-4 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
		<div>
			<label for="name" class="block text-sm font-medium text-gray-700 mb-1">Name</label>
			<input
				id="name"
				type="text"
				bind:value={name}
				placeholder="e.g. Alice"
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
			{submitting ? 'Creating…' : 'Create Player'}
		</button>
	</form>
</div>
