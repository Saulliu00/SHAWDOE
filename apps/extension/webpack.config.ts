import path from 'path';
import { fileURLToPath } from 'url';
import CopyPlugin from 'copy-webpack-plugin';
import type { Configuration } from 'webpack';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config: Configuration = {
  entry: {
    'content-scripts/index': './src/content-scripts/index.ts',
    'service-worker/index': './src/service-worker/index.ts',
    'popup/popup': './src/popup/popup.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: '.' },
        { from: 'src/popup/index.html', to: 'popup/' },
        { from: 'src/popup/popup.css', to: 'popup/' },
        { from: 'assets', to: 'assets' },
      ],
    }),
  ],
  optimization: {
    minimize: true,
  },
};

export default config;
