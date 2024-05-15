import React, { useCallback, type ReactElement } from 'react';
import { Observable, useObservable } from '../../../observable';
import { ActiveTutorialUi } from './activeTutorialUi';
import type { TutorialRunner } from './tutorialRunner';

export const ActiveTutorial = new Observable<null | TutorialRunner>(null);

export function TutorialService(): null | ReactElement {
	const activeTutorial = useObservable(ActiveTutorial);

	const stopTutorial = useCallback(() => {
		ActiveTutorial.value = null;
	}, []);

	if (activeTutorial == null)
		return null;

	return (
		<ActiveTutorialUi
			tutorial={ activeTutorial }
			stopTutorial={ stopTutorial }
		/>
	);
}

