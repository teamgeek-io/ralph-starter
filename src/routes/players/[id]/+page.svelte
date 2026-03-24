<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { whenReady } from '$lib/db';
	import {
		getPlayer,
		updatePlayer,
		deletePlayer,
		getPlayerStats,
		getPlayerEloHistory,
		getPlayerRecentMatches,
		type Player,
		type PlayerStats,
		type EloPoint,
		type RecentMatchRow
	} from '$lib/stores/players.svelte';

	let player = $state<Player | null>(null);
	let stats = $state<PlayerStats>({ wins: 0, losses: 0, draws: 0, winRate: 0 });
	let eloHistory = $state<EloPoint[]>([]);
	let recentMatches = $state<RecentMatchRow[]>([]);
	let notFound = $state(false);
	let dbReady = $state(false);

	let editing = $state(false);
	let editName = $state('');
	let editError = $state('');

	const id = $derived(Number(page.params.id));

	onMount(async () => {
		await whenReady();
		dbReady = true;
	});

	$effect(() => {
		if (!dbReady) return;
		load();
	});

	function load() {
		if (isNaN(id)) {
			notFound = true;
			return;
		}
		const p = getPlayer(id);
		if (!p) {
			notFound = true;
			return;
		}
		player = p;
		stats = getPlayerStats(id);
		eloHistory = getPlayerEloHistory(id);
		recentMatches = getPlayerRecentMatches(id);
	}

	function startEdit() {
		editName = player!.name;
		editError = '';
		editing = true;
	}

	function saveEdit() {
		const trimmed = editName.trim();
		if (!trimmed) {
			editError = 'Name cannot be empty';
			return;
		}
		try {
			updatePlayer(id, trimmed);
			load();
			editing = false;
		} catch (e) {
			editError = (e as Error).message;
		}
	}

	function confirmDelete() {
		if (confirm(`Delete player "${player!.name}"? This cannot be undone.`)) {
			deletePlayer(id);
			goto('/players');
		}
	}

	function eloBadge(elo: number): string {
		if (elo >= 1150) return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
		if (elo >= 1050) return 'bg-green-100 text-green-800 border border-green-300';
		if (elo >= 950) return 'bg-blue-100 text-blue-800 border border-blue-300';
		return 'bg-gray-100 text-gray-600 border border-gray-300';
	}

	function eloLabel(elo: number): string {
		if (elo >= 1150) return 'Elite';
		if (elo >= 1050) return 'Pro';
		if (elo >= 950) return 'Regular';
		return 'Rookie';
	}

	function matchResult(m: RecentMatchRow): 'W' | 'L' | 'D' {
		const onTeam1 =
			m.type === '1v1'
				? m.player1_id === id
				: m.team1_p1_id === id || m.team1_p2_id === id;
		if (m.score1 === m.score2) return 'D';
		return onTeam1 ? (m.score1 > m.score2 ? 'W' : 'L') : m.score2 > m.score1 ? 'W' : 'L';
	}

	function matchOpponent(m: RecentMatchRow): string {
		if (m.type === '1v1') {
			return m.player1_id === id ? (m.p2_name ?? '?') : (m.p1_name ?? '?');
		}
		const onTeam1 = m.team1_p1_id === id || m.team1_p2_id === id;
		return onTeam1
			? [m.t2p1_name, m.t2p2_name].filter(Boolean).join(' & ') || '?'
			: [m.t1p1_name, m.t1p2_name].filter(Boolean).join(' & ') || '?';
	}

	function chartPoints(history: EloPoint[]): string {
		if (history.length < 2) return '';
		const elos = history.map((h) => h.elo);
		const min = Math.min(...elos);
		const max = Math.max(...elos);
		const range = max - min || 1;
		const W = 300,
			padY = 5,
			chartH = 55;
		return history
			.map((h, i) => {
				const x = (i / (history.length - 1)) * W;
				const y = padY + (1 - (h.elo - min) / range) * chartH;
				return `${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

{#if notFound}
	<div class="max-w-md mx-auto px-4 py-16 text-center">
		<p class="text-gray-500 text-lg">Player not found.</p>
		<a href="/players" class="mt-4 inline-block text-blue-600 hover:underline text-sm">
			← Back to Players
		</a>
	</div>
{:else if player}
	<div class="max-w-2xl mx-auto px-4 py-8 space-y-5">
		<div>
			<a href="/players" class="text-sm text-gray-500 hover:text-gray-700">← Back to Players</a>
		</div>

		<!-- Header card -->
		<div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
			<div class="flex items-start justify-between gap-4">
				<div class="min-w-0 flex-1">
					{#if editing}
						<div class="flex gap-2 items-center flex-wrap">
							<input
								type="text"
								bind:value={editName}
								class="text-xl font-bold border-b-2 border-blue-500 outline-none min-w-0"
								onkeydown={(e) => e.key === 'Enter' && saveEdit()}
							/>
							<button
								onclick={saveEdit}
								class="text-green-600 hover:text-green-800 text-sm font-medium"
							>
								Save
							</button>
							<button
								onclick={() => (editing = false)}
								class="text-gray-400 hover:text-gray-600 text-sm"
							>
								Cancel
							</button>
						</div>
						{#if editError}
							<p class="text-red-600 text-sm mt-1">{editError}</p>
						{/if}
					{:else}
						<h1 class="text-2xl font-bold text-gray-900 truncate">{player.name}</h1>
					{/if}
					<p class="text-gray-400 text-xs mt-1">Member since {formatDate(player.created_at)}</p>
				</div>

				<!-- ELO badge -->
				<div class="text-right shrink-0">
					<div class="text-4xl font-black text-gray-900">{player.elo}</div>
					<span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold mt-1 {eloBadge(player.elo)}">
						{eloLabel(player.elo)}
					</span>
				</div>
			</div>

			<div class="mt-4 flex gap-2">
				<button
					onclick={startEdit}
					class="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
				>
					Edit
				</button>
				<button
					onclick={confirmDelete}
					class="text-sm px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
				>
					Delete
				</button>
			</div>
		</div>

		<!-- Stats grid -->
		<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
			{#each [
				{ label: 'Played', value: stats.wins + stats.losses + stats.draws, color: '' },
				{ label: 'Wins', value: stats.wins, color: 'text-green-600' },
				{ label: 'Losses', value: stats.losses, color: 'text-red-500' },
				{ label: 'Win Rate', value: `${stats.winRate}%`, color: 'text-blue-600' }
			] as stat}
				<div class="bg-white border border-gray-200 rounded-xl p-4 text-center shadow-sm">
					<div class="text-2xl font-bold {stat.color || 'text-gray-900'}">{stat.value}</div>
					<div class="text-xs text-gray-400 mt-1">{stat.label}</div>
				</div>
			{/each}
		</div>

		<!-- ELO history chart -->
		<div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
			<h2 class="text-base font-semibold text-gray-800 mb-4">ELO History (last 20 matches)</h2>
			{#if eloHistory.length >= 2}
				{@const pts = chartPoints(eloHistory)}
				<svg viewBox="0 0 300 70" class="w-full h-20" preserveAspectRatio="none">
					<defs>
						<linearGradient id="elo-area-grad" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="#3b82f6" stop-opacity="0.25" />
							<stop offset="100%" stop-color="#3b82f6" stop-opacity="0.02" />
						</linearGradient>
					</defs>
					<polygon points="{pts} 300,70 0,70" fill="url(#elo-area-grad)" />
					<polyline
						points={pts}
						fill="none"
						stroke="#3b82f6"
						stroke-width="2"
						stroke-linejoin="round"
						stroke-linecap="round"
					/>
				</svg>
				<div class="flex justify-between text-xs text-gray-400 mt-1">
					<span>{eloHistory[0].elo} ELO</span>
					<span>{eloHistory[eloHistory.length - 1].elo} ELO</span>
				</div>
			{:else}
				<div class="text-center py-8 text-gray-400">
					<div class="text-3xl mb-2">📈</div>
					<p class="text-sm">ELO history will appear after matches are played.</p>
				</div>
			{/if}
		</div>

		<!-- Recent matches -->
		<div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
			<h2 class="text-base font-semibold text-gray-800 mb-4">Recent Matches</h2>
			{#if recentMatches.length === 0}
				<div class="text-center py-8 text-gray-400">
					<div class="text-3xl mb-2">🏓</div>
					<p class="text-sm">No matches played yet.</p>
				</div>
			{:else}
				<div class="divide-y divide-gray-100">
					{#each recentMatches as m}
						{@const result = matchResult(m)}
						{@const opponent = matchOpponent(m)}
						<div class="flex items-center justify-between py-3 first:pt-0 last:pb-0">
							<div class="flex items-center gap-3 min-w-0">
								<span
									class="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0
										{result === 'W'
										? 'bg-green-100 text-green-700'
										: result === 'L'
											? 'bg-red-100 text-red-700'
											: 'bg-gray-100 text-gray-600'}"
								>
									{result}
								</span>
								<span class="text-sm text-gray-700 truncate">vs {opponent}</span>
								<span class="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
									{m.type}
								</span>
							</div>
							<div class="text-right shrink-0 ml-4">
								<div class="text-sm font-mono text-gray-700">{m.score1}–{m.score2}</div>
								<div class="text-xs text-gray-400">{formatDate(m.played_at)}</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}
