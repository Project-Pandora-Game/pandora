import { GetLogger } from 'pandora-common';
import React, { createRef, ErrorInfo, PureComponent, ReactElement } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { NODE_ENV } from '../../config/Environment';
import { Button } from '../common/Button/Button';
import { DebugContext, debugContext } from './debugContextProvider';
import { BuildErrorReport } from './errorReport';
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

const logger = GetLogger('ErrorBoundary');

export class RootErrorBoundary extends PureComponent<ChildrenProps, RootErrorBoundaryState> {
	private timeout: number | null = null;
	private reportRef = createRef<HTMLSpanElement>();

	public override state: RootErrorBoundaryState = {
		copyState: ReportCopyState.NONE,
	};

	public override render(): ReactElement {
		const { children } = this.props;
		const { report } = this.state;

		if (report) {
			return this.renderErrorContent();
		}

		return <>{ children }</>;
	}

	public override componentDidCatch(error: Error, errorInfo?: ErrorInfo) {
		const { report } = this.state;
		if (!report) {
			const { debugData } = this.context as DebugContext;
			this.setState({
				report: BuildErrorReport(error, errorInfo, debugData),
			});
		}
	}

	private readonly _uncaughtErrorListener = (event: ErrorEvent) => this._uncaughtErrorListenerRaw(event);
	private _uncaughtErrorListenerRaw(event: ErrorEvent): void {
		logger.fatal('Uncaught error\n', `${event.message} @ ${event.filename}:${event.lineno}:${event.colno}\n`, event.error);
		if (event.error instanceof Error) {
			this.componentDidCatch(event.error);
		} else if (event.error === null && NODE_ENV !== 'production') {
			return;
		} else {
			this.componentDidCatch(new Error(`Uncaught error: ${ String(event.error) }`));
		}
	}

	private readonly _unhandledPromiseRejectionListener = (event: PromiseRejectionEvent) => this._unhandledPromiseRejectionListenerRaw(event);
	private _unhandledPromiseRejectionListenerRaw(event: PromiseRejectionEvent): void {
		logger.fatal('Unhandled promise rejection', event.promise, `\n`, event.reason);
		if (event.reason instanceof Error) {
			this.componentDidCatch(event.reason);
		} else {
			this.componentDidCatch(new Error(`Unhandled promise rejection: ${ String(event.reason) }`));
		}
	}

	public override componentDidMount(): void {
		window.addEventListener('error', this._uncaughtErrorListener);
		window.addEventListener('unhandledrejection', this._unhandledPromiseRejectionListener);
	}

	public override componentWillUnmount(): void {
		if (this.timeout) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}
		window.removeEventListener('error', this._uncaughtErrorListener);
		window.removeEventListener('unhandledrejection', this._unhandledPromiseRejectionListener);
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
