/* eslint-disable @typescript-eslint/naming-convention */
import { Assert } from 'pandora-common';
import type { Container as PixiContainer } from 'pixi.js';
import { createContext } from 'react';
import type ReactReconciler from 'react-reconciler';
import type { Lane } from 'react-reconciler';
import { DefaultEventPriority } from 'react-reconciler/constants.js';
import { GIT_COMMIT_HASH } from '../../config/Environment.ts';
import { PIXI_REGISTERED_COMPONENTS } from './component.ts';
import { PixiInternalElementInstance, type PixiRootContainer } from './element.ts';

// This file extensively ignores types. This is done because react-reconciler typings don't support mapping Props per specific type.
// We depend on things being declarated using `RegisterPixiComponent` to keep things type-safe.
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */

// React's Reconciler is seriously lacking on documentation
// https://github.com/facebook/react/issues/28956
// Currently partially reusing: https://github.com/pmndrs/react-three-fiber/blob/v9/packages/fiber/src/core/reconciler.tsx
// @ f7b56b06b36c65f7ae2bbfc5e487501b69fe5232

type React19HostConfig<
	Type,
	Props,
	Container,
	Instance,
	TextInstance,
	SuspenseInstance,
	HydratableInstance,
	FormInstance,
	PublicInstance,
	HostContext,
	ChildSet,
	TimeoutHandle,
	NoTimeout,
	TransitionStatus,
> = (Omit<
	ReactReconciler.HostConfig<
		Type,
		Props,
		Container,
		Instance,
		TextInstance,
		SuspenseInstance,
		HydratableInstance,
		FormInstance,
		PublicInstance,
		HostContext,
		ChildSet,
		TimeoutHandle,
		NoTimeout,
		TransitionStatus
	>,
	'HostTransitionContext'
> & {
	// Fix typing of React.Context
	HostTransitionContext: React.Context<TransitionStatus>;

	// Extras from Pandora's research
	rendererPackageName: string;
	rendererVersion: string;
	extraDevToolsConfig: unknown;
});

export type PixiHostConfig = React19HostConfig<
	string, // Type
	any, // Props
	PixiRootContainer, // Container
	PixiInternalElementInstance<PixiContainer, never, any, any>, // Instance
	never, // TextInstance
	never, // SuspenseInstance
	never, // HydratableInstance
	never, // FormInstance
	PixiContainer, // PublicInstance
	Record<string, never>, // HostContext
	never, // ChildSet
	number, // TimeoutHandle
	-1, // NoTimeout
	null // TransitionStatus
>;

const NO_CONTEXT: Record<string, never> = {};

let CurrentUpdatePriority: Lane = 0;

function MakeUnsupportedShim(reason: string): () => never {
	return function () {
		throw new Error(reason);
	};
}

