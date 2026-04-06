/* ===== CONSTANTS ===== */
const FRAME_COUNT = 241;
const FRAME_SPEED = 2.0;
const IMAGE_SCALE = 0.86;
const FRAME_PATH = "frames/frame_";
const FRAME_EXT = ".jpg";

/* ===== STATE ===== */
const frames = [];
let currentFrame = 0;
let bgColor = "#dfe5ec";
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const canvasWrap = document.getElementById("canvas-wrap");
const scrollContainer = document.getElementById("scroll-container");
const heroSection = document.getElementById("hero");
const loader = document.getElementById("loader");
const loaderBar = document.getElementById("loader-bar");
const loaderPercent = document.getElementById("loader-percent");

/* ===== CANVAS SIZING ===== */
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.scale(dpr, dpr);
  if (frames[currentFrame]) drawFrame(currentFrame);
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

/* ===== BACKGROUND SAMPLING ===== */
const sampleCanvas = document.createElement("canvas");
const sampleCtx = sampleCanvas.getContext("2d");

function sampleBgColor(img) {
  sampleCanvas.width = img.naturalWidth;
  sampleCanvas.height = img.naturalHeight;
  sampleCtx.drawImage(img, 0, 0);

  const w = img.naturalWidth;
  const positions = [
    [5, 5], [w - 6, 5],
    [5, 15], [w - 6, 15],
    [Math.floor(w / 3), 5], [Math.floor(2 * w / 3), 5],
  ];

  let r = 0, g = 0, b = 0;
  positions.forEach(([x, y]) => {
    const d = sampleCtx.getImageData(x, y, 1, 1).data;
    r += d[0]; g += d[1]; b += d[2];
  });

  const n = positions.length;
  r = Math.round(r / n);
  g = Math.round(g / n);
  b = Math.round(b / n);

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function updateBgColor(img) {
  bgColor = sampleBgColor(img);
  document.documentElement.style.setProperty("--sampled-bg", bgColor);
}

/* ===== FRAME DRAWING ===== */
function drawFrame(index) {
  const img = frames[index];
  if (!img) return;

  const dpr = window.devicePixelRatio || 1;
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.max(cw / iw, ch / ih) * IMAGE_SCALE;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (cw - dw) / 2;
  const dy = (ch - dh) / 2;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(img, dx, dy, dw, dh);

  // Edge feathering for seamless blend
  const feather = 40;
  // Top
  const topGrad = ctx.createLinearGradient(0, 0, 0, feather);
  topGrad.addColorStop(0, bgColor);
  topGrad.addColorStop(1, "transparent");
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, cw, feather);
  // Bottom
  const botGrad = ctx.createLinearGradient(0, ch - feather, 0, ch);
  botGrad.addColorStop(0, "transparent");
  botGrad.addColorStop(1, bgColor);
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, ch - feather, cw, feather);
  // Left
  const leftGrad = ctx.createLinearGradient(0, 0, feather, 0);
  leftGrad.addColorStop(0, bgColor);
  leftGrad.addColorStop(1, "transparent");
  ctx.fillStyle = leftGrad;
  ctx.fillRect(0, 0, feather, ch);
  // Right
  const rightGrad = ctx.createLinearGradient(cw - feather, 0, cw, 0);
  rightGrad.addColorStop(0, "transparent");
  rightGrad.addColorStop(1, bgColor);
  ctx.fillStyle = rightGrad;
  ctx.fillRect(cw - feather, 0, feather, ch);
}

/* ===== FRAME PRELOADER ===== */
function framePath(i) {
  return FRAME_PATH + String(i).padStart(4, "0") + FRAME_EXT;
}

function loadImage(index) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { frames[index] = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src = framePath(index);
  });
}

async function preloadFrames() {
  let loaded = 0;

  function updateProgress() {
    loaded++;
    const pct = Math.round((loaded / FRAME_COUNT) * 100);
    loaderBar.style.width = pct + "%";
    loaderPercent.textContent = pct + "%";
  }

  // Phase 1: load first 10 frames fast
  for (let i = 1; i <= Math.min(10, FRAME_COUNT); i++) {
    await loadImage(i);
    updateProgress();
  }

  // Draw first frame immediately
  if (frames[1]) {
    updateBgColor(frames[1]);
    drawFrame(1);
  }

  // Phase 2: load remaining in parallel batches
  const batchSize = 20;
  for (let start = 11; start <= FRAME_COUNT; start += batchSize) {
    const end = Math.min(start + batchSize, FRAME_COUNT + 1);
    const promises = [];
    for (let i = start; i < end; i++) {
      promises.push(loadImage(i).then(updateProgress));
    }
    await Promise.all(promises);
  }
}

