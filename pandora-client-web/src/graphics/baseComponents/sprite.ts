import { Sprite as PixiSprite } from 'pixi.js';
import { ParsePixiPointLike, RegisterPixiComponent, type DisplayObjectEventNames, type PixiDisplayObjectWriteableProps, type PixiPointLike } from '../reconciler/component';
import { DISPLAY_OBJECT_AUTO_PROPS, DISPLAY_OBJECT_EVENTS, type DisplayObjectEventMap } from './container';

const SPRITE_AUTO_PROPS = {
	...DISPLAY_OBJECT_AUTO_PROPS,
	texture: true,
	tint: true,
	width: true,
	height: true,
} as const satisfies Readonly<Partial<Record<keyof PixiDisplayObjectWriteableProps<PixiSprite>, true>>>;

export type SpriteAutoProps = keyof typeof SPRITE_AUTO_PROPS;

const SPRITE_EVENTS = {
	...DISPLAY_OBJECT_EVENTS,
} as const satisfies Readonly<Partial<Record<DisplayObjectEventNames<PixiSprite>, true>>>;

export type SpriteCustomProps = {
	anchor?: PixiPointLike;
};

/**
 * The Sprite object is the base for all textured objects that are rendered to the screen.
 */
export const Sprite = RegisterPixiComponent<PixiSprite, SpriteAutoProps, DisplayObjectEventMap, SpriteCustomProps>('Sprite', {
	create(props) {
		const instance = new PixiSprite();
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
	autoProps: SPRITE_AUTO_PROPS,
	events: SPRITE_EVENTS,
});
