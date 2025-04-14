import type { Immutable } from 'immer';
import { CHARACTER_SETTINGS_DEFAULT, GetLogger, type CharacterSettings } from 'pandora-common';
import { useMemo } from 'react';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';
import { useModifiedCharacterSettings } from '../../gameContext/playerContextProvider.tsx';
import { useShardConnector } from '../../gameContext/shardConnectorContextProvider.tsx';
import type { SettingDriver } from './settingsInputs.tsx';

export function useCharacterSettingDriver<const Setting extends keyof CharacterSettings>(setting: Setting): SettingDriver<Immutable<CharacterSettings>[Setting]> {
	const modifiedSettings = useModifiedCharacterSettings();
	const shard = useShardConnector();

	const currentValue: Immutable<CharacterSettings>[Setting] | undefined = modifiedSettings?.[setting];

	return useMemo((): SettingDriver<Immutable<CharacterSettings>[Setting]> => ({
		currentValue,
		defaultValue: CHARACTER_SETTINGS_DEFAULT[setting],
		onChange(newValue) {
			if (shard == null) {
				toast('Failed to update your settings. Please try again.', TOAST_OPTIONS_ERROR);
				return;
			}

			shard.awaitResponse('changeSettings', {
				type: 'set',
				settings: { [setting]: newValue },
			})
				.catch((err: unknown) => {
					toast('Failed to update your settings. Please try again.', TOAST_OPTIONS_ERROR);
					GetLogger('CharacterSettingDriver').error('Failed to update settings:', err);
				});
		},
		onReset() {
			if (shard == null) {
				toast('Failed to update your settings. Please try again.', TOAST_OPTIONS_ERROR);
				return;
			}

			shard.awaitResponse('changeSettings', {
				type: 'reset',
				settings: [setting],
			})
				.catch((err: unknown) => {
					toast('Failed to update your settings. Please try again.', TOAST_OPTIONS_ERROR);
					GetLogger('CharacterSettingDriver').error('Failed to update settings:', err);
				});
		},
	}), [shard, currentValue, setting]);
}
