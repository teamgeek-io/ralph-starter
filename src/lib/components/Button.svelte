<script lang="ts">
	type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
	type Size = 'sm' | 'md' | 'lg';

	let {
		variant = 'primary' as Variant,
		size = 'md' as Size,
		type = 'button' as 'button' | 'submit' | 'reset',
		disabled = false,
		href,
		class: className = '',
		onclick,
		children
	}: {
		variant?: Variant;
		size?: Size;
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		href?: string;
		class?: string;
		onclick?: (e: MouseEvent) => void;
		children: import('svelte').Snippet;
	} = $props();

	const variantClasses: Record<Variant, string> = {
		primary:
			'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 focus-visible:ring-blue-500',
		secondary:
			'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus-visible:ring-gray-400',
		danger:
			'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
		ghost:
			'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:ring-gray-400'
	};

	const sizeClasses: Record<Size, string> = {
		sm: 'px-3 py-1.5 text-xs',
		md: 'px-4 py-2 text-sm',
		lg: 'px-5 py-2.5 text-base'
	};

	const base =
		'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
</script>

{#if href}
	<a
		{href}
		class="{base} {variantClasses[variant]} {sizeClasses[size]} {className}"
		aria-disabled={disabled}
	>
		{@render children()}
	</a>
{:else}
	<button
		{type}
		{disabled}
		{onclick}
		class="{base} {variantClasses[variant]} {sizeClasses[size]} {className}"
	>
		{@render children()}
	</button>
{/if}
