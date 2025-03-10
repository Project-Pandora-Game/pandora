import React, { Suspense, useCallback, useState, type ReactElement } from 'react';
import { Button } from '../../components/common/button/button.tsx';
import { Column, Row } from '../../components/common/container/container.tsx';
import { FieldsetToggle } from '../../components/common/fieldsetToggle/index.tsx';
import { DraggableDialog } from '../../components/dialog/dialog.tsx';
import { useObservable } from '../../observable.ts';
import type { TutorialConfig, TutorialDisableReason } from './tutorialSystem/tutorialConfig.ts';
import { TutorialRunner } from './tutorialSystem/tutorialRunner.ts';
import { ActiveTutorial } from './tutorialSystem/tutorialService.tsx';

const PrivateRoomTutorialListContent = React.lazy(() => import('./privateTutorialsList.tsx'));

export function PrivateRoomTutorialList(): ReactElement {
	const activeTutorial = useObservable(ActiveTutorial);

	const [openDetailsTutorial, setOpenDetailsTutorial] = useState<TutorialConfig | null>(null);

	const closeTutorialDetails = useCallback(() => {
		setOpenDetailsTutorial(null);
	}, []);

	return (
		<Column className='privateSpaceTutorialsUi'>
			<Column>
				<h2 className='margin-none'>Tutorials</h2>
				<span>{ activeTutorial == null ? 'No tutorial is currently active' : `Currently active tutorial: "${activeTutorial.config.name}"` }</span>
			</Column>
			<FieldsetToggle legend='Tutorial catalogue' open={ false } persistent='tutorials-available'>
				<Suspense fallback={ <span>Loading...</span> }>
					<PrivateRoomTutorialListContent setOpenDetailsTutorial={ setOpenDetailsTutorial } />
				</Suspense>
			</FieldsetToggle>
			{
				(openDetailsTutorial != null) ? (
					<TutorialDialog
						tutorial={ openDetailsTutorial }
						close={ closeTutorialDetails }
					/>
				) : null
			}
		</Column>
	);
}

const TUTORIAL_DISABLE_REASON: Record<TutorialDisableReason, string> = {
	workInProgress: 'This tutorial is not available, as it is still under development.',
};

function TutorialDialog({ tutorial, close }: {
	tutorial: TutorialConfig;
	close: () => void;
}): ReactElement {
	const activeTutorial = useObservable(ActiveTutorial);
	const canActivate = activeTutorial == null && tutorial.disabled === undefined;

	const startTutorial = useCallback(() => {
		if (ActiveTutorial.value != null || tutorial.disabled !== undefined)
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
				{
					tutorial.disabled !== undefined ? (
						<strong>{ TUTORIAL_DISABLE_REASON[tutorial.disabled] }</strong>
					) : null
				}
				<Row alignX='end'>
					<Button
						onClick={ startTutorial }
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
