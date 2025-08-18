import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import { execSync } from 'child_process';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { loadEnvFile } from 'node:process';
import { join } from 'path';
import postcssPresetEnv from 'postcss-preset-env';
import ReactRefreshTypeScript from 'react-refresh-typescript';
import webpack from 'webpack';
import 'webpack-dev-server';

import { CreateEnvParser, type EnvInputJson } from 'pandora-common';
import { WEBPACK_CONFIG, type CLIENT_CONFIG, type VersionData } from './src/config/definition.ts';

const GIT_COMMIT_HASH = execSync('git rev-parse --short HEAD').toString().trim();
const GIT_DESCRIBE = execSync('git describe --tags --always --dirty').toString().trim();
const BUILD_TIME = 1000 * Math.floor(Date.now() / 1000);

// Load .env file
loadEnvFile('./.env');

// Load options from environment

const {
	DIRECTORY_ADDRESS,
	EDITOR_ASSETS_ADDRESS,
	EDITOR_ASSETS_OFFICIAL_ADDRESS,
	EXTRA_ASSETS_ADDRESS,
	WEBPACK_DEV_SERVER_PORT,
	WEBPACK_DEV_SERVER_SECURE,
	USER_DEBUG,
	DIST_DIR_OVERRIDE,
} = CreateEnvParser(WEBPACK_CONFIG)();

const SRC_DIR = join(import.meta.dirname, 'src');
const DIST_DIR = DIST_DIR_OVERRIDE ?? join(import.meta.dirname, 'dist');
const GAME_NAME = 'Pandora';

type WebpackMinimizer = webpack.WebpackPluginInstance | '...';

interface WebpackEnv {
	prod?: boolean;
}

export default function (env: WebpackEnv): webpack.Configuration {
	const mode = env.prod ? 'production' : 'development';
	return {
		devServer: {
			server: WEBPACK_DEV_SERVER_SECURE ? 'https' : 'http',
			historyApiFallback: {
				rewrites: [
					{ from: /^\/editor/, to: '/editor/index.html' },
					{ from: /./, to: '/index.html' },
				],
			},
			hot: true,
			open: false,
			client: {
				overlay: {
					// Do not show runtime error overlay - we have our own reporter
					runtimeErrors: false,
				},
			},
			devMiddleware: {
				writeToDisk: true,
			},
			port: WEBPACK_DEV_SERVER_PORT,
			proxy: [
				{
					context: '/server-proxy/directory',
					pathRewrite: { '^/server-proxy/directory': '' },
					target: 'http://localhost:25560',
					ws: true,
					secure: false,
				},
				{
					context: '/server-proxy/shard',
					pathRewrite: { '^/server-proxy/shard': '' },
					target: 'http://localhost:25561',
					ws: true,
					secure: false,
				},
			],
		},
		devtool: env.prod ? 'source-map' : 'inline-source-map',
		entry: {
			'index': join(SRC_DIR, 'index.tsx'),
			'editor/index': join(SRC_DIR, 'editor', 'index.tsx'),
		},
		mode,
		module: {
			rules: GenerateRules(env),
		},
		optimization: {
			minimizer: GenerateMinimizer(env),
		},
		output: {
			path: DIST_DIR,
			clean: true,
			filename: `[name]${env.prod ? '.[contenthash]' : ''}.js`,
			hashFunction: 'sha256',
			hashDigest: 'base64url',
			hashDigestLength: 16,
			publicPath: '/',
		},
		plugins: GeneratePlugins(env),
		resolve: {
			extensions: ['.ts', '.tsx', '.js'],
		},
		performance: {
			assetFilter: (assetFilename: string) => {
				// Ignore map files
				return !/\.map$/.test(assetFilename) &&
					// Ignore editor assets
					!/^editor\//.test(assetFilename);
			},
			// Increase limit to 3 MiB
			maxAssetSize: 3 * 1024 * 1024,
			maxEntrypointSize: 3 * 1024 * 1024,
		},
		infrastructureLogging: {
			level: 'log',
		},
	};
}

