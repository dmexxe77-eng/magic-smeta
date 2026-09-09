/* React из глобала: страница дизайна подключает UMD-сборку до наших бандлов (см. scripts/build-design.mjs) */
const R = window.React;
export default R;
export const { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect, useContext, useReducer, useId,
  Fragment, createElement, cloneElement, Component, PureComponent, memo, forwardRef, createRef, createContext,
  isValidElement, Children, StrictMode } = R;
