import { omit } from 'lodash-es';
import { KnownObject } from 'pandora-common';
import { Container as PixiContainer, type Ticker } from 'pixi.js';
import { CONTAINER_AUTO_PROPS, CONTAINER_EVENTS, type ContainerAutoProps, type ContainerEventMap } from '../../baseComponents/container.ts';
import { ParsePixiPointLike, RegisterPixiComponent, type DisplayObjectSpecialProps, type PixiDisplayObjectWriteableProps } from '../../reconciler/component.ts';
import { PixiElementRequestUpdate } from '../../reconciler/element.ts';
import type { TickerRef } from '../../reconciler/tick.ts';
import { MakeTransitionProcessorNumberWithModulo, TRANSITION_PROCESSOR_NUMBER, TransitionHandler } from './transitionHandler.ts';

const TRANSITIONS = {
	x: true,
	y: true,
	angle: true,
	alpha: true,
} as const satisfies Readonly<Partial<Record<ContainerAutoProps, true>>>;

type ExtraTransitionableValues = {
	pivotX: number;
	pivotY: number;
	scaleX: number;
	scaleY: number;
	skewX: number;
	skewY: number;
	zIndex: number | undefined;
};
type TransitionableValues = Pick<PixiDisplayObjectWriteableProps<PixiContainer>, keyof typeof TRANSITIONS> & ExtraTransitionableValues;
export type TransitionedContainerTransitionableProps = keyof TransitionableValues;

export const TRANSITIONED_CONTAINER_AUTO_PROPS = omit(CONTAINER_AUTO_PROPS, ...KnownObject.keys(TRANSITIONS), 'zIndex');
export type TransitionedContainerAutoProps = keyof typeof TRANSITIONED_CONTAINER_AUTO_PROPS;

export const TRANSITIONED_CONTAINER_EVENTS = CONTAINER_EVENTS;
export type TransitionedContainerEventMap = ContainerEventMap;

export type TransitionedContainerCustomProps = Partial<TransitionableValues> & {
	tickerRef: TickerRef;
	transitionDuration: number;
	transitionDelay?: number;
	/** Handler that is called right after transitions are applied. */
	onTransitionTick?: (container: PixiTransitionedContainer) => void;

	perPropertyTransitionDuration?: Partial<Record<TransitionedContainerTransitionableProps, number>>;
	perPropertyTransitionDelay?: Partial<Record<TransitionedContainerTransitionableProps, number>>;
};

/**
 * Container is a general-purpose display object that holds children. It also adds built-in support for advanced
 * rendering features like masking and filtering.
 *
 * It is the base class of all display objects that act as a container for other objects, including Graphics
 * and Sprite.
 */
export const TransitionedContainer = RegisterPixiComponent<PixiTransitionedContainer, TransitionedContainerAutoProps, TransitionedContainerEventMap, TransitionedContainerCustomProps>('TransitionedContainer', {
	create(props) {
		return new PixiTransitionedContainer(props);
	},
	applyCustomProps(instance, oldProps, newProps) {
		instance.applyProps(oldProps, newProps);
	},
	applySkipSpecialPropsApply: {
		position: true,
		pivot: true,
		scale: true,
		skew: true,
	},
	autoProps: TRANSITIONED_CONTAINER_AUTO_PROPS,
	events: CONTAINER_EVENTS,
});

const DefaultValues: TransitionableValues = {
	x: 0,
	y: 0,
	angle: 0,
	alpha: 1,
	pivotX: 0,
	pivotY: 0,
	scaleX: 1,
	scaleY: 1,
	skewX: 0,
	skewY: 0,
	zIndex: undefined,
};

type AppliedProps = TransitionedContainerCustomProps & Readonly<Partial<DisplayObjectSpecialProps>>;

export class PixiTransitionedContainer extends PixiContainer {
	private _transitionHandlers: {
		[prop in keyof TransitionableValues]: TransitionHandler<TransitionableValues[prop]>;
	};

	private _onTransitionTick?: (container: PixiTransitionedContainer) => void;

	constructor(props: AppliedProps) {
		super();
		this._onTransitionTick = props.onTransitionTick;

		// Init the transition handlers (needs to be done manually due to possibility of different transition functions)
		this._transitionHandlers = this._createTransitionHandlers(props);
		this._onTransitionTick?.(this); // Notify about change immediately as creation already applies the props

		// Init ticker ref
		props.tickerRef.current = this._onTick;
	}

