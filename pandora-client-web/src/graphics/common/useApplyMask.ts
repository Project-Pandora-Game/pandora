import type { Container } from 'pixi.js';
import { useCallback, useMemo, useRef, type RefCallback } from 'react';

export function usePixiApplyMask(): readonly [maskRef: RefCallback<Container>, targetRef: RefCallback<Container>] {
	const mask = useRef<Container | null>(null);
	const target = useRef<Container | null>(null);

	const setMask = useCallback((maskRef: Container | null) => {
		if (mask.current != null) {
			mask.current.visible = false;
		}
		mask.current = maskRef;
		if (maskRef) {
			maskRef.visible = target.current != null;
		}
		if (target.current) {
			target.current.mask = maskRef;
		}
	}, []);
	const setTarget = useCallback((targetRef: Container | null) => {
		if (target.current != null) {
			target.current.mask = null;
		}
		target.current = targetRef;
		if (mask.current) {
			mask.current.visible = targetRef != null;
		}
		if (targetRef) {
			targetRef.mask = mask.current;
		}
	}, []);

	return [setMask, setTarget];
}

export function usePixiMaskSource(): PixiMaskSource {
	const maskSource = useRef<PixiMaskSource>(undefined);
	if (maskSource.current === undefined) {
		maskSource.current = new PixiMaskSource();
	}

	return maskSource.current;
}

export function usePixiApplyMaskSource(maskSource: PixiMaskSource | null): RefCallback<Container> | undefined {
	return useMemo(() => maskSource?.createTargetHandler(), [maskSource]);
}

export class PixiMaskSource {
	private _mask: Container | null = null;
	private readonly _targets = new Set<Container>();

	public readonly maskRef: RefCallback<Container> = (newMask) => {
		if (this._mask === newMask)
			return;

		if (this._mask != null) {
			for (const target of this._targets) {
				target.mask = null;
			}
			PixiMaskSource._resetMask(this._mask);
		}
		this._mask = newMask;
		if (newMask != null) {
			for (const target of this._targets) {
				target.mask = newMask;
			}
			PixiMaskSource._setupMask(newMask);
		}
	};

	public createTargetHandler(): RefCallback<Container> {
		let lastTarget: Container | null = null;

		return (targetRef) => {
			if (targetRef === lastTarget)
				return;

			if (lastTarget != null) {
				this._removeTarget(lastTarget);
			}
			lastTarget = targetRef;
			if (targetRef != null) {
				this._addTarget(targetRef);
			}
		};
	}

	private _removeTarget(target: Container): void {
		target.mask = null;
		this._targets.delete(target);
		if (this._mask != null) {
			if (this._targets.size > 0) {
				PixiMaskSource._setupMask(this._mask);
			} else {
				PixiMaskSource._resetMask(this._mask);
			}
		}
	}

	private _addTarget(target: Container): void {
		this._targets.add(target);
		if (this._mask != null) {
			target.mask = this._mask;
			PixiMaskSource._setupMask(this._mask);
		}
	}

	private static _setupMask(mask: Container): void {
		mask.measurable = false;
		mask.includeInBuild = false;
		mask.visible = true;
	}

	private static _resetMask(mask: Container): void {
		mask.visible = false;
		mask.measurable = true;
		mask.includeInBuild = true;
	}
}
