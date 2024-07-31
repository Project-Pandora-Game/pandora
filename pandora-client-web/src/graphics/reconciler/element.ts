import { Assert, AssertNever, GetLogger, TypedEventEmitter, type Logger } from 'pandora-common';
import { Container, DisplayObject, utils } from 'pixi.js';
import { ParsePixiPointLike, PixiComponentIsPrivateProperty, PixiComponentIsSpecialProperty, type PixiComponentConfig, type PixiComponentProps, type PixiDisplayObjectWriteableProps } from './component';

/** Checks if `DisplayObject` supports children - implementing the `Container` interface. */
function ElementSupportsChildren(element: DisplayObject): element is Container {
	return 'addChild' in element && typeof element.addChild === 'function';
}

/** Weak map for getting the internal instance given a managed Pixi display object. */
const PixiInstanceMap = new WeakMap<DisplayObject, PixiInternalContainerInstance<DisplayObject>>();

/**
 * A management class for containing objects that can potentially be used as containers.
 *
 * Note, that it can be used with non-container object too - it checks whether children are allowed or not when one does try to add children.
 */
export abstract class PixiInternalContainerInstance<Element extends DisplayObject> {
	public readonly instance: Element;

	constructor(instance: Element) {
		this.instance = instance;
		PixiInstanceMap.set(instance, this);
	}

	/**
	 * Add a child to the container
	 * @param child - The child to add
	 * @param beforeChild - Existing child that should be used for positioning the `child` - `child` should be places right before it.
	 */
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

	/**
	 * Remove a child from the container
	 * @param child - The child to remove
	 */
	public removeChild(child: DisplayObject): void {
		this.instance.removeChild(child);
	}

	/**
	 * Remove all children from the container
	 */
	public clearChildren(): void {
		Assert(ElementSupportsChildren(this.instance), 'This element does not support children');

		this.instance.removeChildren();
	}

	/** Signal that this element needs to be rendered */
	public abstract emitNeedsUpdate(): void;
}

/** A helper class for emitting update requests. */
export class PixiUpdateEmitter extends TypedEventEmitter<{ needsUpdate: DisplayObject; }> {
	public emitNeedsUpdate(object: DisplayObject): void {
		this.emit('needsUpdate', object);
	}
}

/**
 * Class for cotaning an _externally managed_ pixi instance.
 * This class is used to wrap the root everything is attached to.
 */
export class PixiRootContainer extends PixiInternalContainerInstance<Container> {
	public readonly updateEmitter: PixiUpdateEmitter = new PixiUpdateEmitter();

	/**
	 * List of all elements that were created under this root.
	 * It is used to make sure all created elements are definitely cleaned up when the root unmounts,
	 * avoiding any potential leaks when screens change.
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public readonly instantiatedElements = new Set<PixiInternalElementInstance<any, any, any, any>>();

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
	/** The type of the element - the string passed to `uniqueName` of `RegisterPixiComponent`. */
	public readonly type: string;
	/** The config for working with this element - as passed to `RegisterPixiComponent`. */
	public readonly config: PixiComponentConfig<Element, AutoPropKeys, EventMap, CustomProps>;
	/** Root container for which this element was created. Used for signaling that it needs an update. */
	public readonly root: PixiRootContainer;

	/** Map of original values to be restored if auto-prop that was set before changes to `undefined` */
	private readonly _originalValues = new Map<AutoPropKeys, unknown>();
	/** If fiber is signaling us that this instance should be hidden */
	private _fiberHidden: boolean = false;
	/** If this instance has already been destroyed */
	private _destroyed: boolean = false;

	constructor(
		type: string,
		config: PixiComponentConfig<Element, AutoPropKeys, EventMap, CustomProps>,
		initialProps: Readonly<PixiComponentProps<Element, AutoPropKeys, EventMap, CustomProps>>,
		root: PixiRootContainer,
	) {
		super(config.create(initialProps));
		this.type = type;
		this.config = config;
		this.root = root;
		// Track the created element
		this.root.instantiatedElements.add(this);
		// Apply initial props (we expect create to apply custom ones first)
		this._applyAutoProps(null, initialProps, Object.keys(initialProps));
	}

