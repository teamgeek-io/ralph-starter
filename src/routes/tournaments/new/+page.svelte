<script lang="ts">
	import { goto } from '$app/navigation';
	import { createTournament } from '$lib/stores/tournaments.svelte';

	let name = $state('');
	let type = $state<'1v1' | '2v2'>('1v1');
	let error = $state('');
	let submitting = $state(false);

	function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		const trimmedName = name.trim();
		if (!trimmedName) {
			error = 'Tournament name is required.';
			return;
		}
		submitting = true;
		try {
			const newId = createTournament(trimmedName, type);
			goto(`/tournaments/${newId}`);
		} catch (err) {
			error = (err as Error).message;
			submitting = false;
		}
	}
</script>

<div class="max-w-md mx-auto px-4 py-8">
	<div class="mb-6">
		<a href="/tournaments" class="text-sm text-gray-500 hover:text-gray-700">← Back to Tournaments</a>
	</div>

	<h1 class="text-2xl font-bold text-gray-900 mb-6">Create Tournament</h1>

	<form
		onsubmit={handleSubmit}
		class="space-y-4 bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
	>
		<div>
			<label for="name" class="block text-sm font-medium text-gray-700 mb-1">Tournament Name</label>
			<input
				id="name"
				type="text"
				bind:value={name}
				placeholder="e.g. Office Champions Cup"
				class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				disabled={submitting}
			/>
		</div>

		<fieldset>
			<legend class="block text-sm font-medium text-gray-700 mb-2">Tournament Type</legend>
			<div class="flex gap-3">
				<label
					class="flex-1 flex items-center justify-center gap-2 px-4 py-3 border rounded-lg cursor-pointer transition-colors {type === '1v1'
						? 'border-blue-500 bg-blue-50 text-blue-700'
						: 'border-gray-300 hover:bg-gray-50'}"
				>
					<input type="radio" bind:group={type} value="1v1" class="sr-only" disabled={submitting} />
					<span class="font-medium">1v1</span>
					<span class="text-xs text-gray-500">Singles</span>
				</label>
				<label
					class="flex-1 flex items-center justify-center gap-2 px-4 py-3 border rounded-lg cursor-pointer transition-colors {type === '2v2'
						? 'border-blue-500 bg-blue-50 text-blue-700'
						: 'border-gray-300 hover:bg-gray-50'}"
				>
					<input type="radio" bind:group={type} value="2v2" class="sr-only" disabled={submitting} />
					<span class="font-medium">2v2</span>
					<span class="text-xs text-gray-500">Teams</span>
				</label>
			</div>
		</fieldset>

		{#if error}
			<p class="text-red-600 text-sm">{error}</p>
		{/if}

		<button
			type="submit"
			disabled={submitting}
			class="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
		>
			{submitting ? 'Creating…' : 'Create Tournament'}
		</button>
	</form>
</div>
