import { AssertNotNullable } from 'pandora-common';
import { Application } from 'pixi.js';
import { createContext, useContext } from 'react';

export const PixiAppContext = createContext<Application | null>(null);

export function usePixiAppOptional(): Application | null {
	return useContext(PixiAppContext);
}

export function usePixiApp(): Application {
	const app = useContext(PixiAppContext);
	AssertNotNullable(app);
	return app;
}
