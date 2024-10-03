import type { Immutable } from 'immer';
import { AssertNever, EMPTY_ARRAY, GetLogger } from 'pandora-common';
import React, { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { Button } from '../../../components/common/button/button';
import { Row } from '../../../components/common/container/container';
import { DialogInPortal, DraggableDialog, useConfirmDialog } from '../../../components/dialog/dialog';
import { useObservable } from '../../../observable';
import type { TutorialCondition, TutorialHighlightSelector, TutorialStep } from './tutorialConfig';
import type { TutorialRunner, TutorialStageRunner } from './tutorialRunner';
import './tutorialUi.scss';

export function ActiveTutorialUi({ tutorial, stopTutorial }: {
	tutorial: TutorialRunner;
	stopTutorial: () => void;
}): ReactElement | null {
	const stage = useObservable(tutorial.currentStage);
	const confirm = useConfirmDialog();

	useEffect(() => {
		if (stage == null) {
			stopTutorial();
		}
	}, [stage, stopTutorial]);

	const stopTutorialConfirm = useCallback(() => {
		confirm('Cancel tutorial', <>Are you sure you want to cancel the tutorial?</>, undefined, 'aboveTutorial')
			.then((result) => {
				if (result) {
					stopTutorial();
				}
			}, (err) => {
				GetLogger('ActiveTutorialUi').error('Confirm errored:', err);
			});
	}, [stopTutorial, confirm]);

	const contentRef = useRef<HTMLDivElement>(null);

	const scrollToEnd = useCallback(() => {
		const target = contentRef.current?.parentElement;
		if (target != null) {
			target.scroll({
				top: target.scrollHeight,
				left: 0,
				behavior: 'smooth',
			});
		}
	}, []);

	if (stage == null)
		return null;

	const headerBottom = document.getElementsByClassName('Header')[0]?.getBoundingClientRect().bottom ?? 26;
	const defaultShift = 26;

	return (
		<DraggableDialog title='Tutorial' className='tutorialDialogContainer' close={ stopTutorialConfirm } initialPosition={ { x: defaultShift, y: headerBottom + defaultShift } }>
			<div className='tutorialDialog div-container direction-column gap-medium' ref={ contentRef }>
				<strong>{ tutorial.config.name } ({ tutorial.stageIndex + 1 }/{ tutorial.config.stages.length })</strong>
				<ActiveTutorialStageUi stage={ stage } scrollToEnd={ scrollToEnd } />
			</div>
		</DraggableDialog>
	);
}

function ActiveTutorialStageUi({ stage, scrollToEnd }: {
	stage: TutorialStageRunner;
	scrollToEnd: () => void;
}): ReactElement | null {
	const activeStepIndex = useObservable(stage.activeStepIndex);

	useEffect(() => {
		if (activeStepIndex < 0) {
			stage.tutorial.advanceStage();
			return;
		}

		scrollToEnd();

		// If there is a step, trigger updates at regular intervals
		const interval = setInterval(() => {
			stage.update();
		}, 1_000);
		return () => {
			clearInterval(interval);
		};
	}, [stage, activeStepIndex, scrollToEnd]);

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
			<span className='finishedStep'>
				{
					typeof step.text === 'function' ? (
						<span><step.text /></span>
					) : <span>{ step.text }</span>
				}
			</span>
		);
	}

	return (
		<>
			{
				!step ? (
					null
				) : typeof step.text === 'function' ? (
					<span><step.text /></span>
				) : <span>{ step.text }</span>
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
						<ActiveTutorialElementHighlight target={ highlightElement } inset={ false } />
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
const HIGHLIGHT_INSET = 2;

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
						inset={ highlight.inset === true }
					/>
				))
			}
		</>
	);
}

function ActiveTutorialElementHighlight({ target, inset }: {
	target: HTMLElement;
	inset: boolean;
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
					left: inset ? (area[0] + HIGHLIGHT_INSET) : (area[0] - HIGHLIGHT_PADDING),
					top: inset ? (area[1] + HIGHLIGHT_INSET) : (area[1] - HIGHLIGHT_PADDING),
					width: inset ? (area[2] - 2 * HIGHLIGHT_INSET) : (area[2] + 2 * HIGHLIGHT_PADDING),
					height: inset ? (area[3] - 2 * HIGHLIGHT_INSET) : (area[3] + 2 * HIGHLIGHT_PADDING),
				} }
			/>
		</DialogInPortal>
	);
}
