const path = require('path');

/**
 * Function that loads the target project config, deleting options not usable in the config
 * @param {string} dir - Path to the subproject
 */
function loadProjectConfig(dir) {
	const config = require(`./${dir}/jest.config.js`);

	/** @type { Exclude<import('jest').Config['projects'], undefined>[number] } */
	const resultConfig = {
		...config,
		displayName: dir,
		rootDir: path.join('./', dir, config.rootDir ?? '.'),
	};

	delete resultConfig.collectCoverageFrom;
	delete resultConfig.coverageDirectory;

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
