import { ArrayToBase64, Base64ToArray, GenerateIV, HashSHA512Base64 } from '../../src/crypto/helpers.ts';

describe('ArrayToBase64', () => {
	const cases = [
		['AQIDBA==', [1, 2, 3, 4]],
	];
	it.each(cases)(
		'should return %p given %p',
		(result, input) => {
			expect(ArrayToBase64(input as number[])).toBe(result);
		},
	);
});

describe('Base64ToArray', () => {
	const cases = [
		[[1, 2, 3, 4], 'AQIDBA=='],
	];
	it.each(cases)(
		'should return %p given %p',
		(result, input) => {
			expect(Base64ToArray(input as string)).toStrictEqual(new Uint8Array(result as number[]));
		},
	);
});

describe('HashSHA512Base64', () => {
	const cases = [
		['z4PhNX7vuL3xVChQ1m2AB9Yg5AULVxXcg/SpIdNs6c5H0NE8XYXysP+DGNKHfuwvY7kxvUdBeoGlODJ6+SfaPg==', ''],
		['jRgs/OTBgICB+YyGar6MsoZfKUTu7ySv+DlR1gEJ/hzzMGc+TAV1RDsqdxzWhjvRqJNnjUBZYIUgi+ZHNfBT6Q==', 'password+salt'],
	];
	it.each(cases)(
		'should return %p given %p',
		async (result, input) => {
			expect(await HashSHA512Base64(input)).toStrictEqual(result);
		},
	);
});

describe('GenerateIV', () => {
	const cases = [
		[{ iv: 'AQIDBA==', alg: { iv: new Uint8Array([1, 2, 3, 4]), name: 'AES-GCM' } }, [1, 2, 3, 4]],
	];
	it.each(cases)(
		'should return %p given %p',
		(result, input) => {
			expect(GenerateIV(ArrayToBase64(input as number[]))).toStrictEqual(result);
		},
	);
});
