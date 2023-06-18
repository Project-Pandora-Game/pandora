import React, { ReactElement } from 'react';
import { ItemModuleTyped } from 'pandora-common/dist/assets/modules/typed';
import { IItemModule } from 'pandora-common/dist/assets/modules/common';
import { ItemModuleStorage } from 'pandora-common/dist/assets/modules/storage';
import { ItemModuleLockSlot } from 'pandora-common/dist/assets/modules/lockSlot';
import { WardrobeModuleProps } from '../wardrobeTypes';
import { WardrobeModuleConfigTyped } from './wardrobeModuleTyped';
import { WardrobeModuleConfigStorage } from './wardrobeModuleStorage';
import { WardrobeModuleConfigLockSlot } from './wardrobeModuleLockSlot';

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
