/* ==========================================================================
   FOREVER WORLD — Efectos Visuales, Partículas Pixeladas, Splash y SFX 8-bit
   ========================================================================== */

window.FW_FX = (() => {
  'use strict';

  const SFX_KEY = 'forever_world_sfx';
  const SPLASHES = [
    '¡100% Vanilla!',
    '¡Larga vida a Miscolandia!',
    '¡Cuidado con la Aduana!',
    '¡A auditar obras!',
    '¡Sin granjas en Era I!',
    '¡Nueva Alejandría × Luthadel!',
    '¡26.4-snapshot!',
    '¡Sella tus leyes!',
    '¡Protege tus aldeanos!'
  ];

  const PALETTES = {
    xp: ['#80ff20', '#a3e635', '#ffff55', '#ffffff'],
    emerald: ['#17dd62', '#55ff55', '#a7f3d0', '#ffaa00'],
    gold: ['#ffaa00', '#ffff55', '#fef08a', '#ffffff'],
    diamond: ['#55ffff', '#3de0e8', '#cffafe', '#ffffff'],
    amethyst: ['#d07cff', '#a855f7', '#f0abfc', '#ffffff'],
    redstone: ['#ff5555', '#e03c31', '#fca5a5'],
    celebrate: ['#ffaa00', '#ffff55', '#80ff20', '#55ffff', '#d07cff', '#ffffff']
  };

  let initialized = false;
  let splashIdx = Math.floor(Math.random() * SPLASHES.length);
  let audioCtx = null;
  let lastClickPos = { x: 0, y: 0, t: 0 };

  function reducedMotion() {
    return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isSoundEnabled() {
    try { return localStorage.getItem(SFX_KEY) === '1'; } catch { return false; }
  }

  function syncSfxButton() {
    const btn = document.getElementById('hud-sfx-btn');
    if (!btn) return;
    const on = isSoundEnabled();
    btn.classList.toggle('sfx-on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.title = on ? 'Sonidos estilo Minecraft activados (clic para silenciar)' : 'Sonidos estilo Minecraft desactivados (clic para activar)';
    const lbl = btn.querySelector('.sfx-label');
    if (lbl) lbl.textContent = on ? 'SFX ON' : 'SFX';
  }

  function toggleSound() {
    const next = !isSoundEnabled();
    try { localStorage.setItem(SFX_KEY, next ? '1' : '0'); } catch {}
    syncSfxButton();
    if (next) playSound('xp');
    return next;
  }

  function ensureAudio() {
    if (!isSoundEnabled() || typeof window === 'undefined') return null;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) {
      try { audioCtx = new Ctx(); } catch { return null; }
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function tone(ctx, freq, startOffset, duration, type = 'triangle', gainPeak = 0.06, endFreq = null) {
    const now = ctx.currentTime + startOffset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function playSound(kind = 'click') {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      if (kind === 'tab') {
        tone(ctx, 420, 0, 0.04, 'triangle', 0.035, 520);
      } else if (kind === 'xp') {
        tone(ctx, 880, 0, 0.09, 'sine', 0.055, 960);
        tone(ctx, 1318, 0.075, 0.14, 'sine', 0.05, 1396);
      } else if (kind === 'levelup') {
        tone(ctx, 523.25, 0, 0.09, 'triangle', 0.055);
        tone(ctx, 659.25, 0.08, 0.09, 'triangle', 0.055);
        tone(ctx, 783.99, 0.16, 0.1, 'triangle', 0.06);
        tone(ctx, 1046.5, 0.25, 0.22, 'sine', 0.065);
      } else if (kind === 'coin') {
        tone(ctx, 740, 0, 0.06, 'sine', 0.045);
        tone(ctx, 1108, 0.055, 0.11, 'sine', 0.045);
      } else if (kind === 'fail') {
        tone(ctx, 190, 0, 0.11, 'sawtooth', 0.035, 135);
      } else {
        tone(ctx, 540, 0, 0.045, 'square', 0.028, 360);
      }
    } catch {}
  }

  function createAmbient() {
    if (reducedMotion() || !document.body || document.getElementById('mc-ambient')) return;
    const wrap = document.createElement('div');
    wrap.id = 'mc-ambient';
    wrap.setAttribute('aria-hidden', 'true');
    const types = ['amb-ember', 'amb-xp', 'amb-ember', 'amb-amethyst'];
    const count = 16;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('span');
      const kind = types[i % types.length];
      dot.className = `mc-amb-dot ${kind}`;
      const size = i % 3 === 0 ? 5 : 4;
      const left = ((i * 6.3 + (i % 4) * 1.9) % 96) + 2;
      const dur = 9 + (i % 5) * 2.1;
      const delay = -((i * 1.37) % dur);
      const drift = ((i % 2 === 0 ? 1 : -1) * (10 + (i % 4) * 6));
      const op = (0.28 + (i % 4) * 0.1).toFixed(2);
      dot.style.cssText = `--x:${left.toFixed(1)}vw;--dur:${dur.toFixed(1)}s;--delay:${delay.toFixed(2)}s;--drift:${drift}px;--size:${size}px;--op:${op};`;
      wrap.appendChild(dot);
    }
    document.body.prepend(wrap);

    const syncVis = () => document.body.classList.toggle('mc-paused', document.hidden);
    document.addEventListener('visibilitychange', syncVis);
    syncVis();
  }

  function resolveBurstCoords(targetOrX, yOrTheme, maybeTheme) {
    if (typeof targetOrX === 'number' && typeof yOrTheme === 'number') {
      return { x: targetOrX, y: yOrTheme, theme: maybeTheme || 'xp' };
    }
    const theme = (typeof yOrTheme === 'string' ? yOrTheme : maybeTheme) || 'xp';
    if (targetOrX && typeof targetOrX.getBoundingClientRect === 'function') {
      const rect = targetOrX.getBoundingClientRect();
      if (rect.width || rect.height) {
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, theme };
      }
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 3, theme };
  }

  function burst(targetOrX, yOrTheme, maybeTheme) {
    if (reducedMotion() || !document.body) return;
    const { x, y, theme } = resolveBurstCoords(targetOrX, yOrTheme, maybeTheme);
    const colors = PALETTES[theme] || PALETTES.xp;
    const count = theme === 'celebrate' ? 22 : 12;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'mc-particle';
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
      const dist = (theme === 'celebrate' ? 42 : 28) + Math.random() * (theme === 'celebrate' ? 54 : 34);
      const dx = Math.round(Math.cos(angle) * dist);
      const dy = Math.round(Math.sin(angle) * dist - (theme === 'celebrate' ? 16 : 10));
      const rot = Math.round((Math.random() - 0.5) * 180);
      const size = theme === 'celebrate' && i % 3 === 0 ? 7 : i % 2 === 0 ? 6 : 4;
      const color = colors[i % colors.length];
      p.style.left = `${Math.round(x)}px`;
      p.style.top = `${Math.round(y)}px`;
      p.style.setProperty('--dx', `${dx}px`);
      p.style.setProperty('--dy', `${dy}px`);
      p.style.setProperty('--rot', `${rot}deg`);
      p.style.setProperty('--size', `${size}px`);
      p.style.setProperty('--c', color);
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 700);
    }
  }

  function burstAtLastClick(theme = 'emerald') {
    if (Date.now() - lastClickPos.t > 1400) return;
    burst(lastClickPos.x, lastClickPos.y, theme);
  }

  function initSplash() {
    const el = document.getElementById('hud-splash');
    if (!el) return;
    el.textContent = SPLASHES[splashIdx];
    el.addEventListener('click', () => {
      splashIdx = (splashIdx + 1) % SPLASHES.length;
      el.textContent = SPLASHES[splashIdx];
      el.classList.remove('splash-pop');
      void el.offsetWidth;
      el.classList.add('splash-pop');
      setTimeout(() => el.classList.remove('splash-pop'), 320);
      burst(el, 'gold');
      playSound('click');
    });
  }

  function bindGlobalInteractions() {
    document.addEventListener('click', e => {
      const target = e.target && e.target.closest ? e.target : null;
      if (!target) return;

      if (e.clientX || e.clientY) {
        lastClickPos = { x: e.clientX, y: e.clientY, t: Date.now() };
      } else {
        const rect = target.getBoundingClientRect();
        lastClickPos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, t: Date.now() };
      }

      if (target.closest('#hud-sfx-btn')) {
        toggleSound();
        burst(target.closest('#hud-sfx-btn'), isSoundEnabled() ? 'xp' : 'redstone');
        return;
      }

      if (target.closest('#hud-splash') || target.closest('.hotbar-tab')) return;

      if (target.closest('.mc-btn:not(:disabled)')) {
        playSound('click');
      } else if (target.closest('.filter-pill, .era-chip, .eco-quick-chip, .subnav-btn')) {
        playSound('tab');
      }
    }, true);
  }

  function init() {
    if (initialized) return;
    initialized = true;
    createAmbient();
    initSplash();
    syncSfxButton();
    bindGlobalInteractions();
  }

  return {
    init,
    burst,
    burstAtLastClick,
    playSound,
    isSoundEnabled,
    toggleSound
  };
})();
