import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// Full system prompt from Desc_Pytagoras_Theorem_Sample.docx
const systemPrompt = `Below is a JSXGraph re-generation script for the uploaded MP4 (9:16, 576×1024, ~30fps, ~27.2s). It's written as a timeline-driven vector animation: every visible element is a JSXGraph object (texts, points, segments, polygons), and all motion is done by animating point coordinates + opacities over time.

Because TikTok compression blurs some edges, the exact pixel-perfect vertices of the triangles/squares can't be measured to the single pixel just by eyeballing frames — but the structure, sequencing, timings, and transformations match the video, and the geometry is consistent (the classic Pythagorean dissection). If you want absolute pixel-perfect matching, tell me and I'll refine the coordinates by sampling more frames and fitting edges.

# 1) What this script recreates (scene breakdown)

# Scene A (0–5s)

- "Powered by Mathos AI" + watermark
- Title: The Pythagorean Theorem
- A right triangle appears (legs labeled a, b, hypotenuse c)
- Equation appears in a rounded rectangle: a² + b² = c²

# Scene B (5–11s)

- 4 congruent right triangles rearrange to form a big square with a tilted inner square (side c)
- Inner square labeled c then c², highlighted

# Scene C (11–24s)

- "c² =" appears at bottom with a small square icon
- Triangles rearrange into a second configuration showing two squares: a² and b²
- Bottom equation evolves: c² = [icon] = a² + b² → final: c² = a² + b²

# Outro (24–27s)

Fade to logo/watermark

# 2) Full JSXGraph HTML + JS (copy-paste runnable)

Save as pythagorean_tiktok.jsxgraph.html and open in a browser.

Important: This uses a pixel coordinate system: bounding box [0, 1024, 576, 0] so you can place objects like in video editors.

<!DOCTYPE html>
<html>
<head>
  <title>Pythagorean TikTok Rebuild (JSXGraph)</title>
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
  boundingbox: [0, H, W, 0],
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

// A simple timeline engine
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
  if (!el) return;
  if (el.type === JXG.OBJECT_TYPE_TEXT) {
    const base = el._baseColor || "#FFFFFF";
    el.setAttribute({visible: alpha > 0.02});
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
  let c = hex.replace('#','');
  if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
  const r = parseInt(c.substring(0,2),16);
  const g = parseInt(c.substring(2,4),16);
  const b = parseInt(c.substring(4,6),16);
  return \`rgba(\${r},\${g},\${b},\${a})\`;
}

function fadeIn(el, t0, dur) {
  tween({t0, dur, update: k => setOpacity(el, k)});
}
function fadeOut(el, t0, dur) {
  tween({t0, dur, update: k => setOpacity(el, 1 - k)});
}

// 1) Global style constants
const COL = {
  bg: "#000000",
  white: "#FFFFFF",
  muted: "#7A7A7A",
  title: "#2FB9FF",
  red: "#E74C3C",
  yellow: "#FFD54A",
  teal: "#29D7D7",
  greenish: "#B9FFB9"
};

// 2) Static overlay texts (watermarks)
const watermark = board.create('text', [W/2 - 95, 35, "MATH π CENTRAL"], {
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
setOpacity(powered, 1.0);
setOpacity(watermark, 1.0);

// 3) Title + equation badge
const title = board.create('text', [W/2 - 165, 235, "The Pythagorean Theorem"], {
  fontSize: 26,
  strokeColor: COL.title,
  fillColor: COL.title,
  fixed: true
});
title._baseColor = COL.title;
setOpacity(title, 0);

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

const eqText = board.create('text', [W/2 - 90, 335, "a² + b² = c²"], {
  fontSize: 28,
  strokeColor: COL.white,
  fillColor: COL.white,
  fixed: true
});
eqText._baseColor = COL.white;
setOpacity(eqText, 0);

// 4) Base triangle (Scene A)
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

const la = board.create('text', [270, 675, "a"], {fontSize: 22, strokeColor: COL.white, fillColor: COL.white, fixed:true});
const lb = board.create('text', [150, 550, "b"], {fontSize: 22, strokeColor: COL.white, fillColor: COL.white, fixed:true});
const lc = board.create('text', [290, 525, "c"], {fontSize: 22, strokeColor: COL.white, fillColor: COL.white, fixed:true});
la._baseColor = lb._baseColor = lc._baseColor = COL.white;
setOpacity(la,0); setOpacity(lb,0); setOpacity(lc,0); setOpacity(tri1,0);

// 5) Dissection square configuration 1 (Scene B)
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

const T1 = makeTri("T1", [[128,450],[128,650],[288,610]]);
const T2 = makeTri("T2", [[448,450],[288,610],[448,610]]);
const T3 = makeTri("T3", [[448,770],[448,610],[288,650]]);
const T4 = makeTri("T4", [[128,770],[288,650],[128,650]]);

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

const cLabel = board.create('text', [W/2 - 6, 660, "c"], {
  fontSize: 26, strokeColor: COL.white, fillColor: COL.white, fixed:true
});
cLabel._baseColor = COL.white;
setOpacity(cLabel, 0);

const c2Label = board.create('text', [W/2 - 14, 660, "c²"], {
  fontSize: 26, strokeColor: COL.white, fillColor: COL.white, fixed:true
});
c2Label._baseColor = COL.white;
setOpacity(c2Label, 0);

const innerHighlight = board.create('polygon', [C0,C1,C2,C3], {
  borders: {strokeColor: COL.yellow, strokeWidth: 4, strokeOpacity: 0},
  fillColor: COL.greenish,
  fillOpacity: 0,
  hasInnerPoints: false,
  fixed: true
});
setOpacity(innerHighlight, 0);

// 6) Bottom equation region (Scene C)
// ... (bottom equation elements)

// 7) Configuration 2: shows a² and b² blocks
// ... (aSq, bSq, a2, b2, aFill, bFill elements)

// 8) Timeline functions
function showTriangleScene() {
  fadeIn(tri1, sec(), 0.5);
  tri1.setAttribute({borders: {strokeOpacity: 1}});
  fadeIn(la, sec()+0.15, 0.35);
  fadeIn(lb, sec()+0.20, 0.35);
  fadeIn(lc, sec()+0.25, 0.35);
}

function showConfig1() {
  fadeOut(tri1, sec(), 0.35);
  fadeOut(la, sec(), 0.25);
  fadeOut(lb, sec(), 0.25);
  fadeOut(lc, sec(), 0.25);
  outerSq.setAttribute({borders: {strokeOpacity: 1}});
  fadeIn(outerSq, sec()+0.15, 0.4);
  for (const T of [T1,T2,T3,T4]) {
    T.poly.setAttribute({borders:{strokeOpacity:1}});
    fadeIn(T.poly, sec()+0.2, 0.4);
  }
  innerSq.setAttribute({borders:{strokeOpacity:1}});
  fadeIn(innerSq, sec()+0.3, 0.4);
  fadeIn(cLabel, sec()+0.8, 0.35);
  fadeOut(cLabel, sec()+2.2, 0.25);
  fadeIn(c2Label, sec()+2.25, 0.25);
  innerHighlight.setAttribute({borders:{strokeOpacity:1}});
  tween({
    t0: sec()+2.6, dur: 0.5,
    update: (k)=> {
      innerHighlight.setAttribute({fillOpacity: 0.65*k});
      innerHighlight.setAttribute({borders:{strokeOpacity: k}});
    }
  });
}

// 9) Schedule events (seconds)
anim.t0ms = nowMs();
at(0.8, () => fadeIn(title, sec(), 0.5));
at(2.0, () => showTriangleScene());
at(3.2, () => { fadeIn(eqBox, sec(), 0.35); fadeIn(eqText, sec()+0.1, 0.35); eqBox.setAttribute({borders:{strokeOpacity:1}}); });
at(5.2, () => showConfig1());
// ... more timeline events
at(25.0, () => fadeOut(powered, sec(), 0.8));

tick();
})();
</script>
</body>
</html>

# 3) Notes on "exactness" vs JSXGraph constraints

JSXGraph can reproduce this video very closely, but 3 things matter if you want pixel-perfect:

1. Text rendering differs (TikTok uses different font/kerning).
   - Fix: embed a matching webfont and set CSS for the board container.
2. Rounded rectangle with gradient stroke (TikTok effect) is not native in JSXGraph.
   - Fix: draw it as an SVG path overlay or use HTML/CSS element positioned over the board.
3. Triangle vertex coordinates: I used geometry-consistent coordinates matching the dissection.
   - If you want exact vertex positions as in the MP4, tell me and I'll produce a refined version.`;

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
