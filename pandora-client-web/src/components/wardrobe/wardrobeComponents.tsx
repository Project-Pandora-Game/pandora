import classNames from 'classnames';
import type { Immutable } from 'immer';
import { clamp, uniq } from 'lodash-es';
import { nanoid } from 'nanoid';
import {
	AppearanceAction,
	AppearanceActionProblem,
	AppearanceActionProcessingResult,
	AssertNever,
	Asset,
	FormatTimeInterval,
	IsNotNullable,
	type AppearanceActionData,
	type CharacterActionAttempt,
	type GameLogicActionSlowdownReason,
	type HexColorString,
} from 'pandora-common';
import { ReactElement, useEffect, useMemo, useReducer, useState } from 'react';
import { z } from 'zod';
import { AppearanceActionProblemShouldHide, RenderAppearanceActionProblem, RenderAppearanceActionSlowdown } from '../../assets/appearanceValidation.tsx';
import { useAssetManager } from '../../assets/assetManager.tsx';
import { useGraphicsUrl } from '../../assets/graphicsManager.ts';
import { BrowserStorage } from '../../browserStorage.ts';
import { CommonProps } from '../../common/reactTypes.ts';
import { USER_DEBUG } from '../../config/Environment.ts';
import { useAssetPreferenceVisibilityCheck } from '../../graphics/common/assetVisibilityCheck.ts';
import { useObservable } from '../../observable.ts';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks.ts';
import { Button, ButtonProps, IconButton } from '../common/button/button.tsx';
import { Column } from '../common/container/container.tsx';
import { HoverElement } from '../hoverElement/hoverElement.tsx';
import { useWardrobeExecuteChecked, type WardrobeExecuteCheckedResult } from './wardrobeActionContext.tsx';
import { useStaggeredAppearanceActionResult } from './wardrobeCheckQueue.ts';
import { useWardrobeContext } from './wardrobeContext.tsx';

export function ActionSlowdownContent({ slowdownReasons, slowdownTime }: { slowdownReasons: ReadonlySet<GameLogicActionSlowdownReason>; slowdownTime: number; }): ReactElement {
	const reasons = useMemo(() => (
		uniq(
			Array.from(slowdownReasons)
				.map((reason) => RenderAppearanceActionSlowdown(reason))
				.filter(Boolean),
		)
	), [slowdownReasons]);

	return (
		<>
			This action will start a usage attempt that will take at least { FormatTimeInterval(slowdownTime, 'two-most-significant') } before
			you can decide when it is successful or stopped.
			{
				reasons.length > 0 ? (
					<>
						<br />
						This will happen because:
						<ul>
							{
								reasons.map((reason, i) => (<li key={ i }>{ reason }</li>))
							}
						</ul>
					</>
				) : null
			}
		</>
	);
}

