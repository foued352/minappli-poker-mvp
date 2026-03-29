"use strict";

/**
 * Ranges for mobile_fast_input.html
 * Stacks: 20bb / 25bb / 40bb
 *
 * MFI_RANGES_RAW  — OPEN (RFI) mode
 * MFI_VSOPEN_RAW  — VS OPEN mode (facing a raise)
 *
 * Design rules:
 *   UTG ⊆ HJ ⊆ CO ⊆ BTN  (opens strictly widen position by position)
 *   Suited hand sequences are contiguous — no gaps
 *   Offsuit requires the suited equivalent
 *   Shorter stack = tighter opens (you're committed when you open)
 *   BB uses vsopen mode only — RANGES["BB"] is unused
 *   UTG uses open mode only  — VSOPEN_RANGES["UTG"] is unused
 */

const MFI_RANGES_RAW = {

  /* ═══════════════════════════ 20bb ═══════════════════════════ */
  "20bb": {
    "UTG": {
      open: [
        "AA","KK","QQ","JJ","TT",
        "AKs","AQs",
        "AKo","AQo"
      ],
      call: [], threebet: []
    },
    "HJ": {
      open: [
        "AA","KK","QQ","JJ","TT","99","88",
        "AKs","AQs","AJs","ATs",
        "KQs",
        "AKo","AQo","AJo"
      ],
      call: [], threebet: []
    },
    "CO": {
      open: [
        "AA","KK","QQ","JJ","TT","99","88","77",
        "AKs","AQs","AJs","ATs","A9s",
        "KQs","KJs",
        "QJs",
        "AKo","AQo","AJo",
        "KQo"
      ],
      call: [], threebet: []
    },
    "BTN": {
      open: [
        "AA","KK","QQ","JJ","TT","99","88","77","66","55",
        "AKs","AQs","AJs","ATs","A9s","A8s","A7s",
        "KQs","KJs","KTs","K9s",
        "QJs","QTs","JTs","T9s","98s",
        "AKo","AQo","AJo","ATo","A9o",
        "KQo","KJo",
        "QJo","JTo"
      ],
      call: [], threebet: []
    },
    "SB": {
      open: [
        "AA","KK","QQ","JJ","TT","99","88","77","66",
        "AKs","AQs","AJs","ATs","A9s","A8s",
        "KQs","KJs","KTs",
        "QJs","JTs","T9s","98s",
        "AKo","AQo","AJo","ATo",
        "KQo","KJo"
      ],
      call: [], threebet: []
    },
    "BB": { open: [], call: [], threebet: [] }
  },

  /* ═══════════════════════════ 25bb ═══════════════════════════ */
  "25bb": {
    "UTG": {
      open: [
        "AA","KK","QQ","JJ","TT","99","88",
        "AKs","AQs","AJs","ATs",
        "KQs",
        "AKo","AQo","AJo"
      ],
      call: [], threebet: []
    },
    "HJ": {
      open: [
        "AA","KK","QQ","JJ","TT","99","88","77",
        "AKs","AQs","AJs","ATs","A9s",
        "KQs","KJs",
        "QJs",
        "AKo","AQo","AJo","ATo",
        "KQo","KJo"
      ],
      call: [], threebet: []
    },
    "CO": {
      open: [
        "AA","KK","QQ","JJ","TT","99","88","77","66",
        "AKs","AQs","AJs","ATs","A9s","A8s",
        "KQs","KJs","KTs",
        "QJs","QTs","JTs","T9s","98s",
        "AKo","AQo","AJo","ATo","A9o",
        "KQo","KJo","KTo",
        "QJo"
      ],
      call: [], threebet: []
    },
    "BTN": {
      open: [
        "AA","KK","QQ","JJ","TT","99","88","77","66","55","44","33",
        "AKs","AQs","AJs","ATs","A9s","A8s","A7s","A6s","A5s","A4s","A3s",
        "KQs","KJs","KTs","K9s","K8s","K7s",
        "QJs","QTs","Q9s","Q8s",
        "JTs","J9s","J8s",
        "T9s","T8s","T7s",
        "98s","97s","96s",
        "87s","86s","76s","75s","65s","54s","43s",
        "AKo","AQo","AJo","ATo","A9o","A8o","A7o","A6o",
        "KQo","KJo","KTo","K9o","K8o",
        "QJo","QTo","Q9o",
        "JTo","J9o",
        "T9o","T8o",
        "98o","87o","76o"
      ],
      call: [], threebet: []
    },
    "SB": {
      open: [
        "AA","KK","QQ","JJ","TT","99","88","77","66","55",
        "AKs","AQs","AJs","ATs","A9s","A8s","A7s","A6s","A5s",
        "KQs","KJs","KTs","K9s",
        "QJs","QTs","JTs","J9s","T9s","T8s","98s","97s","87s","76s","65s","54s",
        "AKo","AQo","AJo","ATo","A9o","A8o",
        "KQo","KJo","KTo",
        "QJo","JTo"
      ],
      call: [], threebet: []
    },
    "BB": { open: [], call: [], threebet: [] }
  },

  /* ═══════════════════════════ 40bb ═══════════════════════════ */
  "40bb": {
    "UTG": {
      open: [
        "AA","KK","QQ","JJ","TT","99","88","77",
        "AKs","AQs","AJs","ATs",
        "KQs",
        "QJs","JTs",
        "AKo","AQo","AJo"
      ],
      call: [], threebet: []
    },
    "HJ": {
      open: [
        "AA","KK","QQ","JJ","TT","99","88","77","66",
        "AKs","AQs","AJs","ATs","A9s",
        "KQs","KJs",
        "QJs","QTs","JTs","T9s",
        "AKo","AQo","AJo",
        "KQo","KJo"
      ],
      call: [], threebet: []
    },
    "CO": {
      open: [
        "AA","KK","QQ","JJ","TT","99","88","77","66","55",
        "AKs","AQs","AJs","ATs","A9s","A8s","A7s","A6s","A5s",
        "KQs","KJs","KTs",
        "QJs","QTs","JTs","J9s","T9s","T8s","98s","87s","76s","65s",
        "AKo","AQo","AJo","ATo",
        "KQo","KJo","KTo",
        "QJo","JTo"
      ],
      call: [], threebet: []
    },
    "BTN": {
      open: [
        "AA","KK","QQ","JJ","TT","99","88","77","66","55","44","33","22",
        "AKs","AQs","AJs","ATs","A9s","A8s","A7s","A6s","A5s","A4s","A3s","A2s",
        "KQs","KJs","KTs","K9s","K8s","K7s","K6s","K5s","K4s",
        "QJs","QTs","Q9s","Q8s","Q7s",
        "JTs","J9s","J8s","J7s",
        "T9s","T8s","T7s","T6s",
        "98s","97s","96s","95s",
        "87s","86s","85s","84s",
        "76s","75s","74s","73s",
        "65s","64s","54s","43s","32s",
        "AKo","AQo","AJo","ATo","A9o","A8o","A7o","A6o","A5o","A4o","A3o","A2o",
        "KQo","KJo","KTo","K9o","K8o","K7o","K6o",
        "QJo","QTo","Q9o","Q8o","Q7o",
        "JTo","J9o","J8o","J7o",
        "T9o","T8o","T7o","T6o",
        "98o","97o","96o","95o",
        "87o","86o","85o","84o",
        "76o","75o","65o","54o"
      ],
      call: [], threebet: []
    },
    "SB": {
      open: [
        "AA","KK","QQ","JJ","TT","99","88","77","66","55","44",
        "AKs","AQs","AJs","ATs","A9s","A8s","A7s","A6s","A5s","A4s",
        "KQs","KJs","KTs","K9s","K8s",
        "QJs","QTs","Q9s",
        "JTs","J9s","J8s",
        "T9s","T8s","T7s",
        "98s","97s","96s",
        "87s","86s","76s","75s","65s","54s",
        "AKo","AQo","AJo","ATo","A9o","A8o","A7o",
        "KQo","KJo","KTo","K9o",
        "QJo","QTo",
        "JTo","J9o",
        "T9o","T8o",
        "98o","87o","76o"
      ],
      call: [], threebet: []
    },
        "BB": { open: [], call: [], threebet: [] }
  }
};

