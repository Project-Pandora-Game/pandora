import * as z from 'zod';

/** List of all tutorial IDs used by the client. */
export const TutorialIdSchema = z.enum([
	'tutorials',
	'room',
	'wardrobeBody',
	'wardrobePoseExpressions',
	'safemode',
	'wardrobeItems',
	'wardrobeItemsAdvanced',
	'wardrobeItemCollections',
	'roomDevices',
	'settingsProfile',
	'spaceManagement',
	'contactsDMs',
]);
export type TutorialId = z.infer<typeof TutorialIdSchema>;
