import {
	AppearanceActionProblem,
	AssertNever,
	AssertNotNullable,
	EMPTY_ARRAY,
	GameLogicPermission,
	GetLogger,
	Logger,
	PermissionRestriction,
	PermissionType,
	TypedEventEmitter,
	type AppearanceActionProcessingResult,
} from 'pandora-common';
import { ReactElement, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { ShardConnector } from '../../networking/shardConnector';
import { PermissionPromptHandler } from '../settings/permissionsSettings';
import { useShardChangeListener, useShardConnector } from './shardConnectorContextProvider';

export class PermissionCheckServiceBase extends TypedEventEmitter<{
	permissionResultReset: void;
	permissionResultUpdated: GameLogicPermission;
}> {
	public checkPermissions(_permissions: ReadonlySet<GameLogicPermission>): readonly PermissionRestriction[] {
		return [];
	}

	public onPermissionsChanged() {
		// no-op
	}
}

class PermissionCheckService extends PermissionCheckServiceBase {
	private _logger: Logger;
	private _shardConnector: ShardConnector;

	private _permissionsGeneration = 1;
	private readonly _pendingChecks = new Set<GameLogicPermission>();
	private readonly _cachedResults = new Map<GameLogicPermission, PermissionType>();

	constructor(shardConnector: ShardConnector) {
		super();
		this._logger = GetLogger('PermissionCheckService');
		this._shardConnector = shardConnector;
	}

	public override checkPermissions(permissions: ReadonlySet<GameLogicPermission>): readonly PermissionRestriction[] {
		const generation = this._permissionsGeneration;

		const restrictions: PermissionRestriction[] = [];

		for (const permission of permissions) {
			const cachedResult = this._cachedResults.get(permission);
			if (cachedResult != null) {
				if (cachedResult !== 'yes') {
					restrictions.push(permission.getRestrictionDescriptor(cachedResult));
				}
				continue;
			}

			if (this._pendingChecks.has(permission))
				continue;

			this._pendingChecks.add(permission);
			this._shardConnector.awaitResponse('permissionCheck', {
				target: permission.character.id,
				permissionGroup: permission.group,
				permissionId: permission.id,
			})
				.then((result) => {
					if (this._permissionsGeneration !== generation)
						return;
					this._pendingChecks.delete(permission);

					switch (result.result) {
						case 'ok':
							this._cachedResults.set(permission, result.permission);
							this.emit('permissionResultUpdated', permission);
							break;
						case 'notFound':
							this._logger.warning(`Permission check for permission ${permission.character.id}:${permission.group}:${permission.id} failed: Server returned 'notFound'`);
							break;
						default:
							AssertNever(result);
					}
				}, (error) => {
					if (this._permissionsGeneration !== generation)
						return;
					this._pendingChecks.delete(permission);

					this._logger.warning(`Permission check for permission ${permission.character.id}:${permission.group}:${permission.id} failed:`, error);
				});
		}

		return restrictions;
	}

	public override onPermissionsChanged() {
		this._permissionsGeneration++;
		this._pendingChecks.clear();
		this._cachedResults.clear();
		this.emit('permissionResultReset', undefined);
	}
}

export const permissionCheckContext = createContext<PermissionCheckServiceBase | null | undefined>(undefined);

export function PermissionCheckServiceProvider({ children }: ChildrenProps): ReactElement {
	const shardConnector = useShardConnector();
	const service = useMemo(() => shardConnector != null ? new PermissionCheckService(shardConnector) : null, [shardConnector]);

	useShardChangeListener('permissions', () => {
		service?.onPermissionsChanged();
	}, false);

	return (
		<permissionCheckContext.Provider value={ service }>
			<PermissionPromptHandler />
			{ children }
		</permissionCheckContext.Provider>
	);
}

function usePermissionCheckService(): PermissionCheckServiceBase {
	const service = useContext(permissionCheckContext);
	AssertNotNullable(service);
	return service;
}

export function usePermissionCheck(permissions: ReadonlySet<GameLogicPermission> | undefined): readonly AppearanceActionProblem[] {
	const service = usePermissionCheckService();

	const [resultProblems, setResultProblems] = useState<{
		forPermissionsSet: ReadonlySet<GameLogicPermission>;
		result: readonly AppearanceActionProblem[];
	} | null>(null);

	const runChecks = useCallback(() => {
		if (permissions == null)
			return;

		setResultProblems({
			forPermissionsSet: permissions,
			result: service.checkPermissions(permissions).map((restriction) => ({
				result: 'restrictionError',
				restriction,
			})),
		});
	}, [permissions, service]);

	useEffect(() => {
		if (!permissions)
			return undefined;

		const cleanup: (() => void)[] = [];

		cleanup.push(
			service.on('permissionResultReset', () => {
				runChecks();
			}),
		);
		cleanup.push(
			service.on('permissionResultUpdated', (updatedPermission) => {
				if (permissions.has(updatedPermission)) {
					runChecks();
				}
			}),
		);
		runChecks();

		return () => {
			cleanup.forEach((c) => c());
		};
	}, [permissions, runChecks, service]);

	return useMemo((): readonly AppearanceActionProblem[] => {
		// If there are no permissions to check, then just return empty array
		if (permissions == null)
			return EMPTY_ARRAY;

		// If we have full up-to-date result, return it
		if (resultProblems?.forPermissionsSet === permissions) {
			return resultProblems.result;
		}

		// Otherwise calculate immediate best-attempt solution
		return service.checkPermissions(permissions).map((restriction) => ({
			result: 'restrictionError',
			restriction,
		}));
	}, [permissions, resultProblems, service]);
}

export function useCheckAddPermissions(result: AppearanceActionProcessingResult): AppearanceActionProcessingResult;
export function useCheckAddPermissions(result: AppearanceActionProcessingResult | null): AppearanceActionProcessingResult | null;
export function useCheckAddPermissions(result: AppearanceActionProcessingResult | null): AppearanceActionProcessingResult | null {
	const permissionProblems = usePermissionCheck(result?.requiredPermissions);

	return useMemo((): AppearanceActionProcessingResult | null => {
		if (result == null)
			return null;

		if (permissionProblems.length > 0) {
			return result.addAdditionalProblems(...permissionProblems);
		}

		return result;
	}, [result, permissionProblems]);
}
