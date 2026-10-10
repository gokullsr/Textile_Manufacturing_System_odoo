const app = require('../src/app');

const listEndpoints = (app) => {
  const routes = [];

  const split = (thing) => {
    if (typeof thing === 'string') {
      return thing.split('/');
    } else if (thing.fast_slash) {
      return '';
    } else {
      const match = thing.toString()
        .replace('\\/?', '')
        .replace('(?=\\/|$)', '$')
        .match(/^\/\^((?:\\[.*+?^${}()|[\]\\\/]|[^.*+?^${}()|[\]\\\/])*)\$\//);
      return match
        ? match[1].replace(/\\(.)/g, '$1').split('/')
        : '<complex:' + thing.toString() + '>';
    }
  };

  const print = (path, layer) => {
    if (layer.route) {
      layer.route.stack.forEach((r) => {
        routes.push({
          path: (path + (layer.route.path === '/' ? '' : layer.route.path)) || '/',
          method: r.method ? r.method.toUpperCase() : 'ALL',
        });
      });
    } else if (layer.name === 'router' && layer.handle.stack) {
      layer.handle.stack.forEach((l) => {
        print(path + '/' + split(layer.regexp).filter(Boolean).join('/'), l);
      });
    }
  };

  app._router.stack.forEach((layer) => {
    print('', layer);
  });

  return routes;
};

const endpoints = listEndpoints(app);
console.log(JSON.stringify(endpoints, null, 2));
