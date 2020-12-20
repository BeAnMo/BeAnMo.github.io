---
layout: post.11ty.js
title: Middleware for useReducer
date: 2020-11-03
tags: post
snippet: The almost but not quite there solution
---

<div class="post-body">

One of the great things about <a href="https://redux.js.org/" target="_blank" rel="noopener">Redux</a> is the ability to extend the functionality of the dispath function with middleware. There's enormous possibility when intercepting actions, but it's not always appropriate to rely on global state management. It often makes sense to keep state local to a component.

Fortunately, there's the `useReducer` hook. It follows a similar pattern to Redux: dispatch an action, call a reducer, then update the state. Turns out that just like Redux, `useReducer` can also accept middleware to extend functionality.

Why use middleware within a component? It abstracts away generic functionality, helping separate different logic rather than mashing it together in one location. For instance, a component is fetching data and may need to retry failed requests. A middleware function can handle all retrying logic, keeping the responsibility away from the component itself.

There's a hook based on `useReducer` in <a href="/posts/2020/use-api-state">useApiState Hook</a> that gives an example of `useReducer` middleware, but it suffers from a serious defect.

```js
// action.type is one of "FETCH" | "SUCCESS" | "FAILURE"
const fetcher = (caller) => (dispatch) => (action) => {
  // Ensure that the current action is dispatched.
  const result = dispatch(action);

  if (action.type === FETCH) {
    caller(...action.args)
      .then((data) => dispatch({ type: SUCCESS, data }))
      .catch((error) => dispatch({ type: FAILURE, error }));
  }

  return result;
};
```

## The Problem

The problem may not be initially evident, the curried function signature takes a few seconds to fully sink in. `caller` is the async function passed to `useApiState` initially. The function returned is the middleware function signature of `dispatch => action`. Each action encountered is passed through to the next dispatch.

```js
const useApiState = (caller, initialState = {}) => {
  const [state, dispatch] = useReducer(reducer, {
    ...INITIAL_STATE,
    ...initialState,
  });

  const enhancedDispatch = fetcher(caller)(dispatch);

  return [state, (...args) => enhancedDispatch({ type: FETCH, args })];
};
```

While the pattern works for here, the problem is `dispatch` only refers to the _next_ dispatch function in the middleware chain. At the moment, that's `reducer`, but what if the component needs to use retrying and logging middleware?

```js
const logMiddleware = (dispatch) => (action) => {
  console.log(`Dispatching:\t${action.type}`);

  return dispatch(action);
};

const retryMiddleware = (dispatch) => (action) => {
  if (action.type === FAILURE) {
    dispatch({ type: "RETRY" });

    return dispatch({
      type: FETCH,
      args: action.args,
    });
  } else {
    return dispatch(action);
  }
};
```

The revised `useApiState` can take any arbitrary middleware, provided they follow the `dispatch => action` signature.

```js
// Simple function composition: pipe(x, h, g, f) == f(g(h(x)))
const pipe = (src, ...proc) => procs.reduce((acc, proc) => proc(acc), src);

const useApiState = (caller, initialState = {}, middleware = []) => {
  const [state, dispatch] = useReducer(reducer, {
    ...INITIAL_STATE,
    ...initialState,
  });

  const enhancedDispatch = pipe(dispatch, fetcher(caller), ...middleware);

  return [state, (...args) => enhancedDispatch({ type: FETCH, args })];
};
```

As a demonstration of the shortcomings, `RecentActivities` is reused. Given a Reddit username, the component will render a table based on recent user activity. In order to see actions, `useApiState` will take a simple logging middleware.

<iframe loading="lazy" src="https://stackblitz.com/edit/use-api-state-original-middleware?ctl=1&devtoolsheight=33&embed=1&file=src/useApiState/useApiState.js&theme=light" style="height: 550px; width: 100%;"></iframe>

## Debugging

Monitoring the logging immediately shows problems. The initial `FETCH` is logged by the logger, but beyond that, nothing else is logged.

The curried function is awkward to step through but not impossible. Here is the unrolled version of the middleware chain.

```js
logMiddleware(retryMiddleware(fetcher(caller)(dispatch)))(action);
```

Still confusing? Imagine an initial action:

