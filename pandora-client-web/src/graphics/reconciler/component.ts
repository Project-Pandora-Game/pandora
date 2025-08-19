import { freeze } from 'immer';
import { Assert, type Satisfies } from 'pandora-common';
import { type ColorSource, type Container, type EventEmitter, type PointData } from 'pixi.js';
import type React from 'react';
import type { ReactNode } from 'react';
import type { ConditionalKeys, ReadonlyKeysOf } from 'type-fest';

// This file extensively does type trickery - attempting to concentrate all type tricks to this file,
// in hopes that usage outside will be fully type-safe
/* eslint-disable @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type, @typescript-eslint/no-explicit-any */

/** Writeable non-function props of the component */
type DisplayObjectAllProps<Component extends Container> = Omit<Component, ConditionalKeys<Component, Function> | ReadonlyKeysOf<Component>>;

/** List of black-listed properties that shouldn't ever be visible (mainly those that we depend on with our internal state) */
export const PIXI_COMPONENT_PRIVATE_PROPERTIES = [
	'parent',
	'children',
	'allowChildren',
] as const satisfies (readonly (keyof DisplayObjectAllProps<Container>)[]);

/** Keys of black-listed properties that shouldn't ever be visible (mainly those that we depend on with our internal state) */
type DisplayObjectPrivateProps = (typeof PIXI_COMPONENT_PRIVATE_PROPERTIES)[number];

/** Check if DisplayObject key is one of a private property. */
export function PixiComponentIsPrivateProperty(key: string | number | symbol): key is DisplayObjectPrivateProps {
	return (PIXI_COMPONENT_PRIVATE_PROPERTIES as readonly (string | number | symbol)[]).includes(key);
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
	'tint',
] as const satisfies (readonly (keyof DisplayObjectAllProps<Container>)[]);

/** Check if DisplayObject key is one of a property with special handling. */
export function PixiComponentIsSpecialProperty(key: string | number | symbol): key is DisplayObjectSpecialPropKeys {
	return (PIXI_COMPONENT_SPECIAL_PROPERTIES as readonly (string | number | symbol)[]).includes(key);
}

/** Keys of black-listed properties that shouldn't ever be visible (mainly those that we depend on with our internal state) */
type DisplayObjectSpecialPropKeys = (typeof PIXI_COMPONENT_SPECIAL_PROPERTIES)[number];

/** A generic type that can be transformed into a point. */
export type PixiPointLike = PointData | readonly [number, number] | number;

/**
 * Parse a `PixiPointLike` data into X and Y numbers.
 * @param data - The data to parse
 * @param defaultX - Value of `X` used if data is undefined.
 * @param defaultY - Value of `Y` used if data is undefined.
 * @returns The X and Y coordinates
 */
