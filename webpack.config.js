const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

const coreModules = {
  'bio-utils': './js/bio-utils.js',
  'bio-config': './js/bio-config.js',
  'bio-state': './js/bio-state.js',
  'bio-wallet': './js/bio-wallet.js',
  'bio-profile': './js/bio-profile.js',
  'bio-chatbot': './js/bio-chatbot.js',
  'bio-flags': './js/bio-flags.js',
  'bio-loader': './js/bio-loader.js',
};

const featureModules = {
  'bio-sequence': './js/bio-sequence.js',
  'bio-alphafold': './js/bio-alphafold.js',
  'bio-docking': './js/bio-docking.js',
  'bio-pricing': './js/bio-pricing.js',
  'bio-bioimaging': './js/bio-bioimaging.js',
  'bio-crispr': './js/bio-crispr.js',
  'bio-drugs': './js/bio-drugs.js',
  'bio-goenrichment': './js/bio-goenrichment.js',
  'bio-genome': './js/bio-genome.js',
  'bio-regnet': './js/bio-regnet.js',
  'bio-survival': './js/bio-survival.js',
  'bio-degpipeline': './js/bio-degpipeline.js',
  'bio-healthcare50': './js/bio-healthcare50.js',
  'bio-researchagg': './js/bio-researchagg.js',
};

const commonConfig = {
  mode: isDevelopment ? 'development' : 'production',
  context: path.resolve(__dirname),
  devtool: isDevelopment ? 'source-map' : 'source-map',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
    chunkFilename: '[name].chunk.js',
    libraryTarget: 'umd',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: [],
          },
        },
      },
      {
        test: /\.css$/,
        use: [
          isDevelopment ? 'style-loader' : MiniCssExtractPlugin.loader,
          'css-loader',
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.json'],
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env.REACT_APP_ENVIRONMENT': JSON.stringify(
        process.env.REACT_APP_ENVIRONMENT || 'development'
      ),
    }),
  ],
  optimization: {
    minimize: isProduction,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: true,
          mangle: true,
          output: { comments: false },
        },
        extractComments: false,
      }),
      new CssMinimizerPlugin(),
    ],
  },
  performance: {
    hints: isProduction ? 'warning' : false,
    maxEntrypointSize: 512000,
    maxAssetSize: 512000,
  },
};

// Core bundle (always loaded)
const coreConfig = {
  ...commonConfig,
  name: 'core',
  entry: coreModules,
  output: {
    ...commonConfig.output,
    path: path.resolve(__dirname, 'dist/core'),
  },
};

// Features bundle (lazy-loaded)
const featuresConfig = {
  ...commonConfig,
  name: 'features',
  entry: featureModules,
  output: {
    ...commonConfig.output,
    path: path.resolve(__dirname, 'dist/features'),
  },
  externals: {
    // Assume core modules are globally available
    ...Object.keys(coreModules).reduce((acc, key) => {
      acc[`./bio-${key.split('-')[1]}`] = key;
      return acc;
    }, {}),
  },
};

module.exports = [coreConfig, featuresConfig];
