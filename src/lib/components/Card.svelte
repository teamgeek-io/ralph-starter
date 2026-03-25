<script lang="ts">
	let {
		class: className = '',
		padding = true,
		children
	}: {
		class?: string;
		padding?: boolean;
		children: import('svelte').Snippet;
	} = $props();
</script>

<div
	class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm {padding ? 'p-5' : 'overflow-hidden'} {className}"
>
	{@render children()}
</div>
