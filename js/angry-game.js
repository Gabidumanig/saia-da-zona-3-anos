(() => {
  const BEST_KEY = "sdz3_angry_best";
  const LEVEL_COUNT = 5;
  const LEVEL_NAMES = ["Pedreira", "Cachoeira", "Mirante", "Acampamento", "Cume"];

  const LEADERS = [
    { id: "franz", name: "Franz", src: "assets/avatars/franz-bandage.svg?v=94", power: 1.05 },
    { id: "diego", name: "Diego", src: "assets/avatars/diego-v6.svg?v=94", power: 1.02 },
    { id: "gabi", name: "Gabi", src: "assets/avatars/gabi-v7.svg?v=94", power: 1.08 },
    { id: "jin", name: "Jin", src: "assets/avatars/jin-v6.svg?v=94", power: 1.02 },
    { id: "caio", name: "Caio", src: "assets/avatars/caio-v7.svg?v=94", power: 1.12 },
    { id: "matheus", name: "Matheus", src: "assets/avatars/matheus-v6.svg?v=94", power: 1.05 },
  ];

  const canvas = document.getElementById("angry-canvas");
  const overlay = document.getElementById("angry-overlay");
  const messageEl = document.getElementById("angry-message");
  const startBtn = document.getElementById("angry-start");
  const scoreEl = document.getElementById("angry-score");
  const levelEl = document.getElementById("angry-level");
  const bestEl = document.getElementById("angry-best");
  const ammoEl = document.getElementById("angry-ammo");

  if (!canvas || !overlay || !startBtn) return;

  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const GROUND_Y = H - 52;
  const SLING = { x: 108, y: GROUND_Y - 72 };
  const MAX_PULL = 125;
  const G = 1480;
  const LAUNCH_POWER = 1220;

  let active = false;
  let running = false;
  let raf = 0;
  let lastTs = 0;
  let score = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  let levelIndex = 0;
  let bodies = [];
  let ammo = [];
  let bird = null;
  let aiming = false;
  let pull = { x: 0, y: 0 };
  let pointerId = null;
  let settledTimer = 0;
  let shotAge = 0;
  let waitingNext = false;
  let endTimer = 0;
  let particles = [];
  let clouds = [];
  let shake = 0;
  let leaderImgs = {};
  let runSubmitted = false;
  const SLEEP_SPEED = 22;
  const MAX_SHOT_TIME = 3.4;

  function loadLeaders() {
    LEADERS.forEach((leader) => {
      const img = new Image();
      img.onload = () => {
        leaderImgs[leader.id] = img;
      };
      img.src = leader.src;
    });
  }

  function updateChrome() {
    if (scoreEl) scoreEl.textContent = `${score} pts`;
    if (levelEl) levelEl.textContent = `Nível ${Math.min(levelIndex + 1, LEVEL_COUNT)} / ${LEVEL_COUNT}`;
    if (bestEl) bestEl.textContent = `Recorde ${best}`;
    if (ammoEl) {
      const left = ammo.length + (bird && bird.state === "ready" ? 1 : 0);
      ammoEl.textContent = `${left} líder${left === 1 ? "" : "es"}`;
    }
  }

  function showOverlay(text, btnLabel = "Continuar") {
    if (messageEl) messageEl.textContent = text;
    if (startBtn) startBtn.textContent = btnLabel;
    overlay.hidden = false;
  }

  function hideOverlay() {
    overlay.hidden = true;
  }

  function makeBox(x, y, w, h, kind) {
    const hp = kind === "stone" ? 3 : kind === "wood" ? 2 : 1;
    const mass = kind === "stone" ? 3.1 : 1.55;
    return {
      type: "box",
      kind,
      x,
      y,
      w,
      h,
      vx: 0,
      vy: 0,
      hp,
      mass,
      restitution: kind === "stone" ? 0.05 : 0.12,
      friction: 0.94,
      alive: true,
      sleeping: true,
      scored: false,
      points: kind === "stone" ? 300 : 400,
    };
  }

  const TRASH_META = {
    bottle: { label: "Garrafa", points: 1500, r: 20, color: "#38BDF8" },
    can: { label: "Lata", points: 1400, r: 19, color: "#94A3B8" },
    bag: { label: "Saco", points: 1300, r: 21, color: "#64748B" },
    cup: { label: "Copo", points: 1200, r: 18, color: "#FB7185" },
    wrap: { label: "Embalagem", points: 1600, r: 20, color: "#F59E0B" },
  };

  function makeTrash(x, y, trash = "bottle") {
    const meta = TRASH_META[trash] || TRASH_META.bottle;
    return {
      type: "circle",
      kind: "pest",
      pest: trash,
      label: meta.label,
      x,
      y,
      r: meta.r,
      vx: 0,
      vy: 0,
      hp: 1,
      mass: trash === "bag" ? 0.85 : 1.2,
      restitution: 0.2,
      friction: 0.88,
      alive: true,
      sleeping: true,
      scored: false,
      points: meta.points,
    };
  }

  function makeBird(leader) {
    return {
      type: "circle",
      kind: "bird",
      leader,
      x: SLING.x,
      y: SLING.y,
      r: 24,
      vx: 0,
      vy: 0,
      mass: 1.1,
      restitution: 0.28,
      friction: 0.78,
      alive: true,
      sleeping: false,
      scored: false,
      state: "ready",
      launched: false,
      points: 0,
    };
  }

  function wake(body) {
    if (!body) return;
    body.sleeping = false;
  }

  function trySleep(body) {
    if (!body || !body.alive || body.kind === "bird") return;
    if (Math.hypot(body.vx, body.vy) < SLEEP_SPEED) {
      body.vx = 0;
      body.vy = 0;
      body.sleeping = true;
    }
  }

  function stackY(heights) {
    // heights: array from ground up; returns center Y for the top piece
    let top = GROUND_Y;
    let y = GROUND_Y;
    heights.forEach((h) => {
      y = top - h / 2;
      top -= h;
    });
    return y;
  }

  function atop(heights, r = 20) {
    const last = heights[heights.length - 1] || 36;
    return stackY(heights) - last / 2 - r;
  }

  function levelLayout(index) {
    // estruturas bem mais perto do estilingue (alcance confortável)
    const list = [];
    if (index === 0) {
      list.push(makeBox(360, stackY([36]), 48, 36, "wood"));
      list.push(makeBox(412, stackY([36]), 48, 36, "wood"));
      list.push(makeBox(386, stackY([36, 38]), 54, 38, "wood"));
      list.push(makeTrash(386, atop([36, 38]), "bottle"));
      list.push(makeBox(500, stackY([42]), 52, 42, "stone"));
      list.push(makeBox(500, stackY([42, 36]), 46, 36, "wood"));
      list.push(makeTrash(500, atop([42, 36]), "can"));
      list.push(makeBox(580, stackY([34]), 44, 34, "wood"));
      list.push(makeTrash(580, atop([34], 18), "cup"));
    } else if (index === 1) {
      [340, 388, 436].forEach((x) => list.push(makeBox(x, stackY([38]), 44, 38, "wood")));
      list.push(makeBox(364, stackY([38, 40]), 48, 40, "stone"));
      list.push(makeBox(412, stackY([38, 40]), 48, 40, "stone"));
      list.push(makeBox(388, stackY([38, 40, 38]), 54, 38, "wood"));
      list.push(makeTrash(364, atop([38, 40]), "bag"));
      list.push(makeTrash(412, atop([38, 40]), "bottle"));
      list.push(makeTrash(388, atop([38, 40, 38]), "wrap"));
      list.push(makeBox(520, stackY([46]), 56, 46, "stone"));
      list.push(makeBox(520, stackY([46, 40]), 50, 40, "stone"));
      list.push(makeTrash(520, atop([46, 40]), "can"));
      list.push(makeBox(600, stackY([36]), 42, 36, "wood"));
      list.push(makeTrash(600, atop([36], 18), "cup"));
    } else if (index === 2) {
      for (let i = 0; i < 4; i += 1) {
        list.push(makeBox(320 + i * 48, stackY([40]), 46, 40, i % 2 ? "stone" : "wood"));
      }
      for (let i = 0; i < 3; i += 1) {
        list.push(makeBox(344 + i * 48, stackY([40, 40]), 46, 40, "stone"));
      }
      list.push(makeBox(368, stackY([40, 40, 42]), 50, 42, "wood"));
      list.push(makeBox(416, stackY([40, 40, 42]), 50, 42, "wood"));
      list.push(makeBox(392, stackY([40, 40, 42, 38]), 54, 38, "stone"));
      list.push(makeTrash(344, atop([40, 40]), "bottle"));
      list.push(makeTrash(392, atop([40, 40]), "can"));
      list.push(makeTrash(440, atop([40, 40]), "bag"));
      list.push(makeTrash(392, atop([40, 40, 42, 38]), "wrap"));
      list.push(makeBox(540, stackY([48]), 54, 48, "stone"));
      list.push(makeBox(540, stackY([48, 44]), 50, 44, "stone"));
      list.push(makeBox(540, stackY([48, 44, 36]), 46, 36, "wood"));
      list.push(makeTrash(540, atop([48, 44, 36]), "cup"));
      list.push(makeBox(620, stackY([36]), 42, 36, "wood"));
      list.push(makeTrash(620, atop([36], 18), "bag"));
    } else if (index === 3) {
      for (let i = 0; i < 5; i += 1) {
        list.push(makeBox(300 + i * 46, stackY([38]), 44, 38, i % 2 ? "stone" : "wood"));
      }
      for (let i = 0; i < 4; i += 1) {
        list.push(makeBox(323 + i * 46, stackY([38, 40]), 44, 40, "stone"));
      }
      for (let i = 0; i < 3; i += 1) {
        list.push(makeBox(346 + i * 46, stackY([38, 40, 40]), 44, 40, i === 1 ? "stone" : "wood"));
      }
      list.push(makeBox(369, stackY([38, 40, 40, 42]), 52, 42, "stone"));
      list.push(makeTrash(323, atop([38, 40]), "bottle"));
      list.push(makeTrash(369, atop([38, 40]), "can"));
      list.push(makeTrash(415, atop([38, 40]), "cup"));
      list.push(makeTrash(461, atop([38, 40]), "bag"));
      list.push(makeTrash(369, atop([38, 40, 40, 42]), "wrap"));
      list.push(makeBox(560, stackY([50]), 58, 50, "stone"));
      list.push(makeBox(560, stackY([50, 46]), 54, 46, "stone"));
      list.push(makeBox(560, stackY([50, 46, 40]), 48, 40, "stone"));
      list.push(makeTrash(560, atop([50, 46, 40]), "bottle"));
      list.push(makeBox(640, stackY([40]), 44, 40, "wood"));
      list.push(makeBox(640, stackY([40, 36]), 42, 36, "stone"));
      list.push(makeTrash(640, atop([40, 36]), "can"));
    } else {
      for (let i = 0; i < 5; i += 1) {
        list.push(makeBox(290 + i * 48, stackY([42]), 46, 42, "stone"));
      }
      for (let i = 0; i < 4; i += 1) {
        list.push(makeBox(314 + i * 48, stackY([42, 42]), 46, 42, "stone"));
      }
      for (let i = 0; i < 3; i += 1) {
        list.push(makeBox(338 + i * 48, stackY([42, 42, 42]), 46, 42, "stone"));
      }
      list.push(makeBox(362, stackY([42, 42, 42, 40]), 50, 40, "wood"));
      list.push(makeBox(410, stackY([42, 42, 42, 40]), 50, 40, "wood"));
      list.push(makeBox(386, stackY([42, 42, 42, 40, 38]), 56, 38, "stone"));
      list.push(makeTrash(314, atop([42, 42]), "bag"));
      list.push(makeTrash(362, atop([42, 42]), "bottle"));
      list.push(makeTrash(410, atop([42, 42]), "can"));
      list.push(makeTrash(458, atop([42, 42]), "cup"));
      list.push(makeTrash(362, atop([42, 42, 42, 40]), "wrap"));
      list.push(makeTrash(410, atop([42, 42, 42, 40]), "bottle"));
      list.push(makeTrash(386, atop([42, 42, 42, 40, 38]), "wrap"));
      list.push(makeBox(560, stackY([52]), 56, 52, "stone"));
      list.push(makeBox(560, stackY([52, 48]), 52, 48, "stone"));
      list.push(makeBox(560, stackY([52, 48, 44]), 48, 44, "stone"));
      list.push(makeBox(560, stackY([52, 48, 44, 36]), 44, 36, "wood"));
      list.push(makeTrash(560, atop([52, 48, 44, 36]), "can"));
      list.push(makeBox(645, stackY([44]), 46, 44, "stone"));
      list.push(makeBox(645, stackY([44, 40]), 44, 40, "stone"));
      list.push(makeTrash(645, atop([44, 40]), "bag"));
      list.push(makeTrash(270, GROUND_Y - 20, "cup"));
    }
    return list;
  }

  function shuffle(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buildAmmo(level) {
    // quanto mais alto o nível, menos líderes — fica mais difícil
    const count = level >= 4 ? 3 : level >= 2 ? 3 : 4;
    const picks = shuffle(LEADERS).slice(0, count);
    return picks.map((leader) => makeBird(leader));
  }

  function spawnParticles(x, y, color, n = 10) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 180;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 80,
        life: 0.45 + Math.random() * 0.4,
        color,
        r: 2 + Math.random() * 3,
      });
    }
  }

  function resetClouds() {
    clouds = Array.from({ length: 4 }, (_, i) => ({
      x: 160 + i * 190 + Math.random() * 30,
      y: 58 + (i % 2) * 22,
      w: 60 + Math.random() * 40,
      speed: 8 + Math.random() * 8,
    }));
  }

  function startLevel(index) {
    levelIndex = index;
    bodies = levelLayout(index);
    ammo = buildAmmo(index);
    bird = null;
    aiming = false;
    pull = { x: 0, y: 0 };
    settledTimer = 0;
    shotAge = 0;
    waitingNext = false;
    endTimer = 0;
    particles = [];
    shake = 0;
    loadNextBird();
    updateChrome();
    hideOverlay();
    running = true;
    lastTs = 0;
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function startRun() {
    if (window.SDZ_RANKING?.requireName && !window.SDZ_RANKING.requireName("angry")) {
      return;
    }
    score = 0;
    runSubmitted = false;
    resetClouds();
    startLevel(0);
  }

  function loadNextBird() {
    if (!ammo.length) {
      bird = null;
      return false;
    }
    bird = ammo.shift();
    bird.x = SLING.x;
    bird.y = SLING.y;
    bird.vx = 0;
    bird.vy = 0;
    bird.state = "ready";
    bird.launched = false;
    updateChrome();
    return true;
  }

  function pestsLeft() {
    return bodies.filter((b) => b.alive && b.kind === "pest").length;
  }

  function dynamicBodies() {
    const list = bodies.filter((b) => b.alive);
    if (bird && bird.alive && bird.launched) list.push(bird);
    return list;
  }

  function awardDestroy(body) {
    if (!body || body.scored) return;
    body.scored = true;
    score += body.points || 0;
    const color =
      body.kind === "pest"
        ? TRASH_META[body.pest]?.color || "#94A3B8"
        : body.kind === "stone"
          ? "#9AA3AE"
          : "#C48A4A";
    spawnParticles(body.x, body.y, color, body.kind === "pest" ? 14 : 8);
    shake = Math.min(8, shake + (body.kind === "pest" ? 5 : 2));
    updateChrome();
  }

  function damage(body, amount, impact) {
    if (!body || !body.alive || body.kind === "bird" || body.scored) return;
    if (impact < 110 && body.kind === "stone") return;
    if (impact < 80 && body.kind === "wood") return;
    if (impact < 55 && body.kind === "pest") return;
    wake(body);
    body.hp -= amount;
    if (body.hp <= 0) {
      body.alive = false;
      awardDestroy(body);
    }
  }

  function resolveCircleCircle(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const min = a.r + b.r;
    if (dist >= min) return;
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = min - dist;
    const invA = 1 / a.mass;
    const invB = 1 / b.mass;
    const invSum = invA + invB;
    a.x -= nx * overlap * (invA / invSum);
    a.y -= ny * overlap * (invA / invSum);
    b.x += nx * overlap * (invB / invSum);
    b.y += ny * overlap * (invB / invSum);
    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const velN = rvx * nx + rvy * ny;
    if (velN > 0) return;
    const e = Math.min(a.restitution, b.restitution);
    const j = (-(1 + e) * velN) / invSum;
    const ix = j * nx;
    const iy = j * ny;
    a.vx -= ix * invA;
    a.vy -= iy * invA;
    b.vx += ix * invB;
    b.vy += iy * invB;
    const impact = Math.abs(velN);
    if (impact > 18) {
      wake(a);
      wake(b);
    }
    damage(a, 1, impact);
    damage(b, 1, impact);
  }

  function resolveCircleBox(circle, box) {
    const nearestX = Math.max(box.x - box.w / 2, Math.min(circle.x, box.x + box.w / 2));
    const nearestY = Math.max(box.y - box.h / 2, Math.min(circle.y, box.y + box.h / 2));
    let dx = circle.x - nearestX;
    let dy = circle.y - nearestY;
    let dist = Math.hypot(dx, dy);
    if (dist === 0) {
      dx = 0;
      dy = -1;
      dist = 0.0001;
    }
    if (dist >= circle.r) return;
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = circle.r - dist;
    const invC = 1 / circle.mass;
    const invB = 1 / box.mass;
    const invSum = invC + invB;
    circle.x += nx * overlap * (invC / invSum);
    circle.y += ny * overlap * (invC / invSum);
    box.x -= nx * overlap * (invB / invSum);
    box.y -= ny * overlap * (invB / invSum);
    const rvx = circle.vx - box.vx;
    const rvy = circle.vy - box.vy;
    const velN = rvx * nx + rvy * ny;
    if (velN > 0) return;
    const e = Math.min(circle.restitution, box.restitution);
    const j = (-(1 + e) * velN) / invSum;
    circle.vx += j * nx * invC;
    circle.vy += j * ny * invC;
    box.vx -= j * nx * invB;
    box.vy -= j * ny * invB;
    const impact = Math.abs(velN);
    if (impact > 18) {
      wake(circle);
      wake(box);
    }
    damage(box, 1, impact);
    if (circle.kind === "pest") damage(circle, 1, impact);
  }

  function resolveBoxBox(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const overlapX = (a.w + b.w) / 2 - Math.abs(dx);
    const overlapY = (a.h + b.h) / 2 - Math.abs(dy);
    if (overlapX <= 0 || overlapY <= 0) return;
    const invA = 1 / a.mass;
    const invB = 1 / b.mass;
    const invSum = invA + invB;
    let nx = 0;
    let ny = 0;
    let overlap = 0;
    if (overlapX < overlapY) {
      nx = dx < 0 ? -1 : 1;
      overlap = overlapX;
    } else {
      ny = dy < 0 ? -1 : 1;
      overlap = overlapY;
    }
    a.x -= nx * overlap * (invA / invSum);
    a.y -= ny * overlap * (invA / invSum);
    b.x += nx * overlap * (invB / invSum);
    b.y += ny * overlap * (invB / invSum);
    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const velN = rvx * nx + rvy * ny;
    if (velN > 0) return;
    const e = Math.min(a.restitution, b.restitution);
    const j = (-(1 + e) * velN) / invSum;
    a.vx -= j * nx * invA;
    a.vy -= j * ny * invA;
    b.vx += j * nx * invB;
    b.vy += j * ny * invB;
    const impact = Math.abs(velN);
    if (impact > 18) {
      wake(a);
      wake(b);
    }
    damage(a, 1, impact);
    damage(b, 1, impact);
  }

  function collideGround(body) {
    if (body.type === "circle") {
      if (body.y + body.r > GROUND_Y) {
        body.y = GROUND_Y - body.r;
        if (body.vy > 0) {
          const impact = body.vy;
          body.vy *= -body.restitution;
          body.vx *= body.friction;
          if (Math.abs(body.vy) < 55) body.vy = 0;
          if (Math.abs(body.vx) < 35) body.vx = 0;
          // só dano com impacto real (evita micro-tremor)
          if (impact > 140) damage(body, 1, impact);
        }
      }
    } else if (body.y + body.h / 2 > GROUND_Y) {
      body.y = GROUND_Y - body.h / 2;
      if (body.vy > 0) {
        const impact = body.vy;
        body.vy *= -body.restitution;
        body.vx *= body.friction;
        if (Math.abs(body.vy) < 50) body.vy = 0;
        if (Math.abs(body.vx) < 30) body.vx = 0;
        if (impact > 150) damage(body, 1, impact);
      }
    }
    body.x = Math.max(24, Math.min(W - 24, body.x));
  }

  function integrate(body, dt) {
    if (body.sleeping && body.kind !== "bird") return;
    body.vy += G * dt;
    body.vx *= 1 - 0.55 * dt;
    body.vy *= 1 - 0.12 * dt;
    body.x += body.vx * dt;
    body.y += body.vy * dt;
    collideGround(body);
    trySleep(body);
    if (body.y > H + 80) {
      body.alive = false;
      if (body.kind === "pest") awardDestroy(body);
    }
  }

  function worldSettled() {
    return dynamicBodies().every(
      (b) => b.sleeping || Math.hypot(b.vx || 0, b.vy || 0) < SLEEP_SPEED
    );
  }

  function finishLevel(cleared) {
    running = false;
    waitingNext = false;
    if (cleared) {
      const leftover = ammo.length + (bird && bird.state === "ready" ? 1 : 0);
      score += 3000 + leftover * 800;
      updateChrome();
      if (levelIndex >= LEVEL_COUNT - 1) {
        finishRun(true);
      } else {
        showOverlay(`Lixo limpo! Próximo: ${LEVEL_NAMES[levelIndex + 1]}`, "Próximo nível");
        startBtn.dataset.action = "next-level";
      }
    } else {
      finishRun(false);
    }
  }

  function finishRun(won) {
    running = false;
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
    }
    updateChrome();
    if (!runSubmitted && score > 0 && window.SDZ_PLAYER?.submitScore) {
      runSubmitted = true;
      window.SDZ_PLAYER.submitScore("angry", score);
    }
    const title = won
      ? `Trilha limpa! ${score} pts`
      : pestsLeft() > 0
        ? `Ainda sobrou lixo na trilha… ${score} pts`
        : `Fim da missão! ${score} pts`;
    showOverlay(title, "Jogar de novo");
    startBtn.dataset.action = "restart";
  }

  function advanceAfterShot() {
    if (waitingNext) return;
    if (pestsLeft() <= 0) {
      finishLevel(true);
      return;
    }

    if (bird) {
      bird.alive = false;
      bird.launched = false;
      bird = null;
    }

    settledTimer = 0;
    shotAge = 0;

    if (!loadNextBird()) {
      waitingNext = true;
      endTimer = 0.45;
    }
  }

  function afterShotCheck(dt) {
    if (!bird || !bird.launched || waitingNext) return;
    shotAge += dt;

    const birdStill = Math.hypot(bird.vx || 0, bird.vy || 0) < SLEEP_SPEED;
    const settled = worldSettled() || (birdStill && shotAge > 1.1);

    if (!settled && shotAge < MAX_SHOT_TIME) {
      settledTimer = 0;
      return;
    }

    settledTimer += dt;
    if (settledTimer < 0.35 && shotAge < MAX_SHOT_TIME) return;
    advanceAfterShot();
  }

  function step(dt) {
    if (waitingNext) {
      endTimer -= dt;
      if (endTimer <= 0) {
        waitingNext = false;
        if (pestsLeft() <= 0) finishLevel(true);
        else finishRun(false);
      }
    }

    const list = dynamicBodies();
    for (let i = 0; i < list.length; i += 1) integrate(list[i], dt);

    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        // dormindo x dormindo: ignora (mata o tremor infinito)
        if (a.sleeping && b.sleeping) continue;
        if (a.type === "circle" && b.type === "circle") resolveCircleCircle(a, b);
        else if (a.type === "circle" && b.type === "box") resolveCircleBox(a, b);
        else if (a.type === "box" && b.type === "circle") resolveCircleBox(b, a);
        else resolveBoxBox(a, b);
      }
    }

    list.forEach(trySleep);

    particles = particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt;
      return p.life > 0;
    });

    clouds.forEach((c) => {
      c.x += c.speed * dt;
      if (c.x > W + 80) c.x = -80;
    });

    if (shake > 0) shake = Math.max(0, shake - dt * 18);
    afterShotCheck(dt);
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#7EC8E8");
    sky.addColorStop(0.55, "#B7DFA8");
    sky.addColorStop(1, "#5F8F4A");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    clouds.forEach((c) => {
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w * 0.55, 18, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x - 24, c.y + 4, c.w * 0.35, 14, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + 28, c.y + 2, c.w * 0.32, 13, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // montanhas
    ctx.fillStyle = "#3F6B45";
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y - 40);
    ctx.lineTo(120, GROUND_Y - 150);
    ctx.lineTo(240, GROUND_Y - 60);
    ctx.lineTo(360, GROUND_Y - 180);
    ctx.lineTo(500, GROUND_Y - 70);
    ctx.lineTo(640, GROUND_Y - 160);
    ctx.lineTo(780, GROUND_Y - 55);
    ctx.lineTo(W, GROUND_Y - 120);
    ctx.lineTo(W, GROUND_Y);
    ctx.lineTo(0, GROUND_Y);
    ctx.fill();

    ctx.fillStyle = "#2F5536";
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y - 10);
    ctx.lineTo(90, GROUND_Y - 90);
    ctx.lineTo(180, GROUND_Y - 30);
    ctx.lineTo(300, GROUND_Y - 110);
    ctx.lineTo(420, GROUND_Y - 25);
    ctx.lineTo(560, GROUND_Y - 95);
    ctx.lineTo(700, GROUND_Y - 20);
    ctx.lineTo(W, GROUND_Y - 70);
    ctx.lineTo(W, GROUND_Y);
    ctx.lineTo(0, GROUND_Y);
    ctx.fill();

    // trilha de terra
    ctx.fillStyle = "#8B6A40";
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = "#A88452";
    ctx.fillRect(0, GROUND_Y, W, 10);
    for (let x = 20; x < W; x += 48) {
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(x, GROUND_Y + 16, 22, 4);
    }

    // árvores simples
    [
      [40, 0.85],
      [210, 1],
      [430, 0.75],
      [860, 0.9],
    ].forEach(([x, s]) => {
      ctx.fillStyle = "#6B4226";
      ctx.fillRect(x - 4 * s, GROUND_Y - 46 * s, 8 * s, 46 * s);
      ctx.fillStyle = "#2F7A3C";
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y - 110 * s);
      ctx.lineTo(x + 28 * s, GROUND_Y - 48 * s);
      ctx.lineTo(x - 28 * s, GROUND_Y - 48 * s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y - 88 * s);
      ctx.lineTo(x + 24 * s, GROUND_Y - 36 * s);
      ctx.lineTo(x - 24 * s, GROUND_Y - 36 * s);
      ctx.closePath();
      ctx.fill();
    });
  }

  function drawSling() {
    // forquilha / bastões de trilha
    ctx.strokeStyle = "#5C3A1E";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(SLING.x - 18, GROUND_Y);
    ctx.lineTo(SLING.x - 10, SLING.y - 34);
    ctx.moveTo(SLING.x + 18, GROUND_Y);
    ctx.lineTo(SLING.x + 10, SLING.y - 34);
    ctx.stroke();

    const anchorL = { x: SLING.x - 14, y: SLING.y - 28 };
    const anchorR = { x: SLING.x + 14, y: SLING.y - 28 };
    const hold =
      bird && bird.state === "ready"
        ? { x: bird.x, y: bird.y }
        : { x: SLING.x, y: SLING.y };

    ctx.strokeStyle = "#2A1A10";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(anchorL.x, anchorL.y);
    ctx.lineTo(hold.x, hold.y);
    ctx.lineTo(anchorR.x, anchorR.y);
    ctx.stroke();

    // base
    ctx.fillStyle = "#6B4423";
    ctx.fillRect(SLING.x - 26, GROUND_Y - 12, 52, 12);
  }

  function drawBox(body) {
    const x = body.x - body.w / 2;
    const y = body.y - body.h / 2;
    if (body.kind === "stone") {
      ctx.fillStyle = "#8B949E";
      ctx.strokeStyle = "#5C6570";
    } else {
      ctx.fillStyle = "#C99555";
      ctx.strokeStyle = "#8A5A2B";
    }
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, body.w, body.h);
    ctx.strokeRect(x, y, body.w, body.h);
    if (body.kind === "wood") {
      ctx.strokeStyle = "rgba(90,50,20,0.35)";
      ctx.beginPath();
      ctx.moveTo(x + 6, y + body.h * 0.35);
      ctx.lineTo(x + body.w - 6, y + body.h * 0.35);
      ctx.moveTo(x + 8, y + body.h * 0.7);
      ctx.lineTo(x + body.w - 8, y + body.h * 0.7);
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(x + 4, y + 4, body.w * 0.35, 5);
    }
  }

  function drawBottle(r) {
    ctx.fillStyle = "rgba(56,189,248,0.85)";
    ctx.fillRect(-r * 0.28, -r * 0.55, r * 0.56, r * 1.05);
    ctx.fillStyle = "#0EA5E9";
    ctx.fillRect(-r * 0.18, -r * 0.78, r * 0.36, r * 0.28);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(-r * 0.18, -r * 0.2, r * 0.12, r * 0.45);
  }

  function drawCan(r) {
    ctx.fillStyle = "#94A3B8";
    ctx.fillRect(-r * 0.4, -r * 0.55, r * 0.8, r * 1.05);
    ctx.fillStyle = "#64748B";
    ctx.fillRect(-r * 0.4, -r * 0.55, r * 0.8, r * 0.18);
    ctx.fillRect(-r * 0.4, r * 0.32, r * 0.8, r * 0.18);
    ctx.fillStyle = "#EF4444";
    ctx.fillRect(-r * 0.22, -r * 0.15, r * 0.44, r * 0.28);
  }

  function drawBag(r) {
    ctx.fillStyle = "rgba(100,116,139,0.55)";
    ctx.beginPath();
    ctx.moveTo(-r * 0.75, -r * 0.55);
    ctx.lineTo(r * 0.75, -r * 0.35);
    ctx.lineTo(r * 0.55, r * 0.7);
    ctx.lineTo(-r * 0.55, r * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#22C55E";
    ctx.beginPath();
    ctx.ellipse(0, 0.1 * r, 5, 7, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCup(r) {
    ctx.fillStyle = "#FB7185";
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, -r * 0.55);
    ctx.lineTo(r * 0.45, -r * 0.55);
    ctx.lineTo(r * 0.32, r * 0.65);
    ctx.lineTo(-r * 0.32, r * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(-r * 0.5, -r * 0.62, r, r * 0.14);
    ctx.strokeStyle = "#BE123C";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, -r * 0.2);
    ctx.lineTo(r * 0.2, r * 0.25);
    ctx.stroke();
  }

  function drawWrap(r) {
    ctx.fillStyle = "#F59E0B";
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.75, r * 0.5, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FDE68A";
    ctx.beginPath();
    ctx.ellipse(-2, -2, r * 0.35, r * 0.22, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#B45309";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, r * 0.1);
    ctx.lineTo(r * 0.55, -r * 0.15);
    ctx.stroke();
  }

  function drawPest(body) {
    ctx.save();
    ctx.translate(body.x, body.y);
    if (body.pest === "can") drawCan(body.r);
    else if (body.pest === "bag") drawBag(body.r);
    else if (body.pest === "cup") drawCup(body.r);
    else if (body.pest === "wrap") drawWrap(body.r);
    else drawBottle(body.r);
    ctx.fillStyle = "#fff";
    ctx.font = "700 9px Manrope, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(body.label || "Lixo", 0, body.r + 12);
    ctx.restore();
  }

  function drawLeaderName(x, y, name, above = 34) {
    const label = String(name || "");
    ctx.font = "800 11px Manrope, sans-serif";
    ctx.textAlign = "center";
    const tw = ctx.measureText(label).width;
    const pad = 6;
    const w = tw + pad * 2;
    const h = 18;
    const bx = x - w / 2;
    const by = y - above - 12;
    ctx.fillStyle = "rgba(8,24,16,0.82)";
    ctx.fillRect(bx, by, w, h);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(label, x, y - above + 1);
  }

  function drawBird(body) {
    const img = leaderImgs[body.leader.id];
    const size = body.r * 2.15;
    ctx.save();
    ctx.translate(body.x, body.y);
    if (body.launched) {
      const ang = Math.atan2(body.vy, body.vx);
      ctx.rotate(ang * 0.35);
    }
    ctx.beginPath();
    ctx.arc(0, 0, body.r + 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fill();
    if (img) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = "#1A6BFF";
      ctx.beginPath();
      ctx.arc(0, 0, body.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    drawLeaderName(body.x, body.y, body.leader.name, body.r + 16);
  }

  function drawAimGuide() {
    if (!bird || bird.state !== "ready" || !aiming) return;
    const power = Math.hypot(pull.x, pull.y) / MAX_PULL;
    const vx = (-pull.x / MAX_PULL) * LAUNCH_POWER * bird.leader.power * power;
    const vy = (-pull.y / MAX_PULL) * LAUNCH_POWER * bird.leader.power * power;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    let x = bird.x;
    let y = bird.y;
    let lv = vx;
    let ly = vy;
    for (let i = 0; i < 14; i += 1) {
      ly += G * 0.035;
      x += lv * 0.035;
      y += ly * 0.035;
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawAmmoPreview() {
    const queue = [...ammo];
    queue.forEach((b, i) => {
      const x = 44;
      const y = 120 + i * 58;
      const img = leaderImgs[b.leader.id];
      if (img) ctx.drawImage(img, x - 16, y - 18, 32, 36);
      else {
        ctx.fillStyle = "#1A6BFF";
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fill();
      }
      drawLeaderName(x, y, b.leader.name, 28);
    });
  }

  function draw() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawBackground();

    const ox = shake ? (Math.random() - 0.5) * shake : 0;
    const oy = shake ? (Math.random() - 0.5) * shake : 0;
    ctx.translate(ox, oy);
    drawSling();
    drawAmmoPreview();
    bodies.forEach((b) => {
      if (!b.alive) return;
      if (b.type === "box") drawBox(b);
      else if (b.kind === "pest") drawPest(b);
    });
    if (bird && bird.alive) drawBird(bird);
    drawAimGuide();
    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // HUD opaco (não deixa nuvem passar por baixo)
    ctx.fillStyle = "rgba(8,24,16,0.92)";
    ctx.fillRect(12, 12, 250, 34);
    ctx.fillStyle = "#fff";
    ctx.font = "700 14px Manrope, sans-serif";
    ctx.textAlign = "left";
    const left = pestsLeft();
    ctx.fillText(
      `${LEVEL_NAMES[levelIndex] || "Trilha"} · ${left} lixo${left === 1 ? "" : "s"}`,
      22,
      34
    );
    ctx.restore();
  }

  function frame(ts) {
    if (!active) {
      raf = 0;
      return;
    }
    if (!lastTs) lastTs = ts;
    let dt = Math.min(0.033, (ts - lastTs) / 1000);
    lastTs = ts;
    if (running) {
      const steps = 2;
      for (let i = 0; i < steps; i += 1) step(dt / steps);
    }
    draw();
    raf = requestAnimationFrame(frame);
  }

  function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const src = e.touches && e.touches[0] ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
    };
  }

  function onPointerDown(e) {
    if (!running || !bird || bird.state !== "ready") return;
    const p = canvasPoint(e);
    if (Math.hypot(p.x - bird.x, p.y - bird.y) > 56 && Math.hypot(p.x - SLING.x, p.y - SLING.y) > 70) {
      return;
    }
    aiming = true;
    pointerId = e.pointerId;
    canvas.setPointerCapture?.(pointerId);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!aiming || !bird || bird.state !== "ready") return;
    if (pointerId != null && e.pointerId !== pointerId) return;
    const p = canvasPoint(e);
    let dx = p.x - SLING.x;
    let dy = p.y - SLING.y;
    // puxa principalmente para trás/baixo
    dx = Math.min(40, dx);
    const len = Math.hypot(dx, dy);
    if (len > MAX_PULL) {
      dx = (dx / len) * MAX_PULL;
      dy = (dy / len) * MAX_PULL;
    }
    pull = { x: dx, y: dy };
    bird.x = SLING.x + dx;
    bird.y = SLING.y + dy;
    e.preventDefault();
  }

  function launchBird() {
    if (!bird || bird.state !== "ready") return;
    const power = Math.min(1, Math.hypot(pull.x, pull.y) / MAX_PULL);
    if (power < 0.12) {
      bird.x = SLING.x;
      bird.y = SLING.y;
      pull = { x: 0, y: 0 };
      return;
    }
    const mult = LAUNCH_POWER * bird.leader.power * power;
    bird.vx = (-pull.x / MAX_PULL) * mult;
    bird.vy = (-pull.y / MAX_PULL) * mult;
    bird.state = "flight";
    bird.launched = true;
    bird.sleeping = false;
    settledTimer = 0;
    shotAge = 0;
    aiming = false;
    pull = { x: 0, y: 0 };
  }

  function onPointerUp(e) {
    if (!aiming) return;
    if (pointerId != null && e.pointerId !== pointerId) return;
    aiming = false;
    pointerId = null;
    launchBird();
    e.preventDefault();
  }

  startBtn.addEventListener("click", () => {
    const action = startBtn.dataset.action || "start";
    if (action === "next-level") {
      startLevel(levelIndex + 1);
      startBtn.dataset.action = "start";
      return;
    }
    startRun();
    startBtn.dataset.action = "start";
  });

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  function activate() {
    active = true;
    updateChrome();
    if (!raf) {
      lastTs = 0;
      raf = requestAnimationFrame(frame);
    }
    if (!running) draw();
  }

  function deactivate() {
    active = false;
    aiming = false;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  loadLeaders();
  resetClouds();
  updateChrome();
  showOverlay("Objetivo: acabar com o lixo das trilhas. Puxe e solte!", "Começar");
  startBtn.dataset.action = "start";
  draw();

  window.SDZ_ANGRY_GAME = { activate, deactivate, LEADERS };
})();