	private _createTransitionHandlers({ transitionDuration, transitionDelay, perPropertyTransitionDuration, perPropertyTransitionDelay, ...initialValues }: AppliedProps): typeof this._transitionHandlers {
		const position = ParsePixiPointLike(initialValues.position, DefaultValues.x, DefaultValues.y);
		const pivot = ParsePixiPointLike(initialValues.pivot, DefaultValues.pivotX, DefaultValues.pivotY);
		const scale = ParsePixiPointLike(initialValues.scale, DefaultValues.scaleX, DefaultValues.scaleY);
		const skew = ParsePixiPointLike(initialValues.skew, DefaultValues.skewX, DefaultValues.skewY);

		return {
			x: new TransitionHandler<number>({
				transitionDuration: perPropertyTransitionDuration?.x ?? transitionDuration,
				transitionDelay: perPropertyTransitionDelay?.x ?? transitionDelay,
				valueProcessor: TRANSITION_PROCESSOR_NUMBER,
				applyValue: (newValue) => {
					this.x = newValue;
				},
			}, initialValues.x ?? position[0]),
			y: new TransitionHandler<number>({
				transitionDuration: perPropertyTransitionDuration?.y ?? transitionDuration,
				transitionDelay: perPropertyTransitionDelay?.y ?? transitionDelay,
				valueProcessor: TRANSITION_PROCESSOR_NUMBER,
				applyValue: (newValue) => {
					this.y = newValue;
				},
			}, initialValues.y ?? position[1]),
			angle: new TransitionHandler<number>({
				transitionDuration: perPropertyTransitionDuration?.angle ?? transitionDuration,
				transitionDelay: perPropertyTransitionDelay?.angle ?? transitionDelay,
				valueProcessor: MakeTransitionProcessorNumberWithModulo(360),
				applyValue: (newValue) => {
					this.angle = newValue;
				},
			}, initialValues.angle ?? DefaultValues.angle),
			alpha: new TransitionHandler<number>({
				transitionDuration: perPropertyTransitionDuration?.alpha ?? transitionDuration,
				transitionDelay: perPropertyTransitionDelay?.alpha ?? transitionDelay,
				valueProcessor: TRANSITION_PROCESSOR_NUMBER,
				applyValue: (newValue) => {
					this.alpha = newValue;
				},
			}, initialValues.alpha ?? DefaultValues.alpha),
			pivotX: new TransitionHandler<number>({
				transitionDuration: perPropertyTransitionDuration?.pivotX ?? transitionDuration,
				transitionDelay: perPropertyTransitionDelay?.pivotX ?? transitionDelay,
				valueProcessor: TRANSITION_PROCESSOR_NUMBER,
				applyValue: (newValue) => {
					this.pivot.x = newValue;
				},
			}, pivot[0]),
			pivotY: new TransitionHandler<number>({
				transitionDuration: perPropertyTransitionDuration?.pivotY ?? transitionDuration,
				transitionDelay: perPropertyTransitionDelay?.pivotY ?? transitionDelay,
				valueProcessor: TRANSITION_PROCESSOR_NUMBER,
				applyValue: (newValue) => {
					this.pivot.y = newValue;
				},
			}, pivot[1]),
			scaleX: new TransitionHandler<number>({
				transitionDuration: perPropertyTransitionDuration?.scaleX ?? transitionDuration,
				transitionDelay: perPropertyTransitionDelay?.scaleX ?? transitionDelay,
				valueProcessor: TRANSITION_PROCESSOR_NUMBER,
				applyValue: (newValue) => {
					this.scale.x = newValue;
				},
			}, scale[0]),
			scaleY: new TransitionHandler<number>({
				transitionDuration: perPropertyTransitionDuration?.scaleY ?? transitionDuration,
				transitionDelay: perPropertyTransitionDelay?.scaleY ?? transitionDelay,
				valueProcessor: TRANSITION_PROCESSOR_NUMBER,
				applyValue: (newValue) => {
					this.scale.y = newValue;
				},
			}, scale[1]),
			skewX: new TransitionHandler<number>({
				transitionDuration: perPropertyTransitionDuration?.skewX ?? transitionDuration,
				transitionDelay: perPropertyTransitionDelay?.skewX ?? transitionDelay,
				valueProcessor: TRANSITION_PROCESSOR_NUMBER,
				applyValue: (newValue) => {
					this.skew.x = newValue;
				},
			}, skew[0]),
			skewY: new TransitionHandler<number>({
				transitionDuration: perPropertyTransitionDuration?.skewY ?? transitionDuration,
				transitionDelay: perPropertyTransitionDelay?.skewY ?? transitionDelay,
				valueProcessor: TRANSITION_PROCESSOR_NUMBER,
				applyValue: (newValue) => {
					this.skew.y = newValue;
				},
			}, skew[1]),
			zIndex: new TransitionHandler<number | undefined>({
				transitionDuration: perPropertyTransitionDuration?.zIndex ?? transitionDuration,
				transitionDelay: perPropertyTransitionDelay?.zIndex ?? transitionDelay,
				// zIndex should be to finite numbers
				valueProcessor: {
					isTransitionable(a, b) {
						return Number.isFinite(a) && Number.isFinite(b);
					},
					mix(a, b, ratio) {
						if (a === undefined || !Number.isFinite(a) || b === undefined || !Number.isFinite(b)) {
							return ratio < .5 ? a : b;
						}
						return Math.round((1 - ratio) * a + ratio * b);
					},
				},
				applyValue: (newValue) => {
					// Only write value, if it actually is set.
					// Writing to zIndex has side-effects outside of this element! (it modifies parent, if there is one already)
					if (newValue === undefined) {
						if (this.zIndex !== 0) {
							this.zIndex = 0;
						}
						return;
					}
					this.zIndex = newValue;
				},
			}, initialValues.zIndex),
		};
	}

