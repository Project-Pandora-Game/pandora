import type { HexColorString } from 'pandora-common';
import { useEffect } from 'react';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks.ts';

export function InterfaceSettingsProvider(): null {
	const { interfaceAccentColor } = useAccountSettings();

	useEffect(() => {
		document.body.style.setProperty('--pandora-accent-color', interfaceAccentColor);
	}, [interfaceAccentColor]);

	return null;
}

export const THEME_NORMAL_BACKGROUND: HexColorString = '#0d1111';
export const THEME_FONT: readonly string[] = ['InterVariable', 'Arial', 'Helvetica', 'sans-serif'];
