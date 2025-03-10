import type { Immutable } from 'immer';
import { useEffect } from 'react';
import { useObservable } from '../../../observable.ts';
import type { IRoomContextMenuFocus, IRoomSceneMode } from '../../screens/room/roomContext.tsx';
import { ActiveTutorial } from './tutorialService.tsx';

export interface TutorialFlags {
	roomSceneMode: Immutable<IRoomSceneMode>;
	roomSceneContextMenuFocus: Readonly<IRoomContextMenuFocus> | null;
}

export type TutorialFlagInfo<TFlag extends keyof TutorialFlags = keyof TutorialFlags> = {
	[Flag in TFlag]: {
		readonly flag: Flag;
		readonly value: TutorialFlags[Flag];
	};
}[TFlag];

export function useProvideTutorialFlag<const TFlag extends keyof TutorialFlags>(flag: TFlag, value: TutorialFlags[TFlag]): void {
	const activeTutorial = useObservable(ActiveTutorial);

	useEffect(function () {
		if (activeTutorial == null)
			return;

		const flagInfo: TutorialFlagInfo<TFlag> = {
			flag,
			value,
		};
		activeTutorial.externalTutorialFlags.add(flagInfo as TutorialFlagInfo);

		return function () {
			activeTutorial.externalTutorialFlags.delete(flagInfo as TutorialFlagInfo);
		};
	}, [activeTutorial, flag, value]);
}
