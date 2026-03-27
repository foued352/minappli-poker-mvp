/* ═══════════════════════════════════════════════════════════════════
   MVP POKER RANGES — single source of truth
   Edit this file to update range decisions.

   Structure: RANGES_RAW[stack][spotKey] = { open, call, threebet }
   A hand absent from all three = FOLD.
   A hand in multiple arrays = multi-action (shows chips).

   spotKey format:
     RFI      → "UTG" | "HJ" | "CO" | "BTN" | "SB"
     vs open  → "HJ_vs_UTG" | "CO_vs_UTG" | "CO_vs_HJ"
                "BTN_vs_UTG" | "BTN_vs_HJ" | "BTN_vs_CO"
                "SB_vs_UTG"  | "SB_vs_HJ"  | "SB_vs_CO"  | "SB_vs_BTN"
                "BB_vs_UTG"  | "BB_vs_HJ"  | "BB_vs_CO"  | "BB_vs_BTN" | "BB_vs_SB"

   Stacks: "20bb" | "40bb"
   Note: BB has no RFI spot. SB premiums (AA/KK/QQ/JJ/AKs/AKo)
         appear in both open and threebet for SB RFI.
   ═══════════════════════════════════════════════════════════════════ */
const RANGES_RAW = {

  /* ══════════ 40bb ══════════ */
  "40bb": {

    /* ── RFI (unopened pot) ── */
    UTG: {
      open: [
        "AA","KK","QQ","JJ","TT","99","88","77","66","55","44","33","22",
        "AKs","AQs","AJs","ATs","A9s","A8s","A7s","A6s","A5s","A4s","A3s","A2s",
        "KQs","KJs","KTs","K9s","K8s",
        "QJs","QTs","Q9s",
        "JTs","J9s","T9s","T8s","98s","87s","76s",
        "AKo","AQo","AJo","ATo","KQo","KJo"
      ],
      call: [], threebet: []
    },
    HJ: {
      open: [
        "AA","KK","QQ","JJ","TT","99","88","77","66","55","44","33","22",
        "AKs","AQs","AJs","ATs","A9s","A8s","A7s","A6s","A5s","A4s","A3s","A2s",
        "KQs","KJs","KTs","K9s","K8s","K7s",
        "QJs","QTs","Q9s","Q8s",
        "JTs","J9s","J8s","T9s","T8s","98s","97s","87s","76s","65s","54s",
        "AKo","AQo","AJo","ATo","A9o",
        "KQo","KJo","KTo","QJo"
      ],
      call: [], threebet: []
    },
    CO: {
      open: [
        "AA","KK","QQ","JJ","TT","99","88","77","66","55","44","33","22",
        "AKs","AQs","AJs","ATs","A9s","A8s","A7s","A6s","A5s","A4s","A3s","A2s",
        "KQs","KJs","KTs","K9s","K8s","K7s","K6s","K5s",
        "QJs","QTs","Q9s","Q8s","Q7s",
        "JTs","J9s","J8s","J7s","T9s","T8s","T7s","98s","97s","87s","86s","76s","75s","65s","64s","54s","53s","43s",
        "AKo","AQo","AJo","ATo","A9o","A8o",
        "KQo","KJo","KTo","K9o",
        "QJo","QTo","JTo"
      ],
      call: [], threebet: []
    },
    BTN: {
      open: [
        "AA","KK","QQ","JJ","TT","99","88","77","66","55","44","33","22",
        "AKs","AQs","AJs","ATs","A9s","A8s","A7s","A6s","A5s","A4s","A3s","A2s",
        "KQs","KJs","KTs","K9s","K8s","K7s","K6s","K5s","K4s","K3s","K2s",
        "QJs","QTs","Q9s","Q8s","Q7s","Q6s","Q5s",
        "JTs","J9s","J8s","J7s","J6s",
        "T9s","T8s","T7s","T6s","98s","97s","96s","87s","86s","85s","76s","75s","74s","65s","64s","54s","53s","43s","42s","32s",
        "AKo","AQo","AJo","ATo","A9o","A8o","A7o","A6o","A5o","A4o","A3o",
        "KQo","KJo","KTo","K9o","K8o","K7o",
        "QJo","QTo","Q9o","JTo","J9o","T9o","98o","87o","76o"
      ],
      call: [], threebet: []
    },
    SB: {
      open: [
        "AA","KK","QQ","JJ","TT","99","88","77","66","55","44","33","22",
        "AKs","AQs","AJs","ATs","A9s","A8s","A7s","A6s","A5s","A4s","A3s","A2s",
        "KQs","KJs","KTs","K9s","K8s","K7s","K6s","K5s","K4s",
        "QJs","QTs","Q9s","Q8s","Q7s",
        "JTs","J9s","J8s","J7s","T9s","T8s","T7s","98s","97s","87s","86s","76s","75s","65s","54s","43s","32s",
        "AKo","AQo","AJo","ATo","A9o","A8o","A7o","A6o","A5o",
        "KQo","KJo","KTo","K9o","K8o",
        "QJo","QTo","Q9o","JTo","J9o","T9o","98o"
      ],
      call: [],
      /* Premium SB hands: OPEN first-in AND 3BET facing any open */
      threebet: ["AA","KK","QQ","JJ","AKs","AKo"]
    },

    /* ── vs open: IP spots ── */
    HJ_vs_UTG: {
      open: [],
      call:     ["TT","99","88","AQs","AJs","ATs","KQs","KJs","QJs","JTs","AQo","KQo"],
      threebet: ["AA","KK","QQ","JJ","AKs","AKo","A5s","A4s"]
    },
    CO_vs_UTG: {
      open: [],
      call:     ["TT","99","88","77","AQs","AJs","ATs","KQs","KJs","QJs","JTs","T9s","AQo","AJo","KQo","KJo"],
      threebet: ["AA","KK","QQ","JJ","AKs","AKo","A5s","A4s"]
    },
    CO_vs_HJ: {
      open: [],
      call:     ["TT","99","88","77","AQs","AJs","ATs","KQs","KJs","KTs","QJs","JTs","T9s","AQo","AJo","KQo","KJo"],
      threebet: ["AA","KK","QQ","JJ","AKs","AKo","AQs","A5s","A4s"]
    },
    BTN_vs_UTG: {
      open: [],
      call:     ["99","88","77","66","55","AJs","ATs","A9s","KQs","KJs","KTs","QJs","QTs","JTs","J9s","T9s","98s","AJo","ATo","KQo","KJo","QJo"],
      threebet: ["AA","KK","QQ","JJ","TT","AKs","AKo","AQs","A5s","A4s","K5s"]
    },
    BTN_vs_HJ: {
      open: [],
      call:     ["99","88","77","66","55","AJs","ATs","A9s","KQs","KJs","KTs","QJs","QTs","JTs","J9s","T9s","T8s","98s","AJo","ATo","KQo","KJo","QJo","JTo"],
      threebet: ["AA","KK","QQ","JJ","TT","AKs","AKo","AQs","A5s","A4s","K5s","Q5s"]
    },
    BTN_vs_CO: {
      open: [],
      call:     ["88","77","66","55","44","ATs","A9s","A8s","KQs","KJs","KTs","K9s","QJs","QTs","JTs","J9s","T9s","T8s","98s","87s","ATo","A9o","KQo","KJo","KTo","QJo","JTo"],
      threebet: ["AA","KK","QQ","JJ","TT","99","AKs","AKo","AQs","AJs","A5s","A4s","A3s","K5s","Q5s"]
    },

    /* ── vs open: OOP spots ── */
    SB_vs_UTG: {
      open: [],
      call:     ["TT","99","AQs","KQs"],
      threebet: ["AA","KK","QQ","JJ","AKs","AKo","A5s","A4s"]
    },
    SB_vs_HJ: {
      open: [],
      call:     ["TT","99","88","AQs","AJs","KQs"],
      threebet: ["AA","KK","QQ","JJ","AKs","AKo","A5s","A4s"]
    },
    SB_vs_CO: {
      open: [],
      call:     ["99","88","77","AQs","AJs","KQs","KJs"],
      threebet: ["AA","KK","QQ","JJ","TT","AKs","AKo","AQs","A5s","A4s","A3s"]
    },
    SB_vs_BTN: {
      open: [],
      call:     ["99","88","77","66","AJs","ATs","KQs","KJs","QJs","JTs","AQo","AJo","KQo"],
      threebet: ["AA","KK","QQ","JJ","TT","AKs","AKo","AQs","A5s","A4s","A3s"]
    },
    BB_vs_UTG: {
      open: [],
      call:     ["TT","99","88","77","66","55","AQs","AJs","ATs","KQs","KJs","KTs","QJs","JTs","AQo","AJo","KQo","KJo"],
      threebet: ["AA","KK","QQ","JJ","AKs","AKo","A4s","A3s","54s"]
    },
    BB_vs_HJ: {
      open: [],
      call:     ["TT","99","88","77","66","55","AQs","AJs","ATs","KQs","KJs","KTs","QJs","QTs","JTs","T9s","AQo","AJo","ATo","KQo","KJo"],
      threebet: ["AA","KK","QQ","JJ","AKs","AKo","A5s","A4s","65s","54s"]
    },
    BB_vs_CO: {
      open: [],
      call:     ["99","88","77","66","55","AQs","AJs","ATs","A9s","KQs","KJs","KTs","QJs","QTs","JTs","T9s","98s","AQo","AJo","ATo","KQo","KJo"],
      threebet: ["AA","KK","QQ","JJ","TT","AKs","AKo","A5s","A4s","A3s","65s","54s","43s"]
    },
    BB_vs_BTN: {
      open: [],
      call:     ["99","88","77","66","55","AQs","AJs","ATs","A9s","A8s","A7s","A6s","KQs","KJs","KTs","QJs","QTs","JTs","T9s","98s","87s","76s","AQo","AJo","ATo","KQo","KJo"],
      threebet: ["AA","KK","QQ","JJ","TT","AKs","AKo","A5s","A4s","A3s","65s","54s","43s"]
    },
    BB_vs_SB: {
      open: [],
      call:     ["88","77","66","55","44","33","22","AJs","ATs","A9s","A8s","A7s","A6s","KQs","KJs","KTs","K9s","QJs","QTs","JTs","T9s","98s","87s","76s","AQo","AJo","ATo","A9o","KQo","KJo","KTo","QJo"],
      threebet: ["AA","KK","QQ","JJ","TT","99","AKs","AKo","AQs","A5s","A4s","A3s","A2s","65s","54s","43s"]
    }
  },

  /* ══════════ 20bb ══════════ */
  "20bb": {

    /* ── RFI (unopened pot) ── */
    UTG: {
      open: [
        "AA","KK","QQ","JJ","TT","99","88","77","66","55","44","33","22",
        "AKs","AQs","AJs","ATs","A9s","A8s","A7s","A6s","A5s","A4s","A3s","A2s",
        "KQs","KJs","KTs","K9s","K8s",
        "QJs","QTs","Q9s",
        "JTs","J9s","T9s","T8s","98s","87s","76s",
        "AKo","AQo","AJo","ATo","KQo","KJo"
      ],
      call: [], threebet: []
    },
    HJ: {
      open: [
        "AA","KK","QQ","JJ","TT","99","88","77","66","55","44","33","22",
        "AKs","AQs","AJs","ATs","A9s","A8s","A7s","A6s","A5s","A4s","A3s","A2s",
        "KQs","KJs","KTs","K9s","K8s","K7s",
        "QJs","QTs","Q9s","Q8s",
        "JTs","J9s","J8s","T9s","T8s","98s","97s","87s","76s","65s","54s",
        "AKo","AQo","AJo","ATo","A9o",
        "KQo","KJo","KTo","QJo"
      ],
      call: [], threebet: []
    },
    CO: {
      open: [
        "AA","KK","QQ","JJ","TT","99","88","77","66","55","44","33","22",
        "AKs","AQs","AJs","ATs","A9s","A8s","A7s","A6s","A5s","A4s","A3s","A2s",
        "KQs","KJs","KTs","K9s","K8s","K7s","K6s","K5s",
        "QJs","QTs","Q9s","Q8s","Q7s",
        "JTs","J9s","J8s","J7s","T9s","T8s","T7s","98s","97s","87s","86s","76s","75s","65s","64s","54s",
        "AKo","AQo","AJo","ATo","A9o","A8o",
        "KQo","KJo","KTo","K9o",
        "QJo","QTo","JTo"
      ],
      call: [], threebet: []
    },
    BTN: {
      /* 20bb: drop thin suited (85s,74s,64s,53s,43s,42s,32s)
               drop thin offsuit (A4o,A3o,K7o,98o,87o,76o) */
      open: [
        "AA","KK","QQ","JJ","TT","99","88","77","66","55","44","33","22",
        "AKs","AQs","AJs","ATs","A9s","A8s","A7s","A6s","A5s","A4s","A3s","A2s",
        "KQs","KJs","KTs","K9s","K8s","K7s","K6s","K5s","K4s","K3s","K2s",
        "QJs","QTs","Q9s","Q8s","Q7s","Q6s","Q5s",
        "JTs","J9s","J8s","J7s","J6s",
        "T9s","T8s","T7s","T6s","98s","97s","96s","87s","86s","76s","75s","65s","54s",
        "AKo","AQo","AJo","ATo","A9o","A8o","A7o","A6o","A5o",
        "KQo","KJo","KTo","K9o","K8o",
        "QJo","QTo","Q9o","JTo","J9o","T9o"
      ],
      call: [], threebet: []
    },
    SB: {
      /* 20bb: drop 43s, 32s (suited), 98o (offsuit) */
      open: [
        "AA","KK","QQ","JJ","TT","99","88","77","66","55","44","33","22",
        "AKs","AQs","AJs","ATs","A9s","A8s","A7s","A6s","A5s","A4s","A3s","A2s",
        "KQs","KJs","KTs","K9s","K8s","K7s","K6s","K5s","K4s",
        "QJs","QTs","Q9s","Q8s","Q7s",
        "JTs","J9s","J8s","J7s","T9s","T8s","T7s","98s","97s","87s","86s","76s","75s","65s","54s",
        "AKo","AQo","AJo","ATo","A9o","A8o","A7o","A6o","A5o",
        "KQo","KJo","KTo","K9o","K8o",
        "QJo","QTo","Q9o","JTo","J9o","T9o"
      ],
      call: [],
      threebet: ["AA","KK","QQ","JJ","AKs","AKo"]
    },

    /* ── vs open: IP spots ── */
    HJ_vs_UTG: {
      open: [],
      call:     ["TT","99","AQs","AJs","KQs","AQo"],
      threebet: ["AA","KK","QQ","JJ","AKs","AKo","A5s"]
    },
    CO_vs_UTG: {
      open: [],
      call:     ["TT","99","88","AQs","AJs","KQs","KJs","QJs","JTs","AQo","KQo"],
      threebet: ["AA","KK","QQ","JJ","AKs","AKo","A5s"]
    },
    CO_vs_HJ: {
      open: [],
      call:     ["TT","99","88","AQs","AJs","KQs","KJs","QJs","JTs","AQo","KQo"],
      threebet: ["AA","KK","QQ","JJ","AKs","AKo","AQs","A5s"]
    },
    BTN_vs_UTG: {
      open: [],
      call:     ["99","88","77","66","AJs","ATs","KQs","KJs","QJs","JTs","T9s","AJo","KQo","KJo"],
      threebet: ["AA","KK","QQ","JJ","TT","AKs","AKo","AQs","A5s","K5s"]
    },
    BTN_vs_HJ: {
      open: [],
      call:     ["99","88","77","66","AJs","ATs","KQs","KJs","QJs","JTs","T9s","AJo","KQo","KJo","QJo"],
      threebet: ["AA","KK","QQ","JJ","TT","AKs","AKo","AQs","A5s","K5s"]
    },
    BTN_vs_CO: {
      open: [],
      call:     ["88","77","66","55","ATs","A9s","KQs","KJs","KTs","QJs","QTs","JTs","T9s","98s","ATo","KQo","KJo","QJo"],
      threebet: ["AA","KK","QQ","JJ","TT","99","AKs","AKo","AQs","AJs","A5s","A4s","K5s"]
    },

    /* ── vs open: OOP spots ── */
    SB_vs_UTG: {
      open: [],
      call:     ["TT","99","AQs","KQs"],
      threebet: ["AA","KK","QQ","JJ","AKs","AKo","A5s"]
    },
    SB_vs_HJ: {
      open: [],
      call:     ["TT","99","AQs","AJs","KQs"],
      threebet: ["AA","KK","QQ","JJ","AKs","AKo","A5s"]
    },
    SB_vs_CO: {
      open: [],
      call:     ["99","88","AQs","KQs","KJs"],
      threebet: ["AA","KK","QQ","JJ","TT","AKs","AKo","A5s","A4s"]
    },
    SB_vs_BTN: {
      open: [],
      call:     ["99","88","77","AQs","AJs","KQs","KJs","AQo","KQo"],
      threebet: ["AA","KK","QQ","JJ","TT","AKs","AKo","A5s","A4s"]
    },
    BB_vs_UTG: {
      open: [],
      call:     ["TT","99","88","77","AQs","AJs","ATs","KQs","KJs","QJs","JTs","AQo","AJo","KQo"],
      threebet: ["AA","KK","QQ","JJ","AKs","AKo","A4s"]
    },
    BB_vs_HJ: {
      open: [],
      call:     ["TT","99","88","77","66","AQs","AJs","ATs","KQs","KJs","QJs","JTs","AQo","AJo","KQo","KJo"],
      threebet: ["AA","KK","QQ","JJ","AKs","AKo","A5s","A4s","54s"]
    },
    BB_vs_CO: {
      open: [],
      call:     ["99","88","77","66","AQs","AJs","ATs","KQs","KJs","QJs","JTs","T9s","AQo","AJo","KQo"],
      threebet: ["AA","KK","QQ","JJ","TT","AKs","AKo","A5s","A4s","65s","54s"]
    },
    BB_vs_BTN: {
      /* same as previous 20bb BB data */
      open: [],
      call:     ["99","88","77","66","AQs","AJs","ATs","KQs","KJs","KTs","QJs","QTs","JTs","T9s","AQo","AJo","KQo"],
      threebet: ["AA","KK","QQ","JJ","TT","AKs","AKo","A5s","A4s","65s","54s"]
    },
    BB_vs_SB: {
      open: [],
      call:     ["88","77","66","55","44","AJs","ATs","A9s","A8s","KQs","KJs","KTs","QJs","QTs","JTs","T9s","98s","AQo","AJo","ATo","KQo","KJo"],
      threebet: ["AA","KK","QQ","JJ","TT","99","AKs","AKo","AQs","A5s","A4s","65s","54s"]
    }
  }
};
