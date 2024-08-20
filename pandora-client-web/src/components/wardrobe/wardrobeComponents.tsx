import classNames from 'classnames';
import _ from 'lodash';
import { nanoid } from 'nanoid';
import {
	AppearanceAction,
	AppearanceActionProblem,
	AppearanceActionProcessingResult,
	AppearanceActionRandomize,
	AssertNever,
	Asset,
	EMPTY_ARRAY,
	IsNotNullable,
	type AppearanceActionData,
} from 'pandora-common';
import React, { ReactElement, useEffect, useMemo, useReducer, useState } from 'react';
import { z } from 'zod';
import { AppearanceActionProblemShouldHide, RenderAppearanceActionProblem } from '../../assets/appearanceValidation';
import { useAssetManager } from '../../assets/assetManager';
import { useGraphicsUrl } from '../../assets/graphicsManager';
import { BrowserStorage } from '../../browserStorage';
import { CommonProps } from '../../common/reactTypes';
import { USER_DEBUG } from '../../config/Environment';
import { useAssetPreferenceVisibilityCheck } from '../../graphics/graphicsCharacter';
import { useObservable } from '../../observable';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks';
import { Button, ButtonProps, IconButton } from '../common/button/button';
import { Column } from '../common/container/container';
import { HoverElement } from '../hoverElement/hoverElement';
import { useStaggeredAppearanceActionResult } from './wardrobeCheckQueue';
import { useWardrobeContext, useWardrobeExecuteChecked } from './wardrobeContext';

export function ActionWarningContent({ problems, prompt }: { problems: readonly AppearanceActionProblem[]; prompt: boolean; }): ReactElement {
	const { wardrobeItemDisplayNameType } = useAccountSettings();
	const assetManager = useAssetManager();
	const reasons = useMemo(() => (
		_.uniq(
			problems
				.map((problem) => RenderAppearanceActionProblem(assetManager, problem, wardrobeItemDisplayNameType))
				.filter(Boolean),
		)
	), [assetManager, problems, wardrobeItemDisplayNameType]);

	if (reasons.length === 0) {
		return (
			<>
				This action isn't possible.
			</>
		);
	}

	let text = "This action isn't possible, because:";
	if (prompt) {
		text = 'Executing the action will prompt for the following permissions:';
	}

	return (
		<>
			{ text }
			<ul>
				{
					reasons.map((reason, i) => (<li key={ i }>{ reason }</li>))
				}
			</ul>
		</>
	);
}

export function ActionWarning({ problems, prompt, parent }: { problems: readonly AppearanceActionProblem[]; prompt: boolean; parent: HTMLElement | null; }) {
	if (problems.length === 0) {
		return null;
	}

	return (
		<HoverElement parent={ parent } className='action-warning display-linebreak'>
			<ActionWarningContent problems={ problems } prompt={ prompt } />
		</HoverElement>
	);
}

