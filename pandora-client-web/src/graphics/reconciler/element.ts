import { Assert, AssertNever, TypedEventEmitter } from 'pandora-common';
import { Container, DisplayObject, utils } from 'pixi.js';
import { PixiComponentIsPrivateProperty, PixiComponentIsSpecialProperty, type PixiComponentConfig, type PixiComponentProps, type PixiDisplayObjectWriteableProps } from './component';

function ElementSupportsChildren(element: DisplayObject): element is Container {
	return 'addChild' in element && typeof element.addChild === 'function';
}

export interface PixiContainerHandle {
	addChild(child: DisplayObject, beforeChild?: DisplayObject): void;
	removeChild(child: DisplayObject): void;
	clearChildren(): void;
}

const PixiInstanceMap = new WeakMap<DisplayObject, PixiInternalContainerInstance<DisplayObject>>();

export abstract class PixiInternalContainerInstance<Element extends DisplayObject> implements PixiContainerHandle {
	public readonly instance: Element;

	constructor(instance: Element) {
		this.instance = instance;
		PixiInstanceMap.set(instance, this);
	}

	public addChild(child: DisplayObject, beforeChild?: DisplayObject): void {
		Assert(ElementSupportsChildren(this.instance), 'This element does not support children');

		if (beforeChild != null) {
			Assert(child !== beforeChild);
			// We need to remove the child first, if this is used as reordering
			if (child.parent === this.instance) {
				this.instance.removeChild(child);
			}

			const index = this.instance.getChildIndex(beforeChild);
			Assert(index >= 0);
			this.instance.addChildAt(child, index);
		} else {
			this.instance.addChild(child);
		}
	}

	public removeChild(child: DisplayObject): void {
		this.instance.removeChild(child);
	}

	public clearChildren(): void {
		Assert(ElementSupportsChildren(this.instance), 'This element does not support children');

		this.instance.removeChildren();
	}

	public abstract emitNeedsUpdate(): void;
}

export class PixiUpdateEmitter extends TypedEventEmitter<{ needsUpdate: DisplayObject; }> {
	public emitNeedsUpdate(object: DisplayObject): void {
		this.emit('needsUpdate', object);
	}
}

export class PixiRootContainer extends PixiInternalContainerInstance<Container> {
	public readonly updateEmitter: PixiUpdateEmitter = new PixiUpdateEmitter();

	constructor(instance: Container) {
		super(instance);
	}

	public emitNeedsUpdate(object?: DisplayObject): void {
		this.updateEmitter.emitNeedsUpdate(object ?? this.instance);
	}
}

/** Instance container for pixi elements. Meant only for internal usage by our fiber. */
export class PixiInternalElementInstance<
	Element extends DisplayObject,
	AutoPropKeys extends (keyof PixiDisplayObjectWriteableProps<Element>),
	EventMap extends (utils.EventEmitter.ValidEventTypes),
	CustomProps,
