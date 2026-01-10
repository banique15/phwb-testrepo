<script lang="ts">
	import Modal from '$lib/components/ui/Modal.svelte'
	import TypeManagement from '../TypeManagement.svelte'

	interface Props {
		open?: boolean
	}

	let { open = false }: Props = $props()
</script>

<Modal 
	{open}
	title="Manage Facility & Location Types"
	size="xl"
	closeable={true}
>
	<TypeManagement />
</Modal>
