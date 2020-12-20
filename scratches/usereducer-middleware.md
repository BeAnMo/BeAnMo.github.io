One of the great things about <a href="https://redux.js.org/" target="_blank" rel="noopener">Redux</a> is the ability to extend the functionality of the dispath function with middleware. When action gets dispatched somewhere in an app, it will call reducer (but doesn't have to), and update the state. The middleware lives between dispatching the action and calling the reducer. Here an action can be blocked, duplicated, branched into multiple other actions. There's enormous possibility, but it's not always appropriate to rely on global state management. It often makes sense to keep state local to a component.

Fortunately, there's the `useReducer` hook. It follows a similar pattern to Redux: dispatch an action, call a reducer, then update the state. Turns out that just like Redux, `useReducer` can also accept middleware to extend functionality.

Why use middleware within a component? It abstracts away generic functionality, helping separate different logic rather than mashing it together in one location. For instance, a component is fetching data and needs to cache that data locally. A middleware function can handle all caching logic, keeping the responsibility away from the component itself.

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

The curried function signature takes a few seconds to fully sink in. `caller` is the async function passed to `useApiState` initially. The function returned is the middleware function signature of `dispatch => action`. Each action encountered is passed through to the next dispatch.

```js
const useApiState = (caller, initialState = {}) => {
  const [state, dispatch] = useReducer(reducer, {
    ...INITIAL_STATE,
    ...initialState,
  });

  const enhancedDispatch = fetcher(caller)(dispatch);

  return [
    state,
    (...args) => enhancedDispatch({ type: FETCH, args }),
    enhancedDispatch,
  ];
};
```

The is simple and effective enough for the given use case, but there's a key problem. As stated, `dispatch` only refers to the next dispatch function in the middleware chain. At the moment, that's `reducer`. What if the component needs to use caching?

```js
// cache assumes an ES6 Map
const cacheHit = (cache) => (dispatch) => (action) => {
  // Do not dispatch FETCH if response has been made for the given
  // arguments.
  if (action.type === FETCH && cache.size > 0) {
    const key = JSON.stringify(action.args);

    if (cache.has(key)) {
      // This is just an extra action on the chance that
      // another middleware wants to intercept a cache hit
      // before it actually hits the cache.
      dispatch({ type: "CACHE_HIT" });

      return dispatch({
        type: SUCCESS,
        data: cache.get(key),
        args: action.args,
      });
    }
  }

  return dispatch(action);
};

const cacheSet = (cache) => (dispatch) => (action) => {
  const result = dispatch(action);

  if (action.type === SUCCESS) {
    const key = JSON.stringify(action.args);

    if (!cache.has(key)) {
      // Like CACHE_HIT, this action can allow other
      // middleware to intercept before the action
      // the actual operation is performed.
      dispatch({ type: "CACHE_SET" });

      cache.set(key, action.data);
    }
  }

  return result;
};

const cacheMiddleware = (cache) => [cacheHit(cache), cacheSet(cache)];
```

Take make things clearer, the caching middleware is split between hitting & setting the cache but packaged together as an array (there needs to be a strict ordering). It simply intercepts `FETCH` & `SUCCESS` actions and performs the caching side effects. Notice how `cacheHit` does not dispatch `FETCH` if a cached response exists.

Now `useApiState` can use any middleware provided they follow the signature of `dispatch => action`.

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

How about a component that fetches data? A good chance to reuse `RecentActivities`. Given a Reddit username, the component will render a table based on recent user activity. In order to see actions, `useApiState` will take a simple logging middleware.

```js
const logMiddleware = (dispatch) => (action) => {
  console.log(`Dispatching:\t${action.type}`);

  return dispatch(action);
};
```

(link to "use-api-state-original-middlware" in stackblitz)

Everything looks good, but actions aren't passed through entire middleware chain. The initial `FETCH` is logged by the logger, but beyond that, there's no telling the caching is being used properly. The curried function make stepping through the code awkward but not impossible.

Here is an unrolled version of the middleware chain.

```js
const middlware = pipe(dispatch, fetcher(caller), cacheSet(cache), cacheHit(cache), logMiddleware);
// turns into
logMiddleware(
  cacheHit(caller)(
    cacheSet(cache)(
      fetcher(cache)(
        dispatch
      )
    )
  )
)(action);
```

To start, here is an initial action: `{ type: FETCH, args: ['user-name'] }`. The first function encountered is the logger, will just log `Dispatching: FETCH`.

```js
logMiddleware => cacheHit => action => {
  return cacheHit(action);
}
```

Ok, that's doing what it needs to so far. Next is `cacheHit`. There's nothing in the cache at this point, so like the logger, it will call the next function. `cacheSet` is waiting on `SUCCESS`, which means another pass through.

```js
cachHit => cacheSet => action = {
  // action is FETCH but cache is empty.
  return cacheSet(action);
};

cacheSet => fetcher => action = {
  // action is FETCH but cache is empty.
  return fetcher(action);
};

```

When hitting `fetcher`, things start happening. First off, the next function is the actual dispatch which will call the reducer and create the next state. `dispatch` is synchronous, which means the next state is reached before `caller` is called. 

Once `caller` is called, assuming a `SUCCESS`, `dispatch` will run with the response data. Unfortunately, because it leads straight to the reducer, there's no chance to actually cache the response. Likewise, regardless of the response action dispatched, it will never be seen by the logger.

The failure of this pattern is that any intercepted actions can only lead to the next function in the middleware. This works fine for the fetching; two actions are dispatched, both of which are used immediately to generate the next state. The caching and the logging miss out.


```js
fetcher = dispatch => action => {
  // dispatch action, continue with reducer
  dispatch(action);

  // The state at this point is now { loading: true, error: null, }.

  // action is FETCH, perform async operation
  caller(...action.args)
    // can only call next dispatch function: the reducer
    .then(data => dispatch({ type: SUCCESS, data }))
    .catch(error => dispatch({ type: FAILURE, error }));
}
```

---

remainder

- set up RecentActivities from useapistate post
- show how/why existing middleware signatures don't work
- explain actual redux middleware signature
- rebuild useApiState with actual middleware signature

---

- extend `useApiState` example
- explain redux middleware signature
  - `store => next => action`
  - store is current store state
  - next is next middleware in the middleware chain (think `nextDispatch`)
  - action is the current action
  - using `store.dispatch` to dispatch will send new action through entire middleware chain
  - `next` will only dispatch action to next middleware
- example middleware
  - logging
  - caching
  - paging

```js
const middlware = pipe(dispatch, fetcher(caller), cacheSet(cache), cacheHit(cache));

cacheHit(caller)(
  cacheSet(cache)(
    fetcher(cache)(
      dispatch
    )
  )
)(action);

const first_action = { type: FETCH, args: ['Slow-Turn'] };

cachHit => cacheSet => action = {
  // action is FETCH but
  // cache does not have arguments
  return cacheSet(action);
};

cacheSet => fetcher => action => {
  // dispatch action, continue with fetcher
  const result = fetcher(action);

  // action is FETCH, function returns
  return result;.
}

fetcher = reducer => action => {
  // dispatch action, continue with reducer
  reducer(action);

  // action is FETCH, perform async operation
  caller(...action.args)
    // can only call next dispatch function: the reducer
    .then(data => reducer({ type: SUCCESS, data }))
    .catch(error => reducer({ type: FAILURE, error }));
}

reducer => action => {
  return {
    loading: true,
    error: null,
    data: null
  }
}
```
