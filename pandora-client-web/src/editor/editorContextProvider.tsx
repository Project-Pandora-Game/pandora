import { noop } from 'lodash';
import React, { createContext, ReactElement, useContext, useEffect, useMemo, useState } from 'react';
import type { ChildrenProps } from '../common/reactTypes';
import { useDebugExpose } from '../common/useDebugExpose';
import { Dialogs } from '../components/dialog/dialog';
import { DebugContextProvider, useDebugContext } from '../components/error/debugContextProvider';
import { RootErrorBoundary } from '../components/error/rootErrorBoundary';
import { Editor } from './editor';

const editorContext = createContext({
	editor: null as Editor | null,
	setEditor: noop as (editor: Editor | null) => void,
});

export function EditorContextProvider({ children }: ChildrenProps): ReactElement {
	const [editor, setEditor] = useState<Editor | null>(null);
	const context = useMemo(() => ({
		editor,
		setEditor,
	}), [editor]);

	useDebugExpose('editor', editor);

	return (
		<DebugContextProvider>
			<EditorErrorBoundry>
				<Dialogs />
				<editorContext.Provider value={ context }>
					{ children }
				</editorContext.Provider>
			</EditorErrorBoundry>
		</DebugContextProvider>
	);
}

function EditorErrorBoundry({ children }: ChildrenProps): ReactElement {
	const context = useDebugContext();

	useEffect(() => {
		context.setDebugData({ ...context.debugData, editor: true });
	}, [context]);

	return (
		<RootErrorBoundary>
			{ children }
		</RootErrorBoundary>
	);
}

export function useMaybeEditor(): Editor | null {
	return useContext(editorContext).editor;
}

export function useEditor(): Editor {
	const editor = useMaybeEditor();
	if (!editor) {
		throw new Error('No editor available');
	}
	return editor;
}

export function useSetEditor(): (editor: Editor | null) => void {
	return useContext(editorContext).setEditor;
}
