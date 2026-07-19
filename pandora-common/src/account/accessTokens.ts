import { freeze } from 'immer';
import * as z from 'zod';
import { Crc32 } from '../utility/crc32.ts';
import { Assert, KnownObject } from '../utility/misc.ts';
import { ZodTemplateString, type ZodObjectShape } from '../validation.ts';

//#region List of access token scopes

const PANDORA_ACCESS_TOKEN_SCOPES_DEFINITION = {
	'spaces:list_owned': {
		description: 'List all spaces you are owner of',
	},
	'spaces:create': {
		description: 'Create new spaces in your name',
	},
	'spaces:disown': {
		description: 'Give up ownership on spaces you own (potentially deleting them)',
	},
} as const satisfies Record<string, PandoraAccessTokenScopeDefinitionBase>;

// Both validate and export the config
export const PANDORA_ACCESS_TOKEN_SCOPES: Readonly<Record<PandoraAccessTokenScope, PandoraAccessTokenScopeDefinition>> = PANDORA_ACCESS_TOKEN_SCOPES_DEFINITION;
freeze(PANDORA_ACCESS_TOKEN_SCOPES, true);

//#endregion

type PandoraAccessTokenScopeDefinitionBase = {
	description: string;
	requires?: string[];
};

export type PandoraAccessTokenScopeDefinition = {
	/** User-friendly description of the scope */
	readonly description: string;
	/** If this scope requires other scopes, NOT transitive */
	readonly requires?: readonly PandoraAccessTokenScope[];
};

export type PandoraAccessTokenScope = keyof typeof PANDORA_ACCESS_TOKEN_SCOPES_DEFINITION;
export const PandoraAccessTokenScopeSchema: z.ZodType<PandoraAccessTokenScope> = z.enum(KnownObject.keys(PANDORA_ACCESS_TOKEN_SCOPES_DEFINITION));

export type PandoraAccessTokenScopeList = readonly PandoraAccessTokenScope[];
export const PandoraAccessTokenScopeListSchema: z.ZodType<PandoraAccessTokenScopeList> = PandoraAccessTokenScopeSchema.array()
	.max(KnownObject.keys(PANDORA_ACCESS_TOKEN_SCOPES_DEFINITION).length);

export function PandoraAccessTokenScopeListAdd(oldScope: PandoraAccessTokenScopeList, addScope: PandoraAccessTokenScope): PandoraAccessTokenScopeList {
	const newScope = oldScope.slice();

	function checkAndAdd(scope: PandoraAccessTokenScope) {
		if (newScope.includes(scope))
			return;

		newScope.push(scope);
		const requires = PANDORA_ACCESS_TOKEN_SCOPES[scope].requires;
		if (requires != null) {
			for (const required of requires) {
				checkAndAdd(required);
			}
		}
	}

	checkAndAdd(addScope);

	const keys = KnownObject.keys(PANDORA_ACCESS_TOKEN_SCOPES);
	return newScope.sort((a, b) => keys.indexOf(a) - keys.indexOf(b));
}

export function PandoraAccessTokenScopeListRemove(oldScope: PandoraAccessTokenScopeList, removeScope: PandoraAccessTokenScope): PandoraAccessTokenScopeList {
	const newScope = oldScope.filter((s) => s !== removeScope);

	let hadChange = true;
	while (hadChange) {
		hadChange = false;

		for (let i = newScope.length - 1; i >= 0; i--) {
			const requires = PANDORA_ACCESS_TOKEN_SCOPES[newScope[i]].requires;
			if (requires != null && !requires.every((required) => newScope.includes(required))) {
				newScope.splice(i, 1);
				hadChange = true;
			}
		}
	}

	const keys = KnownObject.keys(PANDORA_ACCESS_TOKEN_SCOPES);
	return newScope.sort((a, b) => keys.indexOf(a) - keys.indexOf(b));
}

/** Regex for matching Pandora Access Tokens inside a string */
export const PANDORA_ACCESS_TOKEN_REGEX = /pdr_at_([0-9a-zA-Z]{32})([0-9a-f]{8})/g;
/** Regex for matching whole string as Pandora Access Token */
export const PANDORA_ACCESS_TOKEN_REGEX_FULL = /^pdr_at_([0-9a-zA-Z]{32})([0-9a-f]{8})$/;

