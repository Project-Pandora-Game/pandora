import { useCallback, useSyncExternalStore } from 'react';
import type { GraphicsSettings } from '../../graphics/graphicsSettings.tsx';
import { useService } from '../serviceProvider.tsx';

export function useAutomaticResolution(): Exclude<GraphicsSettings['textureResolution'], 'auto'> {
	const service = useService('screenResolution');
	return useSyncExternalStore(
		useCallback((change) => service.on('automaticResolutionChanged', change), [service]),
		useCallback(() => service.automaticTextureResolution, [service]),
	);
}

export function useDevicePixelRatio(): number {
	const service = useService('screenResolution');
	return useSyncExternalStore(
		useCallback((change) => service.on('devicePixelRatioChanged', change), [service]),
		useCallback(() => service.devicePixelRatio, [service]),
	);
}
