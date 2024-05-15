import type { Immutable } from 'immer';
import { AssertNever, EMPTY_ARRAY } from 'pandora-common';
import React, { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Button } from '../../../components/common/button/button';
import { Column, Row } from '../../../components/common/container/container';
import { DialogInPortal, DraggableDialog } from '../../../components/dialog/dialog';
import { useObservable } from '../../../observable';
import type { TutorialCondition, TutorialHighlightSelector, TutorialStep } from './tutorialConfig';
import type { TutorialRunner, TutorialStageRunner } from './tutorialRunner';
import './tutorialUi.scss';

export function ActiveTutorialUi({ tutorial, stopTutorial }: {
	tutorial: TutorialRunner;
	stopTutorial: () => void;
}): ReactElement | null {
	const stage = useObservable(tutorial.currentStage);

	useEffect(() => {
		if (stage == null) {
			stopTutorial();
		}
	}, [stage, stopTutorial]);

	if (stage == null)
		return null;

	return (
		<DraggableDialog title='Tutorial' close={ stopTutorial }>
			<Column className='tutorialDialog'>
				<strong>{ tutorial.config.name } ({ tutorial.stageIndex + 1 }/{ tutorial.config.stages.length })</strong>
				<ActiveTutorialStageUi stage={ stage } />
			</Column>
		</DraggableDialog>
	);
}

function ActiveTutorialStageUi({ stage }: {
	stage: TutorialStageRunner;
}): ReactElement | null {
	const activeStepIndex = useObservable(stage.activeStepIndex);

	useEffect(() => {
		if (activeStepIndex < 0) {
			stage.tutorial.advanceStage();
			return;
		}

		// If there is a step, trigger updates at regular intervals
		const interval = setInterval(() => {
			stage.update();
		}, 1_000);
		return () => {
			clearInterval(interval);
		};
	}, [stage, activeStepIndex]);

	if (activeStepIndex < 0)
		return null;

	return (
		<>
			{
				stage.config.steps
					.slice(0, activeStepIndex + 1)
					.map((step, stepIndex) => (
						<ActiveTutorialStepUi key={ stepIndex }
							stage={ stage }
							stepIndex={ stepIndex }
							step={ step }
							active={ stepIndex === activeStepIndex }
						/>
					))
			}
		</>
	);
}

function ActiveTutorialStepUi({ stage, step, stepIndex, active }: {
	stage: TutorialStageRunner;
	stepIndex: number;
	step: Immutable<TutorialStep>;
	active: boolean;
}): ReactElement | null {
	if (!active) {
		if (!step.text || step.hideWhenCompleted)
			return null;

		return (
			<span className='finishedStep'>{ step.text }</span>
		);
	}

	return (
		<>
			{
				step.text ? (
					<span>{ step.text }</span>
				) : null
			}
			{
				step.highlight?.map((highlight, index) => (
					<ActiveTutorialHighlight key={ index }
						highlight={ highlight }
					/>
				))
			}
			{
				step.conditions.map((condition, conditionIndex) => (
					<ActiveTutorialStepCondition key={ conditionIndex }
						stage={ stage }
						stepIndex={ stepIndex }
						step={ step }
						condition={ condition }
					/>
				))
			}
		</>
	);
}

function ActiveTutorialStepCondition({ condition, stage, stepIndex }: {
	stage: TutorialStageRunner;
	stepIndex: number;
	step: Immutable<TutorialStep>;
	condition: Immutable<TutorialCondition>;
}): ReactElement | null {
	const [highlightElement, setHighlightElement] = useState<HTMLElement | null>(null);

	if (condition.type === 'next') {

		return (
			<Row alignX='end'>
				<Button
					slim
					onClick={ () => {
						stage.stepClickNext(stepIndex);
					} }
					ref={ setHighlightElement }
				>
					Next { '\u25b8' }
				</Button>
				{
					highlightElement != null ? (
						<ActiveTutorialElementHighlight target={ highlightElement } />
					) : null
				}
			</Row>
		);
	} else if (condition.type === 'url') {
		return null;
	} else if (condition.type === 'elementQuery') {
		return null;
	} else if (condition.type === 'never') {
		return null;
	}

	AssertNever(condition);
}

const HIGHLIGHT_QUERY_INTERVAL = 1_000;
const HIGHLIGHT_POSITION_INTERVAL = 200;
const HIGHLIGHT_PADDING = 8;

function ActiveTutorialHighlight({ highlight }: {
	highlight: TutorialHighlightSelector;
}): ReactElement {
	const [elements, setElements] = useState<readonly HTMLElement[]>(EMPTY_ARRAY);

	const update = useCallback(() => {
		const newElements = Array.from(document.querySelectorAll(highlight.query))
			.filter((e): e is HTMLElement => e instanceof HTMLElement)
			.filter((e) => {
				if (highlight.filter == null)
					return true;

				return highlight.filter(e);
			});

		setElements(newElements);
	}, [highlight]);

	useEffect(() => {
		const interval = setInterval(update, HIGHLIGHT_QUERY_INTERVAL);
		update();

		return () => {
			clearInterval(interval);
		};
	}, [update]);

	return (
		<>
			{
				elements.map((el, i) => (
					<ActiveTutorialElementHighlight key={ el.id || i }
						target={ el }
					/>
				))
			}
		</>
	);
}

function ActiveTutorialElementHighlight({ target }: {
	target: HTMLElement;
}): ReactElement | null {
	const [area, setArea] = useState<[number, number, number, number]>([0, 0, 0, 0]);

	const update = useCallback(() => {
		if (target.offsetParent == null) {
			setArea([0, 0, 0, 0]);
			return;
		}

		const bounds = target.getBoundingClientRect();
		setArea([bounds.left, bounds.top, bounds.width, bounds.height]);
	}, [target]);

	useEffect(() => {
		const resizeObserver = new ResizeObserver(update);
		resizeObserver.observe(target);

		// Update on timer too, because resize observer doesn't catch moves
		const interval = setInterval(update, HIGHLIGHT_POSITION_INTERVAL);

		update();

		return () => {
			clearInterval(interval);
			resizeObserver.disconnect();
		};
	}, [target, update]);

	if (area[2] === 0 || area[3] === 0)
		return null;

	return (
		<DialogInPortal>
			<div
				className='tutorial-highlight-overlay'
				style={ {
					left: area[0] - HIGHLIGHT_PADDING,
					top: area[1] - HIGHLIGHT_PADDING,
					width: area[2] + 2 * HIGHLIGHT_PADDING,
					height: area[3] + 2 * HIGHLIGHT_PADDING,
				} }
			/>
		</DialogInPortal>
	);
}
