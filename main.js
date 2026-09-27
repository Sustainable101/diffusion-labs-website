const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

const gauss = (rand = Math.random) => {
  let u = 0, v = 0;
  while (!u) u = rand();
  while (!v) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// Seeded PRNG so post thumbnails are stable across reloads
const mulberry = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function fit(canvas) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

// fig. 1 — reverse diffusion: a dot lattice emerges from noise, then dissolves.
(() => {
  const canvas = document.getElementById("field");
  const tOut = document.getElementById("tval");
  let c = fit(canvas), pts = [];

  function build() {
    pts = [];
    const step = 12;
    for (let x = step; x < c.w; x += step)
      for (let y = step; y < c.h - 16; y += step)
        pts.push({ x, y, nx: gauss(), ny: gauss(), ph: Math.random() * 6.28 });
  }

  const ease = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const schedule = (s) => {
    const k = s % 12;
    if (k < 4) return ease(k / 4);
    if (k < 8) return 1;
    if (k < 11) return 1 - ease((k - 8) / 3);
    return 0;
  };

  function frame(ms) {
    const s = ms / 1000;
    const k = reduce ? 1 : schedule(s);
    const { ctx, w, h } = c;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = (h - 16) / 2;
    for (const p of pts) {
      // signal: dot size follows a slow interference pattern of three "sources"
      const d1 = Math.hypot(p.x - w * .22, p.y - cy * .7);
      const d2 = Math.hypot(p.x - w * .78, p.y - cy * .7);
      const d3 = Math.hypot(p.x - cx, p.y - cy * 1.7);
      const wave = (Math.sin(d1 / 18 - s * 1.2) + Math.sin(d2 / 18 - s * 1.2) + Math.sin(d3 / 18 - s * 1.2)) / 3;
      const r = Math.max(0, 0.4 + wave * 1.6);
      const n = 1 - k;
      const x = p.x + p.nx * 40 * n + Math.sin(s + p.ph) * 3 * n;
      const y = p.y + p.ny * 40 * n + Math.cos(s + p.ph) * 3 * n;
      ctx.fillStyle = `rgba(17,17,16,${0.25 + 0.6 * k})`;
      ctx.beginPath();
      ctx.arc(x, y, k * r + n * 0.9 + 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    tOut.textContent = (1 - k).toFixed(2);
    if (!reduce) requestAnimationFrame(frame);
  }

  build();
  addEventListener("resize", () => { c = fit(canvas); build(); });
  requestAnimationFrame(frame);
})();

// Post thumbnails — static generative dot art
function drawThumbs() {
  document.querySelectorAll(".thumb").forEach((cv) => {
    const { ctx, w, h } = fit(cv);
    const seed = +cv.dataset.seed;
    const rand = mulberry(seed * 9973);
    const dark = cv.classList.contains("dark");
    ctx.fillStyle = dark ? "#111110" : "#e6e5df";
    ctx.fillRect(0, 0, w, h);
    const ink = dark ? "247,246,242" : "17,17,16";
    const cx = w * (0.3 + rand() * 0.4), cy = h * (0.3 + rand() * 0.4);
    const spread = 0.06 + seed * 0.025;
    for (let i = 0; i < 900; i++) {
      const x = cx + gauss(rand) * w * spread;
      const y = cy + gauss(rand) * h * spread * 1.2;
      const snap = seed % 2 ? 8 : 6;
      const gx = Math.round(x / snap) * snap, gy = Math.round(y / snap) * snap;
      ctx.fillStyle = `rgba(${ink},${0.15 + rand() * 0.5})`;
      ctx.fillRect(gx, gy, 2, 2);
    }
  });
}
drawThumbs();
addEventListener("resize", drawThumbs);

// Strip controls
const track = document.querySelector(".strip-track");
const ctrl = document.querySelector(".strip-ctrl");
const syncCtrl = () => { ctrl.hidden = track.scrollWidth <= track.clientWidth + 1; };
syncCtrl();
addEventListener("resize", syncCtrl);
document.querySelectorAll(".strip-ctrl button").forEach((b) =>
  b.addEventListener("click", () => {
    const step = track.querySelector(".post").offsetWidth + 4;
    track.scrollBy({ left: +b.dataset.dir * step, behavior: "smooth" });
  })
);

document.getElementById("yr").textContent = new Date().getFullYear();
