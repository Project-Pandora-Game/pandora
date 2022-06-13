import React, { createRef, ErrorInfo, PureComponent, ReactElement } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { Button } from '../common/Button/Button';
import { DebugContext, debugContext } from './debugContextProvider';
import { BuildErrorReport } from './errorReport';
import { ErrorTrap } from './errorTrap';
import './rootErrorBoundary.scss';

export enum ReportCopyState {
	NONE = 'Copy to clipboard',
	SUCCESS = 'Copied!',
	FAILED = 'Failed',
}

export interface RootErrorBoundaryState {
	report?: string;
	copyState: ReportCopyState;
}

export class RootErrorBoundary extends PureComponent<ChildrenProps, RootErrorBoundaryState> {
	private timeout: number | null = null;
	private reportRef = createRef<HTMLSpanElement>();

	public override state: RootErrorBoundaryState = {
		copyState: ReportCopyState.NONE,
	};

	public override render(): ReactElement {
		const { children } = this.props;
		const { report } = this.state;

		return (
			<ErrorTrap>
				{ report && this.renderErrorContent() }
				{ !report && children }
			</ErrorTrap>
		);
	}

	public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		const { debugData } = this.context as DebugContext;
		const report = BuildErrorReport(error, errorInfo, debugData);
		this.setState({ report });
	}

	public override componentWillUnmount(): void {
		if (this.timeout) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}
	}

	private renderErrorContent(): ReactElement {
		const { copyState, report } = this.state;
		return (
			<div className='RootErrorBoundary'>
				<h1>Something went wrong</h1>
				<p>
					Pandora has run into an error - this is likely a problem with the game. Please report this error,
					providing the following information:
				</p>

				<pre>
					<span className='button-wrapper'>
						<Button onClick={ () => void this.copyToClipboard() }>{ copyState }</Button>
					</span>
					<span data-testid='report-content' className='report-content' ref={ this.reportRef }>
						{ report }
					</span>
				</pre>

				<p>In the event that this is an intermittent error, you can try <a href='/'>reloading the game.</a></p>
			</div>
		);
	}

	private async copyToClipboard(): Promise<void> {
		let copied = await this.copyUsingClipboardApi();

		if (!copied) {
			copied = this.copyUsingCommand();
		}

		if (copied) {
			this.setState({ copyState: ReportCopyState.SUCCESS });
		} else {
			this.setState({ copyState: ReportCopyState.FAILED });
		}
		this.timeout = window.setTimeout(() => {
			this.setState({ copyState: ReportCopyState.NONE });
		}, 5000);
	}

	private async copyUsingClipboardApi(): Promise<boolean> {
		const { report } = this.state;
		try {
			await navigator.clipboard.writeText(report ?? '');
			return true;
		} catch (_) {
			return false;
		}
	}

	private copyUsingCommand(): boolean {
		try {
			const reportElement = this.reportRef.current;
			if (!reportElement) {
				return false;
			}
			const range = document.createRange();
			range.selectNode(reportElement);
			window.getSelection()?.removeAllRanges();
			window.getSelection()?.addRange(range);
			return document.execCommand('copy');
		} catch (_) {
			return false;
		}
	}
}

RootErrorBoundary.contextType = debugContext;
