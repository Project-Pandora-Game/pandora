import { freeze } from 'immer';
import { Assert, type Satisfies } from 'pandora-common';
import { DisplayObject, utils, type Container, type IPointData } from 'pixi.js';
import type React from 'react';
import type { ReactNode } from 'react';
import type { ConditionalKeys, ReadonlyKeysOf } from 'type-fest';

// This file extensively does type trickery - attempting to concentrate all type tricks to this file,
// in hopes that usage outside will be fully type-safe
/* eslint-disable @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any */

/** Writeable non-function props of the component */
type DisplayObjectAllProps<Component extends DisplayObject> = Omit<Component, ConditionalKeys<Component, Function> | ReadonlyKeysOf<Component>>;

/** List of black-listed properties that shouldn't ever be visible (mainly those that we depend on with our internal state) */
export const PIXI_COMPONENT_PRIVATE_PROPERTIES = [
	'parent',
	'worldAlpha',
] as const satisfies (readonly (keyof DisplayObjectAllProps<DisplayObject>)[]);

/** Keys of black-listed properties that shouldn't ever be visible (mainly those that we depend on with our internal state) */
type DisplayObjectPrivateProps = (typeof PIXI_COMPONENT_PRIVATE_PROPERTIES)[number];

export function PixiComponentIsPrivateProperty(key: string): key is DisplayObjectPrivateProps {
	return (PIXI_COMPONENT_PRIVATE_PROPERTIES as readonly string[]).includes(key);
}

/** List of properties that are always handled automatically, because they have additional special handling. */
export const PIXI_COMPONENT_SPECIAL_PROPERTIES = [
	'visible',
	// Point-like properties can't be auto-typed, because TypeScript doesn't support inferring type of setters...
	// https://github.com/microsoft/TypeScript/issues/43729
	'scale',
	'pivot',
	'position',
	'skew',
] as const satisfies (readonly (keyof DisplayObjectAllProps<DisplayObject>)[]);

export function PixiComponentIsSpecialProperty(key: string): key is DisplayObjectSpecialPropKeys {
	return (PIXI_COMPONENT_SPECIAL_PROPERTIES as readonly string[]).includes(key);
}

/** Keys of black-listed properties that shouldn't ever be visible (mainly those that we depend on with our internal state) */
type DisplayObjectSpecialPropKeys = (typeof PIXI_COMPONENT_SPECIAL_PROPERTIES)[number];

export type PixiPointLike = IPointData | readonly [number, number] | number;

export function ParsePixiPointLike(data: PixiPointLike | undefined, defaultX: number, defaultY: number): readonly [number, number] {
	if (Array.isArray(data)) {
		Assert(data.length === 2);
		return [data[0], data[1]];
	}
	if (typeof data === 'number') {
		return [data, data];
	}
	if (data != null) {
		Assert('x' in data && 'y' in data);
		return [data.x, data.y];
	}

	return [defaultX, defaultY];
}

export type DisplayObjectSpecialProps = Satisfies<{
	visible: boolean;
	scale: PixiPointLike;
	pivot: PixiPointLike;
	position: PixiPointLike;
	skew: PixiPointLike;
}, Record<DisplayObjectSpecialPropKeys, any>>;

/** List of writeable props, excluding any black-listed ones. */
export type PixiDisplayObjectWriteableProps<Component extends DisplayObject> = Omit<DisplayObjectAllProps<Component>, DisplayObjectPrivateProps | DisplayObjectSpecialPropKeys>;

export type DisplayObjectEventNames<Component extends utils.EventEmitter<any>> = ReturnType<Component['eventNames']>[number];

/** Utility for extracting event mappings from an object. */
type DisplayObjectListenersMapRaw<EventMap extends (utils.EventEmitter.ValidEventTypes)> = {
	[eventType in utils.EventEmitter.EventNames<EventMap> as eventType extends string ? eventType : never]: utils.EventEmitter.EventListener<EventMap, eventType>;
};

