import { Container as PixiContainer, type DisplayObject, type DisplayObjectEvents } from 'pixi.js';
import { RegisterPixiComponent, type DisplayObjectEventNames, type PixiDisplayObjectWriteableProps } from '../reconciler/component';

//#region DisplayObject

/** Auto-props definition for `DisplayObject`. */
export const DISPLAY_OBJECT_AUTO_PROPS = {
	renderable: true,
	zIndex: true,
	x: true,
	y: true,
	alpha: true,
	filters: true,
	cursor: true,
	eventMode: true,
	interactive: true,
	hitArea: true,
} as const satisfies Readonly<Partial<Record<keyof PixiDisplayObjectWriteableProps<DisplayObject>, true>>>;
export type DisplayObjectAutoProps = keyof typeof DISPLAY_OBJECT_AUTO_PROPS;

/** Exposed events for `DisplayObject` */
export const DISPLAY_OBJECT_EVENTS = {
	pointerdown: true,
	pointerup: true,
	pointerupoutside: true,
	pointermove: true,
	globalpointermove: true,
} as const satisfies Readonly<Partial<Record<DisplayObjectEventNames<DisplayObject>, true>>>;
export type DisplayObjectEventMap = Pick<DisplayObjectEvents, keyof typeof DISPLAY_OBJECT_EVENTS>;

//#endregion

const CONTAINER_AUTO_PROPS = {
	...DISPLAY_OBJECT_AUTO_PROPS,
	sortableChildren: true,
} as const satisfies Readonly<Partial<Record<keyof PixiDisplayObjectWriteableProps<PixiContainer>, true>>>;
export type ContainerAutoProps = keyof typeof CONTAINER_AUTO_PROPS;

const CONTAINER_EVENTS = {
	...DISPLAY_OBJECT_EVENTS,
} as const satisfies Readonly<Partial<Record<DisplayObjectEventNames<DisplayObject>, true>>>;

/**
 * Container is a general-purpose display object that holds children. It also adds built-in support for advanced
 * rendering features like masking and filtering.
 *
 * It is the base class of all display objects that act as a container for other objects, including Graphics
 * and Sprite.
 */
export const Container = RegisterPixiComponent<PixiContainer, ContainerAutoProps, DisplayObjectEventMap>('Container', {
	create() {
		return new PixiContainer();
	},
	autoProps: CONTAINER_AUTO_PROPS,
	events: CONTAINER_EVENTS,
});
