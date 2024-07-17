import { Assert, GetLogger } from 'pandora-common';
import type { Container } from 'pixi.js';
import type { ReactNode } from 'react';
import ReactReconciler from 'react-reconciler';
import { ConcurrentRoot } from 'react-reconciler/constants';
import { GAME_VERSION, NODE_ENV } from '../../config/Environment';
import { PixiRootContainer, type PixiUpdateEmitter } from './element';
import { PIXI_FIBER_HOST_CONFIG } from './reconciler-config';

/** React reconciler instance with config for working with Pixi elements. */
export const PixiFiber = ReactReconciler(PIXI_FIBER_HOST_CONFIG);

// Inject our fiber into devtools for both debugging and HMR support
PixiFiber.injectIntoDevTools({
	bundleType: NODE_ENV === 'production' ? 0 : 1,
	version: GAME_VERSION ?? '[unknown]',
	rendererPackageName: 'pandora-client-web/pixi-renderer',
});

/** A root handle for working with a Pixi React root. */
export type PixiRoot = {
	/** Render element into the root, replacing any existing content. */
	render: (element: ReactNode) => void;
	/** Unmount the root - removing all elements and performing any necessary cleanup. */
	unmount: () => void;
	/** Emitter used for delivering update events for lazy rendering. */
	updateEmitter: PixiUpdateEmitter;
};

/**
 * Create a rendered on top of a PIXI Container, ready to render react content.
 * @param rootContainer - Container to create the root on; the container must be empty.
 * @returns A handle for the newly created root.
 */
export function CreatePixiRoot(rootContainer: Container): PixiRoot {
	Assert(rootContainer.children.length === 0, 'Cannot create PixiRoot on a container that already has children. React must manage all the children itself.');
	// Wrap the root
	const root = new PixiRootContainer(rootContainer);

	// Create a React container for the root
	const container: unknown = PixiFiber.createContainer(
		root,
		ConcurrentRoot,
		null,
		true,
		null,
		'',
		(error) => {
			GetLogger('PixiRoot').error('Caught recoverable error:\n', error);
		},
		null,
	);

	// Return a handle for the root, allowing it to be manipulated.
	return {
		render(element) {
			PixiFiber.updateContainer(element, container);
		},
		unmount() {
			// Clear all children of the container
			PixiFiber.flushSync(() => {
				PixiFiber.updateContainer(null, container);
			});
			// Flush any pending "passive" work
			PixiFiber.flushPassiveEffects();
			// Cleanup any potentially forgotten instances
			const logger = GetLogger('PixiRoot');
			for (const instance of Array.from(root.instantiatedElements)) {
				logger.warning(`Cleaning up forgotten instance '${instance.type}':`, instance);
				instance.destroy();
			}

			// By now everything should definitely be cleaned up
			Assert(root.instantiatedElements.size === 0);
			Assert(root.instance.children.length === 0);
		},
		updateEmitter: root.updateEmitter,
	};
}
