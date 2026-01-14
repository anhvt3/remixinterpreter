import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// Full system prompt from Desc_Pytagoras_Theorem_Sample.docx
const systemPrompt = `Below is the example of expected result:

Below is a JSXGraph re-generation script for the uploaded MP4 (9:16, 576×1024, ~30fps, ~27.2s). It’s written as a timeline-driven vector animation: every visible element is a JSXGraph object (texts, points, segments, polygons), and all motion is done by animating point coordinates + opacities over time.
Because TikTok compression blurs some edges, the exact pixel-perfect vertices of the triangles/squares can’t be measured to the single pixel just by eyeballing frames — but the structure, sequencing, timings, and transformations match the video, and the geometry is consistent (the classic Pythagorean dissection). If you want absolute pixel-perfect matching, tell me and I’ll refine the coordinates by sampling more frames and fitting edges.
________________________________________
1) What this script recreates (scene breakdown)
Scene A (0–5s)
•	“Powered by Mathos AI” + watermark
•	Title: The Pythagorean Theorem
•	A right triangle appears (legs labeled a, b, hypotenuse c)
•	Equation appears in a rounded rectangle: a² + b² = c²
Scene B (5–11s)
•	4 congruent right triangles rearrange to form a big square with a tilted inner square (side c)
•	Inner square labeled c then c², highlighted
Scene C (11–24s)
•	“c² =” appears at bottom with a small square icon
•	Triangles rearrange into a second configuration showing two squares: a² and b²
•	Bottom equation evolves: c² = [icon] = a² + b² → final: c² = a² + b²
Outro (24–27s)
•	Fade to logo/watermark
________________________________________
2) Full JSXGraph HTML + JS (copy-paste runnable)
Save as pythagorean_tiktok.jsxgraph.html and open in a browser.
Important: This uses a pixel coordinate system: bounding box [0, 1024, 576, 0] so you can place objects like in video editors.
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Pythagorean TikTok Rebuild (JSXGraph)</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraph.css" />
  <script src="https://cdn.jsdelivr.net/npm/jsxgraph/distrib/jsxgraphcore.js"></script>
  <style>
    html, body { margin:0; padding:0; background:#000; height:100%; }
    #box { width:576px; height:1024px; margin:0 auto; background:#000; }
  </style>
</head>
<body>
<div id="box"></div>

<script>
(() => {
  // -----------------------------
  // 0) Board init (pixel coords)
  // -----------------------------
  const W = 576, H = 1024;
  const board = JXG.JSXGraph.initBoard('box', {
    boundingbox: [0, H, W, 0],   // xMin, yMax, xMax, yMin
    axis: false,
    showNavigation: false,
    showCopyright: false,
    keepaspectratio: false,
    pan: {enabled:false},
    zoom: {enabled:false}
  });

  // Helpers
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const clamp01 = t => Math.max(0, Math.min(1, t));

  function nowMs() { return performance.now(); }

  // A simple timeline engine:
  // - schedule "events" at times in seconds
  // - animate attributes via requestAnimationFrame
  const anim = {
    t0ms: null,
    runningTweens: [],
    events: [],
    started: false
  };

  function sec() {
    if (anim.t0ms === null) return 0;
    return (nowMs() - anim.t0ms) / 1000;
  }

  function tween({t0, dur, update, ease=easeOutCubic, done}) {
    anim.runningTweens.push({t0, dur, update, ease, done, finished:false});
  }

  function at(t, fn) { anim.events.push({t, fn, fired:false}); }

  function tick() {
    const t = sec();

    // fire events
    for (const e of anim.events) {
      if (!e.fired && t >= e.t) { e.fired = true; e.fn(); }
    }

    // update tweens
    for (const tw of anim.runningTweens) {
      if (tw.finished) continue;
      const u = clamp01((t - tw.t0) / tw.dur);
      const k = tw.ease(u);
      tw.update(k, u);
      if (u >= 1 && !tw.finished) {
        tw.finished = true;
        if (tw.done) tw.done();
      }
    }

    board.update();
    requestAnimationFrame(tick);
  }

  function setOpacity(el, alpha) {
    // JSXGraph uses strokeOpacity / fillOpacity where applicable
    // Text: use css style 'opacity' via setAttribute isn't perfect; use "visible" and color alpha approximation.
    // We'll do best-effort: for text we flip visible near 0 and use color with rgba.
    if (!el) return;
    if (el.type === JXG.OBJECT_TYPE_TEXT) {
      const base = el._baseColor || "#FFFFFF";
      el.setAttribute({visible: alpha > 0.02});
      // if base is hex, convert to rgba:
      el.setAttribute({strokeColor: hexToRgba(base, alpha), fillColor: hexToRgba(base, alpha)});
    } else {
      el.setAttribute({
        visible: alpha > 0.02,
        strokeOpacity: alpha,
        fillOpacity: alpha
      });
    }
  }

  function hexToRgba(hex, a) {
    // Accept "#RRGGBB"
    if (!hex || hex[0] !== '#' || hex.length !== 7) return \`rgba(255,255,255,\${a})\`;
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return \`rgba(\${r},\${g},\${b},\${a})\`;
  }

  function fadeIn(el, t0, dur) {
    tween({
      t0, dur,
      update: (k) => setOpacity(el, k)
    });
  }
  function fadeOut(el, t0, dur) {
    tween({
      t0, dur,
      update: (k) => setOpacity(el, 1-k)
    });
  }

  function movePoint(p, t0, dur, x0, y0, x1, y1) {
    tween({
      t0, dur,
      update: (k) => {
        p.setPosition(JXG.COORDS_BY_USER, [x0 + (x1-x0)*k, y0 + (y1-y0)*k]);
      }
    });
  }

  // -----------------------------
  // 1) Global style constants
  // -----------------------------
  const COL = {
    bg: "#000000",
    white: "#FFFFFF",
    muted: "#7A7A7A",
    title: "#2FB9FF",
    red: "#E74C3C",
    yellow: "#FFD54A",
    teal: "#29D7D7",
    greenish: "#B9FFB9" // used for area fill highlight in video
  };

  // -----------------------------
  // 2) Static overlay texts (watermarks)
  // -----------------------------
  const watermark = board.create('text', [W/2 - 95, 35, "MATH \u03C0 CENTRAL"], {
    fontSize: 16,
    strokeColor: COL.muted,
    fillColor: COL.muted,
    fixed: true,
    anchorX: 'left',
    anchorY: 'bottom'
  });
  watermark._baseColor = COL.muted;

  const powered = board.create('text', [W/2 - 85, 70, "Powered by Mathos AI"], {
    fontSize: 16,
    strokeColor: COL.muted,
    fillColor: COL.muted,
    fixed: true,
    anchorX: 'left',
    anchorY: 'bottom'
  });
  powered._baseColor = COL.muted;

  // start visible then fade later like video
  setOpacity(powered, 1.0);
  setOpacity(watermark, 1.0);

  // -----------------------------
  // 3) Title + equation badge
  // -----------------------------
  const title = board.create('text', [W/2 - 165, 235, "The Pythagorean Theorem"], {
    fontSize: 26,
    strokeColor: COL.title,
    fillColor: COL.title,
    fixed: true
  });
  title._baseColor = COL.title;
  setOpacity(title, 0);

  // rounded rectangle behind equation (approx)
  // JSXGraph doesn't have native rounded-rect; approximate with polygon + thick border.
  const eqBoxP = [
    board.create('point', [120, 300], {visible:false, fixed:true}),
    board.create('point', [456, 300], {visible:false, fixed:true}),
    board.create('point', [456, 360], {visible:false, fixed:true}),
    board.create('point', [120, 360], {visible:false, fixed:true}),
  ];
  const eqBox = board.create('polygon', eqBoxP, {
    borders: {strokeColor: COL.yellow, strokeWidth: 3, strokeOpacity: 0},
    fillColor: "rgba(0,0,0,0)",
    fillOpacity: 0,
    hasInnerPoints: false,
    fixed: true
  });
  setOpacity(eqBox, 0);

  const eqText = board.create('text', [W/2 - 90, 335, "a\u00B2 + b\u00B2 = c\u00B2"], {
    fontSize: 28,
    strokeColor: COL.white,
    fillColor: COL.white,
    fixed: true
  });
  eqText._baseColor = COL.white;
  setOpacity(eqText, 0);

  // -----------------------------
  // 4) Base triangle (Scene A)
  // -----------------------------
  // Coordinates are tuned to resemble the video composition.
  // Right triangle:
  // A (left-bottom), B (left-top), C (right-bottom)
  const A = board.create('point', [180, 650], {visible:false, fixed:true});
  const B = board.create('point', [180, 450], {visible:false, fixed:true});
  const C = board.create('point', [380, 650], {visible:false, fixed:true});

  const tri1 = board.create('polygon', [A,B,C], {
    borders: {strokeColor: COL.white, strokeWidth: 3, strokeOpacity: 0},
    fillColor: COL.red,
    fillOpacity: 0,
    hasInnerPoints: false,
    fixed: true
  });

  // side labels
  const la = board.create('text', [270, 675, "a"], {fontSize: 22, strokeColor: COL.white, fillColor: COL.white, fixed:true});
  const lb = board.create('text', [150, 550, "b"], {fontSize: 22, strokeColor: COL.white, fillColor: COL.white, fixed:true});
  const lc = board.create('text', [290, 525, "c"], {fontSize: 22, strokeColor: COL.white, fillColor: COL.white, fixed:true});
  la._baseColor = lb._baseColor = lc._baseColor = COL.white;
  setOpacity(la,0); setOpacity(lb,0); setOpacity(lc,0);
  setOpacity(tri1,0);

  // -----------------------------
  // 5) Dissection square configuration 1 (Scene B)
  // -----------------------------
  // Outer square corners (big square side approx 320)
  const S0 = board.create('point', [128, 450], {visible:false, fixed:true});
  const S1 = board.create('point', [448, 450], {visible:false, fixed:true});
  const S2 = board.create('point', [448, 770], {visible:false, fixed:true});
  const S3 = board.create('point', [128, 770], {visible:false, fixed:true});

  const outerSq = board.create('polygon', [S0,S1,S2,S3], {
    borders: {strokeColor: COL.white, strokeWidth: 3, strokeOpacity: 0},
    fillColor: "rgba(0,0,0,0)",
    fillOpacity: 0,
    hasInnerPoints: false,
    fixed: true
  });
  setOpacity(outerSq, 0);

  // Four triangles around a central tilted square (side c)
  // We'll reuse 4 triangles with their own points so we can animate rearrangements later.
  function makeTri(name, pts, color=COL.red) {
    const [p,q,r] = pts.map(xy => board.create('point', xy, {visible:false, fixed:true}));
    const poly = board.create('polygon', [p,q,r], {
      borders: {strokeColor: COL.white, strokeWidth: 2, strokeOpacity: 0},
      fillColor: color,
      fillOpacity: 0,
      hasInnerPoints: false,
      fixed: true
    });
    poly._name = name;
    return {p,q,r, poly};
  }

  // Config 1 points (roughly matches classic)
  const T1 = makeTri("T1", [[128,450],[128,650],[288,610]]);
  const T2 = makeTri("T2", [[448,450],[288,610],[448,610]]);
  const T3 = makeTri("T3", [[448,770],[448,610],[288,650]]);
  const T4 = makeTri("T4", [[128,770],[288,650],[128,650]]);

  // Central tilted square (a polygon) – initially black fill
  const C0 = board.create('point', [288, 610], {visible:false, fixed:true});
  const C1 = board.create('point', [328, 650], {visible:false, fixed:true});
  const C2 = board.create('point', [288, 690], {visible:false, fixed:true});
  const C3 = board.create('point', [248, 650], {visible:false, fixed:true});

  const innerSq = board.create('polygon', [C0,C1,C2,C3], {
    borders: {strokeColor: COL.white, strokeWidth: 3, strokeOpacity: 0},
    fillColor: "#000000",
    fillOpacity: 0,
    hasInnerPoints: false,
    fixed: true
  });
  setOpacity(innerSq, 0);

  // Inner label "c" then "c²"
  const cLabel = board.create('text', [W/2 - 6, 660, "c"], {
    fontSize: 26, strokeColor: COL.white, fillColor: COL.white, fixed:true
  });
  cLabel._baseColor = COL.white;
  setOpacity(cLabel, 0);

  const c2Label = board.create('text', [W/2 - 14, 660, "c\u00B2"], {
    fontSize: 26, strokeColor: COL.white, fillColor: COL.white, fixed:true
  });
  c2Label._baseColor = COL.white;
  setOpacity(c2Label, 0);

  // highlight frame around innerSq (yellow stroke)
  const innerHighlight = board.create('polygon', [C0,C1,C2,C3], {
    borders: {strokeColor: COL.yellow, strokeWidth: 4, strokeOpacity: 0},
    fillColor: COL.greenish,
    fillOpacity: 0,
    hasInnerPoints: false,
    fixed: true
  });
  setOpacity(innerHighlight, 0);

  // -----------------------------
  // 6) Bottom equation region (Scene C)
  // -----------------------------
  const bottomEq = board.create('text', [120, 860, "c\u00B2 ="], {
    fontSize: 32, strokeColor: COL.white, fillColor: COL.white, fixed:true
  });
  bottomEq._baseColor = COL.white;
  setOpacity(bottomEq, 0);

  // Small square icon placeholder next to "c² ="
  const q0 = board.create('point', [240, 840], {visible:false, fixed:true});
  const q1 = board.create('point', [290, 840], {visible:false, fixed:true});
  const q2 = board.create('point', [290, 890], {visible:false, fixed:true});
  const q3 = board.create('point', [240, 890], {visible:false, fixed:true});
  const iconSq = board.create('polygon', [q0,q1,q2,q3], {
    borders: {strokeColor: COL.white, strokeWidth: 3, strokeOpacity: 0},
    fillColor: COL.yellow,
    fillOpacity: 0,
    fixed: true,
    hasInnerPoints: false
  });
  setOpacity(iconSq, 0);

  const midEq = board.create('text', [305, 860, "="], {
    fontSize: 32, strokeColor: COL.white, fillColor: COL.white, fixed:true
  });
  midEq._baseColor = COL.white;
  setOpacity(midEq, 0);

  const rhsEq = board.create('text', [340, 860, "a\u00B2 + b\u00B2"], {
    fontSize: 32, strokeColor: COL.white, fillColor: COL.white, fixed:true
  });
  rhsEq._baseColor = COL.white;
  setOpacity(rhsEq, 0);

  const finalEq = board.create('text', [120, 910, "c\u00B2 = a\u00B2 + b\u00B2"], {
    fontSize: 34, strokeColor: COL.white, fillColor: COL.white, fixed:true
  });
  finalEq._baseColor = COL.white;
  setOpacity(finalEq, 0);

  // -----------------------------
  // 7) Configuration 2: shows a² and b² blocks
  // -----------------------------
  // We'll animate T1..T4 points into a second arrangement inside the same outer square.
  // Then show two axis-aligned black squares (a² big and b² small) and label/fill them.
  const aSqP = [
    board.create('point', [288, 610], {visible:false, fixed:true}),
    board.create('point', [448, 610], {visible:false, fixed:true}),
    board.create('point', [448, 770], {visible:false, fixed:true}),
    board.create('point', [288, 770], {visible:false, fixed:true})
  ];
  const aSq = board.create('polygon', aSqP, {
    borders: {strokeColor: COL.white, strokeWidth: 3, strokeOpacity: 0},
    fillColor: "#000000",
    fillOpacity: 0,
    fixed: true
  });
  setOpacity(aSq, 0);

  const bSqP = [
    board.create('point', [128, 450], {visible:false, fixed:true}),
    board.create('point', [288, 450], {visible:false, fixed:true}),
    board.create('point', [288, 610], {visible:false, fixed:true}),
    board.create('point', [128, 610], {visible:false, fixed:true})
  ];
  const bSq = board.create('polygon', bSqP, {
    borders: {strokeColor: COL.white, strokeWidth: 3, strokeOpacity: 0},
    fillColor: "#000000",
    fillOpacity: 0,
    fixed: true
  });
  setOpacity(bSq, 0);

  const a2 = board.create('text', [350, 700, "a\u00B2"], {fontSize: 30, strokeColor: COL.white, fillColor: COL.white, fixed:true});
  const b2 = board.create('text', [190, 540, "b\u00B2"], {fontSize: 30, strokeColor: COL.white, fillColor: COL.white, fixed:true});
  a2._baseColor = b2._baseColor = COL.white;
  setOpacity(a2,0); setOpacity(b2,0);

  const aFill = board.create('polygon', aSqP, {
    borders: {strokeColor: COL.yellow, strokeWidth: 4, strokeOpacity: 0},
    fillColor: COL.greenish,
    fillOpacity: 0,
    fixed: true
  });
  setOpacity(aFill, 0);

  const bFill = board.create('polygon', bSqP, {
    borders: {strokeColor: COL.yellow, strokeWidth: 4, strokeOpacity: 0},
    fillColor: COL.greenish,
    fillOpacity: 0,
    fixed: true
  });
  setOpacity(bFill, 0);

  // -----------------------------
  // 8) Timeline (times chosen to match the MP4)
  // -----------------------------
  // NOTE: These timings match the *visible beats* in your frames:
  // 0-2: watermarks present
  // ~1: title in
  // ~3-4: equation badge in
  // ~5-10: config 1 (inner c square)
  // ~11-24: config 2 + bottom equation resolves
  // ~24-27: outro
  //
  // If you want frame-exact: we can refine to per-frame (1/30s) cues.

  function showTriangleScene() {
    // Fade in triangle + labels
    fadeIn(tri1, sec(), 0.5);
    // also show border
    tri1.setAttribute({borders: {strokeOpacity: 1}});
    fadeIn(la, sec()+0.15, 0.35);
    fadeIn(lb, sec()+0.20, 0.35);
    fadeIn(lc, sec()+0.25, 0.35);
  }

  function showConfig1() {
    // Fade out single triangle
    fadeOut(tri1, sec(), 0.35);
    fadeOut(la, sec(), 0.25);
    fadeOut(lb, sec(), 0.25);
    fadeOut(lc, sec(), 0.25);

    // Fade in outer square + 4 triangles + inner square
    outerSq.setAttribute({borders: {strokeOpacity: 1}});
    fadeIn(outerSq, sec()+0.15, 0.4);

    for (const T of [T1,T2,T3,T4]) {
      T.poly.setAttribute({borders:{strokeOpacity:1}});
      fadeIn(T.poly, sec()+0.2, 0.4);
    }

    innerSq.setAttribute({borders:{strokeOpacity:1}});
    fadeIn(innerSq, sec()+0.3, 0.4);

    // "c" appears, then becomes "c²"
    fadeIn(cLabel, sec()+0.8, 0.35);
    fadeOut(cLabel, sec()+2.2, 0.25);
    fadeIn(c2Label, sec()+2.25, 0.25);

    // highlight c² square (fill greenish + yellow stroke)
    innerHighlight.setAttribute({borders:{strokeOpacity:1}});
    tween({
      t0: sec()+2.6, dur: 0.5,
      update: (k)=> {
        innerHighlight.setAttribute({fillOpacity: 0.65*k});
        innerHighlight.setAttribute({borders:{strokeOpacity: k}});
      }
    });
  }

  function showBottomEqIntro() {
    fadeIn(bottomEq, sec(), 0.35);
    iconSq.setAttribute({borders:{strokeOpacity:1}});
    fadeIn(iconSq, sec()+0.15, 0.35);
  }

  function toConfig2() {
    // fade out inner square highlight and c² label
    fadeOut(innerHighlight, sec(), 0.35);
    fadeOut(c2Label, sec(), 0.25);

    // switch inner square to invisible (config 1 concept disappears)
    fadeOut(innerSq, sec(), 0.25);

    // rearrange triangles: animate their points to form the "a² + b²" empty regions
    // These target coordinates approximate the second configuration seen in video.
    const t0 = sec()+0.2, dur = 0.9;

    // Helper to animate triangle points to new positions
    function morphTri(T, target) {
      const [P,Q,R] = [T.p, T.q, T.r];
      const [p0,q0,r0] = [P.coords.usrCoords, Q.coords.usrCoords, R.coords.usrCoords];
      // usrCoords = [1, x, y], grab x,y
      const sx = p0[1], sy = p0[2];
      const qx = q0[1], qy = q0[2];
      const rx = r0[1], ry = r0[2];

      movePoint(P, t0, dur, sx, sy, target[0][0], target[0][1]);
      movePoint(Q, t0, dur, qx, qy, target[1][0], target[1][1]);
      movePoint(R, t0, dur, rx, ry, target[2][0], target[2][1]);
    }

    // Targets tuned so the empty blocks align with aSq and bSq
    morphTri(T1, [[128,610],[128,770],[288,610]]);
    morphTri(T2, [[288,450],[448,450],[288,610]]);
    morphTri(T3, [[448,610],[448,770],[288,770]]);
    morphTri(T4, [[128,450],[288,450],[288,610]]);

    // show the two black squares (aSq and bSq) in config2
    aSq.setAttribute({borders:{strokeOpacity:1}});
    bSq.setAttribute({borders:{strokeOpacity:1}});
    fadeIn(aSq, t0+0.6, 0.4);
    fadeIn(bSq, t0+0.6, 0.4);

    // label and highlight a² then b²
    fadeIn(a2, t0+1.1, 0.3);
    aFill.setAttribute({borders:{strokeOpacity:1}});
    tween({
      t0: t0+1.35, dur: 0.45,
      update: (k)=> {
        aFill.setAttribute({fillOpacity: 0.65*k});
        aFill.setAttribute({borders:{strokeOpacity: k}});
      }
    });

    fadeIn(b2, t0+2.0, 0.3);
    bFill.setAttribute({borders:{strokeOpacity:1}});
    tween({
      t0: t0+2.25, dur: 0.45,
      update: (k)=> {
        bFill.setAttribute({fillOpacity: 0.65*k});
        bFill.setAttribute({borders:{strokeOpacity: k}});
      }
    });

    // Bottom equation becomes: c² = [icon] = a² + b²
    fadeIn(midEq, t0+2.8, 0.25);
    fadeIn(rhsEq, t0+2.85, 0.35);

    // Then final line: c² = a² + b² (icon removed)
    fadeIn(finalEq, t0+4.0, 0.35);
    fadeOut(bottomEq, t0+4.0, 0.25);
    fadeOut(iconSq, t0+4.0, 0.25);
    fadeOut(midEq, t0+4.0, 0.20);
    fadeOut(rhsEq, t0+4.0, 0.20);
  }

  // -----------------------------
  // 9) Schedule events (seconds)
  // -----------------------------
  anim.t0ms = nowMs();

  at(0.8, () => fadeIn(title, sec(), 0.5));                 // title in
  at(2.0, () => showTriangleScene());                       // triangle in
  at(3.2, () => { fadeIn(eqBox, sec(), 0.35); fadeIn(eqText, sec()+0.1, 0.35); eqBox.setAttribute({borders:{strokeOpacity:1}}); }); // equation badge in

  at(5.2, () => showConfig1());                             // dissection config 1
  at(11.2, () => showBottomEqIntro());                      // bottom "c² =" + icon
  at(12.4, () => toConfig2());                              // config 2 + equation derivation

  // outro: fade most things out
  at(24.6, () => {
    for (const el of [
      outerSq, innerSq, innerHighlight, cLabel, c2Label,
      T1.poly,T2.poly,T3.poly,T4.poly,
      aSq,bSq,aFill,bFill,a2,b2,
      eqBox,eqText,title,finalEq
    ]) fadeOut(el, sec(), 0.6);
  });

  // keep watermark; fade powered like in video end-card
  at(25.0, () => fadeOut(powered, sec(), 0.8));

  // -----------------------------
  // 10) Start loop
  // -----------------------------
  tick();
})();
</script>
</body>
</html>

3) Notes on “exactness” vs JSXGraph constraints
JSXGraph can reproduce this video very closely, but 3 things matter if you want pixel-perfect:
1.	Text rendering differs (TikTok uses different font/kerning).
o	Fix: embed a matching webfont and set CSS for the board container.
2.	Rounded rectangle with gradient stroke (TikTok effect) is not native in JSXGraph.
o	Fix: draw it as an SVG path overlay or use HTML/CSS element positioned over the board.
3.	Triangle vertex coordinates: I used geometry-consistent coordinates matching the dissection.
o	If you want exact vertex positions as in the MP4, tell me and I’ll produce a refined version with:
	per-frame fitted edges (line detection),
	exact triangle/square coordinates,
	exact timings to the frame (1/30s).
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");
    if (!videoUrl) throw new Error("Video URL is required");

    // Check if GDrive link - not supported
    if (videoUrl.includes('drive.google.com')) {
      return new Response(JSON.stringify({ 
        error: "Google Drive links are not supported for extraction. Please use a CDN video URL." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download video
    console.log("Downloading video from:", videoUrl);
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) throw new Error("Failed to download video");
    
    const videoBuffer = await videoResponse.arrayBuffer();
    
    // Check file size (5MB limit)
    if (videoBuffer.byteLength > MAX_SIZE_BYTES) {
      const actualSizeMB = (videoBuffer.byteLength / (1024 * 1024)).toFixed(2);
      return new Response(JSON.stringify({ 
        error: `Video file is too large (${actualSizeMB}MB). Maximum size is ${MAX_SIZE_MB}MB.` 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Video size: ${(videoBuffer.byteLength / (1024 * 1024)).toFixed(2)}MB`);

    // Convert to base64
    const base64Video = btoa(
      new Uint8Array(videoBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // Prepare prompt
    const prompt = `Extract the vector animation script from this video. Make sure it is as detailed as possible so it can be used to re-generate exactly the same video with JSXGraph. Remember to have 3 parts:

1) What this script recreates (scene breakdown)
2) Full JSXGraph HTML + JS (copy-paste runnable)
3) Notes on "exactness" vs JSXGraph constraints`;

    console.log("Calling Gemini API with system instruction...");

    // Call Gemini API with systemInstruction
    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": GEMINI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: "video/mp4", data: base64Video } }
            ]
          }]
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const result = await geminiResponse.json();
    const extractedText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log("Extraction successful, text length:", extractedText.length);

    return new Response(JSON.stringify({ description: extractedText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