```js
{ type: FETCH, args: ['user-name'] }
```

The first function encountered, the logger, will just log `Dispatching: FETCH`.

```js
logMiddleware = (retryMiddleware) => (action) => {
  // does logging and dispatches the next function
  return retryMiddleware(action);
};
```

Ok, that's doing what it needs to so far. Next is `retryMiddleware`. There's nothing to retry at the moment, so like the logger, it will call the next function.

```js
retryMiddleware = (fetcher) => (action) => {
  // action is FETCH, continue to fetchMiddleware
  return fetcher(action);
};
```

When hitting `fetcher`, things start happening. First off, the next function is the actual dispatch which will call the reducer and create the next state. `dispatch` will create the next state before `caller` is called.

The result of `caller` dispatches directly to the reducer. There's no chance to actually retry the response. Likewise, regardless of the response action dispatched, it will never be seen by the logger.

The failure of this pattern is that any intercepted actions can only lead to the next function in the middleware. This works fine for fetching; one of two actions are dispatched, both of which immediately generate the next state. However, this pattern falls short with other middleware.

```js
fetcher = (dispatch) => (action) => {
  // Dispatches directly to the reducer.
  dispatch(action);

  // The state at this point is potentially { loading: true, error: null, data: null }.

  // action is FETCH, perform async operation
  caller(...action.args)
    // Dispatch can only call next dispatch function: the reducer.
    .then((data) => dispatch({ type: SUCCESS, data }))
    // No opportunity to retry or even to log.
    .catch((error) => dispatch({ type: FAILURE, error }));
};
```

## The Solution?

A `FAILURE` needs to run through the entire middleware chain. How can this be achieved?

Revisiting the Redux middleware signature, shows where the deficiency is. The key ingredient is `store`, which not surprisingly is the Redux store instance. The important aspect is that `store` hsa access to the current state of the store and the full, top-level dispatch function. Here, `next` behaves just like the current middleware for `useApiState`.

```js
const middleware => store => next => action => {
    const { getState, dispatch } = store;

    // Possible patterns:

    // Advance to next dispatch function.
    next(action);

    // Call top level dispatch to pass a new action
    // through the entire middleware chain.
    store.dispatch({ type: 'AN_ACTION' });

    // Intercept current action and enhance it.
    if(action.type === 'ANOTHER_ACTION'){
      next({
        type: action.type,
        data: enhanceData(action.data)
      });
    }
}
```

## useEnhancedReducer

The middleware for `useApiState` needs reconfiguring to accept the store like Redux middleware. In fact, it might as well go the extra mile and make `useApiState` compatible with Redux middleware.

At this point, reconfiguring `useApiState` is a complex task on its own. A dedicated solution is called for. Afterall, using middleware in `useReducer` can be extended beyond API calls.

How about a new hook?

```js
const useEnhancedReducer = (reducer, initialState = {}, middleware = []) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  return [state, dispatch];
};

// The new and improved useApiState.
const useApiState = (caller, initialState = {}, middleware = []){
  const [state, dispatch] = useEnhancedReducer(
    reducer,
    { ...INITIAL_STATE, ...initialState },
    [...middleware, fetchMiddleware(caller)]
  );

  return [state, (...args) => dispatch({ type: FETCH, args })];
}
```

## Incorporating Existing Patterns

Ok, that's about 90% done, but it needs the same store api that Redux provides in order to access the top level dispatch function. As luck would have it, there's already an existing hook available to build off of, <a href="https://github.com/venil7/react-usemiddleware" target="_blank" rel="noopener">react-usemiddleware</a>. It uses Redux's own `applyMiddleware` function for integration with the existing Redux ecosystem.

```js
// react-usemiddleware
const useMiddleware = (reducer, initState, middlewares = []) => {
  const [state, dispatch] = useReducer(reducer, initState);

  const getStore = () => ({ dispatch, getState: () => state });

  const store = applyMiddleware(...middlewares)(getStore)();

  const { dispatch: dispatch_, getState } = store;

  return [getState(), dispatch_];
};
```

`getStore` provides the interface needed for `applyMiddleware` to function properly. `applyMiddleware(...)(getStore)` actually returns _another_ function, which has the same inputs as `useReducer`, a reducer and the initial state. It is called without arguments because `getStore` already provides the needed information.

