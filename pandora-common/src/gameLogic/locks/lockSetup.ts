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
	/** Configuration to enable timer on this lock */
	timer?: {
		/** Max allowed time (in ms) lock can be locked for */
		maxDuration: number;
	};
	/** Configuration to enable fingerprint on this lock */
	fingerprint?: {
		/** Max allowed fingerprints that can be registered on the lock */
		maxFingerprints: number;
	};
	/**
	 * Affects how character can interact with locks on items they are wearing:
	 * - `false` - Character can freely interact the the lock
	 * - `'locked'` - Character cannot interact with the lock if it is locked
	 * - `'always'` - Character cannot interact with the lock
	 * @default false
	 */
	blockSelf?: false | 'locked' | 'always';
}
