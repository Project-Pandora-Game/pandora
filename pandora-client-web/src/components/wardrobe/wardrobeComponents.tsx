import classNames from 'classnames';
import {
	AppearanceAction,
	AppearanceActionProblem,
	Asset,
	IsNotNullable,
} from 'pandora-common';
import React, { ReactElement, useEffect, useMemo, useState } from 'react';
import { useAssetManager } from '../../assets/assetManager';
import { Button, ButtonProps, IconButton } from '../common/button/button';
import { CommonProps } from '../../common/reactTypes';
import { AppearanceActionProblemShouldHide, RenderAppearanceActionProblem } from '../../assets/appearanceValidation';
import { HoverElement } from '../hoverElement/hoverElement';
import { useGraphicsUrl } from '../../assets/graphicsManager';
import { useWardrobeContext, useWardrobeExecuteChecked } from './wardrobeContext';
import { useStaggeredAppearanceActionResult } from './wardrobeCheckQueue';
import _ from 'lodash';
import { usePermissionCheck } from '../gameContext/permissionCheckProvider';

export function ActionWarningContent({ problems }: { problems: readonly AppearanceActionProblem[]; }): ReactElement {
	const assetManager = useAssetManager();
	const reasons = useMemo(() => (
		_.uniq(
			problems
				.map((problem) => RenderAppearanceActionProblem(assetManager, problem))
				.filter(Boolean),
		)
	), [assetManager, problems]);

	if (reasons.length === 0) {
		return (
			<>
				This action isn't possible.
			</>
		);
	}

	return (
		<>
			This action isn't possible, because:
			<ul>
				{
					reasons.map((reason, i) => (<li key={ i }>{ reason }</li>))
				}
			</ul>
		</>
	);
}

export function ActionWarning({ problems, parent }: { problems: readonly AppearanceActionProblem[]; parent: HTMLElement | null; }) {
	if (problems.length === 0) {
		return null;
	}

	return (
		<HoverElement parent={ parent } className='action-warning display-linebreak'>
			<ActionWarningContent problems={ problems } />
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
	onExecute?: () => void;
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

	const permissionProblems = usePermissionCheck(check?.requiredPermissions);

	const finalProblems = useMemo<readonly AppearanceActionProblem[]>(() => check != null ? [
		...check.problems,
		...permissionProblems,
	] : [], [check, permissionProblems]);

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
				check === null ? 'pending' : finalProblems.length === 0 ? 'allowed' : 'blocked',
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
		>
			{
				showActionBlockedExplanation && check != null ? (
					<ActionWarning problems={ finalProblems } parent={ ref } />
				) : null
			}
			{ children }
		</Element>
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

export function InventoryAssetPreview({ asset }: {
	asset: Asset;
}): ReactElement {
	const assetManager = useAssetManager();

	const iconAttribute = useMemo(() => {
		const validAttributes = Array.from(asset.staticAttributes)
			.map((attributeName) => assetManager.getAttributeDefinition(attributeName))
			.filter(IsNotNullable)
			.filter((attribute) => attribute.icon != null);

		const filterAttribute = validAttributes.find((attribute) =>
			attribute.useAsWardrobeFilter != null &&
			!attribute.useAsWardrobeFilter.excludeAttributes?.some((a) => asset.staticAttributes.has(a)),
		);

		if (filterAttribute)
			return filterAttribute;

		return validAttributes.length > 0 ? validAttributes[0] : undefined;
	}, [asset, assetManager]);

	const icon = useGraphicsUrl(iconAttribute?.icon);

	if (icon) {
		return (
			<div className='itemPreview'>
				<img
					className='black'
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
