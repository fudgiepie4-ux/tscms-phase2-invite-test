'use strict';
/* ============================================================
   PART 1: SaloonEngine — pure game logic (Cherish)
   Tested: 93 passing. Includes findHints() + undo drawMode fix.
   ============================================================ */
const SaloonEngine = (() => {

  /* ----- Constants ----- */
  const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
  const SUIT_COLOR = { spades: 'black', hearts: 'red', diamonds: 'red', clubs: 'black' };
  const JOKER_DEFS = [
    { jokerId: 'radio', jokerName: 'TSCMS RADIO' },
    { jokerId: 'pug', jokerName: 'PUG WILD CARD' },
  ];

  /* ----- Private state ----- */
  let S = null;
  const listeners = [];
  function emit() {
    const snap = getState();
    listeners.forEach(cb => { try { cb(snap); } catch (e) { /* renderer error */ } });
  }

  /* ----- Deck ----- */
  function cardArtId(c) {
    if (c.isJoker) return 'joker-' + c.jokerId;
    return c.suit[0] + c.value; // h1..h13, s1.., d1.., c1..
  }
  function createDeck() {
    const deck = [];
    for (const suit of SUITS)
      for (let v = 1; v <= 13; v++)
        deck.push({ suit, value: v, color: SUIT_COLOR[suit],
                    faceUp: false, isJoker: false });
    for (const j of JOKER_DEFS)
      deck.push({ suit: null, value: null, color: null, faceUp: false,
                  isJoker: true, jokerId: j.jokerId, jokerName: j.jokerName,
                  standsFor: null });
    deck.forEach(c => { c.artId = cardArtId(c); });
    return deck; // 54 cards
  }
  /* Fisher-Yates — uniform. NEVER array.sort(() => Math.random()-0.5) (biased). */
  function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  /* ----- Deal (v4 Q4) ----- */
  function deal(st, deck) {
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        let card = deck.pop();
        // Face-up Joker in initial deal → bottom of stock, draw replacement.
        // Repeat if replacement is the other Joker (v4 Q4).
        while (card.isJoker) { deck.unshift(card); card = deck.pop(); }
        card.faceUp = (row === col);
        st.tableau[col].push(card);
      }
    }
    // Face-down Jokers dealt into tableau stay until uncovered (v4).
    st.stock = deck;
  }

  /* ----- History (undo) ----- */
  function snapshot(st) {
    return JSON.parse(JSON.stringify({
      stock: st.stock, waste: st.waste,
      foundations: st.foundations, tableau: st.tableau,
      moves: st.moves, elapsed: st.elapsed, startTime: st.startTime,
    }));
  }
  function saveHistory() {
    S.history.push(snapshot(S));
    if (S.history.length > 200) S.history.shift();
  }

  /* ----- Pure validators (take state, never mutate) ----- */

  /** Tableau: build down alternating colors; King-only to empty. Jokers never. */
  function canMoveToTableau(state, cards, col) {
    if (!cards.length) return false;
    const card = cards[0];
    if (card.isJoker) return false;
    const dest = state.tableau[col];
    const top = dest[dest.length - 1];
    if (!top) return card.value === 13;
    return top.faceUp && !top.isJoker &&
           top.color !== card.color && top.value === card.value + 1;
  }

  /** Dragged stack must itself be a valid descending alternating sequence. */
  function isValidSequence(cards) {
    return cards.every((card, i) => {
      if (i === 0) return true;
      const p = cards[i - 1];
      return !p.isJoker && !card.isJoker &&
             p.color !== card.color && p.value === card.value + 1;
    });
  }

  /** Can the player pick up tableau[col][idx]? (Jokers: foundation-only.) */
  function canPickUp(state, col, idx) {
    const pile = state.tableau[col];
    const card = pile[idx];
    if (!card || !card.faceUp || card.isJoker) return false;
    return isValidSequence(pile.slice(idx));
  }

  /** Is a face-up joker sitting on top of tableau[col]? (draggable to foundation) */
  function isTopJoker(state, col) {
    const pile = state.tableau[col];
    const top = pile[pile.length - 1];
    return !!(top && top.isJoker && top.faceUp);
  }

  /** What value does foundation fndIdx need next? (accounts for joker on top) */
  function foundationNeeds(state, fndIdx) {
    const pile = state.foundations[fndIdx];
    if (!pile.length) return 1;
    const top = pile[pile.length - 1];
    if (top.isJoker) return top.standsFor.value + 1;
    return top.value + 1;
  }

  /**
   * Foundation: build up by suit Ace→King, single cards only.
   * Joker: fills next needed slot; NO stacking (v3/v4).
   * Natural: normal sequential OR exact buried-joker match (v4 Q3 fix).
   */
  function canMoveToFoundation(state, card, fndIdx) {
    const pile = state.foundations[fndIdx];
    if (pile.length >= 13) return false;
    if (card.isJoker) {
      const top = pile[pile.length - 1];
      if (top && top.isJoker) return false; // NO JOKER STACKING
      return true;
    }
    if (card.suit !== SUITS[fndIdx]) return false;
    if (card.value === foundationNeeds(state, fndIdx)) return true;
    // v4 Q3: natural card matching a buried joker's exact position is legal
    return findMatchingJoker(state, fndIdx, card.suit, card.value) >= 0;
  }

  /** v4 Q3: index of the joker standing for exactly (suit, value), else -1. */
  function findMatchingJoker(state, fndIdx, suit, value) {
    const pile = state.foundations[fndIdx];
    for (let i = 0; i < pile.length; i++) {
      const c = pile[i];
      if (c.isJoker && c.standsFor &&
          c.standsFor.suit === suit && c.standsFor.value === value) return i;
    }
    return -1;
  }

  /** Auto-pick foundation for a joker: lowest need, skip full/stacked piles. */
  function pickJokerFoundation(state) {
    let best = -1, bestNeed = 99;
    for (let i = 0; i < 4; i++) {
      const pile = state.foundations[i];
      if (pile.length >= 13) continue;
      const top = pile[pile.length - 1];
      if (top && top.isJoker) continue;
      const need = foundationNeeds(state, i);
      if (need < bestNeed) { bestNeed = need; best = i; }
    }
    return best;
  }

  /* ----- Internal helpers (operate on live S) ----- */
  function noteFirstMove() {
    if (S.timerMode === 'stopwatch' && S.startTime === null)
      S.startTime = Date.now();
  }
  function flipTableauTop(col) {
    const pile = S.tableau[col];
    const top = pile[pile.length - 1];
    if (top && !top.faceUp) top.faceUp = true;
  }
  /** v4 Q1: win = 4 foundations × 13 positions, top represents King. */
  function checkWin() {
    const won = S.foundations.every(pile => {
      if (pile.length !== 13) return false;
      const top = pile[12];
      const rep = top.isJoker ? top.standsFor.value : top.value;
      return rep === 13;
    });
    if (won && !S.gameWon) { S.gameWon = true; }
  }

  /**
   * findHints() — Fudgie-approved v1 Hint feature.
   * Returns an ORDERED array of legal moves WITHOUT modifying any game state.
   * Priority: (1) tableau->foundation, (2) waste->foundation,
   *            (3) tableau->tableau that reveals a face-down card,
   *            (4) waste->tableau, (5) tableau->tableau (non-revealing).
   * If no moves but stock has cards (or waste can recycle): [{ action: 'draw' }].
   * If truly stuck: [].
   * Each move hint: { from, fromCol, card, to, toCol, toFoundation }
   */
  function findHints() {
    if (!S || S.gameWon) return [];
    const hints = [];

    // (1) tableau top -> foundation (incl. jokers via pickJokerFoundation)
    for (let c = 0; c < 7; c++) {
      const pile = S.tableau[c];
      const card = pile[pile.length - 1];
      if (!card || !card.faceUp) continue;
      if (card.isJoker) {
        const f = pickJokerFoundation(S);
        if (f >= 0) hints.push({
          from: 'tableau', fromCol: c, card,
          to: 'foundation', toCol: null, toFoundation: f,
        });
      } else {
        const f = SUITS.indexOf(card.suit);
        if (f >= 0 && canMoveToFoundation(S, card, f)) hints.push({
          from: 'tableau', fromCol: c, card,
          to: 'foundation', toCol: null, toFoundation: f,
        });
      }
    }

    // (2) waste top -> foundation (incl. jokers)
    const wtop = S.waste[S.waste.length - 1];
    if (wtop) {
      if (wtop.isJoker) {
        const f = pickJokerFoundation(S);
        if (f >= 0) hints.push({
          from: 'waste', fromCol: null, card: wtop,
          to: 'foundation', toCol: null, toFoundation: f,
        });
      } else {
        const f = SUITS.indexOf(wtop.suit);
        if (f >= 0 && canMoveToFoundation(S, wtop, f)) hints.push({
          from: 'waste', fromCol: null, card: wtop,
          to: 'foundation', toCol: null, toFoundation: f,
        });
      }
    }

    // (3) tableau -> tableau that REVEALS a face-down card
    // (5) tableau -> tableau (non-revealing) — collected separately, appended after (4)
    const revealing = [], nonRevealing = [];
    for (let from = 0; from < 7; from++) {
      const pile = S.tableau[from];
      for (let i = 0; i < pile.length; i++) {
        if (!canPickUp(S, from, i)) continue;
        const cards = pile.slice(i);
        for (let to = 0; to < 7; to++) {
          if (to === from) continue;
          if (!canMoveToTableau(S, cards, to)) continue;
          // Note: King moves to empty columns are legal and included,
          // even when strategically neutral — the player decides.
          const hint = {
            from: 'tableau', fromCol: from, fromIdx: i, card: cards[0],
            to: 'tableau', toCol: to, toFoundation: null,
          };
          // Revealing = there's a face-down card directly beneath the moved stack
          const below = pile[i - 1];
          if (below && !below.faceUp) revealing.push(hint);
          else nonRevealing.push(hint);
          break; // one destination per source is enough for hints
        }
      }
    }
    hints.push(...revealing);

    // (4) waste -> tableau
    if (wtop && !wtop.isJoker) {
      for (let to = 0; to < 7; to++) {
        if (canMoveToTableau(S, [wtop], to)) {
          hints.push({
            from: 'waste', fromCol: null, card: wtop,
            to: 'tableau', toCol: to, toFoundation: null,
          });
          break;
        }
      }
    }

    // (5) non-revealing tableau -> tableau
    hints.push(...nonRevealing);

    if (hints.length) return hints;
    // (6) Suggest drawing if possible
    if (S.stock.length || S.waste.length) return [{ action: 'draw' }];
    return [];
  }

  /* ----- Public API ----- */
  function newGame(timerMode, drawMode) {
    S = {
      stock: [], waste: [],
      foundations: [[], [], [], []],
      tableau: [[], [], [], [], [], [], []],
      moves: 0, history: [],
      timerMode: timerMode || 'stopwatch',
      drawMode: parseInt(drawMode, 10) === 3 ? 3 : 1,
      startTime: null, elapsed: 0,
      gameWon: false,
    };
    deal(S, shuffle(createDeck()));
    emit();
    return getState();
  }

  /** Serializable snapshot (safe to pass to renderer / postMessage). */
  function getState() {
    if (!S) return null;
    const snap = snapshot(S);
    snap.timerMode = S.timerMode;
    snap.drawMode = S.drawMode;
    snap.gameWon = S.gameWon;
    snap.canUndo = S.history.length > 0;
    return snap;
  }

  function onStateChange(cb) { listeners.push(cb); }

  function drawFromStock() {
    if (!S || S.gameWon) return false;
    if (!S.stock.length && !S.waste.length) return false;
    saveHistory(); noteFirstMove();
    if (S.stock.length) {
      const n = Math.min(S.drawMode, S.stock.length);
      for (let i = 0; i < n; i++) {
        const card = S.stock.pop();
        card.faceUp = true;
        S.waste.push(card);
      }
    } else {
      S.stock = S.waste.reverse().map(c => ({ ...c, faceUp: false }));
      S.waste = [];
    }
    S.moves++;
    emit();
    return true;
  }

  /**
   * Move top card of waste/tableau[col] to its foundation.
   * Handles joker placement + natural-card joker replacement (v4 Q2/Q3).
   */
  function moveToFoundation(from, col) {
    if (!S || S.gameWon) return false;
    let card;
    if (from === 'waste') {
      card = S.waste[S.waste.length - 1];
      if (!card) return false;
    } else {
      const pile = S.tableau[col];
      card = pile[pile.length - 1];
      if (!card || !card.faceUp) return false;
    }
    const fndIdx = card.isJoker ? pickJokerFoundation(S) : SUITS.indexOf(card.suit);
    if (fndIdx < 0 || !canMoveToFoundation(S, card, fndIdx)) return false;

    saveHistory(); noteFirstMove();
    if (from === 'waste') S.waste.pop(); else S.tableau[col].pop();

    if (card.isJoker) {
      card.standsFor = { suit: SUITS[fndIdx], value: foundationNeeds(S, fndIdx) };
      S.foundations[fndIdx].push(card);
    } else {
      const ji = findMatchingJoker(S, fndIdx, card.suit, card.value);
      if (ji >= 0) {
        // v4 Q3: replace the exact matching joker
        const freed = S.foundations[fndIdx][ji];
        freed.standsFor = null;
        freed.faceUp = true;
        S.foundations[fndIdx][ji] = card;
        // v4 Q2: freed joker → top of waste pile
        S.waste.push(freed);
      } else {
        S.foundations[fndIdx].push(card);
      }
    }
    S.moves++;
    if (from === 'tableau') flipTableauTop(col);
    checkWin();
    emit();
    return true;
  }

  /**
   * Move top card of waste/tableau[col] to a SPECIFIC foundation
   * (used by drag-and-drop onto a foundation pile).
   */
  function moveToSpecificFoundation(from, col, fndIdx) {
    if (!S || S.gameWon) return false;
    let card;
    if (from === 'waste') {
      card = S.waste[S.waste.length - 1];
      if (!card) return false;
    } else {
      const pile = S.tableau[col];
      card = pile[pile.length - 1];
      if (!card || !card.faceUp) return false;
    }
    if (!canMoveToFoundation(S, card, fndIdx)) return false;
    saveHistory(); noteFirstMove();
    if (from === 'waste') S.waste.pop(); else S.tableau[col].pop();
    if (card.isJoker) {
      card.standsFor = { suit: SUITS[fndIdx], value: foundationNeeds(S, fndIdx) };
      S.foundations[fndIdx].push(card);
    } else {
      const ji = findMatchingJoker(S, fndIdx, card.suit, card.value);
      if (ji >= 0) {
        const freed = S.foundations[fndIdx][ji];
        freed.standsFor = null; freed.faceUp = true;
        S.foundations[fndIdx][ji] = card;
        S.waste.push(freed);
      } else {
        S.foundations[fndIdx].push(card);
      }
    }
    S.moves++;
    if (from === 'tableau') flipTableauTop(col);
    checkWin();
    emit();
    return true;
  }

  function moveTableauToTableau(fromCol, fromIdx, toCol) {
    if (!S || S.gameWon || fromCol === toCol) return false;
    const cards = S.tableau[fromCol].slice(fromIdx);
    if (!isValidSequence(cards)) return false;
    if (!canMoveToTableau(S, cards, toCol)) return false;
    saveHistory(); noteFirstMove();
    S.tableau[fromCol] = S.tableau[fromCol].slice(0, fromIdx);
    S.tableau[toCol] = S.tableau[toCol].concat(cards);
    S.moves++;
    flipTableauTop(fromCol);
    checkWin();
    emit();
    return true;
  }

  function moveWasteToTableau(toCol) {
    if (!S || S.gameWon) return false;
    const card = S.waste[S.waste.length - 1];
    if (!card || card.isJoker) return false;
    if (!canMoveToTableau(S, [card], toCol)) return false;
    saveHistory(); noteFirstMove();
    S.waste.pop();
    S.tableau[toCol].push(card);
    S.moves++;
    checkWin();
    emit();
    return true;
  }

  function undo() {
    if (!S || !S.history.length) return false;
    const prev = S.history.pop();
    const keepTimerMode = S.timerMode;
    const keepDrawMode = S.drawMode;
    // P1 fix (Clara v7 review, 2026-10-16): preserve current timer on undo
    // Snapshots contain outdated startTime/elapsed (e.g. from 24h ago).
    // Restoring them causes wild time jumps (1:10→1:50, 0:33→24:00:33).
    // Undo restores cards/moves/history only; timer keeps running accurately.
    const keepElapsed = S.elapsed;
    const keepStartTime = S.startTime;
    S.stock = prev.stock; S.waste = prev.waste;
    S.foundations = prev.foundations; S.tableau = prev.tableau;
    S.moves = prev.moves;
    S.elapsed = keepElapsed;
    S.startTime = keepStartTime;
    S.gameWon = false;
    S.timerMode = keepTimerMode;
    S.drawMode = keepDrawMode;
    emit();
    return true;
  }

  /** For tests: replace live state. */
  function _setState(s) { S = s; }
  function _getState() { return S; }

  return {
    newGame, getState, onStateChange,
    drawFromStock, moveToFoundation, moveToSpecificFoundation,
    moveTableauToTableau, moveWasteToTableau, undo,
    canMoveToTableau, isValidSequence, canPickUp, isTopJoker,
    canMoveToFoundation, foundationNeeds, findMatchingJoker, pickJokerFoundation,
    findHints,
    SUITS, JOKER_DEFS,
    _setState, _getState,
  };
})();