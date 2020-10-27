---
layout: post.11ty.js
title: Middleware for useReducer
date: 2020-11-02
tags: post
snippet: Work in progress
---

<div class="post-body">

<img src="/assets/images/construction.gif" alt="Under construction" />

One of the great things about <a href="https://redux.js.org/" target="_blank" rel="noopener">Redux</a> is the ability to extend the functionality of the dispath function with middleware. When action gets dispatched somewhere in an app, it will call reducer (but doesn't have to), and update the state. The middleware lives between dispatching the action and calling the reducer. Here an action can be blocked, duplicated, branched into multiple other actions. There's enormous possibility, but it's not always appropriate to rely on global state management. It often makes sense to keep state local to a component.

Fortunately, there's the `useReducer` hook. It follows a similar pattern to Redux: dispatch an action, call a reducer, then update the state. Turns out that just like Redux, `useReducer` can also accept middleware to extend functionality. **Why use middleware/reducers at all????**

There's a hook base on `useReducer` in <a href="/posts/2020/use-api-state">useApiState Hook</a> that provides the perfect opportunity to improve.

```js
const INITIAL_STATE = {
  error: null,
  loading: false,
  data: null,
};

// Actions
const FETCH = "FETCH";
const FAILURE = "FAILURE";
const SUCCESS = "SUCCESS";

const reducer = (state, action) => {
  switch (action.type) {
    case FETCH:
      return {
        error: null,
        loading: true,
        data: null,
      };

    case FAILURE:
      return {
        data: null,
        loading: false,
        error: action.error,
      };

    case SUCCESS:
      return {
        error: null,
        loading: false,
        data: action.data,
      };

    default:
      return state;
  }
};

/**
 * @param {(args: ...any) => Promise<any>} caller
 * @param {{ error?: any, loading?: boolean, data?: any }=} initialState
 *
 * @param {[{ error: any, loading: boolean, data: any }, (args: ...any) => void]}
 */
const useApiState = (caller, initialState = {}) => {
  const [state, dispatch] = useReducer(reducer, {
    ...INITIAL_STATE,
    ...initialState,
  });

  return [state, (...args) => dispatch({ type: FETCH, args })];
};
```

That's the basic middleware-less setup. Currently, dispatching `FETCH` does nothing but trigger the loading value (assuming that it was not set in `initialState`). There is no way to advance to `SUCCESS` or `FAILURE` states. The actual dispatch function could be provided to a hook consumer instead of just a wrapped `FETCH`, but that defeats the purpose of `useApiState`; to hide management of response states from the consumer. However, for developer convenience and flexibility, `dispatch` will be returned as the third element of the array.

```js
const useApiState = (caller, initialState = {}) => {
  // ...

  return [state, (...args) => dispatch({ type: FETCH, args }), dispatch];
};
```

That still does not solve the problem of the automatically managing response states. When `FETCH` is encountered, `caller` should be called with the `args` provided by the action. This is expected to be an asynchronous operation. If it succeededs, a `SUCCESS` needs to be dispatched with the response data, otherwise it should dispatch a `FAILURE` with the error.

The dispatching can be intercepted with middleware, providing the automatic management needed to achieve the goal of `useApiState`. Those requirements turn into this middleware.

```js
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

The curried function signature takes a few seconds to fully sink in. `caller` is the async function passed to `useApiState` initially. The function returned then takes `dispatch` calls it `action`.

In `fetcher` each action encountered is passed through to the next dispatch. When `FETCH` is encountered, it will also call the reducer with `SUCCESS` or `FAILURE` depending on `caller`'s result.

The revised `useApiState` wraps `dispatch` in `fetchMiddleware`.

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

The is simple and effective enough for the given use case, but there's a key problem. As stated, `dispatch` only refers to the next dispatch function in the middleware chain. At the moment, that's `reducer`. What if the component using the hook needed to log actions for development purposes?

```js
const logger = (dispatch) => (action) => {
  console.log(`Dispatching: ${action.type}`);

  return dispatch(action);
};
```

Borrowing from part of structure of `fetcher`, `logger` logs the given action and then dispatches it. That's helpful, but unfortunately there's no detailed knowledge of the state transition the action is reponsible for (if any). Moreover, it requires a reconfiguring of `useApiState`. The middleware should not be hard coded to the hook (except for `fetcher`), because maybe logging to `console` is appropriate for development but not production.

To help compose dispatch with arbitrary middleware, `pipe` helps out by applying a list of functions to the initial argument. `pipe(x, h, g, f)` is equivalent to `f(g(h(x)))`.

```js
/**
 * @param {any} src
 * @param {...Function} procedures
 *
 * @return {any}
 */
const pipe = (src, ...procedures) => {
  return procedures.reduce((acc, procedure) => procedure(acc), src);
};
```

Now `useApiState` can use any middleware provided they follow the signature of `dispatch => action`.

```js
const useApiState = (caller, initialState = {}, middleware = []) => {
  const [state, dispatch] = useReducer(reducer, {
    ...INITIAL_STATE,
    ...initialState,
  });

  const enhancedDispatch = pipe(dispatch, ...middleware, fetcher(caller));

  return [
    state,
    (...args) => enhancedDispatch({ type: FETCH, args }),
    enhancedDispatch,
  ];
};
```

How about a component that fetches data when mounted?

```js
const middlewares = process.env.NODE_ENV === "production" ? [] : [logger];

const DataRender = () => {
  const [{ error, loading, data }, dispatchFetch] = useApiState(
    fetchData,
    {
      loading: true,
    },
    middlewares
  );

  useEffect(() => {
    dispatchFetch();
  }, []);

  if (error) {
    return <p>{error.toString()}</p>;
  } else if (loading) {
    return <p>Loading...</p>;
  } else {
    return; // ...render something with the data
  }
};
```

As expected, when the component is mounted it will only render `<p>Loading...</p>`.

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

</div>
