import type { SpaceFeature } from 'pandora-common';
import bodyChange from '../../../icons/body-change.svg';
import devMode from '../../../icons/developer.svg';

export const SPACE_DESCRIPTION_TEXTBOX_SIZE = 16;

export const SPACE_FEATURES: { id: SpaceFeature; name: string; icon: string; }[] = [
	{
		id: 'allowBodyChanges',
		name: 'Allow changes to character bodies',
		icon: bodyChange,
	},
	{
		id: 'development',
		name: 'Development mode',
		icon: devMode,
	},
];
