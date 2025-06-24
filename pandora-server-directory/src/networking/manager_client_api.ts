import { Router } from 'express';
import { PandoraApiCharacter } from './api/character.ts';
import { PandoraApiManagement } from './api/mgmt.ts';

export function PandoraPublicApi(): Router {
	const router = Router();

	router.use(function (req, res, next) {
		res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
		res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
		res.header('Access-Control-Expose-Headers', 'Content-Length');
		res.header('Access-Control-Allow-Headers', 'Accept, Authorization, Content-Type, X-Requested-With, Range');
		if (req.method === 'OPTIONS') {
			res.sendStatus(200);
			return;
		} else {
			return next();
		}
	});

	router.use('/character', PandoraApiCharacter());
	router.use('/mgmt', PandoraApiManagement());

	return router;
}
