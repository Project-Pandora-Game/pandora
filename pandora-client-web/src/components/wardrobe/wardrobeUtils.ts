import type { Immutable } from 'immer';
import {
	AppearanceActionProcessingContext,
	AppearanceActionProcessingResult,
	AppearanceItems,
	EMPTY_ARRAY,
	Item,
	ItemInteractionType,
	ItemPath,
	SplitContainerPath,
	type ActionTargetSelector,
	type ItemContainerPath,
} from 'pandora-common';
import { useMemo } from 'react';
import { useCheckAddPermissions } from '../gameContext/permissionCheckProvider.tsx';
import { useWardrobeActionContext } from './wardrobeActionContext.tsx';
import type { WardrobeFocus } from './wardrobeTypes.ts';

export function WardrobeFocusesItem(focus: Immutable<WardrobeFocus>): focus is ItemPath {
	return focus.itemId != null;
}

export function useWardrobeTargetItems(target: ActionTargetSelector | null): AppearanceItems {
	const { globalState } = useWardrobeActionContext();

	const items = useMemo<AppearanceItems | null>(() => {
		if (target == null)
			return null;

		return globalState.getItems(target);
	}, [globalState, target]);

	return items ?? EMPTY_ARRAY;
}

export function useWardrobeTargetItem(target: ActionTargetSelector | null, itemPath: ItemPath | null | undefined): Item | undefined {
	const items = useWardrobeTargetItems(target);

	return useMemo(() => {
		if (!itemPath)
			return undefined;

		const { container, itemId } = itemPath;

		let current: AppearanceItems = items;
		for (const step of container) {
			const item = current.find((it) => it.id === step.item);
			if (!item)
				return undefined;
			current = item.getModuleItems(step.module);
		}
		return current.find((it) => it.id === itemId);
	}, [items, itemPath]);
}

export function useWardrobeContainerAccessCheck(target: ActionTargetSelector, container: ItemContainerPath): AppearanceActionProcessingResult {
	const { actions, globalState } = useWardrobeActionContext();

	const containerAccessCheckInitial = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions, globalState);
		const actionTarget = processingContext.getTarget(target);
		if (actionTarget == null)
			return processingContext.invalid();

		const containerPath = SplitContainerPath(container);
		if (containerPath != null) {
			processingContext.checkCanUseItemModule(actionTarget, containerPath.itemPath, containerPath.module, ItemInteractionType.MODIFY);
		}

		return processingContext.finalize();
	}, [actions, globalState, target, container]);

	return useCheckAddPermissions(containerAccessCheckInitial);
}

export function GetVisibleBoneName(name: string): string {
	return name
		.replace(/^\w/, (c) => c.toUpperCase())
		.replace(/_r$/, () => ' Right')
		.replace(/_l$/, () => ' Left')
		.replace(/_\w/g, (c) => ' ' + c.charAt(1).toUpperCase());
}
