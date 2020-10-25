---
layout: post.11ty.js
title: useApiState Hook
date: 2020-10-25
tags: post
snippet: Handling API responses is one of the prime tasks with today's data heavy UIs. How about a simpler interface?
---

<div class="post-body">

Fetching data from within components (React or otherwise) carries with it the task of maintaining state beyond the actual response. How much needs maintaining is based on any number of questions. How important is the data to the UI? Is the data being currently fetched? Has it arrived yet? Was there an error? In certain circumstances, like a tracking beacon, a developer might not need to worry about these questions. However, if the fetched data is critical to the UI, not managing these states can crash the entire app.

This extra state (such as a loading or error flag) adds another layer of complexity to a component. This oftens turns straightforward component logic into a mess of updating response states alongside everything the component is handling.

As an example, say a new feature for an app requires the display of a Reddit user's most recent history. This includes a table of the post and comment data, as well as a text input that calls Reddit for the given user.

There's a row of data.

```js
const Row = ({ created, subreddit, score, link }) => {
  return (
    <tr>
      <td>{created}</td>
      <td>{subreddit}</td>
      <td>{score}</td>
      <td>
        <a href={link} target="_blank" rel="noopener">
          Link
        </a>
      </td>
    </tr>
  );
};
```

The table that contains the rows.

```js
const ActivityTable = ({ rows }) => {
  return (
    <table>
      <thead>
        <tr>
          <td>Date</td>
          <td>Subreddit</td>
          <td>Score</td>
          <td>Link</td>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <Row key={`stats-${i}`} {...row} />
        ))}
      </tbody>
    </table>
  );
};
```

The text input to grab a username. (For text inputs, listening to the "change" event prevents the `onChange` prop from firing with every key press. This prevents spamming Reddit with half-finished usernames).

```js
const UserForm = ({ value, onChange, disabled }) => {
  const $input = useRef();

  useEffect(() => {
    const handleChange = (e) => onChange(e.target.value);

    $input.current.addEventListener("change", handleChange);
  }, []);

  return (
    <input ref={$input} type="text" defaultValue={value} disabled={disabled} />
  );
};
```

Bringing it all together.

```js
const RecentActivity = () => {
  const [user, setUser] = useState("");

  const handleUser = (e) => setUser(e.target.value);

  return (
    <section>
      <UserForm value={user} onChange={handleUser} />

      <ActivityTable rows={[]} />
    </section>
  );
};
```

Great, if `RecentActivity` is basically done, now it just needs the data source. How about adding the Reddit user service?

```js
const redditUrl = (pathname) => {
  const base = new URL("https://www.reddit.com");

  base.pathname = pathname;

  return base;
};

const getRecentActivity = ({ data: { children } }) => {
  return children.map(
    ({ data: { created_utc, subreddit, permalink, score } }) => ({
      created: new Date(created_utc * 1000).toLocaleDateString(),
      subreddit,
      link: redditUrl(permalink),
      score,
    })
  );
};

const fetchUser = (user) => {
  return fetch(redditUrl(`u/${user}/.json?sort=new`))
    .then((r) => r.json())
    .then(getRecentActivity);
};
```

<h2 id="fetch-1">Version 1</h2>

Nothing crazy. It's just taking a few fields from response data and doing some simple formatting. Now to add the fetching to the `RecentActivity` component.

```js
const RecentActivity = () => {
  const [user, setUser] = useState("");
  const [rows, setRows] = useState([]);

  const handleChange = (e) => {
    const user = e.target.value;

    if (user !== "") {
      setUser(e.target.value);
      fetchUser(e.target.value).then(setRows).catch(console.error);
    }
  };

  return (
    <div>
      <UserForm value={user} onChange={handleChange} />
      <ActivityTable setRows={setRows} />
    </div>
  );
};
```

The above represents one of the simplest patterns to loading data. It does what it needs to but operates on the happiest of paths. What if the table is already displaying data for _user456_ but the app user decides to search for _IceyHotStunta_ and it fails? Or what if a request takes far longer than expected? These end up with scenarios where the text input value no longer references the table data.

This calls for a revision of `RecentActivity`.

<h2 id="fetch-2">Version 2</h2>

```js
const RecentActivity = () => {
  const [user, setUser] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);

  const handleChange = (user) => {
    setUser(user);

    if (user !== "") {
      setLoading(true);
      setError(null);
      setRows([]);
      fetchUser(user)
        .then(setRows)
        .catch(setError)
        .finally(() => setLoading(false));
    }
  };

  return (
    <div>
      <UserForm value={user} onChange={handleChange} disabled={loading} />

      {error ? (
        <p>An Error occurred</p>
      ) : loading ? (
        <p>Fetching user...</p>
      ) : (
        <ActivityTable rows={rows} />
      )}
    </div>
  );
};
```

Now any issues syncing data between the input and table are resolved. If a user has been entered, the table display can only be the error/loading indicators or the user's activity table. It looks simple enough in this example, but data fetching components can get very complex very quickly.

The `handleChange` function tips off where this component is headed when additional functionality gets tacked on. In order to ensure no data gets mixed up between users and to ensure data will render properly, the `loading`, `error`, and `stats` state values need to be reset manually with each new user.

Error and loading states are important but how they are updated is not the component's concern. By managing it locally, not only does it bleed into other logic, but it costs rerenders; each `set...` call triggers a rerender, totalling 6 per `handleChange` call. If `ActivityTable` contained very busy and/or many child components, extra renders can sabotage performance.

