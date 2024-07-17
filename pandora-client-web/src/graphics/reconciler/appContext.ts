import { AssertNotNullable } from 'pandora-common';
import { Application } from 'pixi.js';
import { createContext, useContext } from 'react';

/** Context containing Pixi application that is currently being used for rendering. */
export const PixiAppContext = createContext<Application | null>(null);

/**
 * Get the Pixi app of the current Pixi context.
 *
 * Note, that this method might return `null` if there is none - for example if using a background renderer.
 * @returns The application rendering the current context or `null` if the tree cannot depend on a specific renderer.
 */
export function usePixiAppOptional(): Application | null {
	return useContext(PixiAppContext);
}

/**
 * Get the Pixi app of the current Pixi context.
 *
 * Note, that this method assumes there always is an application - this makes it impossible to use this component inside a background renderer!
 * @returns The application rendering the current context.
 */
export function usePixiApp(): Application {
	const app = useContext(PixiAppContext);
	AssertNotNullable(app);
	return app;
}
