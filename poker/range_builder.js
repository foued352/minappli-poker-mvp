// Minappli Poker — Range Builder (MVP)
// HTML+JS pur, pas de moteur, pas de npm.
// Stockage local + import/export JSON + Live Quick + Validation.

const RANKS = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];
const LS_KEY = "minappli.poker.pack.v1";
const $ = (id) => document.getElementById(id);

// grid[r][c] : 0 none, 1 green, 2 yellow
const state = {
  grid: Array.from({ length: 13 }, () => Array.from({ length: 13 }, () => 0)),
};

// ----------------- GRID LABELS -----------------
function cellLabel(r, c) {
  const hi = RANKS[r];
  const lo = RANKS[c];
  if (r === c) return `${hi}${lo}`; // pair
  if (r < c) return `${hi}${lo}s`;  // suited (above diagonal)
  return `${lo}${hi}o`;             // offsuit (below diagonal)
}

// ----------------- RENDER TABLE -----------------
function buildTable() {
  const table = $("grid");
  table.innerHTML = "";

  // Header row
  const trH = document.createElement("tr");
  const th0 = document.createElement("th");
  th0.className = "left";
  th0.textContent = "";
  trH.appendChild(th0);

  for (let c = 0; c < 13; c++) {
    const th = document.createElement("th");
    th.textContent = RANKS[c];
    trH.appendChild(th);
  }
  table.appendChild(trH);

  // Rows
  for (let r = 0; r < 13; r++) {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.className = "left";
    th.textContent = RANKS[r];
    tr.appendChild(th);

    for (let c = 0; c < 13; c++) {
      const td = document.createElement("td");
      td.dataset.r = String(r);
      td.dataset.c = String(c);
      td.textContent = cellLabel(r, c);
      td.addEventListener("mousedown", onCellMouseDown);
      td.addEventListener("mouseover", onCellMouseOver);
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }

  renderGrid();
}

function renderGrid() {
  const table = $("grid");
  for (let r = 0; r < 13; r++) {
    const tr = table.rows[r + 1];
    for (let c = 0; c < 13; c++) {
      const td = tr.cells[c + 1];
      td.classList.remove("green", "yellow");
      const v = state.grid[r][c];
      if (v === 1) td.classList.add("green");
      if (v === 2) td.classList.add("yellow");
    }
  }
}

// ----------------- ACTIVE ACTION (paint target) -----------------
let activeAction = 1; // 1=green, 2=yellow, 0=clear

function setActiveAction(v) {
  activeAction = v;
  const labels = { 0: "✖ Clear", 1: "🟢 Green", 2: "🟡 Yellow" };
  const el = $("paintActiveLabel");
  if (el) el.textContent = labels[v];
}

// ----------------- DRAG PAINT -----------------
const paint = {
  active: false,
  mode: "add",       // "add" | "remove"
  value: 1,          // value written during drag
  originValue: 0,    // value of first cell before mousedown
  painted: new Set() // "r,c" keys already processed this gesture
};

function applyHandPaint(r, c) {
  const key = `${r},${c}`;
  if (paint.painted.has(key)) return;
  paint.painted.add(key);
  state.grid[r][c] = paint.value;
  // Update single cell directly for responsiveness
  const table = $("grid");
  const td = table.rows[r + 1].cells[c + 1];
  td.classList.remove("green", "yellow");
  if (paint.value === 1) td.classList.add("green");
  if (paint.value === 2) td.classList.add("yellow");
}

function onCellMouseDown(e) {
  if (MODE === "consult") return;
  e.preventDefault(); // prevent text selection during drag
  const td = e.currentTarget;
  const r = Number(td.dataset.r);
  const c = Number(td.dataset.c);

  const current = state.grid[r][c];
  paint.originValue = current;

  // Determine intent from activeAction
  const target = activeAction;
  if (target === 0 || current === target) {
    paint.mode = "remove";
    paint.value = 0;
  } else {
    paint.mode = "add";
    paint.value = target;
  }

  paint.active = true;
  paint.painted = new Set();
  applyHandPaint(r, c);
}

function onCellMouseOver(e) {
  if (!paint.active) return;
  const td = e.currentTarget;
  const r = Number(td.dataset.r);
  const c = Number(td.dataset.c);
  applyHandPaint(r, c);
}

document.addEventListener("mouseup", () => {
  if (!paint.active) return;
  paint.active = false;

  // Single click (no drag) → preserve original cycle 0→1→2→0
  if (paint.painted.size === 1) {
    const [key] = [...paint.painted];
    const [r, c] = key.split(",").map(Number);
    state.grid[r][c] = (paint.originValue + 1) % 3;
    renderGrid();
  }

  paint.painted = new Set();
  renderLists();
  markDirty();
});

document.addEventListener("keydown", (e) => {
  if (MODE !== "edit") return;
  if (e.key === "1") setActiveAction(1);
  if (e.key === "2") setActiveAction(2);
  if (e.key === "3") setActiveAction(0);
});

function clearGrid() {
  for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) state.grid[r][c] = 0;
  renderGrid();
  renderLists();
}

