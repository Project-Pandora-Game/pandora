import { produce } from 'immer';
import { capitalize } from 'lodash-es';
import {
	KnownObject,
	LIMIT_ITEM_MODULE_TEXT_LENGTH,
	PANDORA_FONTS,
	PandoraFontTypeSchema,
	type AppearanceAction,
} from 'pandora-common';
import { ItemModuleText, ModuleItemDataTextAlignSchema } from 'pandora-common/dist/assets/modules/text.js';
import React, { ReactElement, useCallback, useId, useMemo, useState } from 'react';
import editIcon from '../../../assets/icons/edit.svg';
import { Select } from '../../../common/userInteraction/select/select.tsx';
import { Button, IconButton } from '../../common/button/button.tsx';
import { Column, Row } from '../../common/container/container.tsx';
import { type WardrobeExecuteCheckedResult } from '../wardrobeActionContext.tsx';
import { WardrobeActionButton } from '../wardrobeComponents.tsx';
import { WardrobeModuleProps, WardrobeModuleTemplateProps } from '../wardrobeTypes.ts';

export function WardrobeModuleConfigText({ target, item, moduleName, m }: WardrobeModuleProps<ItemModuleText>): ReactElement {
	const [edit, setEdit] = React.useState(false);

	if (edit) {
		return (
			<WardrobeModuleConfigTextEdit
				target={ target }
				item={ item }
				moduleName={ moduleName }
				m={ m }
				stopEdit={ () => {
					setEdit(false);
				} }
			/>
		);
	}

	return (
		<Row padding='medium' alignY='start'>
			<span className='flex-1 display-linebreak fontSize-l' style={ { fontFamily: PANDORA_FONTS[m.font].cssSelector } }>
				{ m.text }
			</span>
			<IconButton
				src={ editIcon }
				alt='Edit text'
				onClick={ () => {
					setEdit(true);
				} }
			/>
		</Row>
	);
}

function WardrobeModuleConfigTextEdit({ target, item, moduleName, m, stopEdit }: WardrobeModuleProps<ItemModuleText> & { stopEdit: () => void; }): ReactElement {
	const id = useId();
	const [currentlyAttempting, setCurrentlyAttempting] = useState(false);
	const [text, setText] = useState(m.text);
	const [font, setFont] = useState(m.font);
	const [align, setAlign] = useState(m.align);

	const onCurrentAttempt = useCallback((currentAttempt: WardrobeExecuteCheckedResult['currentAttempt']): void => {
		setCurrentlyAttempting(currentAttempt != null);
	}, [setCurrentlyAttempting]);

	const updateAction = useMemo((): AppearanceAction => ({
		type: 'moduleAction',
		target,
		item,
		module: moduleName,
		action: {
			moduleType: 'text',
			setText: text,
			setFont: font,
			setAlign: align,
		},
	}), [font, item, moduleName, target, text, align]);

	return (
		<Column padding='medium'>
			<textarea
				value={ text }
				rows={ 4 }
				onChange={ (ev) => {
					setText(ev.target.value);
				} }
				disabled={ currentlyAttempting }
				maxLength={ Math.min(LIMIT_ITEM_MODULE_TEXT_LENGTH, m.config.maxLength) }
				style={ { fontFamily: PANDORA_FONTS[font].cssSelector } }
			/>
			<Row alignY='center'>
				<label htmlFor={ id + ':font' }>Font:</label>
				<Select
					id={ id + ':font' }
					value={ font }
					onChange={ (ev) => {
						setFont(PandoraFontTypeSchema.parse(ev.target.value));
					} }
					disabled={ currentlyAttempting }
					style={ { fontFamily: PANDORA_FONTS[font].cssSelector } }
				>
					{
						KnownObject.entries(PANDORA_FONTS).map(([f, { name, cssSelector }]) => (
							<option key={ f } value={ f } style={ { fontFamily: cssSelector } }>
								{ name }
							</option>
						))
					}
				</Select>
			</Row>
			<Row alignY='center'>
				<label htmlFor={ id + ':font' }>Align:</label>
				<Select
					id={ id + ':font' }
					value={ align }
					onChange={ (ev) => {
						setAlign(ModuleItemDataTextAlignSchema.parse(ev.target.value));
					} }
					disabled={ currentlyAttempting }
				>
					{
						ModuleItemDataTextAlignSchema.options.map((o) => (
							<option key={ o } value={ o }>
								{ capitalize(o) }
							</option>
						))
					}
				</Select>
			</Row>
			<Row alignX='space-between'>
				<Button onClick={ stopEdit }>Cancel</Button>
				<WardrobeActionButton
					action={ updateAction }
					onExecute={ stopEdit }
					onCurrentAttempt={ onCurrentAttempt }
				>
					Save
				</WardrobeActionButton>
			</Row>
		</Column>
	);
}

export function WardrobeModuleTemplateConfigText({ template, definition, onTemplateChange }: WardrobeModuleTemplateProps<'text'>): ReactElement {
	const id = useId();
	template ??= {
		type: 'text',
		text: '',
		font: 'inter',
		align: 'center',
	};

	return (
		<Column padding='medium'>
			<textarea
				rows={ 4 }
				value={ template.text }
				onChange={ (ev) => {
					onTemplateChange(produce(template, (d) => {
						d.text = ev.target.value;
					}));
				} }
				maxLength={ Math.min(LIMIT_ITEM_MODULE_TEXT_LENGTH, definition.maxLength) }
				style={ { fontFamily: PANDORA_FONTS[template.font].cssSelector } }
			/>
			<Row alignY='center'>
				<label htmlFor={ id + ':font' }>Font:</label>
				<Select
					id={ id + ':font' }
					value={ template.font }
					onChange={ (ev) => {
						onTemplateChange(produce(template, (d) => {
							d.font = PandoraFontTypeSchema.parse(ev.target.value);
						}));
					} }
					style={ { fontFamily: PANDORA_FONTS[template.font].cssSelector } }
				>
					{
						KnownObject.entries(PANDORA_FONTS).map(([f, { name, cssSelector }]) => (
							<option key={ f } value={ f } style={ { fontFamily: cssSelector } }>
								{ name }
							</option>
						))
					}
				</Select>
			</Row>
			<Row alignY='center'>
				<label htmlFor={ id + ':font' }>Align:</label>
				<Select
					id={ id + ':font' }
					value={ template.align }
					onChange={ (ev) => {
						onTemplateChange(produce(template, (d) => {
							d.align = ModuleItemDataTextAlignSchema.parse(ev.target.value);
						}));
					} }
				>
					{
						ModuleItemDataTextAlignSchema.options.map((o) => (
							<option key={ o } value={ o }>
								{ capitalize(o) }
							</option>
						))
					}
				</Select>
			</Row>
		</Column>
	);
}
