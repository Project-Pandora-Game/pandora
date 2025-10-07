import { AssetFrameworkGlobalState, type ServiceProvider } from 'pandora-common';
import { ReactElement, useEffect, useMemo, useSyncExternalStore } from 'react';
import { AnchorAutoscroll } from '../common/anchorAutoscroll.tsx';
import type { ChildrenProps } from '../common/reactTypes.ts';
import { Dialogs } from '../components/dialog/dialog.tsx';
import { DebugContextProvider, useDebugContext } from '../components/error/debugContextProvider.tsx';
import { RootErrorBoundary } from '../components/error/rootErrorBoundary.tsx';
import { InterfaceSettingsProvider } from '../components/gameContext/interfaceSettingsProvider.tsx';
import { permissionCheckContext, PermissionCheckServiceBase } from '../components/gameContext/permissionCheckProvider.tsx';
import { useNullableObservable } from '../observable.ts';
import { Editor } from './editor.tsx';
import { EditorServiceManagerContextProvider, useEditorServiceOptional } from './services/editorServiceProvider.tsx';
import type { EditorServices } from './services/editorServices.ts';

export interface EditorContextProviderProps extends ChildrenProps {
	serviceManager: ServiceProvider<EditorServices>;
}

export function EditorContextProvider({ children, serviceManager }: EditorContextProviderProps): ReactElement {
	return (
		<DebugContextProvider>
			<EditorErrorBoundary>
				<EditorServiceManagerContextProvider serviceManager={ serviceManager }>
					<Dialogs location='global' />
					<Dialogs location='mainOverlay' />
					<AnchorAutoscroll />
					<InterfaceSettingsProvider />
					<PermissionCheckServiceProvider>
						{ children }
					</PermissionCheckServiceProvider>
				</EditorServiceManagerContextProvider>
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
	const editorService = useEditorServiceOptional('editor');
	return useNullableObservable(editorService?.editor) ?? null;
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
