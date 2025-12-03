import { browser } from '$app/environment';

type Theme = 'sfh' | 'dark';

const STORAGE_KEY = 'phwb-theme';
const DEFAULT_THEME: Theme = 'sfh';

function createThemeStore() {
	let theme = $state<Theme>(DEFAULT_THEME);

	function applyTheme(newTheme: Theme) {
		if (browser) {
			document.documentElement.setAttribute('data-theme', newTheme);
			localStorage.setItem(STORAGE_KEY, newTheme);
		}
		theme = newTheme;
	}

	function initialize() {
		if (browser) {
			const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
			const initialTheme = saved === 'dark' ? 'dark' : DEFAULT_THEME;
			applyTheme(initialTheme);
		}
	}

	function toggle() {
		const newTheme: Theme = theme === 'sfh' ? 'dark' : 'sfh';
		applyTheme(newTheme);
	}

	function setTheme(newTheme: Theme) {
		applyTheme(newTheme);
	}

	return {
		get theme() {
			return theme;
		},
		get isDark() {
			return theme === 'dark';
		},
		initialize,
		toggle,
		setTheme
	};
}

export const themeStore = createThemeStore();