	private _getLogger(): Logger {
		return GetLogger('PixiElementInstance', `[PixiElementInstance ${this.type}]`);
	}

	public emitNeedsUpdate() {
		this.root.emitNeedsUpdate(this.instance);
	}

	/**
	 * Apply modified props
	 * @param prevProps - The props that were used the last time
	 * @param nextProps - The new props to update to
	 * @param updatePayload - List of changed prop keys
	 */
	public commitUpdate(
		prevProps: Readonly<PixiComponentProps<Element, AutoPropKeys, EventMap, CustomProps>>,
		nextProps: Readonly<PixiComponentProps<Element, AutoPropKeys, EventMap, CustomProps>>,
		updatePayload: string[],
	): void {
		if (this.instance.destroyed) {
			if (!this._destroyed) {
				this._getLogger().error('Attempt to commit update on a destroyed instance. The instance was not destroyed by the fiber!');
			} else {
				this._getLogger().error('Attempt to commit update on a destroyed instance.');
			}
			throw new Error('Attempt to commit update on a destroyed instance');
		}

		this.config.applyCustomProps?.(this.instance, prevProps, nextProps);
		this._applyAutoProps(prevProps, nextProps, updatePayload);
	}

	/** Hide this instance, marking it as "hidden by fiber" */
	public hide() {
		this._fiberHidden = true;
		this.instance.visible = false;
	}

	/**
	 * Undo instance hide.
	 * @param props - Props that were used as part of last update
	 */
	public unhide(props: Readonly<PixiComponentProps<Element, AutoPropKeys, EventMap, CustomProps>>) {
		this._fiberHidden = false;
		this.instance.visible = props.visible !== false;
	}

	/**
	 * Destroy this instance, cleaning up anything that needs that.
	 * It is safe to call this method multiple times.
	 * After destroy the object can never be used again.
	 */
	public destroy() {
		if (this.instance.destroyed) {
			if (!this._destroyed) {
				this._getLogger().warning('Attempt to destroy already destroyed instance. The instance was not destroyed by the fiber!');
				this._destroyed = true;
				this.root.instantiatedElements.delete(this);
			} else {
				// We get called twice here, for some reason...
				// We can safely ignore this, as it doesn't seem to be causing any issues.
			}
			return;
		}

		// By now children should have been removed by the fiber
		if (ElementSupportsChildren(this.instance)) {
			if (this.instance.children.length > 0) {
				this._getLogger().warning('Destroying instance that has children!');
			}
		}

		// Mark us as destroyed and remove us from alive elements tracking
		this._destroyed = true;
		this.root.instantiatedElements.delete(this);

		this.instance.destroy({
			baseTexture: false,
			texture: false,
			children: false,
		});
		Assert(this.instance.destroyed);
	}

	/** Automatic updates of autoProps */
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
						this.instance.pivot.set(...ParsePixiPointLike(nextProps.pivot, 0, 0));
						break;
					case 'position':
						this.instance.position.set(...ParsePixiPointLike(nextProps.position, 0, 0));
						break;
					case 'scale':
						this.instance.scale.set(...ParsePixiPointLike(nextProps.scale, 1, 1));
						break;
					case 'skew':
						this.instance.skew.set(...ParsePixiPointLike(nextProps.skew, 0, 0));
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

/**
 * Manually request a render of a specific element.
 * The element must be one managed by a Pixi Fiber.
 * @param element - The element that needs to be updated
 */
export function PixiElementRequestUpdate(element: DisplayObject): void {
	const instance = PixiInstanceMap.get(element);
	Assert(instance != null, 'Attempt to request update on a PIXI DisplayObject outside of React tree');
	instance.emitNeedsUpdate();
}
