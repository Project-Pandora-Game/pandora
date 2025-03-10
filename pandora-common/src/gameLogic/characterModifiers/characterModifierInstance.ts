import type { Immutable } from 'immer';
import { cloneDeep } from 'lodash-es';
import type { AssetFrameworkGlobalState } from '../../assets/index.ts';
import type { CharacterId } from '../../character/index.ts';
import type { Logger } from '../../logging.ts';
import type { CurrentSpaceInfo } from '../../space/index.ts';
import { AssertNever, CloneDeepMutable } from '../../utility/misc.ts';
import type { AppearanceActionProblem } from '../actionLogic/appearanceActionProblems.ts';
import type { GameLogicCharacter } from '../character/character.ts';
import { LockLogic, type LockAction, type LockActionContext } from '../locks/index.ts';
import type { CharacterModifierConfiguration, CharacterModifierId } from './characterModifierBaseData.ts';
import type { CharacterModifierEffectData, CharacterModifierInstanceClientData, CharacterModifierInstanceData } from './characterModifierData.ts';
import { CHARACTER_MODIFIER_LOCK_DEFINITIONS, type CharacterModifierLockType } from './characterModifierLocks.ts';
import { EvaluateCharacterModifierConditionChain, type CharacterModifierConditionChain } from './conditions/characterModifierConditionChain.ts';
import { CHARACTER_MODIFIER_TYPE_DEFINITION, type CharacterModifierType, type CharacterModifierTypeDefinition } from './modifierTypes/_index.ts';

export type GameLogicModifierLockInstance = {
	type: CharacterModifierLockType;
	logic: LockLogic;
};

export type GameLogicModifierLockActionResult = {
	result: 'ok';
	password?: string;
} | {
	result: 'failure';
	problems: AppearanceActionProblem[];
};

export class GameLogicModifierInstance {
	public readonly id: CharacterModifierId;
	public readonly type: CharacterModifierType;
	public readonly definition: CharacterModifierTypeDefinition;

	protected _name: string;
	public get name(): string {
		return this._name;
	}

	protected _enabled: boolean;
	public get enabled(): boolean {
		return this._enabled;
	}

	protected _config: CharacterModifierConfiguration;
	public get config(): CharacterModifierConfiguration {
		return this._config;
	}

	protected _conditions: CharacterModifierConditionChain;
	public get conditions(): Immutable<CharacterModifierConditionChain> {
		return this._conditions;
	}

	protected _lock: GameLogicModifierLockInstance | null;
	public get lock(): Readonly<GameLogicModifierLockInstance> | null {
		return this._lock;
	}

	/** List of characters that can simply ignore any locked lock on it */
	protected _lockExceptions: CharacterId[];
	/** List of characters that can simply ignore any locked lock on it */
	public get lockExceptions(): readonly CharacterId[] {
		return this._lockExceptions;
	}

	constructor(data: CharacterModifierInstanceData | CharacterModifierInstanceClientData, logger?: Logger) {
		this.definition = CHARACTER_MODIFIER_TYPE_DEFINITION[data.type];
		this.id = data.id;
		this.type = data.type;
		this._name = data.name;
		this._enabled = data.enabled;
		this._config = this.definition.configSchema.parse(data.config);
		this._conditions = data.conditions;
		this._lock = data.lock != null ? {
			type: data.lock.lockType,
			logic: LockLogic.loadFromBundle(
				CHARACTER_MODIFIER_LOCK_DEFINITIONS[data.lock.lockType].lockSetup, data.lock.lockData,
				{
					doLoadTimeCleanup: true,
					logger,
				},
			),
		} : null;
		this._lockExceptions = data.lockExceptions;
	}

	public getClientData(): CharacterModifierInstanceClientData {
		return {
			id: this.id,
			type: this.type,
			name: this.name,
			enabled: this.enabled,
			config: CloneDeepMutable(this.config),
			conditions: CloneDeepMutable(this.conditions),
			lock: this.lock != null ? {
				lockType: this.lock.type,
				lockData: this.lock.logic.exportToClientBundle(),
			} : undefined,
			lockExceptions: CloneDeepMutable(this.lockExceptions),
		};
	}

	public getEffect(): CharacterModifierEffectData {
		return {
			id: this.id,
			type: this.type,
			config: CloneDeepMutable(this.config),
		};
	}

	public isInEffect(gameState: AssetFrameworkGlobalState, spaceInfo: CurrentSpaceInfo, character: GameLogicCharacter): boolean {
		if (!this.enabled)
			return false;

		return EvaluateCharacterModifierConditionChain(this.conditions, gameState, spaceInfo, character);
	}

	public doLockAction(ctx: LockActionContext, action: LockAction): GameLogicModifierLockActionResult {
		switch (action.action) {
			case 'lock':
				return this.lockLock(ctx, action);
			case 'unlock':
				return this.lockUnlock(ctx, action);
			case 'showPassword':
				return this.lockShowPassword(ctx);
				break;
		}
		AssertNever(action);
	}