/** Utility for extracting event mappings from an object, adding prefix */
type DisplayObjectListenersMap<EventMap extends (utils.EventEmitter.ValidEventTypes)> = {
	[eventType in utils.EventEmitter.EventNames<EventMap> as eventType extends string ? `on${eventType}` : never]: utils.EventEmitter.EventListener<EventMap, eventType>;
};

/** Properties a registered pixi components has access to; combination of custom-defined properties, event properties and automatically-setable properties. */
export type PixiComponentProps<
	Element extends DisplayObject,
	AutoPropKeys extends (keyof PixiDisplayObjectWriteableProps<Element>) = never,
	EventMap extends (utils.EventEmitter.ValidEventTypes) = DisplayObjectEventNames<Element>,
	CustomProps = {},
> =
	CustomProps
	& Partial<Pick<PixiDisplayObjectWriteableProps<Element>, AutoPropKeys>>
	& Partial<DisplayObjectSpecialProps>
	& Partial<DisplayObjectListenersMap<EventMap>>;

/** Config for a specific component, allowing it to be used generically by out Fiber. */
export type PixiComponentConfig<
	Element extends DisplayObject,
	AutoPropKeys extends (keyof PixiDisplayObjectWriteableProps<Element>) = never,
	EventMap extends (utils.EventEmitter.ValidEventTypes) = DisplayObjectEventNames<Element>,
	CustomProps = {},
> = {
	create(props: Readonly<PixiComponentProps<Element, AutoPropKeys, EventMap, CustomProps>>): Element;
	events: Record<keyof DisplayObjectListenersMapRaw<EventMap>, true>;
	autoProps: Record<AutoPropKeys, true>;
	applyCustomProps?(
		instance: Element,
		oldProps: Readonly<PixiComponentProps<Element, AutoPropKeys, EventMap, CustomProps>>,
		newProps: Readonly<PixiComponentProps<Element, AutoPropKeys, EventMap, CustomProps>>,
	): void;
};

export type PixiComponentFullProps<
	Element extends DisplayObject,
	AutoPropKeys extends (keyof PixiDisplayObjectWriteableProps<Element>) = never,
	EventMap extends (utils.EventEmitter.ValidEventTypes) = DisplayObjectEventNames<Element>,
	CustomProps = {},
> =
	React.PropsWithoutRef<PixiComponentProps<Element, AutoPropKeys, EventMap, CustomProps>> &
	React.RefAttributes<Element> &
	{ children?: Element extends Container ? ReactNode : undefined; };

/**
 * A function to register a Pixi component, allowing it to be used by our Fiber directly.
 * @param uniqueName - Name for the component. Used in debug view and internally. Must be unique.
 * @param config - Configuration for the component.
 * @returns Opaque value that can be used as an JSX component.
 */
export function RegisterPixiComponent<
	Element extends DisplayObject,
	AutoPropKeys extends (keyof PixiDisplayObjectWriteableProps<Element>) = never,
	EventMap extends (utils.EventEmitter.ValidEventTypes) = DisplayObjectEventNames<Element>,
	CustomProps = {},
>(
	uniqueName: string,
	config: PixiComponentConfig<Element, AutoPropKeys, EventMap, CustomProps>,
): React.ExoticComponent<PixiComponentFullProps<Element, AutoPropKeys, EventMap, CustomProps>> {
	Assert(!PIXI_REGISTERED_COMPONENTS.has(uniqueName), `Component '${uniqueName}' was already registered.`);

	PIXI_REGISTERED_COMPONENTS.set(uniqueName, freeze(config, true));
	// We intentionally return string here, but say it is a function.
	// This allows the return value to work as an reference-based component,
	// while in reality the Fiber handles instantiating it.
	// This allows us to make full use of React's capabilities without polluting global JSX namespace.
	// @ts-expect-error: We intentionally return string, but say we return a function.
	return uniqueName;
}

/**
 * __INTERNAL!__
 *
 * List of registered components
 */
export const PIXI_REGISTERED_COMPONENTS = new Map<string, PixiComponentConfig<any, never, any, any>>();
