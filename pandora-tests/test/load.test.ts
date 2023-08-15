import { TestOpenPandora } from './helpers';

describe('Load', () => {
	it('Should load Pandora', async () => {
		const page = await TestOpenPandora();

		await expect(page.title()).resolves.toMatch('Pandora');
	});
});
