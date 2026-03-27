// demo/runner.mjs
console.log("✅ RUNNER LOADED v1");
document.title = "Minappli \u2014 Poker Ranges";
const canvas = document.getElementById("stage");
let ctx = canvas.getContext("2d");
const panelCanvas = document.getElementById("rangePanel");
const pctx = panelCanvas.getContext("2d");
const LS_KEY = "minappli.demo.poker.table.v0_1";
const LS_RANGES_KEY = "minappli.demo.poker.ranges.v0_1";
const LS_DRAFT_KEY  = "minappli:poker:rangesDraft:v1";
const LS_CURRENT_RANGE_KEY = "minappli:poker:currentRange:v1";
let currentRangeName = "default";
let __didLogNodesOnce = false;
let __isRendering = false;
let schema = null;
const EMPTY_SCHEMA = { scene: { nodes: [] } };
let state = { selection: { selectedPosition: null } };
// --- DEBUG erreurs (anti écran vide) ---
let __lastFatalError = null;

window.addEventListener("error", (e) => {
  __lastFatalError = e?.error?.stack || e?.message || String(e);
});

window.addEventListener("unhandledrejection", (e) => {
  __lastFatalError = e?.reason?.stack || e?.reason?.message || String(e?.reason);
});

const POSITIONS = ["UTG", "HJ", "CO", "BTN", "SB", "BB"];
const RANKS = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];
const SEAT_ORDER = ["seat_utg", "seat_hj", "seat_co", "seat_btn", "seat_sb", "seat_bb"];

// --- ranges (chargées depuis /demo/poker/ranges_default.json au boot) ---
const _FB = () => ({ open: [], call: [], threebet: [] });
const RANGES_BY_NAME = {
  default: { UTG: _FB(), HJ: _FB(), CO: _FB(), BTN: _FB(), SB: _FB(), BB: _FB() }
};

let SOURCE_RANGES = null;  // deep clone du JSON fetchée au boot, read-only
let DRAFT = null;          // copie de travail locale (session uniquement)
let activeAction = "open"; // "open" | "call" | "threebet"

// --- Spots (préparation future — non exposés en V1) ---
// Un spot décrit la situation pré-flop (ex: Unopened, vs UTG open…).
// En V1 le spot actif est implicitement "Unopened" ; le sélecteur UI viendra plus tard.
const SPOTS = ["Unopened", "vs UTG open", "vs HJ open", "vs CO open", "vs BTN open", "vs SB open"];
let activeSpot = "Unopened"; // toujours "Unopened" en V1
const STACKS = ["40bb", "20bb"]; // stacks réellement supportés en V1
let activeStack = STACKS[0];

// Données de demo pour les spots hors Unopened.
// "Unopened" utilise DRAFT/RANGES_BY_NAME (éditable).
// Les autres spots sont statiques (lecture seule) en attendant le support complet.
const SPOTS_DEMO_DATA = {
  "vs CO open": {
    UTG:  { open: [], call: ["QQ","JJ","TT","AKs","AKo"],                                          threebet: ["AA","KK","AQs"] },
    HJ:   { open: [], call: ["QQ","JJ","TT","99","AKs","AQs","KQs","AKo"],                         threebet: ["AA","KK","AJs"] },
    CO:   { open: [], call: [],                                                                      threebet: [] },
    BTN:  { open: [], call: ["JJ","TT","99","88","AKs","AQs","AJs","ATs","KQs","KJs","AKo","AQo"],       threebet: ["AA","KK","QQ"] },
    SB:   { open: [], call: ["JJ","TT","99","AKs","AQs","KQs","AKo"],                              threebet: ["AA","KK","QQ","AJs"] },
    BB:   { open: [], call: ["QQ","JJ","TT","99","88","77","AKs","AQs","AJs","ATs","A9s","KQs","KJs","QJs","AKo","AQo"], threebet: ["AA","KK","AKs"] },
  },
};

// Données de demo pour les stacks hors 40bb.
// 40bb utilise DRAFT (éditable). Les autres sont lecture seule.
// Positions supportées en 20bb : CO, BTN, SB, BB.
const STACK_DATA = {
  "20bb": {
    CO:  { open: ["AA","KK","QQ","JJ","TT","99","88","77","AKs","AQs","AJs","ATs","KQs","AKo","AQo"],
           call: [], threebet: [] },
    BTN: { open: ["AA","KK","QQ","JJ","TT","99","88","77","66","55","AKs","AQs","AJs","ATs","A9s","A8s","A7s","KQs","KJs","KTs","QJs","AKo","AQo","AJo","KQo"],
           call: [], threebet: [] },
    SB:  { open: ["AA","KK","QQ","JJ","TT","99","88","AKs","AQs","AJs","KQs","KJs","AKo","AQo"],
           call: [], threebet: [] },
    BB:  { open: [],
           call: ["QQ","JJ","TT","99","88","77","66","AKs","AQs","AJs","ATs","A9s","KQs","KJs","QJs","JTs","AKo","AQo","AJo","KQo"],
           threebet: ["AA","KK","AKs"] },
  },
};


// Fade panneau range
let rangePanelAlpha = 1;     // 0..1
let rangePanelText = "";
let lastPanelRect = null; // { x,y,w,h,pad,titleH,cell,gridSize }
let rangeFade = null;        // { t0, dur, phase: "out"|"in", nextText }
let hoveredHand = null;
let lastClickedHand = null;
let lastHandSnapshot = null; // { pos, data } avant le dernier toggle
let viewerMode = "edit"; // "edit" | "view"
let lastStatLineRects = null; // [{ action, y, h }] — zones cliquables des lignes stats
let quizMode = false;
let quizHand = null;
let quizCorrect = 0;
let quizIncorrect = 0;
let quizMistakes = []; // mains ratées en session — reproposées en priorité
let feedbackMsg = "";
let feedbackExpiry = 0;

// Notes de study par position — persistées en localStorage
const LS_NOTES_KEY = "minappli:poker:notes:v1";
let NOTES = { UTG: "", HJ: "", CO: "", BTN: "", SB: "", BB: "" };

// Zones cliquables du HUD — mises à jour chaque frame par drawAnswerOverlay()
let lastAnswerOverlayRect = null;  // { cx, cy, cw, ch }
let lastHudActionRects    = null;  // [{ action, y, h }]
let lastHudStackRect      = null;  // { x, y, w, h } — zone cliquable du stack label

// Options stack pour le sélecteur HUD (20/30/40/50/60bb)
// 40bb et 20bb ont des données réelles ; les autres tombent en fallback 40bb
const HUD_STACK_OPTIONS = ["20bb", "30bb", "40bb", "50bb", "60bb"];

// --- Feature hooks ---
let lastStackChangeTime  = 0;        // T9: fade léger sur changement de stack
const isQuizMode         = () => quizMode; // T11: alias explicite du mode quiz
let isErrorMode          = false;    // T13: filtre erreurs (hook)
let showHeatmap          = false;    // T15: heatmap grille (hook)
let isLeanMode           = false;    // T16: masque la table pour focus grille
let favoritePositions    = {};       // T17: { UTG: true, BTN: true, ... }
let lastSpots            = [];       // T18: historique { pos, stack, ts }
const LS_NOTE_TITLES_KEY = "minappli:poker:note_titles:v1";
let NOTE_TITLES          = { UTG: "", HJ: "", CO: "", BTN: "", SB: "", BB: "" }; // T18b

// --- Quiz étendu ---
let quizStreak           = 0;        // T3: série de bonnes réponses consécutives
const LS_QUIZ_KEY        = "minappli:poker:quiz:v1"; // T2: score persistant

// --- Quick Play ---
let quickPlayMode = false;

// --- Daily training ---
const DAILY_SIZE         = 10;       // T5: nombre de spots par session
let dailySpots           = [];       // T5: [ {pos, stack, action} ]
let dailyIdx             = 0;        // T5: index courant
let dailyActive          = false;    // T5: session en cours

// --- Difficulty ---
let difficultyLevel      = "medium"; // T7: "easy" | "medium" | "hard"
const DIFFICULTY_POSITIONS = {
  easy:   ["BTN", "SB", "BB"],
  medium: ["CO", "BTN", "SB", "BB"],
  hard:   ["UTG", "HJ", "CO", "BTN", "SB", "BB"],
};

// --- Monetisation ---
let premiumPacks         = [];       // T13: noms des packs premium-locked

// --- Session ---
const sessionStartTime   = Date.now(); // T20: timer session
const LS_ONBOARD_KEY     = "minappli:onboarded:v1"; // T19
let onboardingDone       = !!localStorage.getItem(LS_ONBOARD_KEY);

function showFeedback(msg, ms = 1400) { feedbackMsg = msg; feedbackExpiry = performance.now() + ms; }
let gridHintExpiry  = 0; // durée de l'anneau grille après sélection d'une position
let clickFlashHand  = null; // main sur laquelle le flash clic est en cours
let clickFlashTime  = 0;    // timestamp du dernier clic sur la grille
let lastEditHand    = null; // M3 : dernière main éditée
let lastEditAction  = null; // M3 : action de la dernière édition
let lastEditRemoved = false; // M3 : true = retiré, false = ajouté
let lastEditExpiry  = 0;    // M3 : timestamp d'expiration de l'indicateur

// 🔒 Slot physique “Hero” (bas-milieu). Si ton schema place autre chose en bas, change ça.
let HERO_SLOT_ID = null; // auto-detect après initBaseSlotPositions()

// Base (slots physiques) : positions de référence, immuables (ne pas sauvegarder dedans)
let BASE_SLOT_POS = null;

// Animation state
let activeAnim = null;

function saveSchema() {
  if (!schema) return;
  localStorage.setItem(LS_KEY, JSON.stringify(schema));
}

function loadSchemaFromStorage() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}



function initBaseSlotPositions() {
  if (!schema) return;
  const nodes = schema?.scene?.nodes || [];
  const base = {};
  for (const id of SEAT_ORDER) {
    const n = nodes.find(x => x.id === id);
    if (!n) continue;
    base[id] = { x: n.props.x, y: n.props.y };
  }
  BASE_SLOT_POS = base;
    HERO_SLOT_ID = autoDetectHeroSlotId();
}

