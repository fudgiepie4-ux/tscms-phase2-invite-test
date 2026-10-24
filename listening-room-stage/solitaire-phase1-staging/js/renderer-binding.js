/* ============================================================
   Solitaire Renderer Binding (Cherish)
   Connects SaloonEngine to Clara's Phase 1 DOM scaffold.
   
   Renders LIVE cards from engine state as DOM elements positioned
   over Clara's approved saloon background. The background image
   contains painted cards — these live cards cover/replace them.
   
   Contract IDs (from 03_ID_MANIFEST.json):
   stock-pile, waste-pile, foundation-0..3, tableau-0..6,
   btn-undo, btn-hint, btn-pause, btn-newgame, btn-menu,
   timer-display, move-counter,
   pause-screen, pause-message, pause-resume,
   pause-choices, pause-continue, pause-newgame
   ============================================================ */
'use strict';

const RendererBinding = (() => {
  
  /* ----- P0 fix (Clara review): Module-scope helpers for New Game ----- */
  /* These must be accessible from all button handlers, not nested in wireButtons() */
  function getSavedPrefs() {
    let timerMode = 'stopwatch', drawMode = 1;
    if (typeof SessionManager !== 'undefined' && SessionManager.getPrefs) {
      const prefs = SessionManager.getPrefs() || {};
      if (prefs.timerMode) timerMode = prefs.timerMode;
      if (prefs.drawMode) drawMode = prefs.drawMode;
    }
    return { timerMode, drawMode };
  }
  
  function resetVictoryOnNewGame() {
    if (typeof VictoryDicey !== 'undefined' && VictoryDicey.resetVictoryState) {
      VictoryDicey.resetVictoryState();
    }
  }
  
  // Card dimensions (relative to pile container)
  const CARD_W = 100;  // percent of pile width
  // Tableau fan offset scales with stage width (Clara's review)
  function getCardOverlap(pileDepth) {
    try {
      let base = 28;
      if (typeof document.querySelector === 'function') {
        const stage = document.querySelector('.stage');
        if (stage) {
          const w = stage.offsetWidth || 390;
          base = Math.max(18, Math.min(36, Math.round(w * 0.07)));
        }
      }
      // Compress for deep piles to prevent clipping (Clara's v3 review)
      if (pileDepth && pileDepth > 10) {
        const maxH = (typeof window !== 'undefined' ? window.innerHeight : 700) * 0.35;
        const compressed = Math.floor(maxH / pileDepth);
        return Math.max(12, Math.min(base, compressed));
      }
      return base;
    } catch (e) { /* test env */ }
    return 28; // fallback
  }
  
  // Selection state
  let selected = null;  // { from, col, idx } or null
  
  // Long-press state
  let longPressTimer = null;
  const LONG_PRESS_MS = 500;
  
  // Double-tap state
  let lastTapByCard = {};  // cardId -> timestamp
  const DOUBLE_TAP_MS = 350;
  
  /* ----- Card identity ----- */
  function cardId(card) {
    if (card.isJoker) return 'joker-' + (card.jokerId || card.id || 'x');
    return (card.suit || '?') + '-' + (card.value || '?');
  }

  /* ----- Hint visual feedback (P1 fix 2026-10-17: listener was console.log only) ----- */
  function pulseEl(el) {
    if (!el || !el.style) return;
    el.style.outline = '3px solid #ffd75e';
    el.style.outlineOffset = '2px';
    setTimeout(() => {
      el.style.outline = '';
      el.style.outlineOffset = '';
    }, 1800);
  }

  let hintToastTimer = null;
  function showHintToast(msg) {
    let toast = document.getElementById('hint-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'hint-toast';
      toast.style.cssText = 'position:fixed;left:50%;bottom:18%;transform:translateX(-50%);' +
        'background:rgba(20,12,4,0.92);color:#f5e6c8;border:2px solid #c9a227;border-radius:10px;' +
        'padding:10px 16px;font-size:15px;z-index:9999;pointer-events:none;text-align:center;' +
        'max-width:82vw;';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.display = 'block';
    if (hintToastTimer) clearTimeout(hintToastTimer);
    hintToastTimer = setTimeout(() => { toast.style.display = 'none'; }, 2500);
  }

  function describeHint(h) {
    if (h.action === 'draw') return 'draw from the stock pile';
    const c = h.card || {};
    if (c.isJoker) return 'Joker';
    const faces = { 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' };
    const rank = faces[c.value] || String(c.value || '');
    return (rank + ' of ' + (c.suit || '')).trim() + (h.to ? ' → ' + h.to : '');
  }
  
  function cardArtPath(card) {
    // Use artId if available (maps to solitaire-phase1-staging/card-art/)
    if (card.artId) return 'solitaire-phase1-staging/card-art/' + card.artId + '.png';
    return null;
  }
  
  // Art cache (full-render flash fix, 2026-10-18; pin fix 2026-10-18):
  // Maps artPath -> loaded HTMLImageElement. Keeping the Image objects alive
  // pins their decoded bitmaps in memory, so re-applying art to a rebuilt
  // card is truly synchronous — the S24 was evicting decoded PNGs (GC of the
  // temporary Image), causing a white-text flash on every rebuild even for
  // previously-seen cards. (Bug 1, Fudgie S24 report 2026-10-18.)
  const artCache = new Map();

  /* ----- Preload all card art at boot (GH-CARD-003 fix, 2026-10-18) -----
   * The S24 was still flashing white-text cards on tap even with the pinned
   * artCache. Root cause: artCache only populated on first sighting, and
   * backgroundImage:url() still needs a decode pass on S24's GPU.
   * Fix: decode ALL 55 PNGs upfront at boot. Zero flash, ever.
   * Fudgie directive 2026-10-18: fix the card glitch.
   */
  function preloadAllCardArt() {
    var suits = ['s', 'h', 'd', 'c'];
    var paths = [];
    // 52 standard cards
    for (var s = 0; s < suits.length; s++) {
      for (var v = 1; v <= 13; v++) {
        paths.push('solitaire-phase1-staging/card-art/' + suits[s] + v + '.png');
      }
    }
    // 2 jokers + card back
    paths.push('solitaire-phase1-staging/card-art/joker-radio.png');
    paths.push('solitaire-phase1-staging/card-art/joker-pug.png');
    paths.push('solitaire-phase1-staging/card-art/back.png');

    paths.forEach(function(path) {
      if (artCache.has(path)) return;
      var img = new Image();
      img.onload = function() {
        // Ensure fully decoded before caching
        if (img.decode) {
          img.decode().then(function() {
            artCache.set(path, img);
          }).catch(function() {
            artCache.set(path, img); // decode failed, cache anyway
          });
        } else {
          artCache.set(path, img);
        }
      };
      img.src = path;
    });
  }

  // Expose for boot sequence
  if (typeof window !== 'undefined') {
    window.__preloadCardArt = preloadAllCardArt;
  }

  /* ----- Create a card DOM element ----- */
  function createCardEl(card, opts = {}) {
    const el = document.createElement('div');
    el.className = 'live-card';
    el.dataset.cardId = cardId(card);
    
    // Store card reference for tap handling
    el._card = card;
    el._from = opts.from;
    el._col = opts.col;
    el._idx = opts.idx;
    
    if (card.faceUp) {
      el.classList.add('face-up');
      // ALWAYS put text in DOM (Clara's review: no empty rectangles)
      el.innerHTML = renderCardText(card);
      // Card art: once a PNG has loaded, it is in the browser cache, so
      // re-applying it here is synchronous — no text-flash on rebuilds.
      // (Full-render flash fix, 2026-10-18: previously every render()
      // recreated all 54 card elements and each reloaded its PNG async,
      // flashing white text cards for a frame on the S24.)
      const artPath = cardArtPath(card);
      if (artPath) {
        const cached = artCache.get(artPath);
        if (cached && cached.complete && cached.naturalWidth > 0) {
          // Pinned decoded bitmap — synchronous, no flash.
          el.style.backgroundImage = `url('${artPath}')`;
          el.classList.add('has-art');
        } else if (!cached) {
          const img = new Image();
          img.onload = () => {
            artCache.set(artPath, img);  // pin it: prevents GC eviction
            el.style.backgroundImage = `url('${artPath}')`;
            el.classList.add('has-art');
          };
          img.onerror = () => {
            // Keep text visible; art failed to load
          };
          img.src = artPath;
        }
        // else: load in flight from another element — its onload will populate
        // the card when ready; text shows meanwhile (first sighting only).
      }
    } else {
      el.classList.add('face-down');
      // Card back design (Clara styles this)
    }
    
    // Selection highlight — full stack: when a tableau card is selected,
    // every card from idx to the pile top highlights, so the player can see
    // the whole stack they're about to move. (Stack-highlight UX, 2026-10-18.)
    if (selected && selected.from === opts.from && selected.col === opts.col) {
      const inStack = selected.from === 'tableau'
        ? opts.idx >= selected.idx
        : opts.idx === selected.idx;
      if (inStack) el.classList.add('selected');
    }
    
    // Position for tableau fanning
    // (Locked visual: adapter is the single authority on positioning.
    // Setting transform here causes a visible jump when the adapter
    // overwrites it via MutationObserver. Skip when adapter present.)
    const hasVisualAdapter = typeof document !== 'undefined' &&
      document.getElementById && document.getElementById('btn-exit');
    if (opts.from === 'tableau' && opts.offsetY && !hasVisualAdapter) {
      el.style.transform = `translateY(${opts.offsetY}px)`;
    }
    
    // Attach tap/long-press handlers
    attachCardHandlers(el);
    
    return el;
  }
  
  function renderCardText(card) {
    if (card.isJoker) return '<div class="joker-label">🃏<br>JOKER</div>';
    const suits = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
    const suitSym = suits[card.suit] || '?';
    const valStr = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[card.value] || card.value;
    const color = (card.suit === 'hearts' || card.suit === 'diamonds') ? 'red' : 'black';
    return `<div class="card-text ${color}"><div class="corner">${valStr}${suitSym}</div><div class="center">${suitSym}</div></div>`;
  }
  
  /* ----- Render all piles ----- */
  function render() {
    const S = SaloonEngine.getState();
    if (!S) return;
    
    renderPile('stock-pile', S.stock, 'stock');
    renderPile('waste-pile', S.waste, 'waste');
    
    for (let i = 0; i < 4; i++) {
      renderPile(`foundation-${i}`, S.foundations[i], 'foundation', i);
    }
    for (let i = 0; i < 7; i++) {
      renderPile(`tableau-${i}`, S.tableau[i], 'tableau', i);
    }
    
    // Update HUD
    updateHUD(S);
  }
  
  function renderPile(pileId, cards, from, col = null) {
    const pileEl = document.getElementById(pileId);
    if (!pileEl) return;
    
    // Clear existing live cards
    pileEl.querySelectorAll('.live-card').forEach(el => el.remove());
    
    if (!cards || cards.length === 0) {
      // Empty pile — show placeholder (Clara styles)
      pileEl.classList.add('empty');
      return;
    }
    pileEl.classList.remove('empty');
    
    cards.forEach((card, idx) => {
      const opts = { from, col, idx };
      // Tableau fanning: offset each card (pass pile depth for compression)
      if (from === 'tableau') {
        opts.offsetY = idx * getCardOverlap(cards.length);
      }
      const cardEl = createCardEl(card, opts);
      pileEl.appendChild(cardEl);
    });
  }
  
  function updateHUD(S) {
    const timerEl = document.getElementById('timer-display');
    if (timerEl) {
      // Compute live elapsed from startTime (not just saved elapsed)
      let elapsed = S.elapsed || 0;
      if (S.startTime && !PauseSystem.paused() && !S.gameWon) {
        elapsed += Date.now() - S.startTime;
      }
      timerEl.textContent = formatTime(elapsed);
    }
    const moveEl = document.getElementById('move-counter');
    if (moveEl) {
      moveEl.textContent = S.moves || 0;
    }
  }
  
  // Live timer: update HUD every second while playing
  let hudTimer = null;
  function startHudTimer() {
    if (hudTimer) return;
    hudTimer = setInterval(() => {
      if (PauseSystem.paused()) return;
      try {
        const S = SaloonEngine.getState();
        if (S && !S.gameWon) updateHUD(S);
      } catch (e) {}
    }, 1000);
  }
  function stopHudTimer() {
    if (hudTimer) {
      clearInterval(hudTimer);
      hudTimer = null;
    }
  }
  
  function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
  
  /* ----- Tap handling (tap-only, no drag) ----- */
  function attachCardHandlers(el) {
    let downX = 0, downY = 0, downTime = 0;
    
    el.addEventListener('pointerdown', (e) => {
      if (PauseSystem.paused()) return;
      PauseSystem.recordActivity();
      
      downX = e.clientX;
      downY = e.clientY;
      downTime = Date.now();
      
      // Start long-press timer (face-up only)
      if (el._card && el._card.faceUp) {
        longPressTimer = setTimeout(() => {
          longPressTimer = null;
          openCardViewer(el._card);
          el._longPressed = true;  // Suppress tap on pointerup
        }, LONG_PRESS_MS);
      }
    });
    
    el.addEventListener('pointerup', (e) => {
      if (PauseSystem.paused()) return;
      
      // Clear long-press timer
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      
      // If long-press fired, swallow this pointerup
      if (el._longPressed) {
        el._longPressed = false;
        return;
      }
      
      // Check for drag (movement > 12px = not a tap)
      const dx = e.clientX - downX;
      const dy = e.clientY - downY;
      if (Math.sqrt(dx * dx + dy * dy) > 12) return;
      
      // It's a tap — handle game logic
      handleTap(el);
    });
    
    // Cancel long-press on move
    el.addEventListener('pointermove', (e) => {
      if (!longPressTimer) return;
      const dx = e.clientX - downX;
      const dy = e.clientY - downY;
      if (Math.sqrt(dx * dx + dy * dy) > 12) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    });
  }
  
  // P1 FLICKER FIX (isolated dev, 2026-10-18): selection highlight must NOT
  // tear down and rebuild the whole board. render()/renderPile() removes every
  // .live-card and re-appends it, which (a) flashes text fallbacks while PNG
  // art reloads async, and (b) leaves tableau cards un-fanned for one frame
  // until the visual adapter's rAF boundFans() runs. Toggling the class on
  // the existing DOM avoids both flashes. Game-state changes still use
  // render(). Mirrors createCardEl's own selected-match logic exactly.
  //
  // STACK-HIGHLIGHT UX (2026-10-18): a tableau selection marks the FULL
  // stack (idx to pile top), not just the grabbed card, so the player sees
  // everything that's about to move.
  function paintSelection() {
    document.querySelectorAll('.live-card.selected').forEach(el => el.classList.remove('selected'));
    if (!selected) return;
    const s = selected;
    const all = document.querySelectorAll('.live-card');
    for (const el of all) {
      if (el._from !== s.from || el._col !== s.col) continue;
      const inStack = s.from === 'tableau' ? el._idx >= s.idx : el._idx === s.idx;
      if (inStack) el.classList.add('selected');
    }
  }

  // STACK-HIGHLIGHT UX (2026-10-18): resolve a tap's Y position to the
  // intended tableau card. Buried cards show only a small sliver (one fan
  // step, 18-36px) — too small for a reliable finger tap. This maps any Y
  // in the pile to the deepest card whose sliver region contains it, with
  // a half-step upward bias so slightly-low taps still grab the intended
  // card instead of the one below it. Cards are in DOM/visual top order.
  function cardAtPileY(pileEl, clientY) {
    const cards = [...pileEl.querySelectorAll('.live-card')];
    if (!cards.length) return null;
    const tops = cards.map(el => el.getBoundingClientRect().top);
    const step = cards.length > 1 ? tops[1] - tops[0] : 0;
    const bias = step / 2;
    let best = null;
    for (let k = 0; k < cards.length; k++) {
      if (tops[k] - bias <= clientY) best = cards[k];
      else break;
    }
    return best || cards[0];
  }

  function handleTap(el) {
    const card = el._card;
    if (!card || !card.faceUp) return;
    
    const from = el._from;
    const col = el._col;
    const idx = el._idx;
    
    // Check for double-tap
    const cid = cardId(card);
    const now = Date.now();
    const lastTap = lastTapByCard[cid] || 0;
    
    if (now - lastTap < DOUBLE_TAP_MS) {
      // Double-tap!
      delete lastTapByCard[cid];
      handleDoubleTap(card, from, col, idx);
      return;
    }
    lastTapByCard[cid] = now;
    
    // Single tap: select or move
    if (!selected) {
      // Nothing selected — select this card (if movable)
      if (isMovable(card, from, col, idx)) {
        selected = { from, col, idx };
        paintSelection();  // class-only: no board rebuild, no flicker
      }
    } else {
      // Something selected — try to move it here
      const result = tryMove(selected, { from, col, idx });
      selected = null;
      if (result) {
        render();  // game state changed — full redraw is correct here
      } else {
        // Invalid move — select the new card instead (if movable)
        if (isMovable(card, from, col, idx)) {
          selected = { from, col, idx };
        }
        paintSelection();  // class-only: no board rebuild, no flicker
      }
    }
  }
  
  function handleDoubleTap(card, from, col, idx) {
    // Joker: player chooses destination (don't auto-play)
    if (card.isJoker) {
      selected = { from, col, idx };
      paintSelection();  // class-only: no board rebuild, no flicker
      return;
    }
    
    // P1 fix (Clara v3 review): Validate card position before auto-foundation
    // The engine's moveToFoundation() ignores idx and acts on the top card,
    // so we must ensure the double-tapped card IS the top card.
    const S = SaloonEngine.getState();
    if (from === 'tableau') {
      const pile = S.tableau[col];
      if (!pile || idx !== pile.length - 1) {
        return; // Buried card - do not move a different top card
      }
      // Also ensure it's face-up
      if (!pile[idx].faceUp) return;
    } else if (from === 'waste') {
      if (idx !== S.waste.length - 1) {
        return; // Not the top waste card
      }
    } else if (from === 'foundation') {
      return; // Foundation cards don't auto-move
    }
    
    // Try to move to foundation (engine auto-selects destination)
    // Note: engine uses top card, which we've now validated is the clicked card
    const result = SaloonEngine.moveToFoundation(from, col);
    if (result) {
      selected = null;
      render();
    }
  }
  
  function isMovable(card, from, col, idx) {
    const S = SaloonEngine.getState();
    if (from === 'tableau') {
      // Allow any face-up card (engine validates sequences)
      // Check that all cards from idx to end are face-up
      const pile = S.tableau[col];
      for (let i = idx; i < pile.length; i++) {
        if (!pile[i].faceUp) return false;
      }
      return true;
    }
    if (from === 'waste') {
      return idx === S.waste.length - 1;
    }
    if (from === 'foundation') {
      // P0-2: Foundation cards are not selectable as move sources
      // (prevents foundation-to-foundation bugs)
      return false;
    }
    return false;
  }
  
  function tryMove(fromSel, toSel) {
    // Route to appropriate engine function
    if (toSel.from === 'foundation') {
      // P0-1: Only top tableau cards can move to foundation
      // (moveToSpecificFoundation always uses the top card)
      if (fromSel.from === 'tableau') {
        const S = SaloonEngine.getState();
        const pile = S.tableau[fromSel.col];
        if (fromSel.idx !== pile.length - 1) {
          return false; // Not the top card - reject
        }
      }
      // P0-2: Foundation cards cannot be moved (no foundation-to-foundation)
      if (fromSel.from === 'foundation') {
        return false;
      }
      // Waste is always the top card by definition
      return SaloonEngine.moveToSpecificFoundation(
        fromSel.from, fromSel.col, toSel.col
      );
    }
    if (toSel.from === 'tableau') {
      if (fromSel.from === 'tableau') {
        return SaloonEngine.moveTableauToTableau(
          fromSel.col, fromSel.idx, toSel.col
        );
      }
      if (fromSel.from === 'waste') {
        return SaloonEngine.moveWasteToTableau(toSel.col);
      }
    }
    return false;
  }
  
  /* ----- Long-press viewer ----- */
  function openCardViewer(card) {
    // Fire event for Clara's visual viewer
    const event = new CustomEvent('card:view', {
      detail: {
        suit: card.suit,
        value: card.value,
        color: (card.suit === 'hearts' || card.suit === 'diamonds') ? 'red' : 'black',
        isJoker: !!card.isJoker,
        jokerId: card.jokerId,
        jokerName: card.jokerName,
        artId: card.artId,
      }
    });
    document.dispatchEvent(event);
  }
  
  /* ----- Button wiring ----- */
  function wireButtons() {
    const btnUndo = document.getElementById('btn-undo');
    if (btnUndo) btnUndo.addEventListener('click', () => {
      if (PauseSystem.paused()) return;
      PauseSystem.recordActivity();
      if (SaloonEngine.undo()) render();
    });
    
    const btnHint = document.getElementById('btn-hint');
    if (btnHint) btnHint.addEventListener('click', () => {
      if (PauseSystem.paused()) return;
      PauseSystem.recordActivity();
      const hints = SaloonEngine.findHints();
      // Fire event for Clara's hint visual
      document.dispatchEvent(new CustomEvent('game:hint', { detail: { hints } }));
    });
    
    const btnPause = document.getElementById('btn-pause');
    if (btnPause) btnPause.addEventListener('click', () => {
      PauseSystem.recordActivity();
      PauseSystem.pause('manual');
    });
    

    const btnNew = document.getElementById('btn-newgame');
    if (btnNew) btnNew.addEventListener('click', () => {
      PauseSystem.recordActivity();
      const prefs = getSavedPrefs();
      const startNew = () => {
        SaveSystem.clear();
        selected = null;
        resetVictoryOnNewGame();
        SaloonEngine.newGame(prefs.timerMode, prefs.drawMode);
        render();
      };
      if (SaveSystem.hasSave()) {
        if (confirm('Start a new game? Your current progress will be lost.')) {
          startNew();
        }
      } else {
        startNew();
      }
    });
    
    // Stock pile: SINGLE draw handler with deduplication
    // (Clara's review: click + pointerup caused double-draw on touch)
    const stockEl = document.getElementById('stock-pile');
    if (stockEl) {
      let lastDrawTime = 0;
      const doDraw = () => {
        const now = Date.now();
        // Deduplicate: ignore draws within 300ms (touch fires click+pointerup)
        if (now - lastDrawTime < 300) return;
        lastDrawTime = now;
        
        if (PauseSystem.paused()) return;
        PauseSystem.recordActivity();
        selected = null;
        if (SaloonEngine.drawFromStock()) render();
      };
      // Use pointerup only (works for both mouse and touch)
      stockEl.addEventListener('pointerup', (e) => {
        // Prevent the subsequent click event from also firing
        e.preventDefault();
        doDraw();
      });
    }
    
    // Empty pile click targets: foundation and tableau
    for (let i = 0; i < 4; i++) {
      const fnd = document.getElementById(`foundation-${i}`);
      if (fnd) fnd.addEventListener('click', (e) => {
        if (PauseSystem.paused()) return;
        if (selected && (e.target === fnd || !e.target.closest('.live-card'))) {
          PauseSystem.recordActivity();
          // P1 fix (Clara review): route through tryMove for validation
          // (ensures buried tableau cards can't move a different top card)
          const result = tryMove(selected, { from: 'foundation', col: i });
          selected = null;
          render();
        }
      });
    }
    for (let i = 0; i < 7; i++) {
      const tab = document.getElementById(`tableau-${i}`);
      if (tab) tab.addEventListener('click', (e) => {
        if (PauseSystem.paused()) return;
        if (selected && (e.target === tab || !e.target.closest('.live-card'))) {
          PauseSystem.recordActivity();
          let result = false;
          if (selected.from === 'tableau') {
            result = SaloonEngine.moveTableauToTableau(selected.col, selected.idx, i);
          } else if (selected.from === 'waste') {
            result = SaloonEngine.moveWasteToTableau(i);
          } else if (selected.from === 'foundation') {
            // Foundation back to tableau (if engine supports)
            result = false;
          }
          selected = null;
          render();
        }
      });
      // Forgiving tap target (stack-highlight UX, 2026-10-18): when NOTHING
      // is selected, taps on the pile background (not on a card element)
      // resolve to the nearest card by Y, so buried cards don't require
      // hitting their exact visible sliver. Move-destination taps (something
      // selected) stay with the click handler above — this branch returns
      // early when selected is set, so there is no double-handling.
      if (tab) {
        let pileDownX = 0, pileDownY = 0;
        tab.addEventListener('pointerdown', (e) => {
          pileDownX = e.clientX; pileDownY = e.clientY;
        });
        tab.addEventListener('pointerup', (e) => {
          if (PauseSystem.paused()) return;
          if (selected) return;
          if (e.target !== tab && e.target.closest('.live-card')) return;
          const dx = e.clientX - pileDownX, dy = e.clientY - pileDownY;
          if (Math.sqrt(dx * dx + dy * dy) > 12) return;  // drag, not a tap
          const el = cardAtPileY(tab, e.clientY);
          if (el && el._card && el._card.faceUp &&
              isMovable(el._card, 'tableau', i, el._idx)) {
            PauseSystem.recordActivity();
            selected = { from: 'tableau', col: i, idx: el._idx };
            paintSelection();  // class-only: full stack highlights, no rebuild
          }
        });
      }
    }
  }
  
  /* ----- Pause screen wiring ----- */
  function wirePauseScreen() {
    PauseSystem.on('paused', (data) => {
      const ps = document.getElementById('pause-screen');
      const msg = document.getElementById('pause-message');
      const resumeBtn = document.getElementById('pause-resume');
      const choices = document.getElementById('pause-choices');
      
      if (!ps) return;
      
      // Set message based on reason
      if (msg) {
        if (data.reason === 'inactivity') {
          msg.textContent = 'Looks like you stepped away, partner! Your game has been saved and will be waiting right here.';
        } else if (data.reason === 'visibility') {
          msg.textContent = 'Welcome back! Your game was paused while you were away.';
        } else if (data.reason === 'returning') {
          msg.textContent = 'Welcome back, partner! Your game is waiting.';
        } else {
          msg.textContent = 'Take a break, partner. Your game is saved.';
        }
      }
      
      // Show/hide appropriate buttons
      if (data.reason === 'returning') {
        // Show Continue / New Game choices
        if (choices) choices.style.display = 'flex';
        if (resumeBtn) resumeBtn.style.display = 'none';
      } else {
        if (choices) choices.style.display = 'none';
        if (resumeBtn) resumeBtn.style.display = 'block';
      }
      
      ps.removeAttribute('hidden');
      ps.style.display = 'flex';
    });
    
    const resumeBtn = document.getElementById('pause-resume');
    if (resumeBtn) resumeBtn.addEventListener('click', () => {
      const _ps = document.getElementById('pause-screen'); if (_ps) { _ps.setAttribute('hidden', ''); _ps.style.display = 'none'; }
      PauseSystem.resume();
      render();
    });
    
    const continueBtn = document.getElementById('pause-continue');
    if (continueBtn) continueBtn.addEventListener('click', () => {
      const _ps = document.getElementById('pause-screen'); if (_ps) { _ps.setAttribute('hidden', ''); _ps.style.display = 'none'; }
      PauseSystem.resume();
      render();
    });
    
    const newGameBtn = document.getElementById('pause-newgame');
    if (newGameBtn) newGameBtn.addEventListener('click', () => {
      if (confirm('Start a new game? Your saved progress will be lost.')) {
        SaveSystem.clear();
        const _ps = document.getElementById('pause-screen'); if (_ps) { _ps.setAttribute('hidden', ''); _ps.style.display = 'none'; }
        selected = null;
        resetVictoryOnNewGame();
        const prefs = getSavedPrefs();
        SaloonEngine.newGame(prefs.timerMode, prefs.drawMode);
        // P1 fix: use resetForNewGame (not resume) - don't start timer prematurely
        // Timer begins on first valid move per engine behavior
        if (PauseSystem.resetForNewGame) {
          PauseSystem.resetForNewGame();
        } else {
          PauseSystem.resume(); // Fallback for older PauseSystem
        }
        render();
      }
    });
  }
  
  /* ----- Menu, viewer, hint wiring (Clara's v3 review) ----- */
  function wireMenuViewerHint() {
    // Hamburger menu: toggle visibility using hidden attribute
    const btnMenu = document.getElementById('btn-menu');
    const menu = document.getElementById('menu');
    const showMenu = (show) => {
      if (!menu) return;
      if (show) {
        menu.removeAttribute('hidden');
        menu.style.display = 'block';
      } else {
        menu.setAttribute('hidden', '');
        menu.style.display = 'none';
      }
    };
    
    if (btnMenu) btnMenu.addEventListener('click', () => {
      if (PauseSystem.paused()) return;
      PauseSystem.recordActivity();
      const isHidden = menu && menu.hasAttribute('hidden');
      showMenu(isHidden);
    });
    
    // Close menu button
    const closeMenu = document.getElementById('closeMenu');
    if (closeMenu) closeMenu.addEventListener('click', () => showMenu(false));
    
    // Draw mode setter: uses _getState (live), not getState (snapshot)
    const setDrawMode = (mode) => {
      try {
        const S = SaloonEngine._getState();
        if (S) {
          S.drawMode = mode;
          // Persist to prefs
          const prefs = SessionManager.getPrefs() || SessionManager.defaultPrefs();
          prefs.drawMode = mode;
          SessionManager.savePrefs(prefs);
          // P1-3: Persist to current save immediately (don't wait for next move)
          try { SaveSystem.save(); } catch (e) {}
          // Update button states (ARIA + visual .selected class)
          const d1 = document.getElementById('draw1');
          const d3 = document.getElementById('draw3');
          if (d1) {
            d1.setAttribute('aria-pressed', mode === 1 ? 'true' : 'false');
            d1.classList.toggle('selected', mode === 1);
          }
          if (d3) {
            d3.setAttribute('aria-pressed', mode === 3 ? 'true' : 'false');
            d3.classList.toggle('selected', mode === 3);
          }
        }
      } catch (e) { /* ignore */ }
      showMenu(false);
    };
    
    const draw1 = document.getElementById('draw1');
    if (draw1) draw1.addEventListener('click', () => setDrawMode(1));
    const draw3 = document.getElementById('draw3');
    if (draw3) draw3.addEventListener('click', () => setDrawMode(3));
    
    // Card viewer: listen for card:view, show viewer
    // Phase 1B: Build high-contrast Western-style card fallback
    function buildViewerFallback(detail) {
      const suits = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
      const isRed = detail.suit === 'hearts' || detail.suit === 'diamonds';
      const colorClass = isRed ? 'red' : 'black';
      
      if (detail.isJoker) {
        const jokerName = detail.jokerName || 'WILD CARD';
        return `<div class="viewer-fallback">
          <div class="rank ${colorClass}">🃏</div>
          <div class="joker-name">${jokerName}</div>
        </div>`;
      }
      
      const valStr = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[detail.value] || detail.value || '?';
      const suitSym = suits[detail.suit] || '?';
      return `<div class="viewer-fallback">
        <div class="rank ${colorClass}">${valStr}</div>
        <div class="suit ${colorClass}">${suitSym}</div>
      </div>`;
    }
    
    document.addEventListener('card:view', (e) => {
      const viewer = document.getElementById('viewer');
      if (!viewer) return;
      viewer.removeAttribute('hidden');
      viewer.style.display = 'flex';
      PauseSystem.recordActivity();
      
      const detail = e.detail || {};
      const titleEl = document.getElementById('cardTitle');
      if (titleEl) {
        // Viewer caption only: map engine rank numbers to reader-friendly names.
        // Do not alter card values, art filenames, or gameplay logic. (v9 — Clara handoff)
        const faceNames = { 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' };
        const rankName = faceNames[Number(detail.value)] || String(detail.value ?? '');
        const suitName = detail.suit
          ? detail.suit.charAt(0).toUpperCase() + detail.suit.slice(1)
          : '';
        titleEl.textContent = detail.isJoker
          ? (detail.jokerName || 'WILD CARD')
          : [rankName, suitName ? `of ${suitName}` : ''].filter(Boolean).join(' ');
      }
      const cardEl = document.getElementById('fullCard');
      if (cardEl) {
        // P2 fix: render fallback IMMEDIATELY, swap only on successful load
        cardEl.classList.remove('art-loaded');
        cardEl.innerHTML = buildViewerFallback(detail);
        if (detail.artId) {
          const img = new Image();
          img.onload = () => {
            if (cardEl.isConnected) {
              cardEl.classList.add('art-loaded');
              cardEl.innerHTML = '';
              img.style.maxWidth = '100%';
              img.style.maxHeight = '100%';
              img.style.objectFit = 'contain';
              cardEl.appendChild(img);
            }
          };
          // onerror: keep fallback already showing (don't clear)
          img.src = `solitaire-phase1-staging/card-art/${detail.artId}.png`;
        }
      }
    });
    
    const closeViewerBtn = document.getElementById('closeViewer');
    if (closeViewerBtn) closeViewerBtn.addEventListener('click', () => {
      const viewer = document.getElementById('viewer');
      if (viewer) {
        viewer.setAttribute('hidden', '');
        viewer.style.display = 'none';
      }
      document.dispatchEvent(new CustomEvent('card:view:close'));
      PauseSystem.recordActivity();
    });
    
    // Viewer close
    const closeViewer = document.getElementById('closeViewer');
    if (closeViewer) closeViewer.addEventListener('click', () => {
      const viewer = document.getElementById('card-viewer');
      if (viewer) {
        viewer.setAttribute('hidden', '');
        viewer.style.display = 'none';
      }
      document.dispatchEvent(new CustomEvent('card:view:close'));
    });
    
    // Hint: show visible feedback (P1 fix 2026-10-17 — was console.log only)
    document.addEventListener('game:hint', (e) => {
      const hints = e.detail && e.detail.hints;
      if (!hints || hints.length === 0) {
        showHintToast('No moves — tap the stock pile');
        return;
      }
      const h = hints[0];
      if (h.action === 'draw') {
        pulseEl(document.getElementById('stock-pile'));
        return;
      }
      // Highlight the suggested card via its data-card-id node
      let node = null;
      try {
        if (h.card) node = document.querySelector('[data-card-id="' + cardId(h.card) + '"]');
      } catch (err) { node = null; }
      if (node) {
        pulseEl(node);
      } else {
        showHintToast('Hint: ' + describeHint(h));
      }
      // Also pulse the destination pile when known
      const destId = h.to === 'foundation' && h.toFoundation != null ? 'foundation-' + h.toFoundation
        : h.to === 'tableau' && h.toCol != null ? 'tableau-' + h.toCol : null;
      if (destId) pulseEl(document.getElementById(destId));
    });
  }
  
  /* ----- Initialize ----- */
  function init() {
    // GH-CARD-003: preload all card art before first render (Fudgie 2026-10-18)
    preloadAllCardArt();
    wireButtons();
    wirePauseScreen();
    wireMenuViewerHint();
    startHudTimer();
    PauseSystem.init();
    
    // Session detection and game setup
    // Clara's review: check for valid save INDEPENDENTLY of visit type
    const visitType = SessionManager.getVisitType();
    SessionManager.markSessionActive();
    
    let prefs = SessionManager.getPrefs();
    if (!prefs) {
      // No prefs: save defaults now (don't discard future saves)
      prefs = SessionManager.defaultPrefs();
      SessionManager.savePrefs(prefs);
    }
    
    const saveData = SaveSystem.hasSave() ? SaveSystem.load() : null;
    
    if (saveData && !saveData.gameWon) {
      // Valid save exists: restore it (paused) regardless of visit type
      if (SaveSystem.restore(saveData)) {
        PauseSystem.pause('returning');
      } else {
        SaloonEngine.newGame(prefs.timerMode, prefs.drawMode);
      }
    } else if (visitType === 'first') {
      // First visit, no save: new game with defaults
      SaloonEngine.newGame(prefs.timerMode, prefs.drawMode);
    } else {
      // Returning, no save: new game with saved prefs
      SaloonEngine.newGame(prefs.timerMode, prefs.drawMode);
    }
    
    // Auto-save wiring: wrap engine move functions
    const moveFns = ['drawFromStock', 'moveToFoundation', 'moveToSpecificFoundation',
                     'moveTableauToTableau', 'moveWasteToTableau', 'undo'];
    moveFns.forEach(fn => {
      if (typeof SaloonEngine[fn] === 'function') {
        const orig = SaloonEngine[fn];
        SaloonEngine[fn] = function() {
          const result = orig.apply(this, arguments);
          if (result) {
            clearTimeout(window._saveDebounce);
            window._saveDebounce = setTimeout(() => SaveSystem.save(), 500);
            render();
          }
          return result;
        };
      }
    });
    
    // Initial render
    render();
    
    // Subscribe to engine state changes
    if (SaloonEngine.onStateChange) {
      SaloonEngine.onStateChange(() => render());
    }
  }
  
  return {
    init,
    render,
    openCardViewer,
    // For testing
    _getSelected: () => selected,
    _clearSelected: () => { selected = null; },
  };
})();

// Export for Node testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RendererBinding };
}
