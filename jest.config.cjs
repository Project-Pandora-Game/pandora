/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');

/**
 * Function that loads the target project config, deleting options not usable in the config
 * @param {string} dir - Path to the subproject
 */
function loadProjectConfig(dir) {
	/** @type { Exclude<import('jest').Config['projects'], undefined>[number] } */
	const config = require(`./${dir}/jest.config.js`);

	/** @type { Exclude<import('jest').Config['projects'], undefined>[number] } */
	const resultConfig = {
		...config,
		displayName: dir,
		rootDir: path.join('./', dir, config.rootDir ?? '.'),
	};

	// Fixup ts-jest project links
	if (typeof resultConfig !== 'string' && resultConfig.transform) {
		for (const transformConfig of Object.values(resultConfig.transform)) {
			if (
				typeof transformConfig !== 'string' &&
				transformConfig[0] === 'ts-jest' &&
				transformConfig[1] != null &&
				typeof transformConfig[1] === 'object' &&
				typeof transformConfig[1].tsconfig === 'string'
			) {
				transformConfig[1].tsconfig = path.resolve('./', dir, transformConfig[1].tsconfig);
			}
		}
	}

	delete resultConfig.collectCoverageFrom;
	delete resultConfig.coverageDirectory;
	delete resultConfig.coverageProvider;

	return resultConfig;
}

/**
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 * @type { import('jest').Config }
 */
module.exports = {
	projects: [
		loadProjectConfig('pandora-common'),
		loadProjectConfig('pandora-server-directory'),
		loadProjectConfig('pandora-server-shard'),
		loadProjectConfig('pandora-client-web'),
	],
	errorOnDeprecated: true,
};
