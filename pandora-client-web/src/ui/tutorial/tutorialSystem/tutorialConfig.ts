import type { TutorialId } from 'pandora-common';
import type { ReactNode } from 'react';
import type { TutorialFlags } from './tutorialExternalConditions.tsx';

export type TutorialDisableReason = 'workInProgress';

export interface TutorialConfig {
	id: TutorialId;
	name: string;
	/** If this option is set on a tutorial, it will not be usable and it will show the reason why. */
	disabled?: TutorialDisableReason;
	description: string | ReactNode;
	stages: TutorialStage[];
}

export interface TutorialStage {
	advanceConditions?: TutorialCondition[];
	/**
	 * This makes the tutorial stage modal, preventing user from interacting with Pandora while it is active.
	 * @default false
	 */
	modal?: true;
	steps: TutorialStep[];
}

export interface TutorialStep {
	text: string | ReactNode | React.FC;
	hideWhenCompleted?: true;
	conditions: TutorialCondition[];
	highlight?: TutorialHighlightSelector[];
}

export type TutorialHighlightSelector = {
	query: string;
	filter?: (element: HTMLElement) => boolean;
	/**
	 * Whether the highlight should be inset into the element's bounding box, rather than positioned around it.
	 * @default false
	 */
	inset?: true;
	/**
	 * What z index should this highlighted be positioned on.
	 * @default 'normal'
	 */
	zIndex?: 'normal' | 'aboveTutorial';
};

export type TutorialConditionUrl = {
	type: 'url';
	url: string | RegExp;
};

export type TutorialConditionNext = {
	type: 'next';
};

export type TutorialConditionElementExists = {
	type: 'elementQuery';
	query: string;
	filter?: (element: HTMLElement) => boolean;
	/**
	 * Whether to expect no element to match to continue (inverts the condition).
	 * @default false
	 */
	expectNoMatch?: boolean;
};

export type TutorialConditionFlag = {
	[Flag in keyof TutorialFlags]: {
		type: 'flag';
		flag: Flag;
		expect: NoInfer<TutorialFlags[Flag] | ((value: TutorialFlags[Flag]) => boolean)>;
	};
}[keyof TutorialFlags];

export function MakeTutorialConditionFlag<const TFlag extends keyof TutorialFlags>(flag: TFlag, expect: NoInfer<TutorialFlags[TFlag] | ((value: TutorialFlags[TFlag]) => boolean)>): TutorialConditionFlag {
	return {
		type: 'flag',
		flag,
		// @ts-expect-error: It is correct, but TS complains anyway...
		expect,
	};
}

/** Special condition that is never true - useable for making sure the stage advancement triggers instead. */
export type TutorialConditionNever = {
	type: 'never';
};

export type TutorialCondition =
	| TutorialConditionNext
	| TutorialConditionUrl
	| TutorialConditionElementExists
	| TutorialConditionFlag
	| TutorialConditionNever;
