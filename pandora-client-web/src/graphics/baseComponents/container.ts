import { Container as PixiContainer, type DisplayObject, type DisplayObjectEvents } from 'pixi.js';
import { RegisterPixiComponent, type DisplayObjectEventNames, type PixiDisplayObjectWriteableProps } from '../reconciler/component';

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

export const DISPLAY_OBJECT_EVENTS = {
	pointerdown: true,
	pointerup: true,
	pointerupoutside: true,
	pointermove: true,
} as const satisfies Readonly<Partial<Record<DisplayObjectEventNames<DisplayObject>, true>>>;
export type DisplayObjectEventMap = Pick<DisplayObjectEvents, keyof typeof DISPLAY_OBJECT_EVENTS>;

export type DisplayObjectAutoProps = keyof typeof DISPLAY_OBJECT_AUTO_PROPS;

const CONTAINER_AUTO_PROPS = {
	...DISPLAY_OBJECT_AUTO_PROPS,
	sortableChildren: true,
} as const satisfies Readonly<Partial<Record<keyof PixiDisplayObjectWriteableProps<PixiContainer>, true>>>;
export type ContainerAutoProps = keyof typeof CONTAINER_AUTO_PROPS;

const CONTAINER_EVENTS = {
	...DISPLAY_OBJECT_EVENTS,
} as const satisfies Readonly<Partial<Record<DisplayObjectEventNames<DisplayObject>, true>>>;

export const Container = RegisterPixiComponent<PixiContainer, ContainerAutoProps, DisplayObjectEventMap>('Container', {
	create() {
		return new PixiContainer();
	},
	autoProps: CONTAINER_AUTO_PROPS,
	events: CONTAINER_EVENTS,
});
