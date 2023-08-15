import { TestOpenPandora } from './utils/helpers';

describe('Load', () => {
	it('Should load Pandora', async () => {
		const page = await TestOpenPandora();

		await expect(page.title()).resolves.toBe('Pandora');
	});

	it('Should load Editor', async () => {
		const page = await TestOpenPandora('/editor');

		await expect(page.title()).resolves.toBe('Pandora Editor');
	});
});
