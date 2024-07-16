import { Assert } from 'pandora-common';
import type { DisplayObject } from 'pixi.js';
import type ReactReconciler from 'react-reconciler';
import { DefaultEventPriority } from 'react-reconciler/constants';
import { PIXI_REGISTERED_COMPONENTS } from './component';
import { PixiInternalElementInstance, type PixiRootContainer } from './element';

// This file extensively ignores types. This is done because react-reconciler typings don't support mapping Props per specific type.
// We depend on things being declarated using `RegisterPixiComponent` to keep things type-safe.
/* eslint-disable @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */

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

const CHILDREN_PROP = 'children';

export const PIXI_FIBER_HOST_CONFIG: PixiHostConfig = {
	// Mode setup
	supportsMutation: true,
	supportsPersistence: false,
	isPrimaryRenderer: false,
	// Basics
	createInstance(type, props, rootContainer, _hostContext, _internalHandle) {
		const componentConfig = PIXI_REGISTERED_COMPONENTS.get(type);
		Assert(componentConfig != null, `Unknown component '${type}'`);

		return new PixiInternalElementInstance(type, componentConfig, props, rootContainer);
	},
	appendInitialChild(parentInstance, child) {
		parentInstance.addChild(child.instance);
		parentInstance.emitNeedsUpdate();
	},
	finalizeInitialChildren(_instance, _type, _props, _rootContainer, _hostContext) {
		return false; // No work scheduled on mount
	},
	prepareUpdate(_instance, _type, oldProps, newProps, _rootContainer, _hostContext) {
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
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return instance.instance;
	},
	prepareForCommit(_containerInfo) {
		return null; // We don't need to do anything around commit
	},
	resetAfterCommit(_containerInfo) {
		// We don't need to do anything around commit
	},

	// Mutation support
	appendChild(parentInstance, child) {
		parentInstance.addChild(child.instance);
		parentInstance.emitNeedsUpdate();
	},
	appendChildToContainer(container, child) {
		container.addChild(child.instance);
		container.emitNeedsUpdate();
	},
	insertBefore(parentInstance, child, beforeChild) {
		parentInstance.addChild(child.instance, beforeChild.instance);
		parentInstance.emitNeedsUpdate();
	},
	insertInContainerBefore(container, child, beforeChild) {
		container.addChild(child.instance, beforeChild.instance);
		container.emitNeedsUpdate();
	},
	removeChild(parentInstance, child) {
		parentInstance.removeChild(child.instance);
		parentInstance.emitNeedsUpdate();
	},
	removeChildFromContainer(container, child) {
		container.removeChild(child.instance);
		container.emitNeedsUpdate();
	},
	commitMount(_instance, _type, _props, _internalInstanceHandle) {
		// Nothing to do
	},
	commitUpdate(instance, updatePayload, _type, prevProps, nextProps, _internalHandle) {
		instance.commitUpdate(prevProps, nextProps, updatePayload);
		if (updatePayload.length > 0) {
			instance.emitNeedsUpdate();
		}
	},
	hideInstance(instance) {
		instance.hide();
		instance.emitNeedsUpdate();
	},
	unhideInstance(instance, props) {
		instance.unhide(props);
		instance.emitNeedsUpdate();
	},
	clearContainer(container) {
		container.clearChildren();
		container.emitNeedsUpdate();
	},

	// Text nodes
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
	supportsHydration: false,
	getCurrentEventPriority() {
		// TODO: Investigate how to properly implement this
		return DefaultEventPriority;
	},

	// Bowser link-up
	scheduleTimeout: setTimeout,
	cancelTimeout: clearTimeout,
	noTimeout: -1,
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
	detachDeletedInstance(node) {
		node.destroy();
	},
};