/* ===== LENIS SMOOTH SCROLL ===== */
function initLenis() {
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });

  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  return lenis;
}

/* ===== HERO TRANSITION (circle-wipe) ===== */
function initHeroTransition() {
  ScrollTrigger.create({
    trigger: scrollContainer,
    start: "top top",
    end: "bottom bottom",
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      // Hero fades out quickly
      heroSection.style.opacity = Math.max(0, 1 - p * 15);
      // Canvas reveals via expanding circle
      const wipeProgress = Math.min(1, Math.max(0, (p - 0.005) / 0.06));
      const radius = wipeProgress * 80;
      canvasWrap.style.clipPath = `circle(${radius}% at 50% 50%)`;
    },
  });
}

/* ===== SCROLL-TO-FRAME BINDING ===== */
let lastSampledFrame = -1;

function initScrollFrames() {
  ScrollTrigger.create({
    trigger: scrollContainer,
    start: "top top",
    end: "bottom bottom",
    scrub: true,
    onUpdate: (self) => {
      const accelerated = Math.min(self.progress * FRAME_SPEED, 1);
      const index = Math.max(1, Math.min(Math.floor(accelerated * FRAME_COUNT), FRAME_COUNT));
      if (index !== currentFrame) {
        currentFrame = index;
        requestAnimationFrame(() => drawFrame(currentFrame));

        // Resample bg color every ~20 frames
        if (Math.abs(currentFrame - lastSampledFrame) > 20 && frames[currentFrame]) {
          lastSampledFrame = currentFrame;
          updateBgColor(frames[currentFrame]);
        }
      }
    },
  });
}

/* ===== SECTION ANIMATIONS ===== */
function initSectionAnimations() {
  const sections = document.querySelectorAll(".scroll-section");

  sections.forEach((section) => {
    const type = section.dataset.animation;
    const persist = section.dataset.persist === "true";
    const enter = parseFloat(section.dataset.enter) / 100;
    const leave = parseFloat(section.dataset.leave) / 100;

    const children = section.querySelectorAll(
      ".section-label, .section-heading, .section-body, .section-note, .cta-button, .stat"
    );

    const tl = gsap.timeline({ paused: true });

    switch (type) {
      case "fade-up":
        tl.from(children, { y: 50, opacity: 0, stagger: 0.12, duration: 0.9, ease: "power3.out" });
        break;
      case "slide-left":
        tl.from(children, { x: -80, opacity: 0, stagger: 0.14, duration: 0.9, ease: "power3.out" });
        break;
      case "slide-right":
        tl.from(children, { x: 80, opacity: 0, stagger: 0.14, duration: 0.9, ease: "power3.out" });
        break;
      case "scale-up":
        tl.from(children, { scale: 0.85, opacity: 0, stagger: 0.12, duration: 1.0, ease: "power2.out" });
        break;
      case "rotate-in":
        tl.from(children, { y: 40, rotation: 3, opacity: 0, stagger: 0.1, duration: 0.9, ease: "power3.out" });
        break;
      case "stagger-up":
        tl.from(children, { y: 60, opacity: 0, stagger: 0.15, duration: 0.8, ease: "power3.out" });
        break;
      case "clip-reveal":
        tl.from(children, { clipPath: "inset(100% 0 0 0)", opacity: 0, stagger: 0.15, duration: 1.2, ease: "power4.inOut" });
        break;
    }

    let isActive = false;
    let hasEntered = false;

    ScrollTrigger.create({
      trigger: scrollContainer,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => {
        const p = self.progress;
        const shouldShow = p >= enter && p <= leave;

        if (shouldShow && !isActive) {
          isActive = true;
          hasEntered = true;
          section.classList.add("is-active");
          tl.play();
        } else if (!shouldShow && isActive) {
          if (persist && p > leave) {
            // Keep visible
            return;
          }
          isActive = false;
          section.classList.remove("is-active");
          tl.reverse();
        }

        // Handle persist: keep section visible after its range
        if (persist && hasEntered && p > leave) {
          section.classList.add("is-active");
        }
      },
    });
  });
}

