/* ============================================================
   Mischief Mechanic — Ghost Engine Module (Cherish)
   Spec v2.1 — 2026-10-16
   
   Implements the day-one Ghost feature per Fudgie's approved spec.
   - 25% encounter chance per game (35% Halloween)
   - Max 1 encounter (2 Halloween)
   - Two-pool targeting: scare (Jokers) vs theft (other cards)
   - Joker scare: no cards moved, no Undo barrier, counts as encounter
   - Actual steal: Undo locks, history barrier, reachability check
   ============================================================ */
'use strict';

const MischiefEngine = (() => {

  /* ----- Configuration ----- */
  const CONFIG = {
    baseRate: 0.25,
    halloweenRate: 0.35,
    baseMaxEncounters: 1,
    halloweenMaxEncounters: 2,
  };

  /* ----- State (per game) ----- */
  // Stored on the SaloonEngine state object as S.mischief
  function initMischiefState(theme) {
    const isHalloween = theme === 'halloween';
    const rate = isHalloween ? CONFIG.halloweenRate : CONFIG.baseRate;
    const maxEncounters = isHalloween ? CONFIG.halloweenMaxEncounters : CONFIG.baseMaxEncounters;
    
    const willStrike = Math.random() < rate;
    const strikeMoves = [];
    
    if (willStrike) {
      // Pick random strike move(s) between 3 and 67
      // (estimated game length; actual game may be shorter)
      // For base: 1 strike. For Halloween: 1-2 strikes (not guaranteed 2)
      const actualStrikes = isHalloween && Math.random() < 0.5 ? 2 : 1;
      // FIX (Defect 4, 2026-10-17): roll ONE base and derive the second strike
      // from it (+15). The old code re-rolled the base per strike, so both
      // strikes could land on the same move number.
      const base = 3 + Math.floor(Math.random() * 50);
      strikeMoves.push(base);
      if (actualStrikes > 1) strikeMoves.push(base + 15);
      strikeMoves.sort((a, b) => a - b);
    }
    
    return {
      enabled: false,  // Settings toggle (default OFF)
      theme: theme || 'classic',
      encounterRate: rate,
      maxEncounters: maxEncounters,
      encountersUsed: 0,
      willStrike: willStrike,
      strikeMoves: strikeMoves,
      undoLocked: false,
      historyBarrier: false,  // Set on steal only, not on scare
    };
  }

  /* ----- Target Selection: Two-Pool System ----- */
  
  /**
   * Pool A: Scare-eligible — exposed Jokers only
   * Pool B: Theft-eligible — exposed non-Joker cards
   * Returns { pool: 'scare'|'theft', target } or null if no targets
   */
  function selectTarget(state) {
    const scareTargets = [];  // Pool A: Jokers
    const theftTargets = [];  // Pool B: Other cards
    
    // Check waste top
    if (state.waste.length > 0) {
      const top = state.waste[state.waste.length - 1];
      if (top.isJoker) {
        scareTargets.push({ from: 'waste', card: top });
      } else {
        theftTargets.push({ from: 'waste', card: top });
      }
    }
    
    // Check stock top (only if stock has cards)
    if (state.stock.length > 0) {
      const top = state.stock[state.stock.length - 1];
      // Stock cards are face-down, but the "top" is what would be drawn
      // Per spec: ghost can steal from draw pile
      // We treat the top stock card as eligible (it's the next to be drawn)
      if (top.isJoker) {
        scareTargets.push({ from: 'stock', card: top });
      } else {
        theftTargets.push({ from: 'stock', card: top });
      }
    }
    
    // Check tableau tops (face-up only)
    for (let col = 0; col < 7; col++) {
      const pile = state.tableau[col];
      if (pile.length > 0) {
        const top = pile[pile.length - 1];
        if (top.faceUp) {
          if (top.isJoker) {
            scareTargets.push({ from: 'tableau', col: col, card: top });
          } else {
            theftTargets.push({ from: 'tableau', col: col, card: top });
          }
        }
      }
    }
    
    // Combine pools for selection
    // Jokers are eligible for scare, others for theft
    const allTargets = [
      ...scareTargets.map(t => ({ ...t, pool: 'scare' })),
      ...theftTargets.map(t => ({ ...t, pool: 'theft' })),
    ];
    
    if (allTargets.length === 0) return null;
    
    // Random selection from combined pool
    const selected = allTargets[Math.floor(Math.random() * allTargets.length)];
    return selected;
  }

  /* ----- Destination Selection ----- */
  
  /**
   * Pick where to hide the stolen card.
   * Options: bottom of stock, or bottom of a random tableau pile.
   * Returns { to: 'stock'|'tableau', col }
   *
   * SAFETY (fixed 2026-10-17, defects 3):
   * - Empty tableau columns are NEVER offered. A card buried face-down and
   *   alone can never be flipped face-up again (no removal can expose it),
   *   making it permanently unreachable.
   * - A column is excluded when it holds a currently-movable card that could
   *   land on the exposed stolen card (circular trap: the pile couldn't clear
   *   because its mover lost its landing, and the stolen card couldn't free
   *   because its pile couldn't clear). See columnNeedsCard().
   * - Stock bottom is always offered and always safe: unlimited redeals cycle
   *   every stock card back to drawable.
   */
  function selectDestination(state, target, excludeCol) {
    const options = [];

    // Option 1: Bottom of stock — the provably safe fallback, always available.
    options.push({ to: 'stock' });

    // Option 2: Bottom of a tableau pile (not the source pile), subject to
    // the safety exclusions above.
    const stolen = target && target.card;
    for (let col = 0; col < 7; col++) {
      if (col === excludeCol) continue;
      const pile = state.tableau[col];
      if (!pile || pile.length === 0) continue;      // never bury in an empty column
      if (stolen && columnNeedsCard(pile, stolen)) continue; // never create the circular trap
      options.push({ to: 'tableau', col: col });
    }

    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Would burying `stolenCard` under `pile` trap both?
   * Returns true when the pile holds a currently-movable face-up card that
   * could land on the exposed stolen card (opposite color, one rank lower).
   * Burying there would destroy that card's move AND trap the stolen card
   * under the now-unclearable pile — a circular dependency.
   */
  function columnNeedsCard(pile, stolenCard) {
    if (!stolenCard || stolenCard.isJoker) return false;
    for (let i = 0; i < pile.length; i++) {
      const c = pile[i];
      if (!c.faceUp || c.isJoker) continue;
      if (c.color !== stolenCard.color && c.value === stolenCard.value - 1) {
        if (isMovableSequence(pile, i)) return true;
      }
    }
    return false;
  }

  /**
   * Can the card at pile[i] actually be picked up right now?
   * (face-up, with a valid descending alternating sequence above it)
   */
  function isMovableSequence(pile, i) {
    for (let k = i; k < pile.length; k++) {
      if (!pile[k].faceUp) return false;
    }
    for (let k = i; k < pile.length - 1; k++) {
      const a = pile[k], b = pile[k + 1];
      if (!a || !b) return false;
      if (a.color === b.color) return false;
      if (a.value !== b.value + 1) return false;
    }
    return true;
  }

  /* ----- Reachability Check ----- */
  
  /**
   * Verify the stolen card remains reachable after being hidden.
   *
   * Honest version (fixed 2026-10-17, defect 3): the old implementation
   * returned true on every path without analysis. This version enforces the
   * same safety rules as selectDestination, so the retry loop in
   * executeSteal has real meaning. NOTE: this is a per-destination safety
   * check, not a proof that every resulting game is winnable.
   *
   * Returns true if reachable, false if not.
   * If false, caller should re-roll the destination.
   */
  function verifyReachability(state, destination, target) {
    if (!destination) return false;

    if (destination.to === 'stock') {
      // Stock bottom: provably recoverable — unlimited redeals cycle every
      // stock card back to drawable (verified: stock-bottom burial resurfaces).
      return true;
    }

    if (destination.to === 'tableau') {
      const pile = state.tableau[destination.col];
      // Empty column: the buried card would sit face-down and alone, with no
      // removal ever able to flip it face-up. Permanently unreachable.
      if (!pile || pile.length === 0) return false;
      // Circular trap: a live card in the pile could land on the exposed
      // stolen card. Burying there traps both.
      const stolen = target && target.card;
      if (stolen && columnNeedsCard(pile, stolen)) return false;
      return true;
    }

    return false;
  }

  /* ----- Execute Steal ----- */
  
  /**
   * Remove card from source, place at destination (face-down).
   * Returns { stolenCard, destination } or null on failure.
   */
  function executeSteal(state, target, destination) {
    let stolenCard = null;
    
    // Remove from source
    if (target.from === 'waste') {
      stolenCard = state.waste.pop();
    } else if (target.from === 'stock') {
      stolenCard = state.stock.pop();
    } else if (target.from === 'tableau') {
      const pile = state.tableau[target.col];
      stolenCard = pile.pop();
      // Flip the newly exposed card if needed
      if (pile.length > 0) {
        const newTop = pile[pile.length - 1];
        if (!newTop.faceUp) {
          newTop.faceUp = true;
        }
      }
    }
    
    if (!stolenCard) return null;
    
    // Place at destination (face-down)
    stolenCard.faceUp = false;
    
    // Verify reachability before placing
    let attempts = 0;
    let dest = destination;
    while (attempts < 10) {
      if (verifyReachability(state, dest, target)) break;
      dest = selectDestination(state, target, target.col);
      attempts++;
    }
    
    if (dest.to === 'stock') {
      state.stock.unshift(stolenCard);  // Bottom of stock
    } else if (dest.to === 'tableau') {
      state.tableau[dest.col].unshift(stolenCard);  // Bottom of pile
    }
    
    return { stolenCard, destination: dest };
  }

  /* ----- Check if Strike Should Fire ----- */
  
  /**
   * Called after each player move. Returns true if ghost should strike now.
   */
  function shouldStrike(mischiefState, moveCount) {
    if (!mischiefState.enabled) return false;
    if (!mischiefState.willStrike) return false;
    if (mischiefState.encountersUsed >= mischiefState.maxEncounters) return false;
    if (mischiefState.strikeMoves.length === 0) return false;
    
    // Check if current move count matches a scheduled strike
    const nextStrike = mischiefState.strikeMoves[0];
    if (moveCount >= nextStrike) {
      return true;
    }
    
    return false;
  }

  /* ----- Public API ----- */
  
  return {
    CONFIG,
    initMischiefState,
    selectTarget,
    selectDestination,
    columnNeedsCard,
    verifyReachability,
    executeSteal,
    shouldStrike,
  };
})();

// Export for Node testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MischiefEngine };
}
