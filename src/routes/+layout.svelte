<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { initDb } from '$lib/db';
	import NavBar from '$lib/components/NavBar.svelte';

	let { children } = $props();

	onMount(async () => {
		await initDb();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<NavBar />
<main class="max-w-5xl mx-auto px-4 py-6">
	{@render children()}
</main>