	public lockLock(ctx: LockActionContext, action: Extract<LockAction, { action: 'lock'; }>): GameLogicModifierLockActionResult {
		if (this._lock == null) {
			return { result: 'failure', problems: [{ result: 'invalidAction' }] };
		}

		const result = this._lock.logic.lock(ctx, action);

		switch (result.result) {
			case 'ok':
				if (ctx.executionContext === 'act') {
					this._lock.logic = result.newState;
				}
				return { result: 'ok' };

			case 'failed':
				return {
					result: 'failure',
					problems: [
						{
							result: 'characterModifierActionError',
							reason: {
								type: 'lockInteractionPrevented',
								moduleAction: 'lock',
								reason: result.reason,
							},
						},
					],
				};

			case 'invalid':
				return { result: 'failure', problems: [{ result: 'invalidAction' }] };
		}

		AssertNever(result);
	}

	public lockUnlock(ctx: LockActionContext, action: Extract<LockAction, { action: 'unlock'; }>): GameLogicModifierLockActionResult {
		if (this._lock == null) {
			return { result: 'failure', problems: [{ result: 'invalidAction' }] };
		}

		const result = this._lock.logic.unlock(ctx, action);

		switch (result.result) {
			case 'ok':
				if (ctx.executionContext === 'act') {
					this._lock.logic = result.newState;
				}
				return { result: 'ok' };

			case 'failed':
				return {
					result: 'failure',
					problems: [
						{
							result: 'characterModifierActionError',
							reason: {
								type: 'lockInteractionPrevented',
								moduleAction: 'unlock',
								reason: result.reason,
							},
						},
					],
				};

			case 'invalid':
				return { result: 'failure', problems: [{ result: 'invalidAction' }] };
		}

		AssertNever(result);
	}

	public lockShowPassword(ctx: LockActionContext): GameLogicModifierLockActionResult {
		if (this.lock == null) {
			return { result: 'failure', problems: [{ result: 'invalidAction' }] };
		}

		const result = this.lock.logic.showPassword(ctx);

		switch (result.result) {
			case 'ok':
				return {
					result: 'ok',
					password: result.password != null ? result.password : undefined,
				};

			case 'failed':
				return {
					result: 'failure',
					problems: [
						{
							result: 'characterModifierActionError',
							reason: {
								type: 'lockInteractionPrevented',
								moduleAction: 'showPassword',
								reason: result.reason,
							},
						},
					],
				};

			case 'invalid':
				return { result: 'failure', problems: [{ result: 'invalidAction' }] };
		}

		AssertNever(result);
	}
}

export class GameLogicModifierInstanceClient extends GameLogicModifierInstance {
	constructor(data: CharacterModifierInstanceClientData, logger?: Logger) {
		super(data, logger);
	}
}

export class GameLogicModifierInstanceServer extends GameLogicModifierInstance {
	constructor(data: CharacterModifierInstanceData, logger?: Logger) {
		super(data, logger);
	}

	public getData(): CharacterModifierInstanceData {
		return {
			id: this.id,
			type: this.type,
			name: this.name,
			enabled: this.enabled,
			config: CloneDeepMutable(this.config),
			conditions: CloneDeepMutable(this.conditions),
			lock: this.lock != null ? {
				lockType: this.lock.type,
				lockData: this.lock.logic.exportToServerBundle(),
			} : undefined,
			lockExceptions: CloneDeepMutable(this.lockExceptions),
		};
	}

	public setName(name: string): void {
		this._name = name;
	}

	public setEnabled(enabled: boolean): void {
		this._enabled = enabled;
	}

	public setConfig(config: CharacterModifierConfiguration): void {
		this._config = {
			...this.config,
			...config,
		};
	}

	public setConditions(conditions: CharacterModifierConditionChain): void {
		this._conditions = cloneDeep(conditions);
	}

	public setLockExceptions(lockExceptions: CharacterId[]): void {
		this._lockExceptions = cloneDeep(lockExceptions);
	}

	public addLock(lockType: CharacterModifierLockType): GameLogicModifierLockActionResult {
		if (this.lock != null)
			return { result: 'failure', problems: [{ result: 'invalidAction' }] };

		this._lock = {
			type: lockType,
			logic: LockLogic.loadFromBundle(
				CHARACTER_MODIFIER_LOCK_DEFINITIONS[lockType].lockSetup,
				undefined,
				{ doLoadTimeCleanup: true },
			),
		};
		return { result: 'ok' };
	}

	public removeLock(): GameLogicModifierLockActionResult {
		if (this.lock == null)
			return { result: 'failure', problems: [{ result: 'invalidAction' }] };

		this._lock = null;
		return { result: 'ok' };
	}
}
