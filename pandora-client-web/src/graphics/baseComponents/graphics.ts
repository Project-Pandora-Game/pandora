import { Graphics as PixiGraphics } from 'pixi.js';
import { RegisterPixiComponent, type DisplayObjectEventNames, type PixiComponentProps, type PixiDisplayObjectWriteableProps } from '../reconciler/component';
import { DISPLAY_OBJECT_AUTO_PROPS, DISPLAY_OBJECT_EVENTS, type DisplayObjectEventMap } from './container';

const GRAPHICS_AUTO_PROPS = {
	...DISPLAY_OBJECT_AUTO_PROPS,
} as const satisfies Readonly<Partial<Record<keyof PixiDisplayObjectWriteableProps<PixiGraphics>, true>>>;

export type GraphicsAutoProps = keyof typeof GRAPHICS_AUTO_PROPS;

const GRAPHICS_EVENTS = {
	...DISPLAY_OBJECT_EVENTS,
} as const satisfies Readonly<Partial<Record<DisplayObjectEventNames<PixiGraphics>, true>>>;

export type GraphicsCustomProps = {
	draw?: (graphics: PixiGraphics) => void;
};

export type GraphicsProps = PixiComponentProps<PixiGraphics, GraphicsAutoProps, DisplayObjectEventMap, GraphicsCustomProps>;
export const Graphics = RegisterPixiComponent<PixiGraphics, GraphicsAutoProps, DisplayObjectEventMap, GraphicsCustomProps>('Graphics', {
	create(props) {
		const instance = new PixiGraphics();
		props.draw?.(instance);
		return instance;
	},
	applyCustomProps(instance, {
		draw: oldDraw,
	}, {
		draw,
	}) {
		if (oldDraw !== draw) {
			draw?.(instance);
		}
	},
	autoProps: GRAPHICS_AUTO_PROPS,
	events: GRAPHICS_EVENTS,
});
