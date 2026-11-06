/* Автоматический JSX-рантайм поверх глобального React.createElement */
const R = window.React;
export const Fragment = R.Fragment;
export function jsx(type, props, key) {
  const { children, ...rest } = props || {};
  if (key !== undefined) rest.key = key;
  return children === undefined ? R.createElement(type, rest) : R.createElement(type, rest, children);
}
export function jsxs(type, props, key) {
  const { children, ...rest } = props || {};
  if (key !== undefined) rest.key = key;
  return Array.isArray(children) ? R.createElement(type, rest, ...children) : R.createElement(type, rest, children);
}
export const jsxDEV = jsx;
