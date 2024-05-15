import type { ReactNode } from 'react';

export interface TutorialConfig {
	id: string;
	name: string;
	stages: TutorialStage[];
}

export interface TutorialStage {
	advanceConditions?: TutorialCondition[];
	steps: TutorialStep[];
}

export interface TutorialStep {
	text: string | ReactNode;
	hideWhenCompleted?: true;
	conditions: TutorialCondition[];
}

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
	filter?: (element: Element) => boolean;
};

/** Special condition that is never true - useable for making sure the stage advancement triggers instead. */
export type TutorialConditionNever = {
	type: 'never';
};

export type TutorialCondition =
	| TutorialConditionNext
	| TutorialConditionUrl
	| TutorialConditionElementExists
	| TutorialConditionNever;
