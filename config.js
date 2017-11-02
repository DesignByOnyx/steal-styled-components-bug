const IS_NODE = typeof process === 'object' && {}.toString.call(process) === '[object process]';
const env = IS_NODE ? process.env.NODE_ENV : window.System.env;

const IS_PRODUCTION = /production$/.test(env);
const IS_BUILD = IS_NODE && /build$/.test(process.argv[1]);

const systemConfig = {};

if (IS_BUILD || IS_PRODUCTION) {
  Object.assign(systemConfig, {
    map: {
      "react": "react/umd/react.production.min",
      "react-dom": "react-dom/umd/react-dom.production.min",
      "styled-components": "styled-components/dist/styled-components.min",
    }
  });
}

module.exports = { systemConfig };
