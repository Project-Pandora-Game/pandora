import { join } from 'path';
import { Configuration, DefinePlugin, RuleSetRule, RuleSetUseItem, WebpackPluginInstance } from 'webpack';
import 'webpack-dev-server';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import packageJson from './package.json';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import MiniCssExtractPlugin, { loader as miniCssExtractLoader } from 'mini-css-extract-plugin';
import postcssFlexbugsFixes from 'postcss-flexbugs-fixes';
import postcssPresetEnv from 'postcss-preset-env';
import CopyPlugin from 'copy-webpack-plugin';

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
			historyApiFallback: true,
			hot: true,
			open: true,
			port: 6969,
		},
		devtool: env.prod ? false : 'eval',
		entry: {
			index: join(SRC_DIR, 'index.tsx'),
		},
		mode,
		module: {
			rules: generateRules(env),
		},
		optimization: {
			minimizer: generateMinimizer(env),
		},
		output: {
			path: DIST_DIR,
			filename: `[name]${env.prod ? '.[chunkhash]' : ''}.js`,
		},
		plugins: generatePlugins(env),
		resolve: {
			extensions: ['.ts', '.tsx', '.js'],
		},
	};
}

function generatePlugins(env: WebpackEnv): WebpackPluginInstance[] {
	const plugins: WebpackPluginInstance[] = [
		new CleanWebpackPlugin({ verbose: true }),
		new DefinePlugin({
			'process.env': JSON.stringify({
				/* eslint-disable @typescript-eslint/naming-convention */
				NODE_ENV: env.prod ? 'production' : 'development',
				VERSION: packageJson.version,
				GAME_NAME,
				/* eslint-enable @typescript-eslint/naming-convention */
			}),
		}),
		new HtmlWebpackPlugin({
			template: join(SRC_DIR, 'index.ejs'),
			title: GAME_NAME,
			favicon: join(SRC_DIR, 'assets/favicon.png'),
		}),
		new CopyPlugin({
			patterns: [
				{ from: join(SRC_DIR, 'assets'), to: DIST_DIR },
			],
		}) as unknown as WebpackPluginInstance,
	];

	if (env.prod) {
		plugins.push(new MiniCssExtractPlugin({
			filename: '[name].[contenthash].css',
			chunkFilename: '[name].[contenthash].chunk.css',
		}));
	}

	return plugins;
}

function generateRules(env: WebpackEnv): RuleSetRule[] {
	const moduleRules: RuleSetRule[] = [
		{
			test: /\.tsx?$/i,
			exclude: /node_modules/,
			use: 'ts-loader',
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
			use: generateStyleLoaders(env),
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

function generateMinimizer(env: WebpackEnv): WebpackMinimizer[] {
	const minimizer: WebpackMinimizer[] = ['...'];
	if (env.prod) {
		minimizer.push(new CssMinimizerPlugin());
	}
	return minimizer;
}

function generateStyleLoaders(env: WebpackEnv): RuleSetUseItem[] {
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
