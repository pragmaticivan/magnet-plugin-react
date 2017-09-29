import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
import {assertDefAndNotNull, assertString} from 'metal-assertions';
import {isObject, isRegex, core, isFunction, isDefAndNotNull} from 'metal';
import babelReact from 'babel-preset-react';
import nodePath from 'path';
import start from './start';
import ESAPI from 'node-esapi';
import webpackConfig from './webpack-config';

const defaultLayout = (req, content, initialState) =>
  `<html><head></head><body>${content}</body></html>`;
const encoder = ESAPI.encoder();

const routes = [];

export default {
  babelPresets() {
    return [babelReact];
  },

  async start(magnet) {
    await start(magnet);
  },

  async webpackConfig(config, magnet) {
    return webpackConfig(config, magnet);
  },

  test(module, filename, magnet) {
    return isObject(module.route) && Boolean(module.default.prototype) &&
        Boolean(module.default.prototype.isReactComponent);
  },

  register(module, filename, magnet) {
    const config = magnet.getConfig();
    const reactConfig = config.magnet.pluginsConfig.react;

    let formatFilename = core.identityFunction;
    if (reactConfig && reactConfig.filename) {
      formatFilename = reactConfig.filename;
    }

    let path = module.route.path;
    let method = module.route.method || 'get';
    let type = module.route.type || 'html';
    let page = module.default.name;
    let fileshort = filename.substring(magnet.getServerDistDirectory().length);

    assertString(
      method,
      `Route configuration method must be a string, ` + `check ${fileshort}.`
    );
    assertDefAndNotNull(
      path,
      `Route configuration path must be specified, ` + `check ${fileshort}.`
    );

    registerRoute({path, page});

    let app = magnet.getServer().getEngine();

    app[method.toLowerCase()](path, async (req, res, next) => {
      try {
        if (!res.headersSent) {
          const getInitialContext = module.default.getInitialContext || module.default.getInitialState;
          const renderLayout = module.default.renderLayout || defaultLayout;

          let data = {};
          if (isFunction(getInitialContext)) {
            data = await getInitialContext(req, res, magnet) || {};
          }

          data.__MAGNET_PAGE__ = module.default.name;
          data.__MAGNET_PAGE_SOURCE__ = formatFilename(
            nodePath.join('/.react/', fileshort));

          if (isContentTypeJson(req) || isXPJAX(req)) {
            res.set('Cache-Control',
                'no-cache, max-age=0, private, must-revalidate, no-store')
              .json(data);
          } else {
            const layout = await renderLayout(
              req,
              renderComponentToString(module.default, data),
              data
            );

            res
              .type(type)
              .send(
                enhanceLayout(
                  layout, data, formatFilename)
                );
          }
        }
      } catch (error) {
        next(error);
      }
    });
  },
};


/**
 * Checks if request content type is application/json.
 * @param {Object} req
 * @return {boolean}
 */
function isContentTypeJson(req) {
  const contentType = req.get('content-type') || '';
  return contentType.toLowerCase().indexOf('application/json') === 0;
}

/**
 * Checks if request contains X-PJAX header.
 * @param {Object} req
 * @return {boolean}
 */
function isXPJAX(req) {
  return isDefAndNotNull(req.get('X-PJAX'));
}

/**
 * Renders react components to string.
 * @param {Class} ctor
 * @param {Object} props
 * @return {string}
 */
function renderComponentToString(ctor, props) {
  const app = createElement(ctor, props);
  return renderToString(app);
}

/**
 * Enhances layout adding doctype and scripts necessary for rendering page.
 * @param {!string} layoutContent
 * @param {!Object} data
 * @param {!Function} formatFilename
 * @return {string}
 */
function enhanceLayout(layoutContent, data, formatFilename) {
  assertLayoutContainsBody(layoutContent);

  const encodedPageSource = encoder.encodeForHTMLAttribute(
    data.__MAGNET_PAGE_SOURCE__
  );
  const encodedMagnetState = encoder.encodeForJavaScript(JSON.stringify(data));
  const encodedMagnetRoutes = encoder.encodeForJavaScript(
    JSON.stringify(routes)
  );

  layoutContent = layoutContent
    .replace(/(<body\b[^>]*>)/i, '$1<div id="__magnet">')
    .replace('</body>',
      `</div>` +
      `<script src="${formatFilename('/.react/common.js')}"></script>` +
      `<script src="${encodedPageSource}"></script>` +
      `<script>` +
      `__MAGNET_STATE__=JSON.parse('${encodedMagnetState}');` +
      `__MAGNET_ROUTES__=JSON.parse('${encodedMagnetRoutes}');` +
      `</script></body>`);

  return `<!DOCTYPE html>${layoutContent}`;
}

/**
 * Asserts layout content has "<body></body>".
 * @param {string} layoutContent
 */
function assertLayoutContainsBody(layoutContent) {
  if (layoutContent.toLowerCase().indexOf('<body') === -1 ||
      layoutContent.toLowerCase().indexOf('</body>') === -1) {
    throw new Error('Error. Page layout does not contain <body></body>".');
  }
}

/**
 * Registers route.
 * @param {object} route
 */
function registerRoute(route) {
  if (isRegex(route.path)) {
    route.path = `regex:${route.path.toString()}`;
  }
  routes.push(route);
}
