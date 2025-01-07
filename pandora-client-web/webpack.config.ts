import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import { execSync } from 'child_process';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import { config } from 'dotenv';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin, { loader as miniCssExtractLoader } from 'mini-css-extract-plugin';
import { join } from 'path';
import postcssFlexbugsFixes from 'postcss-flexbugs-fixes';
import postcssPresetEnv from 'postcss-preset-env';
import ReactRefreshTypeScript from 'react-refresh-typescript';
import { Compilation, Compiler, Configuration, DefinePlugin, RuleSetRule, RuleSetUseItem, WebpackPluginInstance } from 'webpack';
import 'webpack-dev-server';
import packageJson from './package.json';

import { CreateEnvParser, type EnvInputJson } from 'pandora-common';
import { WEBPACK_CONFIG, type CLIENT_CONFIG } from './src/config/definition';

const GIT_COMMIT_HASH = execSync('git rev-parse --short HEAD').toString().trim();
const GIT_DESCRIBE = execSync('git describe --tags --always --dirty').toString().trim();

// Load .env file
config();

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

const SRC_DIR = join(__dirname, 'src');
const DIST_DIR = DIST_DIR_OVERRIDE ?? join(__dirname, 'dist');
const GAME_NAME = 'Pandora';

type WebpackMinimizer = WebpackPluginInstance | '...';

interface WebpackEnv {
	prod?: boolean;
}

export default function (env: WebpackEnv): Configuration {
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
			filename: `[name]${env.prod ? '.[chunkhash]' : ''}.js`,
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

function GeneratePlugins(env: WebpackEnv): WebpackPluginInstance[] {
	const plugins: WebpackPluginInstance[] = [
		new CleanWebpackPlugin({ verbose: true }),
		new ForkTsCheckerWebpackPlugin({
			async: false,
			typescript: {
				configOverwrite: {
					compilerOptions: {
						skipLibCheck: false,
						sourceMap: false,
						inlineSourceMap: false,
						declarationMap: false,
					},
				},
			},
		}),
		new DefinePlugin({
			'process.env': JSON.stringify({
				NODE_ENV: env.prod ? 'production' : 'development',
				GAME_VERSION: packageJson.version,
				GAME_NAME,
				DIRECTORY_ADDRESS,
				EDITOR_ASSETS_ADDRESS,
				EDITOR_ASSETS_OFFICIAL_ADDRESS,
				EXTRA_ASSETS_ADDRESS,
				USER_DEBUG,
				GIT_COMMIT_HASH,
				GIT_DESCRIBE,
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
			version: packageJson.version,
		})),
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

function GenerateRules(env: WebpackEnv): RuleSetRule[] {
	const moduleRules: RuleSetRule[] = [
		{
			test: /\.tsx?$/i,
			exclude: /node_modules/,
			use: [{
				loader: 'ts-loader',
				options: {
					configFile: 'tsconfig.json',
					getCustomTransformers: () => ({
						before: [!env.prod && ReactRefreshTypeScript()].filter(Boolean),
					}),
				},
			}],
		},
		{
			test: /\.(png|jpe?g|gif|svg|eot|ttf|woff2?|mp3|wav)$/i,
			loader: 'url-loader',
			issuer: /\.[jt]sx?$/,
			options: {
				limit: 8192,
				esModule: false,
				name: 'assets/[contenthash].[ext]',
			},
		},
		{
			test: /\.s?css$/i,
			use: GenerateStyleLoaders(env),
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
		minimizer.push(new CssMinimizerPlugin());
	}
	return minimizer;
}

function GenerateStyleLoaders(env: WebpackEnv): RuleSetUseItem[] {
	const styleLoaders: RuleSetUseItem[] = [
		{ loader: 'css-loader' },
		{
			loader: 'postcss-loader',
			options: {
				postcssOptions: {
					plugins: [
						postcssFlexbugsFixes(),
						postcssPresetEnv({ preserve: true }),
					],
				},
			},
		},
		{
			loader: '@project-pandora-game/sass-loader',
			options: {
				ignoreErrors: !env.prod,
			},
		},
	];

	if (env.prod) {
		styleLoaders.unshift(miniCssExtractLoader);
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

	public apply(compiler: Compiler) {
		compiler.hooks.compilation.tap(this, (compilation) => {
			compilation.hooks.processAssets.tap(
				{
					name: 'GenerateVersionJson',
					stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
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
