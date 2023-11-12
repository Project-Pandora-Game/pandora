import { noop } from 'lodash';
import React, { createContext, ReactElement, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ChildrenProps } from '../common/reactTypes';
import { useDebugExpose } from '../common/useDebugExpose';
import { Dialogs } from '../components/dialog/dialog';
import { DebugContextProvider, useDebugContext } from '../components/error/debugContextProvider';
import { RootErrorBoundary } from '../components/error/rootErrorBoundary';
import { Editor } from './editor';
import { AssetFrameworkGlobalState } from 'pandora-common';
import { HoverElementsPortal } from '../components/hoverElement/hoverElement';
import { permissionCheckContext, PermissionCheckServiceBase } from '../components/gameContext/permissionCheckProvider';

export const EditorContext = createContext({
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
			<EditorErrorBoundary>
				<Dialogs location='global' />
				<Dialogs location='mainOverlay' />
				<HoverElementsPortal />
				<EditorContext.Provider value={ context }>
					<PermissionCheckServiceProvider>
						{ children }
					</PermissionCheckServiceProvider>
				</EditorContext.Provider>
			</EditorErrorBoundary>
		</DebugContextProvider>
	);
}

function PermissionCheckServiceProvider({ children }: ChildrenProps) {
	const service = useMemo(() => new PermissionCheckServiceBase(), []);
	return (
		<permissionCheckContext.Provider value={ service }>
			{ children }
		</permissionCheckContext.Provider>
	);
}

function EditorErrorBoundary({ children }: ChildrenProps): ReactElement {
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
	return useContext(EditorContext).editor;
}

export function useEditor(): Editor {
	const editor = useMaybeEditor();
	if (!editor) {
		throw new Error('No editor available');
	}
	return editor;
}

export function useEditorState(): AssetFrameworkGlobalState {
	const editor = useEditor();

	return useSyncExternalStore((onChange) => {
		return editor.on('globalStateChange', () => {
			onChange();
		});
	}, () => editor.globalState.currentState);
}

export function useSetEditor(): (editor: Editor | null) => void {
	return useContext(EditorContext).setEditor;
}