export const PIXI_FIBER_HOST_CONFIG: PixiHostConfig = {
	// Debug tools info
	rendererVersion: '1.0.0+' + GIT_COMMIT_HASH,
	rendererPackageName: 'pandora-client-web/pixi-renderer',
	extraDevToolsConfig: null,

	//#region Basics

	getPublicInstance(instance) {
		// Return what should be used as `ref` of the component.
		return instance.instance;
	},
	// Context
	// Used for keeping data where in the tree we are.
	// We don't use this feature, as none of our elements are context-dependant.
	getRootHostContext() {
		return NO_CONTEXT;
	},
	getChildHostContext() {
		return NO_CONTEXT;
	},

	prepareForCommit(_containerInfo) {
		// Called right before all updates are applied
		return null; // We don't need to do anything around commit
	},
	resetAfterCommit(_containerInfo) {
		// Called right after all updates are applied
		// We don't need to do anything around commit
	},
	createInstance(type, props, rootContainer, _hostContext, _internalHandle) {
		// When react requests creation of a new element instance
		const componentConfig = PIXI_REGISTERED_COMPONENTS.get(type);
		Assert(componentConfig != null, `Unknown component '${type}'`);

		return new PixiInternalElementInstance(type, componentConfig, props, rootContainer);
	},
	appendInitialChild(parentInstance, child) {
		// Appends a child to a freshly created instance (only used before finalizeInitialChildren)
		parentInstance.addChild(child.instance);
		parentInstance.emitNeedsUpdate();
	},
	finalizeInitialChildren(_instance, _type, _props, _rootContainer, _hostContext) {
		// Called right after `createInstance` and all `appendInitialChild` calls - marking the instance ready
		return false; // No work scheduled on mount
	},
	shouldSetTextContent(_type, _props) {
		return false;
	},
	createTextInstance: MakeUnsupportedShim('Text nodes are not supported'),

	scheduleTimeout: setTimeout,
	cancelTimeout: clearTimeout,
	noTimeout: -1, // Value that can never be returned by `scheduleTimeout`

	isPrimaryRenderer: false,
	warnsIfNotActing: false,
	supportsMutation: true,
	supportsPersistence: false,
	supportsHydration: false,

	getInstanceFromNode(_node) {
		// TODO: Find out what this is.
		return null;
	},
	beforeActiveInstanceBlur() {
		// Noop
	},
	afterActiveInstanceBlur() {
		// Noop
	},
	preparePortalMount(_containerInfo) {
		// Nothing to do
	},
	prepareScopeUpdate: MakeUnsupportedShim('React Scopes are not supported.'),
	getInstanceFromScope: MakeUnsupportedShim('React Scopes are not supported.'),

	setCurrentUpdatePriority(newPriority: Lane): void {
		CurrentUpdatePriority = newPriority;
	},
	getCurrentUpdatePriority(): Lane {
		return CurrentUpdatePriority;
	},
	resolveUpdatePriority(): Lane { // Replaces getCurrentEventPriority
		return CurrentUpdatePriority || DefaultEventPriority;
	},
	resolveEventType() {
		return null;
	},
	resolveEventTimeStamp() {
		return -1.1;
	},
	shouldAttemptEagerTransition() {
		return false;
	},
	detachDeletedInstance(node) {
		// This method isn't really documented by React.
		// At the moment it appears it is called for all components when React doesn't intend to reuse them anymore,
		// but it also appears it is called multiple times.
		try {
			node.destroy();
		} catch (error) {
			node._getLogger().error('Error during instance destroy:', error);
		}
	},
	requestPostPaintCallback() {
		// Noop
	},
	maySuspendCommit() {
		return false;
	},
	preloadInstance(_type, _props) {
		return true; // true indicates already loaded
	},
	startSuspendingCommit() {
		// Noop
	},
	suspendInstance() {
		// Noop
	},
	waitForCommitToBeReady() {
		return null;
	},
	NotPendingTransition: null,
	HostTransitionContext: createContext<null>(null),
	resetFormInstance() {
		// Noop
	},
	// FIXME: Possibly still missing:
	// bindToConsole

	//#endregion

	//#region Microtasks

	supportsMicrotasks: true,
	scheduleMicrotask: queueMicrotask,

	//#endregion

	//#region Test selectors

	//@ts-expect-error: It does exist in the reconciler code.
	supportsTestSelectors: false,
	findFiberRoot: MakeUnsupportedShim('Test selectors are not supported'),
	getBoundingRect: MakeUnsupportedShim('Test selectors are not supported'),
	getTextContent: MakeUnsupportedShim('Test selectors are not supported'),
	isHiddenSubtree: MakeUnsupportedShim('Test selectors are not supported'),
	matchAccessibilityRole: MakeUnsupportedShim('Test selectors are not supported'),
	setFocusIfFocusable: MakeUnsupportedShim('Test selectors are not supported'),
	setupIntersectionObserver: MakeUnsupportedShim('Test selectors are not supported'),

	//#endregion

	//#region Mutation

	appendChild(parentInstance, child) {
		// Append a new child to an existing instance
		parentInstance.addChild(child.instance);
		parentInstance.emitNeedsUpdate();
	},
	appendChildToContainer(container, child) {
		// Append a new child to the root container
		container.addChild(child.instance);
		container.emitNeedsUpdate();
	},
	commitTextUpdate(_textInstance, _oldText, _newText) {
		// Nothing to do (should never happen)
	},
	commitMount(_instance, _type, _props, _internalInstanceHandle) {
		// Called right after instance was mounted under some parrent,
		// but only called if we returned `true` from `finalizeInitialChildren`.
		// Nothing to do
	},
	commitUpdate(
		instance: PixiInternalElementInstance<PixiContainer, never, any, any>,
		_type: string,
		prevProps: any,
		nextProps: any,
		_internalHandle: ReactReconciler.OpaqueHandle,
	): void {
		// Called when we need to apply an update.
		instance.commitUpdate(prevProps, nextProps);
		instance.emitNeedsUpdate();
	},
	insertBefore(parentInstance, child, beforeChild) {
		// Append a new child to an existing instance, but to the position before `beforeChild` (a child that is already attached)
		// Can be used on already-attached children to only reorder them
		parentInstance.addChild(child.instance, beforeChild.instance);
		parentInstance.emitNeedsUpdate();
	},
	insertInContainerBefore(container, child, beforeChild) {
		// Append a new child to the root container, but to the position before `beforeChild` (a child that is already attached)
		// Can be used on already-attached children to only reorder them
		container.addChild(child.instance, beforeChild.instance);
		container.emitNeedsUpdate();
	},
	removeChild(parentInstance, child) {
		// Remove an attached child from an existing instance
		parentInstance.removeChild(child.instance);
		parentInstance.emitNeedsUpdate();
	},
	removeChildFromContainer(container, child) {
		// Remove an attached child from the root container
		container.removeChild(child.instance);
		container.emitNeedsUpdate();
	},
	resetTextContent(_instance) {
		// Nothing to do (should never happen)
	},
	hideInstance(instance) {
		// Hides some instance without removing it.
		// This is mainly used for suspense.
		instance.hide();
		instance.emitNeedsUpdate();
	},
	hideTextInstance(_textInstance) {
		// Nothing to do (should never happen)
	},
	unhideInstance(instance, props) {
		// Un-hides a previously hidden instance.
		instance.unhide(props);
		instance.emitNeedsUpdate();
	},
	unhideTextInstance(_textInstance, _text) {
		// Nothing to do (should never happen)
	},
	clearContainer(container) {
		// Remove all children from the root container
		container.clearChildren();
		container.emitNeedsUpdate();
	},

	//#endregion

	//#region Persistence

	cloneInstance: MakeUnsupportedShim('Persistence is not supported.'),
	createContainerChildSet: MakeUnsupportedShim('Persistence is not supported.'),
	appendChildToContainerChildSet: MakeUnsupportedShim('Persistence is not supported.'),
	finalizeContainerChildren: MakeUnsupportedShim('Persistence is not supported.'),
	replaceContainerChildren: MakeUnsupportedShim('Persistence is not supported.'),
	cloneHiddenInstance: MakeUnsupportedShim('Persistence is not supported.'),
	cloneHiddenTextInstance: MakeUnsupportedShim('Persistence is not supported.'),

	//#endregion

	//#region Hydration

	isSuspenseInstancePending: MakeUnsupportedShim('Hydration is not supported.'),
	isSuspenseInstanceFallback: MakeUnsupportedShim('Hydration is not supported.'),
	getSuspenseInstanceFallbackErrorDetails: MakeUnsupportedShim('Hydration is not supported.'),
	registerSuspenseInstanceRetry: MakeUnsupportedShim('Hydration is not supported.'),
	canHydrateFormStateMarker: MakeUnsupportedShim('Hydration is not supported.'),
	isFormStateMarkerMatching: MakeUnsupportedShim('Hydration is not supported.'),
	getNextHydratableSibling: MakeUnsupportedShim('Hydration is not supported.'),
	getFirstHydratableChild: MakeUnsupportedShim('Hydration is not supported.'),
	getFirstHydratableChildWithinContainer: MakeUnsupportedShim('Hydration is not supported.'),
	getFirstHydratableChildWithinSuspenseInstance: MakeUnsupportedShim('Hydration is not supported.'),
	canHydrateInstance: MakeUnsupportedShim('Hydration is not supported.'),
	canHydrateTextInstance: MakeUnsupportedShim('Hydration is not supported.'),
	canHydrateSuspenseInstance: MakeUnsupportedShim('Hydration is not supported.'),
	hydrateInstance: MakeUnsupportedShim('Hydration is not supported.'),
	hydrateTextInstance: MakeUnsupportedShim('Hydration is not supported.'),
	hydrateSuspenseInstance: MakeUnsupportedShim('Hydration is not supported.'),
	getNextHydratableInstanceAfterSuspenseInstance: MakeUnsupportedShim('Hydration is not supported.'),
	commitHydratedContainer: MakeUnsupportedShim('Hydration is not supported.'),
	commitHydratedSuspenseInstance: MakeUnsupportedShim('Hydration is not supported.'),
	clearSuspenseBoundary: MakeUnsupportedShim('Hydration is not supported.'),
	clearSuspenseBoundaryFromContainer: MakeUnsupportedShim('Hydration is not supported.'),
	shouldDeleteUnhydratedTailInstances: MakeUnsupportedShim('Hydration is not supported.'),
	diffHydratedPropsForDevWarnings: MakeUnsupportedShim('Hydration is not supported.'),
	diffHydratedTextForDevWarnings: MakeUnsupportedShim('Hydration is not supported.'),
	describeHydratableInstanceForDevWarnings: MakeUnsupportedShim('Hydration is not supported.'),
	validateHydratableInstance: MakeUnsupportedShim('Hydration is not supported.'),
	validateHydratableTextInstance: MakeUnsupportedShim('Hydration is not supported.'),

	//#endregion

	//#region Resources

	supportsResources: false,
	isHostHoistableType: MakeUnsupportedShim('Resources are not supported.'),
	getHoistableRoot: MakeUnsupportedShim('Resources are not supported.'),
	getResource: MakeUnsupportedShim('Resources are not supported.'),
	acquireResource: MakeUnsupportedShim('Resources are not supported.'),
	releaseResource: MakeUnsupportedShim('Resources are not supported.'),
	hydrateHoistable: MakeUnsupportedShim('Resources are not supported.'),
	mountHoistable: MakeUnsupportedShim('Resources are not supported.'),
	unmountHoistable: MakeUnsupportedShim('Resources are not supported.'),
	createHoistableInstance: MakeUnsupportedShim('Resources are not supported.'),
	prepareToCommitHoistables: MakeUnsupportedShim('Resources are not supported.'),
	mayResourceSuspendCommit: MakeUnsupportedShim('Resources are not supported.'),
	preloadResource: MakeUnsupportedShim('Resources are not supported.'),
	suspendResource: MakeUnsupportedShim('Resources are not supported.'),

	//#endregion

	//#region Singletons

	supportsSingletons: false,
	resolveSingletonInstance: MakeUnsupportedShim('Singletons are not supported'),
	clearSingleton: MakeUnsupportedShim('Singletons are not supported'),
	acquireSingletonInstance: MakeUnsupportedShim('Singletons are not supported'),
	releaseSingletonInstance: MakeUnsupportedShim('Singletons are not supported'),
	isHostSingletonType: MakeUnsupportedShim('Singletons are not supported'),

	//#endregion

	// TODO: Does this actually exist?
	trackSchedulerEvent() {
		// Noop
	},
};