> extends PixiInternalContainerInstance<Element> {
	public readonly config: PixiComponentConfig<Element, AutoPropKeys, EventMap, CustomProps>;
	public readonly root: PixiRootContainer;

	private readonly _originalValues = new Map<AutoPropKeys, unknown>();
	private _fiberHidden: boolean = false;

	constructor(
		config: PixiComponentConfig<Element, AutoPropKeys, EventMap, CustomProps>,
		initialProps: Readonly<PixiComponentProps<Element, AutoPropKeys, EventMap, CustomProps>>,
		root: PixiRootContainer,
	) {
		super(config.create(initialProps));
		this.config = config;
		this.root = root;
		// Apply initial props (we expect create to apply custom ones first)
		this._applyAutoProps(null, initialProps, Object.keys(initialProps));
	}

	public emitNeedsUpdate() {
		this.root.emitNeedsUpdate(this.instance);
	}

	public commitUpdate(
		prevProps: Readonly<PixiComponentProps<Element, AutoPropKeys, EventMap, CustomProps>>,
		nextProps: Readonly<PixiComponentProps<Element, AutoPropKeys, EventMap, CustomProps>>,
		updatePayload: string[],
	): void {
		this.config.applyCustomProps?.(this.instance, prevProps, nextProps);
		this._applyAutoProps(prevProps, nextProps, updatePayload);
	}

	public hide() {
		this._fiberHidden = true;
		this.instance.visible = false;
	}

	public unhide(props: Readonly<PixiComponentProps<Element, AutoPropKeys, EventMap, CustomProps>>) {
		this._fiberHidden = false;
		this.instance.visible = props.visible !== false;
	}

	private _applyAutoProps(
		prevProps: Readonly<PixiComponentProps<Element, AutoPropKeys, EventMap, CustomProps>> | null,
		nextProps: Readonly<PixiComponentProps<Element, AutoPropKeys, EventMap, CustomProps>>,
		updatePayload: string[],
	): void {
		for (const key of updatePayload) {
			if (PixiComponentIsPrivateProperty(key)) {
				// We can never write private properties.
				continue;
			} else if (PixiComponentIsSpecialProperty(key)) {
				// Apply special properties
				switch (key) {
					case 'visible':
						this.instance.visible = nextProps.visible !== false && !this._fiberHidden;
						break;
					case 'pivot':
						this.instance.pivot.set(nextProps.pivot?.x ?? 0, nextProps.pivot?.y ?? 0);
						break;
					case 'position':
						this.instance.position.set(nextProps.position?.x ?? 0, nextProps.position?.y ?? 0);
						break;
					case 'scale':
						this.instance.scale.set(nextProps.scale?.x ?? 1, nextProps.scale?.y ?? 1);
						break;
					case 'skew':
						this.instance.skew.set(nextProps.skew?.x ?? 0, nextProps.skew?.y ?? 0);
						break;
					default:
						AssertNever(key);
				}
			} else if (Object.prototype.hasOwnProperty.call(this.config.autoProps, key)) {
				// Apply writable props
				const typedKey = key as AutoPropKeys;
				if (nextProps[typedKey] !== undefined) {
					if (!this._originalValues.has(typedKey)) {
						this._originalValues.set(typedKey, this.instance[typedKey]);
					}
					// @ts-expect-error: Intentional - the types are checked by factory.
					this.instance[typedKey] = nextProps[typedKey];
				} else {
					if (this._originalValues.has(typedKey)) {
						// @ts-expect-error: Intentional - we use map for "Optional" detection
						this.instance[typedKey] = this._originalValues.get(typedKey);
						this._originalValues.delete(typedKey);
					}
				}
			} else if (key.startsWith('on')) {
				// Apply events
				const rawEventName = key.substring(2);
				if (Object.prototype.hasOwnProperty.call(this.config.events, rawEventName)) {
					// @ts-expect-error: Intentional - we know we are working with an event by now.
					const oldListener: unknown = prevProps?.[key];
					if (oldListener != null) {
						Assert(typeof oldListener === 'function', 'Old event listener is not a function');
						// @ts-expect-error: Intentional - the types are checked by factory.
						this.instance.removeEventListener(rawEventName, oldListener);
					}
					// @ts-expect-error: Intentional - we know we are working with an event by now.
					const newListener: unknown = nextProps?.[key];
					if (newListener != null) {
						Assert(typeof newListener === 'function', 'Event listener is not a function');
						// @ts-expect-error: Intentional - the types are checked by factory.
						this.instance.addEventListener(rawEventName, newListener);
					}
				}
			}
		}
	}
}

export function PixiElementRequestUpdate(element: DisplayObject): void {
	const instance = PixiInstanceMap.get(element);
	Assert(instance != null, 'Attempt to request update on a PIXI DisplayObject outside of React tree');
	instance.emitNeedsUpdate();
}
