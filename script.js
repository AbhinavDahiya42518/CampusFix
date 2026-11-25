(() => {
  "use strict";

  const STORAGE_KEY = "campusfix.complaints.v1";
  const CATEGORIES = [
    "Electricity",
    "Water Supply",
    "Wi-Fi & Internet",
    "Cleanliness",
    "Infrastructure",
    "Classroom Facilities"
  ];
  const STATUSES = ["Pending", "In Progress", "Resolved"];

  const DEMO_COMPLAINTS = [
    {
      id: "CF-1042",
      name: "Aisha Rahman",
      studentId: "2023BCS018",
      category: "Electricity",
      location: "Block C, Lab 2",
      description: "Two rows of lights flicker and fail during evening labs. The circuit trips when the projector is switched on.",
      status: "Pending",
      createdAt: "2026-11-18T09:24:00.000Z",
      demo: true
    },
    {
      id: "CF-1188",
      name: "Kabir Mehta",
      studentId: "2022ECE044",
      category: "Wi-Fi & Internet",
      location: "Central Library, Level 3",
      description: "Wireless drops every few minutes on the quiet floor. Ethernet ports along the north wall are dead.",
      status: "In Progress",
      createdAt: "2026-11-16T14:05:00.000Z",
      demo: true
    },
    {
      id: "CF-0931",
      name: "Sara Iyer",
      studentId: "2024MEC012",
      category: "Water Supply",
      location: "Hostel B, Wing 2",
      description: "No water supply on the second floor since Monday morning. Ground-floor pressure is also very low.",
      status: "Resolved",
      createdAt: "2026-11-12T06:40:00.000Z",
      demo: true
    }
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function motionEnabled() {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function wrap(value, span) {
    const mod = value % span;
    return mod < 0 ? mod + span : mod;
  }

  /**
   * Cinematic background.
   * One canvas holds three depth layers:
   *   far  — perspective grid, slowest scroll parallax
   *   mid  — linked network nodes
   *   near — glowing particles, fastest scroll parallax
   * Scroll is eased so the world glides instead of stepping.
   * The loop uses requestAnimationFrame and pauses while the tab is hidden.
   */
  function initBackground() {
    const canvas = $("#bg-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const orbs = $$(".orb");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const state = {
      width: 0,
      height: 0,
      dpr: 1,
      time: 0,
      scroll: window.scrollY || 0,
      scrollTarget: window.scrollY || 0,
      mouseX: 0,
      mouseY: 0,
      mouseTX: 0,
      mouseTY: 0,
      mobile: window.innerWidth < 760,
      reduced: motion.matches,
      stars: [],
      particles: [],
      nodes: []
    };

    let running = false;
    let frameId = 0;
    let last = 0;

    function createField(count, minR, maxR) {
      const list = [];
      for (let index = 0; index < count; index += 1) {
        list.push({
          x: Math.random(),
          y: Math.random(),
          z: Math.random(),
          r: minR + Math.random() * (maxR - minR),
          vx: (Math.random() - 0.5) * 0.012,
          vy: (Math.random() - 0.5) * 0.01,
          violet: Math.random() > 0.8,
          phase: Math.random() * Math.PI * 2
        });
      }
      return list;
    }

    function rebuildPopulation(force) {
      const mobile = window.innerWidth < 760;
      if (!force && mobile === state.mobile && state.nodes.length) return;
      state.mobile = mobile;
      state.stars = createField(mobile ? 22 : 48, 0.35, 1);
      state.particles = createField(mobile ? 26 : 58, 0.7, 1.8);
      state.nodes = createField(mobile ? 14 : 26, 1.1, 1.9);
    }

    function resize() {
      const cap = window.innerWidth < 760 ? 1.25 : 1.75;
      state.dpr = Math.min(window.devicePixelRatio || 1, cap);
      state.width = window.innerWidth;
      state.height = window.innerHeight;
      canvas.width = Math.round(state.width * state.dpr);
      canvas.height = Math.round(state.height * state.dpr);
      canvas.style.width = state.width + "px";
      canvas.style.height = state.height + "px";
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      rebuildPopulation(false);
      if (state.reduced) draw();
    }

    function drift(list, dt) {
      for (let index = 0; index < list.length; index += 1) {
        const point = list[index];
        point.x += point.vx * dt;
        point.y += point.vy * dt;
        if (point.x < 0) point.x += 1;
        else if (point.x > 1) point.x -= 1;
        if (point.y < 0) point.y += 1;
        else if (point.y > 1) point.y -= 1;
      }
    }

    function placeOrbs() {
      for (let index = 0; index < orbs.length; index += 1) {
        const orb = orbs[index];
        const depth = Number(orb.dataset.depth) || 0;
        const x = state.mouseX * 120 * depth;
        const y = -state.scroll * depth + state.mouseY * 80 * depth;
        orb.style.transform = "translate3d(" + x.toFixed(1) + "px, " + y.toFixed(1) + "px, 0)";
      }
    }

    function drawGrid() {
      const w = state.width;
      const h = state.height;
      const horizon = Math.min(h * 0.62, 560);
      const vanishX = w * 0.5 + state.mouseX * 18;
      const phase = wrap(state.time * 0.03 + state.scroll * 0.00022, 1);

      const glow = ctx.createRadialGradient(vanishX, horizon, 0, vanishX, horizon, w * 0.42);
      glow.addColorStop(0, "rgba(0, 217, 255, 0.07)");
      glow.addColorStop(0.45, "rgba(115, 91, 255, 0.035)");
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      ctx.lineWidth = 1;
      ctx.beginPath();
      const columns = state.mobile ? 8 : 12;
      for (let index = 0; index <= columns; index += 1) {
        const spread = index / columns - 0.5;
        ctx.moveTo(vanishX, horizon - 24);
        ctx.lineTo(vanishX + spread * w * 1.35, h + 12);
      }
      ctx.strokeStyle = "rgba(115, 91, 255, 0.055)";
      ctx.stroke();

      const rows = state.mobile ? 12 : 16;
      for (let index = 0; index <= rows; index += 1) {
        const depth = (index + phase) / rows;
        if (depth > 1) continue;
        const eased = Math.pow(depth, 1.65);
        const y = horizon + eased * (h - horizon + 30);
        const alpha = 0.025 + eased * 0.09;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.strokeStyle = "rgba(0, 217, 255, " + alpha.toFixed(3) + ")";
        ctx.stroke();
      }
    }

    function drawPoints(list, travel, halo) {
      const w = state.width;
      const h = state.height;
      const span = h + 140;
      for (let index = 0; index < list.length; index += 1) {
        const point = list[index];
        const depth = 0.4 + point.z * 0.7;
        const x = point.x * w + state.mouseX * 20 * point.z;
        const y = wrap(point.y * h - travel * (0.35 + point.z), span) - 70;
        const edge = Math.min(x, w - x, y + 40, h - y);
        const fade = clamp(edge / 80, 0, 1);
        if (fade <= 0.01) continue;

        const twinkle = 0.72 + Math.sin(state.time * 1.4 + point.phase) * 0.28;
        const alpha = fade * twinkle * (0.28 + point.z * 0.72);
        const color = point.violet ? "115, 91, 255" : "0, 217, 255";
        const radius = point.r * depth;

        if (halo) {
          ctx.fillStyle = "rgba(" + color + ", " + (alpha * 0.16).toFixed(3) + ")";
          ctx.beginPath();
          ctx.arc(x, y, radius * 5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = "rgba(" + color + ", " + Math.min(1, alpha).toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.6, radius), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawNetwork(travel) {
      const w = state.width;
      const h = state.height;
      const span = h + 140;
      const projected = [];
      const maxDist = state.mobile ? 110 : 150;

      for (let index = 0; index < state.nodes.length; index += 1) {
        const node = state.nodes[index];
        const x = node.x * w + state.mouseX * 26 * node.z;
        const y = wrap(node.y * h - travel * (0.3 + node.z * 0.7), span) - 70;
        const edge = Math.min(x, w - x, y + 40, h - y);
        projected.push({
          x,
          y,
          fade: clamp(edge / 80, 0, 1),
          depth: 0.45 + node.z * 0.7,
          violet: node.violet,
          r: node.r
        });
      }

      ctx.lineWidth = 1;
      for (let i = 0; i < projected.length; i += 1) {
        const a = projected[i];
        if (a.fade <= 0.02) continue;
        for (let j = i + 1; j < projected.length; j += 1) {
          const b = projected[j];
          if (b.fade <= 0.02) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist > maxDist) continue;
          const alpha = (1 - dist / maxDist) * 0.32 * Math.min(a.fade, b.fade);
          ctx.strokeStyle = a.violet || b.violet
            ? "rgba(115, 91, 255, " + alpha.toFixed(3) + ")"
            : "rgba(0, 217, 255, " + alpha.toFixed(3) + ")";
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      for (let index = 0; index < projected.length; index += 1) {
        const node = projected[index];
        if (node.fade <= 0.02) continue;
        const color = node.violet ? "115, 91, 255" : "0, 217, 255";
        ctx.fillStyle = "rgba(" + color + ", " + (0.2 * node.fade).toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r * 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(" + color + ", " + node.fade.toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function draw() {
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      ctx.clearRect(0, 0, state.width, state.height);
      ctx.globalCompositeOperation = "source-over";
      drawGrid();

      // Scroll parallax speeds, in pixels. Near layers travel farther.
      const starTravel = state.time * 4 + state.scroll * 0.07;
      const nodeTravel = state.time * 10 + state.scroll * 0.16;
      const particleTravel = state.time * 16 + state.scroll * 0.38;

      ctx.globalCompositeOperation = "lighter";
      drawPoints(state.stars, starTravel, false);
      drawNetwork(nodeTravel);
      drawPoints(state.particles, particleTravel, !state.mobile);
      ctx.globalCompositeOperation = "source-over";
      placeOrbs();
    }

    function stop() {
      running = false;
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
    }

    function start() {
      if (state.reduced || running) return;
      running = true;
      last = performance.now();
      frameId = requestAnimationFrame(loop);
    }

    function loop(now) {
      if (!running || document.hidden || state.reduced) {
        running = false;
        frameId = 0;
        return;
      }

      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      state.time += dt;
      const ease = 1 - Math.exp(-6 * dt);
      state.scroll += (state.scrollTarget - state.scroll) * ease;
      state.mouseX += (state.mouseTX - state.mouseX) * ease;
      state.mouseY += (state.mouseTY - state.mouseY) * ease;

      if (!state.reduced) {
        drift(state.stars, dt);
        drift(state.particles, dt);
        drift(state.nodes, dt);
      }

      draw();
      frameId = requestAnimationFrame(loop);
    }

    window.addEventListener("resize", resize);
    window.addEventListener("scroll", () => {
      state.scrollTarget = window.scrollY || document.documentElement.scrollTop || 0;
    }, { passive: true });

    if (!window.matchMedia("(pointer: coarse)").matches) {
      window.addEventListener("pointermove", (event) => {
        state.mouseTX = (event.clientX / Math.max(state.width, 1) - 0.5) * 2;
        state.mouseTY = (event.clientY / Math.max(state.height, 1) - 0.5) * 2;
      }, { passive: true });
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
      else start();
    });

    motion.addEventListener("change", () => {
      state.reduced = motion.matches;
      if (state.reduced) {
        stop();
        state.scroll = state.scrollTarget;
        draw();
      } else {
        start();
      }
    });

    resize();
    rebuildPopulation(true);
    draw();
    start();
  }

  function initNavigation() {
    const header = $("#site-header");
    const nav = $("#site-nav");
    const toggle = $("#nav-toggle");
    if (!header || !nav || !toggle) return;

    const desktop = window.matchMedia("(min-width: 861px)");

    function setOpen(open) {
      header.classList.toggle("is-open", open);
      document.body.classList.toggle("nav-lock", open && !desktop.matches);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      if ("inert" in nav) nav.inert = !desktop.matches && !open;
      if (open) {
        const first = nav.querySelector("a");
        if (first) first.focus();
      }
    }

    toggle.addEventListener("click", () => {
      setOpen(!header.classList.contains("is-open"));
    });

    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setOpen(false);
    });

    desktop.addEventListener("change", () => setOpen(false));
    setOpen(false);

    const elevate = () => {
      header.classList.toggle("is-elevated", (window.scrollY || 0) > 8);
    };
    elevate();
    window.addEventListener("scroll", elevate, { passive: true });

    const links = $$(".nav-link");
    const sections = links
      .map((link) => document.getElementById(link.getAttribute("href").slice(1)))
      .filter(Boolean);

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((link) => {
            link.classList.toggle("is-active", link.getAttribute("href") === "#" + entry.target.id);
          });
        });
      }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
      sections.forEach((section) => observer.observe(section));
    }
  }

  function initReveal() {
    const nodes = $$(".reveal");
    if (!nodes.length) return;
    if (!motionEnabled() || !("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.16, rootMargin: "0px 0px -8% 0px" });
    nodes.forEach((node) => observer.observe(node));
  }

  function initStats() {
    const nodes = $$("[data-count]");
    if (!nodes.length) return;

    const paint = (node) => {
      const target = Number(node.dataset.count);
      if (!Number.isFinite(target)) return;
      node.textContent = Math.round(target).toLocaleString("en-US");
    };

    const animate = (node) => {
      const target = Number(node.dataset.count);
      if (!Number.isFinite(target)) return;
      const started = performance.now();
      const duration = 1100;
      const tick = (now) => {
        const progress = Math.min(1, (now - started) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        node.textContent = Math.round(target * eased).toLocaleString("en-US");
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if (!motionEnabled() || !("IntersectionObserver" in window)) {
      nodes.forEach(paint);
      return;
    }

    const grid = $(".stat-grid");
    if (!grid) {
      nodes.forEach(animate);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      nodes.forEach(animate);
      observer.disconnect();
    }, { threshold: 0.35 });
    observer.observe(grid);
  }

  function loadComplaints() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          return parsed.filter((item) => item && typeof item.id === "string");
        }
      }
    } catch (error) {
      /* Storage can be blocked. The demo still runs in memory. */
    }
    const seeded = DEMO_COMPLAINTS.map((item) => ({ ...item }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    } catch (error) {
      /* Ignore quota and privacy-mode failures. */
    }
    return seeded;
  }

  function persistComplaints(complaints) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(complaints));
      return true;
    } catch (error) {
      return false;
    }
  }

  function createId(complaints) {
    const used = new Set(complaints.map((item) => item.id));
    let id = "";
    do {
      id = "CF-" + String(Math.floor(1000 + Math.random() * 9000));
    } while (used.has(id));
    return id;
  }

  function statusClass(status) {
    if (status === "In Progress") return "is-progress";
    if (status === "Resolved") return "is-resolved";
    return "is-pending";
  }

  function formatWhen(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "Unknown time";
    return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function initComplaints() {
    let complaints = loadComplaints();
    const form = $("#report-form");
    const success = $("#success-panel");
    const live = $("#form-live");
    const recent = $("#recent-list");
    const deviceCount = $("#device-count");
    const result = $("#track-result");
    const trackForm = $("#track-form");
    const trackInput = $("#track-id");
    const trackError = $("#track-error");

    const fields = [
      { input: $("#student-name"), error: $("#name-error"), message: "Enter the student name.", valid: (value) => value.trim().length >= 2 && value.trim().length <= 60 && /[A-Za-z]/.test(value) },
      { input: $("#student-id"), error: $("#student-id-error"), message: "Enter a student ID using 4–16 letters or numbers.", valid: (value) => /^[A-Za-z0-9][A-Za-z0-9/-]{3,15}$/.test(value.trim()) },
      { input: $("#category"), error: $("#category-error"), message: "Select an issue category.", valid: (value) => CATEGORIES.includes(value) },
      { input: $("#location"), error: $("#location-error"), message: "Enter the location on campus.", valid: (value) => value.trim().length >= 2 && value.trim().length <= 80 },
      { input: $("#description"), error: $("#description-error"), message: "Describe the issue in at least 20 characters.", valid: (value) => value.trim().length >= 20 && value.trim().length <= 600 }
    ];

    function clearField(field) {
      field.input.closest(".field").classList.remove("is-invalid");
      field.input.removeAttribute("aria-invalid");
      field.error.hidden = true;
      field.error.textContent = "";
    }

    function renderRecent() {
      if (!recent || !deviceCount) return;
      deviceCount.textContent = complaints.length + " saved in this browser";
      recent.replaceChildren();
      const ordered = complaints.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      ordered.slice(0, 8).forEach((complaint) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "id-chip";
        button.dataset.id = complaint.id;
        const title = element("strong", "", complaint.id);
        const meta = element("span", "", complaint.status + (complaint.demo ? " · Sample" : ""));
        button.append(title, meta);
        button.addEventListener("click", () => {
          trackInput.value = complaint.id;
          showComplaint(complaint);
          const track = $("#track");
          if (track) {
            track.scrollIntoView({ behavior: motionEnabled() ? "smooth" : "auto", block: "start" });
          }
        });
        recent.append(button);
      });
    }

    function showComplaint(complaint) {
      if (!result) return;
      result.replaceChildren();
      if (!complaint) {
        const box = element("div", "track-message");
        box.append(
          element("h3", "", "No complaint found"),
          element("p", "muted", "That ID is not stored in this browser. Try CF-1042, CF-1188, or CF-0931, or submit a new report.")
        );
        result.append(box);
        return;
      }

      const top = element("div", "track-result-top");
      top.append(element("p", "eyebrow", "Complaint"), element("span", "badge " + statusClass(complaint.status), complaint.status));

      const list = element("dl", "detail-list");
      const rows = [
        ["Student", complaint.name],
        ["Student ID", complaint.studentId],
        ["Category", complaint.category],
        ["Location", complaint.location],
        ["Filed", formatWhen(complaint.createdAt)],
        ["Description", complaint.description]
      ];
      rows.forEach(([label, value]) => {
        list.append(element("dt", "", label), element("dd", label === "Description" ? "track-desc" : "", value || "—"));
      });

      const timeline = element("ol", "timeline");
      const index = Math.max(0, STATUSES.indexOf(complaint.status));
      const copies = [
        "The report is logged and waiting.",
        "The issue is marked as being worked on.",
        "The complaint is closed in this demo record."
      ];
      STATUSES.forEach((status, step) => {
        const item = element("li", "timeline-step");
        if (step < index) item.classList.add("is-complete");
        else if (step === index) item.classList.add("is-current");
        else item.classList.add("is-upcoming");
        const mark = element("span", "timeline-mark", step < index ? "✓" : String(step + 1));
        const copy = element("div");
        copy.append(element("p", "timeline-label", status), element("p", "timeline-copy", copies[step]));
        item.append(mark, copy);
        timeline.append(item);
      });

      const note = element(
        "p",
        "demo-flag",
        complaint.demo
          ? "Sample record stored in this browser for the demo."
          : "Saved in this browser only. Status does not come from a campus server."
      );
      result.append(top, element("p", "track-id", complaint.id), list, timeline, note);
    }

    function showSuccess(complaint, persisted) {
      form.hidden = true;
      success.hidden = false;
      $("#success-id").textContent = complaint.id;
      $("#copy-note").textContent = persisted
        ? "Stored in localStorage on this browser."
        : "Saved for this session. This browser blocked localStorage, so a refresh may clear it.";
      if (live) live.textContent = "Complaint " + complaint.id + " saved on this device.";
      const title = $("#success-title");
      if (title) title.focus();
    }

    fields.forEach((field) => {
      field.input.addEventListener("input", () => clearField(field));
      field.input.addEventListener("change", () => clearField(field));
    });

    $$("[data-category]").forEach((button) => {
      button.addEventListener("click", () => {
        const select = $("#category");
        select.value = button.dataset.category || "";
        select.dispatchEvent(new Event("change"));
        const report = $("#report");
        if (report) report.scrollIntoView({ behavior: motionEnabled() ? "smooth" : "auto", block: "start" });
        $("#location").focus();
      });
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      let firstInvalid = null;
      const values = {};
      fields.forEach((field) => {
        const value = field.input.value;
        if (field.valid(value)) {
          clearField(field);
          values[field.input.id] = value.trim();
          return;
        }
        field.input.closest(".field").classList.add("is-invalid");
        field.input.setAttribute("aria-invalid", "true");
        field.error.hidden = false;
        field.error.textContent = field.message;
        if (!firstInvalid) firstInvalid = field.input;
      });
      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      const complaint = {
        id: createId(complaints),
        name: values["student-name"],
        studentId: values["student-id"].toUpperCase(),
        category: values.category,
        location: values.location,
        description: values.description,
        status: "Pending",
        createdAt: new Date().toISOString(),
        demo: false
      };
      complaints.unshift(complaint);
      const persisted = persistComplaints(complaints);
      renderRecent();
      showSuccess(complaint, persisted);
    });

    $("#file-another").addEventListener("click", () => {
      form.reset();
      fields.forEach(clearField);
      success.hidden = true;
      form.hidden = false;
      $("#copy-note").textContent = "";
      $("#student-name").focus();
    });

    $("#copy-id").addEventListener("click", async () => {
      const id = $("#success-id").textContent.trim();
      const note = $("#copy-note");
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(id);
        } else {
          const area = document.createElement("textarea");
          area.value = id;
          area.setAttribute("readonly", "");
          area.style.position = "fixed";
          area.style.left = "-9999px";
          document.body.append(area);
          area.select();
          document.execCommand("copy");
          area.remove();
        }
        note.textContent = "Copied " + id + ".";
      } catch (error) {
        note.textContent = "Copy failed. Select the ID and copy it manually.";
      }
    });

    $("#track-this").addEventListener("click", () => {
      const id = $("#success-id").textContent.trim();
      trackInput.value = id;
      showComplaint(complaints.find((item) => item.id === id));
      $("#track").scrollIntoView({ behavior: motionEnabled() ? "smooth" : "auto", block: "start" });
    });

    trackForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const id = trackInput.value.trim().toUpperCase();
      if (!id) {
        trackForm.classList.add("is-invalid");
        trackError.hidden = false;
        trackError.textContent = "Enter a complaint ID.";
        trackInput.focus();
        return;
      }
      trackForm.classList.remove("is-invalid");
      trackError.hidden = true;
      trackError.textContent = "";
      trackInput.value = id;
      showComplaint(complaints.find((item) => item.id.toUpperCase() === id));
    });

    trackInput.addEventListener("input", () => {
      trackForm.classList.remove("is-invalid");
      trackError.hidden = true;
    });

    const successTitle = $("#success-title");
    if (successTitle) successTitle.setAttribute("tabindex", "-1");

    renderRecent();
  }

  initBackground();
  initNavigation();
  initReveal();
  initStats();
  initComplaints();
})();
