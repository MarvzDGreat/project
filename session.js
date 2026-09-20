// ════════════════════════════════════════════
// session.js — shared idle-logout logic
// Include in EVERY page of Marvin's Life Tracker
// ════════════════════════════════════════════

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARN_BEFORE_MS  =  2 * 60 * 1000; // warn 2 min before logout
const SESSION_KEY     = 'mlt_session';
const LAST_ACTIVE_KEY = 'mlt_last_active';

// ── Session helpers ──────────────────────────
function mlt_saveSession(userId, isAdmin) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId, isAdmin: !!isAdmin, ts: Date.now() }));
  mlt_updateActivity();
}
function mlt_getSession() {
  try { const s = JSON.parse(localStorage.getItem(SESSION_KEY)||'{}'); if(s.userId) return s; } catch(e) {}
  return null;
}
function mlt_clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LAST_ACTIVE_KEY);
}
function mlt_updateActivity() {
  localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
}
function mlt_getLastActive() {
  return parseInt(localStorage.getItem(LAST_ACTIVE_KEY) || '0', 10);
}

// ── Activity listeners ───────────────────────
const ACTIVITY_EVENTS = ['mousemove','mousedown','keydown','touchstart','scroll','click'];
function mlt_bindActivity() {
  ACTIVITY_EVENTS.forEach(ev => {
    document.addEventListener(ev, mlt_updateActivity, { passive: true });
  });
}

// ── Countdown overlay ────────────────────────
function mlt_createWarningOverlay() {
  if (document.getElementById('mlt_idle_overlay')) return;
  const el = document.createElement('div');
  el.id = 'mlt_idle_overlay';
  el.innerHTML = `
    <div id="mlt_idle_box">
      <div id="mlt_idle_icon">⏰</div>
      <div id="mlt_idle_title">Still there, Marvz?</div>
      <div id="mlt_idle_msg">You've been idle. Logging out in <strong id="mlt_idle_secs">120</strong>s for security.</div>
      <div id="mlt_idle_bar_wrap"><div id="mlt_idle_bar"></div></div>
      <button id="mlt_idle_stay">I'm still here — Stay signed in</button>
      <button id="mlt_idle_out">Sign Out Now</button>
    </div>`;
  document.body.appendChild(el);

  const style = document.createElement('style');
  style.textContent = `
    #mlt_idle_overlay{
      position:fixed;inset:0;background:rgba(0,0,0,0.75);
      display:flex;align-items:center;justify-content:center;
      z-index:99999;padding:20px;backdrop-filter:blur(8px);
      animation:mlt_fadeIn 0.3s ease;
    }
    @keyframes mlt_fadeIn{from{opacity:0}to{opacity:1}}
    #mlt_idle_box{
      background:#1a1d27;border:0.5px solid rgba(255,209,102,0.3);
      border-radius:20px;padding:32px 28px;max-width:360px;width:100%;
      text-align:center;box-shadow:0 24px 80px rgba(0,0,0,0.6);
      animation:mlt_slideUp 0.3s ease;
    }
    @keyframes mlt_slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
    #mlt_idle_icon{font-size:44px;margin-bottom:14px;animation:mlt_pulse 1s ease infinite}
    @keyframes mlt_pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
    #mlt_idle_title{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:#f0f2ff;margin-bottom:8px}
    #mlt_idle_msg{font-size:13px;color:#8b90b0;line-height:1.65;margin-bottom:20px}
    #mlt_idle_msg strong{color:#ffd166;font-size:20px;font-family:'Syne',sans-serif}
    #mlt_idle_bar_wrap{background:#22263a;border-radius:99px;height:6px;overflow:hidden;margin-bottom:20px}
    #mlt_idle_bar{height:6px;border-radius:99px;background:#ffd166;width:100%;transition:width 1s linear}
    #mlt_idle_stay{
      width:100%;padding:13px;border:none;border-radius:10px;
      background:#ffd166;color:#000;font-family:'Syne',sans-serif;
      font-size:14px;font-weight:800;cursor:pointer;margin-bottom:10px;
      transition:opacity 0.15s;
    }
    #mlt_idle_stay:hover{opacity:0.85}
    #mlt_idle_out{
      background:transparent;border:0.5px solid rgba(255,255,255,0.1);
      border-radius:10px;padding:10px;width:100%;
      color:#8b90b0;font-size:13px;cursor:pointer;font-family:inherit;
      transition:background 0.15s;
    }
    #mlt_idle_out:hover{background:rgba(255,92,122,0.1);color:#ff5c7a;border-color:rgba(255,92,122,0.3)}
  `;
  document.head.appendChild(style);

  document.getElementById('mlt_idle_stay').addEventListener('click', mlt_dismissWarning);
  document.getElementById('mlt_idle_out').addEventListener('click', mlt_forceLogout);
}

function mlt_removeWarningOverlay() {
  const el = document.getElementById('mlt_idle_overlay');
  if (el) el.remove();
}

function mlt_dismissWarning() {
  mlt_updateActivity();
  mlt_removeWarningOverlay();
  clearInterval(window._mlt_countdownTimer);
}

function mlt_forceLogout() {
  mlt_clearSession();
  window.location.href = 'index.html';
}

// ── Main idle checker ────────────────────────
let _mlt_warnShowing  = false;
let _mlt_countdownTimer = null;

function mlt_checkIdle() {
  const session    = mlt_getSession();
  if (!session) return; // not logged in — nothing to do

  const lastActive = mlt_getLastActive();
  const now        = Date.now();
  const idle       = now - lastActive;
  const warnAt     = IDLE_TIMEOUT_MS - WARN_BEFORE_MS;

  if (idle >= IDLE_TIMEOUT_MS) {
    // Time's up — logout
    mlt_forceLogout();
    return;
  }

  if (idle >= warnAt && !_mlt_warnShowing) {
    // Show warning countdown
    _mlt_warnShowing = true;
    mlt_createWarningOverlay();

    const totalSecs = Math.round(WARN_BEFORE_MS / 1000);
    let remaining   = Math.round((IDLE_TIMEOUT_MS - idle) / 1000);

    function tick() {
      const secsEl = document.getElementById('mlt_idle_secs');
      const barEl  = document.getElementById('mlt_idle_bar');
      if (!secsEl) { _mlt_warnShowing = false; return; }
      secsEl.textContent = remaining;
      if (barEl) barEl.style.width = (remaining / totalSecs * 100) + '%';
      if (remaining <= 0) { mlt_forceLogout(); return; }
      remaining--;
    }
    tick();
    _mlt_countdownTimer = setInterval(tick, 1000);
    return;
  }

  if (idle < warnAt && _mlt_warnShowing) {
    // User acted — dismiss warning
    _mlt_warnShowing = false;
    mlt_removeWarningOverlay();
    clearInterval(_mlt_countdownTimer);
  }
}

// ── Boot ─────────────────────────────────────
function mlt_initIdleLogout() {
  mlt_updateActivity(); // mark active on load
  mlt_bindActivity();
  setInterval(mlt_checkIdle, 10000); // check every 10 seconds
}

// Auto-start when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mlt_initIdleLogout);
} else {
  mlt_initIdleLogout();
}
