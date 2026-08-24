import { noop } from 'lodash-es';
import { GetLogger, type PermissionConfigChangeSelector, type PermissionConfigChangeType, type PermissionGroup } from 'pandora-common';
import type { IClientShardNormalResult } from 'pandora-common/networking/api/shard_client';
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { useShardChangeListener, useShardConnector } from '../../components/gameContext/shardConnectorContextProvider.tsx';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast.ts';

/** Returns a function that can be used to set any permission. */
export function usePermissionConfigDriverSetter(): (permissionGroup: PermissionGroup, permissionId: string, selector: PermissionConfigChangeSelector, allowOthers: PermissionConfigChangeType) => void {
	const shardConnector = useShardConnector();
	return useCallback((permissionGroup: PermissionGroup, permissionId: string, selector: PermissionConfigChangeSelector, allowOthers: PermissionConfigChangeType) => {
		if (shardConnector == null) {
			toast(`Error updating permission:\nNot connected`, TOAST_OPTIONS_ERROR);
			return;
		}

		shardConnector.awaitResponse('permissionSet', {
			permissionGroup,
			permissionId,
			config: {
				selector,
				allowOthers,
			},
		})
			.then((result) => {
				if (result.result === 'tooManyOverrides') {
					toast(`Too many character overrides`, TOAST_OPTIONS_ERROR);
				} else if (result.result !== 'ok') {
					GetLogger('permissionSet').error('Error updating permission:', result);
					toast(`Error updating permission:\n${result.result}`, TOAST_OPTIONS_ERROR);
				}
			})
			.catch((err) => {
				GetLogger('permissionSet').error('Error updating permission:', err);
				toast(`Error updating permission`, TOAST_OPTIONS_ERROR);
			});
	}, [shardConnector]);
}

export function usePermissionGetConfig(permissionGroup: PermissionGroup, permissionId: string): IClientShardNormalResult['permissionGet'] | undefined {
	const [permissionConfig, setPermissionConfig] = useState<IClientShardNormalResult['permissionGet']>();
	const shardConnector = useShardConnector();

	const fetchPermissionConfig = useCallback(async () => {
		if (shardConnector == null) {
			setPermissionConfig(undefined);
			return;
		}

		const result = await shardConnector.awaitResponse('permissionGet', {
			permissionGroup,
			permissionId,
		}).catch(() => undefined);
		setPermissionConfig(result);
	}, [shardConnector, permissionGroup, permissionId]);

	useShardChangeListener('permissions', () => {
		fetchPermissionConfig().catch(noop);
	});

	return permissionConfig;
}
