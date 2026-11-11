/**
 * Load the browser half in Node with a minimal module-loader shim. The factory
 * itself is pure: components and React hooks are only referenced, never called,
 * so a tiny React stub is enough for the formatting tests.
 */
const definition = { value: null };
const reactStub = {
  createElement() {
    return null;
  },
  Fragment: 'Fragment',
};

globalThis.window = {
  __ModuleLoader__: {
    load(loaded) {
      definition.value = loaded;
    },
  },
};

await import('../client.js');

if (definition.value === null) {
  throw new Error('client.js did not register a module definition');
}

const moduleExports = definition.value.factory((id) => {
  if (id === 'react') return reactStub;
  throw new Error('unexpected module require: ' + id);
});

export const api = moduleExports.__test;

export function makeT() {
  return (key, params) => {
    const template = api.LOCALES.en[key];
    if (typeof template !== 'string') throw new Error('missing English locale key: ' + key);
    return api.interpolate(template, params);
  };
}
