import { TestOpenPandora } from './utils/helpers';
import { AssertNotNullable } from './utils/utils';

describe('EULA', () => {
	test('Shows privacy policy', async () => {
		const page = await TestOpenPandora();

		// Find link
		const link = await page.waitForSelector('a::-p-text(privacy policy)');
		AssertNotNullable(link);

		// Click it
		await link.click();

		// We should see the policy
		await expect(page.waitForSelector('h1::-p-text(Privacy Policy)')).resolves.not.toBeNull();

		// There should be a close button
		const closeButton = await page.waitForSelector('button::-p-text(Close)');
		AssertNotNullable(closeButton);

		// Close button should hide the policy
		await closeButton.click();
		await expect(page.waitForSelector('h1::-p-text(Privacy Policy)', { hidden: true })).resolves.toBeNull();
	});

	test('Disagree navigates away', async () => {
		const page = await TestOpenPandora();

		// Find button
		const button = await page.waitForSelector('button::-p-text(Disagree)');
		AssertNotNullable(button);

		// Disagree button should navigate away from pandora
		await Promise.all([
			page.waitForNavigation(),
			button.click(),
		]);

		expect(page.url()).toBe('about:blank');
	});
});
