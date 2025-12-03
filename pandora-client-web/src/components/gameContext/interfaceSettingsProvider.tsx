import type { HexColorString } from 'pandora-common';
import { useEffect } from 'react';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks.ts';

export function InterfaceSettingsProvider(): null {
	const { interfaceAccentColor, forceSystemColors } = useAccountSettings();

	useEffect(() => {
		document.body.style.setProperty('--pandora-accent-color', interfaceAccentColor);

		if (forceSystemColors) {
			document.documentElement.classList.add('forcedColors');
		} else {
			document.documentElement.classList.remove('forcedColors');
		}
	}, [interfaceAccentColor, forceSystemColors]);

	return null;
}

export const THEME_NORMAL_BACKGROUND: HexColorString = '#0d1111';
export const THEME_FONT: readonly string[] = ['InterVariable', 'Arial', 'Helvetica', 'sans-serif'];

export function useInterfaceAccentColorPacked(): number {
	const { interfaceAccentColor } = useAccountSettings();

	return Number.parseInt(interfaceAccentColor.slice(1), 16);
}