/* ===== DARK OVERLAY ===== */
function initDarkOverlay() {
  const overlay = document.getElementById("dark-overlay");
  const enter = 0.54;
  const leave = 0.74;
  const fadeRange = 0.04;

  ScrollTrigger.create({
    trigger: scrollContainer,
    start: "top top",
    end: "bottom bottom",
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      let opacity = 0;

      if (p >= enter - fadeRange && p <= enter) {
        opacity = 0.9 * ((p - (enter - fadeRange)) / fadeRange);
      } else if (p > enter && p < leave) {
        opacity = 0.9;
      } else if (p >= leave && p <= leave + fadeRange) {
        opacity = 0.9 * (1 - (p - leave) / fadeRange);
      }

      overlay.style.opacity = opacity;
    },
  });
}

/* ===== MARQUEE ===== */
function initMarquee() {
  const marqueeWrap = document.getElementById("marquee-wrap");
  const marqueeText = marqueeWrap.querySelector(".marquee-text");

  gsap.to(marqueeText, {
    xPercent: -25,
    ease: "none",
    scrollTrigger: {
      trigger: scrollContainer,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
    },
  });

  // Fade marquee in/out
  ScrollTrigger.create({
    trigger: scrollContainer,
    start: "top top",
    end: "bottom bottom",
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      let opacity = 0;

      if (p > 0.08 && p < 0.50) {
        const fadeIn = Math.min(1, (p - 0.08) / 0.04);
        const fadeOut = Math.min(1, (0.50 - p) / 0.04);
        opacity = Math.min(fadeIn, fadeOut);
      }

      marqueeWrap.style.opacity = opacity;
    },
  });
}

/* ===== COUNTER ANIMATIONS ===== */
function initCounters() {
  document.querySelectorAll(".stat-number").forEach((el) => {
    const target = parseFloat(el.dataset.value);
    const decimals = parseInt(el.dataset.decimals || "0");

    el._counterTrigger = ScrollTrigger.create({
      trigger: scrollContainer,
      start: "top top",
      end: "bottom bottom",
      scrub: false,
      onUpdate: (self) => {
        const p = self.progress;
        // Trigger when stats section is active
        if (p >= 0.56 && p <= 0.72 && !el._counted) {
          el._counted = true;
          gsap.fromTo(el,
            { textContent: 0 },
            {
              textContent: target,
              duration: 2,
              ease: "power1.out",
              snap: { textContent: decimals === 0 ? 1 : 0.01 },
              onUpdate: function () {
                const val = Math.round(parseFloat(el.textContent));
                el.textContent = val.toLocaleString();
              },
            }
          );
        } else if (p < 0.54 || p > 0.76) {
          el._counted = false;
          el.textContent = "0";
        }
      },
    });
  });
}

/* ===== HERO WORD ANIMATION ===== */
function animateHero() {
  const words = document.querySelectorAll(".hero-word");
  const label = heroSection.querySelector(".section-label");
  const tagline = heroSection.querySelector(".hero-tagline");
  const indicator = heroSection.querySelector(".scroll-indicator");

  gsap.from(label, { y: 20, opacity: 0, duration: 0.8, delay: 0.3, ease: "power3.out" });

  words.forEach((word, i) => {
    gsap.from(word, {
      y: 80,
      opacity: 0,
      duration: 1.0,
      delay: 0.5 + i * 0.12,
      ease: "power3.out",
    });
  });

  gsap.from(tagline, { y: 20, opacity: 0, duration: 0.8, delay: 1.1, ease: "power3.out" });
  gsap.from(indicator, { opacity: 0, duration: 0.6, delay: 1.6, ease: "power2.out" });
}

/* ===== INIT ===== */
async function init() {
  gsap.registerPlugin(ScrollTrigger);

  await preloadFrames();

  // Hide loader
  loader.classList.add("loaded");

  // Small delay to ensure loader transition completes
  await new Promise((r) => setTimeout(r, 600));

  initLenis();
  initHeroTransition();
  initScrollFrames();
  initSectionAnimations();
  initDarkOverlay();
  initMarquee();
  initCounters();
  animateHero();
}

init();
