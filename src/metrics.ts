import promClient from 'prom-client';
import express, { Request, Response } from 'express';

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

// Set default label and collect some basic Node.js metrics
promClient.register.setDefaultLabels({
	app: 'pandora_directory',
});
promClient.collectDefaultMetrics({ prefix: 'pandora_directory_' });