export function WardrobeActionButton({
	Element = 'button',
	id,
	className,
	children,
	action,
	autohide = false,
	hideReserveSpace = false,
	showActionBlockedExplanation = true,
	onExecute,
	onFailure,
	disabled = false,
}: CommonProps & {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	Element?: 'button' | 'div';
	action: AppearanceAction;
	/** If the button should hide on certain invalid states */
	autohide?: boolean;
	/** Makes the button hide if it should in a way, that occupied space is preserved */
	hideReserveSpace?: boolean;
	showActionBlockedExplanation?: boolean;
	onExecute?: (data: readonly AppearanceActionData[]) => void;
	onFailure?: (problems: readonly AppearanceActionProblem[]) => void;
	disabled?: boolean;
}): ReactElement {
	const { actionPreviewState, showHoverPreview } = useWardrobeContext();
	const [ref, setRef] = useState<HTMLElement | null>(null);
	const [isHovering, setIsHovering] = useState(false);

	const check = useStaggeredAppearanceActionResult(action);
	const hide = check != null && autohide && check.problems.some(AppearanceActionProblemShouldHide);
	const [execute, processing] = useWardrobeExecuteChecked(action, check, {
		onSuccess: onExecute,
		onFailure,
	});

	const finalProblems: readonly AppearanceActionProblem[] = check?.problems ?? EMPTY_ARRAY;

	useEffect(() => {
		if (!isHovering || !showHoverPreview || check == null || !check.valid || finalProblems.length > 0)
			return;

		const previewState = check.resultState;

		actionPreviewState.value = previewState;

		return () => {
			if (actionPreviewState.value === previewState) {
				actionPreviewState.value = null;
			}
		};
	}, [isHovering, showHoverPreview, actionPreviewState, check, finalProblems]);

	return (
		<Element
			id={ id }
			ref={ setRef }
			tabIndex={ 0 }
			className={ classNames(
				'wardrobeActionButton',
				className,
				CheckResultToClassName(check),
				hide ? (hideReserveSpace ? 'invisible' : 'hidden') : null,
			) }
			onClick={ (ev) => {
				ev.stopPropagation();
				execute();
			} }
			onMouseEnter={ () => {
				setIsHovering(true);
			} }
			onMouseLeave={ () => {
				setIsHovering(false);
			} }
			disabled={ processing || disabled }
			data-action={ USER_DEBUG ? JSON.stringify(action, undefined, '\t') : undefined }
			data-action-localproblems={ (USER_DEBUG && check != null) ? JSON.stringify(check.problems, undefined, '\t') : undefined }
		>
			{
				showActionBlockedExplanation && check != null ? (
					<ActionWarning problems={ finalProblems } prompt={ !check.valid && check.prompt != null } parent={ ref } />
				) : null
			}
			{ children }
		</Element>
	);
}

function CheckResultToClassName(result: AppearanceActionProcessingResult | null): string {
	if (result == null)
		return 'pending';
	if (result.valid)
		return 'allowed';
	if (result.prompt != null)
		return 'promptRequired';

	return 'blocked';
}

export const MIN_RANDOMIZE_UPDATE_INTERVAL = 10;
export const WardrobeActionRandomizeUpdateInterval = BrowserStorage.create('wardrobe-action-randomize-update-interval', 800, z.number().min(0).max(10000));

export function WardrobeActionRandomizeButton({
	kind,
}: {
	kind: z.infer<typeof AppearanceActionRandomize>['kind'];
}) {
	const { showHoverPreview } = useWardrobeContext();
	const [seed, newSeed] = useReducer(() => nanoid(), nanoid());
	const updateInterval = useObservable(WardrobeActionRandomizeUpdateInterval);

	useEffect(() => newSeed(), [newSeed]);
	useEffect(() => {
		if (!showHoverPreview || updateInterval < MIN_RANDOMIZE_UPDATE_INTERVAL)
			return undefined;

		const timeout = setInterval(newSeed, updateInterval);
		return () => {
			clearTimeout(timeout);
		};
	}, [showHoverPreview, updateInterval, newSeed]);

	let text;
	switch (kind) {
		case 'items':
			text = 'Randomize clothes';
			break;
		case 'full':
			text = 'Randomize everything';
			break;
		default:
			AssertNever(kind);
	}

	return (
		<WardrobeActionButton onExecute={ newSeed } action={ { type: 'randomize', kind, seed } } >
			{ text }
		</WardrobeActionButton>
	);
}

