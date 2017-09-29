import path from 'path';
import webpack from 'webpack';

export default (webpackConfig, magnet) => {
  const config = magnet.getConfig();
  const reactConfig = config.magnet.pluginsConfig.react;
  const dev = config.magnet.dev;

  let src = ['**/*.js'];
  if (reactConfig && reactConfig.src) {
    src = reactConfig.src;
  }

  const directory = magnet.getDirectory();
  const files = magnet.getFiles({directory, src});

  if (!files.length) {
    return webpackConfig;
  }

  prepareMagnetConfig(webpackConfig, files, dev);

  return webpackConfig;
};

/**
 * Modifies the provided webpackConfig reference.
 * @param {!Object} webpackConfig
 * @param {!Array} files
 * @param {!boolean} dev
 */
function prepareMagnetConfig(webpackConfig, files, dev) {
  webpackConfig.entry = getEntries(webpackConfig, files);
  webpackConfig.module.loaders = getLoaders(webpackConfig, dev);
  webpackConfig.plugins = getPlugins(webpackConfig, dev);
}

/**
 * @param {!Object} webpackConfig
 * @param {!boolean} dev
 * @return {Array.<Object>}
 */
function getPlugins(webpackConfig, dev) {
  const plugins = [
    new webpack.optimize.CommonsChunkPlugin({
      name: 'common',
      filename: 'react/common.js',
      minChunks: 3,
    }),
  ];
  if (!dev) {
    plugins.push(new webpack.optimize.UglifyJsPlugin({
      mangle: {
        keep_fnames: true,
      },
      output: {
        comments: false,
      },
      compress: {
        keep_fnames: true,
        warnings: false,
      },
    }));
  }
  return webpackConfig.plugins.concat(plugins);
}

/**
 * @param {!Object} webpackConfig
 * @param {!boolean} dev
 * @return {Array.<Object>}
 */
function getLoaders(webpackConfig, dev) {
  const loaders = [
    {
      test: /\.js$/,
      loader: 'babel-loader',
      exclude: function(modulePath) {
        return /node_modules/.test(modulePath) &&
          !/node_modules\/magnet-plugin-react\/render\.js/.test(modulePath);
      },
      query: {
        'presets': ['es2015', 'react'],
        'plugins': [
          ['transform-runtime', {
            'polyfill': false,
            'regenerator': true,
          }],
        ],
      },
    },
  ];
  return webpackConfig.module.loaders.concat(loaders);
}

/**
 * @param {!Object} webpackConfig
 * @param {!Array} files
 * @return {Object}
 */
function getEntries(webpackConfig, files) {
  const entries = webpackConfig.entry;

  files.forEach(file => {
    const entryName = path.join('react', file);
    if (!entries[entryName]) {
      entries[entryName] = file;
    }
  });
  return entries;
}
