import { Assert } from './misc.ts';

/**
 * Takes two normalized path strings (`a/b/c.ext`) and sorts them in a user-friendly way
 */
export function SortPathStrings(a: string, b: string): number {
	const aSegments = a.split('/');
	const aBasename = aSegments.pop();

	const bSegments = b.split('/');
	const bBasename = bSegments.pop();

	Assert(aBasename !== undefined && bBasename !== undefined);

	// Compare folder names
	for (let i = 0; i < Math.min(aSegments.length, bSegments.length); i++) {
		const r = aSegments[i].localeCompare(bSegments[i]);
		if (r !== 0)
			return r;
	}

	// Folders get sorted first
	if (aSegments.length !== bSegments.length) {
		return Math.sign(bSegments.length - aSegments.length);
	}

	// Files within folder get compared last
	return aBasename.localeCompare(bBasename);
}
