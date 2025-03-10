import { KeyExchange } from '../../src/crypto/keyExchange.ts';

let exchange1!: KeyExchange;
let exchange2!: KeyExchange;

describe('KeyExchange', () => {

	beforeAll(async () => {
		exchange1 = await KeyExchange.generate();
		exchange2 = await KeyExchange.generate();
	});

	it('deriveKey', async () => {
		const key1 = await exchange1.deriveKey(await exchange2.exportPublicKey());
		const key2 = await exchange2.deriveKey(await exchange1.exportPublicKey());

		const text = 'Hello Pandora!';
		const encrypted1 = await key1.encrypt(text);
		const encrypted2 = await key2.encrypt(text);

		expect(encrypted1).not.toBe(encrypted2);
		expect(await key1.decrypt(encrypted1)).toBe(text);
		expect(await key1.decrypt(encrypted2)).toBe(text);
		expect(await key2.decrypt(encrypted1)).toBe(text);
		expect(await key2.decrypt(encrypted2)).toBe(text);
	});

	it('import export', async () => {
		const password = 'password';
		const exported = await exchange1.export(password);
		const imported = await KeyExchange.import(exported, password);

		expect(await imported.exportPublicKey()).toEqual(await exchange1.exportPublicKey());

		const key1 = await exchange1.deriveKey(await exchange2.exportPublicKey());
		const key2 = await exchange2.deriveKey(await exchange1.exportPublicKey());
		const key3 = await imported.deriveKey(await exchange2.exportPublicKey());

		const text = 'Hello Pandora!';
		const encrypted1 = await key1.encrypt(text);
		const encrypted2 = await key2.encrypt(text);
		const encrypted3 = await key3.encrypt(text);

		expect(encrypted1).not.toBe(encrypted2);
		expect(encrypted2).not.toBe(encrypted3);

		expect(await key1.decrypt(encrypted3)).toBe(text);
		expect(await key2.decrypt(encrypted3)).toBe(text);

		expect(await key3.decrypt(encrypted1)).toBe(text);
		expect(await key3.decrypt(encrypted2)).toBe(text);
	});
});
