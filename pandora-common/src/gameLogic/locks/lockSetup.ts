/** Setup for how this particular lock behaves */
export interface LockSetup {
	/** Configuration to enable password on this lock */
	password?: {
		/** Length of the password */
		length: number | [number, number];
		/**
		 * Allowed characters in the password
		 *  - `numeric` - only numbers
		 *  - `letters` - only letters (case insensitive)
		 *  - `alphanumeric` - only letters and numbers (case insensitive)
		 *  - `text` - any text (numbers + case insensitive letters + spaces, dashes, underscores, ...)
		 */
		format: 'numeric' | 'letters' | 'alphanumeric' | 'text';
	};
}
