import { GetLogger } from 'pandora-common';
import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { URLGraphicsLoader } from '../../assets/graphicsLoader.ts';
import { GraphicsManagerInstance, type IGraphicsLoader } from '../../assets/graphicsManager.ts';
import { useMounted } from '../../common/useMounted.ts';
import { useObservable } from '../../observable.ts';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_INFO } from '../../persistentToast.ts';
import { EditorLoadedVersionHash, LoadEditorAssets } from '../assetLoader.ts';

// How often to check for updates, if accessing remote server
const VERSION_CHECK_INTERVAL_REMOTE = 30_000;
// How often to check for updates, if accessing localhost
const VERSION_CHECK_INTERVAL_LOCAL = 1_000;

export function EditorAssetUpdateService() {
	const mounted = useMounted();

	const graphicsManager = useObservable(GraphicsManagerInstance);
	const graphicsManagerLoader = graphicsManager?.loader;

	const updateInProgress = useRef(false);

	const triggerUpdate = useCallback((versionHash: string) => {
		if (updateInProgress.current || graphicsManagerLoader == null)
			return;

		updateInProgress.current = true;
		LoadEditorAssets(graphicsManagerLoader, versionHash)
			.finally(() => {
				updateInProgress.current = false;
			})
			.then(() => {
				toast('Loaded updated asset definitions', TOAST_OPTIONS_INFO);
			}, (err) => {
				GetLogger('EditorAssetUpdateService').error('Error loading asset updates:', err);
				toast('Error loading asset updates', TOAST_OPTIONS_ERROR);
			});
	}, [graphicsManagerLoader]);

	useEffect(() => {
		if (graphicsManagerLoader == null || !(graphicsManagerLoader instanceof URLGraphicsLoader))
			return;

		let isLocalhost: boolean;
		try {
			const prefixUrl = new URL(graphicsManagerLoader.prefix);
			isLocalhost = prefixUrl.hostname === 'localhost' || prefixUrl.hostname === '127.0.0.1';
		} catch (error) {
			GetLogger('EditorAssetUpdateService').error('Error loading source URL:', error);
			return;
		}

		const interval = setInterval(() => {
			GetCurrentVersion(graphicsManagerLoader)
				.then((version) => {
					if (mounted && version !== EditorLoadedVersionHash) {
						triggerUpdate(version);
					}
				})
				.catch(() => { /** noop */ });
		}, isLocalhost ? VERSION_CHECK_INTERVAL_LOCAL : VERSION_CHECK_INTERVAL_REMOTE);
		return () => clearInterval(interval);
	}, [mounted, graphicsManagerLoader, triggerUpdate]);

	return null;
}

async function GetCurrentVersion(loader: IGraphicsLoader): Promise<string> {
	let hash: string;
	try {
		hash = (await loader.loadTextFile('current')).trim();
	} catch (_error) {
		throw new Error('Failed to get the assets version.');
	}
	return hash;
}
