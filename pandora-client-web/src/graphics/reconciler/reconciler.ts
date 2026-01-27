/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any */
import { Assert, GetLogger } from 'pandora-common';
import type { Container } from 'pixi.js';
import type { ReactNode } from 'react';
import ReactReconciler from 'react-reconciler';
import { ConcurrentRoot } from 'react-reconciler/constants.js';
import { PixiRootContainer, type PixiInternalElementInstance, type PixiUpdateEmitter } from './element.ts';
import { PIXI_FIBER_HOST_CONFIG } from './reconciler-config.ts';

type PixiReconciler = ReactReconciler.Reconciler<
	PixiRootContainer, // Container
	PixiInternalElementInstance<Container, never, any, any>, // Instance
	never, // TextInstance
	never, // SuspenseInstance
	never, // FormInstance
	Container // PublicInstance
>;

/** React reconciler instance with config for working with Pixi elements. */
// @ts-expect-error: No reconciler typings for React 19 are available yet.
const PixiFiber: PixiReconciler = ReactReconciler(PIXI_FIBER_HOST_CONFIG);

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
	/**
	 * Flush all pending changes
	 * @returns Promise of completion
	 */
	flush: () => Promise<void>;
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
				PixiFiber.updateContainerSync(element, container);
				PixiFiber.flushSyncWork();
				// Flush any pending "passive" work
				PixiFiber.flushPassiveEffects();
			} else {
				PixiFiber.updateContainer(element, container);
			}
		},
		flush() {
			return new Promise((resolve) => {
				PixiFiber.flushSyncWork();
				// Flush any pending "passive" work
				PixiFiber.flushPassiveEffects();
				resolve();
			});
		},
		unmount() {
			// Clear all children of the container
			PixiFiber.updateContainerSync(null, container);
			PixiFiber.flushSyncWork();
			// Flush any pending "passive" work
			PixiFiber.flushPassiveEffects();
			// Cleanup any potentially forgotten instances
			const logger = GetLogger('PixiRoot');
			for (const instance of Array.from(root.instantiatedElements)) {
				logger.warning(`Cleaning up forgotten instance '${instance.type}':`, instance);
				try {
					instance.destroy();
				} catch (error) {
					logger.error('Error during forgotten instance destroy:', error);
				}
			}

			// By now everything should definitely be cleaned up
			Assert(root.instantiatedElements.size === 0);
			Assert(root.instance.children.length === 0);
		},
		updateEmitter: root.updateEmitter,
	};
}