/* ─────────────────────────────────────────────────────────────────────────
   VS OPEN ranges — facing a raise, what do I do?
   call    = flat call
   threebet = re-raise / 3bet
   (no open — never opening when facing a raise)

   Position tiers (tighter at short stacks — less room to call profitably):
   - At 20bb: mostly 3bet-or-fold, very few calls
   - At 25bb: selective calls with medium premiums
   - At 40bb: balanced call/3bet ranges, BTN/BB defend wide
───────────────────────────────────────────────────────────────────────── */

const MFI_VSOPEN_RAW = {

  /* ═══════════════════════════ 20bb ═══════════════════════════ */
  "20bb": {
    "UTG": { call: [], threebet: [] },
    "HJ": {
      call: [],
      threebet: ["AA","KK","QQ","JJ","AKs","AQs","AKo"]
    },
    "CO": {
      call: ["TT","99"],
      threebet: ["AA","KK","QQ","JJ","AKs","AQs","AKo","AQo"]
    },
    "BTN": {
      call: ["TT","99","88","AQs","AJs","KQs","KJs","QJs","JTs"],
      threebet: ["AA","KK","QQ","JJ","AKs","AQs","AKo","AQo"]
    },
    "SB": {
      call: [],
      threebet: ["AA","KK","QQ","JJ","TT","AKs","AQs","AKo","AQo"]
    },
    "BB": {
      call: [
        "JJ","TT","99","88","77","66","55","44","33","22",
        "AQs","AJs","ATs","A9s","A8s","A7s","A6s","A5s","A4s","A3s","A2s",
        "KQs","KJs","KTs","K9s","K8s","K7s",
        "QJs","QTs","Q9s","Q8s",
        "JTs","J9s","J8s",
        "T9s","T8s","T7s",
        "98s","97s","96s",
        "87s","86s","76s","65s","54s","43s",
        "AJo","ATo","A9o","A8o","A7o","A6o","A5o","A4o",
        "KQo","KJo","KTo","K9o","K8o",
        "QJo","QTo","Q9o",
        "JTo","J9o",
        "T9o","T8o","98o","87o","76o"
      ],
      threebet: ["AA","KK","QQ","AKs","AKo"]
    }
  },

  /* ═══════════════════════════ 25bb ═══════════════════════════ */
  "25bb": {
    "UTG": { call: [], threebet: [] },
    "HJ": {
      call: ["TT","99"],
      threebet: ["AA","KK","QQ","JJ","AKs","AKo"]
    },
    "CO": {
      call: ["TT","99","88","AQs","AJs","KQs","KJs","QJs"],
      threebet: ["AA","KK","QQ","JJ","AKs","AQs","AKo","AQo"]
    },
    "BTN": {
      call: [
        "99","88","77","66","55",
        "AJs","ATs","A9s","A8s",
        "KQs","KJs","KTs","QJs","QTs","JTs","J9s","T9s","T8s",
        "ATo","KQo","KJo"
      ],
      threebet: ["AA","KK","QQ","JJ","TT","AKs","AQs","A5s","AKo","AQo"]
    },
    "SB": {
      call: ["TT","99","AJs","ATs","KQs","KJs"],
      threebet: ["AA","KK","QQ","JJ","TT","AKs","AQs","A5s","AKo","AQo"]
    },
    "BB": {
      call: [
        "TT","99","88","77","66","55","44","33","22",
        "ATs","A9s","A8s","A7s","A6s","A5s","A4s","A3s","A2s",
        "KQs","KJs","KTs","K9s","K8s","K7s","K6s","K5s",
        "QJs","QTs","Q9s","Q8s","Q7s",
        "JTs","J9s","J8s","J7s",
        "T9s","T8s","T7s","T6s",
        "98s","97s","96s","95s",
        "87s","86s","85s","76s","75s","65s","64s","54s","53s","43s","32s",
        "AJo","ATo","A9o","A8o","A7o","A6o","A5o","A4o","A3o","A2o",
        "KQo","KJo","KTo","K9o","K8o",
        "QJo","QTo","Q9o",
        "JTo","J9o","J8o",
        "T9o","T8o","T7o",
        "98o","97o","87o","86o","76o","75o","65o","54o"
      ],
      threebet: ["AA","KK","QQ","JJ","TT","AKs","AQs","A5s","AKo","AQo"]
    }
  },

  /* ═══════════════════════════ 40bb ═══════════════════════════ */
  "40bb": {
    "UTG": { call: [], threebet: [] },
    "HJ": {
      call: ["JJ","TT","AQs","AJs","ATs","KQs","KJs","QJs","JTs"],
      threebet: ["AA","KK","QQ","AKs","AKo"]
    },
    "CO": {
      call: [
        "TT","99","88","77",
        "AJs","ATs","A9s",
        "KQs","KJs","KTs","QJs","QTs","JTs","J9s","T9s",
        "AJo","ATo","KQo"
      ],
      threebet: ["AA","KK","QQ","JJ","AKs","AQs","AKo","AQo"]
    },
    "BTN": {
      call: [
        "99","88","77","66","55","44","33","22",
        "AJs","ATs","A9s","A8s","A7s","A6s",
        "KQs","KJs","KTs","K9s","K8s",
        "QJs","QTs","Q9s",
        "JTs","J9s","J8s",
        "T9s","T8s","T7s",
        "98s","97s","87s","76s","65s",
        "AJo","ATo","A9o","KQo","KJo","QJo","JTo","T9o"
      ],
      threebet: ["AA","KK","QQ","JJ","TT","AKs","AQs","A5s","A4s","AKo","AQo"]
    },
    "SB": {
      call: ["TT","99","AQs","AJs","ATs","KQs","KJs","KTs","QJs","JTs","T9s"],
      threebet: ["AA","KK","QQ","JJ","AKs","AQs","A5s","AKo","AQo"]
    },
    "BB": {
      call: [
        "99","88","77","66","55","44","33","22",
        "ATs","A9s","A8s","A7s","A6s","A5s","A4s","A3s","A2s",
        "KQs","KJs","KTs","K9s","K8s","K7s","K6s","K5s",
        "QJs","QTs","Q9s","Q8s","Q7s",
        "JTs","J9s","J8s","J7s",
        "T9s","T8s","T7s","T6s",
        "98s","97s","96s",
        "87s","86s","85s","76s","75s","65s","64s","54s","43s",
        "AJo","ATo","A9o","A8o","A7o","A6o","A5o","A4o","A3o","A2o",
        "KQo","KJo","KTo","K9o","K8o",
        "QJo","QTo","Q9o",
        "JTo","J9o","J8o",
        "T9o","T8o","T7o",
        "98o","97o","87o","86o","76o"
      ],
      threebet: ["AA","KK","QQ","JJ","TT","AKs","AQs","AJs","A5s","A4s","A3s","AKo","AQo","AJo"]
    }
  }
};
