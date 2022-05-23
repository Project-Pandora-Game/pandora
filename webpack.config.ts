import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import { config } from 'dotenv';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin, { loader as miniCssExtractLoader } from 'mini-css-extract-plugin';
import { join } from 'path';
import postcssFlexbugsFixes from 'postcss-flexbugs-fixes';
import postcssPresetEnv from 'postcss-preset-env';
import { Configuration, DefinePlugin, RuleSetRule, RuleSetUseItem, WebpackPluginInstance } from 'webpack';
import 'webpack-dev-server';
import packageJson from './package.json';

const {
	DIRECTORY_ADDRESS = 'http://127.0.0.1:25560',
	WEBPACK_DEV_SERVER_PORT = '6969',
} = config().parsed ?? {};

const SRC_DIR = join(__dirname, 'src');
const DIST_DIR = join(__dirname, 'dist');
const GAME_NAME = 'Pandora';

type WebpackMinimizer = WebpackPluginInstance | '...';

interface WebpackEnv {
	prod?: boolean;
}

export default function (env: WebpackEnv): Configuration {
	const mode = env.prod ? 'production' : 'development';
	return {
		devServer: {
			historyApiFallback: {
				rewrites: [
					{ from: /^\/editor/, to: '/editor/index.html' },
					{ from: /./, to: '/index.html' },
				],
			},
			hot: true,
			open: true,
			port: parseInt(WEBPACK_DEV_SERVER_PORT, 10),
			static: {
				directory: join(__dirname, '..', 'pandora-assets', 'out'),
				publicPath: '/pandora-assets',
				serveIndex: true,
			},
		},
		devtool: env.prod ? false : 'eval-source-map',
		entry: {
			'index': join(SRC_DIR, 'index.tsx'),
			// eslint-disable-next-line @typescript-eslint/naming-convention
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
		},
		plugins: GeneratePlugins(env),
		resolve: {
			extensions: ['.ts', '.tsx', '.js'],
		},
	};
}

function GeneratePlugins(env: WebpackEnv): WebpackPluginInstance[] {
	const plugins: WebpackPluginInstance[] = [
		new CleanWebpackPlugin({ verbose: true }),
		new DefinePlugin({
			/* eslint-disable @typescript-eslint/naming-convention */
			'process.env': JSON.stringify({
				NODE_ENV: env.prod ? 'production' : 'development',
				VERSION: packageJson.version,
				GAME_NAME,
				DIRECTORY_ADDRESS,
			}),
			/* eslint-enable @typescript-eslint/naming-convention */
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
	];

	if (env.prod) {
		plugins.push(new MiniCssExtractPlugin({
			filename: '[name].[contenthash].css',
			chunkFilename: '[name].[contenthash].chunk.css',
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
					configFile: 'tsconfig.src.json',
				},
			}],
		},
		{
			test: /\.(png|jpe?g|gif|svg|eot|ttf|woff2?)$/i,
			loader: 'url-loader',
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
	];

	if (!env.prod) {
		moduleRules.push({
			enforce: 'pre',
			test: /\.js$/i,
			exclude: /node_modules/,
			loader: 'source-map-loader',
		});
	}

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
						postcssPresetEnv(),
					],
				},
			},
		},
		{ loader: 'sass-loader' },
	];

	if (env.prod) {
		styleLoaders.unshift(miniCssExtractLoader);
	} else {
		styleLoaders.unshift({ loader: 'style-loader' });
	}

	return styleLoaders;
}
