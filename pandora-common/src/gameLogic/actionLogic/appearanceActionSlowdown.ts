/** Time (in milliseconds) that specific slowdown reasons should slow the action done for. */
export const GAME_LOGIC_ACTION_SLOWDOWN_TIMES = {
	/** Performing an action while having blocked hands. */
	blockedHands: 5_000,
	/** Slowdown caused by character modifiers. Implicity 0, but custsom value is added in `AppearanceActionProcessingResult` */
	modifierSlowdown: 0,
} as const satisfies Record<string, number>;

export type GameLogicActionSlowdownReason = (keyof typeof GAME_LOGIC_ACTION_SLOWDOWN_TIMES) & string;
