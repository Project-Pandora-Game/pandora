import { PASSWORD_PREHASH_SALT } from 'pandora-common';

const crypto = globalThis.crypto;
const subtle = globalThis.crypto.subtle;

export const Encode = (str: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(str);
export const Decode = (buf: Uint8Array): string => new TextDecoder().decode(buf);

export function ArrayToBase64(array: Iterable<number> | ArrayLike<number>): string {
	return btoa(String.fromCharCode(...Array.from(array)));
}

export function Base64ToArray(str: string): Uint8Array<ArrayBuffer> {
	return new Uint8Array(Array.from(atob(str).split(''), (c) => c.charCodeAt(0)));
}

export async function HashSHA512Base64(text: string) {
	const hashBuffer = await subtle.digest('SHA-512', Encode(text));
	return ArrayToBase64(new Uint8Array(hashBuffer));
}

export async function HashSHA256Base64(text: string) {
	const hashBuffer = await subtle.digest('SHA-256', Encode(text));
	return ArrayToBase64(new Uint8Array(hashBuffer));
}

export function GenerateIV(base64?: string): { iv: string; alg: { name: 'AES-GCM'; iv: Uint8Array<ArrayBuffer>; }; } {
	if (base64 === undefined) {
		const iv = crypto.getRandomValues(new Uint8Array(16));
		return { iv: ArrayToBase64(iv), alg: { name: 'AES-GCM', iv } };
	} else {
		return { iv: base64, alg: { name: 'AES-GCM', iv: Base64ToArray(base64) } };
	}
}

export function PrehashPassword(password: string): Promise<string> {
	return HashSHA512Base64(PASSWORD_PREHASH_SALT + password);
}
