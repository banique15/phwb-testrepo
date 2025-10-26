<script lang="ts">
	interface Props {
		currentPage: number
		totalPages: number
		totalItems: number
		itemsPerPage: number
		onPageChange: (page: number) => void
	}
	
	let { currentPage, totalPages, totalItems, itemsPerPage, onPageChange }: Props = $props()
	
	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages && page !== currentPage) {
			onPageChange(page)
		}
	}
	
	function getPaginationNumbers() {
		const pages = []
		const maxVisible = 5
		
		if (totalPages <= maxVisible) {
			for (let i = 1; i <= totalPages; i++) {
				pages.push(i)
			}
		} else {
			const start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
			const end = Math.min(totalPages, start + maxVisible - 1)
			
			if (start > 1) {
				pages.push(1)
				if (start > 2) pages.push('...')
			}
			
			for (let i = start; i <= end; i++) {
				pages.push(i)
			}
			
			if (end < totalPages) {
				if (end < totalPages - 1) pages.push('...')
				pages.push(totalPages)
			}
		}
		
		return pages
	}
	
	let startItem = $derived((currentPage - 1) * itemsPerPage + 1)
	let endItem = $derived(Math.min(currentPage * itemsPerPage, totalItems))
</script>

{#if totalPages > 1}
	<div class="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
		<div class="text-sm text-base-content/70">
			Showing {startItem} to {endItem} of {totalItems} results
		</div>
		
		<div class="join">
			<button 
				class="join-item btn btn-sm" 
				class:btn-disabled={currentPage === 1}
				onclick={() => goToPage(currentPage - 1)}
			>
				«
			</button>
			
			{#each getPaginationNumbers() as page}
				{#if page === '...'}
					<span class="join-item btn btn-sm btn-disabled">...</span>
				{:else}
					<button 
						class="join-item btn btn-sm" 
						class:btn-active={page === currentPage}
						onclick={() => goToPage(Number(page))}
					>
						{page}
					</button>
				{/if}
			{/each}
			
			<button 
				class="join-item btn btn-sm" 
				class:btn-disabled={currentPage === totalPages}
				onclick={() => goToPage(currentPage + 1)}
			>
				»
			</button>
		</div>
	</div>
{/if}