```js
// redux applyMiddleware (modified for readability)
const applyMiddleware = (...middlewares) => (createStore) => (
  reducer,
  preloadedState
) => {
  // No need to pass a reducer & state to createStore because "getStore"
  // has everything needed.
  const store = createStore(reducer, preloadedState);

  let dispatch = () => {
    throw new Error(
      "Dispatching while constructing your middleware is not allowed. " +
        "Other middleware would not be applied to this dispatch."
    );
  };

  const middlewareAPI = {
    getState: store.getState,
    dispatch: (action, ...args) => dispatch(action, ...args),
  };

  // Middlewares are bound to the store API:
  // "store => next => action => any" becomes "next => action => any"
  const chain = middlewares.map((middleware) => middleware(middlewareAPI));

  // Applies middleware chain to dispatch:
  // many "next => action" becomes one "action => any"
  dispatch = compose(...chain)(store.dispatch);

  return {
    ...store,
    dispatch,
  };
};
```

`applyMiddleware` provides the missing ingredient, the top-level dispatch function. It creates the `middlewareAPI` and maps it to each middleware function. Logging & retrying middleware can be updated to accept the top-level dispatch.

```js
// This is now fully compatible Redux middleware.
const retryMiddleware = ({ dispatch }) => (next) => (action) => {
  // If a failure is encountered, send a new FETCH back
  // through the entire middleware chain.
  if (action.type === FAILURE) {
    dispatch({ type: "RETRY" });

    return dispatch({
      type: FETCH,
      args: action.args,
    });
  } else {
    // By default, call next dispatch.
    return next(action);
  }
};

const logMiddleware = (store) => (next) => (action) => {
  console.log(
    `%cCurrent: ${formatState(store.getState())}`,
    "color: green; font-weight: bolder;"
  );
  console.log(
    `%cDispatching: ${action.type}`,
    "color: blue; font-weight: bolder"
  );
  const result = next(action);
  console.log(
    `%cNext: ${formatState(store.getState())}`,
    "color: red; font-weight: bolder"
  );

  return result;
};

const formatState = ({ error, loading, data }) => {
  return `{ error: ${error}, loading: ${loading}, dataLength: ${
    !data ? 0 : data.length
  }`;
};
```

## More Debugging

There are a few problems still. Crucially, using `getState` in middleware for `useMiddleware`, the state only references the initial state, regardless of which actions are dispatched. Here is the output using the custom logger.

```js
// For simplicity, logging lacks the appropriate groupings.
Current: { error: null, loading: false, data: 0 }
Dispatching: FETCH
Next: { error: null, loading: false, data: 0 }

Current: { error: null, loading: false, data: 0 }
Dispatching: FAILURE
Next: { error: null, loading: false, data: 0 }

Current: { error: null, loading: false, data: 0 }
Dispatching: RETRY
Next: { error: null, loading: false, data: 0 }

Current: { error: null, loading: false, data: 0 }
Dispatching: FETCH
Next: { error: null, loading: false, data: 0 }

Current: { error: null, loading: false, data: 0 }
Dispatching: SUCCESS
Next: { error: null, loading: false, data: 0 }
```

This is where the complexities and nuances of hooks throw serious obstacles to the goal of using middleware with `useReducer`. In order to access updated state within `getState`, a ref is used. Refs are convenient for storing freely mutable data, but a drawback is that a mutated ref does not trigger a render. Still, syncing the current state with a ref via `useEffect` might just be enough.

```js
const useEnhancedReducer = (reducer, initialState = {}, middlewares = []) => {
  const enhanceStore = applyMiddleware(...middlewares);
  const [state, dispatch] = useReducer(reducer, initialState);
  const _state = useRef(state);

  useEffect(() => {
    _state.current = state;
  }, [state]);

  const getStore = () => ({
    dispatch,
    getState: () => _state.current,
  });

  const store = enhanceStore(getStore)();

  const { getState, dispatch: enhancedDispatch } = store;

  return [getState(), enhancedDispatch];
};
```

The above modifications are on the right track, but there are two more issues to tackle.

```js
Current: { error: null, loading: false, dataLength: 0 }
Dispatching: FETCH
Next: { error: null, loading: false, dataLength: 0 }

Current: { error: null, loading: true, dataLength: 0 }
Dispatching: FAILURE
Next: { error: null, loading: true, dataLength: 0 }

Current: { error: null, loading: true, dataLength: 0 }
Dispatching: RETRY
Next: { error: null, loading: true, dataLength: 0 }

Current: { error: null, loading: true, dataLength: 0 }
Dispatching: FETCH
Next: { error: null, loading: true, dataLength: 0 }

Current: { error: null, loading: true, dataLength: 0 }
Dispatching: SUCCESS
Next: { error: null, loading: true, dataLength: 0 }
```

The first is that `RecentActivities` hangs in the loading state, despite actually having the proper api state data. This goes back to the issue of refs. The updated state ref does not trigger the necessary render for `RecentActivities`. There's a quick and dirty fix to force a render, but it is not ideal.

```js
const useEnhancedReducer = (...) => {
  // ...

  // Saving the ref within useState causes the same problems
  // as the original configuration.
  const _state = useRef(state);
  const [_, forceUpdate] = useState();

  useEffect(() => {
    _state.current = state;
    // Trigger a render after the ref is changed.
    forceUpdate({});
  }, [state]);

  // ...
}
```

`forceUpdate` will trigger a rerender, ensuring the state ref data is properly reflected in the component. That solves the permanent loading.

Next, logging the "next" state doesn't actually log the next state. Unfortunately, component state & rendering are asynchronous. The logger can't access the current state synchronously after calling the next dispatch. Redux is not tied to the component lifecycle, so it avoids this problem. Turning `getState` asynchronous breaks Redux middleware compatibility. Again, a quick and dirty hack is called for.

```js
const logMiddleware = (store) => (next) => (action) => {
  const timestamp = Date.now();

  console.group(timestamp);
  console.log(
    `%cCurrent: ${logState(store.getState())}`,
    "color: green; font-weight: bolder;"
  );
  console.log(
    `%cDispatching: ${action.type}`,
    "color: blue; font-weight: bolder"
  );
  const result = next(action);

  // The timeout allows access to the current state.
  // It can potentially cause other bugs however.
  setTimeout(() => {
    console.log(
      `%cNext: ${logState(store.getState())}`,
      "color: red; font-weight: bolder"
    );
    console.groupEnd(timestamp);
  }, 0);

  return result;
};
```

The `setTimeout` call allows access to the actual next state. Finally, here's the expected logging output.

```js
Current: { error: null, loading: false, dataLength: 0 }
Dispatching: FETCH
Next: { error: null, loading: true, dataLength: 0 }

Current: { error: null, loading: true, dataLength: 0 }
Dispatching: FAILURE
Next: { error: null, loading: true, dataLength: 0 }

Current: { error: null, loading: true, dataLength: 0 }
Dispatching: RETRY
Next: { error: null, loading: true, dataLength: 0 }

Current: { error: null, loading: true, dataLength: 0 }
Dispatching: FETCH
Next: { error: null, loading: true, dataLength: 0 }

Current: { error: null, loading: true, dataLength: 0 }
Dispatching: SUCCESS
Next: { error: null, loading: false, dataLength: 16 }
```

## Done?

The revised `useApiState` incorporates `useEnhancedReducer`, which mostly achieves the goal of using middleware with `useReducer`.

<iframe loading="lazy" src="https://stackblitz.com/edit/use-api-state-improved-middleware?ctl=1&devtoolsheight=33&embed=1&file=src/useEnhancedReducer/index.js&theme=light" style="height: 550px; width: 100%;"></iframe>

Unfortunately, for all the work done to make `useReducer` compatible with Redux middleware, there are serious issues that make a 1-to-1 substitution untenable. The async nature of the component lifecycle clashes with Redux's synchronous APIs. Additionally, ensuring fresh state within middleware and components fights against React's rendering patterns.

Still, the middleware pattern has plenty of potential for local component state. Beyond fetching data, it is easy to imagine middleware to handle complex form logic without having to pollute global Redux state. It can be easy to adjust state shape when intercepting actions dispatched by form input handlers.

</div>
