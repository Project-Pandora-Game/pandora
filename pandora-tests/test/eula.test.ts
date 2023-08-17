import { TestOpenPandora } from './utils/helpers';

describe('EULA', () => {
	test('Shows privacy policy', async () => {
		const page = await TestOpenPandora();

		// Find link
		const link = await page.findLink('privacy policy');

		// Click it
		await link.click();

		// We should see the policy
		await page.findElement('h1::-p-text(Privacy Policy)');

		// There should be a close button
		const closeButton = await page.findButton('Close');

		// Close button should hide the policy
		await closeButton.click();
		await page.waitForMissingElement('h1::-p-text(Privacy Policy)');
	});

	test('Disagree navigates away', async () => {
		const page = await TestOpenPandora();

		// Find button
		const button = await page.findButton('Disagree');

		// Disagree button should navigate away from pandora
		await page.expectNavigation(() => button.click());

		expect(page.rawPage.url()).toBe('about:blank');
	});
});
