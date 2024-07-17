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
	/**
	 * A callback that is called whenever it changes.
	 * Use it together with `useCallback` to generate contents of the Graphics instance.
	 */
	draw?: (graphics: PixiGraphics) => void;
};

export type GraphicsProps = PixiComponentProps<PixiGraphics, GraphicsAutoProps, DisplayObjectEventMap, GraphicsCustomProps>;
/**
 * The Graphics class is primarily used to render primitive shapes such as lines, circles and
 * rectangles to the display, and to color and fill them.  However, you can also use a Graphics
 * object to build a list of primitives to use as a mask, or as a complex hitArea.
 *
 * Please note that due to legacy naming conventions, the behavior of some functions in this class
 * can be confusing.  Each call to `drawRect()`, `drawPolygon()`, etc. actually stores that primitive
 * in the Geometry class's GraphicsGeometry object for later use in rendering or hit testing - the
 * functions do not directly draw anything to the screen.  Similarly, the `clear()` function doesn't
 * change the screen, it simply resets the list of primitives, which can be useful if you want to
 * rebuild the contents of an existing Graphics object.
 */
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
