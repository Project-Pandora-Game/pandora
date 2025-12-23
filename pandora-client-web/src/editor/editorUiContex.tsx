import { noop } from 'lodash-es';
import { createContext, useContext } from 'react';
import './editor.scss';
import type { EditorTabName } from './editorUi.tsx';

export interface EditorCurrentTabContext {
	activeTabs: readonly EditorTabName[];
	setTab(tab: EditorTabName): void;
	closeTab(): void;
}

export const EditorCurrentTabContext = createContext<EditorCurrentTabContext>({
	activeTabs: [],
	setTab: noop,
	closeTab: noop,
});

export function useEditorTabContext(): EditorCurrentTabContext {
	return useContext(EditorCurrentTabContext);
}
