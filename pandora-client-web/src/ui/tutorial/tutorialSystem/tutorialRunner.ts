import type { Immutable } from 'immer';
import { isEqual } from 'lodash-es';
import { AssertNever, GetLogger } from 'pandora-common';
import { Observable, type ReadonlyObservable } from '../../../observable.ts';
import type { TutorialCondition, TutorialConfig, TutorialStage } from './tutorialConfig.ts';
import type { TutorialFlagInfo } from './tutorialExternalConditions.tsx';

export class TutorialRunner {
	public readonly config: Immutable<TutorialConfig>;

	public readonly externalTutorialFlags = new Set<TutorialFlagInfo>();

	private _stageIndex: number = 0;
	public readonly currentStage: Observable<TutorialStageRunner | 'complete' | null>;

	public get stageIndex(): number {
		return this._stageIndex;
	}

	constructor(tutorial: Immutable<TutorialConfig>) {
		this.config = tutorial;
		this.currentStage = new Observable<TutorialStageRunner | 'complete' | null>(null);
		this.currentStage.value = this._generateStageRunner();
	}

	public advanceStage() {
		this._stageIndex++;
		this.currentStage.value = this._generateStageRunner();
	}

	public endTutorial(): void {
		this.currentStage.value = null;
	}

	private _generateStageRunner(): TutorialStageRunner | 'complete' | null {
		if (this.config.stages.length <= this._stageIndex)
			return 'complete';

		const stageConfig = this.config.stages[this._stageIndex];
		const currentStage = this.currentStage.value;
		if (currentStage != null && typeof currentStage !== 'string' && currentStage.config === stageConfig)
			return currentStage;

		return new TutorialStageRunner(stageConfig, this);
	}
}

export class TutorialStageRunner {
	public readonly config: Immutable<TutorialStage>;
	public readonly tutorial: TutorialRunner;

	private readonly _activeStepIndex = new Observable<number>(-1);
	private readonly _finishedNextConditions = new Set<number>();

	public get activeStepIndex(): ReadonlyObservable<number> {
		return this._activeStepIndex;
	}

	constructor(stage: Immutable<TutorialStage>, tutorial: TutorialRunner) {
		this.config = stage;
		this.tutorial = tutorial;
		this.update();
	}

	public update() {
		// Check for stage advancement
		if (this.config.advanceConditions != null) {
			if (this.config.advanceConditions.every((condition) => this._checkCondition(condition, -1))) {
				this._activeStepIndex.value = -1;
				return;
			}
		}

		// Look for first not finished step
		this._activeStepIndex.value = this.config.steps.findIndex((step, stepIndex) => {
			for (const condition of step.conditions) {
				if (!this._checkCondition(condition, stepIndex))
					return true;
			}
			return false;
		});
	}

	public stepClickNext(stepIndex: number): void {
		this._finishedNextConditions.add(stepIndex);
		this.update();
	}

	private _checkCondition(condition: Immutable<TutorialCondition>, stepIndex: number): boolean {
		if (condition.type === 'next') {
			return this._finishedNextConditions.has(stepIndex);
		} else if (condition.type === 'url') {
			const currentPath = window.location.pathname;

			if (typeof condition.url === 'string') {
				if (condition.url.endsWith('*')) {
					return currentPath.startsWith(condition.url.substring(0, condition.url.length - 1));
				} else {
					return currentPath === condition.url;
				}
			} else {
				return condition.url.test(currentPath);
			}
		} else if (condition.type === 'elementQuery') {
			const elements = Array.from(document.querySelectorAll(condition.query))
				.filter((e) => {
					if (!(e instanceof HTMLElement))
						return false;

					if (condition.filter == null)
						return true;

					try {
						return condition.filter(e);
					} catch (error) {
						GetLogger('TutorialStageRunner').warning('Crash while testing elementQuery condition:', error);
						return false;
					}
				});

			return condition.expectNoMatch ? (elements.length === 0) : (elements.length > 0);
		} else if (condition.type === 'flag') {
			for (const existingFlag of this.tutorial.externalTutorialFlags.values()) {
				if (existingFlag.flag === condition.flag) {
					// @ts-expect-error: Manual variant narrowing
					const result: unknown = (typeof condition.expect === 'function') ? condition.expect(existingFlag.value) : isEqual(condition.expect, existingFlag.value);
					if (result)
						return true;
				}
			}
			return false;
		} else if (condition.type === 'never') {
			return false;
		}
		AssertNever(condition);
	}
}
