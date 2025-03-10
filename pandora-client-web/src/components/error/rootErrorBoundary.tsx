import { GetLogger } from 'pandora-common';
import { createRef, ErrorInfo, PureComponent, ReactElement } from 'react';
import { toast } from 'react-toastify';
import { CopyToClipboard } from '../../common/clipboard.ts';
import { ChildrenProps } from '../../common/reactTypes.ts';
import { NODE_ENV } from '../../config/Environment.ts';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast.ts';
import { Button } from '../common/button/button.tsx';
import { Row } from '../common/container/container.tsx';
import { DebugContext, debugContext } from './debugContextProvider.tsx';
import { BuildErrorReport } from './errorReport.ts';
import './rootErrorBoundary.scss';

export enum ReportCopyState {
	NONE = 'Copy to clipboard',
	SUCCESS = 'Copied!',
	FAILED = 'Failed',
}

export interface RootErrorBoundaryState {
	report?: string;
	isTemporaryReport: boolean;
	copyState: ReportCopyState;
}

const logger = GetLogger('ErrorBoundary');

export class RootErrorBoundary extends PureComponent<ChildrenProps, RootErrorBoundaryState> {
	private timeout: number | null = null;
	private reportRef = createRef<HTMLSpanElement>();

	public override state: RootErrorBoundaryState = {
		copyState: ReportCopyState.NONE,
		isTemporaryReport: false,
	};

	public override render(): ReactElement {
		const { children } = this.props;
		const { report } = this.state;

		if (report) {
			return this.renderErrorContent();
		}

		return <>{ children }</>;
	}

	public static getDerivedStateFromError(error: unknown): Partial<RootErrorBoundaryState> {
		return {
			report: BuildErrorReport(error, undefined, undefined),
			isTemporaryReport: true,
		};
	}

	public override componentDidCatch(error: Error, errorInfo?: ErrorInfo) {
		logger.error('Caught error:', error, errorInfo);

		const { report, isTemporaryReport } = this.state;
		if (!report || isTemporaryReport) {
			const { debugData } = this.context as DebugContext;
			this.setState({
				report: BuildErrorReport(error, errorInfo, debugData),
				isTemporaryReport: false,
			});
		}
	}

	private readonly _uncaughtErrorListener = (event: ErrorEvent) => this._uncaughtErrorListenerRaw(event);
	private _uncaughtErrorListenerRaw(event: ErrorEvent): void {
		const errorDescription = `${event.message} @ ${event.filename}:${event.lineno}:${event.colno}\n`;
		// Test for ResizeObserver errors that shouldn't actually be errors
		if (/ResizeObserver.*(loop completed with undelivered notifications|loop limit exceeded)/.test(event.message)) {
			logger.warning('Got a ResizeObserver loop warning:\n', errorDescription, event.error);
			return;
		}
		// Be nice in development mode
		if (NODE_ENV === 'development') {
			logger.error('Uncaught error\n', errorDescription, event.error);
			toast('Detected uncaught error, see console', TOAST_OPTIONS_ERROR);
			return;
		}
		// Ignore 'Script error.' in production as it gives no useful info anyway and 99% of the time is an extension crashing, not us
		if (event.message === 'Script error.' && event.error == null) {
			logger.warning('Got a Script error:\n', errorDescription);
			return;
		}
		logger.fatal('Uncaught error\n', errorDescription, event.error);
		if (event.error instanceof Error) {
			this.componentDidCatch(event.error);
		} else {
			this.componentDidCatch(new Error(`Uncaught error:\n${errorDescription}${ String(event.error) }`));
		}
	}

	private readonly _unhandledPromiseRejectionListener = (event: PromiseRejectionEvent) => this._unhandledPromiseRejectionListenerRaw(event);
	private _unhandledPromiseRejectionListenerRaw(event: PromiseRejectionEvent): void {
		// Be nice in development mode
		if (NODE_ENV === 'development') {
			logger.error('Unhandled promise rejection', event.promise, `\n`, event.reason);
			toast('Detected unhandled promise rejection, see console', TOAST_OPTIONS_ERROR);
			return;
		}

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
						<Button onClick={ () => this.copyToClipboard() }>{ copyState }</Button>
					</span>
					<span data-testid='report-content' className='report-content' ref={ this.reportRef }>
						{ report }
					</span>
				</pre>

				<Row alignX='center' padding='medium'>
					<Button
						onClick={ () => {
							window.location.assign('/');
						} }
					>
						Reload the game
					</Button>
				</Row>
			</div>
		);
	}

	private copyToClipboard(): void {
		const { report } = this.state;

		CopyToClipboard(
			report ?? '',
			() => {
				this.setState({ copyState: ReportCopyState.SUCCESS });
				this.timeout = window.setTimeout(() => {
					this.setState({ copyState: ReportCopyState.NONE });
				}, 5000);
			},
			() => {
				this.setState({ copyState: ReportCopyState.FAILED });
				this.timeout = window.setTimeout(() => {
					this.setState({ copyState: ReportCopyState.NONE });
				}, 5000);
			},
		);
	}
}

RootErrorBoundary.contextType = debugContext;
