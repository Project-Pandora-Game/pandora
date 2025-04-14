/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Assert, GetLogger } from 'pandora-common';
import type { Container } from 'pixi.js';
import type { ReactNode } from 'react';
import ReactReconciler from 'react-reconciler';
import { ConcurrentRoot } from 'react-reconciler/constants.js';
import { PixiRootContainer, type PixiUpdateEmitter } from './element.ts';
import { PIXI_FIBER_HOST_CONFIG } from './reconciler-config.ts';

/** React reconciler instance with config for working with Pixi elements. */
// @ts-expect-error: No reconciler typings for React 19 are available yet.
const PixiFiber = ReactReconciler(PIXI_FIBER_HOST_CONFIG);

// Inject our fiber into devtools for both debugging and HMR support
// @ts-expect-error: No reconciler typings for React 19 are available yet.
PixiFiber.injectIntoDevTools();

/** A root handle for working with a Pixi React root. */
export type PixiRoot = {
	/**
	 * Render element into the root, replacing any existing content.
	 * @param element - The element to render
	 * @param sync - Whether to sync all the work, default `false`.
	 */
	render: (element: ReactNode, sync?: boolean) => void;
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
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const container: unknown = (PixiFiber.createContainer as any)(
		root, // container
		ConcurrentRoot, // tag
		null, // hydration callbacks
		false, // isStrictMode
		null, // concurrentUpdatesByDefaultOverride
		'', // identifierPrefix
		(...args: unknown[]) => {
			GetLogger('PixiRoot').error('Uncaught error:\n', ...args);
		}, // onUncaughtError
		(...args: unknown[]) => {
			GetLogger('PixiRoot').error('Caught error:\n', ...args);
		}, // onCaughtError
		(...args: unknown[]) => {
			GetLogger('PixiRoot').error('Caught recoverable error:\n', ...args);
		}, // onRecoverableError
		null, // transitionCallbacks
	);

	// Return a handle for the root, allowing it to be manipulated.
	return {
		render(element, sync = false) {
			if (sync) {
				// @ts-expect-error: No reconciler typings for React 19 are available yet.
				PixiFiber.updateContainerSync(element, container);
				// @ts-expect-error: No reconciler typings for React 19 are available yet.
				PixiFiber.flushSyncWork();
				// Flush any pending "passive" work
				PixiFiber.flushPassiveEffects();
			} else {
				PixiFiber.updateContainer(element, container);
			}
		},
		unmount() {
			// Clear all children of the container
			// @ts-expect-error: No reconciler typings for React 19 are available yet.
			PixiFiber.updateContainerSync(null, container);
			// @ts-expect-error: No reconciler typings for React 19 are available yet.
			PixiFiber.flushSyncWork();
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
