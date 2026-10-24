/* TSCMS Gamehouse | Swiper Phase 2 bootstrap PREVIEW
 * Isolated integration candidate for Cherish review. Not for production without
 * full Playwright + S24 verification and approved animation art.
 * Depends on approved v4 files; deliberately does not edit the v4 helper.
 * Load AFTER SessionManager, SaveSystem, MischiefEngine, MischiefIntegration,
 * SwiperTestMode and SwiperTestModeIntegration; BEFORE RendererBinding.init().
 */
'use strict';
const SwiperLaunchBootstrap = (() => {
  let active = false;
  let config = null;
  let gateUsed = false;
  let realSave = null;
  let originalTarget = null;
  let originalShouldStrike = null;
  let startGame = null;

  // Staging preview shares its GitHub Pages origin with the public game.
  // Never read or mutate the public game save/prefs/session keys here.
  const STAGING_SAVE_KEY = 'tscms_solitaire_save_menu_launch_v2';
  const STAGING_PREFS_KEY = 'tscms_solitaire_prefs_menu_launch_v2';
  const STAGING_SESSION_KEY = 'tscms_solitaire_session_menu_launch_v2';

  const deps = () => ({
    E: SaloonEngine, M: MischiefEngine, I: MischiefIntegration,
    T: SwiperTestModeIntegration, S: SaveSystem, P: SessionManager
  });

  function preferences() {
    const {P} = deps();
    return Object.assign({ghostMode:false, swiperIntroDismissed:false, theme:'classic'}, P.getPrefs() || P.defaultPrefs());
  }
  function setPreference(key, value) {
    const {P} = deps();
    const p = preferences(); p[key] = value;
    P.savePrefs(p);
  }
  function wireStagePreferences() {
    const {P} = deps();
    // RendererBinding and the intro use SessionManager's public methods.
    // Override ONLY inside this staging bootstrap, without touching source SessionManager.
    P.getPrefs = function() {
      try { const v = localStorage.getItem(STAGING_PREFS_KEY); return v ? JSON.parse(v) : null; }
      catch(e) { return null; }
    };
    P.savePrefs = function(prefs) {
      try {
        const next = {...prefs, version:1, hasSeenSetup:true};
        localStorage.setItem(STAGING_PREFS_KEY, JSON.stringify(next));
        return true;
      } catch(e) { return false; }
    };
    P.getVisitType = function() {
      try {
        if(sessionStorage.getItem(STAGING_SESSION_KEY)==='active') return 'continuous';
        return localStorage.getItem(STAGING_PREFS_KEY)!==null ? 'returning' : 'first';
      } catch(e) { return 'first'; }
    };
    P.markSessionActive = function() {
      try { sessionStorage.setItem(STAGING_SESSION_KEY,'active'); }
      catch(e) { /* disabled storage is nonfatal */ }
    };
  }
  function isTest() { return !!config; }
  function announce(message) {
    if (typeof document === 'undefined') return;
    let el = document.getElementById('swiper-status');
    if (!el) { el = document.createElement('div'); el.id='swiper-status'; el.setAttribute('role','status');
      el.style.cssText='position:fixed;bottom:8px;left:8px;z-index:100;color:#ffe2a6;background:#281509;padding:8px;border:1px solid #b68b4d;border-radius:7px;font:13px system-ui;';
      document.body.appendChild(el); }
    el.textContent = message;
    if (message !== '') setTimeout(()=>{ if(el.textContent===message) el.textContent=''; },5000);
  }

  function wireSaves() {
    const {E,T,S} = deps();
    if (realSave) return;
    realSave = {save:S.save,load:S.load,hasSave:S.hasSave,clear:S.clear};
    function activeKey() {return config ? T.TEST_SAVE_KEY : STAGING_SAVE_KEY;}
    // Test namespace is selected from the exact staging origin/path, independently
    // of mutable/sanitized state. An already-clean restored test game stays isolated.
    S.save = function() {
      const live = E._getState();
      if (!live) return false;
      const data = S.serialize();
      if (!data) return false;
      const payload = config ? {...data, mischief:T.prepareForSave(live.mischief)} : data;
      try {
        localStorage.setItem(activeKey(), JSON.stringify(payload));
        return true;
      } catch(e) { console.error('Swiper test save failed',e); return false; }
    };
    S.load = function() {
      try {
        const str = localStorage.getItem(activeKey());
        if (!str) return null;
        const data = JSON.parse(str);
        if (!S.validate(data)) return null;
        // Test mode: re-apply forced override on reload. Saved test games
        // are sanitized (no forced scheduling), so without this a reload
        // of ?swiper_test=100 would restore a clean game with no encounter.
        // The URL param is still present, so the user expects a forced test.
        if (config && data.mischief) {
          T.applyToNewGame(data.mischief, config);
        }
        return data;
      } catch(e) {return null;}
    };
    // Original hasSave internally calls lexical load(), so it MUST be wrapped.
    S.hasSave = function() {
      const data = S.load(); return !!(data && !data.gameWon);
    };
    S.clear = function() {
      try { localStorage.removeItem(activeKey());return true;}catch(e){return false;}
    };
  }

  function wireMischief() {
    const {E,M,I,T} = deps();
    if (typeof E.mischief === 'undefined') {
      if (!I.install()) throw new Error('MischiefIntegration failed to install');
    }
    const originalNewGame = E.newGame;
    E.newGame = function(timerMode, drawMode, theme) {
      // Original MischiefIntegration wrapper initializes S.mischief and then
      // disables it by default. Re-enable ONLY on the new deal, from prefs.
      const p = preferences();
      const seasonalTheme = theme || p.theme || 'classic';
      const result = originalNewGame.call(this,timerMode,drawMode,seasonalTheme);
      const live = E._getState();
      if (live && live.mischief) {
        live.mischief.enabled = p.ghostMode === true;
        // Pass the live game state so scare test mode can rig the
        // deterministic Joker-exposed deal (staging/test-only).
        if(config) T.applyToNewGame(live.mischief,config,live);
      }
      return result;
    };

    originalTarget = M.selectTarget;
    M.selectTarget = function(state) {
      const mischief = state && state.mischief;
      if (config && mischief && mischief._testForceScare) {
        const t = T.selectEncounterTarget(state,mischief);
        // never pass `pool:none` into MischiefIntegration.executeEncounter()
        return t && t.pool !== 'none' ? t : null;
      }
      return originalTarget.call(this,state);
    };
    originalShouldStrike = M.shouldStrike;
    M.shouldStrike = function(mischief,moveCount) {
      if(config && mischief && mischief._testForceScare &&
         originalShouldStrike.call(this,mischief,moveCount)) {
        const state = E._getState();
        const t = T.selectEncounterTarget(state,mischief);
        if(!t || t.pool==='none') {
          if(!mischief._testReportedMissingJoker) {
            mischief._testReportedMissingJoker=true;
            if(I.fireEvent) I.fireEvent('swiper:test-inconclusive',{reason:'NO_ELIGIBLE_JOKER'});
            announce('Swiper scare test: no eligible exposed Joker yet.');
          }
          return false; // do not invent a scare or consume encounter
        }
      }
      return originalShouldStrike.call(this,mischief,moveCount);
    };
  }

  function makeButton(label,onClick) {
    const b=document.createElement('button');b.type='button';b.textContent=label;
    b.className='p-btn';b.addEventListener('click',onClick);return b;
  }
  function modeHelp() {
    const menu=document.getElementById('menu');
    const panel=menu && menu.querySelector('.panel');
    if(!panel || document.getElementById('swiper-mode-field')) return;
    const field=document.createElement('div');field.id='swiper-mode-field';
    field.style.cssText='border-top:1px solid #b68b4d;padding-top:12px;margin-top:14px;text-align:left;';
    const heading=document.createElement('h3');heading.textContent='SWIPER GHOST';field.appendChild(heading);
    const p=document.createElement('p');p.style.fontSize='13px';p.textContent="Changes to Swiper take effect when you start your next new game. Your current game won't change.";field.appendChild(p);
    const classic=makeButton('Play Classic next deal',()=>{setPreference('ghostMode',false);announce('Classic selected for next new deal.');});
    const swiper=makeButton('Play with Swiper next deal',()=>{setPreference('ghostMode',true);announce('Swiper selected for next new deal.');});
    classic.style.marginRight='8px'; field.append(classic,swiper);
    const details=document.createElement('details');details.style.marginTop='12px';
    const summary=document.createElement('summary');summary.textContent='Swiper Help & Joker Rules';details.appendChild(summary);
    const rule=document.createElement('p');rule.style.fontSize='13px';
    rule.textContent='Swiper can appear in eligible games to hide a legal card. If he finds an exposed Joker, he gets scared and leaves; no card is taken. A completed theft cannot be undone. The current game keeps its chosen mode until a new deal.';
    details.appendChild(rule);
    // The original approved Joker illustration MUST be attached here by the
    // visual integration owner, not generated or substituted.
    field.appendChild(details); panel.appendChild(field);
  }
  function showTestBadge() {
    if(!config || typeof document==='undefined') return;
    if(document.getElementById('swiper-test-badge'))return;
    const b=document.createElement('div');b.id='swiper-test-badge';
    b.style.cssText='position:fixed;z-index:90;top:0;left:0;right:0;text-align:center;background:#5c2f70;color:white;padding:5px;font:12px system-ui;pointer-events:none;';
    b.textContent=deps().T.badgeText(config);document.body.appendChild(b);
  }

  function showIntro(continueInit) {
    const p=preferences();
    if(p.swiperIntroDismissed) {continueInit();return;}
    const backdrop=document.createElement('div');backdrop.id='swiper-intro';
    backdrop.setAttribute('role','dialog');backdrop.setAttribute('aria-modal','true');
    backdrop.setAttribute('aria-label','Choose Classic or Swiper Solitaire');
    backdrop.style.cssText='position:fixed;inset:0;background:#070302eb;z-index:1000;display:grid;place-items:center;padding:20px;';
    const panel=document.createElement('div');panel.className='panel';panel.style.maxWidth='450px';
    const title=document.createElement('h2');title.textContent='Meet Swiper 👻';
    const msg=document.createElement('p');msg.textContent='Choose classic Solitaire, or let Swiper try some Halloween mischief. Joker cards scare him away!';
    const label=document.createElement('label');label.style.cssText='display:block;margin:12px 0;';
    const check=document.createElement('input');check.type='checkbox';check.style.marginRight='6px';
    label.append(check,document.createTextNode("Don't show this explanation again"));
    let finished=false;
    function finish(swiper) {
      if(finished)return; finished=true;
      setPreference('ghostMode',swiper);
      if(check.checked) setPreference('swiperIntroDismissed',true);
      backdrop.remove();continueInit();
    }
    const close=makeButton('×',()=>finish(false));close.className='close';close.setAttribute('aria-label','Close and play Classic');
    panel.append(close,title,msg,label,makeButton('Play with Swiper',()=>finish(true)),makeButton('Play Classic',()=>finish(false)));
    backdrop.appendChild(panel);
    backdrop.addEventListener('click',e=>{if(e.target===backdrop)finish(false);});
    backdrop.addEventListener('keydown',e=>{if(e.key==='Escape')finish(false);});
    document.body.appendChild(backdrop);
    close.focus();
  }

  function start(initializeRenderer) {
    if(active) return false;
    if(typeof initializeRenderer!=='function') throw new Error('Renderer initializer required');
    const {T}=deps();
    config=T.initTestMode(window.location.search,window.location.href);
    wireStagePreferences();wireMischief();wireSaves();active=true;
    if(config && typeof SwiperTestMode!=='undefined') SwiperTestMode.logActivation(config);
    showTestBadge();
    showIntro(()=>{initializeRenderer();modeHelp();});
    return true;
  }
  return {start,preferences,isTest,_test:{wireSaves,wireMischief}};
})();
if(typeof module!=='undefined'&&module.exports) module.exports={SwiperLaunchBootstrap};
