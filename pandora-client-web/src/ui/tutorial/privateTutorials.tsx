import { Assert } from 'pandora-common';
import React, { useCallback, useState, type ReactElement } from 'react';
import { Button } from '../../components/common/button/button';
import { Column, Row } from '../../components/common/container/container';
import { FieldsetToggle } from '../../components/common/fieldsetToggle';
import { DraggableDialog } from '../../components/dialog/dialog';
import { useObservable } from '../../observable';
import type { TutorialConfig } from './tutorialSystem/tutorialConfig';
import { TutorialRunner } from './tutorialSystem/tutorialRunner';
import { ActiveTutorial } from './tutorialSystem/tutorialService';
import { TUTORIAL_ROOM } from './tutorials/room';
import { TUTORIAL_ROOM_DEVICES } from './tutorials/roomDevices';
import { TUTORIAL_SAFEMODE } from './tutorials/safemode';
import { TUTORIAL_SETTINGS_PROFILE } from './tutorials/settingsProfile';
import { TUTORIAL_SPACE_MANAGEMENT } from './tutorials/spaceManagement';
import { TUTORIAL_TUTORIALS } from './tutorials/tutorials';
import { TUTORIAL_WARDROBE_BODY } from './tutorials/wardrobeBody';
import { TUTORIAL_WARDROBE_ITEMS } from './tutorials/wardrobeItems';
import { TUTORIAL_WARDROBE_LOCKS_STORAGES } from './tutorials/wardrobeLocksStorages';
import { TUTORIAL_WARDROBE_POSING_EXPRESSIONS } from './tutorials/wardrobePoseExpressions';
import { TUTORIAL_WARDROBE_ROOM_INVENTORY } from './tutorials/wardrobeRoomInventory';

export const PRIVATE_TUTORIALS: TutorialConfig[] = [
	TUTORIAL_TUTORIALS,
	TUTORIAL_ROOM,
	TUTORIAL_WARDROBE_BODY,
	TUTORIAL_WARDROBE_POSING_EXPRESSIONS,
	TUTORIAL_SAFEMODE,
	TUTORIAL_WARDROBE_ITEMS,
	TUTORIAL_WARDROBE_ROOM_INVENTORY,
	TUTORIAL_WARDROBE_LOCKS_STORAGES,
	TUTORIAL_ROOM_DEVICES,
	TUTORIAL_SETTINGS_PROFILE,
	TUTORIAL_SPACE_MANAGEMENT,
	// TODO: Low priority as it is hard to show without someone else present
	// TUTORIAL_CONTACTS_DMS,
	// TODO: Consider advanced permissions tutorial
];
Assert(new Set(PRIVATE_TUTORIALS.map((t) => t.id)).size === PRIVATE_TUTORIALS.length, 'Private tutorials need to have a unique id');

export function PrivateRoomTutorialList(): ReactElement {
	const activeTutorial = useObservable(ActiveTutorial);

	return (
		<Column>
			<Column>
				<h2 className='margin-none'>Tutorials</h2>
				<span>{ activeTutorial == null ? 'No tutorial is currently active' : `Currently active tutorial: "${activeTutorial.config.name}"` }</span>
			</Column>
			<FieldsetToggle legend='Available tutorials' open={ false } persistent='tutorials-available'>
				<Column>
					{
						PRIVATE_TUTORIALS.map((t) => (<TutorialEntry key={ t.id } tutorial={ t } />))
					}
				</Column>
			</FieldsetToggle>
		</Column>
	);
}

function TutorialEntry({ tutorial }: {
	tutorial: TutorialConfig;
}): ReactElement {
	const activeTutorial = useObservable(ActiveTutorial);
	const [dialogOpen, setDialogOpen] = useState(false);

	return (
		<Row alignY='center'>
			<a onClick={ () => {
				setDialogOpen((s) => !s);
			} }>
				{ tutorial.name }
			</a>
			{
				activeTutorial?.config.id === tutorial.id ? (
					<strong>[Currently active]</strong>
				) : null
			}
			{
				dialogOpen ? (
					<TutorialDialog
						tutorial={ tutorial }
						close={ () => {
							setDialogOpen(false);
						} }
					/>
				) : null
			}
		</Row>
	);
}

function TutorialDialog({ tutorial, close }: {
	tutorial: TutorialConfig;
	close: () => void;
}): ReactElement {
	const activeTutorial = useObservable(ActiveTutorial);
	const canActivate = activeTutorial == null;

	const startTutorial = useCallback(() => {
		if (ActiveTutorial.value != null)
			return;

		close();
		ActiveTutorial.value = new TutorialRunner(tutorial);
	}, [tutorial, close]);

	return (
		<DraggableDialog title={ `"${tutorial.name}" tutorial details` } className='tutorialDialogContainer' close={ close }>
			<Column className='tutorialDialog'>
				{
					typeof tutorial.description === 'string' ? (
						<p>{ tutorial.description }</p>
					) : tutorial.description
				}
				<Row alignX='end'>
					<Button
						onClick={ startTutorial }
						className='fadeDisabled'
						disabled={ !canActivate }
						slim
					>
						Start
					</Button>
				</Row>
			</Column>
		</DraggableDialog>
	);
}
