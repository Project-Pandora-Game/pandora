import { noop } from 'lodash-es';
import { AssetFrameworkGlobalState, type ServiceManager } from 'pandora-common';
import { createContext, ReactElement, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AnchorAutoscroll } from '../common/anchorAutoscroll.tsx';
import type { ChildrenProps } from '../common/reactTypes.ts';
import { useDebugExpose } from '../common/useDebugExpose.ts';
import { Dialogs } from '../components/dialog/dialog.tsx';
import { DebugContextProvider, useDebugContext } from '../components/error/debugContextProvider.tsx';
import { RootErrorBoundary } from '../components/error/rootErrorBoundary.tsx';
import { permissionCheckContext, PermissionCheckServiceBase } from '../components/gameContext/permissionCheckProvider.tsx';
import type { ClientServices } from '../services/clientServices.ts';
import { ServiceManagerContextProvider } from '../services/serviceProvider.tsx';
import { Editor } from './editor.tsx';

export const EditorContext = createContext({
	editor: null as Editor | null,
	setEditor: noop as (editor: Editor | null) => void,
});

export interface EditorContextProviderProps extends ChildrenProps {
	serviceManager: ServiceManager<ClientServices>;
}

export function EditorContextProvider({ children, serviceManager }: EditorContextProviderProps): ReactElement {
	const [editor, setEditor] = useState<Editor | null>(null);
	const context = useMemo(() => ({
		editor,
		setEditor,
	}), [editor]);

	useDebugExpose('editor', editor);

	return (
		<DebugContextProvider>
			<EditorErrorBoundary>
				<ServiceManagerContextProvider serviceManager={ serviceManager }>
					<Dialogs location='global' />
					<Dialogs location='mainOverlay' />
					<AnchorAutoscroll />
					<EditorContext.Provider value={ context }>
						<PermissionCheckServiceProvider>
							{ children }
						</PermissionCheckServiceProvider>
					</EditorContext.Provider>
				</ServiceManagerContextProvider>
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
