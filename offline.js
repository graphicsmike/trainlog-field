(function () {
  "use strict";

  if (!window.trainLogField) return;

  const READY_KEY = "rr-offline-ready";
  const state = {
    progress: null,
    report: null,
    error: "",
    persisted: null,
    usage: null,
    checking: false,
    repaired: false,
    // Once a version is fully saved, keep Offline ready stable across brief
    // controller blips / mid-check gaps (the old "wobble").
    readyVersion: "",
    lastLabel: "",
  };
  const $ = function (id) {
    return document.getElementById(id);
  };

  function standalone() {
    return navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  }

  function appleTouch() {
    return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function supported() {
    return "serviceWorker" in navigator && window.isSecureContext && Boolean(window.trainLogWorker);
  }

  function ask(worker, type, wait) {
    return new Promise(function (resolve, reject) {
      const channel = new MessageChannel();
      const timer = setTimeout(function () {
        reject(new Error("The offline copy didn't answer."));
      }, wait);
      channel.port1.onmessage = function (event) {
        clearTimeout(timer);
        resolve(event.data);
      };
      worker.postMessage({ type: type }, [channel.port2]);
    });
  }

  function filesComplete(r) {
    return Boolean(r && r.total && r.have === r.total);
  }

  function complete() {
    const r = state.report;
    if (!filesComplete(r)) return false;
    // Prefer a controlling worker, but don't flip to "Not offline yet" for a
    // moment when controller is null during claim / update.
    if (navigator.serviceWorker.controller) return true;
    if (state.readyVersion && r.version && state.readyVersion === r.version) return true;
    return false;
  }

  function percent(p) {
    return Math.floor((100 * p.done) / Math.max(1, p.total));
  }

  function savingNewVersion() {
    const p = state.progress;
    return Boolean(p && p.done < p.total && state.report && p.version !== state.report.version);
  }

  function status() {
    if (!supported()) {
      return {
        kind: "bad",
        label: "Can't work offline here",
        detail:
          "This address can't keep an offline copy. Open TRAIN LOG from an https:// address (the public field site or a Home Screen install).",
      };
    }
    const p = state.progress;
    // Saving progress for this version — show busy, but if we were already ready
    // for this version don't regress the pill to a warning.
    if (!complete() && p && p.done < p.total) {
      return {
        kind: "busy",
        label: "Saving for offline… " + percent(p) + "%",
        detail: "Keep TRAIN LOG open on Wi-Fi until this says Offline ready.",
      };
    }
    if (!complete()) {
      // Sticky ready: if we already finished this version, stay green while a
      // background check refreshes the report.
      if (state.readyVersion && (!state.report || state.report.version === state.readyVersion)) {
        let detail = "Everything TRAIN LOG needs is saved on this device, so it works with no signal.";
        if (savingNewVersion()) detail += " Saving a new version: " + percent(state.progress) + "%.";
        return { kind: "ok", label: "Offline ready", detail: detail };
      }
      return {
        kind: "warn",
        label: "Not offline yet",
        detail:
          "TRAIN LOG isn't fully saved on this device yet. Keep it open on Wi-Fi until this says Offline ready.",
      };
    }
    if (appleTouch() && !standalone()) {
      return {
        kind: "warn",
        label: "Add to Home Screen",
        detail:
          "This is Safari's copy. Tap Share → Add to Home Screen, then open the icon. Use Updates → Get Update (or This device → Repair Install) — don't delete the icon to update.",
      };
    }
    let detail = "Everything TRAIN LOG needs is saved on this device, so it works with no signal.";
    if (savingNewVersion()) detail += " Saving a new version: " + percent(state.progress) + "%.";
    return { kind: "ok", label: "Offline ready", detail: detail };
  }

  function megabytes(bytes) {
    return bytes == null ? "Unknown" : (bytes / 1e6).toFixed(1) + " MB";
  }

  function facts() {
    const r = state.report;
    const rows = [
      ["Opened from", standalone() ? "Home Screen" : "Browser (" + (appleTouch() ? "Safari" : "not the Home Screen") + ")"],
      ["Secure address", window.isSecureContext ? "Yes" : "No"],
      ["Offline copy", r ? r.have + " of " + r.total + " files" : supported() ? "Not saved yet" : "Not possible here"],
      ["Version", r ? r.version : "None"],
      ["Storage kept by the device", state.persisted == null ? "Unknown" : state.persisted ? "Yes" : "Not yet"],
      ["Space used", megabytes(state.usage)],
      ["Connection", navigator.onLine ? "Online" : "No signal"],
    ];
    if (r && r.missing && r.missing.length) rows.push(["Missing", r.missing.slice(0, 6).join(", ") + (r.missing.length > 6 ? "…" : "")]);
    if (state.error) rows.push(["Problem", state.error]);
    return rows;
  }

  function render() {
    const now = status();
    // Skip DOM writes when the pill text hasn't changed (cuts Settings/pad jank).
    const pill = $("offline-status");
    if (pill && (pill.textContent !== now.label || pill.dataset.kind !== now.kind)) {
      pill.textContent = now.label;
      pill.dataset.kind = now.kind;
      pill.title = now.detail;
    } else if (pill) {
      pill.title = now.detail;
    }
    const detail = $("offline-detail");
    if (detail) {
      detail.textContent = now.detail;
      detail.dataset.kind = now.kind;
      const list = $("offline-facts");
      if (list) {
        list.innerHTML = "";
        facts().forEach(function (row) {
          const dt = document.createElement("dt");
          dt.textContent = row[0];
          const dd = document.createElement("dd");
          dd.textContent = row[1];
          list.append(dt, dd);
        });
      }
    }
    if (now.kind === "ok" && state.report && state.report.version) {
      state.readyVersion = String(state.report.version);
      if (localStorage.getItem(READY_KEY) !== state.report.version) {
        localStorage.setItem(READY_KEY, state.report.version);
        if (window.trainLog && window.trainLog.banner && state.lastLabel !== now.label) {
          window.trainLog.banner("TRAIN LOG is ready to use with no signal.", "ok");
        }
      }
    }
    // Clear sticky ready only when a report proves this version is incomplete.
    if (state.report && state.report.version && state.readyVersion === state.report.version && !filesComplete(state.report)) {
      state.readyVersion = "";
    }
    state.lastLabel = now.label;
  }

  async function check(repair) {
    if (state.checking) return;
    state.checking = true;
    try {
      if (supported()) {
        const reg = await window.trainLogWorker;
        const worker = (reg && reg.active) || navigator.serviceWorker.controller;
        if (worker) {
          state.report = await ask(worker, repair ? "offline-repair" : "offline-check", repair ? 300000 : 12000);
        }
        state.error = "";
      }
    } catch (err) {
      state.error = (err && err.message) || String(err);
    }
    if (navigator.storage) {
      try {
        if (navigator.storage.persisted) state.persisted = await navigator.storage.persisted();
        if (!state.persisted && standalone() && navigator.storage.persist) state.persisted = await navigator.storage.persist();
        if (navigator.storage.estimate) state.usage = (await navigator.storage.estimate()).usage;
      } catch (err) {
        state.persisted = null;
      }
    }
    state.checking = false;
    render();
    const installing = state.progress && state.progress.done < state.progress.total;
    if (!repair && !state.repaired && !installing && state.report && state.report.have < state.report.total && navigator.onLine) {
      state.repaired = true;
      check(true);
    }
  }

  let checkTimer = 0;
  function scheduleCheck(delay) {
    clearTimeout(checkTimer);
    checkTimer = setTimeout(function () {
      check();
    }, delay || 400);
  }

  function build() {
    try {
      state.readyVersion = localStorage.getItem(READY_KEY) || "";
    } catch (err) {
      state.readyVersion = "";
    }
    const title = document.querySelector(".masthead .brand h1");
    if (title && !$("offline-status")) {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.id = "offline-status";
      pill.className = "offline-pill";
      pill.addEventListener("click", function () {
        location.hash = "debug";
        setTimeout(function () {
          const panel = $("debug-offline");
          if (panel) panel.scrollIntoView({ block: "start", behavior: "smooth" });
        }, 150);
      });
      title.insertAdjacentElement("afterend", pill);
    }
    const grid = document.querySelector("#view-debug .debug-grid");
    if (grid && !$("debug-offline")) {
      const panel = document.createElement("section");
      panel.className = "dash-panel debug-offline";
      panel.id = "debug-offline";
      panel.innerHTML =
        '<div class="dash-panel-head"><h3>Offline</h3><button type="button" class="btn ghost" id="offline-check">Check Again</button></div>' +
        '<p id="offline-detail" class="offline-detail"></p><dl id="offline-facts" class="debug-summary"></dl>';
      grid.insertBefore(panel, grid.firstChild);
      $("offline-check").addEventListener("click", function () {
        state.repaired = true;
        check(true);
      });
    }
    render();
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", function (event) {
      const data = event.data || {};
      if (data.type !== "offline-progress") return;
      state.progress = data.finished ? null : data;
      render();
      if (data.finished) scheduleCheck(800);
    });
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      scheduleCheck(700);
    });
  }
  window.addEventListener("online", function () {
    scheduleCheck(300);
  });
  window.addEventListener("offline", render);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") scheduleCheck(600);
  });

  window.trainLogOffline = {
    check: check,
    version: function () {
      if (state.report && state.report.version) return String(state.report.version);
      if (state.progress && state.progress.version) return String(state.progress.version);
      return localStorage.getItem(READY_KEY) || "";
    },
    summary: function () {
      const now = status();
      const out = { status: now.label };
      facts().forEach(function (row) {
        out[row[0]] = row[1];
      });
      return out;
    },
  };

  build();
  check();
})();