There are plenty of solutions for handling data fetching in components. Luckily, React's `useReducer` hook provides a solid foundation for a more concise pattern for fetching.

As with the earlier versions, there is state to keep track of, only this time it will all be bundled into a single object.

```js
const INITIAL_STATE = {
  error: null,
  loading: true,
  data: null,
};
```

Rather than setting state fields individually, bulk transitions can be triggered using the following actions.

```js
const FETCH = "FETCH";
const FAILURE = "FAILURE";
const SUCCESS = "SUCCESS";
```

Next, the reducer is set up to handle the actual transitions.

```js
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
        ...state,
        loading: false,
        error: action.error,
      };

    case SUCCESS:
      return {
        ...state,
        loading: false,
        data: action.data,
      };

    default:
      return state;
  }
};
```

`FETCH` transitions to the loading state, clearing out old data and errors with it. `SUCCESS` and `FAILURE` transition out of the loading state and update the `data` or `error` fields where appropriate. All 3 fields are updated in a single render, as opposed to relying on multiple `useState` instances.

Here is the in-progress `useApiState` hook. It takes two arguments: `caller`, the data fetching function and optionally, `initialState`, which allows for scenarios where a component fetches data when mounting (set with `{ loading: true }`).
A `FETCH` is dispatched with arguments for `caller`.

```js
const useApiState = (caller, initialState = {}) => {
  const [state, dispatch] = useReducer(reducer, {
    ...INITIAL_STATE,
    ...initialState,
  });

  return [state, (...args) => dispatch({ type: FETCH, args })];
};
```

<h2 id="fetch-3">Version 3</h2>

From the perspective of `RecentActivity`, that's it. No other information is needed to fetch data. All of the response state management resides in the `useApiHook`.

Notice how the component body looks as simple as the first `RecentActivity` <a href="#fetch-1">version</a> to fetch data but provides the error/loading management of the second <a href="#fetch-2">version</a>.

```js
const RecentActivity = () => {
  const [user, setUser] = useState("");
  const [{ error, loading, data }, getRecentActivity] = useApiState(fetchUser);

  const handleChange = (user) => {
    if (user !== "") {
      setUser(user);
      getRecentActivity(user);
    }
  };

  // ...rendering
};
```

While `RecentActivity` is now complete, the `useApiState` hook needs finishing.

The advantage of using reducers/actions is predictable state updates, which are achieved through pure reducers. A reducer takes in the current state and action and returns the next state based on the action. How does an asynchronous function call work within that context? Turns out that `useReducer` can use middleware in much the same way as <a href="https://redux.js.org/" target="_blank" rel="noopener">Redux</a>.

The only action that needs manual dispatching is `FETCH`. Middleware can intercept a `FETCH`, perform a request, and then dispatch a followup action based on the response.

```js
const fetchMiddleware = (caller) => (dispatch) => (action) => {
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

`useApiState` needs a slight revision to wrap `dispatch` with `fetchMiddleware`.

```js
const useApiState = (caller, initialState = {}) => {
  const [state, dispatch] = useReducer(reducer, {
    ...INITIAL_STATE,
    ...initialState,
  });

  const enhancedDispatch = fetchMiddleware(caller)(dispatch);

  return [state, (...args) => enhancedDispatch({ type: FETCH, args })];
};
```

The final piece is in place. The mess of state handling in `handleChange` gets pushed into the dispatch function, eliminating the need for manual updates. It's more efficient as well. Remember, multiple `useState` instances contributed to excess rendering. With `useApiState`, the amount of rendering by calling `handleChange` is halved. One render for setting a user, one render for `FETCH`, and one for either `SUCCESS` or `FAILURE`.

## Wrapping Up

`useApiState` gives developers a tool to help abstract away the highly repetitive and often troublesome task of handling of response states. While it appears more complex than the alternatives, it unloads a sizeable state burden for data heavy components.

Here's the live version, with some test data as opposed to Reddit API calls.

<iframe src="https://stackblitz.com/edit/use-api-state?embed=1&file=src/RecentActivity.v3.jsx" style="height: 550px; width: 100%;"></iframe>

### Addendum

#### More Middleware

`fetchMiddleware` is required to do the actual fetching, but it is not the only middleware than can be useful. Additonal functionality like logging, caching responses, and paging through data can all be accomplished within middleware. Unfortunately, the overall configuration here does not extend well enough to make much use of other middleware. This will be explored more in depth in <a href="/posts/2020/usereducer-middleware">**Middleware for useReducer**</a>.

#### `useEffect` to Handle Fetching

The above examples stuff all the functionality into `handleChange`.

```js
const RecentActivity = () => {
  // ...state

  const handleChange = (user) => {
    setUser(user);

    // ...a bunch of other operations
  };

  // ...render
};
```

That works but leaves the `handleChange` more complicated than necessary. The goal of implementing `useApiState` is to create a better separation of concerns to reduce the cognitive load. A cleaner alternative is to decouple the user update from the actual fetching with `useEffect`.

```js
const RecentActivity = () => {
  // ...state

  const handleChange = user => setUser(user);

  useEffect(() => {
    if(user !== ''){
      // ...a bunch of other operations
    }
  }, [user]);

  // ...render
```

Any time `user` is set to a non-empty string, it will call the fetch operation. This allows `handleChange` to focus solely on updating the user value.

</div>
