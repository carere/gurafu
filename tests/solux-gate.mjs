import assert from "node:assert/strict";
import { configureStore, createEvent, createSlice, devtools } from "@carere/solux";

const inc = createEvent("inc");
const fresh = () =>
  createSlice({
    initialState: { nested: { value: 0 }, rows: [{ value: 1 }] },
    handlers: (b) =>
      b.addHandler(inc, (s) => {
        s.nested.value++;
        s.rows[0].value++;
      }),
  });
// No window: import and optional enhancer invocation must be harmless.
const server = configureStore({
  rootSlice: fresh(),
  enhancers: [devtools({ instanceId: "server" })],
});
server.dispose();
const connections = [];
globalThis.window = {
  __REDUX_DEVTOOLS_EXTENSION__: {
    connect(options) {
      const c = {
        options,
        inits: [],
        sent: [],
        listeners: [],
        removed: 0,
        closed: 0,
        init(s) {
          c.inits.push(s);
        },
        send(_event, s) {
          c.sent.push(s);
        },
        subscribe(fn) {
          c.listeners.push(fn);
          return () => c.removed++;
        },
        unsubscribe() {
          c.closed++;
        },
      };
      connections.push(c);
      return c;
    },
  },
};
const disabled = configureStore({ rootSlice: fresh() });
assert.equal(connections.length, 0);
disabled.dispose();
for (let i = 0; i < 3; i++) {
  const input = { nested: { value: 7 }, rows: [{ value: 9 }] };
  const store = configureStore({
    rootSlice: fresh(),
    preloadedState: input,
    enhancers: [devtools({ instanceId: `chart:${i}` })],
  });
  const c = connections.at(-1),
    message = c.listeners[0];
  let deliveries = 0;
  const sub = store.subscribe(() => deliveries++);
  store.dispatch(inc());
  assert.equal(c.inits[0].nested.value, 7);
  assert.equal(c.inits[0].rows[0].value, 9);
  const captured = c.sent.at(-1);
  store.dispatch(inc());
  assert.equal(captured.nested.value, 8);
  assert.equal(captured.rows[0].value, 10);
  message({ type: "DISPATCH", payload: { type: "RESET" } });
  assert.equal(store.state.nested.value, 7);
  assert.equal(store.state.rows[0].value, 9);
  store.dispatch(inc());
  message({ type: "DISPATCH", payload: { type: "RESET" } });
  assert.equal(store.state.nested.value, 7);
  assert.equal(store.state.rows[0].value, 9);
  message({
    type: "DISPATCH",
    payload: { type: "JUMP_TO_STATE" },
    state: '{"nested":{"value":20}}',
  });
  assert.equal(store.state.nested.value, 20);
  assert.equal(store.state.rows[0].value, 9);
  const sends = c.sent.length,
    before = deliveries;
  store.dispose();
  store.dispose();
  assert.equal(sub.closed, true);
  assert.equal(c.closed, 1);
  assert.equal(c.removed, 1);
  store.dispatch(inc());
  message({ type: "ACTION", payload: '{"type":"inc"}' });
  message({ type: "DISPATCH", payload: { type: "RESET" } });
  assert.equal(store.state.nested.value, 20);
  assert.equal(deliveries, before);
  assert.equal(c.sent.length, sends);
  assert.equal(store.subscribe(() => assert.fail("late observer")).closed, true);
}
const a = configureStore({ rootSlice: fresh() }),
  b = configureStore({ rootSlice: fresh() });
a.dispatch(inc());
assert.equal(b.state.nested.value, 0);
a.dispose();
b.dispose();
console.log(
  "PASS: published 4.1.0 no-window/opt-in, repeated dispose, late observers, nested construction/repeated RESET, detached init/send, documented merge restore, fresh independent state",
);
