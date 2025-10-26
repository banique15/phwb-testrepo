import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter(),

		// Navigation performance optimizations
		prerender: {
			// Prerender static pages for instant loading
			crawl: true,
			entries: ['/', '/login']
		},

		// Client-side navigation settings
		inlineStyleThreshold: 2048, // Inline small CSS for faster initial paint

		// Service worker configuration for offline support
		serviceWorker: {
			register: false // Enable when ready for PWA
		}
	}
};

export default config;