function GeneratePlugins(env: WebpackEnv): webpack.WebpackPluginInstance[] {
	const plugins: webpack.WebpackPluginInstance[] = [
		new ForkTsCheckerWebpackPlugin({
			async: false,
			typescript: {
				configOverwrite: {
					compilerOptions: {
						skipLibCheck: false,
						sourceMap: false,
						inlineSourceMap: false,
						declarationMap: false,
						jsx: env.prod ? 'react-jsx' : 'react-jsxdev',
					},
				},
			},
		}),
		new webpack.DefinePlugin({
			'process.env': JSON.stringify({
				NODE_ENV: env.prod ? 'production' : 'development',
				GAME_NAME,
				DIRECTORY_ADDRESS,
				EDITOR_ASSETS_ADDRESS,
				EDITOR_ASSETS_OFFICIAL_ADDRESS,
				EXTRA_ASSETS_ADDRESS,
				USER_DEBUG,
				GIT_COMMIT_HASH,
				GIT_DESCRIBE,
				BUILD_TIME,
			} satisfies EnvInputJson<typeof CLIENT_CONFIG>),
		}),
		new HtmlWebpackPlugin({
			template: join(SRC_DIR, 'index.ejs'),
			title: GAME_NAME,
			favicon: join(SRC_DIR, 'assets/favicon.png'),
			chunks: ['index'],
		}),
		new HtmlWebpackPlugin({
			template: join(SRC_DIR, 'editor', 'index.ejs'),
			title: `${GAME_NAME} Editor`,
			filename: 'editor/index.html',
			favicon: join(SRC_DIR, 'assets/favicon.png'),
			chunks: ['editor/index'],
		}),
		new GenerateStringPlugin('version.json', JSON.stringify({
			gitDescribe: GIT_DESCRIBE,
			gitCommitHash: GIT_COMMIT_HASH,
			buildTime: BUILD_TIME,
		} satisfies VersionData)),
	];

	if (env.prod) {
		plugins.push(new MiniCssExtractPlugin({
			filename: '[name].[contenthash].css',
			chunkFilename: '[name].[contenthash].chunk.css',
		}));
	} else {
		plugins.push(new ReactRefreshWebpackPlugin({
			overlay: false,
		}));
	}

	return plugins;
}

function GenerateRules(env: WebpackEnv): webpack.RuleSetRule[] {
	const moduleRules: webpack.RuleSetRule[] = [
		{
			test: /\.tsx?$/i,
			exclude: /node_modules/,
			use: [{
				loader: 'ts-loader',
				options: {
					configFile: 'tsconfig.json',
					compilerOptions: {
						jsx: env.prod ? 'react-jsx' : 'react-jsxdev',
					},
					getCustomTransformers: () => ({
						// @ts-expect-error: The typings somehow feel borked with ESM, but it works.
						before: [!env.prod && ReactRefreshTypeScript()].filter(Boolean),
					}),
				},
			}],
		},
		{
			test: /\.s?css$/i,
			use: GenerateStyleLoaders(env),
		},
		{
			test: /\.(png|jpe?g|gif|svg|eot|ttf|woff2?|mp3|wav)$/i,
			type: 'asset/resource',
			generator: {
				filename: 'assets/[name].[contenthash][ext][query]',
			},
		},
		{
			enforce: 'pre',
			test: /\.js$/i,
			exclude: /node_modules/,
			loader: 'source-map-loader',
		},
	];

	return moduleRules;
}

function GenerateMinimizer(env: WebpackEnv): WebpackMinimizer[] {
	const minimizer: WebpackMinimizer[] = ['...'];
	if (env.prod) {
		minimizer.push(new CssMinimizerPlugin({
			minimizerOptions: {
				// Use lite preset, as some transforms done by the minimizer can have unexpected consequences
				preset: 'lite',
			},
		}));
	}
	return minimizer;
}

function GenerateStyleLoaders(env: WebpackEnv): webpack.RuleSetUseItem[] {
	const styleLoaders: webpack.RuleSetUseItem[] = [
		{ loader: 'css-loader' },
		{
			loader: 'postcss-loader',
			options: {
				postcssOptions: {
					plugins: [
						postcssPresetEnv({ preserve: true }),
					],
				},
			},
		},
		{ loader: 'sass-loader' },
	];

	if (env.prod) {
		styleLoaders.unshift(MiniCssExtractPlugin.loader);
	} else {
		styleLoaders.unshift({ loader: 'style-loader' });
	}

	return styleLoaders;
}

class GenerateStringPlugin {
	private readonly _asset: string;
	private readonly _value: string;

	public readonly name: string = 'GenerateStringPlugin';

	constructor(asset: string, value: string) {
		this._asset = asset;
		this._value = value;
	}

	public apply(compiler: webpack.Compiler) {
		compiler.hooks.compilation.tap(this, (compilation) => {
			compilation.hooks.processAssets.tap(
				{
					name: 'GenerateVersionJson',
					stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
				},
				(assets) => {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					assets[this._asset] = {
						source: () => this._value,
						size: () => this._value.length,
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
					} as unknown as any;
				},
			);
		});
	}
}