/**
 * Access token to an Pandora account.
 * The format is as follows:
 * - Static prefix `pdr_at_`
 * - 32 random alphanumeric characters characters
 * - hex encoded crc32 checksum of everything preceding
 */
export type PandoraAccessToken = `pdr_at_${string}`;
/**
 * Access token to an Pandora account.
 * The format is as follows:
 * - Static prefix `pdr_at_`
 * - 32 random alphanumeric characters characters
 * - hex encoded crc32 checksum of everything preceding
 */
export const PandoraAccessTokenSchema: z.ZodType<PandoraAccessToken> = ZodTemplateString<PandoraAccessToken>(z.string(), PANDORA_ACCESS_TOKEN_REGEX_FULL)
	.refine((token) => {
		const match = PANDORA_ACCESS_TOKEN_REGEX_FULL.exec(token);
		if (match == null)
			return false;

		const checksumedPart = 'pdr_at_' + match[1];
		if (PandoraAccessTokenGenerateChecksum(checksumedPart) !== match[2])
			return false;

		return true;
	});

/**
 * Calculates the checksum suffix of Pandora Access Token
 */
export function PandoraAccessTokenGenerateChecksum(checksumedPart: string): string {
	const encoded = new Uint8Array(checksumedPart.length);
	for (let i = 0; i < checksumedPart.length; i++) {
		encoded[i] = checksumedPart.charCodeAt(i);
	}
	const checksum = Crc32(encoded);
	return checksum.toString(16).toLowerCase().padStart(8, '0');
}

/**
 * Generates wrapping around random part of Pandora Access Token, turning a 32 character alphanumeric string into an Pandora Access Token.
 * @param randomPart - 32 character long alphanumeric string that should be cryptographically secure
 * @returns - Full Pandora Access Token
 */
export function PandoraAccessTokenGenerate(randomPart: string): PandoraAccessToken {
	Assert(randomPart.length === 32, 'Supplied random part must be 32 characters long');
	Assert(/^[0-9a-zA-Z]*$/.test(randomPart), 'Supplied random part must be alphanumeric');

	const checksumedPart = 'pdr_at_' + randomPart;
	return PandoraAccessTokenSchema.parse(checksumedPart + PandoraAccessTokenGenerateChecksum(checksumedPart));
}

/** Schema for id of Pandora Access Token; account-specific */
export const PandoraAccessTokenIdSchema = z.string().min(1);
/** Schema for Pandora Access Token user-visible name */
export const PandoraAccessTokenNameSchema = z.string().min(1).max(32);

/** Publicly visible information about Pandora Access Token */
export interface PandoraAccessTokenInfo {
	/** Identifier by which the token is identified within the account */
	id: string;
	/** User-visible name */
	name: string;
	/** List of scopes allowed for this token */
	scopes: PandoraAccessTokenScopeList;
	/** Timestamp of the token creation */
	created: number;
	/** Timestamp of last use of the token (if ever) */
	lastUsed?: number;
	/** Timestamp of token's expiration (if set) */
	expires: number | null;
}
/** Publicly visible information about Pandora Access Token */
export const PandoraAccessTokenInfoSchema: z.ZodObject<ZodObjectShape<PandoraAccessTokenInfo>> = z.object({
	id: PandoraAccessTokenIdSchema,
	name: PandoraAccessTokenNameSchema,
	scopes: PandoraAccessTokenScopeListSchema,
	created: z.number(),
	lastUsed: z.number().optional(),
	expires: z.number().nullable(),
});

/** Secret data about Pandora Access Token */
export interface PandoraAccessTokenData extends PandoraAccessTokenInfo {
	/** The actual token */
	token: PandoraAccessToken;
}
/** Secret data about Pandora Access Token */
export const PandoraAccessTokenDataSchema: z.ZodObject<ZodObjectShape<PandoraAccessTokenData>> = PandoraAccessTokenInfoSchema.extend({
	token: PandoraAccessTokenSchema,
});
