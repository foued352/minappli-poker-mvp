// demo/store.history.smoke.js
// Run: node demo/history.smoke.js

import assert from "node:assert/strict";

import {
  createHistory,
  snapshot,
  pushPast,
  undo,
  redo
} from "../src/history/history.js";

function ok(msg) {
  console.log("OK -", msg);
}

(function main() {
  // State minimal compatible snapshot()
  let state = {
    schema: { scene: { nodes: [] } },
    selection: [],
    tool: { id: "t_select", status: "idle" }
  };

  let history = createHistory();

  // --- Lock init ---
  assert.equal(history.past.length, 0);
  assert.equal(history.future.length, 0);

  const before0 = snapshot(state);
  ({ history, state } = undo(history, state));
  ({ history, state } = redo(history, state));

  assert.deepEqual(snapshot(state), before0);
  assert.equal(history.past.length, 0);
  assert.equal(history.future.length, 0);
  ok("Init locked: undo/redo no-op when stacks empty");

  // --- Commit helper: pushPast(history, snapshot(state)) then apply state change ---
  function commit(mutatorFn) {
    history = pushPast(history, snapshot(state)); // must clear future
    state = mutatorFn(state);
  }

  // --- 2 commits ---
  commit(s => {
    const next = { ...s };
    next.schema = { ...s.schema, x: 1 };
    return next;
  });

  commit(s => {
    const next = { ...s };
    next.schema = { ...s.schema, x: 2 };
    return next;
  });

  assert.equal(state.schema.x, 2);
  assert.equal(history.past.length, 2);
  assert.equal(history.future.length, 0);
  ok("Commit pushes past and clears future");

  // --- Undo 1 ---
  ({ history, state } = undo(history, state));

  assert.equal(state.schema.x, 1);
  assert.equal(history.past.length, 1);
  assert.equal(history.future.length, 1);
  ok("Undo restores previous and moves current to future");

  // --- Redo 1 ---
  ({ history, state } = redo(history, state));

  assert.equal(state.schema.x, 2);
  assert.equal(history.past.length, 2);
  assert.equal(history.future.length, 0);
  ok("Redo restores next and clears future");

  // --- Undo then new commit => redo cleared/locked ---
  ({ history, state } = undo(history, state));
  assert.equal(state.schema.x, 1);
  assert.equal(history.future.length, 1);

  commit(s => {
    const next = { ...s };
    next.schema = { ...s.schema, x: 10 };
    return next;
  });

  assert.equal(state.schema.x, 10);
  assert.equal(history.future.length, 0);
  ok("New commit after undo clears redo stack");

  // redo must do nothing now
  const before4 = snapshot(state);
  ({ history, state } = redo(history, state));

  assert.deepEqual(snapshot(state), before4);
  assert.equal(history.future.length, 0);
  ok("Redo locked after new commit");

  console.log("\nHISTORY SMOKE: ✅ PASS");
})();