function fillActive() {
  for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) state.grid[r][c] = activeAction;
  renderGrid();
  renderLists();
  markDirty();
}

function applyCategory(cells) {
  for (const [r, c] of cells) state.grid[r][c] = activeAction;
  renderGrid();
  renderLists();
  markDirty();
}

// ----------------- GRID <-> LISTS -----------------
function gridToLists() {
  const green = [];
  const yellow = [];
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const v = state.grid[r][c];
      if (v === 0) continue;
      const label = cellLabel(r, c);
      if (v === 1) green.push(label);
      if (v === 2) yellow.push(label);
    }
  }
  return { green, yellow, red: [] }; // red implicite
}

function listsToGrid({ green = [], yellow = [] }) {
  clearGrid();
  const g = new Set(green);
  const y = new Set(yellow);

  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const label = cellLabel(r, c);
      if (g.has(label)) state.grid[r][c] = 1;
      else if (y.has(label)) state.grid[r][c] = 2;
    }
  }
  renderGrid();
  renderLists();
}

// ----------------- STORAGE PACK -----------------
function getPack() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return { pack_name: ($("packName")?.value || "Mon pack MTT"), spots: [] };
  try { return JSON.parse(raw); }
  catch { return { pack_name: ($("packName")?.value || "Mon pack MTT"), spots: [] }; }
}

function setPack(pack) {
  localStorage.setItem(LS_KEY, JSON.stringify(pack));
}

function spotKey() {
  const spot = $("spot").value;
  const depth = Number($("depth").value);
  const hero = $("hero").value;
  const field = $("field").value;
  return `${spot}|${depth}|${hero}|${field}`;
}

function saveSpot() {
  const pack = getPack();
  pack.pack_name = $("packName").value || pack.pack_name || "Mon pack MTT";

  const entry = {
    key: spotKey(),
    spot: $("spot").value,
    depth: Number($("depth").value),
    hero: $("hero").value,
    field: $("field").value,
    base: gridToLists(),
    // deltas/teach gardés pour futur, pas utilisés ici
    delta: {
      nit:  { remove: [], add: [], upgrade: [], downgrade: [] },
      fish: { remove: [], add: [], upgrade: [], downgrade: [] }
    },
    teach: { bullets: ["", "", ""] }
  };

  const idx = (pack.spots || []).findIndex(s => s.key === entry.key);
  if (idx >= 0) pack.spots[idx] = entry;
  else pack.spots.push(entry);

  setPack(pack);
  exportJSON();
  alert("Spot sauvegardé (localStorage).");
}

function loadSpot() {
  const pack = getPack();
  const key = spotKey();
  const found = (pack.spots || []).find(s => s.key === key);
  if (!found) return alert("Aucun spot trouvé pour cette sélection.");

  $("packName").value = pack.pack_name || $("packName").value;
  listsToGrid(found.base || {});
  alert("Spot chargé.");
}

function exportJSON() {
  const pack = getPack();
  pack.pack_name = $("packName").value || pack.pack_name || "Mon pack MTT";
  $("io").value = JSON.stringify(pack, null, 2);
}

function importJSON() {
  const txt = $("io").value.trim();
  if (!txt) return alert("Colle un JSON dans la zone.");
  try {
    const pack = JSON.parse(txt);
    if (!pack || typeof pack !== "object" || !Array.isArray(pack.spots)) {
      return alert("JSON invalide : attendu { pack_name, spots: [] }");
    }
    setPack(pack);
    $("packName").value = pack.pack_name || $("packName").value;
    alert("Import OK (localStorage mis à jour).");
  } catch {
    alert("Import KO : JSON non parsable.");
  }
}

function wipeStorage() {
  localStorage.removeItem(LS_KEY);
  alert("localStorage effacé.");
  exportJSON();
}

// ----------------- LIVE QUICK + VALIDATION -----------------
function allHandLabels() {
  const out = [];
  for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) out.push(cellLabel(r, c));
  return out;
}

function fillHandPicker() {
  const sel = $("handPick");
  if (!sel) return;
  sel.innerHTML = "";
  for (const h of allHandLabels()) {
    const opt = document.createElement("option");
    opt.value = h;
    opt.textContent = h;
    sel.appendChild(opt);
  }
}

function renderLists() {
  const g = $("listGreen"), y = $("listYellow"), r = $("resultText");
  if (!g || !y || !r) return;

  const { green, yellow } = gridToLists();
  g.textContent = green.length ? green.join(" ") : "—";
  y.textContent = yellow.length ? yellow.join(" ") : "—";
  r.textContent = "—";
}

function classifyHand(hand, lists) {
  const gs = new Set(lists.green || []);
  const ys = new Set(lists.yellow || []);
  if (gs.has(hand)) return "green";
  if (ys.has(hand)) return "yellow";
  return "red";
}

