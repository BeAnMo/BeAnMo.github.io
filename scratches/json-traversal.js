function getUser(user) {
  return fetch(`https://www.reddit.com/u/${user}/.json`).then((r) => r.json());
}

function isArray(item) {
  return Array.isArray(item);
}

function isObject(item) {
  return typeof item === "object" && item !== null && !isArray(item);
}

function* enumerate(iter) {
  let i = 0;

  for (const item of iter) {
    yield [i, item];

    i++;
  }
}

function* limit(n, iter) {
  let i = 0;

  while (i < n) {
    yield iter.next().value;

    i++;
  }
}

function* filter(predicate, iter) {
  for (const item of iter) {
    if (predicate(item)) {
      yield item;
    }
  }
}

function fold(proc, iter, acc) {
  let results = acc;

  for (const item of iter) {
    results = proc(acc, item);
  }

  return results;
}

function forEach(proc, iter) {
  for (const item of iter) {
    proc(item);
  }
}

function pipe(src, ...procs) {
  return procs.reduce((acc, proc) => proc(acc), src);
}

function* traverse(value, key, path) {
  if (isArray(value)) {
    yield* traverseArray(value, key, path);
  } else if (isObject(value)) {
    yield* traverseObject(value, key, path);
  } else {
    yield { value, key, path };
  }
}

function* traverseArray(value, key, path) {
  for (const [i, item] of enumerate(value)) {
    yield* traverse(item, i, [...path, i]);
  }
}

function* traverseObject(value, key, path) {
  for (const key of Object.keys(value)) {
    yield* traverse(value[key], key, [...path, key]);
  }
}

function traversal(data) {
  return traverse(data, "", []);
}

function groupSubreddits(aMap, [i, { value }]) {
  return aMap.set(value, (aMap.get(value) || 0) + 1);
}

function main(data) {
  console.log(data);

  const grouped = pipe(
    data,
    traversal,
    enumerate,
    filter.bind(null, ([i, { key }]) => key === "subreddit"),
    (iter) => fold(groupSubreddits, iter, new Map())
  );

  console.log(grouped);
}

getUser("GazNougat").then(main).catch(console.error);