export function AttributeButton({ attribute, ...buttonProps }: {
	attribute: string;
} & Omit<ButtonProps, 'children'>): ReactElement {
	const assetManager = useAssetManager();
	const [buttonRef, setButtonRef] = useState<HTMLButtonElement | null>(null);

	const attributeDefinition = assetManager.getAttributeDefinition(attribute);

	const icon = useGraphicsUrl(attributeDefinition?.icon);

	return (
		<>
			{ icon ? (
				<IconButton ref={ setButtonRef }
					{ ...buttonProps }
					src={ icon }
					alt={ attributeDefinition?.name ?? `[UNKNOWN ATTRIBUTE '${attribute}']` }
				/>
			) : (
				<Button ref={ setButtonRef } { ...buttonProps } className={ classNames(buttonProps.className, 'iconHeightButton') } >
					{ attributeDefinition?.name ?? `[UNKNOWN ATTRIBUTE '${attribute}']` }
				</Button>
			) }
			<HoverElement parent={ buttonRef } className='attribute-description'>
				{ attributeDefinition?.description ?? `[UNKNOWN ATTRIBUTE '${attribute}']` }
			</HoverElement>
		</>
	);
}

export function InventoryAssetPreview({ asset, small }: {
	asset: Asset;
	small: boolean;
}): ReactElement {
	const assetManager = useAssetManager();
	const preferredPreviewType = useAssetPreviewType(small);

	const isVisible = useAssetPreferenceVisibilityCheck()(asset);

	const [previewType, preview] = useMemo((): ['none' | 'image' | 'icon', string | undefined] => {
		if (preferredPreviewType === 'image' && asset.definition.preview != null)
			return ['image', asset.definition.preview];

		const validAttributes = Array.from(asset.staticAttributes)
			.map((attributeName) => assetManager.getAttributeDefinition(attributeName))
			.filter(IsNotNullable)
			.filter((attribute) => attribute.icon != null);

		const filterAttribute = validAttributes.find((attribute) =>
			attribute.useAsWardrobeFilter != null &&
			!attribute.useAsWardrobeFilter.excludeAttributes?.some((a) => asset.staticAttributes.has(a)),
		);

		if (filterAttribute)
			return ['icon', filterAttribute.icon];

		return validAttributes.length > 0 ? ['icon', validAttributes[0].icon] : ['none', undefined];
	}, [asset, preferredPreviewType, assetManager]);

	const icon = useGraphicsUrl(preview);

	if (icon) {
		return (
			<div
				className={ classNames(
					'itemPreview',
					previewType === 'image' ? 'image' : null,
					previewType === 'image' && !isVisible ? 'doNotRender' : null,
				) }
			>
				<img
					className={ previewType === 'image' ? '' : 'black' }
					src={ icon }
					alt='Item preview'
				/>
			</div>
		);
	}

	return (
		<div className='itemPreview missing'>?</div>
	);
}

function useAssetPreviewType(small: boolean): 'icon' | 'image' {
	const { wardrobeSmallPreview, wardrobeBigPreview } = useAccountSettings();

	if (small)
		return wardrobeSmallPreview;

	return wardrobeBigPreview;
}

export function InventoryAttributePreview({ attribute }: {
	attribute: string;
}): ReactElement {
	const assetManager = useAssetManager();
	const definition = assetManager.getAttributeDefinition(attribute);

	const icon = useGraphicsUrl(definition?.icon);

	if (icon) {
		return (
			<div className='itemPreview'>
				<img
					className='black'
					src={ icon }
					alt='Attribute icon'
				/>
			</div>
		);
	}

	return (
		<div className='itemPreview missing'>?</div>
	);
}

export function StorageUsageMeter({ title, used, limit }: {
	title: string;
	used: number | null;
	limit: number;
}): ReactElement {
	if (used == null) {
		return (
			<Column gap='tiny' alignY='center' padding='small'>
				<span>{ title }: Loading...</span>
				<progress />
			</Column>
		);
	}

	return (
		<Column gap='tiny' alignY='center' padding='small'>
			<span>{ title }: { used } / { limit } ({ Math.ceil(100 * used / limit) }%)</span>
			<meter min={ 0 } max={ 1 } low={ 0.75 } high={ 0.9 } optimum={ 0 } value={ used / limit }>{ Math.ceil(100 * used / limit) }%</meter>
		</Column>
	);
}
