import { describe, expect, it } from '@jest/globals';
import * as z from 'zod';

describe('Zod platform typings', () => {

	it('preserves the native URL type when the environment provides it', () => {
		const parsed = z.core.parseURLObject('https://example.com/path', {});
		if (typeof parsed === 'number') {
			throw new Error('Expected a parsed URL');
		}
		// This assignment also checks the declaration patch against Node's full URL type.
		const url: URL = parsed;
		expect(url.href).toBe('https://example.com/path');
	});

});
