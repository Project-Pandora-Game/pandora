import { useCallback, useEffect, type ReactElement } from 'react';
import { Observable, useObservable } from '../../../observable.ts';
import { useAccountSettings, useCurrentAccount } from '../../../services/accountLogic/accountManagerHooks.ts';
import { TUTORIAL_TUTORIALS } from '../tutorials/tutorials.tsx';
import { ActiveTutorialUi } from './activeTutorialUi.tsx';
import type { TutorialConfig } from './tutorialConfig.ts';
import { TutorialRunner } from './tutorialRunner.ts';

export const ActiveTutorial = new Observable<null | TutorialRunner>(null);

/** Tutorial that will auto-start upon login, if it wasn't completed yet */
const AUTO_START_TUTORIAL: TutorialConfig = TUTORIAL_TUTORIALS;
let TutorialDidAutoStart = false;

export function TutorialService(): null | ReactElement {
	const activeTutorial = useObservable(ActiveTutorial);
	const account = useCurrentAccount();
	const { tutorialCompleted } = useAccountSettings();

	const stopTutorial = useCallback(() => {
		ActiveTutorial.value = null;
	}, []);

	useEffect(() => {
		if (account == null || TutorialDidAutoStart)
			return;

		TutorialDidAutoStart = true;
		if (ActiveTutorial.value == null && !tutorialCompleted.includes(AUTO_START_TUTORIAL.id)) {
			ActiveTutorial.value = ActiveTutorial.value = new TutorialRunner(AUTO_START_TUTORIAL);
		}
	}, [account, tutorialCompleted]);

	if (activeTutorial == null)
		return null;

	return (
		<ActiveTutorialUi
			tutorial={ activeTutorial }
			stopTutorial={ stopTutorial }
		/>
	);
}

