<script lang="ts">
	import { onMount } from 'svelte';
	import { whenReady } from '$lib/db';
	import { getLeaderboard, getRecentMatches, type LeaderboardRow, type RecentMatchRow } from '$lib/stores/players.svelte';

	let topPlayers = $state<LeaderboardRow[]>([]);
	let recentMatches = $state<RecentMatchRow[]>([]);

	onMount(async () => {
		await whenReady();
		topPlayers = getLeaderboard().slice(0, 5);
		recentMatches = getRecentMatches(5);
	});

	function eloBadge(elo: number): string {
		if (elo >= 1150) return 'bg-yellow-100 text-yellow-800';
		if (elo >= 1050) return 'bg-green-100 text-green-800';
		if (elo >= 950) return 'bg-blue-100 text-blue-800';
		return 'bg-gray-100 text-gray-500';
	}

	function eloLabel(elo: number): string {
		if (elo >= 1150) return 'Elite';
		if (elo >= 1050) return 'Pro';
		if (elo >= 950) return 'Regular';
		return 'Rookie';
	}

	function matchLabel(m: RecentMatchRow): string {
		if (m.type === '1v1') {
			const a = m.p1_name ?? '?';
			const b = m.p2_name ?? '?';
			return `${a} vs ${b}`;
		}
		const t1 = [m.t1p1_name, m.t1p2_name].filter(Boolean).join(' & ') || '?';
		const t2 = [m.t2p1_name, m.t2p2_name].filter(Boolean).join(' & ') || '?';
		return `${t1} vs ${t2}`;
	}

	function scoreClass(m: RecentMatchRow, side: 1 | 2): string {
		if (m.score1 === m.score2) return 'text-gray-500';
		return (side === 1 ? m.score1 > m.score2 : m.score2 > m.score1)
			? 'text-green-600 font-bold'
			: 'text-red-500';
	}

	function relativeTime(dateStr: string): string {
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs}h ago`;
		return `${Math.floor(hrs / 24)}d ago`;
	}
</script>

<svelte:head>
	<title>Foosball · Home</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-4 py-10 space-y-12">
	<!-- Hero -->
	<section class="text-center space-y-4">
		<div class="text-6xl">⚽</div>
		<h1 class="text-4xl font-extrabold text-gray-900 tracking-tight">Foosball HQ</h1>
		<p class="text-lg text-gray-500 max-w-md mx-auto">
			Track matches, rank players, run leagues and tournaments — all in your browser.
		</p>

		<!-- Quick actions -->
		<div class="flex flex-wrap justify-center gap-3 pt-2">
			<a
				href="/match/new"
				class="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors shadow-sm"
			>
				⚡ Quick Match
			</a>
			<a
				href="/players"
				class="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors shadow-sm"
			>
				👥 Players
			</a>
			<a
				href="/leagues"
				class="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors shadow-sm"
			>
				🏆 Leagues
			</a>
			<a
				href="/tournaments"
				class="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors shadow-sm"
			>
				🥇 Tournaments
			</a>
		</div>
	</section>

	<div class="grid md:grid-cols-2 gap-8">
		<!-- Top Players -->
		<section>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-xl font-bold text-gray-900">Top Players</h2>
				<a href="/players" class="text-sm text-blue-600 hover:underline">View all →</a>
			</div>

			{#if topPlayers.length === 0}
				<div class="rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-400">
					<div class="text-3xl mb-2">🏓</div>
					<p class="text-sm">No players yet. <a href="/players/new" class="text-blue-600 hover:underline">Add one!</a></p>
				</div>
			{:else}
				<div class="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
					{#each topPlayers as player, i}
						<a
							href="/players/{player.id}"
							class="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors {i > 0 ? 'border-t border-gray-100' : ''}"
						>
							<span class="w-6 text-center text-sm font-mono text-gray-400">
								{#if i === 0}🥇{:else if i === 1}🥈{:else if i === 2}🥉{:else}{i + 1}{/if}
							</span>
							<span class="flex-1 font-medium text-gray-900 text-sm truncate">{player.name}</span>
							<span class="text-xs text-gray-400">{player.games_played}g</span>
							<span class="px-2 py-0.5 rounded-full text-xs font-semibold {eloBadge(player.elo)}">
								{player.elo} · {eloLabel(player.elo)}
							</span>
						</a>
					{/each}
				</div>
			{/if}
		</section>

		<!-- Recent Matches -->
		<section>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-xl font-bold text-gray-900">Recent Matches</h2>
				<a href="/match/new" class="text-sm text-blue-600 hover:underline">New match →</a>
			</div>

			{#if recentMatches.length === 0}
				<div class="rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-400">
					<div class="text-3xl mb-2">🎮</div>
					<p class="text-sm">No matches yet. <a href="/match/new" class="text-blue-600 hover:underline">Record one!</a></p>
				</div>
			{:else}
				<div class="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
					{#each recentMatches as m, i}
						<div class="flex items-center gap-3 px-4 py-3 bg-white {i > 0 ? 'border-t border-gray-100' : ''}">
							<span class="text-xs uppercase font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">
								{m.type}
							</span>
							<span class="flex-1 text-sm text-gray-800 truncate">{matchLabel(m)}</span>
							<span class="text-sm tabular-nums shrink-0">
								<span class={scoreClass(m, 1)}>{m.score1}</span>
								<span class="text-gray-300 mx-0.5">–</span>
								<span class={scoreClass(m, 2)}>{m.score2}</span>
							</span>
							<span class="text-xs text-gray-400 shrink-0">{relativeTime(m.played_at)}</span>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</div>
</div>

