import { Graphics as PixiGraphics, GraphicsContext as PixiGraphicsContext } from 'pixi.js';
import { RegisterPixiComponent, type DisplayObjectEventNames, type PixiComponentProps, type PixiDisplayObjectWriteableProps } from '../reconciler/component.ts';
import { CONTAINER_AUTO_PROPS, CONTAINER_EVENTS, type ContainerEventMap } from './container.ts';

const GRAPHICS_AUTO_PROPS = {
	...CONTAINER_AUTO_PROPS,
} as const satisfies Readonly<Partial<Record<keyof PixiDisplayObjectWriteableProps<PixiGraphics>, true>>>;

export type GraphicsAutoProps = keyof typeof GRAPHICS_AUTO_PROPS;

const GRAPHICS_EVENTS = {
	...CONTAINER_EVENTS,
} as const satisfies Readonly<Partial<Record<DisplayObjectEventNames<PixiGraphics>, true>>>;

export type GraphicsCustomProps = {
	/**
	 * A callback that is called whenever it changes.
	 * Use it together with `useCallback` to generate contents of the Graphics instance.
	 */
	draw?: (context: PixiGraphicsContext) => void;
};

export type GraphicsProps = PixiComponentProps<PixiGraphics, GraphicsAutoProps, ContainerEventMap, GraphicsCustomProps>;
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
export const Graphics = RegisterPixiComponent<PixiGraphics, GraphicsAutoProps, ContainerEventMap, GraphicsCustomProps>('Graphics', {
	create(props) {
		const context = new PixiGraphicsContext()
			.clear().moveTo(0, 0);
		// We force the context to be non-batchable as PIXI might bug out
		// under unknown, random circumstances otherwise
		// (at least I hope this fixed that, as it is really inconsistent)
		context.batchMode = 'no-batch';
		props.draw?.(context);
		const instance = new PixiGraphics({ context });
		return instance;
	},
	applyCustomProps(instance, {
		draw: oldDraw,
	}, {
		draw,
	}) {
		if (oldDraw !== draw) {
			const newContext = new PixiGraphicsContext()
				.clear().moveTo(0, 0);
			// See note in `create`
			newContext.batchMode = 'no-batch';
			draw?.(newContext);
			instance.context = newContext;
		}
	},
	autoProps: GRAPHICS_AUTO_PROPS,
	events: GRAPHICS_EVENTS,
});
