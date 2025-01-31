/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/naming-convention */
import { Assert } from 'pandora-common';
import type { Container as PixiContainer } from 'pixi.js';
import { createContext } from 'react';
import type ReactReconciler from 'react-reconciler';
import type { Lane } from 'react-reconciler';
import { DefaultEventPriority } from 'react-reconciler/constants';
import { PIXI_REGISTERED_COMPONENTS } from './component';
import { PixiInternalElementInstance, type PixiRootContainer } from './element';
import { GAME_VERSION } from '../../config/Environment';

// This file extensively ignores types. This is done because react-reconciler typings don't support mapping Props per specific type.
// We depend on things being declarated using `RegisterPixiComponent` to keep things type-safe.
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */

// FIXME: use DefinitelyTyped for React 19 once available
// https://github.com/facebook/react/issues/28956
// Currently reusing: https://github.com/pmndrs/react-three-fiber/blob/v9/packages/fiber/src/core/reconciler.tsx
// @ f7b56b06b36c65f7ae2bbfc5e487501b69fe5232
type EventPriority = number;

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
> = (
		Omit<
			ReactReconciler.HostConfig<
				Type,
				Props,
				Container,
				Instance,
				TextInstance,
				SuspenseInstance,
				HydratableInstance,
				PublicInstance,
				HostContext,
				null, // updatePayload
				ChildSet,
				TimeoutHandle,
				NoTimeout
			>,
			'getCurrentEventPriority' | 'prepareUpdate' | 'commitUpdate'
		> & {
			/**
			 * This method should mutate the `instance` and perform prop diffing if needed.
			 *
			 * The `internalHandle` data structure is meant to be opaque. If you bend the rules and rely on its internal fields, be aware that it may change significantly between versions. You're taking on additional maintenance risk by reading from it, and giving up all guarantees if you write something to it.
			 */
			commitUpdate?(
				instance: Instance,
				type: Type,
				prevProps: Props,
				nextProps: Props,
				internalHandle: ReactReconciler.OpaqueHandle,
			): void;

			// Undocumented
			// https://github.com/facebook/react/pull/26722
			NotPendingTransition: TransitionStatus | null;
			HostTransitionContext: React.Context<TransitionStatus>;
			// https://github.com/facebook/react/pull/28751
			setCurrentUpdatePriority(newPriority: EventPriority): void;
			getCurrentUpdatePriority(): EventPriority;
			resolveUpdatePriority(): EventPriority;
			// https://github.com/facebook/react/pull/28804
			resetFormInstance(form: FormInstance): void;
			// https://github.com/facebook/react/pull/25105
			requestPostPaintCallback(callback: (time: number) => void): void;
			// https://github.com/facebook/react/pull/26025
			shouldAttemptEagerTransition(): boolean;
			// https://github.com/facebook/react/pull/31528
			trackSchedulerEvent(): void;
			// https://github.com/facebook/react/pull/31008
			resolveEventType(): null | string;
			resolveEventTimeStamp(): number;

			/**
			 * This method is called during render to determine if the Host Component type and props require some kind of loading process to complete before committing an update.
			 */
			maySuspendCommit(type: Type, props: Props): boolean;
			/**
			 * This method may be called during render if the Host Component type and props might suspend a commit. It can be used to initiate any work that might shorten the duration of a suspended commit.
			 */
			preloadInstance(type: Type, props: Props): boolean;
			/**
			 * This method is called just before the commit phase. Use it to set up any necessary state while any Host Components that might suspend this commit are evaluated to determine if the commit must be suspended.
			 */
			startSuspendingCommit(): void;
			/**
			 * This method is called after `startSuspendingCommit` for each Host Component that indicated it might suspend a commit.
			 */
			suspendInstance(type: Type, props: Props): void;
			/**
			 * This method is called after all `suspendInstance` calls are complete.
			 *
			 * Return `null` if the commit can happen immediately.
			 *
			 * Return `(initiateCommit: Function) => Function` if the commit must be suspended. The argument to this callback will initiate the commit when called. The return value is a cancellation function that the Reconciler can use to abort the commit.
			 *
			 */
			waitForCommitToBeReady(): ((initiateCommit: Function) => Function) | null;

			// Extras from Pandora's research
			rendererPackageName: string;
			rendererVersion: string;
			extraDevToolsConfig: unknown;
		}
	);

