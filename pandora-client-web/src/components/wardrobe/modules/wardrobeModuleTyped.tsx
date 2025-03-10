import classNames from 'classnames';
import {
	FormatTimeInterval,
	MessageSubstitute,
} from 'pandora-common';
import type { ItemModuleTyped } from 'pandora-common/dist/assets/modules/typed.js';
import { ReactElement, useMemo } from 'react';
import { useCurrentTime } from '../../../common/useCurrentTime.ts';
import { Column, Row } from '../../common/container/container.tsx';
import { WardrobeActionButton } from '../wardrobeComponents.tsx';
import type { WardrobeModuleProps, WardrobeModuleTemplateProps } from '../wardrobeTypes.ts';

export function WardrobeModuleConfigTyped({ target, item, moduleName, m }: WardrobeModuleProps<ItemModuleTyped>): ReactElement {
	const now = useCurrentTime();

	const customText = useMemo(() => {
		if (!m.activeVariant.customText) {
			return null;
		}
		const substitutes = {
			CHARACTER_NAME: m.data.selectedBy?.name ?? '[unknown]',
			CHARACTER_ID: m.data.selectedBy?.id ?? '[unknown id]',
			CHARACTER: m.data.selectedBy ? `${m.data.selectedBy.name} (${m.data.selectedBy.id})` : '[unknown]',
			TIME_PASSED: m.data.selectedAt ? FormatTimeInterval(now - m.data.selectedAt) : '[unknown time]',
			TIME: m.data.selectedAt ? new Date(m.data.selectedAt).toLocaleString() : '[unknown date]',
		};
		return m.activeVariant.customText
			.map((text) => MessageSubstitute(text, substitutes))
			.map((text, index) => <span key={ index }>{ text }</span>);
	}, [m.activeVariant, m.data, now]);

	const rows = useMemo(() => m.config.variants.map((v) => {
		const isSelected = m.activeVariant.id === v.id;

		return (
			<WardrobeActionButton
				key={ v.id }
				action={ {
					type: 'moduleAction',
					target,
					item,
					module: moduleName,
					action: {
						moduleType: 'typed',
						setVariant: v.id,
					},
				} }
				className={ isSelected ? 'selected' : '' }
				showActionBlockedExplanation={ !isSelected }
			>
				{ v.name }
			</WardrobeActionButton>
		);
	}), [m.activeVariant, m.config, target, item, moduleName]);

	return (
		<Column padding='medium'>
			<Row padding='medium' wrap>
				{ rows }
			</Row>
			{ customText }
		</Column>
	);
}

export function WardrobeModuleTemplateConfigTyped({ definition, template, onTemplateChange }: WardrobeModuleTemplateProps<'typed'>): ReactElement {
	const rows = useMemo(() => definition.variants.map((v) => {
		const isSelected = template?.variant === v.id;

		return (
			<button
				key={ v.id }
				className={ classNames(
					'wardrobeActionButton',
					'allowed',
					isSelected ? 'selected' : null,
				) }
				onClick={ (ev) => {
					ev.stopPropagation();
					onTemplateChange({
						type: 'typed',
						variant: v.id,
					});
				} }
			>
				{ v.name }
			</button>
		);
	}), [definition, template, onTemplateChange]);

	return (
		<Column padding='medium'>
			<Row padding='medium' wrap>
				{ rows }
			</Row>
		</Column>
	);
}