function validateDecision() {
  const hp = $("handPick"), ad = $("actionDone"), rt = $("resultText");
  if (!hp || !ad || !rt) return;

  const hand = hp.value;
  const actionDone = ad.value; // green/yellow/red
  const lists = gridToLists();
  const truth = classifyHand(hand, lists);

  let verdict = "";
  let bbLoss = 0;

  if (actionDone === truth) {
    verdict = "✅ OK";
    bbLoss = 0;
  } else if (truth === "yellow" || actionDone === "yellow") {
    verdict = "🟡 Borderline (close)";
    bbLoss = 0.2;
  } else {
    verdict = "❌ Erreur";
    bbLoss = 0.8;
  }

  rt.textContent = `${verdict} — estimation: -${bbLoss.toFixed(1)}bb`;
}

// ----------------- WIRE UI -----------------
$("fillActive").addEventListener("click", fillActive);
$("clear").addEventListener("click", clearGrid);

// Quick category buttons
// Pocket pairs: diagonal (r === c), AA to 22
$("catPairs").addEventListener("click", () => {
  const cells = [];
  for (let i = 0; i < 13; i++) cells.push([i, i]);
  applyCategory(cells);
});
// Broadways: both cards in {A,K,Q,J,T} (indices 0-4)
$("catBroadways").addEventListener("click", () => {
  const cells = [];
  for (let r = 0; r <= 4; r++) for (let c = 0; c <= 4; c++) cells.push([r, c]);
  applyCategory(cells);
});
// Ax suited: Ace (r=0) paired suited with any other card (r < c)
$("catAxSuited").addEventListener("click", () => {
  const cells = [];
  for (let c = 1; c < 13; c++) cells.push([0, c]);
  applyCategory(cells);
});
$("save").addEventListener("click", saveSpot);
$("load").addEventListener("click", loadSpot);
$("export").addEventListener("click", exportJSON);
$("import").addEventListener("click", importJSON);
$("wipe").addEventListener("click", wipeStorage);

const btn = $("validateHand");
if (btn) btn.addEventListener("click", validateDecision);

const tbtn = $("toggleMode");
if (tbtn) tbtn.addEventListener("click", () => {
  setMode(MODE === "consult" ? "edit" : "consult");
});


["spot","depth","hero","field"].forEach(id => {
  const el = $(id);
  if (!el) return;
  el.addEventListener("change", () => {
    // Auto-load spot depuis localStorage (mode produit)
    const pack = getPack();
    const key = spotKey();
    const found = (pack.spots || []).find(s => s.key === key);

    if (found && found.base) {
      listsToGrid(found.base);
    } else {
      clearGrid(); // pas de data => range vide
    }

    // UI sync
    renderLists();
    const rt = $("resultText");
    if (rt) rt.textContent = "—";
  });
});


// ----------------- AUTOSAVE (MVP) -----------------
let dirty = false;
let saveTimer = null;

function setSaveState(text) {
  const el = $("saveState");
  if (el) el.textContent = text;
}

function markDirty() {
  dirty = true;
  setSaveState("⏳ non sauvegardé…");
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    quickSaveSilent();
  }, 600); // debounce 600ms
}

function quickSaveSilent() {
  const pack = getPack();
  pack.pack_name = $("packName").value || pack.pack_name || "Mon pack MTT";

  const entry = {
    key: spotKey(),
    spot: $("spot").value,
    depth: Number($("depth").value),
    hero: $("hero").value,
    field: $("field").value,
    base: gridToLists(),
    delta: {
      nit:  { remove: [], add: [], upgrade: [], downgrade: [] },
      fish: { remove: [], add: [], upgrade: [], downgrade: [] }
    },
    teach: { bullets: ["", "", ""] }
  };

  const idx = (pack.spots || []).findIndex(s => s.key === entry.key);
  if (idx >= 0) pack.spots[idx] = entry;
  else pack.spots.push(entry);

  setPack(pack);
  dirty = false;
  setSaveState("✅ sauvegardé");
}

// ----------------- MODE (CONSULT / EDIT) -----------------
let MODE = "consult"; // "consult" | "edit"

function setMode(next) {
  MODE = next;
  const btn = $("toggleMode");
  if (btn) btn.textContent = MODE === "consult" ? "Mode: CONSULT" : "Mode: EDIT";

  // UI: en consult on grise la grille + on désactive les clics
  const table = $("grid");
  if (table) {
    table.style.opacity = MODE === "consult" ? "0.75" : "1";
    table.style.pointerEvents = MODE === "consult" ? "none" : "auto";
  }

  // En consult, on masque Clear (optionnel mais pratique)
  const fillBtn = $("fillActive");
  if (fillBtn) fillBtn.disabled = (MODE === "consult");
  const clearBtn = $("clear");
  if (clearBtn) clearBtn.disabled = (MODE === "consult");

  // Quick category buttons: visible + enabled only in edit mode
  const quickCats = $("quickCats");
  if (quickCats) quickCats.style.display = (MODE === "edit") ? "" : "none";
  ["catPairs", "catBroadways", "catAxSuited"].forEach(id => {
    const b = $(id);
    if (b) b.disabled = (MODE === "consult");
  });

  // Affiche l'indicateur de paint seulement en mode edit
  const pi = $("paintIndicator");
  if (pi) pi.style.display = (MODE === "edit") ? "" : "none";
}



// ----------------- INIT -----------------
buildTable();
setMode("consult");
fillHandPicker();
exportJSON();
renderLists();
setSaveState("✅ sauvegardé");

