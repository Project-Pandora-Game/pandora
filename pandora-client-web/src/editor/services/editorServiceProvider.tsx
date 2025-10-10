import { AssertNotNullable, type ServiceProvider } from 'pandora-common';
import { createContext, useContext, type ReactElement } from 'react';
import { GraphicsManagerInstance } from '../../assets/graphicsManager.ts';
import type { ChildrenProps } from '../../common/reactTypes.ts';
import { useDebugExpose } from '../../common/useDebugExpose.ts';
import { UseTextureGetterOverride } from '../../graphics/useTexture.ts';
import { useObservable } from '../../observable.ts';
import { ServiceManagerContextProvider } from '../../services/serviceProvider.tsx';
import { EditorAssetGraphicsManager } from '../assets/editorAssetGraphicsManager.ts';
import { EditorAssetUpdateService } from '../assets/editorAssetUpdater.tsx';
import type { EditorServices } from './editorServices.ts';

export const EditorServiceManagerContext = createContext<ServiceProvider<EditorServices> | undefined>(undefined);

export interface EditorServiceManagerContextProviderProps extends ChildrenProps {
	serviceManager: ServiceProvider<EditorServices>;
}

export function EditorServiceManagerContextProvider({ children, serviceManager }: EditorServiceManagerContextProviderProps): ReactElement | null {
	const editorService = serviceManager.services.editor;
	AssertNotNullable(editorService);

	const editor = useObservable(editorService.editor);
	useDebugExpose('editor', editor);

	const textureGetterOverride = useObservable(EditorAssetGraphicsManager.builtTexturesGetter);
	useDebugExpose('EditorAssetGraphicsManager', EditorAssetGraphicsManager);
	useDebugExpose('GraphicsManagerInstance', GraphicsManagerInstance);

	return (
		<EditorServiceManagerContext.Provider value={ serviceManager }>
			<ServiceManagerContextProvider serviceManager={ serviceManager }>
				<UseTextureGetterOverride.Provider value={ textureGetterOverride }>
					{
						editor != null ? (
							<EditorAssetUpdateService />
						) : null
					}
					{ children }
				</UseTextureGetterOverride.Provider>
			</ServiceManagerContextProvider>
		</EditorServiceManagerContext.Provider>
	);
}

/**
 * Get access to the client service manager.
 * @note If possible you should prefer using `useService` or `useServiceOptional`.
 */
export function useEditorServiceManager(): ServiceProvider<EditorServices> {
	const serviceManager = useContext(EditorServiceManagerContext);
	if (serviceManager == null) {
		throw new Error('Attempt to access ServiceManager outside of context');
	}
	return serviceManager;
}

/**
 * Get a specific service from the service manager. The service might or might not be registered.
 * @param serviceName - The service to get
 */
export function useEditorServiceOptional<const TService extends (keyof EditorServices & string)>(serviceName: TService): EditorServices[TService] | null {
	const serviceManager = useEditorServiceManager();
	const service = serviceManager?.services[serviceName];
	return service ?? null;
}

/**
 * Get a specific service from the service manager. Errors if the service is not ready.
 * @param serviceName - The service to get
 */
export function useEditorService<const TService extends (keyof EditorServices & string)>(serviceName: TService): EditorServices[TService] {
	const service = useEditorServiceOptional(serviceName);
	if (service == null) {
		throw new Error(`Attempt to access non-registered service '${serviceName}'`);
	}
	return service;
}
