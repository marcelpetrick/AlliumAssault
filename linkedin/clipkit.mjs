// SPDX-FileCopyrightText: 2026 Marcel Petrick <mail@marcelpetrick.it>
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Recording harness shared by the LinkedIn clips.
 *
 * The game is driven through the window.__allium test hook in Google Chrome with fixed seeds and a
 * fixed frame step, so a clip re-records identically. Titles and lower thirds are DOM overlays
 * injected into the page — they use the game's own Fredoka font and are advanced frame by frame
 * instead of by CSS animation, so they stay in sync with the stepped simulation.
 *
 * Needs ffmpeg on the PATH and a preview server (`npm run build && npm run preview`).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

/** 4:5 is the shape with the most mobile feed space that LinkedIn still shows inline. */
export const WIDTH = 1080;
export const HEIGHT = 1350;
export const FPS = 30;

// ---------------------------------------------------------------------------- easing

export const clamp01 = (t) => Math.min(1, Math.max(0, t));
/** Progress from frame `a` to frame `b`, clamped to 0..1. */
export const ramp = (f, a, b) => clamp01((f - a) / (b - a));
export const easeOut = (t) => 1 - (1 - t) ** 3;
/** Overshoots past 1 before settling — the "pop" of a card snapping into place. */
export const easeOutBack = (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;
/** Fades in over `inLen` frames, holds, then fades out over `outLen` frames before `end`. */
export const hold = (f, start, end, inLen = 8, outLen = 8) => Math.min(ramp(f, start, start + inLen), 1 - ramp(f, end - outLen, end));

// ---------------------------------------------------------------------------- page overlay

/** Injected into the page: title card, lower thirds, corner badge, stat chip and closing card. */
const OVERLAY = `
(() => {
  const el = document.createElement('div');
  el.id = 'clip';
  el.innerHTML = \`
    <div class="clip-scrim"></div>
    <div class="clip-title">
      <div class="clip-eyebrow"></div>
      <h1 class="clip-h1"></h1>
      <div class="clip-sub"></div>
    </div>
    <div class="clip-chip"></div>
    <div class="clip-badge">🧄 Allium&nbsp;Assault</div>
    <div class="clip-count"><b class="clip-count-n"></b><span class="clip-count-t"></span></div>
    <div class="clip-label"><span class="clip-label-icon"></span><span class="clip-label-text"></span><b class="clip-label-sub"></b></div>
    <div class="clip-cta"><span class="clip-cta-top"></span><span class="clip-cta-url"></span></div>
    <div class="clip-chrome">
      <div class="clip-dots"><i></i><i></i><i></i></div>
      <div class="clip-tab">🧄 Allium Assault</div>
      <div class="clip-omni"><span class="clip-lock">🔒</span><span class="clip-url"></span><span class="clip-caret"></span></div>
    </div>
    <div class="clip-cursor"><svg viewBox="0 0 24 24" width="46" height="46"><path d="M5 2l14 9-6 1.4 3.2 6.1-2.9 1.5L10 14l-5 4z" fill="#fff" stroke="#111" stroke-width="1.4"/></svg><b class="clip-ring"></b></div>\`;
  document.body.appendChild(el);
  const style = document.createElement('style');
  style.textContent = \`
    #clip { position: fixed; inset: 0; z-index: 9999; pointer-events: none; font-family: 'Fredoka', system-ui, sans-serif; }
    #clip > * { position: absolute; opacity: 0; will-change: opacity, transform; }
    .clip-scrim { inset: 0; background: radial-gradient(125% 78% at 50% 44%, rgba(4,8,20,.34) 0%, rgba(4,8,20,.82) 100%); }
    .clip-title { inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; text-align: center; padding: 0 40px; }
    .clip-eyebrow { font-size: 30px; font-weight: 600; letter-spacing: .26em; text-transform: uppercase; color: #ffd166;
      padding: 10px 26px; border: 2px solid rgba(255,209,102,.5); border-radius: 999px; background: rgba(255,209,102,.12); }
    .clip-h1 { margin: 0; font-size: 112px; line-height: .96; font-weight: 700; letter-spacing: -.02em; color: #fff;
      text-shadow: 0 6px 0 rgba(0,0,0,.4), 0 0 70px rgba(120,220,120,.5); }
    .clip-h1 span { display: block; font-size: 74px; color: #8ce26b; }
    .clip-h1 em { font-style: normal; color: #ffd166; }
    .clip-sub { font-size: 34px; font-weight: 500; color: rgba(255,255,255,.9); }
    .clip-chip { top: 44px; right: 44px; font-size: 27px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase;
      color: #08130a; background: linear-gradient(180deg,#a8ef7e,#6fd04c); padding: 12px 22px; border-radius: 14px;
      box-shadow: 0 8px 22px rgba(0,0,0,.45); }
    .clip-badge { left: 44px; top: 44px; font-size: 27px; font-weight: 600; color: #fff; background: rgba(8,12,24,.62);
      border: 1px solid rgba(255,255,255,.18); padding: 11px 20px; border-radius: 14px; backdrop-filter: blur(6px); }
    .clip-count { right: 44px; top: 44px; display: flex; flex-direction: column; align-items: flex-end; line-height: 1; }
    .clip-count-n { font-size: 96px; font-weight: 700; color: #8ce26b; text-shadow: 0 4px 0 rgba(0,0,0,.45), 0 0 44px rgba(120,220,120,.6); }
    .clip-count-t { font-size: 26px; font-weight: 600; letter-spacing: .2em; text-transform: uppercase; color: #fff;
      text-shadow: 0 2px 10px rgba(0,0,0,.9); }
    .clip-label { left: 52px; bottom: 138px; display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; max-width: 90%;
      background: linear-gradient(90deg, rgba(8,12,24,.9), rgba(8,12,24,.4)); border-left: 7px solid #8ce26b;
      padding: 18px 30px 20px; border-radius: 0 18px 18px 0; box-shadow: 0 10px 30px rgba(0,0,0,.45); }
    .clip-label-icon { font-size: 48px; }
    .clip-label-text { font-size: 56px; font-weight: 700; color: #fff; letter-spacing: -.01em; }
    .clip-label-sub { font-size: 30px; font-weight: 500; color: #ffd166; }
    .clip-cta { inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; text-align: center; }
    .clip-cta-top { font-size: 46px; font-weight: 700; color: #fff; text-shadow: 0 4px 18px rgba(0,0,0,.85); white-space: pre-line; }
    .clip-cta-url { font-size: 32px; font-weight: 600; color: #08130a; background: linear-gradient(180deg,#a8ef7e,#6fd04c);
      padding: 14px 30px; border-radius: 999px; box-shadow: 0 10px 26px rgba(0,0,0,.5); }
    .clip-chrome { inset: 0 0 auto 0; height: 96px; display: flex; align-items: center; gap: 18px; padding: 0 22px;
      background: linear-gradient(180deg,#22262e,#171a20); border-bottom: 1px solid rgba(0,0,0,.6); box-shadow: 0 6px 20px rgba(0,0,0,.45); }
    .clip-dots { display: flex; gap: 9px; }
    .clip-dots i { width: 15px; height: 15px; border-radius: 50%; background: #ff5f57; }
    .clip-dots i:nth-child(2) { background: #febc2e; }
    .clip-dots i:nth-child(3) { background: #28c840; }
    .clip-tab { font-size: 24px; font-weight: 500; color: #e9edf5; background: #2e333d; padding: 11px 20px; border-radius: 11px 11px 0 0; }
    .clip-omni { flex: 1; display: flex; align-items: center; gap: 11px; background: #0f1218; border: 1px solid rgba(255,255,255,.1);
      border-radius: 999px; padding: 11px 22px; font-size: 25px; color: #dfe6f2; }
    .clip-lock { font-size: 20px; }
    .clip-caret { width: 3px; height: 28px; background: #8ce26b; }
    .clip-cursor { left: 0; top: 0; }
    .clip-ring { position: absolute; left: 6px; top: 6px; width: 54px; height: 54px; margin: -27px 0 0 -27px;
      border: 4px solid #8ce26b; border-radius: 50%; opacity: 0; }\`;
  document.head.appendChild(style);

  const q = (s) => el.querySelector(s);
  const parts = { scrim: q('.clip-scrim'), title: q('.clip-title'), chip: q('.clip-chip'),
    badge: q('.clip-badge'), count: q('.clip-count'), label: q('.clip-label'), cta: q('.clip-cta'),
    chrome: q('.clip-chrome') };
  window.__clip = {
    /** Applies one frame of overlay state; every part defaults to hidden. */
    set(s) {
      for (const [name, node] of Object.entries(parts)) {
        const v = s[name] ?? {};
        node.style.opacity = String(v.o ?? 0);
        node.style.transform = \`translateY(\${v.y ?? 0}px) scale(\${v.s ?? 1})\`;
      }
      if (s.title?.text) {
        q('.clip-eyebrow').textContent = s.title.eyebrow ?? '';
        q('.clip-h1').innerHTML = s.title.text;
        q('.clip-sub').textContent = s.title.sub ?? '';
      }
      if (s.label?.text) {
        q('.clip-label-icon').textContent = s.label.icon ?? '';
        q('.clip-label-text').textContent = s.label.text;
        q('.clip-label-sub').textContent = s.label.sub ?? '';
      }
      if (s.count?.n !== undefined) {
        q('.clip-count-n').textContent = s.count.n;
        q('.clip-count-t').textContent = s.count.t ?? '';
      }
      if (s.chip?.text) parts.chip.textContent = s.chip.text;
      // The headline and the URL pill are set independently: a card may carry only the link.
      if (s.cta?.text !== undefined) q('.clip-cta-top').textContent = s.cta.text;
      if (s.cta?.url) q('.clip-cta-url').textContent = s.cta.url;
      if (s.chrome?.url !== undefined) q('.clip-url').textContent = s.chrome.url;
      if (s.chrome) q('.clip-caret').style.opacity = String(s.chrome.caret ?? 0);
      // The cursor carries its own position, so it cannot go through the shared transform above.
      const cursor = q('.clip-cursor');
      cursor.style.opacity = String(s.cursor?.o ?? 0);
      cursor.style.transform = \`translate(\${s.cursor?.x ?? 0}px, \${s.cursor?.y ?? 0}px)\`;
      q('.clip-ring').style.opacity = String(s.cursor?.ring ?? 0);
      q('.clip-ring').style.transform = \`scale(\${s.cursor?.ringScale ?? 1})\`;
    },
    /** Pushes the game's own HUD below the browser chrome so the two never overlap. */
    browserFrame(on) {
      document.querySelector('#ui').style.inset = on ? '96px 0 0 0' : '0';
    },
    /** Scales a menu panel up so its options stay readable on a phone. */
    zoomPanel(factor) {
      const panel = document.querySelector('.panel');
      if (panel) {
        panel.style.transform = \`scale(\${factor})\`;
        panel.style.transformOrigin = 'center center';
      }
    },
  };
  // The narrow 4:5 viewport squeezes the HUD's control hint into an unreadable column.
  const hide = document.createElement('style');
  hide.textContent = '.hint { display: none !important; }';
  document.head.appendChild(hide);
})()`;

// ---------------------------------------------------------------------------- recorder

export class Clip {
  constructor(url) {
    this.url = url;
    this.dir = mkdtempSync(join(tmpdir(), 'allium-clip-'));
    this.frame = 0;
  }

  async open() {
    this.browser = await chromium.launch({
      channel: 'chrome',
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'],
    });
    this.page = await this.browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  }

  /** Reloads the game (a clean title screen) and re-injects the overlay. */
  async load() {
    await this.page.goto(`${this.url}/?quality=high`);
    await this.page.waitForFunction(() => window.__allium?.ready, null, { timeout: 180_000 });
    await this.page.evaluate(OVERLAY);
  }

  /**
   * Records `count` frames: step the simulation, apply that frame's overlay, screenshot.
   * `overlay(f)` gets the scene-local frame index; `dt` below 1/FPS gives slow motion.
   */
  async record(count, overlay = () => ({}), dt = 1 / FPS, from = 0) {
    for (let k = 0; k < count; k++) {
      await this.page.evaluate((step) => window.__allium.stepFrames(1, step), dt);
      await this.page.evaluate((s) => window.__clip.set(s), overlay(from + k));
      // Software rendering on a busy machine can take many seconds for one frame of a heavy scene.
      await this.page.screenshot({ path: join(this.dir, `f${String(this.frame++).padStart(4, '0')}.png`), timeout: 120_000 });
    }
  }

  /** Advances the simulation without recording — used to skip dead time. */
  skip(seconds) {
    return this.page.evaluate((s) => window.__allium.fastForward(s), seconds);
  }

  /** Starts a match and runs it to the first aiming phase, past the turn banner. */
  async match(seed, theme, extra = {}) {
    await this.page.evaluate(
      ([s, t, e]) =>
        window.__allium.startMatch({
          seed: s,
          teams: [
            { name: 'Garlic Gang', color: '#ef4b3c', controller: 'human', aiLevel: 'normal', buddyNames: ['Clovis', 'Aioli', 'Pesto'] },
            { name: 'Clove Crew', color: '#3d8bfd', controller: 'human', aiLevel: 'normal', buddyNames: ['Chive', 'Sprout', 'Toasty'] },
          ],
          turnTime: 90,
          retreatTime: 5,
          windMax: 0,
          crates: 0,
          theme: t,
          ...e,
        }),
      [seed, theme, extra],
    );
    await this.page.evaluate(() => window.__allium.setManual(true));
    await this.page.evaluate(() => {
      const app = window.__allium.app;
      for (let k = 0; k < 600 && app.game.phase !== 'aiming'; k++) app.fastForward(1 / 60);
    });
    // Let the turn banner play out so it never sits on top of a lower third.
    await this.page.evaluate(() => window.__allium.stepFrames(70, 1 / 30));
  }

  /** Faces the active buddy at the nearest enemy and sets its aim; returns the enemy position. */
  faceEnemy(aim) {
    return this.page.evaluate((a) => {
      const g = window.__allium.app.game;
      const me = g.activeBuddy;
      const enemy = g.buddies.filter((b) => b.team !== me.team && b.alive).sort((x, y) => Math.abs(x.body.x - me.body.x) - Math.abs(y.body.x - me.body.x))[0];
      g.face(enemy.body.x < me.body.x ? -1 : 1);
      me.aim = a;
      return { x: enemy.body.x, y: enemy.body.y };
    }, aim);
  }

  /**
   * Pulls the camera in. The world keeps following the action; this only sets how close it sits,
   * which is what makes a buddy read on a phone-sized 4:5 frame.
   */
  zoom(distance) {
    return this.page.evaluate((d) => {
      window.__allium.app.world.goalDistance = d;
    }, distance);
  }

  select(weapon) {
    return this.page.evaluate((w) => window.__allium.app.game.selectWeapon(w), weapon);
  }

  fire() {
    return this.page.evaluate(() => window.__allium.app.game.pressFire());
  }

  release() {
    return this.page.evaluate(() => window.__allium.app.game.releaseFire());
  }

  strike(x) {
    return this.page.evaluate((tx) => window.__allium.app.game.strike(tx), x);
  }

  async close() {
    await this.browser.close();
  }

  /** Encodes the captured frames to an MP4 that survives a LinkedIn upload, plus a poster frame. */
  encode(video, poster, posterFrame) {
    console.log(`captured ${this.frame} frames (${(this.frame / FPS).toFixed(1)} s) → encoding`);
    try {
      execFileSync('ffmpeg', [
        ...['-y', '-loglevel', 'error'],
        ...['-framerate', String(FPS), '-i', join(this.dir, 'f%04d.png')],
        // A silent stereo track: some feeds and players mishandle a video-only MP4.
        ...['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000'],
        ...['-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p'],
        ...['-profile:v', 'high', '-level', '4.1', '-r', String(FPS)],
        ...['-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart'],
        video,
      ]);
      execFileSync('ffmpeg', [...['-y', '-loglevel', 'error', '-i', join(this.dir, `f${String(posterFrame).padStart(4, '0')}.png`)], ...['-q:v', '3', poster]]);
    } finally {
      rmSync(this.dir, { recursive: true, force: true });
    }
    console.log(`wrote ${video}`);
  }
}
