import express from 'express';
import { readFileSync, statSync } from 'fs';
import { AssetManager, AssetsDefinitionFile, GetLogger, IsObject } from 'pandora-common';
import { join } from 'path';
import { CharacterManager } from '../character/characterManager.ts';
import { ENV } from '../config.ts';
import { ConnectionManagerClient } from '../networking/manager_client.ts';
import { SpaceManager } from '../spaces/spaceManager.ts';

const { ASSETS_DEFINITION_PATH, SHARD_DEVELOPMENT_MODE } = ENV;

const logger = GetLogger('AssetManager');

export let assetManager = new AssetManager('');

// Checks asset definitions for changes every 2 seconds, if in development mode, every 15 seconds otherwise
const ASSET_DEFINITIONS_WATCH_INTERVAL = SHARD_DEVELOPMENT_MODE ? 2_000 : 15_000;
let watcher: NodeJS.Timeout | undefined;

// This function is intentionally using synchronous calls to make sure that during reload it won't be interrupted with any other event
export function LoadAssetDefinitions(): void {
	if (!ASSETS_DEFINITION_PATH) {
		throw new Error('Missing required ASSETS_DEFINITION_PATH config');
	}
	if (!statSync(ASSETS_DEFINITION_PATH).isDirectory()) {
		throw new Error('ASSETS_DEFINITION_PATH is not a directory');
	}

	const currentFilePath = join(ASSETS_DEFINITION_PATH, 'current');
	const currentHash = readFileSync(currentFilePath, { encoding: 'utf8' }).trim();

	const definitionsFilePath = join(ASSETS_DEFINITION_PATH, `assets_${currentHash}.json`);
	const definitions = JSON.parse(readFileSync(definitionsFilePath, { encoding: 'utf8' })) as AssetsDefinitionFile;

	if (!IsObject(definitions)) {
		throw new Error('Failed to read asset definitions');
	}

	assetManager = new AssetManager(currentHash, definitions);

	logger.info(`Loaded asset definitions, version: ${assetManager.definitionsHash}`);

	SpaceManager.onAssetDefinitionsChanged();
	CharacterManager.onAssetDefinitionsChanged();
	ConnectionManagerClient.onAssetDefinitionsChanged();

	if (watcher === undefined) {
		watcher = setInterval(WatchAssetDefinitionsTick, ASSET_DEFINITIONS_WATCH_INTERVAL).unref();
	}
}

function WatchAssetDefinitionsTick(): void {
	const currentFilePath = join(ASSETS_DEFINITION_PATH, 'current');
	try {
		if (!statSync(currentFilePath).isFile())
			return;
		const currentHash = readFileSync(currentFilePath, { encoding: 'utf8' }).trim();
		// Avoid race conditions by checking the file is not empty and points to a valid file
		if (!currentHash || !statSync(join(ASSETS_DEFINITION_PATH, `assets_${currentHash}.json`)).isFile())
			return;

		if (currentHash !== assetManager.definitionsHash) {
			logger.alert(`Detected asset definitions change: ${assetManager.definitionsHash} -> ${currentHash}`);
			LoadAssetDefinitions();
			logger.info('Done sending new definitions');
		}
	} catch (_error) {
		// Ignore
	}
}

export function AssetsServe(): express.RequestHandler {
	if (!ASSETS_DEFINITION_PATH) {
		throw new Error('Missing required ASSETS_DEFINITION_PATH config');
	}
	if (!statSync(ASSETS_DEFINITION_PATH).isDirectory()) {
		throw new Error('ASSETS_DEFINITION_PATH is not a directory');
	}

	return express.static(ASSETS_DEFINITION_PATH, {
		dotfiles: 'ignore',
		lastModified: true,
		cacheControl: true,
		maxAge: '7 days',
		immutable: true,
		etag: false,
	});
}
