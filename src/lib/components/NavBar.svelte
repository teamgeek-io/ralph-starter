<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

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

<header class="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
	<div class="max-w-5xl mx-auto px-4">
		<div class="flex items-center justify-between h-14">
			<a href="/" class="font-bold text-lg text-gray-900 flex items-center gap-1.5 shrink-0">
				⚽ <span class="hidden sm:inline">Foosball HQ</span>
			</a>

			<nav class="flex items-center gap-0.5 sm:gap-1 overflow-x-auto" aria-label="Main navigation">
				{#each navLinks as link}
					<a
						href={link.href}
						class="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors
							{isActive(link.href)
								? 'bg-green-100 text-green-700'
								: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}"
						aria-current={isActive(link.href) ? 'page' : undefined}
					>
						<span class="text-base leading-none">{link.icon}</span>
						<span class="hidden sm:inline">{link.label}</span>
					</a>
				{/each}
			</nav>
		</div>

		{#if backLink}
			<div class="pb-2 -mt-0.5">
				<button
					onclick={() => goto(backLink!.href)}
					class="flex items-center gap-1 text-xs text-gray-500 hover:text-green-700 transition-colors"
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