export function ActionWarningContent({ problems, prompt, customText }: { problems: readonly AppearanceActionProblem[]; prompt: boolean; customText?: string; }): ReactElement {
	const { wardrobeItemDisplayNameType } = useAccountSettings();
	const assetManager = useAssetManager();
	const reasons = useMemo(() => (
		uniq(
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

	let text: string;
	if (customText != null) {
		text = customText;
	} else if (prompt) {
		text = 'Executing the action will prompt for the following permissions:';
	} else {
		text = "This action isn't possible, because:";
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

export function ActionWarning({ checkResult, parent, actionInProgress }: {
	checkResult: AppearanceActionProcessingResult;
	actionInProgress: boolean;
	parent: HTMLElement | null;
}) {
	const slowdown = checkResult.getActionSlowdownTime();
	if (checkResult.valid && slowdown === 0 && !actionInProgress) {
		return null;
	}

	return (
		<HoverElement parent={ parent } className='action-warning display-linebreak'>
			<Column>
				{
					actionInProgress ? (
						<strong>You are currently attempting this action.</strong>
					) : null
				}
				{
					!checkResult.valid ? (
						<div>
							<ActionWarningContent problems={ checkResult.problems } prompt={ checkResult.prompt != null } />
						</div>
					) : null
				}
				{
					slowdown > 0 ? (
						<div>
							<ActionSlowdownContent slowdownReasons={ checkResult.actionSlowdownReasons } slowdownTime={ slowdown } />
						</div>
					) : null
				}
			</Column>
		</HoverElement>
	);
}

export function WardrobeActionButtonElement({
	Element = 'button',
	id,
	className,
	children,
	disabled = false,
	check,
	actionData,
	currentAttempt,
	showActionBlockedExplanation = true,
	hide = false,
	hideReserveSpace = false,
	title,
	onClick,
	onHoverChange,
}: CommonProps & {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	Element?: 'button' | 'div';
	disabled?: boolean;

	check: AppearanceActionProcessingResult | null;
	actionData?: Immutable<AppearanceAction>;
	currentAttempt?: Immutable<CharacterActionAttempt> | null;
	showActionBlockedExplanation?: boolean;
	hide?: boolean;
	/** Makes the button hide if it should in a way, that occupied space is preserved */
	hideReserveSpace?: boolean;
	title?: string;

	onClick?: () => void;
	onHoverChange?: (isHovering: boolean) => void;
}): ReactElement {
	const [ref, setRef] = useState<HTMLElement | null>(null);

	// Handle visual "cooldown" effect while attempting action that has slowdown
	useEffect(() => {
		if (!ref || currentAttempt == null)
			return;

		let run = true;
		let frameRequest: number | undefined;

		const update = () => {
			frameRequest = undefined;
			if (!run)
				return;

			const now = Date.now();

			if (now >= currentAttempt.finishAfter) {
				ref.style.removeProperty('--progress');
				ref.classList.remove('pendingAttempt');
				return;
			}

			ref.classList.add('pendingAttempt');
			const done = now - currentAttempt.start;
			const progress = clamp(done / (currentAttempt.finishAfter - currentAttempt.start), 0, 1);
			ref.style.setProperty('--progress', `${Math.floor(progress * 100)}%`);

			frameRequest = requestAnimationFrame(update);
		};

		update();

		return () => {
			run = false;
			if (frameRequest !== undefined) {
				cancelAnimationFrame(frameRequest);
				frameRequest = undefined;
			}
			ref.style.removeProperty('--progress');
			ref.classList.remove('pendingAttempt');
		};
	}, [ref, currentAttempt]);

	return (
		<Element
			id={ id }
			ref={ setRef }
			tabIndex={ 0 }
			className={ classNames(
				'wardrobeActionButton',
				className,
				CheckResultToClassName(check, currentAttempt != null),
				hide ? (hideReserveSpace ? 'invisible' : 'hidden') : null,
			) }
			onClick={ (ev) => {
				ev.stopPropagation();
				onClick?.();
			} }
			onMouseEnter={ () => {
				onHoverChange?.(true);
			} }
			onMouseLeave={ () => {
				onHoverChange?.(false);
			} }
			disabled={ disabled }
			title={ title }
			data-action={ (USER_DEBUG && actionData != null) ? JSON.stringify(actionData, undefined, '\t') : undefined }
			data-action-localproblems={ (USER_DEBUG && check != null) ? (JSON.stringify(check.valid ? null : check.problems, undefined, '\t')) : undefined }
		>
			{
				showActionBlockedExplanation && check != null ? (
					<ActionWarning checkResult={ check } actionInProgress={ currentAttempt != null } parent={ ref } />
				) : null
			}
			{ children }
		</Element>
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
	allowPreview = true,
	onExecute,
	onFailure,
	onCurrentAttempt,
	title,
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
	/**
	 * Whether to show preview on hover (if settings allows that)
	 * @default true
	 */
	allowPreview?: boolean;
	onExecute?: (data: readonly AppearanceActionData[]) => void;
	onFailure?: (problems: readonly AppearanceActionProblem[]) => void;
	onCurrentAttempt?: (currentAttempt: WardrobeExecuteCheckedResult['currentAttempt']) => void;
	title?: string;
	disabled?: boolean;
}): ReactElement {
	const { actionPreviewState } = useWardrobeContext();
	const { wardrobeHoverPreview } = useAccountSettings();
	const [isHovering, setIsHovering] = useState(false);

	const check = useStaggeredAppearanceActionResult(action);
	const hide = check != null && !check.valid && autohide && check.problems.some(AppearanceActionProblemShouldHide);
	const { execute, processing, currentAttempt } = useWardrobeExecuteChecked(action, check, {
		onSuccess: onExecute,
		onFailure,
	});

	useEffect(() => {
		onCurrentAttempt?.(currentAttempt);
	}, [onCurrentAttempt, currentAttempt]);

	useEffect(() => {
		if (!isHovering || !wardrobeHoverPreview || !allowPreview || check == null || !check.valid)
			return;

		const previewState = check.resultState;

		actionPreviewState.value = previewState;

		return () => {
			if (actionPreviewState.value === previewState) {
				actionPreviewState.value = null;
			}
		};
	}, [isHovering, wardrobeHoverPreview, allowPreview, actionPreviewState, check]);

	return (
		<WardrobeActionButtonElement
			Element={ Element }
			id={ id }
			className={ className }
			disabled={ processing || disabled }
			check={ check }
			showActionBlockedExplanation={ showActionBlockedExplanation }
			actionData={ action }
			currentAttempt={ currentAttempt }
			hide={ hide }
			hideReserveSpace={ hideReserveSpace }
			onClick={ execute }
			onHoverChange={ setIsHovering }
			title={ title }
		>
			{ children }
		</WardrobeActionButtonElement>
	);
}

/**
 * A button for triggering an game logic action.
 * Similar to wardrobe action button, but can be used outside of wardrobe.
 */
export function GameLogicActionButton({
	id,
	className,
	children,
	action,
	autohide = false,
	hideReserveSpace = false,
	showActionBlockedExplanation = true,
	onExecute,
	onFailure,
	title,
	disabled = false,
}: CommonProps & {
	action: AppearanceAction;
	/** If the button should hide on certain invalid states */
	autohide?: boolean;
	/** Makes the button hide if it should in a way, that occupied space is preserved */
	hideReserveSpace?: boolean;
	showActionBlockedExplanation?: boolean;
	onExecute?: (data: readonly AppearanceActionData[]) => void;
	onFailure?: (problems: readonly AppearanceActionProblem[]) => void;
	title?: string;
	disabled?: boolean;
}): ReactElement {
	const check = useStaggeredAppearanceActionResult(action);
	const hide = check != null && !check.valid && autohide && check.problems.some(AppearanceActionProblemShouldHide);
	const { execute, processing, currentAttempt } = useWardrobeExecuteChecked(action, check, {
		onSuccess: onExecute,
		onFailure,
	});

	return (
		<WardrobeActionButtonElement
			id={ id }
			className={ className }
			disabled={ processing || disabled }
			check={ check }
			showActionBlockedExplanation={ showActionBlockedExplanation }
			actionData={ action }
			currentAttempt={ currentAttempt }
			hide={ hide }
			hideReserveSpace={ hideReserveSpace }
			onClick={ execute }
			title={ title }
		>
			{ children }
		</WardrobeActionButtonElement>
	);
}

export function CheckResultToClassName(result: AppearanceActionProcessingResult | null, isCurrentlyAttempting: boolean): string {
	if (result == null) {
		// Short-circuit check if currently attempting this action - to look nicer
		if (isCurrentlyAttempting)
			return 'allowed';

		return 'pending';
	}

	if (result.valid) {
		if (isCurrentlyAttempting)
			return 'allowed';

		if (result.getActionSlowdownTime() > 0)
			return 'requiresAttempt';

		return 'allowed';
	}

	if (result.prompt != null)
		return 'promptRequired';

	return 'blocked';
}

export const MIN_RANDOMIZE_UPDATE_INTERVAL = 10;
export const WardrobeActionRandomizeUpdateInterval = BrowserStorage.create('wardrobe-action-randomize-update-interval', 800, z.number().min(0).max(10000));

export function WardrobeActionRandomizeButton({
	kind,
}: {
	kind: AppearanceAction<'randomize'>['kind'];
}) {
	const { wardrobeHoverPreview } = useAccountSettings();
	const [seed, newSeed] = useReducer(() => nanoid(), nanoid());
	const updateInterval = useObservable(WardrobeActionRandomizeUpdateInterval);

	useEffect(() => newSeed(), [newSeed]);
	useEffect(() => {
		if (!wardrobeHoverPreview || updateInterval < MIN_RANDOMIZE_UPDATE_INTERVAL)
			return undefined;

		const timeout = setInterval(newSeed, updateInterval);
		return () => {
			clearTimeout(timeout);
		};
	}, [wardrobeHoverPreview, updateInterval, newSeed]);

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

	const action = useMemo((): AppearanceAction => ({
		type: 'randomize',
		kind,
		seed,
	}), [kind, seed]);

	return (
		<WardrobeActionButton onExecute={ newSeed } action={ action } >
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
					data-attribute={ attribute }
				/>
			) : (
				<Button ref={ setButtonRef }
					{ ...buttonProps }
					className={ classNames(buttonProps.className, 'iconHeightButton') }
					data-attribute={ attribute }
				>
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
					src={ icon }
					alt='Item preview'
					crossOrigin='anonymous'
					decoding='async'
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
					src={ icon }
					alt='Attribute icon'
					crossOrigin='anonymous'
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
			<meter className='fill-x' min={ 0 } max={ 1 } low={ 0.75 } high={ 0.9 } optimum={ 0 } value={ used / limit }>{ Math.ceil(100 * used / limit) }%</meter>
		</Column>
	);
}

export function WardrobeColorRibbon({ ribbonColor }: {
	ribbonColor: HexColorString;
}): ReactElement {
	return (
		<span className='colorRibbon'>
			<span
				className='colorRibbonInner'
				style={ {
					backgroundColor: ribbonColor,
				} }
			/>
		</span>
	);
}
