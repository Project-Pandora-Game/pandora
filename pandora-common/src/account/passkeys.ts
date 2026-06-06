/** @see https://www.iana.org/assignments/cose/cose.xhtml */
const COSE_ALGORITHM_EDDSA = -8;
/** @see https://www.iana.org/assignments/cose/cose.xhtml */
const COSE_ALGORITHM_ES256 = -7;
/** @see https://www.iana.org/assignments/cose/cose.xhtml */
const COSE_ALGORITHM_RS256 = -257;

// RFC9864 (Fully-Specified Algorithms) is not yet supported by our passkey library

export const ACCOUNT_PASSKEYS_ALLOWED_ALGORITHMS = [
	COSE_ALGORITHM_EDDSA,
	COSE_ALGORITHM_ES256,
	COSE_ALGORITHM_RS256,
] as const;
