import express, { Request, Response } from 'express';
import { performance } from 'perf_hooks';
import promClient from 'prom-client';

/** Host the metrics as express endpoint */
export function MetricsServe(): express.RequestHandler {
	return async (_req: Request, res: Response) => {
		res.set('Content-Type', promClient.register.contentType);
		const data = await promClient.register.metrics();
		res.end(data);
	};
}

// Set default label and collect some basic Node.js metrics
promClient.register.setDefaultLabels({
	app: 'pandora_directory',
});
promClient.collectDefaultMetrics({ prefix: 'pandora_directory_' });

// Collect event loop timings
// Not part of default metrics yet: https://github.com/siimon/prom-client/issues/399, https://github.com/siimon/prom-client/pull/474
if (performance.nodeTiming && performance.nodeTiming.idleTime !== undefined) {
	let lastIdle = performance.nodeTiming.idleTime;

	new promClient.Counter({
		name: 'pandora_directory_' + 'nodejs_eventloop_idle_seconds_total',
		help: "Total amount of time the event loop has been idle within the event loop's event provider",
		aggregator: 'average',
		collect() {
			const val = performance.nodeTiming.idleTime / 1e3;
			this.inc(val - lastIdle);
			lastIdle = val;
		},
	});
}
