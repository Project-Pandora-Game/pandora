import { useEffect, useRef, type ReactElement } from 'react';
import { useNullableObservable } from '../../../observable.ts';
import { PersistentToast } from '../../../persistentToast.ts';
import { useGameStateOptional } from '../gameStateHooks.ts';

export function SpaceBotOverlayProvider(): ReactElement | null {
	const gameState = useGameStateOptional();
	const spaceBotState = useNullableObservable(gameState?.botState);

	// Show a toast if the bot is not connected
	const persistentToastRef = useRef<PersistentToast>(null);
	if (persistentToastRef.current == null)
		persistentToastRef.current = new PersistentToast();
	const persistentToast = persistentToastRef.current;

	const spaceBotConnected = spaceBotState?.connected ?? null;

	useEffect(() => {
		// If there is no bot or it is connected, show no warning
		if (spaceBotConnected == null || spaceBotConnected) {
			persistentToast.hide();
			return;
		}

		// Otherwise display warning
		persistentToast.show(
			'warning',
			`This space's bot is offline`,
			{ autoClose: false },
		);
		return () => {
			persistentToast.hide();
		};
	}, [persistentToast, spaceBotConnected]);

	return null;
}
