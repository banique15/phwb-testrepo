/**
 * Portal action: move the node to a target element by id (e.g. outside drawer stacking context).
 * Use for dropdowns/panels that must render above the sidebar.
 */
export function portal(node: HTMLElement, targetId: string): { destroy: () => void } {
	const target = document.getElementById(targetId)
	if (target) {
		target.appendChild(node)
	}
	return {
		destroy() {
			node.remove()
		}
	}
}
