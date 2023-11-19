import React, { ReactElement } from 'react';
import { ItemModuleTyped } from 'pandora-common/dist/assets/modules/typed';
import { IItemModule } from 'pandora-common/dist/assets/modules/common';
import { ItemModuleStorage } from 'pandora-common/dist/assets/modules/storage';
import { ItemModuleLockSlot } from 'pandora-common/dist/assets/modules/lockSlot';
import { WardrobeModuleProps, WardrobeModuleTemplateProps } from '../wardrobeTypes';
import { WardrobeModuleConfigTyped, WardrobeModuleTemplateConfigTyped } from './wardrobeModuleTyped';
import { WardrobeModuleConfigStorage, WardrobeModuleTemplateConfigStorage } from './wardrobeModuleStorage';
import { WardrobeModuleConfigLockSlot, WardrobeModuleTemplateConfigLockSlot } from './wardrobeModuleLockSlot';
import { AssertNever } from 'pandora-common';

export function WardrobeModuleConfig({ m, ...props }: WardrobeModuleProps<IItemModule>): ReactElement {
	if (m instanceof ItemModuleTyped) {
		return <WardrobeModuleConfigTyped { ...props } m={ m } />;
	}
	if (m instanceof ItemModuleStorage) {
		return <WardrobeModuleConfigStorage { ...props } m={ m } />;
	}
	if (m instanceof ItemModuleLockSlot) {
		return <WardrobeModuleConfigLockSlot { ...props } m={ m } />;
	}
	return <>[ ERROR: UNKNOWN MODULE TYPE ]</>;
}

export function WardrobeModuleTemplateConfig({ definition, template, ...props }: WardrobeModuleTemplateProps): ReactElement {
	if (definition.type === 'typed') {
		return <WardrobeModuleTemplateConfigTyped { ...props } definition={ definition } template={ template?.type === 'typed' ? template : undefined } />;
	}
	if (definition.type === 'storage') {
		return <WardrobeModuleTemplateConfigStorage { ...props } definition={ definition } template={ template?.type === 'storage' ? template : undefined } />;
	}
	if (definition.type === 'lockSlot') {
		return <WardrobeModuleTemplateConfigLockSlot { ...props } definition={ definition } template={ template?.type === 'lockSlot' ? template : undefined } />;
	}
	AssertNever(definition);
}
