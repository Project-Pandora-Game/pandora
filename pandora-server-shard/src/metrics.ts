import { collectDefaultMetrics, Counter, register } from '@prometheus-io/client';
import { Request, Response, RequestHandler } from 'express';
import { performance } from 'perf_hooks';
import { ENV } from './config.ts';
const { SERVER_PUBLIC_ADDRESS } = ENV;

/** Host the metrics as express endpoint */
export function MetricsServe(): RequestHandler {
	return async (_req: Request, res: Response) => {
		res.set('Content-Type', register.contentType);
		const data = await register.metrics();
		res.end(data);
	};
}

// Set default labels and collect some basic Node.js metrics
register.setDefaultLabels({
	app: 'pandora_shard',
	shard_public_address: SERVER_PUBLIC_ADDRESS,
});
collectDefaultMetrics({ prefix: 'pandora_shard_' });

// Collect event loop timings
// Not part of default metrics yet: https://github.com/prometheus/client_js/issues/399, https://github.com/prometheus/client_js/pull/474
if (performance.nodeTiming && performance.nodeTiming.idleTime !== undefined) {
	let lastIdle = performance.nodeTiming.idleTime;

	new Counter({
		name: 'pandora_shard_' + 'nodejs_eventloop_idle_seconds_total',
		help: "Total amount of time the event loop has been idle within the event loop's event provider",
		aggregator: 'average',
		collect() {
			const val = performance.nodeTiming.idleTime / 1e3;
			this.inc(val - lastIdle);
			lastIdle = val;
		},
	});
}
