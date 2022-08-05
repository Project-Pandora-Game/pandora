import { Sleep } from '../src/utility';

describe('Sleep()', () => {
	it('Sleeps for set amount of time', async () => {
		jest.useFakeTimers();

		const promise = Sleep(1000);

		jest.advanceTimersByTime(1000);
		await expect(promise).resolves.toBe(undefined);

		jest.useRealTimers();
	});
});
