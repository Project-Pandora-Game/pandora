import classNames from 'classnames';
import {
	AppearanceAction,
	AppearanceActionResult,
	Asset,
	IsNotNullable,
} from 'pandora-common';
import React, { ReactElement, useMemo, useState } from 'react';
import { useAssetManager } from '../../assets/assetManager';
import { Button, ButtonProps, IconButton } from '../common/button/button';
import { CommonProps } from '../../common/reactTypes';
import { AppearanceActionResultShouldHide, RenderAppearanceActionResult } from '../../assets/appearanceValidation';
import { HoverElement } from '../hoverElement/hoverElement';
import { useGraphicsUrl } from '../../assets/graphicsManager';
import { useWardrobeExecuteChecked } from './wardrobeContext';
import { useStaggeredAppearanceActionResult } from './wardrobeCheckQueue';

export function ActionWarning({ check, parent }: { check: AppearanceActionResult; parent: HTMLElement | null; }) {
	const assetManager = useAssetManager();
	const reason = useMemo(() => (check.result === 'success'
		? ''
		: RenderAppearanceActionResult(assetManager, check)
	), [assetManager, check]);

	if (check.result === 'success') {
		return null;
	}

	return (
		<HoverElement parent={ parent } className='action-warning'>
			{
				!reason ? (
					<>
						This action isn't possible.
					</>
				) : (
					<>
						This action isn't possible, because:<br />
						{ reason }
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
}: CommonProps & {
	action: AppearanceAction;
	/** If the button should hide on certain invalid states */
	autohide?: boolean;
	/** Makes the button hide if it should in a way, that occupied space is preserved */
	hideReserveSpace?: boolean;
	showActionBlockedExplanation?: boolean;
	onExecute?: () => void;
}): ReactElement {
	const check = useStaggeredAppearanceActionResult(action);
	const hide = check != null && autohide && AppearanceActionResultShouldHide(check);
	const [ref, setRef] = useState<HTMLButtonElement | null>(null);
	const [execute, processing] = useWardrobeExecuteChecked(action, check, {
		onSuccess: onExecute,
	});

	return (
		<button
			id={ id }
			ref={ setRef }
			className={ classNames('wardrobeActionButton', className, check === null ? 'pending' : check.result === 'success' ? 'allowed' : 'blocked', hide ? (hideReserveSpace ? 'invisible' : 'hidden') : null) }
			onClick={ (ev) => {
				ev.stopPropagation();
				execute();
			} }
			disabled={ processing }
		>
			{
				showActionBlockedExplanation && check != null ? (
					<ActionWarning check={ check } parent={ ref } />
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