export function ParsePixiPointLike(data: PixiPointLike | undefined, defaultX: number, defaultY: number): readonly [x: number, y: number] {
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

/** Property typings for special props. */
export type DisplayObjectSpecialProps = Satisfies<{
	visible: boolean;
	scale: PixiPointLike;
	pivot: PixiPointLike;
	position: PixiPointLike;
	skew: PixiPointLike;
	tint: ColorSource;
}, Record<DisplayObjectSpecialPropKeys, any>>;

/** List of writeable props, excluding any black-listed ones. */
export type PixiDisplayObjectWriteableProps<Component extends Container> = Omit<DisplayObjectAllProps<Component>, DisplayObjectPrivateProps | DisplayObjectSpecialPropKeys>;

/** Helper for extracting valid event names for `pixi.utils.EventEmitter` class. */
export type DisplayObjectEventNames<Component extends EventEmitter<any>> = ReturnType<Component['eventNames']>[number];

/** Utility for extracting event mappings from an object. */
type DisplayObjectListenersMapRaw<EventMap extends (EventEmitter.ValidEventTypes)> = {
	[eventType in EventEmitter.EventNames<EventMap> as eventType extends string ? eventType : never]: EventEmitter.EventListener<EventMap, eventType>;
};

/** Utility for extracting event mappings from an object, adding prefix */
type DisplayObjectListenersMap<EventMap extends (EventEmitter.ValidEventTypes)> = {
	[eventType in EventEmitter.EventNames<EventMap> as eventType extends string ? `on${eventType}` : never]: EventEmitter.EventListener<EventMap, eventType>;
};

/** Properties a registered pixi components has access to; combination of custom-defined properties, event properties and automatically-setable properties. */
export type PixiComponentProps<
	Element extends Container,
	AutoPropKeys extends (keyof PixiDisplayObjectWriteableProps<Element>) = never,
	EventMap extends (EventEmitter.ValidEventTypes) = DisplayObjectEventNames<Element>,
	CustomProps = {},
> =
	// Any properties defined by the component
	CustomProps
	// All properties that are auto-assigned
	& Partial<Pick<PixiDisplayObjectWriteableProps<Element>, AutoPropKeys>>
	// Special properties can be used on any object
	& Partial<DisplayObjectSpecialProps>
	// Event listeners, with `on` prefix
	& Partial<DisplayObjectListenersMap<EventMap>>;

/** Config for a specific component, allowing it to be used generically by out Fiber. */
export type PixiComponentConfig<
	Element extends Container,
	AutoPropKeys extends (keyof PixiDisplayObjectWriteableProps<Element>) = never,
	EventMap extends (EventEmitter.ValidEventTypes) = DisplayObjectEventNames<Element>,
	CustomProps = {},
> = {
	/**
	 * Create an element given initial props.
	 * This method is expected to apply any custom props right after creating the element.
	 *
	 * After this function returns, `autoProps` will be assigned to the element.
	 */
	create(props: Readonly<PixiComponentProps<Element, AutoPropKeys, EventMap, CustomProps>>): Element;
	/**
	 * Destroy the element returned by `create`
	 *
	 * Optional - if not defined, the `destroy` method is called on the element.
	 * @param element - The element to destroy
	 */
	destroy?(element: Element): void;
	/** Map of valid event names, where each event name should be set to `true`. */
	events: Record<keyof DisplayObjectListenersMapRaw<EventMap>, true>;
	/** Map of automatically managed properties, where each such property name should be set to `true`. */
	autoProps: Record<AutoPropKeys, true>;
	/**
	 * Optional function for updating any custom properties.
	 * It is called _before_ `autoProps` are updated.
	 */
	applyCustomProps?(
		instance: Element,
		oldProps: Readonly<PixiComponentProps<Element, AutoPropKeys, EventMap, CustomProps>>,
		newProps: Readonly<PixiComponentProps<Element, AutoPropKeys, EventMap, CustomProps>>,
	): void;
	/** Skips applying of the specified special props, if custom props wants to apply them itself. */
	applySkipSpecialPropsApply?: Partial<Omit<Record<DisplayObjectSpecialPropKeys, true>, 'visible'>>;
};

/** Full props of a component defining how the component can be used by client code. */
export type PixiComponentFullProps<
	Element extends Container,
	AutoPropKeys extends (keyof PixiDisplayObjectWriteableProps<Element>) = never,
	EventMap extends (EventEmitter.ValidEventTypes) = DisplayObjectEventNames<Element>,
	CustomProps = {},
> =
	// The props visible to the component itself
	React.PropsWithoutRef<PixiComponentProps<Element, AutoPropKeys, EventMap, CustomProps>> &
	// The `ref`
	React.RefAttributes<Element> &
	// Children, if allowed
	{ children?: Element extends Container ? ReactNode : undefined; };

/**
 * A function to register a Pixi component, allowing it to be used by our Fiber directly.
 * @param uniqueName - Name for the component. Used in debug view and internally. Must be unique.
 * @param config - Configuration for the component.
 * @returns Opaque value that can be used as an JSX component.
 */
export function RegisterPixiComponent<
	Element extends Container,
	AutoPropKeys extends (keyof PixiDisplayObjectWriteableProps<Element>) = never,
	EventMap extends (EventEmitter.ValidEventTypes) = DisplayObjectEventNames<Element>,
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
