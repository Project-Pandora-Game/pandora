import {
	FormatTimeInterval,
	MessageSubstitute,
} from 'pandora-common';
import React, { ReactElement, useMemo } from 'react';
import { ItemModuleTyped } from 'pandora-common/dist/assets/modules/typed';
import { Column, Row } from '../../common/container/container';
import { useCurrentTime } from '../../../common/useCurrentTime';
import { useWardrobeContext } from '../wardrobeContext';
import { WardrobeModuleProps } from '../wardrobeTypes';
import { WardrobeActionButton } from '../wardrobeComponents';

export function WardrobeModuleConfigTyped({ item, moduleName, m }: WardrobeModuleProps<ItemModuleTyped>): ReactElement {
	const { targetSelector } = useWardrobeContext();
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
					target: targetSelector,
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
	}), [m.activeVariant, m.config, targetSelector, item, moduleName]);

	return (
		<Column padding='medium'>
			<Row padding='medium' wrap>
				{ rows }
			</Row>
			{ customText }
		</Column>
	);
}
