import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { RunUpdatesCommand } from '../src/updateAnnouncements.ts';

afterEach(() => {
	jest.restoreAllMocks();
});

describe('updates CLI', () => {
	it('shows help without connecting to GitHub or a Pandora server', async () => {
		const output = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
		const fetch = jest.spyOn(globalThis, 'fetch');
		await expect(RunUpdatesCommand(['--help'])).resolves.toBe(true);
		expect(output).toHaveBeenCalledWith(expect.stringContaining('--main-base REF'));
		expect(fetch).not.toHaveBeenCalled();
	});

	it('rejects unknown flags, output formats and ping names before network access', async () => {
		const fetch = jest.spyOn(globalThis, 'fetch');
		await expect(RunUpdatesCommand(['--unknown'])).rejects.toThrow();
		await expect(RunUpdatesCommand(['--format', 'unknown'])).rejects.toThrow('Format must be');
		await expect(RunUpdatesCommand(['--pings', 'everyone'])).rejects.toThrow('Unknown ping');
		expect(fetch).not.toHaveBeenCalled();
	});
});
