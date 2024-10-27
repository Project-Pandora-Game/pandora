import type { Immutable } from 'immer';
import { AssertNever, GetLogger } from 'pandora-common';
import { Observable, type ReadonlyObservable } from '../../../observable';
import type { TutorialCondition, TutorialConfig, TutorialStage } from './tutorialConfig';

export class TutorialRunner {
	public readonly config: Immutable<TutorialConfig>;

	private _stageIndex: number = 0;
	public readonly currentStage: Observable<TutorialStageRunner | null>;

	public get stageIndex(): number {
		return this._stageIndex;
	}

	constructor(tutorial: Immutable<TutorialConfig>) {
		this.config = tutorial;
		this.currentStage = new Observable<TutorialStageRunner | null>(null);
		this.currentStage.value = this._generateStageRunner();
	}

	public advanceStage() {
		this._stageIndex++;
		this.currentStage.value = this._generateStageRunner();
	}

	private _generateStageRunner(): TutorialStageRunner | null {
		if (this.config.stages.length <= this._stageIndex)
			return null;

		const stageConfig = this.config.stages[this._stageIndex];
		if (this.currentStage.value?.config === stageConfig)
			return this.currentStage.value;

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

	private _checkCondition(condition: TutorialCondition, stepIndex: number): boolean {
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

			return elements.length > 0;
		} else if (condition.type === 'never') {
			return false;
		}
		AssertNever(condition);
	}
}
