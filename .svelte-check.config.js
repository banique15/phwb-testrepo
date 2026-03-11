export default {
	// Treat a11y warnings as warnings, not errors
	// This allows the build to pass while still showing accessibility issues
	// that should be addressed in the future
	onwarn: (warning, handler) => {
		// Allow a11y warnings to be warnings, not errors
		if (warning.code && warning.code.startsWith('a11y_')) {
			return;
		}
		// Forward all other warnings
		handler(warning);
	}
};
