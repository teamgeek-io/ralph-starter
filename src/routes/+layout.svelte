<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { initDb } from '$lib/db';
	import NavBar from '$lib/components/NavBar.svelte';

	let { children } = $props();

	let darkMode = $state(false);

	onMount(async () => {
		const saved = localStorage.getItem('dark_mode');
		darkMode = saved !== null
			? saved === 'true'
			: window.matchMedia('(prefers-color-scheme: dark)').matches;
		await initDb();
	});

	$effect(() => {
		document.documentElement.classList.toggle('dark', darkMode);
		localStorage.setItem('dark_mode', String(darkMode));
	});

	function toggleDark() {
		darkMode = !darkMode;
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<NavBar {darkMode} {toggleDark} />
<main class="max-w-5xl mx-auto px-4 py-6">
	{@render children()}
</main>
