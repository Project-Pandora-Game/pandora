import { AssertNever } from 'pandora-common';
import { IItemModule } from 'pandora-common/dist/assets/modules/common.js';
import { ItemModuleLockSlot } from 'pandora-common/dist/assets/modules/lockSlot.js';
import { ItemModuleStorage } from 'pandora-common/dist/assets/modules/storage.js';
import { ItemModuleTyped } from 'pandora-common/dist/assets/modules/typed.js';
import { ReactElement } from 'react';
import { WardrobeModuleProps, WardrobeModuleTemplateProps } from '../wardrobeTypes.ts';
import { WardrobeModuleConfigLockSlot, WardrobeModuleTemplateConfigLockSlot } from './wardrobeModuleLockSlot.tsx';
import { WardrobeModuleConfigStorage, WardrobeModuleTemplateConfigStorage } from './wardrobeModuleStorage.tsx';
import { WardrobeModuleConfigTyped, WardrobeModuleTemplateConfigTyped } from './wardrobeModuleTyped.tsx';

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