declare module 'react-reconciler/constants' {
	const NoEventPriority = 0;
}

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

export const PIXI_FIBER_HOST_CONFIG: PixiHostConfig = {
	// Debug tools info
	rendererPackageName: 'pandora-client-web/pixi-renderer',
	rendererVersion: GAME_VERSION ?? '0.0.0',
	extraDevToolsConfig: null,
	// Mode setup
	supportsMutation: true,
	supportsPersistence: false,
	supportsHydration: false,
	isPrimaryRenderer: false,
	warnsIfNotActing: false,
	// Basics
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
	getPublicInstance(instance) {
		// Return what should be used as `ref` of the component.
		return instance.instance;
	},
	prepareForCommit(_containerInfo) {
		// Called right before all updates are applied
		return null; // We don't need to do anything around commit
	},
	resetAfterCommit(_containerInfo) {
		// Called right after all updates are applied
		// We don't need to do anything around commit
	},
	detachDeletedInstance(node) {
		// This method isn't really documented by React.
		// At the moment it appears it is called for all components when React doesn't intend to reuse them anymore,
		// but it also appears it is called multiple times.
		node.destroy();
	},

	// Mutation support
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
	hideInstance(instance) {
		// Hides some instance without removing it.
		// This is mainly used for suspense.
		instance.hide();
		instance.emitNeedsUpdate();
	},
	unhideInstance(instance, props) {
		// Un-hides a previously hidden instance.
		instance.unhide(props);
		instance.emitNeedsUpdate();
	},
	clearContainer(container) {
		// Remove all children from the root container
		container.clearChildren();
		container.emitNeedsUpdate();
	},

	// Text nodes
	// We currently do not support text nodes.
	// In the future we might support them as children of some elements (like `Text`) to make them look nicer,
	// but that is low-priority.
	createTextInstance(_text, _rootContainer, _hostContext, _internalHandle) {
		Assert(false, 'Text nodes are not supported');
	},
	shouldSetTextContent(_type, _props) {
		return false;
	},
	resetTextContent(_instance) {
		// Nothing to do (should never happen)
	},
	commitTextUpdate(_textInstance, _oldText, _newText) {
		// Nothing to do (should never happen)
	},
	hideTextInstance(_textInstance) {
		// Nothing to do (should never happen)
	},
	unhideTextInstance(_textInstance, _text) {
		// Nothing to do (should never happen)
	},

	// Context
	// Used for keeping data where in the tree we are.
	// We don't use this feature, as none of our elements are context-dependant.
	getRootHostContext(_rootContainer) {
		return NO_CONTEXT;
	},
	getChildHostContext(parentHostContext, _type, _rootContainer) {
		return parentHostContext;
	},

	// Portals
	preparePortalMount(_containerInfo) {
		// Nothing to do
	},

	// Bowser link-up
	scheduleTimeout: setTimeout,
	cancelTimeout: clearTimeout,
	noTimeout: -1, // Value that can never be returned by `scheduleTimeout`
	supportsMicrotasks: true,
	scheduleMicrotask: queueMicrotask,

	// Things that are type-required be we don't seem to need
	getInstanceFromNode(_node) {
		throw new Error('Not yet implemented');
	},
	beforeActiveInstanceBlur() {
		// Noop
	},
	afterActiveInstanceBlur() {
		// Noop
	},
	prepareScopeUpdate(_scopeInstance, _instance) {
		throw new Error('Not yet implemented');
	},
	getInstanceFromScope(_scopeInstance) {
		throw new Error('Not yet implemented');
	},

	// React 19
	setCurrentUpdatePriority(newPriority: Lane): void {
		CurrentUpdatePriority = newPriority;
	},
	getCurrentUpdatePriority(): Lane {
		return CurrentUpdatePriority;
	},
	resolveUpdatePriority(): Lane { // Replaces getCurrentEventPriority
		return CurrentUpdatePriority || DefaultEventPriority;
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
	HostTransitionContext: createContext<null>(null),
	shouldAttemptEagerTransition() {
		return false;
	},
	trackSchedulerEvent() {
		// Noop
	},
	resolveEventType() {
		return null;
	},
	resolveEventTimeStamp() {
		return -1.1;
	},
	requestPostPaintCallback() {
		// Noop
	},
	NotPendingTransition: null,
	resetFormInstance() {
		// Noop
	},
};

// FIXME: Possibly still missing:
// bindToConsole
