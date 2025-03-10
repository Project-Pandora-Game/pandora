import { Encode } from '../../src/crypto/helpers.ts';
import { SymmetricEncryption } from '../../src/crypto/symmetric.ts';

let symmetric!: SymmetricEncryption;

describe('SymmetricEncryption', () => {

	beforeAll(async () => {
		symmetric = await SymmetricEncryption.generate();
	});

	it('encrypt decrypt', async () => {
		const text = 'Hello Pandora!';
		const encrypted = await symmetric.encrypt(text);
		expect(await symmetric.decrypt(encrypted)).toBe(text);
	});

	it('password encrypt decrypt', async () => {
		const password = 'password';
		const salt = 'salt';

		const symmetric1 = await SymmetricEncryption.generate({ password, salt: Encode(salt) });
		const symmetric2 = await SymmetricEncryption.generate({ password, salt: Encode(salt) });

		const text = 'Hello Pandora!';
		const encrypted1 = await symmetric1.encrypt(text);
		const encrypted2 = await symmetric2.encrypt(text);

		expect(encrypted1).not.toBe(encrypted2);
		expect(await symmetric1.decrypt(encrypted1)).toBe(text);
		expect(await symmetric1.decrypt(encrypted2)).toBe(text);
		expect(await symmetric2.decrypt(encrypted1)).toBe(text);
		expect(await symmetric2.decrypt(encrypted2)).toBe(text);

		await expect(symmetric.decrypt(encrypted1)).rejects.toThrow();
	});
});
