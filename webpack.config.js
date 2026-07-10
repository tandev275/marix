const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: './src/renderer/index.tsx',
  target: 'electron-renderer',
  devtool: false,  // Disable source maps for production
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        // Use the renderer tsconfig (module: esnext) so dynamic import() is kept
        // as a real split point instead of being downleveled to require() by the
        // base tsconfig's module: commonjs.
        use: { loader: 'ts-loader', options: { configFile: 'tsconfig.renderer.json' } },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
      {
        test: /\.ttf$/,
        type: 'asset/resource',
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'renderer.js',
    chunkFilename: '[name].[contenthash].js',
    // Load async chunks relative to index.html — required under file:// in the
    // packaged app, where there is no server origin.
    publicPath: './',
    // The chunk-loading runtime references the global object; in the sandboxed
    // renderer (nodeIntegration off) Node's `global` is absent, so point it at
    // globalThis or the split chunks fail with "global is not defined".
    globalObject: 'globalThis',
    path: path.resolve(__dirname, 'dist/renderer'),
    clean: true,  // Clean output directory before build
  },
  optimization: {
    minimize: true,
    // Split the lazily-imported viewers (RDP, WSS, database, dual-pane SFTP,
    // backup) into their own chunks so an SSH-only session never pays to parse
    // them at startup.
    splitChunks: { chunks: 'async' },
  },
  performance: {
    hints: false,  // Disable performance warnings
    maxEntrypointSize: 512000,
    maxAssetSize: 512000,
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      minify: {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
      },
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public/icon', to: 'icon' },
      ],
    }),
  ],
  cache: {
    type: 'filesystem',  // Enable persistent caching for faster rebuilds
  },
};
