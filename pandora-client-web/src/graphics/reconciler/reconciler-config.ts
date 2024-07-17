import { Assert } from 'pandora-common';
import type { DisplayObject } from 'pixi.js';
import type ReactReconciler from 'react-reconciler';
import { DefaultEventPriority } from 'react-reconciler/constants';
import { PIXI_REGISTERED_COMPONENTS } from './component';
import { PixiInternalElementInstance, type PixiRootContainer } from './element';

// This file extensively ignores types. This is done because react-reconciler typings don't support mapping Props per specific type.
// We depend on things being declarated using `RegisterPixiComponent` to keep things type-safe.
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */

export type PixiHostConfig = ReactReconciler.HostConfig<
	string, // Type
	any, // Props
	PixiRootContainer, // Container
	PixiInternalElementInstance<any, never, any, any>, // Instance
	never, // TextInstance
	never, // SuspenseInstance
	never, // HydratableInstance
	DisplayObject, // PublicInstance
	null, // HostContext
	string[], // UpdatePayload: We use a list of changed props
	never, // ChildSet
	number, // TimeoutHandle
	-1 // NoTimeout
>;

/** Name of the React's special property for children. */
const CHILDREN_PROP = 'children';

export const PIXI_FIBER_HOST_CONFIG: PixiHostConfig = {
	// Mode setup
	supportsMutation: true,
	supportsPersistence: false,
	supportsHydration: false,
	isPrimaryRenderer: false,
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
	prepareUpdate(_instance, _type, oldProps, newProps, _rootContainer, _hostContext) {
		// Method for pre-calculating update that needs to be done (if any).
		// Used to reduce time spent during the actual update as much as possible.
		let update: string[] | null = null;

		// Check for deleted props
		for (const key of Object.keys(oldProps)) {
			if (key !== CHILDREN_PROP && !Object.prototype.hasOwnProperty.call(newProps, key)) {
				update ??= [];
				update.push(key);
			}
		}

		// Check for updated props
		for (const key of Object.keys(newProps)) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			if (key !== CHILDREN_PROP && oldProps[key] !== newProps[key]) {
				update ??= [];
				update.push(key);
			}
		}

		return update;
	},
	getPublicInstance(instance) {
		// Return what should be used as `ref` of the component.
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
	commitUpdate(instance, updatePayload, _type, prevProps, nextProps, _internalHandle) {
		// Called when we need to apply an update.
		// `updatePayload` is what we returned from `prepareUpdate`.
		instance.commitUpdate(prevProps, nextProps, updatePayload);
		if (updatePayload.length > 0) {
			instance.emitNeedsUpdate();
		}
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
		return null;
	},
	getChildHostContext(parentHostContext, _type, _rootContainer) {
		return parentHostContext;
	},

	// Portals
	preparePortalMount(_containerInfo) {
		// Nothing to do
	},

	// Additional info for React
	getCurrentEventPriority() {
		// TODO: Investigate how to properly implement this
		return DefaultEventPriority;
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
};
