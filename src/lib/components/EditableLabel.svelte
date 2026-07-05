<script lang="ts">
	interface Props {
		value: string;
		oncommit?: (v: string) => void;
		class?: string;
	}

	let { value, oncommit, class: cls = '' }: Props = $props();

	let editing = $state(false);
	let draft = $state('');
	let inputEl: HTMLInputElement | undefined = $state();

	function startEdit() {
		draft = value;
		editing = true;
	}

	function commit() {
		const trimmed = draft.trim();
		if (trimmed) oncommit?.(trimmed);
		editing = false;
	}

	$effect(() => {
		if (editing && inputEl) {
			inputEl.focus();
			inputEl.select();
		}
	});
</script>

{#if editing}
	<input
		bind:this={inputEl}
		bind:value={draft}
		type="text"
		class="inline-label-input {cls}"
		style="width: {Math.max(draft.length + 1, 5)}ch"
		onblur={commit}
		onkeydown={(e) => {
			if (e.key === 'Enter') { e.preventDefault(); commit(); }
			if (e.key === 'Escape') editing = false;
		}}
	/>
{:else}
	<button type="button" class="editable-label {cls}" onclick={startEdit} title="Click to rename">
		{value}
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="pencil-icon" aria-hidden="true">
			<path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.609Zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354ZM11.189 6.25 9.75 4.81l-6.286 6.287a.25.25 0 0 0-.064.108l-.558 1.953 1.953-.558a.249.249 0 0 0 .108-.064Z"/>
		</svg>
	</button>
{/if}
