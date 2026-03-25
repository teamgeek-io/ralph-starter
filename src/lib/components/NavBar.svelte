<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	let { darkMode = false, toggleDark }: { darkMode?: boolean; toggleDark?: () => void } = $props();

	const navLinks = [
		{ href: '/', label: 'Home', icon: '🏠' },
		{ href: '/players', label: 'Players', icon: '👤' },
		{ href: '/match/new', label: 'Quick Match', icon: '⚽' },
		{ href: '/leagues', label: 'Leagues', icon: '🏆' },
		{ href: '/tournaments', label: 'Tournaments', icon: '🎖️' }
	] as const;

	type BackConfig = { label: string; href: string };

	const backMap: Record<string, BackConfig> = {
		'/players/new': { label: 'Players', href: '/players' },
		'/leagues/new': { label: 'Leagues', href: '/leagues' },
		'/tournaments/new': { label: 'Tournaments', href: '/tournaments' }
	};

	const currentPath = $derived(page.url.pathname);

	const backLink = $derived(
		(() => {
			if (backMap[currentPath]) return backMap[currentPath];
			if (/^\/players\/\d+/.test(currentPath)) return { label: 'Players', href: '/players' };
			if (/^\/leagues\/\d+/.test(currentPath)) return { label: 'Leagues', href: '/leagues' };
			if (/^\/tournaments\/\d+/.test(currentPath)) return { label: 'Tournaments', href: '/tournaments' };
			return null;
		})()
	);

	function isActive(href: string): boolean {
		if (href === '/') return currentPath === '/';
		return currentPath.startsWith(href);
	}
</script>

<header class="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
	<div class="max-w-5xl mx-auto px-4">
		<div class="flex items-center justify-between h-14">
			<a href="/" class="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-1.5 shrink-0">
				⚽ <span class="hidden sm:inline">Foosball HQ</span>
			</a>

			<nav class="flex items-center gap-0.5 sm:gap-1 overflow-x-auto" aria-label="Main navigation">
				{#each navLinks as link}
					<a
						href={link.href}
						class="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors
							{isActive(link.href)
								? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
								: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'}"
						aria-current={isActive(link.href) ? 'page' : undefined}
					>
						<span class="text-base leading-none">{link.icon}</span>
						<span class="hidden sm:inline">{link.label}</span>
					</a>
				{/each}

				<!-- Dark mode toggle -->
				{#if toggleDark}
					<button
						onclick={toggleDark}
						aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
						class="ml-1 p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
					>
						{#if darkMode}
							<!-- Sun icon -->
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
									d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
							</svg>
						{:else}
							<!-- Moon icon -->
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
									d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
							</svg>
						{/if}
					</button>
				{/if}
			</nav>
		</div>

		{#if backLink}
			<div class="pb-2 -mt-0.5">
				<button
					onclick={() => goto(backLink!.href)}
					class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-green-700 dark:hover:text-green-400 transition-colors"
				>
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
					</svg>
					Back to {backLink.label}
				</button>
			</div>
		{/if}
	</div>
</header>
