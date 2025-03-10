import express, { Request, Response } from 'express';
import { performance } from 'perf_hooks';
import promClient from 'prom-client';
import { ENV } from './config.ts';
const { SERVER_PUBLIC_ADDRESS } = ENV;

/** Host the metrics as express endpoint */
export function MetricsServe(): express.RequestHandler {
	return (_req: Request, res: Response) => {
		res.set('Content-Type', promClient.register.contentType);
		promClient.register.metrics().then(
			(data) => res.end(data),
			(err) => res.status(500).end(err),
		);
	};
}

// Set default labels and collect some basic Node.js metrics
promClient.register.setDefaultLabels({
	app: 'pandora_shard',
	shard_public_address: SERVER_PUBLIC_ADDRESS,
});
promClient.collectDefaultMetrics({ prefix: 'pandora_shard_' });

// Collect event loop timings
// Not part of default metrics yet: https://github.com/siimon/prom-client/issues/399, https://github.com/siimon/prom-client/pull/474
if (performance.nodeTiming && performance.nodeTiming.idleTime !== undefined) {
	let lastIdle = performance.nodeTiming.idleTime;

	new promClient.Counter({
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