	public applyProps(oldProps: AppliedProps, newProps: AppliedProps) {
		// Update ticker
		if (oldProps.tickerRef !== newProps.tickerRef) {
			oldProps.tickerRef.current = null;
			newProps.tickerRef.current = this._onTick;
		}
		this._onTransitionTick = newProps.onTransitionTick;

		// If any transition properties changed, we need to regenerate the containers (they don't support updating the transition properties)
		if (oldProps.transitionDuration !== newProps.transitionDuration ||
			oldProps.transitionDelay !== newProps.transitionDelay ||
			oldProps.perPropertyTransitionDuration !== newProps.perPropertyTransitionDuration ||
			oldProps.perPropertyTransitionDelay !== newProps.perPropertyTransitionDelay
		) {
			this._transitionHandlers = this._createTransitionHandlers(newProps);
			this._onTransitionTick?.(this); // Notify about change immediately as creation already applies the props
			this._requestUpdate();
			return;
		}

		// Update all the properties
		let needsUpdate = false;

		if (oldProps.x !== newProps.x || oldProps.y !== newProps.y || oldProps.position !== newProps.position) {
			const position = ParsePixiPointLike(newProps.position, DefaultValues.x, DefaultValues.y);
			this._transitionHandlers.x.setValue(newProps.x ?? position[0]);
			needsUpdate ||= this._transitionHandlers.x.needsUpdate;
			this._transitionHandlers.y.setValue(newProps.y ?? position[1]);
			needsUpdate ||= this._transitionHandlers.y.needsUpdate;
		}

		if (oldProps.angle !== newProps.angle) {
			this._transitionHandlers.angle.setValue(newProps.angle ?? DefaultValues.angle);
			needsUpdate ||= this._transitionHandlers.angle.needsUpdate;
		}

		if (oldProps.alpha !== newProps.alpha) {
			this._transitionHandlers.alpha.setValue(newProps.alpha ?? DefaultValues.alpha);
			needsUpdate ||= this._transitionHandlers.alpha.needsUpdate;
		}

		if (oldProps.pivot !== newProps.pivot) {
			const pivot = ParsePixiPointLike(newProps.pivot, DefaultValues.pivotX, DefaultValues.pivotY);

			this._transitionHandlers.pivotX.setValue(pivot[0]);
			needsUpdate ||= this._transitionHandlers.pivotX.needsUpdate;
			this._transitionHandlers.pivotY.setValue(pivot[1]);
			needsUpdate ||= this._transitionHandlers.pivotY.needsUpdate;
		}
		if (oldProps.scale !== newProps.scale) {
			const scale = ParsePixiPointLike(newProps.scale, DefaultValues.scaleX, DefaultValues.scaleY);

			this._transitionHandlers.scaleX.setValue(scale[0]);
			needsUpdate ||= this._transitionHandlers.scaleX.needsUpdate;
			this._transitionHandlers.scaleY.setValue(scale[1]);
			needsUpdate ||= this._transitionHandlers.scaleY.needsUpdate;
		}
		if (oldProps.skew !== newProps.skew) {
			const skew = ParsePixiPointLike(newProps.skew, DefaultValues.skewX, DefaultValues.skewY);

			this._transitionHandlers.skewX.setValue(skew[0]);
			needsUpdate ||= this._transitionHandlers.skewX.needsUpdate;
			this._transitionHandlers.skewY.setValue(skew[1]);
			needsUpdate ||= this._transitionHandlers.skewY.needsUpdate;
		}

		if (oldProps.zIndex !== newProps.zIndex) {
			this._transitionHandlers.zIndex.setValue(newProps.zIndex);
			needsUpdate ||= this._transitionHandlers.zIndex.needsUpdate;
		}

		if (needsUpdate) {
			this._requestUpdate();
		}
	}

	private readonly _onTick = (ticker: Ticker): void => {
		if (this.destroyed)
			return;

		// HACK: Is there really no way to get currentTime out of the ticker?
		const now = ticker.lastTime + ticker.elapsedMS;

		let needsFurtherUpdates = false;
		for (const transition of KnownObject.values(this._transitionHandlers)) {
			if (transition.needsUpdate) {
				transition.tick(now);
				needsFurtherUpdates ||= transition.needsUpdate;
			}
		}

		this._onTransitionTick?.(this);
		if (needsFurtherUpdates) {
			this._requestUpdate();
		}
	};

	private _requestUpdate() {
		PixiElementRequestUpdate(this);
	}
}
