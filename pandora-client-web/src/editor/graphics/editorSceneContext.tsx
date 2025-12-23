import { AssertNotNullable } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { createContext, useContext, type RefObject } from 'react';

export type EditorSceneContext = {
	contentRef: RefObject<PIXI.Container | null>;
	appRef: RefObject<PIXI.Application | null>;
};

export const EditorSceneContext = createContext<EditorSceneContext | null>(null);

export function useEditorSceneContext(): EditorSceneContext {
	const context = useContext(EditorSceneContext);
	AssertNotNullable(context);
	return context;
}
