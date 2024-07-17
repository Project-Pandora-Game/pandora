import { Text as PixiText, type IPointData } from 'pixi.js';
import { ParsePixiPointLike, RegisterPixiComponent, type DisplayObjectEventNames, type PixiDisplayObjectWriteableProps } from '../reconciler/component';
import { DISPLAY_OBJECT_AUTO_PROPS, DISPLAY_OBJECT_EVENTS, type DisplayObjectEventMap } from './container';

const TEXT_AUTO_PROPS = {
	...DISPLAY_OBJECT_AUTO_PROPS,
	style: true,
	text: true,
} as const satisfies Readonly<Partial<Record<keyof PixiDisplayObjectWriteableProps<PixiText>, true>>>;

export type TextAutoProps = keyof typeof TEXT_AUTO_PROPS;

const TEXT_EVENTS = {
	...DISPLAY_OBJECT_EVENTS,
} as const satisfies Readonly<Partial<Record<DisplayObjectEventNames<PixiText>, true>>>;

export type TextCustomProps = {
	anchor?: IPointData;
};

export const Text = RegisterPixiComponent<PixiText, TextAutoProps, DisplayObjectEventMap, TextCustomProps>('Text', {
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
