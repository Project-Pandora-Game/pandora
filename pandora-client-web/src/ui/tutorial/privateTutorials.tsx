import { Assert } from 'pandora-common';
import React, { useCallback, type ReactElement } from 'react';
import { Button } from '../../components/common/button/button';
import { Column, Row } from '../../components/common/container/container';
import { FieldsetToggle } from '../../components/common/fieldsetToggle';
import { useObservable } from '../../observable';
import type { TutorialConfig } from './tutorialSystem/tutorialConfig';
import { TutorialRunner } from './tutorialSystem/tutorialRunner';
import { ActiveTutorial } from './tutorialSystem/tutorialService';
import { TUTORIAL_RANDOMIZE_APPEARANCE } from './tutorials/randomizeAppearance';

export const PRIVATE_TUTORIALS: TutorialConfig[] = [
	TUTORIAL_RANDOMIZE_APPEARANCE,
];
Assert(new Set(PRIVATE_TUTORIALS.map((t) => t.id)).size === PRIVATE_TUTORIALS.length, 'Private tutorials need to have a unique id');

export function PrivateRoomTutorialList(): ReactElement {
	const activeTutorial = useObservable(ActiveTutorial);

	return (
		<FieldsetToggle legend='Tutorials'>
			<Column>
				<Column>
					<h2 className='margin-none'>Active tutorial</h2>
					<span>{ activeTutorial == null ? 'None' : activeTutorial.config.name }</span>
				</Column>
				<Column>
					<h2 className='margin-none'>Available tutorials</h2>
					{
						PRIVATE_TUTORIALS.map((t) => (<TutorialEntry key={ t.id } tutorial={ t } />))
					}
				</Column>
			</Column>
		</FieldsetToggle>
	);
}

function TutorialEntry({ tutorial }: {
	tutorial: TutorialConfig;
}): ReactElement {
	const activeTutorial = useObservable(ActiveTutorial);

	const startTutorial = useCallback(() => {
		if (ActiveTutorial.value != null)
			return;

		ActiveTutorial.value = new TutorialRunner(tutorial);
	}, [tutorial]);

	return (
		<Row alignY='center'>
			<span>{ tutorial.name }</span>
			{
				activeTutorial?.config.id === tutorial.id ? (
					<strong>[Currently active]</strong>
				) : (
					<Button
						onClick={ startTutorial }
						className='fadeDisabled'
						disabled={ activeTutorial != null }
						slim
					>
						Start
					</Button>
				)
			}
		</Row>
	);
}