function autoDetectHeroSlotId() {
  // Choisit le slot le plus bas (max y),
  // et à y quasi égal, le plus centré (x proche du centre canvas)
  const cx = canvas.width / 2;

  let bestId = null;
  let bestScore = -Infinity;

  for (const id of SEAT_ORDER) {
    const p = BASE_SLOT_POS?.[id];
    if (!p) continue;

    // score: y très important, centrage un peu
    const score = (p.y * 1000) - Math.abs(p.x - cx);

    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  return bestId;
}

// --- helpers ---

function assertNotRendering(where) {
  if (__isRendering) {
    console.warn("[INVARIANT] Tu modifies l'état pendant render :", where);
  }
}

function hitOval(px, py, node) {
  const { x, y, w, h } = node.props;
  const rx = w / 2, ry = h / 2;
  const dx = (px - x) / rx;
  const dy = (py - y) / ry;
  return (dx * dx + dy * dy) <= 1;
}

function drawOval(node, isSelected) {
  const { x, y, w, h } = node.props;
  ctx.save();
  if (node.id === "table") {
    if (isLeanMode) { ctx.restore(); return; }  // T16: lean mode — masque la table
    // Feutre poker — tons naturels, moins "UI green", plus matière
    const felt = ctx.createRadialGradient(x, y - h * 0.09, h * 0.03, x, y + h * 0.04, Math.max(w, h) * 0.58);
    felt.addColorStop(0,    "#28472e");  // centre plus éclairé
    felt.addColorStop(0.18, "#1c3a22");  // corps
    felt.addColorStop(0.42, "#0e2214");  // corps profond
    felt.addColorStop(0.68, "#060e08");  // transition
    felt.addColorStop(0.86, "#020804");  // bord intérieur
    felt.addColorStop(1,    "#010302");  // rail intérieur
    ctx.beginPath();
    ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = felt;
    ctx.shadowColor = "rgba(4,18,8,0.28)";
    ctx.shadowBlur = 22;
    ctx.fill();
    ctx.shadowBlur = 0;
    // Vignette intérieure — concentre l'attention, donne de la profondeur
    const vig = ctx.createRadialGradient(x, y, h * 0.04, x, y + h * 0.06, Math.max(w, h) * 0.54);
    vig.addColorStop(0,   "rgba(0,0,0,0)");
    vig.addColorStop(0.6, "rgba(0,0,0,0.12)");
    vig.addColorStop(1,   "rgba(0,0,0,0.55)");
    ctx.fillStyle = vig;
    ctx.fill();
    // Highlight central très subtil — chaleur naturelle du feutre
    const shine = ctx.createRadialGradient(x, y - h * 0.12, 0, x, y - h * 0.12, h * 0.4);
    shine.addColorStop(0,   "rgba(255,255,255,0.03)");
    shine.addColorStop(1,   "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.fill();
    // Rail — 3 passes : ombre, bois, or usé
    ctx.strokeStyle = "rgba(0,0,0,0.58)";
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = "rgba(42,18,2,0.76)";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = "rgba(175,132,28,0.52)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (isSelected) {
    // Halo externe — siège sélectionné, vert clair
    ctx.shadowColor = "#22c55e";
    ctx.shadowBlur = 36;
    ctx.beginPath();
    ctx.ellipse(x, y, w / 2 + 6, h / 2 + 6, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(34,197,94,0.22)";
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.beginPath();
  ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = isSelected ? "rgba(34,197,94,0.16)" : "rgba(255,255,255,0.06)";
  ctx.strokeStyle = isSelected ? "rgba(34,197,94,0.92)" : "rgba(255,255,255,0.18)";
  ctx.lineWidth = isSelected ? 2.5 : 1.2;
  if (isSelected) { ctx.shadowColor = "rgba(34,197,94,0.8)"; ctx.shadowBlur = 12; }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function saveRanges() {
  localStorage.setItem(LS_RANGES_KEY, JSON.stringify(RANGES_BY_NAME));
}

function loadRanges() {
  const raw = localStorage.getItem(LS_RANGES_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    Object.assign(RANGES_BY_NAME, parsed);
  } catch {}
}

function getHandState(pos, hand) {
  const r = getActiveRange(pos);
  if (!r) return "none";
  if (r.threebet.includes(hand)) return "threebet";
  if (r.call.includes(hand)) return "call";
  if (r.open.includes(hand)) return "open";
  return "none";
}

function toggleHandInAction(pos, hand) {
  const r = DRAFT?.[pos];
  if (!r) return;
  r.open ??= [];
  r.call ??= [];
  r.threebet ??= [];
  const isIn = r[activeAction].includes(hand);
  ['open', 'call', 'threebet'].forEach(a => {
    const idx = r[a].indexOf(hand);
    if (idx >= 0) r[a].splice(idx, 1);
  });
  if (!isIn) r[activeAction].push(hand);
  localStorage.setItem(LS_DRAFT_KEY, JSON.stringify(DRAFT));
}

function refreshCopyBtn() {
  const btn = document.getElementById("copyRange");
  if (!btn) return;
  const seatId = state.selection.selectedPosition;
  const pos = seatId ? posFromSeatId(seatId) : null;
  btn.disabled = !pos;
}

function updateJsonPreview() {
  const el = document.getElementById("rangePreview");
  if (!el || !DRAFT) return;
  const seatId = state.selection.selectedPosition;
  const pos = seatId ? posFromSeatId(seatId) : null;
  if (!pos) { el.style.display = "none"; el.textContent = ""; return; }
  el.style.display = "block";
  el.textContent = JSON.stringify(DRAFT[pos], null, 2);
}

function handAtGridPixel(px, py) {
  if (!lastPanelRect) return null;
  if (rangePanelAlpha < 0.2) return null; // ✅ grille “inactive” quand elle est invisible
  const { x, y, pad, titleH, cell, gridSize } = lastPanelRect;

  const startX = x + pad;
  const startY = y + pad + titleH + 20;

  const gx = px - startX;
  const gy = py - startY;

  if (gx < 0 || gy < 0) return null;

  const j = Math.floor(gx / cell);
  const i = Math.floor(gy / cell);

  if (i < 0 || i >= gridSize || j < 0 || j >= gridSize) return null;

  return getHandLabel(i, j);
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Retourne la range active pour une position selon le stack sélectionné.
// 40bb → DRAFT (éditable). Autre stack + pos supportée → STACK_DATA. Sinon fallback DRAFT.
function getActiveRange(pos) {
  if (!pos) return null;
  if (activeStack !== "40bb") {
    const r = STACK_DATA[activeStack]?.[pos];
    if (r) return r;
  }
  return DRAFT?.[pos] ?? null;
}
// Vrai si la position n'est pas dans STACK_DATA pour le stack actif (fallback 40bb).
function isStackFallback(pos) {
  return pos && activeStack !== "40bb" && !STACK_DATA[activeStack]?.[pos];
}

function refreshRangeSelector() {
  const sel = document.getElementById("rangeSelector");
  if (!sel) return;

  sel.innerHTML = "";
  for (const name of Object.keys(RANGES_BY_NAME)) {
    const opt = document.createElement("option");
    opt.value = name;
    const isPremium = premiumPacks.includes(name); // T13: premium lock
    opt.textContent = isPremium ? `[lock] ${name}` : name;
    if (isPremium) opt.disabled = true;
    if (name === currentRangeName) opt.selected = true;
    sel.appendChild(opt);
  }
}

// --- Range compression (QQ+, A9s+, etc.) ---

// collapseRun : prend un tableau trié d'indices RANKS (0=A, 12=2)
// topIdx = indice du rang le plus haut possible pour ce groupe (pour décider si "+" s'applique)
// labelFn(lo, hi, isTop) → string
function _collapseRun(sortedIdxs, topIdx, labelFn) {
  if (!sortedIdxs.length) return [];
  const runs = [];
  let lo = sortedIdxs[0], hi = sortedIdxs[0];
  for (let i = 1; i < sortedIdxs.length; i++) {
    if (sortedIdxs[i] === hi + 1) { hi = sortedIdxs[i]; }
    else { runs.push([lo, hi]); lo = hi = sortedIdxs[i]; }
  }
  runs.push([lo, hi]);
  return runs.map(([lo, hi]) => labelFn(lo, hi, lo === topIdx));
}

function _compressPairs(pairs) {
  if (!pairs.length) return [];
  const idxs = [...new Set(pairs.map(h => RANKS.indexOf(h[0])))].sort((a, b) => a - b);
  return _collapseRun(idxs, 0, (lo, hi, top) => {
    const low  = RANKS[hi] + RANKS[hi]; // rang le plus bas du run (ex: "77")
    const high = RANKS[lo] + RANKS[lo]; // rang le plus haut du run (ex: "AA")
    if (lo === hi) return low;                                    // paire unique — jamais de "+"
    if (top && lo === 0 && hi > lo) return low + "+";            // "77+" : run continu depuis AA
    return low + "\u2013" + high;                                // "77–JJ" sinon
  });
}

function _compressGroup(hands, suffix) {
  if (!hands.length) return [];
  const byFirst = {};
  for (const h of hands) {
    const r1 = h[0];
    (byFirst[r1] ??= []).push(RANKS.indexOf(h[1]));
  }
  const out = [];
  for (const r1 of RANKS) {
    if (!byFirst[r1]) continue;
    const idxs = [...new Set(byFirst[r1])].sort((a, b) => a - b);
    const topIdx = RANKS.indexOf(r1) + 1; // rang max possible pour ce premier rang
    out.push(..._collapseRun(idxs, topIdx, (lo, hi, top) => {
      const low  = r1 + RANKS[hi] + suffix;  // ex: "A9s" (main la plus basse du run)
      const high = r1 + RANKS[lo] + suffix;  // ex: "AKs" (main la plus haute du run)
      if (lo === hi) return low;                                  // main unique — jamais de "+"
      // "+" uniquement si : run continu depuis la main maximale possible (lo===topIdx) ET ≥2 mains
      if (top && lo === topIdx && hi > lo) return low + "+";
      // Run partiel — enumerer explicitement si petit (≤4), sinon plage
      if (hi - lo + 1 <= 4) {
        return Array.from({ length: hi - lo + 1 }, (_, k) => r1 + RANKS[lo + k] + suffix).join(" ");
      }
      return low + "\u2013" + high;
    }));
  }
  return out;
}

// Retourne un tableau de strings compressées, ou null si vide.
function compressRange(hands) {
  if (!hands || hands.length === 0) return null;
  const pairs   = hands.filter(h => h.length === 2);
  const suited  = hands.filter(h => h.endsWith("s"));
  const offsuit = hands.filter(h => h.endsWith("o"));
  const parts   = [
    ..._compressPairs(pairs),
    ..._compressGroup(suited, "s"),
    ..._compressGroup(offsuit, "o"),
  ];
  return parts.length ? parts : null;
}

function updateContextBar() {
  const el = document.getElementById("contextBar");
  if (el) el.style.display = "none";
}



// ✅ Label = tag position du node (UTG/HJ/CO/BTN/SB/BB), donc “CO” reste “CO” même si le siège bouge.
function labelFor(node) {
  const tags = node?.tags || [];
  const pos = tags.find(t => POSITIONS.includes(t));
  return pos || "";
}

function drawLabel(node) {
  const label = labelFor(node);
  if (!label) return;
  const { x, y } = node.props;
  const isSel = node.state?.selected === true;
  ctx.save();
  if (isSel) {
    ctx.shadowColor = "rgba(251,191,36,0.70)";
    ctx.shadowBlur = 14;
  }
  ctx.fillStyle = isSel ? "#fbbf24" : "rgba(255,255,255,0.82)";
  ctx.font = isSel ? "bold 14px system-ui, -apple-system, Segoe UI, Roboto, Arial"
                   : "600 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, y);
  // Indicateur de note — petit point amber si la position a une note
  if (NOTES[label]?.trim()) {
    ctx.beginPath();
    ctx.arc(x + 13, y - 8, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#fbbf24";
    ctx.globalAlpha = isSel ? 0.90 : 0.55;
    ctx.fill();
  }
  ctx.restore();
}

function getHandLabel(i, j) {
  const r1 = RANKS[i];
  const r2 = RANKS[j];

  if (i === j) return r1 + r2;

  return i < j
    ? r1 + r2 + "s"
    : r2 + r1 + "o";
}

function drawDealerButton(node) {
  // Dealer = BTN
  if (labelFor(node) !== "BTN") return;

  const { x, y, w, h } = node.props;

  // position du dealer : petit offset vers le haut-droite du siège
  const dx = w * 0.35;
  const dy = -h * 0.35;

  const cx = x + dx;
  const cy = y + dy;
  const r = Math.max(12, Math.min(16, Math.min(w, h) * 0.28));

  ctx.save();
  // Ombre portée réaliste — offset vers bas-droite, blur naturel
  ctx.shadowColor = "rgba(0,0,0,0.70)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 4;
  // Fond ivoire chaud — moins stark que le blanc pur
  const btnGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.30, 0, cx, cy, r);
  btnGrad.addColorStop(0,   "#f5f2ec");
  btnGrad.addColorStop(0.5, "#e6e2d8");
  btnGrad.addColorStop(1,   "#c8c0b0");
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = btnGrad;
  ctx.fill();
  ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  // Bordure or usé — moins métallique, plus intégré
  ctx.strokeStyle = "rgba(168,126,22,0.65)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Lettre D
  ctx.fillStyle = "rgba(20,14,4,0.92)";
  ctx.font = `bold ${Math.round(r * 1.1)}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("D", cx, cy + 0.5);
  ctx.restore();
}

function drawRangePanel() {
  const seatId = state.selection.selectedPosition;        // ex: "seat_utg"
  const pos = seatId ? posFromSeatId(seatId) : null;      // ex: "UTG"

  // ✅ cacher complètement le panneau quand rien n'est sélectionné
  if (!pos && !rangeFade) {
    pctx.clearRect(0, 0, panelCanvas.width, panelCanvas.height);
    // T19: onboarding hint
    if (!onboardingDone) {
      pctx.save();
      pctx.font = "bold 13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      pctx.fillStyle = "rgba(255,255,255,0.28)";
      pctx.textAlign = "center";
      pctx.textBaseline = "middle";
      pctx.fillText("Clique sur une position", panelCanvas.width / 2, panelCanvas.height / 2 - 10);
      pctx.font = "11px system-ui";
      pctx.fillStyle = "rgba(255,255,255,0.18)";
      pctx.fillText("pour voir la range", panelCanvas.width / 2, panelCanvas.height / 2 + 10);
      pctx.restore();
    }
    return;
  }

  // Rediriger le rendu vers le canvas panneau séparé
  const _savedCtx = ctx;
  ctx = pctx;
  pctx.clearRect(0, 0, panelCanvas.width, panelCanvas.height);

  const pad = 10;
  const gridSize = 13;
  const panelCanvasH = panelCanvas.height;
  const panelCanvasW = panelCanvas.width;

  // All vertical sections above the grid
  const padTop            = pad;
  const padBottom         = 8;
  const headerBlockH      = 36;
  const statsBlockH       = 60;
  const interactionBlockH = 40;
  const spacingBeforeGrid = 14;

  const topAreaH = padTop + headerBlockH + statsBlockH + interactionBlockH + spacingBeforeGrid;

  // Compute cell from available height (constrained by width too)
  const availH = panelCanvasH - topAreaH - padBottom;
  const availW = panelCanvasW - pad * 2 - 2;
  let cell = Math.min(
    Math.floor(availH / gridSize) - 1,
    Math.floor(availW / gridSize)
  );
  if (cell < 1) cell = 1;

  const gridW = gridSize * cell;
  const gridH = gridSize * cell;
  const w = pad * 2 + gridW + 2;
  const h = topAreaH + gridH + padBottom;

  const x = 0;
  const y = Math.max(0, Math.round((panelCanvasH - h) / 2));

  // Safety: while loop ensures grid never overflows panel bottom
  const gridStartYRel = topAreaH;  // relative to y
  let panelBottom = y + h;
  while (cell > 1 && (y + gridStartYRel + cell * gridSize) > panelBottom) {
    cell -= 1;
    panelBottom = y + (topAreaH + cell * gridSize + padBottom);
  }

  // titleH kept for backward compat with amber bar and startY formula below
  // startY = y + pad + titleH + 20 must equal y + topAreaH
  // → titleH = topAreaH - pad - 20 = topAreaH - 34
  const titleH = topAreaH - pad - 20;

  lastPanelRect = { x, y, w, h, pad, titleH, cell, gridSize };

  ctx.save();
  ctx.globalAlpha = rangePanelAlpha;

  // fond panel — légèrement plus riche que le canvas
  ctx.fillStyle = "rgba(5,10,18,0.62)";
  // couleur bordure selon le mode actif — signal visuel immédiat du contexte
  const editBorderColors = { open: "rgba(245,158,11,0.22)", call: "rgba(59,130,246,0.22)", threebet: "rgba(239,68,68,0.22)" };
  const modeBorderColor = quizMode                   ? "rgba(14,165,233,0.32)"
    : activeAction === "leak"                        ? "rgba(251,191,36,0.32)"
    : activeAction === "evolve"                      ? "rgba(20,184,166,0.32)"
    : activeAction === "all"                         ? "rgba(168,85,247,0.32)"
    : viewerMode === "edit"                          ? (editBorderColors[activeAction] ?? "rgba(255,255,255,0.14)")
    :                                                  "rgba(255,255,255,0.04)";
  ctx.strokeStyle = modeBorderColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();
  ctx.stroke();

  // clip
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.clip();

  // M11 : barre ambre gauche en VIEW — marqueur passif "lecture seule"
  if (!quizMode && viewerMode === "view" && activeAction !== "leak" && activeAction !== "evolve" && activeAction !== "all") {
    ctx.fillStyle = "rgba(251,191,36,0.15)";
    ctx.fillRect(x, y + 6, 2, titleH - 12);
  }

  const ACTION_LABEL = { open: "OPEN", call: "CALL", threebet: "3BET" };
  const ACTION_COLOR = { open: "#f59e0b", call: "#3b82f6", threebet: "#ef4444" };
  const dr = pos ? getActiveRange(pos) : null;
  const combosOf = arr => (arr || []).reduce((s, h) => s + (h.length === 2 ? 6 : h.endsWith("s") ? 4 : 12), 0);
  const cOpen     = combosOf(dr?.open);
  const cCall     = combosOf(dr?.call);
  const cThreebet = combosOf(dr?.threebet);
  const cTotal    = cOpen + cCall + cThreebet;
  const pct = v => (v / 1326 * 100).toFixed(1) + "%";

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  // --- Bloc 1 : header ---
  const b1y = y + pad + 8;
  if (pos) {
    // Gauche : position + spot
    ctx.font = "bold 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(pos, x + pad, b1y);
    const posW = ctx.measureText(pos).width;
    // spot label — contexte de jeu
    if (!quizMode && activeAction !== "leak" && activeAction !== "evolve" && activeAction !== "all") {
      ctx.font = "11px system-ui";
      ctx.fillStyle = "rgba(255,255,255,0.42)";
      ctx.fillText("  \u00b7  ouverture", x + pad + posW, b1y);
    }
    // Droite : mode + stack — contexte immédiat pour l'utilisateur
    const headerMode = quizMode ? "QUIZ"
      : activeAction === "leak"   ? "LEAK"
      : activeAction === "evolve" ? "EVOLVE"
      : activeAction === "all"    ? "ALL"
      : viewerMode === "view"     ? "VIEW"
      : `EDIT \u00b7 ${ACTION_LABEL[activeAction] ?? activeAction.toUpperCase()}`;
    const _editActionColors = { open: "rgba(245,158,11,0.80)", call: "rgba(59,130,246,0.80)", threebet: "rgba(239,68,68,0.80)" };
    const headerModeColor = quizMode                   ? "rgba(125,211,252,0.80)"
      : activeAction === "leak"                        ? "rgba(251,191,36,0.80)"
      : activeAction === "evolve"                      ? "rgba(20,184,166,0.80)"
      : activeAction === "all"                         ? "rgba(168,85,247,0.80)"
      : viewerMode === "view"                          ? "rgba(251,191,36,0.70)"
      : (_editActionColors[activeAction]               ?? "rgba(255,255,255,0.60)");
    ctx.font = "11px system-ui";
    ctx.textAlign = "right";
    ctx.fillStyle = headerModeColor;
    ctx.fillText(`${headerMode}  \u00b7  ${activeStack.toUpperCase()}`, x + w - pad, b1y);
    ctx.textAlign = "left";
    if (isStackFallback(pos)) {
      ctx.font = "10px system-ui";
      ctx.fillStyle = "rgba(251,191,36,0.6)";
      ctx.fillText(`(${activeStack.toUpperCase()} non dispo \u2014 affichage 40BB)`, x + pad, b1y + 14);
    }
  } else {
    ctx.font = "13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.30)";
    ctx.fillText("S\u00e9lectionne une position", x + pad, b1y);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + pad, b1y + 12); ctx.lineTo(x + w - pad, b1y + 12); ctx.stroke();

  // --- Bloc 2 : stats ---
  const b2y = b1y + 20;
  const lineH = 15;
  ctx.font = "12px system-ui";

  // stocker les zones cliquables pour le click handler
  lastStatLineRects = [
    { action: "open",     y: b2y,             h: lineH },
    { action: "call",     y: b2y + lineH,     h: lineH },
    { action: "threebet", y: b2y + lineH * 2, h: lineH },
  ];

  // M5 : couleurs stats = couleurs grille — cohérence visuelle panneau ↔ cellules
  const STAT_COLORS = { open: "rgba(34,197,94,0.90)", call: "rgba(59,130,246,0.90)", threebet: "rgba(239,68,68,0.90)" };
  const statRows = [
    { action: "open",     label: `OPEN  ${cOpen}  (${pct(cOpen)})`,     color: STAT_COLORS.open     },
    { action: "call",     label: `CALL  ${cCall}  (${pct(cCall)})`,     color: STAT_COLORS.call     },
    { action: "threebet", label: `3BET  ${cThreebet}  (${pct(cThreebet)})`, color: STAT_COLORS.threebet },
  ];

  // M7 : stats atténuées en LEAK/EVOLVE — mode contexte, pas édition
  const _statsInContext = activeAction === "leak" || activeAction === "evolve";
  if (_statsInContext) ctx.save(), ctx.globalAlpha *= 0.40;

  const STAT_BG_COLORS = {
    open:     "rgba(30,171,90,0.14)",
    call:     "rgba(59,124,248,0.14)",
    threebet: "rgba(229,62,62,0.14)",
  };
  statRows.forEach(({ action, label, color }, i) => {
    const rowY = b2y + lineH * i;
    const combosRow = action === "open" ? cOpen : action === "call" ? cCall : cThreebet;
    // Barre proportionnelle colorée — lisible même en vue rapide
    if (cTotal > 0 && combosRow > 0) {
      const maxW = w - pad * 2 + 4;
      const propW = Math.max(6, (combosRow / 1326) * maxW * 6.2); // amplifié pour visibilité
      const barW  = Math.min(maxW, propW);
      ctx.fillStyle = action === activeAction ? STAT_BG_COLORS[action] : "rgba(255,255,255,0.05)";
      ctx.fillRect(x + pad - 2, rowY - 2, barW, lineH + 2);
    } else if (action === activeAction) {
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x + pad - 2, rowY - 2, w - pad * 2 + 4, lineH + 2);
    }
    // Carré couleur action
    ctx.fillStyle = color;
    ctx.fillRect(x + pad + 5, rowY + 3, 6, 6);
    ctx.fillStyle = action === activeAction ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.50)";
    ctx.fillText(label, x + pad + 17, rowY + 6);
  });

  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.fillText(`Total  ${cTotal}  (${pct(cTotal)})`, x + pad + 17, b2y + lineH * 3 + 8);

  if (_statsInContext) ctx.restore();

  // --- Bloc 3 : interaction ---
  // Lignes 0 (b3y)     : titre du mode — toujours visible
  // Lignes 1-2         : contenu mode OU hover info (jamais les deux)
  // hoverActive = true : les lignes 1-2 sont reservees au hover, le mode n'y ecrit pas
  const b3y = b2y + lineH * 4 + 14;
  const activeColor = ACTION_COLOR[activeAction] ?? "white";
  const activeLabel = ACTION_LABEL[activeAction] ?? activeAction.toUpperCase();
  const hoverActive = !!(hoveredHand && !quizMode);
  ctx.font = "bold 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";

  if (quizMode) {
    // Quiz : pas de hover, zone dediee score/instruction
    const qLabel = { open: "OPEN", call: "CALL", threebet: "3BET" }[activeAction] ?? activeAction.toUpperCase();
    const fallback = pos && isStackFallback(pos);
    const stackCtx = fallback ? `${activeStack} (fallback 40bb)` : activeStack;
    const qColor = ACTION_COLOR[activeAction] ?? "rgba(255,255,255,0.6)";
    // "Test : OPEN · 40bb" — action color-codée pour être immédiatement lisible
    ctx.font = "11px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText("Test : ", x + pad, b3y);
    const testW = ctx.measureText("Test : ").width;
    ctx.font = "bold 12px system-ui";
    ctx.fillStyle = qColor;
    ctx.fillText(qLabel, x + pad + testW, b3y);
    const qW = ctx.measureText(qLabel).width;
    ctx.font = "11px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText(`  \u00b7  ${stackCtx}`, x + pad + testW + qW, b3y);
    ctx.font = "bold 12px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillText("Clic gauche sur ?  \u2192  en range", x + pad, b3y + lineH);
    ctx.font = "12px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText("Clic droit sur ?  \u2192  pas en range", x + pad, b3y + lineH + 13);
    const total = quizCorrect + quizIncorrect;
    const pctScore = total > 0 ? Math.round(quizCorrect / total * 100) : null;
    ctx.font = "11px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText("Score :", x + pad, b3y + lineH * 3);
    ctx.font = "bold 13px system-ui";
    ctx.fillStyle = "#22c55e";
    ctx.fillText(`\u2713 ${quizCorrect}`, x + pad + 48, b3y + lineH * 3);
    ctx.fillStyle = "#ef4444";
    ctx.fillText(`\u2717 ${quizIncorrect}`, x + pad + 92, b3y + lineH * 3);
    if (pctScore !== null) {
      ctx.font = "bold 12px system-ui";
      ctx.fillStyle = pctScore >= 80 ? "#22c55e" : pctScore >= 60 ? "#fbbf24" : "#ef4444";
      ctx.fillText(`${pctScore}%`, x + pad + 138, b3y + lineH * 3);
    }
    ctx.font = "11px system-ui";
    ctx.fillStyle = quizMistakes.length > 0 ? "rgba(251,191,36,0.85)" : "rgba(255,255,255,0.32)";
    ctx.fillText(`A revoir : ${quizMistakes.length}`, x + pad, b3y + lineH * 4);
    // T3: streak display
    if (quizStreak >= 2) {
      ctx.fillStyle = quizStreak >= 5 ? "#fbbf24" : "rgba(34,197,94,0.80)";
      ctx.fillText(`Serie : ${quizStreak}`, x + pad + 100, b3y + lineH * 4);
    }
    // T5: daily training progress
    if (dailyActive) {
      ctx.fillStyle = "rgba(125,211,252,0.70)";
      ctx.fillText(`Session : ${dailyIdx + 1} / ${dailySpots.length}`, x + pad, b3y + lineH * 5);
    }
    // T20: session duration
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillText(`Duree : ${Math.floor(getSessionDuration() / 60)}m`, x + pad + 100, b3y + lineH * 5);
  } else if (activeAction === "evolve") {
    const prevIdx = pos ? POSITIONS.indexOf(pos) - 1 : -1;
    const prevPos = prevIdx >= 0 ? POSITIONS[prevIdx] : null;
    ctx.fillStyle = "#14b8a6";
    ctx.fillText(prevPos
      ? `EVOLVE \u2014 ${pos} vs ${prevPos}`
      : `EVOLVE \u2014 ${pos}`, x + pad, b3y);
    // Lignes 1-2 : legende (masquee si hover actif ou premiere position sans comparaison)
    if (!hoverActive) {
      ctx.font = "11px system-ui";
      if (!prevPos) {
        ctx.fillStyle = "rgba(20,184,166,0.5)";
        ctx.fillText("premi\u00e8re position \u2014 pas de comparaison", x + pad, b3y + lineH);
      } else {
        ctx.fillStyle = "#22c55e";                   ctx.fillText("\u25a0 nouvelle",  x + pad,       b3y + lineH);
        ctx.fillStyle = "#1d4ed8";                   ctx.fillText("\u25a0 commune",   x + pad + 62,  b3y + lineH);
        ctx.fillStyle = "rgba(255,255,255,0.3)";     ctx.fillText("\u25a0 absente",   x + pad + 120, b3y + lineH);
        if (activeStack !== "40bb") {
          ctx.fillStyle = "rgba(20,184,166,0.5)";
          ctx.fillText("(r\u00e9f\u00e9rence 40bb)", x + pad, b3y + lineH * 2);
        }
      }
    }
  } else if (activeAction === "leak") {
    ctx.fillStyle = "#f59e0b";
    ctx.fillText("LEAK", x + pad, b3y);
    // Ligne 1 : legende couleurs ou note stack (masquee si hover actif)
    if (!hoverActive) {
      ctx.font = "11px system-ui";
      if (activeStack !== "40bb") {
        ctx.fillStyle = "rgba(251,191,36,0.5)";
        ctx.fillText("(r\u00e9f. 40bb \u2014 \u00e9dition uniquement en 40bb)", x + pad, b3y + lineH);
      } else {
        ctx.font = "11px system-ui";
        ctx.fillStyle = "#16a34a"; ctx.fillText("\u25a0 correct",  x + pad,       b3y + lineH);
        ctx.fillStyle = "#dc2626"; ctx.fillText("\u25a0 extra",    x + pad + 62,  b3y + lineH);
        ctx.fillStyle = "#b45309"; ctx.fillText("\u25a0 manquant", x + pad + 106, b3y + lineH);
      }
    }
  } else if (activeAction === "all") {
    ctx.fillStyle = "#a855f7";
    ctx.fillText("ALL \u2014 open + call + 3bet superpos\u00e9s", x + pad, b3y);
  } else if (viewerMode === "view") {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText("VIEW", x + pad, b3y);
    if (!hoverActive) {
      ctx.font = "11px system-ui";
      ctx.fillStyle = "rgba(255,255,255,0.38)";
      ctx.fillText("clic grille \u2192 passe en EDIT", x + pad, b3y + lineH);
    }
  } else {
    if (cTotal === 0) {
      // État vide : guider l'utilisateur directement
      ctx.fillStyle = "rgba(251,191,36,0.8)";
      ctx.fillText("Range vide", x + pad, b3y);
      if (!hoverActive) {
        ctx.font = "11px system-ui";
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillText("Clique une case pour ajouter une main", x + pad, b3y + lineH);
      }
    } else {
      ctx.fillStyle = activeColor;
      ctx.fillText(`EDIT  \u00b7  ${activeLabel}`, x + pad, b3y);
      if (!hoverActive) {
        ctx.font = "11px system-ui";
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fillText("clic grille", x + pad, b3y + lineH);
      }
      // M3 : indicateur dernière édition — fade-out 4s
      if (lastEditHand && lastEditExpiry > performance.now() && !hoverActive) {
        const editAlpha = Math.min(1, (lastEditExpiry - performance.now()) / 800) * 0.80;
        ctx.globalAlpha = editAlpha;
        ctx.font = "11px system-ui";
        ctx.fillStyle = lastEditRemoved ? "rgba(255,255,255,0.65)" : (ACTION_COLOR[lastEditAction] ?? "rgba(255,255,255,0.65)");
        const editSuffix = lastEditRemoved ? "retir\u00e9" : (ACTION_LABEL[lastEditAction] ?? lastEditAction);
        ctx.fillText(`\u2713 ${lastEditHand} \u2014 ${editSuffix}`, x + pad, b3y + lineH * 2);
        ctx.globalAlpha = 1;
      }
    }
  }

  // Zone hover : lignes 1-2, rendu seulement si hoverActive (aucune superposition possible)
  if (hoverActive) {
    const hCombos = hoveredHand.length === 2 ? 6 : hoveredHand.endsWith("s") ? 4 : 12;
    const dr2 = pos ? getActiveRange(pos) : null;
    const handAction = dr2?.open?.includes(hoveredHand) ? "open"
      : dr2?.call?.includes(hoveredHand) ? "call"
      : dr2?.threebet?.includes(hoveredHand) ? "threebet"
      : "none";
    const handActionLabel = { open: "OPEN", call: "CALL", threebet: "3BET", none: "hors range" }[handAction];
    const handActionColor = { open: "#22c55e", call: "#3b82f6", threebet: "#ef4444", none: "rgba(255,255,255,0.35)" }[handAction];
    ctx.font = "bold 12px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillText(hoveredHand, x + pad, b3y + lineH);
    ctx.font = "12px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(`${hCombos}\u00d7`, x + pad + 46, b3y + lineH);
    ctx.fillStyle = handActionColor;
    ctx.fillText(handActionLabel, x + pad, b3y + lineH * 2);
  }

  // grille
  const startX = x + pad;
  const startY = y + pad + titleH + 20;

  // Grille secondaire — moins dominante que le header/stats du panneau
  ctx.save();
  ctx.globalAlpha = rangePanelAlpha;

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const hand = getHandLabel(i, j);
      const cx = startX + j * cell;
      const cy = startY + i * cell;

      const cellState = pos ? getHandState(pos, hand) : "none";

      if (quizMode) {
        const isTarget = hand === quizHand;
        ctx.fillStyle = isTarget ? "#fbbf24" : "#1e293b";
        ctx.fillRect(cx, cy, cell - 2, cell - 2);
        ctx.font = isTarget ? "bold 15px system-ui" : "11px system-ui";
        ctx.fillStyle = isTarget ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.28)";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(isTarget ? "?" : hand, cx + (cell - 2) / 2, cy + (cell - 2) / 2);
      } else {
        if (activeAction === "evolve") {
          const prevIdx = POSITIONS.indexOf(pos) - 1;
          const prevPos = prevIdx >= 0 ? POSITIONS[prevIdx] : null;
          const curRef  = SOURCE_RANGES?.[pos];
          const prevRef = prevPos ? SOURCE_RANGES?.[prevPos] : null;
          const inCur  = curRef?.open?.includes(hand)  || curRef?.call?.includes(hand)  || curRef?.threebet?.includes(hand);
          const inPrev = prevRef?.open?.includes(hand) || prevRef?.call?.includes(hand) || prevRef?.threebet?.includes(hand);
          ctx.fillStyle = (inCur && inPrev) ? "#1d4ed8"   // bleu — présente dans les deux
            : (inCur && !inPrev)            ? "#16a34a"   // vert — ajoutée dans cette position
            :                                 "#1a2535";  // foncé — absente (plus de contraste)
        } else if (activeAction === "leak") {
          const ref = SOURCE_RANGES?.[pos];
          const refState = ref?.open?.includes(hand) ? "open"
            : ref?.call?.includes(hand) ? "call"
            : ref?.threebet?.includes(hand) ? "threebet"
            : "none";
          const userHas = cellState !== "none";
          const refHas  = refState  !== "none";
          ctx.fillStyle = (userHas && refHas)  ? "#16a34a"
            : (userHas && !refHas) ? "#dc2626"
            : (!userHas && refHas) ? "#b45309"
            :                        "#374151";
        } else {
          const showAll = activeAction === "all";
          const dimmed = !showAll && cellState !== "none" && cellState !== activeAction;
          const isPocket = (i === j); // diagonale = pocket pair (AA, KK, QQ...)
          // Hover preview : case vide en EDIT → teinte la couleur de l'action en cours
          const isHoveredEmpty = viewerMode === "edit" && !showAll && hand === hoveredHand && cellState === "none";
          const HOVER_PREVIEW = { open: "rgba(245,158,11,0.30)", call: "rgba(59,130,246,0.30)", threebet: "rgba(239,68,68,0.30)" };
          // Fond vide : pockets légèrement plus bleutés — marquent visuellement la diagonale
          // M2 : pocket pair fond distinct dans TOUS les modes (repère diagonal permanent)
          const emptyColor = isHoveredEmpty
            ? (HOVER_PREVIEW[activeAction] ?? "rgba(255,255,255,0.15)")
            : (isPocket && !showAll) ? "#1c2d44"
            : (viewerMode === "edit" && !showAll) ? "#1a2a3a" : "#162030";
          ctx.fillStyle =
            cellState === "threebet" ? (dimmed ? "rgba(220,38,38,0.06)"   : "#dc2626") :
            cellState === "call"     ? (dimmed ? "rgba(37,99,235,0.06)"   : "#2563eb") :
            cellState === "open"     ? (dimmed ? "rgba(180,83,9,0.06)"    : "#b45309") :
                                       emptyColor;
        }
        ctx.fillRect(cx, cy, cell - 2, cell - 2);
        if (hand === lastClickedHand && lastEditExpiry > performance.now()) {
          // Glow gold : distingue "dernière case éditée" du simple hover (limité 4s)
          ctx.save();
          ctx.shadowColor = "rgba(255,180,0,0.7)";
          ctx.shadowBlur = 10;
          ctx.strokeStyle = "rgba(255,180,0,0.95)";
          ctx.lineWidth = 2;
          ctx.strokeRect(cx, cy, cell - 2, cell - 2);
          ctx.restore();
        }
        if (hand === hoveredHand) {
          // Outline couleur action si case vide en EDIT (cohérent avec le fill preview)
          const isEmptyHover = viewerMode === "edit"
            && activeAction !== "all" && activeAction !== "evolve" && activeAction !== "leak"
            && cellState === "none";
          ctx.strokeStyle = isEmptyHover
            ? (ACTION_COLOR[activeAction] ?? "rgba(255,255,255,0.8)")
            : "rgba(255,255,255,0.8)";
          ctx.lineWidth = hand === lastClickedHand ? 1.5 : 2;
          ctx.strokeRect(cx + 2, cy + 2, cell - 6, cell - 6);
        }
        // Flash clic : overlay couleur action qui s'efface en 380ms — feedback immédiat coloré
        // Couleur = action active (vert OPEN / bleu CALL / rouge 3BET) pour lier visuellement le clic au résultat
        if (hand === clickFlashHand) {
          const elapsed = performance.now() - clickFlashTime;
          if (elapsed < 380) {
            ctx.save();
            ctx.globalAlpha = (1 - elapsed / 380) * 0.92;
            ctx.fillStyle = ACTION_COLOR[activeAction] ?? "#ffffff";
            ctx.fillRect(cx, cy, cell - 2, cell - 2);
            ctx.restore();
          }
        }
        const _showAll  = activeAction === "all";
        const _isPocket = (i === j);
        const _dimmed   = !_showAll && cellState !== "none" && cellState !== activeAction
                          && activeAction !== "evolve" && activeAction !== "leak";
        // Binaire IN/OUT : actif fort, tout le reste discret
        const textColor = (cellState !== "none" && !_dimmed) ? "rgba(255,255,255,0.98)"
                        : (cellState !== "none")             ? "rgba(255,255,255,0.13)"
                        :                                      "rgba(255,255,255,0.26)";
        // T5: bordure cellule subtile
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(cx, cy, cell - 2, cell - 2);
        ctx.fillStyle = textColor;
        // T5: font +1px
        ctx.font = (_isPocket && !_showAll && activeAction !== "evolve" && activeAction !== "leak")
          ? "bold 12px system-ui, -apple-system, Segoe UI, Roboto, Arial"
          : "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(hand, cx + (cell - 2) / 2, cy + (cell - 2) / 2);
      }
    }
  }
  ctx.restore(); // M4 : fin zone grille atténuée en VIEW

  // Séparateur diagonal suited / offsuit : ligne brisée suivant les gaps entre cellules
  // Aide à lire les patterns (broadways suited en haut-droite, offsuit en bas-gauche, pockets sur l'axe)
  if (!quizMode && activeAction !== "evolve" && activeAction !== "leak") {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(startX + cell - 1, startY);
    for (let si = 0; si < gridSize; si++) {
      const rx = startX + (si + 1) * cell - 1; // bord droit du gap après la case pocket si
      const by = startY + (si + 1) * cell - 1; // bord bas du gap sous la case pocket si
      ctx.lineTo(rx, by);
      if (si < gridSize - 1) ctx.lineTo(startX + (si + 2) * cell - 1, by);
    }
    ctx.stroke();
    ctx.restore();
  }

  // T15: hook heatmap (placeholder — données non encore disponibles)
  if (showHeatmap) { /* TODO: overlay heatmap par fréquence de clic */ }

  // M1+M2 : anneau grille — EDIT uniquement.
  // Cas A : fade-out 2.2s après sélection d'une position (guide le 2e geste).
  // Cas B : pulse permanent quand la range est vide (invite à cliquer).
  const _editRingBase = pos && viewerMode === "edit" && !quizMode
    && activeAction !== "all" && activeAction !== "leak" && activeAction !== "evolve";
  const _ringFade = _editRingBase && gridHintExpiry > 0 && performance.now() < gridHintExpiry;
  const _ringEmpty = _editRingBase && cTotal === 0;
  if (_ringFade || _ringEmpty) {
    let pulseAlpha;
    if (_ringEmpty) {
      // Pulse lent et doux — invite permanente quand rien n'est encore édité
      pulseAlpha = 0.22 + 0.18 * Math.sin(performance.now() / 900);
    } else {
      const remaining = gridHintExpiry - performance.now();
      const fadeAlpha  = remaining / 2200;
      pulseAlpha = fadeAlpha * (0.5 + 0.35 * Math.sin(performance.now() / 180));
    }
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, pulseAlpha));
    ctx.beginPath();
    ctx.roundRect(startX - 5, startY - 5, gridSize * cell + 8, gridSize * cell + 8, 6);
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 20;
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();

  ctx = _savedCtx;
}

function wrapText(ctx, text, maxWidth) {
  if (!text) return [];
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? (line + " " + word) : word;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function sanitizeSelection(nodes) {
  if (!state.selection) state.selection = { selectedPosition: null };

  const id = state.selection.selectedPosition;
  if (!id) return;

  const node = nodes.find(n => n.id === id);

  if (!node) {
    console.warn("[sanitizeSelection] selectedPosition missing in schema -> reset", id);
    state.selection.selectedPosition = null;
    return;
  }

  if (node.type !== "shape.oval" || node.id === "table") {
    console.warn("[sanitizeSelection] selectedPosition is not a seat -> reset", id);
    state.selection.selectedPosition = null;
    return;
  }
}

function drawAnswerOverlay() {
  const seatId = state.selection?.selectedPosition;
  const pos = seatId ? posFromSeatId(seatId) : null;
  if (!pos || !rangePanelAlpha) {
    lastAnswerOverlayRect = null;
    lastHudActionRects    = null;
    lastHudStackRect      = null;
    return;
  }

  const r = getActiveRange(pos);
  const SEP = "  ·  ";  // séparateur espacé pour le rythme de lecture
  const toLine = arr => {
    const parts = compressRange(arr);
    return parts ? parts.join(SEP) : "—";
  };

  const cw     = 346;  // +5% scale HUD
  const padH   = 16;
  const labelW = 42;   // largeur colonne OPEN/CALL/3BET
  const maxRangeW = cw - padH * 2 - labelW;

  const FONT_RANGE = "500 13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const FONT_LABEL = "bold 11px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const ACTION_C   = { open: "#f59e0b", call: "#3b82f6", threebet: "#ef4444" };
  const ACTION_L   = { open: "OPEN", call: "CALL", threebet: "3BET" };

  const lineH   = 18;  // hauteur d'une ligne de texte
  const lineGap = 4;   // espace entre lignes d'un même wrap
  const rowPadV = 10;  // padding haut+bas dans chaque row
  const rowGap  = 8;   // espace entre rows actions

  // Mesure et wrap du texte de chaque action (taille stable, jamais de réduction)
  ctx.save();
  ctx.font = FONT_RANGE;
  const actions = ["open", "call", "threebet"].map(a => {
    const text = toLine(r?.[a]);
    const isDash = text === "—";
    let lines;
    if (isDash || ctx.measureText(text).width <= maxRangeW) {
      lines = [text];
    } else {
      // Wrap propre sur les séparateurs — jamais de réduction de taille
      const tokens = text.split(SEP);
      const out = [];
      let cur = "";
      for (const tok of tokens) {
        const candidate = cur ? cur + SEP + tok : tok;
        if (ctx.measureText(candidate).width <= maxRangeW) {
          cur = candidate;
        } else {
          if (cur) out.push(cur);
          cur = tok;
        }
      }
      if (cur) out.push(cur);
      lines = out.length ? out : [text];
    }
    const rowH = rowPadV * 2 + lines.length * lineH + Math.max(0, lines.length - 1) * lineGap;
    return { a, text, lines, rowH };
  });

  // Hauteur dynamique : header fixe + rows calculés
  const headerH  = 66;  // ligne 22px + séparateur + air
  const bottomPad = 12;
  const contentH = actions.reduce((s, x) => s + x.rowH, 0) + rowGap * (actions.length - 1);
  const ch = headerH + contentH + bottomPad;

  const cx = 420 - cw / 2;
  const cy = 260 - ch / 2;

  // Stocker les zones cliquables pour le hit-test dans le click handler
  lastAnswerOverlayRect = { cx, cy, cw, ch };
  lastHudActionRects    = [];
  lastHudStackRect      = null; // sera mis à jour plus bas dans le header

  // T9: fade léger sur changement de stack (100-150ms)
  const _stackAge       = performance.now() - lastStackChangeTime;
  const _stackFadeAlpha = _stackAge < 150 ? 0.35 + 0.65 * (_stackAge / 150) : 1.0;
  ctx.globalAlpha = rangePanelAlpha * _stackFadeAlpha;

  // Fond carte
  ctx.shadowColor = "rgba(0,0,0,0.96)";
  ctx.shadowBlur = 52;
  ctx.fillStyle = "rgba(8,10,14,0.94)";
  ctx.beginPath(); ctx.roundRect(cx, cy, cw, ch, 12); ctx.fill();
  ctx.shadowBlur = 0;

  // Bordure subtile
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(cx, cy, cw, ch, 12); ctx.stroke();

  ctx.textBaseline = "middle";

  // Header : "BTN · OPEN · 40BB ▾" — ligne principale 22px bold blanc
  const headerY = cy + 30;
  const _stackFb      = isStackFallback(pos);
  const _stackDisplay = activeStack.toUpperCase() + (_stackFb ? " fb" : "") + " \u25be";
  const _headerPrefix = pos + "  \u00b7  " + ACTION_L[activeAction] + "  \u00b7  ";

  ctx.font = "bold 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const _prefixW = ctx.measureText(_headerPrefix).width;
  ctx.font = "bold 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const _stackLblW = ctx.measureText(_stackDisplay).width;

  // Badge cliquable derrière la partie stack
  const _sHitX = cx + padH + _prefixW - 4;
  const _sHitY = headerY - 12;
  const _sHitW = _stackLblW + 10;
  const _sHitH = 24;
  lastHudStackRect = { x: _sHitX, y: _sHitY, w: _sHitW, h: _sHitH };
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.beginPath(); ctx.roundRect(_sHitX, _sHitY, _sHitW, _sHitH, 4); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 0.75;
  ctx.beginPath(); ctx.roundRect(_sHitX, _sHitY, _sHitW, _sHitH, 4); ctx.stroke();

  // Dessiner le préfixe "BTN · OPEN · " en blanc 22px
  ctx.font = "bold 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.fillText(_headerPrefix, cx + padH, headerY);

  // Dessiner le stack en blanc 16px légèrement plus petit
  ctx.font = "bold 16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.fillStyle = "#e2e8f0";
  ctx.fillText(_stackDisplay, cx + padH + _prefixW, headerY);

  // Séparateur
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + padH, cy + headerH - 4);
  ctx.lineTo(cx + cw - padH, cy + headerH - 4);
  ctx.stroke();

  // Rows OPEN / CALL / 3BET
  let rowY = cy + headerH;
  actions.forEach(({ a, text, lines, rowH }) => {
    // Fond teinté
    ctx.fillStyle = a === "open"     ? "rgba(245,158,11,0.13)"
                  : a === "call"     ? "rgba(59,130,246,0.13)"
                  :                    "rgba(239,68,68,0.13)";
    ctx.beginPath();
    ctx.roundRect(cx + padH - 4, rowY, cw - padH * 2 + 8, rowH, 3);
    ctx.fill();

    // Accent bar gauche
    ctx.fillStyle = ACTION_C[a];
    ctx.fillRect(cx + padH - 4, rowY + 2, 2, rowH - 4);

    // Label action — centré verticalement dans la row
    ctx.font = FONT_LABEL;
    ctx.fillStyle = ACTION_C[a];
    ctx.textAlign = "left";
    ctx.fillText(ACTION_L[a], cx + padH, rowY + rowH / 2);

    // Texte range — taille fixe 12px, wrap propre
    ctx.font = FONT_RANGE;
    const isDash = text === "—";
    ctx.fillStyle = isDash ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.95)";
    ctx.textAlign = "left";
    lines.forEach((line, li) => {
      const lineY = rowY + rowPadV + lineH / 2 + li * (lineH + lineGap);
      ctx.fillText(line, cx + padH + labelW, lineY);
    });

    lastHudActionRects.push({ action: a, y: rowY, h: rowH });
    rowY += rowH + rowGap;
  });

  // Decision badge — affiché quand une main est survolée dans le panneau
  if (hoveredHand && !quizMode) {
    const dr3 = getActiveRange(pos);
    const dec = dr3?.open?.includes(hoveredHand) ? "open"
      : dr3?.call?.includes(hoveredHand) ? "call"
      : dr3?.threebet?.includes(hoveredHand) ? "threebet"
      : "fold";
    const DEC_C = { open: "#f59e0b", call: "#3b82f6", threebet: "#ef4444", fold: "#94a3b8" };
    const DEC_L = { open: "OPEN", call: "CALL", threebet: "3BET", fold: "FOLD" };
    const bH = 36;
    const bY = Math.min(cy + ch + 10, canvas.height - bH - 6);
    ctx.shadowColor = "rgba(0,0,0,0.88)";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "rgba(8,10,14,0.92)";
    ctx.beginPath(); ctx.roundRect(cx, bY, cw, bH, 8); ctx.fill();
    ctx.shadowBlur = 0;
    const decRgb = dec === "open" ? "245,158,11" : dec === "call" ? "37,99,235" : dec === "threebet" ? "220,38,38" : "148,163,184";
    ctx.strokeStyle = `rgba(${decRgb},0.28)`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(cx, bY, cw, bH, 8); ctx.stroke();
    ctx.fillStyle = DEC_C[dec];
    ctx.fillRect(cx, bY + 6, 2, bH - 12);
    const midY = bY + bH / 2;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = "bold 15px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(hoveredHand, cx + padH + 6, midY);
    const handW = ctx.measureText(hoveredHand).width;
    ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    const arrow = "  \u2192  ";
    ctx.fillText(arrow, cx + padH + 6 + handW, midY);
    const arrowW = ctx.measureText(arrow).width;
    ctx.font = "bold 15px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = DEC_C[dec];
    ctx.fillText(DEC_L[dec], cx + padH + 6 + handW + arrowW, midY);
  }

  ctx.restore();
}

function render() {
  requestAnimationFrame(render);

  lastPanelRect = null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Vignette canvas — cadre la scène, renforce la profondeur
  const _vig = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.22, canvas.width / 2, canvas.height / 2, canvas.width * 0.70);
  _vig.addColorStop(0,   "rgba(0,0,0,0)");
  _vig.addColorStop(0.7, "rgba(0,0,0,0.12)");
  _vig.addColorStop(1,   "rgba(0,0,0,0.52)");
  ctx.fillStyle = _vig;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (__lastFatalError) {
  ctx.font = "14px monospace";
  ctx.fillText("ERROR:", 20, 40);

  const firstLine = String(__lastFatalError).split("\n")[0].slice(0, 140);
  ctx.fillText(firstLine, 20, 60);
  return;
}


  updateRangeFade(performance.now());

  const safeSchema = schema || { scene: { nodes: [] } };
  const nodes = safeSchema.scene?.nodes || [];
  if (!__didLogNodesOnce && nodes.length) {
  __didLogNodesOnce = true;
  console.log("NODES (once):", nodes);
}
  sanitizeSelection(nodes);

  // table
  const table = nodes.find(n => n.id === "table");
  if (table) drawOval(table, false);

  // seats
  for (const n of nodes) {
    if (n.id === "table") continue;
    if (n.type !== "shape.oval") continue;
    drawOval(n, n.state?.selected === true);
    drawLabel(n);
    drawDealerButton(n);
  }

  // Guidage visuel premier usage : aucune position sélectionnée
  if (schema && nodes.length && !state.selection?.selectedPosition) {
    const t = performance.now();
    const ringPulse  = 0.35 + 0.22 * Math.sin(t / 800);
    const hintPulse  = 0.30 + 0.15 * Math.sin(t / 1100);

    // Anneau pulsant discret autour de chaque siège
    ctx.save();
    for (const n of nodes) {
      if (n.id === "table") continue;
      if (n.type !== "shape.oval") continue;
      const { x, y, w, h } = n.props;
      ctx.globalAlpha = ringPulse;
      ctx.beginPath();
      ctx.ellipse(x, y, w / 2 + 6, h / 2 + 6, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(200,160,50,0.90)";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "rgba(200,160,50,0.60)";
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    // Hint texte — sobre
    ctx.save();
    ctx.font = "13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = `rgba(255,255,255,${hintPulse.toFixed(2)})`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Clique une position", canvas.width / 2, canvas.height - 32);
    ctx.restore();
  }

  // Overlay réponse principale — compact card sur la scène
  drawAnswerOverlay();

  // panel (canvas séparé — toujours appelé, gère son propre clearRect)
  drawRangePanel();
  // feedback temporaire
  if (feedbackMsg && performance.now() < feedbackExpiry) {
    const fw = ctx.measureText(feedbackMsg).width + 24;
    const fh = 28;
    const fx = (canvas.width - fw) / 2;
    const fy = canvas.height - 48;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (feedbackExpiry - performance.now()) / 300);
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.beginPath(); ctx.roundRect(fx, fy, fw, fh, 8); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "13px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(feedbackMsg, canvas.width / 2, fy + fh / 2);
    ctx.restore();
  }

  refreshEditButtons();
}

function refreshEditButtons() {
  const seatId = state.selection.selectedPosition;
  const pos = seatId ? posFromSeatId(seatId) : null;
  const d = pos ? DRAFT?.[pos] : null;

  const inView = viewerMode === "view" || activeAction === "leak" || activeAction === "evolve" || quizMode || activeStack !== "40bb";

  const undoBtnEl = document.getElementById("undoHand");
  if (undoBtnEl) undoBtnEl.disabled = inView || !lastHandSnapshot;

  const clearBtnEl = document.getElementById("clearAction");
  if (clearBtnEl) clearBtnEl.disabled = inView || !d || !(d[activeAction]?.length > 0);

  const resetBtnEl = document.getElementById("resetPosition");
  if (resetBtnEl) resetBtnEl.disabled = inView || !d || !((d.open?.length ?? 0) + (d.call?.length ?? 0) + (d.threebet?.length ?? 0) > 0);

  [undoBtnEl, clearBtnEl, resetBtnEl].forEach(b => {
    if (!b) return;
    if (inView) {
      b.style.opacity    = "0.15";
      b.style.cursor     = "default";
      b.style.pointerEvents = "none";
    } else {
      b.style.opacity    = b.disabled ? "0.35" : "1";
      b.style.cursor     = b.disabled ? "default" : "pointer";
      b.style.pointerEvents = "";
    }
  });
}

function posFromSeatId(seatId) {
  const n = (schema?.scene?.nodes || []).find(x => x.id === seatId);
  if (!n) return null;
  const tag = (n.tags || []).find(t => POSITIONS.includes(t));
  return tag || null;
}

function startRangeFade(newText, durMs = 160) {
  // Si animation en cours, on écrase (comportement simple)
  rangeFade = { t0: performance.now(), dur: durMs, phase: "out", nextText: newText };
}

function updateRangeFade(now) {
  if (!rangeFade) return;

  const u = clamp01((now - rangeFade.t0) / rangeFade.dur);
  const e = u; // linéaire = simple et clean

  if (rangeFade.phase === "out") {
    rangePanelAlpha = 1 - e;
    if (u >= 1) {
      rangePanelText = rangeFade.nextText;
      rangeFade = { t0: now, dur: rangeFade.dur, phase: "in", nextText: "" };
    }
  } else {
    rangePanelAlpha = e;
    if (u >= 1) {
      rangePanelAlpha = 1;
      rangeFade = null;
    }
  }
}

// ---- animation helpers ----
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
// easeInOutQuad simple (glissade propre)
function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function stopAnim() {
  if (activeAnim?.raf) cancelAnimationFrame(activeAnim.raf);
  activeAnim = null;
}

function computeRotationMapping(selectedSeatId) {
  // Slots physiques (coordonnées fixes) = SEAT_ORDER
  // On veut que selectedSeatId aille sur le slot HERO_SLOT_ID.
  const heroIndex = SEAT_ORDER.indexOf(HERO_SLOT_ID);
  const selIndex = SEAT_ORDER.indexOf(selectedSeatId);
  if (heroIndex === -1 || selIndex === -1) return null;

  // Rotation : on fabrique “who goes to slot i”
  // rotated[i] = seatId qui doit aller sur slot SEAT_ORDER[i]
  // On veut rotated[heroIndex] = selectedSeatId.
  const n = SEAT_ORDER.length;
  const k = (selIndex - heroIndex + n) % n;

  const rotated = [];
  for (let i = 0; i < n; i++) {
    rotated[i] = SEAT_ORDER[(i + k) % n];
  }

  // Mapping target position by seatId
  // seatId rotated[i] va sur slot SEAT_ORDER[i] => coordonnées BASE_SLOT_POS[slot]
  const targetById = {};
  for (let i = 0; i < n; i++) {
    const seatId = rotated[i];
    const slotId = SEAT_ORDER[i];
    const base = BASE_SLOT_POS?.[slotId];
    if (!base) continue;
    targetById[seatId] = { x: base.x, y: base.y };
  }
  return targetById;
}

function animateSeatsTo(targetById, durationMs = 240) {
  if (!schema) return;
  if (!targetById) return;

  stopAnim();

  const nodes = schema.scene?.nodes || [];

  // start positions
  const startById = {};
  for (const id of Object.keys(targetById)) {
    const n = nodes.find(x => x.id === id);
    if (!n) continue;
    startById[id] = { x: n.props.x, y: n.props.y };
  }

  const t0 = performance.now();

  function step(now) {
    const u = clamp01((now - t0) / durationMs);
    const e = easeInOutQuad(u);

    for (const [id, tgt] of Object.entries(targetById)) {
      const n = nodes.find(x => x.id === id);
      const s = startById[id];
      if (!n || !s) continue;
      n.props.x = lerp(s.x, tgt.x, e);
      n.props.y = lerp(s.y, tgt.y, e);
    }

    render();

    if (u < 1) {
      activeAnim.raf = requestAnimationFrame(step);
    } else {
      // snap final exact + persist
      for (const [id, tgt] of Object.entries(targetById)) {
        const n = nodes.find(x => x.id === id);
        if (!n) continue;
        n.props.x = tgt.x;
        n.props.y = tgt.y;
      }
      render();
      saveSchema();
      stopAnim();
    }
  }

  activeAnim = { raf: requestAnimationFrame(step) };
}

// --- selection + transition ---
function selectNode(nodeId) {
  console.log("selectNode", { nodeId, hasBase: !!BASE_SLOT_POS });

  // selection highlight
  for (const n of (schema.scene?.nodes || [])) {
    if (n.id !== "table" && n.type === "shape.oval") {
      n.state ??= {};
      n.state.selected = (n.id === nodeId);
    }
  }

  // --- selection state ---
  if (nodeId && SEAT_ORDER.includes(nodeId)) {
    state.selection.selectedPosition = nodeId;
    rangePanelAlpha = 0;
    rangeFade = { t0: performance.now(), dur: 150, phase: "in", nextText: "" };
    gridHintExpiry = performance.now() + 2200; // anneau grille : guide le deuxième geste
    // T19: marquer onboarding fait dès le premier clic
    if (!onboardingDone) { onboardingDone = true; localStorage.setItem(LS_ONBOARD_KEY, "1"); }
    // T18: historique des spots
    const _hPos = posFromSeatId(nodeId);
    if (_hPos) { lastSpots.push({ pos: _hPos, stack: activeStack, ts: Date.now() }); if (lastSpots.length > 30) lastSpots.shift(); }
    refreshCopyBtn();
    updateJsonPreview();
    updateContextBar();
  }

  // --- animation ---
  if (nodeId && SEAT_ORDER.includes(nodeId) && BASE_SLOT_POS) {
    const targetById = computeRotationMapping(nodeId);
    animateSeatsTo(targetById, 260);
  } else {
    render();
    saveSchema();
  }
}


// --- input ---
canvas.addEventListener("click", (e) => {
  if (!schema) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top) * scaleY;

  const nodes = (schema.scene?.nodes || [])
    .filter(n => n.id !== "table" && n.type === "shape.oval");

  let hit = null;
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (hitOval(px, py, nodes[i])) { hit = nodes[i]; break; }
  }

  if (hit) {
    const prevSeat = state.selection.selectedPosition;
    if (!quizMode) {
      if (hit.id === prevSeat) {
        // Re-clic sur la même position : cycle OPEN → CALL → 3BET
        const cycle = ["open", "call", "threebet"];
        const next = cycle[(cycle.indexOf(activeAction) + 1) % cycle.length];
        activeAction = next;
        styleActionButtons();
        updateContextBar();
        render();
        return;
      } else {
        // Nouveau siège : reset à OPEN immédiatement
        activeAction = "open";
        styleActionButtons();
      }
    }
    selectNode(hit.id);
  } else {
  // Stack selector — clic sur le label stack dans le HUD
  if (lastHudStackRect) {
    const { x, y, w, h } = lastHudStackRect;
    if (px >= x && px <= x + w && py >= y && py <= y + h) {
      e.stopPropagation(); // empêche le document-click closer de fermer immédiatement
      const popup = document.getElementById("stackPopup");
      if (popup && popup.style.display !== "none") {
        popup.style.display = "none";
      } else {
        openStackPopup(e.clientX, e.clientY);
      }
      return;
    }
  }
  // HUD card — absorber le clic, router les lignes action
  if (lastAnswerOverlayRect) {
    const { cx, cy, cw, ch } = lastAnswerOverlayRect;
    if (px >= cx && px <= cx + cw && py >= cy && py <= cy + ch) {
      if (lastHudActionRects) {
        for (const { action, y, h } of lastHudActionRects) {
          if (py >= y && py <= y + h) {
            activeAction = action;
            document.querySelectorAll("[data-action]").forEach(b => {
              b.classList.toggle("active", b.dataset.action === activeAction);
            });
            return;
          }
        }
      }
      return; // clic sur le corps du HUD — pas de désélection
    }
  }
  // clic dans le vide → fermer
  state.selection.selectedPosition = null;
  rangePanelText = "";
  rangePanelAlpha = 0;
  rangeFade = null;
  lastPanelRect = null;
  refreshCopyBtn();
  updateJsonPreview();
  updateContextBar();
  render();
  saveSchema();
}
});

// --- boot ---
async function boot() {
  try {
    const res = await fetch("./poker/ranges_default.json");
    RANGES_BY_NAME.default = await res.json();
    SOURCE_RANGES = deepClone(RANGES_BY_NAME.default);
  } catch (e) {
    console.warn("ranges_default.json load failed, using fallback", e);
  }

  // T2: restore quiz score
  loadQuizScore();

  // Restore saved packs (renames, clones…) — must happen after fetch so saved data wins
  loadRanges();

  // Charger les notes de study et leurs titres
  try {
    const savedNotes = localStorage.getItem(LS_NOTES_KEY);
    if (savedNotes) NOTES = { ...NOTES, ...JSON.parse(savedNotes) };
    const savedTitles = localStorage.getItem(LS_NOTE_TITLES_KEY);
    if (savedTitles) NOTE_TITLES = { ...NOTE_TITLES, ...JSON.parse(savedTitles) };
  } catch { /* notes corrompues — repartir de zéro */ }

  // Restore active pack name
  const savedName = localStorage.getItem(LS_CURRENT_RANGE_KEY);
  if (savedName && RANGES_BY_NAME[savedName]) {
    currentRangeName = savedName;
  } else if (!RANGES_BY_NAME[currentRangeName]) {
    currentRangeName = Object.keys(RANGES_BY_NAME)[0] ?? "default";
  }

  try {
    const saved = localStorage.getItem(LS_DRAFT_KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    const isCoherent = parsed && typeof parsed === "object" && POSITIONS.every(p => p in parsed);
    DRAFT = isCoherent ? parsed : deepClone(RANGES_BY_NAME[currentRangeName]);
  } catch {
    console.warn("draft localStorage corrompu, fallback sur pack courant");
    DRAFT = deepClone(RANGES_BY_NAME[currentRangeName]);
  }

  const stored = loadSchemaFromStorage();
  if (stored) {
    schema = stored;
    initBaseSlotPositions();
    refreshRangeSelector();
    updateContextBar();
    render();
  } else {
    fetch("./poker/schema_poker_table_v0_1.json")
      .then(r => r.json())
      .then(j => {
        schema = j;
        initBaseSlotPositions();
        refreshRangeSelector();
        updateContextBar();
        render();
      })
      .catch(err => console.error("Schema load failed:", err));
  }
}
boot();

document.getElementById("reset")?.addEventListener("click", () => {
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem(LS_DRAFT_KEY);
  stopAnim();
  state.selection.selectedPosition = null;
  rangeFade = null;
  rangePanelAlpha = 0;
  DRAFT = SOURCE_RANGES ? deepClone(SOURCE_RANGES) : null;
  refreshCopyBtn();
  updateJsonPreview();
  updateContextBar();
  fetch("./poker/schema_poker_table_v0_1.json")
    .then(r => r.json())
    .then(j => {
      schema = j;
      initBaseSlotPositions();
      render();
      saveSchema();
    });
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top) * scaleY;
  if (schema) {
    const seatHit = (schema.scene?.nodes || []).some(n =>
      n.id !== "table" && n.type === "shape.oval" && hitOval(px, py, n)
    );
    canvas.style.cursor = seatHit ? "pointer" : "default";
  } else {
    canvas.style.cursor = "default";
  }
});

canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

// --- panel canvas handlers (grille séparée du canvas principal) ---

panelCanvas.addEventListener("click", (e) => {
  if (!lastPanelRect) return;
  const rect = panelCanvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;

  if (lastStatLineRects) {
    const { x: px0, w: pw } = lastPanelRect;
    const hit = lastStatLineRects.find(r => px >= px0 && px <= px0 + pw && py >= r.y && py <= r.y + r.h);
    if (hit) {
      activeAction = hit.action;
      styleActionButtons();
      render(); updateContextBar(); updateJsonPreview();
      return;
    }
  }

  const hand = handAtGridPixel(px, py);
  const seatId = state.selection.selectedPosition;
  const pos = seatId ? posFromSeatId(seatId) : null;

  if (hand && pos && quizMode) {
    if (hand === quizHand) quizAnswer(true);
    return;
  }

  if (hand && pos) {
    if (activeAction === "all" || activeAction === "leak" || activeAction === "evolve") return;
    if (activeStack !== "40bb") { showFeedback("Edition uniquement en 40bb"); return; }
    if (viewerMode === "view") {
      viewerMode = "edit";
      applyViewToggleStyle();
      showFeedback("Mode EDIT");
    }
    lastHandSnapshot = { pos, data: deepClone(DRAFT[pos]) };
    toggleHandInAction(pos, hand);
    lastClickedHand = hand;
    clickFlashHand  = hand;
    clickFlashTime  = performance.now();
    const wasIn = lastHandSnapshot.data[activeAction]?.includes(hand);
    lastEditHand = hand; lastEditAction = activeAction; lastEditRemoved = !!wasIn;
    lastEditExpiry = performance.now() + 4000;
    showFeedback(wasIn ? `${hand} retiré` : `${hand} ajouté`);
    document.getElementById("undoHand")?.removeAttribute("disabled");
    updateJsonPreview(); updateContextBar();
  }
});

panelCanvas.addEventListener("mousemove", (e) => {
  const rect = panelCanvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  hoveredHand = handAtGridPixel(px, py);
  panelCanvas.style.cursor = hoveredHand ? "pointer" : "default";
});

panelCanvas.addEventListener("mouseleave", () => {
  hoveredHand = null;
});

panelCanvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (!lastPanelRect) return;
  const rect = panelCanvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  const hand = handAtGridPixel(px, py);

  if (quizMode) {
    if (hand === quizHand) quizAnswer(false);
    return;
  }

  const seatId = state.selection.selectedPosition;
  const pos = seatId ? posFromSeatId(seatId) : null;
  if (hand && pos) {
    if (viewerMode === "view" || activeAction === "all" || activeAction === "leak" || activeAction === "evolve" || activeStack !== "40bb") return;
    const prevState = getHandState(pos, hand);
    toggleHandInAction(pos, hand);
    lastClickedHand = hand;
    clickFlashHand  = hand;
    clickFlashTime  = performance.now();
    lastEditHand = hand; lastEditAction = activeAction; lastEditRemoved = prevState !== "none";
    lastEditExpiry = performance.now() + 4000;
    updateJsonPreview(); updateContextBar();
  }
});

document.getElementById("clonePack")?.addEventListener("click", () => {
  const name = prompt("Nom du nouveau pack :")?.trim();
  if (!name) return;
  if (RANGES_BY_NAME[name]) { alert(`Un pack "${name}" existe déjà.`); return; }

  RANGES_BY_NAME[name] = deepClone(DRAFT ?? RANGES_BY_NAME[currentRangeName]);
  currentRangeName = name;
  DRAFT = deepClone(RANGES_BY_NAME[currentRangeName]);
  localStorage.setItem(LS_DRAFT_KEY, JSON.stringify(DRAFT));
  localStorage.setItem(LS_CURRENT_RANGE_KEY, currentRangeName);

  saveRanges();
  refreshRangeSelector();
  updateContextBar();
  updateJsonPreview();
  render();
});

document.getElementById("renamePack")?.addEventListener("click", () => {
  const oldName = currentRangeName;
  const newName = prompt("Nouveau nom du pack :", oldName)?.trim();
  if (!newName || newName === oldName) return;
  if (RANGES_BY_NAME[newName]) { alert(`Un pack "${newName}" existe déjà.`); return; }

  RANGES_BY_NAME[newName] = deepClone(DRAFT ?? RANGES_BY_NAME[oldName]);
  delete RANGES_BY_NAME[oldName];
  currentRangeName = newName;
  DRAFT = deepClone(RANGES_BY_NAME[currentRangeName]);
  localStorage.setItem(LS_DRAFT_KEY, JSON.stringify(DRAFT));
  localStorage.setItem(LS_CURRENT_RANGE_KEY, currentRangeName);

  saveRanges();
  refreshRangeSelector();
  updateContextBar();
  updateJsonPreview();
  render();
});

document.getElementById("deletePack")?.addEventListener("click", () => {
  const keys = Object.keys(RANGES_BY_NAME);
  if (keys.length <= 1) { alert("Impossible : il faut au moins un pack."); return; }
  if (!confirm(`Supprimer le pack "${currentRangeName}" ?`)) return;

  delete RANGES_BY_NAME[currentRangeName];
  currentRangeName = Object.keys(RANGES_BY_NAME)[0];
  DRAFT = deepClone(RANGES_BY_NAME[currentRangeName]);
  localStorage.setItem(LS_DRAFT_KEY, JSON.stringify(DRAFT));
  localStorage.setItem(LS_CURRENT_RANGE_KEY, currentRangeName);

  saveRanges();
  refreshRangeSelector();
  updateContextBar();
  updateJsonPreview();
  render();
});

document.getElementById("rangeSelector")?.addEventListener("change", (e) => {
  currentRangeName = e.target.value;
  DRAFT = deepClone(RANGES_BY_NAME[currentRangeName]);
  localStorage.setItem(LS_DRAFT_KEY, JSON.stringify(DRAFT));
  localStorage.setItem(LS_CURRENT_RANGE_KEY, currentRangeName);

  rangeFade = null;
  rangePanelAlpha = 1;
  lastPanelRect = null;

  updateContextBar();
  updateJsonPreview();
  render();
});

const copyRangeBtn = document.getElementById("copyRange");
copyRangeBtn?.addEventListener("click", () => {
  const seatId = state.selection.selectedPosition;
  const pos = seatId ? posFromSeatId(seatId) : null;
  if (!pos || !DRAFT?.[pos]) return;
  navigator.clipboard.writeText(JSON.stringify(DRAFT[pos], null, 2)).then(() => {
    copyRangeBtn.textContent = "Copied!";
    setTimeout(() => { copyRangeBtn.textContent = "Copy JSON"; }, 1000);
  });
});

const KEY_TO_ACTION = { "0": "all", "1": "open", "2": "call", "3": "threebet", "4": "leak", "5": "evolve" };
document.addEventListener("keydown", (e) => {
  const tag = document.activeElement?.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return;
  if (e.key.toLowerCase() === "q") { document.getElementById("quizToggle")?.click(); return; }
  const action = KEY_TO_ACTION[e.key];
  if (!action) return;
  if (!state.selection.selectedPosition) return;
  activeAction = action;
  document.querySelectorAll("#actionSelector [data-action]").forEach(b => {
    b.classList.toggle("active", b.dataset.action === activeAction);
  });
  styleActionButtons();
  render();
  updateJsonPreview();
  updateContextBar();
});

document.getElementById("actionSelector")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  activeAction = btn.dataset.action;
  document.querySelectorAll("#actionSelector [data-action]").forEach(b => {
    b.classList.toggle("active", b.dataset.action === activeAction);
  });
  styleActionButtons();
  render();
  updateJsonPreview();
  updateContextBar();
});

function styleActionButtons() {
  const ACTION_BG = { open: "#b45309", call: "#2563eb", threebet: "#dc2626", all: "#6b21a8", leak: "#92400e", evolve: "#0f766e" };
  document.querySelectorAll("#actionSelector [data-action]").forEach(b => {
    const isActive  = b.dataset.action === activeAction;
    const isAll     = b.dataset.action === "all";
    const isLeak    = b.dataset.action === "leak";
    const isEvolve  = b.dataset.action === "evolve";
    const isSpecial = isAll || isLeak || isEvolve;
    b.style.background  = isActive ? (ACTION_BG[b.dataset.action] ?? "#555") : "rgba(255,255,255,0.08)";
    b.style.color       = isActive ? "#fff"
      : isEvolve ? "rgba(94,234,212,0.6)"
      : isLeak   ? "rgba(251,191,36,0.6)"
      : isAll    ? "rgba(200,160,255,0.6)"
      : "rgba(255,255,255,0.45)";
    b.style.fontWeight  = isActive ? "bold" : "normal";
    b.style.border      = isSpecial
      ? (isActive
          ? `2px solid ${isEvolve ? "#14b8a6" : isLeak ? "#f59e0b" : "#a855f7"}`
          : `1px dashed ${isEvolve ? "rgba(20,184,166,0.4)" : isLeak ? "rgba(251,191,36,0.4)" : "rgba(168,85,247,0.4)"}`)
      : (isActive ? "2px solid transparent" : "1px solid rgba(255,255,255,0.15)");
    b.style.borderRadius = "6px";
    b.style.padding      = "4px 10px";
    b.style.cursor       = "pointer";
    b.style.fontSize     = isSpecial ? "11px" : "";
  });
}

// --- Groupe View ---
const viewLabel = document.createElement("span");
viewLabel.style.cssText = "color:rgba(255,255,255,0.5);font-size:10px;text-transform:uppercase;letter-spacing:0.07em;font-family:system-ui,sans-serif;margin-right:4px;pointer-events:none;user-select:none;";
viewLabel.textContent = "View";
document.getElementById("actionSelector")?.prepend(viewLabel);

const allSep = document.createElement("span");
allSep.id = "allSep";
allSep.textContent = "|";
allSep.style.cssText = "color:rgba(255,255,255,0.2);margin:0 4px;pointer-events:none;";
document.getElementById("actionSelector")?.appendChild(allSep);

const allBtn = document.createElement("button");
allBtn.dataset.action = "all";
allBtn.textContent = "ALL";
allBtn.title = "Afficher toutes les actions (touche 0)";
document.getElementById("actionSelector")?.appendChild(allBtn);

// --- Groupe Learn ---
const learnSep = document.createElement("span");
learnSep.style.cssText = "display:inline-flex;align-items:center;gap:5px;margin:0 8px;pointer-events:none;user-select:none;";
learnSep.innerHTML = '<span style="display:inline-block;width:1px;height:16px;background:rgba(255,255,255,0.25);"></span><span style="color:rgba(255,255,255,0.5);font-size:10px;text-transform:uppercase;letter-spacing:0.07em;font-family:system-ui,sans-serif;">Learn</span>';
document.getElementById("actionSelector")?.appendChild(learnSep);

const leakBtn = document.createElement("button");
leakBtn.dataset.action = "leak";
leakBtn.textContent = "LEAK";
leakBtn.title = "LEAK — comparer sa range avec la r\u00e9f\u00e9rence (touche 4)";
document.getElementById("actionSelector")?.appendChild(leakBtn);

const evolveBtn = document.createElement("button");
evolveBtn.dataset.action = "evolve";
evolveBtn.textContent = "EVOLVE";
evolveBtn.title = "EVOLVE — voir comment la range \u00e9volue entre positions (touche 5)";
document.getElementById("actionSelector")?.appendChild(evolveBtn);

styleActionButtons();

// Titres accessibles + labels clavier pour les boutons d'action View (OPEN/CALL/3BET/ALL)
{ const AT = { open: "Mains d\u2019open (touche 1)", call: "Mains de call (touche 2)", threebet: "Mains de 3-bet (touche 3)", all: "Toutes les actions (touche 0)" };
  const KL = { open: "1\u00b7OPEN", call: "2\u00b7CALL", threebet: "3\u00b7 3BET" };
  document.querySelectorAll("#actionSelector [data-action]").forEach(b => {
    if (AT[b.dataset.action]) b.title = AT[b.dataset.action];
    if (KL[b.dataset.action]) b.textContent = KL[b.dataset.action];
  }); }

// --- Quiz ---
function quizPickHand() {
  if (quizMistakes.length > 0) {
    const idx = Math.floor(Math.random() * quizMistakes.length);
    quizHand = quizMistakes[idx];
  } else {
    quizHand = getHandLabel(
      Math.floor(Math.random() * 13),
      Math.floor(Math.random() * 13)
    );
  }
}

function quizAnswer(userSaysInRange) {
  const seatId = state.selection.selectedPosition;
  const pos = seatId ? posFromSeatId(seatId) : null;
  if (!pos || !quizHand) return;
  const ref = SOURCE_RANGES?.[pos];
  const isInRange = !!(ref?.[activeAction]?.includes(quizHand));
  const correct = userSaysInRange === isInRange;
  if (correct) {
    quizCorrect++;
    quizStreak++;                                                      // T3: streak++
    quizMistakes = quizMistakes.filter(h => h !== quizHand);
  } else {
    quizIncorrect++;
    quizStreak = 0;                                                    // T3: reset streak
    if (!quizMistakes.includes(quizHand)) quizMistakes.push(quizHand);
  }
  saveQuizScore();                                                     // T2: persist
  showFeedback(correct
    ? `\u2713 Correct !`
    : `\u2717 ${quizHand} ${isInRange ? "est dans" : "n\u2019est pas dans"} ${activeAction.toUpperCase()}`
  , correct ? 1000 : 2000);
  quizPickHand();
  render();
}

const quizBtn = document.createElement("button");
quizBtn.id = "quizToggle";
quizBtn.textContent = "QUIZ";
quizBtn.title = "QUIZ \u2014 tester sa m\u00e9morisation des ranges (touche Q)";
quizBtn.style.cssText = "background:rgba(255,255,255,0.08);color:rgba(125,211,252,0.65);border:1px dashed rgba(56,189,248,0.45);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;";
document.getElementById("actionSelector")?.appendChild(quizBtn);

const notInRangeBtn = document.createElement("button");
notInRangeBtn.id = "quizNotInRange";
notInRangeBtn.textContent = "Not in range";
notInRangeBtn.title = "Cette main n'est pas dans la range";
notInRangeBtn.style.cssText = "display:none;background:#1e3a5f;color:#93c5fd;border:1px solid #3b82f6;border-radius:6px;padding:5px 14px;cursor:pointer;font-size:12px;font-weight:bold;";
document.getElementById("actionSelector")?.insertAdjacentElement("afterend", notInRangeBtn);

quizBtn.addEventListener("click", () => {
  quizMode = !quizMode;
  if (quizMode) {
    const seatId = state.selection.selectedPosition;
    if (!seatId) { quizMode = false; showFeedback("S\u00e9lectionne une position d\u2019abord pour d\u00e9marrer le quiz"); return; }
    quizCorrect = 0; quizIncorrect = 0; quizMistakes = [];
    quizPickHand();
    quizBtn.style.background = "#0c4a6e";
    quizBtn.style.color = "#7dd3fc";
    quizBtn.style.border = "2px solid #38bdf8";
    quizBtn.style.fontWeight = "bold";
    notInRangeBtn.style.display = "none";
  } else {
    quizHand = null;
    quizBtn.style.background = "rgba(255,255,255,0.08)";
    quizBtn.style.color = "rgba(125,211,252,0.65)";
    quizBtn.style.border = "1px dashed rgba(56,189,248,0.45)";
    quizBtn.style.fontWeight = "normal";
    notInRangeBtn.style.display = "none";
  }
  render();
});

notInRangeBtn.addEventListener("click", () => {
  if (quizMode) quizAnswer(false);
});

// --- T5: bouton DAILY training ---
const dailyBtn = document.createElement("button");
dailyBtn.id = "dailyTraining";
dailyBtn.textContent = "DAILY";
dailyBtn.title = "Session entrainement quotidien \u2014 10 spots al\u00e9atoires";
dailyBtn.style.cssText = "background:rgba(255,255,255,0.06);color:rgba(125,211,252,0.55);border:1px dashed rgba(56,189,248,0.35);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;";
document.getElementById("actionSelector")?.appendChild(dailyBtn);

dailyBtn.addEventListener("click", () => {
  startDailyTraining();
  dailyBtn.style.background = "#0c2d4a";
  dailyBtn.style.color      = "#7dd3fc";
  dailyBtn.style.border     = "2px solid #38bdf8";
});

refreshCopyBtn();

// --- P4: Quick Play toggle ---
const quickPlayBtn = document.createElement("button");
quickPlayBtn.id = "quickPlay";
quickPlayBtn.textContent = "QUICK PLAY";
quickPlayBtn.title = "Focaliser sur table + HUD + grille — masque les éléments secondaires";
quickPlayBtn.style.cssText = "background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.45);border:1px solid rgba(255,255,255,0.14);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;";
document.getElementById("reset")?.insertAdjacentElement("beforebegin", quickPlayBtn);

quickPlayBtn.addEventListener("click", () => {
  quickPlayMode = !quickPlayMode;
  const toolbar = document.getElementById("toolbar");
  if (quickPlayMode) {
    quickPlayBtn.style.background  = "#1e3a5f";
    quickPlayBtn.style.color       = "#7dd3fc";
    quickPlayBtn.style.border      = "2px solid #38bdf8";
    quickPlayBtn.style.fontWeight  = "bold";
    if (toolbar) toolbar.style.opacity = "0.25";
  } else {
    quickPlayBtn.style.background  = "rgba(255,255,255,0.06)";
    quickPlayBtn.style.color       = "rgba(255,255,255,0.45)";
    quickPlayBtn.style.border      = "1px solid rgba(255,255,255,0.14)";
    quickPlayBtn.style.fontWeight  = "normal";
    if (toolbar) toolbar.style.opacity = "";
  }
  updateContextBar();
  render();
});

// --- Aide raccourcis ---
const helpBtn = document.createElement("button");
helpBtn.textContent = "?";
helpBtn.title = "Raccourcis clavier";
helpBtn.style.cssText = "opacity:0.5;font-size:12px;padding:2px 7px;border-radius:50%;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.06);color:white;cursor:pointer;";
document.getElementById("reset")?.insertAdjacentElement("beforebegin", helpBtn);

const helpPopup = document.createElement("div");
helpPopup.style.cssText = "display:none;position:fixed;z-index:999;background:rgba(20,20,30,0.96);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:12px 16px;font:13px/1.7 system-ui,sans-serif;color:rgba(255,255,255,0.85);white-space:pre;pointer-events:none;";
helpPopup.textContent = "Raccourcis clavier\n\n1    OPEN\n2    CALL\n3    3BET\n0    ALL \u2014 toutes les actions\n4    LEAK \u2014 comparer range\n5    EVOLVE \u2014 \u00e9volution entre positions\nQ    QUIZ \u2014 m\u00e9morisation\n\nClic table \u2192 s\u00e9lectionner une position\nClic grille \u2192 modifier la range (mode EDIT)";
document.body.appendChild(helpPopup);

helpBtn.addEventListener("click", (e) => {
  const visible = helpPopup.style.display !== "none";
  helpPopup.style.display = visible ? "none" : "block";
  const r = helpBtn.getBoundingClientRect();
  helpPopup.style.left = r.left + "px";
  helpPopup.style.top  = (r.bottom + 6) + "px";
  e.stopPropagation();
});
document.addEventListener("click", () => { helpPopup.style.display = "none"; });

// --- Stack selector (contexte) — source de vérité partagée avec le popup HUD ---
// Utilise HUD_STACK_OPTIONS pour avoir exactement les mêmes choix que le popup HUD.
// setActiveStack() met à jour cette valeur ET le popup ; le change handler fait l'inverse.
const stackSel = document.createElement("select");
stackSel.id = "stackSelector";
stackSel.title = "Stack actif";
HUD_STACK_OPTIONS.forEach(s => {
  const o = document.createElement("option");
  o.value = s; o.textContent = s.toUpperCase();
  stackSel.appendChild(o);
});
stackSel.value = activeStack; // initialiser sur la valeur courante
stackSel.style.cssText = [
  "background:rgba(30,30,40,0.0)",
  "color:rgba(255,255,255,0.7)",
  "border:none",
  "border-bottom:1px solid rgba(255,255,255,0.25)",
  "border-radius:0",
  "padding:1px 4px",
  "font:11px system-ui,sans-serif",
  "cursor:pointer",
  "outline:none",
].join(";");
document.getElementById("actionSelector")?.insertAdjacentElement("afterend", stackSel);
stackSel.style.opacity = "0.60";
stackSel.addEventListener("change", () => {
  setActiveStack(stackSel.value);
});

console.log("BOOT: starting render loop");
requestAnimationFrame(render);

// --- Export ranges ---
// DRAFT est la vraie source de vérité des éditions utilisateur.
// On l'injecte dans la clé courante avant export.
document.getElementById("exportRanges")?.addEventListener("click", () => {
  const payload = { ...RANGES_BY_NAME };
  if (DRAFT) payload[currentRangeName] = DRAFT;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ranges.json";
  a.click();
  URL.revokeObjectURL(url);
});

// --- Export pack (pack courant uniquement) ---
document.getElementById("exportPack")?.addEventListener("click", () => {
  const payload = { [currentRangeName]: DRAFT ?? RANGES_BY_NAME[currentRangeName] };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pack_${currentRangeName}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// --- Import pack (ajoute un seul pack sans écraser les autres) ---
document.getElementById("importPack")?.addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      let parsed;
      try {
        parsed = JSON.parse(ev.target.result);
      } catch {
        alert("Import échoué : JSON invalide");
        return;
      }
      const keys = Object.keys(parsed);
      if (keys.length !== 1) {
        alert("Import échoué : le fichier doit contenir exactement un pack.");
        return;
      }
      const name = keys[0];
      if (RANGES_BY_NAME[name]) {
        alert(`Import annulé : un pack "${name}" existe déjà.`);
        return;
      }
      RANGES_BY_NAME[name] = parsed[name];
      currentRangeName = name;
      DRAFT = deepClone(RANGES_BY_NAME[currentRangeName]);
      localStorage.setItem(LS_DRAFT_KEY, JSON.stringify(DRAFT));
      localStorage.setItem(LS_CURRENT_RANGE_KEY, currentRangeName);
      saveRanges();
      refreshRangeSelector();
      updateContextBar();
      updateJsonPreview();
      render();
    };
    reader.readAsText(file);
  });
  input.click();
});

// --- Import ranges ---
document.getElementById("importRanges")?.addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        Object.keys(RANGES_BY_NAME).forEach(k => delete RANGES_BY_NAME[k]);
        Object.assign(RANGES_BY_NAME, parsed);
        if (!RANGES_BY_NAME[currentRangeName]) {
          currentRangeName = Object.keys(RANGES_BY_NAME)[0];
        }
        DRAFT = deepClone(RANGES_BY_NAME[currentRangeName]);
        localStorage.setItem(LS_DRAFT_KEY, JSON.stringify(DRAFT));
        saveRanges();
        refreshRangeSelector();
        updateContextBar();
        updateJsonPreview();
        render();
      } catch (e) {
        alert("Import échoué : JSON invalide");
      }
    };
    reader.readAsText(file);
  });
  input.click();
});

// --- Toggle VIEW / EDIT ---
const viewToggleBtn = document.createElement("button");
viewToggleBtn.id = "viewToggle";
document.getElementById("reset")?.insertAdjacentElement("afterend", viewToggleBtn);

function applyViewToggleStyle() {
  const isEdit = viewerMode === "edit";
  viewToggleBtn.textContent = isEdit ? "EDIT" : "VIEW";
  // M1 : VIEW = ambre (signal lecture seule), EDIT = bleu (signal actif/éditable)
  viewToggleBtn.style.background    = isEdit ? "#2563eb" : "rgba(251,191,36,0.15)";
  viewToggleBtn.style.color         = isEdit ? "#fff"    : "#fbbf24";
  viewToggleBtn.style.fontWeight    = "bold";
  viewToggleBtn.style.border        = isEdit ? "2px solid #2563eb" : "2px solid rgba(251,191,36,0.55)";
  viewToggleBtn.style.borderRadius  = "6px";
  viewToggleBtn.style.padding       = "4px 12px";
  viewToggleBtn.style.cursor        = "pointer";
  viewToggleBtn.title = isEdit ? "Passer en lecture seule (VIEW)" : "Activer l\u2019\u00e9dition (EDIT)";
}
applyViewToggleStyle();

viewToggleBtn.addEventListener("click", () => {
  viewerMode = viewerMode === "edit" ? "view" : "edit";
  applyViewToggleStyle();
});

// --- Navigation clavier position + stack (T10) ---
document.addEventListener("keydown", (e) => {
  const tag = document.activeElement?.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return;
  // T10: ArrowUp/Down — changer de stack
  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    e.preventDefault();
    shiftStack(e.key === "ArrowUp" ? -1 : 1);
    return;
  }
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  if (!schema) return;
  e.preventDefault();
  const cur = state.selection.selectedPosition;
  const idx = cur ? SEAT_ORDER.indexOf(cur) : -1;
  const n = SEAT_ORDER.length;
  const next = e.key === "ArrowLeft"
    ? SEAT_ORDER[(idx + 1 + n) % n]
    : SEAT_ORDER[(idx - 1 + n) % n];
  selectNode(next);
});

// --- Undo ---
const undoBtn = document.createElement("button");
undoBtn.id = "undoHand";
undoBtn.textContent = "Undo";
undoBtn.disabled = true;
document.getElementById("copyRange")?.insertAdjacentElement("afterend", undoBtn);
undoBtn.addEventListener("click", () => {
  if (!lastHandSnapshot) return;
  DRAFT[lastHandSnapshot.pos] = lastHandSnapshot.data;
  localStorage.setItem(LS_DRAFT_KEY, JSON.stringify(DRAFT));
  lastHandSnapshot = null;
  undoBtn.disabled = true;
  showFeedback("Undo effectué");
  updateJsonPreview();
  updateContextBar();
  render();
});

// --- Clear action ---
const clearActionBtn = document.createElement("button");
clearActionBtn.id = "clearAction";
clearActionBtn.textContent = "Clear action";
undoBtn.insertAdjacentElement("afterend", clearActionBtn);
clearActionBtn.addEventListener("click", () => {
  const seatId = state.selection.selectedPosition;
  const pos = seatId ? posFromSeatId(seatId) : null;
  if (!pos || !DRAFT?.[pos]) return;
  DRAFT[pos][activeAction] = [];
  localStorage.setItem(LS_DRAFT_KEY, JSON.stringify(DRAFT));
  showFeedback(`${pos} — action vidée`);
  updateJsonPreview();
  updateContextBar();
  render();
});

// --- Stack selector HUD ---

function setActiveStack(s) {
  activeStack = s;
  lastStackChangeTime = performance.now(); // T9: déclenche le fade HUD
  const sel = document.getElementById("stackSelector");
  if (sel) sel.value = s;
  // T18: historique des spots
  const _seatId = state.selection?.selectedPosition;
  const _pos = _seatId ? posFromSeatId(_seatId) : null;
  if (_pos) { lastSpots.push({ pos: _pos, stack: s, ts: Date.now() }); if (lastSpots.length > 30) lastSpots.shift(); }
  updateContextBar();
}

function openStackPopup(clientX, clientY) {
  const popup = document.getElementById("stackPopup");
  if (!popup) return;

  // Reconstruire les options à chaque ouverture (état actif peut avoir changé)
  popup.innerHTML = "";
  HUD_STACK_OPTIONS.forEach(s => {
    const isActive   = s === activeStack;
    const hasData    = s === "40bb" || !!STACK_DATA[s];
    const row = document.createElement("div");
    row.dataset.stack = s;
    row.style.cssText =
      "padding:6px 14px 6px 12px;cursor:pointer;display:flex;align-items:center;gap:7px;" +
      "border-radius:4px;font-size:12px;font-family:system-ui,sans-serif;" +
      "font-weight:" + (isActive ? "700" : "400") + ";" +
      "color:" + (isActive ? "#fbbf24" : hasData ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.40)") + ";";

    const label = document.createElement("span");
    label.textContent = s.toUpperCase();
    row.appendChild(label);

    if (!hasData) {
      const fb = document.createElement("span");
      fb.textContent = "fallback";
      fb.style.cssText = "font-size:9px;opacity:0.55;font-style:italic;";
      row.appendChild(fb);
    }
    if (isActive) {
      const dot = document.createElement("span");
      dot.textContent = "\u25cf";
      dot.style.cssText = "font-size:7px;color:#fbbf24;margin-left:auto;";
      row.appendChild(dot);
    }

    row.addEventListener("mouseenter", () => { row.style.background = "rgba(255,255,255,0.06)"; });
    row.addEventListener("mouseleave", () => { row.style.background = ""; });
    row.addEventListener("click", ev => {
      ev.stopPropagation();
      setActiveStack(s);
      popup.style.display = "none";
    });
    popup.appendChild(row);
  });

  // Positionner sous le curseur, recadré dans le viewport
  const PW = 148, PH = HUD_STACK_OPTIONS.length * 30 + 10;
  const vw = window.innerWidth, vh = window.innerHeight;
  let left = clientX - PW / 2;
  let top  = clientY + 6;
  if (left + PW > vw - 6) left = vw - PW - 6;
  if (left < 6) left = 6;
  if (top + PH > vh - 6) top = clientY - PH - 6;
  popup.style.left = left + "px";
  popup.style.top  = top  + "px";
  popup.style.display = "block";
}

document.addEventListener("click", (e) => {
  const popup = document.getElementById("stackPopup");
  if (popup && popup.style.display !== "none" && !popup.contains(e.target)) {
    popup.style.display = "none";
  }
});

// --- Notes de study par position ---

function openNotePanel(pos, clientX, clientY) {
  const panel = document.getElementById("notePanel");
  if (!panel) return;
  panel.dataset.pos = pos;
  document.getElementById("notePosLabel").textContent = pos;
  const ta = document.getElementById("noteTextarea");
  ta.value = NOTES[pos] || "";

  // Positionner près du curseur, recadré dans le viewport
  const PW = 232, PH = 170;
  const vw = window.innerWidth, vh = window.innerHeight;
  let left = clientX + 14;
  let top  = clientY - 16;
  if (left + PW > vw - 8) left = clientX - PW - 14;
  if (top + PH > vh - 8)  top  = vh - PH - 8;
  if (top < 8) top = 8;
  panel.style.left = left + "px";
  panel.style.top  = top  + "px";
  panel.style.display = "block";
  requestAnimationFrame(() => ta.focus());
}

function closeNotePanel() {
  const panel = document.getElementById("notePanel");
  if (panel) panel.style.display = "none";
}

// Clic droit sur le canvas principal — ouvre les notes de la position cliquée
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (!schema) return;
  const rect  = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top)  * scaleY;

  const nodes = (schema.scene?.nodes || [])
    .filter(n => n.id !== "table" && n.type === "shape.oval");
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (hitOval(px, py, nodes[i])) {
      const pos = labelFor(nodes[i]);
      if (pos) openNotePanel(pos, e.clientX, e.clientY);
      return;
    }
  }
});

// Auto-save note à chaque frappe
document.getElementById("noteTextarea")?.addEventListener("input", (e) => {
  const panel = document.getElementById("notePanel");
  const pos = panel?.dataset.pos;
  if (!pos) return;
  NOTES[pos] = e.target.value;
  localStorage.setItem(LS_NOTES_KEY, JSON.stringify(NOTES));
});

// Fermeture
document.getElementById("noteCloseBtn")?.addEventListener("click", closeNotePanel);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeNotePanel();
    const popup = document.getElementById("stackPopup");
    if (popup) popup.style.display = "none";
  }
});

document.addEventListener("click", (e) => {
  const panel = document.getElementById("notePanel");
  if (panel && panel.style.display !== "none" && !panel.contains(e.target)) {
    closeNotePanel();
  }
});

// --- Reset position ---
const resetPositionBtn = document.createElement("button");
resetPositionBtn.id = "resetPosition";
resetPositionBtn.textContent = "Reset position";
clearActionBtn.insertAdjacentElement("afterend", resetPositionBtn);
resetPositionBtn.addEventListener("click", () => {
  const seatId = state.selection.selectedPosition;
  const pos = seatId ? posFromSeatId(seatId) : null;
  if (!pos || !DRAFT?.[pos]) return;
  if (!confirm(`Réinitialiser toute la position ${pos} ?`)) return;
  DRAFT[pos].open = [];
  DRAFT[pos].call = [];
  DRAFT[pos].threebet = [];
  localStorage.setItem(LS_DRAFT_KEY, JSON.stringify(DRAFT));
  showFeedback(`${pos} réinitialisé`);
  updateJsonPreview();
  updateContextBar();
  render();
});

// --- T12: randomizeSpot (T7: filtre par difficultyLevel) ---
function randomizeSpot() {
  const _diffPos    = DIFFICULTY_POSITIONS[difficultyLevel] ?? POSITIONS;
  const randomPos   = _diffPos[Math.floor(Math.random() * _diffPos.length)];
  const randomStack = HUD_STACK_OPTIONS[Math.floor(Math.random() * HUD_STACK_OPTIONS.length)];
  setActiveStack(randomStack);
  const seatId = SEAT_ORDER[POSITIONS.indexOf(randomPos)];
  if (seatId && schema) selectNode(seatId);
}

// --- T14: loadRangePack ---
function loadRangePack(json) {
  if (!json || typeof json !== "object") return false;
  for (const pos of POSITIONS) {
    if (json[pos]) {
      if (!DRAFT[pos]) DRAFT[pos] = { open: [], call: [], threebet: [] };
      DRAFT[pos].open     = Array.isArray(json[pos].open)     ? json[pos].open     : [];
      DRAFT[pos].call     = Array.isArray(json[pos].call)     ? json[pos].call     : [];
      DRAFT[pos].threebet = Array.isArray(json[pos].threebet) ? json[pos].threebet : [];
    }
  }
  localStorage.setItem(LS_DRAFT_KEY, JSON.stringify(DRAFT));
  updateContextBar();
  showFeedback("Pack chargé");
  return true;
}

// --- T20: copyCurrentRange ---
function copyCurrentRange() {
  const seatId = state.selection?.selectedPosition;
  const pos    = seatId ? posFromSeatId(seatId) : null;
  if (!pos) { showFeedback("Aucune position sélectionnée"); return; }
  const r    = getActiveRange(pos);
  const text = JSON.stringify(r, null, 2);
  navigator.clipboard?.writeText(text)
    .then(() => showFeedback("Range copiée"))
    .catch(() => showFeedback("Copie échouée"));
}

// --- T10: shiftStack — navigation stack par clavier ---
function shiftStack(delta) {
  const idx = HUD_STACK_OPTIONS.indexOf(activeStack);
  const nextIdx = Math.max(0, Math.min(HUD_STACK_OPTIONS.length - 1, idx + delta));
  const next = HUD_STACK_OPTIONS[nextIdx];
  if (next && next !== activeStack) setActiveStack(next);
  render();
}

// --- T2: score persistance quiz ---
function loadQuizScore() {
  try {
    const saved = localStorage.getItem(LS_QUIZ_KEY);
    if (!saved) return;
    const d = JSON.parse(saved);
    if (typeof d.correct   === "number") quizCorrect   = d.correct;
    if (typeof d.incorrect === "number") quizIncorrect = d.incorrect;
    if (typeof d.streak    === "number") quizStreak    = d.streak;
  } catch { /* score corrompu — repartir de zero */ }
}

function saveQuizScore() {
  localStorage.setItem(LS_QUIZ_KEY, JSON.stringify({
    correct: quizCorrect, incorrect: quizIncorrect, streak: quizStreak,
  }));
}

// --- T5: daily training ---
function startDailyTraining() {
  const positions = DIFFICULTY_POSITIONS[difficultyLevel] ?? POSITIONS;
  dailySpots = Array.from({ length: DAILY_SIZE }, () => ({
    pos:    positions[Math.floor(Math.random() * positions.length)],
    stack:  HUD_STACK_OPTIONS[Math.floor(Math.random() * HUD_STACK_OPTIONS.length)],
    action: ["open", "call", "threebet"][Math.floor(Math.random() * 3)],
  }));
  dailyIdx    = 0;
  dailyActive = true;
  quizCorrect = 0; quizIncorrect = 0; quizMistakes = []; quizStreak = 0;
  applyDailySpot();
}

function applyDailySpot() {
  if (!dailyActive || dailyIdx >= dailySpots.length) {
    dailyActive = false;
    showFeedback(`Session terminee ! ${quizCorrect} / ${DAILY_SIZE} correctes`, 3000);
    render();
    return;
  }
  const { pos, stack, action } = dailySpots[dailyIdx];
  setActiveStack(stack);
  activeAction = action;
  document.querySelectorAll("[data-action]").forEach(b => {
    b.classList.toggle("active", b.dataset.action === activeAction);
  });
  const seatId = SEAT_ORDER[POSITIONS.indexOf(pos)];
  if (seatId && schema) selectNode(seatId);
  if (!quizMode) {
    quizMode = true;
    quizPickHand();
    if (typeof quizBtn !== "undefined") {
      quizBtn.style.background = "#0c4a6e";
      quizBtn.style.color      = "#7dd3fc";
      quizBtn.style.border     = "2px solid #38bdf8";
      quizBtn.style.fontWeight = "bold";
    }
  } else {
    quizPickHand();
  }
  render();
}

function nextDailySpot() {
  if (!dailyActive) return;
  dailyIdx++;
  applyDailySpot();
}

// --- T15: export session ---
function exportSession() {
  const data = {
    exported_at:  new Date().toISOString(),
    duration_s:   getSessionDuration(),
    quiz: {
      correct:   quizCorrect,
      incorrect: quizIncorrect,
      streak:    quizStreak,
      mistakes:  quizMistakes,
    },
    last_spots: lastSpots,
    draft:      DRAFT,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `minappli-session-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// --- T20: session timer ---
function getSessionDuration() {
  return Math.floor((Date.now() - sessionStartTime) / 1000);
}

