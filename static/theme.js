(function () {
  var KEY = "rr-theme";
  var LIGHT_KEY = "rr-theme-light";
  var DARK_KEY = "rr-theme-dark";
  var THEMES = {
    paper: { group: "light", label: "Paper" },
    linen: { group: "light", label: "Linen" },
    sage: { group: "light", label: "Sage" },
    fog: { group: "light", label: "Fog" },
    sand: { group: "light", label: "Sand" },
    frost: { group: "light", label: "Frost" },
    night: { group: "dark", label: "Night" },
    slate: { group: "dark", label: "Slate" },
    ember: { group: "dark", label: "Ember" },
    pine: { group: "dark", label: "Pine" },
    ink: { group: "dark", label: "Ink" },
    coal: { group: "dark", label: "Coal" },
  };
  var LEGACY = { light: "paper", dark: "night" };

  function systemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "paper";
  }

  function normalizeTheme(theme) {
    theme = LEGACY[theme] || theme;
    return THEMES[theme] ? theme : systemTheme();
  }

  function currentTheme() {
    return normalizeTheme(document.documentElement.getAttribute("data-theme"));
  }

  function isDark(theme) {
    return THEMES[normalizeTheme(theme || currentTheme())].group === "dark";
  }

  function syncPicker(theme) {
    var sel = document.getElementById("theme-select");
    if (sel && sel.value !== theme) sel.value = theme;
  }

  function preferNightFlag() {
    try {
      var pad = JSON.parse(localStorage.getItem("rr-pad-defaults") || "{}");
      if (pad && pad.preferNight) return true;
    } catch (err) {}
    try {
      var disk = window.__TRAINLOG_APPEARANCE__ || {};
      return !!disk.preferNight;
    } catch (err) {
      return false;
    }
  }

  function persistAppearance(theme) {
    var body = { theme: theme, preferNight: preferNightFlag() };
    try {
      window.__TRAINLOG_APPEARANCE__ = Object.assign({}, window.__TRAINLOG_APPEARANCE__ || {}, body);
    } catch (err) {}
    try {
      fetch("/api/appearance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(function () {});
    } catch (err) {}
  }

  function applyTheme(theme) {
    theme = normalizeTheme(theme);
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(KEY, theme);
      if (THEMES[theme].group === "dark") localStorage.setItem(DARK_KEY, theme);
      else localStorage.setItem(LIGHT_KEY, theme);
    } catch (err) {}
    persistAppearance(theme);
    syncPicker(theme);
    return theme;
  }

  function toggleTheme() {
    if (isDark()) {
      var light = "paper";
      try {
        light = localStorage.getItem(LIGHT_KEY) || "paper";
      } catch (err) {}
      return applyTheme(light);
    }
    var dark = "night";
    try {
      dark = localStorage.getItem(DARK_KEY) || "night";
    } catch (err) {}
    return applyTheme(dark);
  }

  function initTheme() {
    applyTheme(currentTheme());
    var sel = document.getElementById("theme-select");
    if (sel) {
      sel.addEventListener("change", function () {
        applyTheme(sel.value);
      });
    }
  }

  var SIZE_KEY = "rr-text-size";
  var SIZES = { smaller: 0.8, small: 0.9, normal: 1, large: 1.15, larger: 1.3 };
  var SIZE_ORDER = ["smaller", "small", "normal", "large", "larger"];
  var TABLET_MIN = 701;

  function savedSize() {
    try {
      var size = localStorage.getItem(SIZE_KEY);
      return SIZES[size] ? size : "normal";
    } catch (err) {
      return "normal";
    }
  }

  function isQt() {
    return /QtWebEngine/i.test(navigator.userAgent || "");
  }

  function isField() {
    return !!window.trainLogField || document.documentElement.classList.contains("is-field");
  }

  function screenWidth() {
    var a = window.screen.width || 0;
    var b = window.screen.height || 0;
    var landscape = window.matchMedia("(orientation: landscape)").matches;
    return landscape ? Math.max(a, b) : Math.min(a, b);
  }

  function tabletScale() {
    var shortSide = Math.min(window.screen.width || 0, window.screen.height || 0);
    if (shortSide < TABLET_MIN) return 1;
    return Math.max(1, Math.min(1.15, shortSide / (TABLET_MIN + 19)));
  }

  function defaultViewportContent() {
    return "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content";
  }

  function setViewportContent(content) {
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    // iOS often ignores in-place edits; swap the tag so the new scale sticks.
    meta.setAttribute("content", content);
    var parent = meta.parentNode;
    if (!parent) return;
    var next = meta.nextSibling;
    parent.removeChild(meta);
    if (next) parent.insertBefore(meta, next);
    else parent.appendChild(meta);
  }

  function fitViewport(factor) {
    var scale = factor * tabletScale();
    if (Math.abs(scale - 1) < 0.001) {
      setViewportContent(defaultViewportContent());
      return;
    }
    var width = screenWidth() || window.innerWidth || 390;
    if (!width) {
      setViewportContent(defaultViewportContent());
      return;
    }
    var layout = Math.max(1, Math.round(width / scale));
    var fixed = (width / layout).toFixed(3);
    setViewportContent(
      "width=" + layout + ", initial-scale=" + fixed + ", minimum-scale=" + fixed + ", maximum-scale=" + fixed +
        ", user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content"
    );
  }

  function fieldUsesViewportZoom() {
    // Real phones/tablets honor a dynamic viewport width. Desktop browsers — including the
    // device-preview iframes — ignore it, so those need CSS zoom instead.
    var ua = navigator.userAgent || "";
    if (/iPhone|iPod|Android/i.test(ua)) return true;
    if (/iPad/i.test(ua)) return true;
    if (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1) return true;
    return false;
  }

  function applyCssZoom(factor) {
    document.documentElement.style.zoom = factor === 1 ? "" : String(factor);
  }

  function blockPinchZoom() {
    ["gesturestart", "gesturechange", "gestureend"].forEach(function (name) {
      document.addEventListener(name, function (event) {
        event.preventDefault();
      });
    });
  }

  function applyTextSize(size, opts) {
    size = SIZES[size] ? size : "normal";
    try {
      localStorage.setItem(SIZE_KEY, size);
    } catch (err) {}
    var sel = document.getElementById("text-size-select");
    if (sel && sel.value !== size) sel.value = size;
    document.documentElement.setAttribute("data-text-size", size);
    var factor = SIZES[size];
    if (isQt()) {
      if (!(opts && opts.fromNative)) window.location.href = "/__native__/zoom?f=" + factor;
    } else if (isField() && fieldUsesViewportZoom()) {
      applyCssZoom(1);
      fitViewport(factor);
    } else {
      if (isField()) setViewportContent(defaultViewportContent());
      applyCssZoom(factor);
    }
    return size;
  }

  function stepTextSize(delta) {
    var index = SIZE_ORDER.indexOf(savedSize()) + delta;
    index = Math.max(0, Math.min(SIZE_ORDER.length - 1, index));
    return applyTextSize(SIZE_ORDER[index]);
  }

  function initTextSize() {
    var size = savedSize();
    if (!isQt()) {
      applyTextSize(size);
    } else if (size !== "normal") {
      if (document.readyState === "complete") applyTextSize(size);
      else window.addEventListener("load", function () {
        applyTextSize(size);
      });
    }
    var sel = document.getElementById("text-size-select");
    if (sel) {
      sel.value = size;
      sel.addEventListener("change", function () {
        applyTextSize(sel.value);
      });
    }
    if (isField()) {
      blockPinchZoom();
      lockFieldPortrait();
      if (fieldUsesViewportZoom()) {
        window.matchMedia("(orientation: landscape)").addEventListener("change", function () {
          fitViewport(SIZES[savedSize()]);
          lockFieldPortrait();
        });
      }
    }
  }

  function lockFieldPortrait() {
    if (!isField()) return;
    document.documentElement.classList.add("field-portrait-only");
    var orient = screen.orientation || screen.mozOrientation || screen.msOrientation;
    if (orient && typeof orient.lock === "function") {
      try {
        var locked = orient.lock("portrait");
        if (locked && typeof locked.catch === "function") locked.catch(function () {});
      } catch (err) {}
    }
  }

  function initCreditNote() {
    var note = document.querySelector(".credit-note");
    if (!note) return;
    var btn = note.querySelector(".credit-note-btn");
    function setOpen(open) {
      note.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    btn.addEventListener("click", function (event) {
      event.stopPropagation();
      setOpen(!note.classList.contains("is-open"));
    });
    document.addEventListener("click", function (event) {
      if (!note.contains(event.target)) setOpen(false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && note.classList.contains("is-open")) {
        setOpen(false);
        btn.focus();
      }
    });
  }

  window.trainLogTextSize = {
    apply: applyTextSize,
    step: stepTextSize,
    current: savedSize,
    factor: function () {
      return SIZES[savedSize()];
    },
  };

  window.trainLogTheme = {
    apply: applyTheme,
    current: currentTheme,
    toggle: toggleTheme,
    isDark: isDark,
    list: function () {
      return Object.keys(THEMES).map(function (id) {
        return { id: id, label: THEMES[id].label, group: THEMES[id].group };
      });
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTheme);
    document.addEventListener("DOMContentLoaded", initTextSize);
    document.addEventListener("DOMContentLoaded", initCreditNote);
  } else {
    initTheme();
    initTextSize();
    initCreditNote();
  }
})();
