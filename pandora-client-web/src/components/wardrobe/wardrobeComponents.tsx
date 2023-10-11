import classNames from 'classnames';
import {
	AppearanceAction,
	AppearanceActionProblem,
	Asset,
	IsNotNullable,
} from 'pandora-common';
import React, { ReactElement, useMemo, useState } from 'react';
import { useAssetManager } from '../../assets/assetManager';
import { Button, ButtonProps, IconButton } from '../common/button/button';
import { CommonProps } from '../../common/reactTypes';
import { AppearanceActionProblemShouldHide, RenderAppearanceActionProblem } from '../../assets/appearanceValidation';
import { HoverElement } from '../hoverElement/hoverElement';
import { useGraphicsUrl } from '../../assets/graphicsManager';
import { useWardrobeExecuteChecked } from './wardrobeContext';
import { useStaggeredAppearanceActionResult } from './wardrobeCheckQueue';
import _ from 'lodash';

export function ActionWarning({ problems, parent }: { problems: readonly AppearanceActionProblem[]; parent: HTMLElement | null; }) {
	const assetManager = useAssetManager();
	const reasons = useMemo(() => (
		_.uniq(
			problems
				.map((problem) => RenderAppearanceActionProblem(assetManager, problem))
				.filter(Boolean),
		)
	), [assetManager, problems]);

	if (problems.length === 0) {
		return null;
	}

	return (
		<HoverElement parent={ parent } className='action-warning'>
			{
				reasons.length === 0 ? (
					<>
						This action isn't possible.
					</>
				) : (
					<>
						This action isn't possible, because:
						<ul>
							{
								reasons.map((reason, i) => (<li key={ i }>{ reason }</li>))
							}
						</ul>
					</>
				)
			}
		</HoverElement>
	);
}

export function WardrobeActionButton({
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
	const check = useStaggeredAppearanceActionResult(action);
	const hide = check != null && autohide && check.problems.some(AppearanceActionProblemShouldHide);
	const [ref, setRef] = useState<HTMLButtonElement | null>(null);
	const [execute, processing] = useWardrobeExecuteChecked(action, check, {
		onSuccess: onExecute,
		onFailure,
	});

	return (
		<button
			id={ id }
			ref={ setRef }
			className={ classNames('wardrobeActionButton', className, check === null ? 'pending' : check.problems.length === 0 ? 'allowed' : 'blocked', hide ? (hideReserveSpace ? 'invisible' : 'hidden') : null) }
			onClick={ (ev) => {
				ev.stopPropagation();
				execute();
			} }
			disabled={ processing || disabled }
		>
			{
				showActionBlockedExplanation && check != null ? (
					<ActionWarning problems={ check.problems } parent={ ref } />
				) : null
			}
			{ children }
		</button>
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
