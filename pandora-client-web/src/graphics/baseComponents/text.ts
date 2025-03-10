import { Text as PixiText, type PointData } from 'pixi.js';
import { ParsePixiPointLike, RegisterPixiComponent, type DisplayObjectEventNames, type PixiDisplayObjectWriteableProps } from '../reconciler/component.ts';
import { CONTAINER_AUTO_PROPS, CONTAINER_EVENTS, type ContainerEventMap } from './container.ts';

const TEXT_AUTO_PROPS = {
	...CONTAINER_AUTO_PROPS,
	style: true,
	text: true,
} as const satisfies Readonly<Partial<Record<keyof PixiDisplayObjectWriteableProps<PixiText>, true>>>;

export type TextAutoProps = keyof typeof TEXT_AUTO_PROPS;

const TEXT_EVENTS = {
	...CONTAINER_EVENTS,
} as const satisfies Readonly<Partial<Record<DisplayObjectEventNames<PixiText>, true>>>;

export type TextCustomProps = {
	anchor?: PointData;
};

/**
 * A Text Object will create a line or multiple lines of text.
 *
 * The text is created using the [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API).
 *
 * The primary advantage of this class over BitmapText is that you have great control over the style of the text,
 * which you can change at runtime.
 *
 * The primary disadvantages is that each piece of text has it's own texture, which can use more memory.
 * When text changes, this texture has to be re-generated and re-uploaded to the GPU, taking up time.
 *
 * To split a line you can use '\n' in your text string, or, on the `style` object,
 * change its `wordWrap` property to true and and give the `wordWrapWidth` property a value.
 */
export const Text = RegisterPixiComponent<PixiText, TextAutoProps, ContainerEventMap, TextCustomProps>('Text', {
	create(props) {
		const instance = new PixiText();
		if (props.anchor != null) {
			instance.anchor.set(...ParsePixiPointLike(props.anchor, 0, 0));
		}
		return instance;
	},
	applyCustomProps(instance, oldProps, newProps) {
		if (oldProps.anchor !== newProps.anchor) {
			instance.anchor.set(...ParsePixiPointLike(newProps.anchor, 0, 0));
		}
	},
	autoProps: TEXT_AUTO_PROPS,
	events: TEXT_EVENTS,
});
