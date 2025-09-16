import { Assert } from 'pandora-common';
import React, { type ReactElement } from 'react';
import { Column, Row } from '../../components/common/container/container.tsx';
import { useObservable } from '../../observable.ts';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks.ts';
import { TUTORIAL_CHARACTER_MODIFIERS } from './tutorials/character_modifiers.tsx';
import { TUTORIAL_PERMISSIONS } from './tutorials/permissions.tsx';
import { TUTORIAL_ROOM } from './tutorials/room.tsx';
import { TUTORIAL_ROOM_DEVICES } from './tutorials/roomDevices.tsx';
import { TUTORIAL_SAFEMODE } from './tutorials/safemode.tsx';
import { TUTORIAL_SETTINGS_PROFILE } from './tutorials/settingsProfile.tsx';
import { TUTORIAL_SPACE_MANAGEMENT } from './tutorials/spaceManagement.tsx';
import { TUTORIAL_TUTORIALS } from './tutorials/tutorials.tsx';
import { TUTORIAL_WARDROBE_BODY } from './tutorials/wardrobeBody.tsx';
import { TUTORIAL_WARDROBE_ITEMS } from './tutorials/wardrobeItems.tsx';
import { TUTORIAL_WARDROBE_POSING_EXPRESSIONS } from './tutorials/wardrobePoseExpressions.tsx';
import { TUTORIAL_WARDROBE_ITEMS_ADVANCED } from './tutorials/wardrobeItemsAdvanced.tsx';
import { TUTORIAL_WARDROBE_ITEM_COLLECTIONS } from './tutorials/wardrobeItemCollections.tsx';
import type { TutorialConfig, TutorialDisableReason } from './tutorialSystem/tutorialConfig.ts';
import { ActiveTutorial } from './tutorialSystem/tutorialService.tsx';

export const PRIVATE_TUTORIALS: TutorialConfig[] = [
	TUTORIAL_TUTORIALS,
	TUTORIAL_ROOM,
	TUTORIAL_WARDROBE_BODY,
	TUTORIAL_WARDROBE_POSING_EXPRESSIONS,
	TUTORIAL_SAFEMODE,
	TUTORIAL_WARDROBE_ITEMS,
	TUTORIAL_WARDROBE_ITEMS_ADVANCED,
	TUTORIAL_PERMISSIONS,
	TUTORIAL_CHARACTER_MODIFIERS,
	TUTORIAL_WARDROBE_ITEM_COLLECTIONS,
	TUTORIAL_SPACE_MANAGEMENT,
	TUTORIAL_ROOM_DEVICES,
	TUTORIAL_SETTINGS_PROFILE,
	// TODO: Low priority as it is hard to show without someone else present
	// TUTORIAL_CONTACTS_DMS,
];
Assert(new Set(PRIVATE_TUTORIALS.map((t) => t.id)).size === PRIVATE_TUTORIALS.length, 'Private tutorials need to have a unique id');

export default function PrivateRoomTutorialListContent({ setOpenDetailsTutorial }: {
	setOpenDetailsTutorial: React.Dispatch<React.SetStateAction<TutorialConfig | null>>;
}): ReactElement {
	return (
		<Column>
			{
				PRIVATE_TUTORIALS.map((t) => (
					<TutorialEntry key={ t.id }
						tutorial={ t }
						openTutorialDetails={ () => {
							// Close the current one, if user clicks it again (toggle)
							setOpenDetailsTutorial((v) => t === v ? null : t);
						} }
					/>
				))
			}
		</Column>
	);
}

const TUTORIAL_DISABLE_REASON_QUICKTEXT: Record<TutorialDisableReason, string> = {
	workInProgress: 'Coming soon',
};

function TutorialEntry({ tutorial, openTutorialDetails }: {
	tutorial: TutorialConfig;
	openTutorialDetails: () => void;
}): ReactElement {
	const { tutorialCompleted } = useAccountSettings();
	const activeTutorial = useObservable(ActiveTutorial);

	return (
		<Row alignY='center'>
			{
				tutorial.disabled !== undefined ? (
					<span>[{ TUTORIAL_DISABLE_REASON_QUICKTEXT[tutorial.disabled] }]</span>
				) : tutorialCompleted.includes(tutorial.id) ? (
					<span>[Completed]</span>
				) : null
			}
			{
				activeTutorial?.config.id === tutorial.id ? (
					<strong>[Currently active]</strong>
				) : null
			}
			{
				<a onClick={ openTutorialDetails }>
					{ tutorial.name }
				</a>
			}
		</Row>
	);
}

