import { Container as PixiContainer, type ContainerChild, type ContainerEvents } from 'pixi.js';
import { RegisterPixiComponent, type DisplayObjectEventNames, type PixiDisplayObjectWriteableProps } from '../reconciler/component.ts';

export const CONTAINER_AUTO_PROPS = {
	renderable: true,
	zIndex: true,
	x: true,
	y: true,
	angle: true,
	alpha: true,
	filters: true,
	cursor: true,
	eventMode: true,
	interactive: true,
	hitArea: true,
	sortableChildren: true,
} as const satisfies Readonly<Partial<Record<keyof PixiDisplayObjectWriteableProps<PixiContainer>, true>>>;
export type ContainerAutoProps = keyof typeof CONTAINER_AUTO_PROPS;

export const CONTAINER_EVENTS = {
	pointerdown: true,
	pointerup: true,
	pointerupoutside: true,
	pointermove: true,
	globalpointermove: true,
} as const satisfies Readonly<Partial<Record<DisplayObjectEventNames<PixiContainer>, true>>>;
export type ContainerEventMap = Pick<ContainerEvents<ContainerChild>, keyof typeof CONTAINER_EVENTS>;

/**
 * Container is a general-purpose display object that holds children. It also adds built-in support for advanced
 * rendering features like masking and filtering.
 *
 * It is the base class of all display objects that act as a container for other objects, including Graphics
 * and Sprite.
 */
export const Container = RegisterPixiComponent<PixiContainer, ContainerAutoProps, ContainerEventMap>('Container', {
	create() {
		return new PixiContainer();
	},
	autoProps: CONTAINER_AUTO_PROPS,
	events: CONTAINER_EVENTS,
});
