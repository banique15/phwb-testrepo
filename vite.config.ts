import tailwindcss from '@tailwindcss/vite';
import devtoolsJson from 'vite-plugin-devtools-json';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		devtoolsJson()
	],
	build: {
		// Optimize bundle size
		target: 'es2020',
		minify: 'terser',
		terserOptions: {
			compress: {
				drop_console: true, // Remove console statements in production
				drop_debugger: true,
				pure_funcs: ['console.log', 'console.info', 'console.debug']
			}
		},
		// Improve chunking strategy
		rollupOptions: {},
		// Increase chunk size warning limit (default is 500kb)
		chunkSizeWarningLimit: 600,
		// Enable source maps for debugging (disable in production if needed)
		sourcemap: true
	},
	// Optimize dependencies
	optimizeDeps: {
		include: ['@supabase/supabase-js', '@supabase/ssr', 'zod', 'lucide-svelte'],
		exclude: []
	},
	ssr: {
		noExternal: ['lucide-svelte']
	},
	// Preview server optimization
	preview: {
		port: 4173,
		strictPort: false,
		headers: {
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	}
});
