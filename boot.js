(function () {
  "use strict";

  const base = new URL(".", document.currentScript ? document.currentScript.src : location.href).href;
  const realFetch = window.fetch.bind(window);
  document.documentElement.classList.add("is-field");
  window.trainLogField = true;
  document.documentElement.classList.remove("app-shell");

  const params = new URLSearchParams(location.search);
  const repairWanted = params.get("repair") === "1" || params.get("reinstall") === "1";
  const justRepaired = params.get("repaired") === "1";
  if (justRepaired) {
    params.delete("repaired");
    const clean = location.pathname + (params.toString() ? "?" + params.toString() : "") + location.hash;
    history.replaceState({}, "", clean || location.pathname);
  }

  const overlay = document.createElement("div");
  overlay.id = "field-boot";
  overlay.innerHTML =
    '<div class="field-boot-card"><img src="' +
    base +
    'static/icon.png" alt="" width="64" height="64" /><h1>TRAIN LOG</h1><p id="field-boot-note">Starting…</p></div>';
  function note(text) {
    const el = document.getElementById("field-boot-note");
    if (el) el.textContent = text;
  }
  function showOverlay() {
    if (!overlay.isConnected && document.body) document.body.appendChild(overlay);
  }
  if (document.body) showOverlay();
  else document.addEventListener("DOMContentLoaded", showOverlay);

  // Open https://Mac:5443/?repair=1 on Wi‑Fi with Phone Sync on to clear a stuck offline
  // install without wiping sightings (IndexedDB) or the pairing token.
  async function runRepairRedirect() {
    note("Repairing install from the Mac…");
    showOverlay();
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (let i = 0; i < regs.length; i++) await regs[i].unregister();
      }
      if (window.caches && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map(function (key) { return caches.delete(key); }));
      }
    } catch (err) {
      note("Repair hit a snag — trying a fresh load anyway…");
    }
    const next = new URL(location.href);
    next.searchParams.delete("repair");
    next.searchParams.delete("reinstall");
    next.searchParams.set("repaired", "1");
    location.replace(next.toString());
  }
  if (repairWanted) {
    runRepairRedirect();
    return;
  }

  let py = null;
  let handle = null;
  let saving = Promise.resolve();

  function syncfs(populate) {
    return new Promise(function (resolve, reject) {
      py.FS.syncfs(populate, function (err) {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  function persist() {
    saving = saving.then(function () {
      return syncfs(false);
    }).catch(function (err) {
      console.error("Could not save to this device", err);
      throw err;
    });
    return saving;
  }

  async function start() {
    note("Loading Python…");
    py = await window.loadPyodide({ indexURL: base + "pyodide/" });
    py.FS.mkdirTree("/data");
    py.FS.mount(py.FS.filesystems.IDBFS, {}, "/data");
    note("Opening your log…");
    await syncfs(true);
    py.FS.mkdirTree("/data/support");
    note("Loading the station book…");
    const zip = await realFetch(base + "app.zip").then(function (r) {
      if (!r.ok) throw new Error("app.zip " + r.status);
      return r.arrayBuffer();
    });
    py.unpackArchive(zip, "zip", { extractDir: "/app" });
    const serverSource = await realFetch(base + "server.py").then(function (r) {
      return r.text();
    });
    py.runPython(serverSource);
    handle = py.globals.get("handle");
    await persist();
    overlay.remove();
    // Start the offline fill only after the pad is up so it does not fight Pyodide
    // for Wi‑Fi (that race stalled loads right after Add to Home Screen on Intel Macs).
    function askOfflineFill() {
      const msg = { type: "offline-fill" };
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(msg);
        return;
      }
      if (!navigator.serviceWorker.ready) return;
      navigator.serviceWorker.ready.then(function (reg) {
        if (reg.active) reg.active.postMessage(msg);
      });
    }
    askOfflineFill();
  }

  const ready = start().catch(function (err) {
    console.error(err);
    note("TRAIN LOG could not start: " + (err && err.message ? err.message : err));
    throw err;
  });

  function isApi(url) {
    // Absolute /api/… is intentional: Pyodide handles it even when the field app
    // lives in a subdirectory (GitHub Pages /trainlog-field/).
    return url.origin === location.origin && url.pathname.indexOf("/api/") === 0;
  }

  // Host-root /static/… 404s on Pages; map those requests into this app folder.
  function rewriteStatic(request) {
    const url = new URL(request.url);
    if (url.origin !== location.origin || url.pathname.indexOf("/static/") !== 0) return request;
    const fixed = new URL(url.pathname.slice(1) + url.search, base);
    return new Request(fixed.href, request);
  }

  window.trainLogStaticUrl = function (path) {
    const rel = String(path || "").replace(/^\/+/, "");
    return new URL(rel, base).href;
  };

  window.fetch = async function (input, init) {
    let request = rewriteStatic(new Request(input, init));
    const url = new URL(request.url);
    if (!isApi(url)) return realFetch(request);
    await ready;
    const method = request.method.toUpperCase();
    const headers = {};
    request.headers.forEach(function (value, key) {
      headers[key] = value;
    });
    const body = method === "GET" || method === "HEAD" ? undefined : new Uint8Array(await request.arrayBuffer());
    let parts;
    try {
      const result = handle(method, url.pathname + url.search, JSON.stringify(headers), body);
      parts = result.toJs();
      result.destroy();
    } catch (err) {
      console.error(err);
      return new Response(JSON.stringify({ success: false, error: String((err && err.message) || err).slice(-400) }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    const status = parts[0];
    const outHeaders = JSON.parse(parts[1]);
    const data = parts[2];
    if (method !== "GET" && method !== "HEAD") {
      try {
        await persist();
      } catch (err) {
        return new Response(
          JSON.stringify({ success: false, error: "Saved in memory, but could not write to this device's storage. Export a backup now." }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }
    const empty = status === 204 || status === 304 || method === "HEAD";
    return new Response(empty ? null : data, { status: status, headers: outHeaders });
  };

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden" && py) persist().catch(function () {});
  });

  function saveSheet(file) {
    const dialog = document.createElement("dialog");
    dialog.className = "field-save";
    dialog.innerHTML =
      '<form method="dialog" class="dialog-card"><h2>File Ready</h2><p class="muted"></p><menu>' +
      '<button value="share" class="btn primary">Share or Save</button><button value="close" class="btn ghost">Close</button></menu></form>';
    dialog.querySelector("p").textContent = file.name;
    document.body.appendChild(dialog);
    dialog.addEventListener("close", function () {
      if (dialog.returnValue === "share") navigator.share({ files: [file] }).catch(function () {});
      dialog.remove();
    });
    dialog.showModal();
  }

  window.trainLogSaveFile = async function (blob, filename) {
    const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return true;
      } catch (err) {
        if (err && err.name === "AbortError") return true;
        saveSheet(file);
        return true;
      }
    }
    return false;
  };

  function reloadWhenSaved() {
    saving.then(function () {
      location.reload();
    }, function () {});
  }

  function showUpdateBar(text) {
    text = text || "A new version of TRAIN LOG is ready.";
    let bar = document.getElementById("field-update");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "field-update";
      bar.setAttribute("role", "status");
      bar.innerHTML = '<span></span><button type="button" class="btn primary">Reload</button>';
      bar.querySelector("button").addEventListener("click", reloadWhenSaved);
      document.body.appendChild(bar);
    }
    bar.querySelector("span").textContent = text;
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", function (event) {
      const data = event.data || {};
      if (data.type === "offline-progress" && data.failed) {
        showUpdateBar("The new version could not be saved. Keep the Mac awake on this Wi-Fi, then reload.");
      }
    });
    const openedAt = Date.now();
    const hadVersion = Boolean(navigator.serviceWorker.controller);
    let registration = null;
    let lastCheck = 0;
    let asked = false;
    // A new build only reloads by itself right after launch, so it never throws away a train being typed.
    // A check you asked for shows the bar instead, so you can reload when the train is saved.
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (!hadVersion) return;
      if (!asked && Date.now() - openedAt < 20000) reloadWhenSaved();
      else showUpdateBar();
    });
    function waitForNewWorker(worker) {
      if (!worker) return Promise.resolve(false);
      if (worker.state === "activated" || worker.state === "installed") return Promise.resolve(true);
      return new Promise(function (resolve) {
        const done = function (ok) {
          worker.removeEventListener("statechange", onChange);
          resolve(ok);
        };
        const onChange = function () {
          if (worker.state === "installed" || worker.state === "activated") done(true);
          else if (worker.state === "redundant") done(false);
        };
        worker.addEventListener("statechange", onChange);
        setTimeout(function () {
          done(Boolean(registration.waiting || registration.installing || (registration.active && asked)));
        }, 45000);
      });
    }

    window.trainLogCheckForUpdate = function (now) {
      // Sync with Mac can run before register() finishes; wait so we don't
      // falsely report "couldn't reach the Mac" when the Mac is fine.
      if (!registration) {
        if (!window.trainLogWorker) return Promise.resolve("unavailable");
        return window.trainLogWorker.then(
          function () {
            return window.trainLogCheckForUpdate(now);
          },
          function () {
            return "unavailable";
          }
        );
      }
      if (!now && Date.now() - lastCheck < 10 * 60 * 1000) return Promise.resolve("skipped");
      if (now) asked = true;
      lastCheck = Date.now();
      if (registration.waiting || registration.installing) {
        showUpdateBar(now ? "A new TRAIN LOG is ready. Reload to open it." : undefined);
        if (registration.waiting) registration.waiting.postMessage({ type: "skip-waiting" });
        return Promise.resolve("ready");
      }
      let found = false;
      const onFound = function () {
        found = true;
        if (now) showUpdateBar("Downloading the new TRAIN LOG from the Mac…");
      };
      registration.addEventListener("updatefound", onFound);
      return registration.update().then(function () {
        registration.removeEventListener("updatefound", onFound);
        const worker = registration.installing || registration.waiting;
        if (!found && !worker) return "current";
        if (now) showUpdateBar("Downloading the new TRAIN LOG from the Mac…");
        return waitForNewWorker(worker).then(function (ok) {
          if (!ok) return "unavailable";
          if (registration.waiting) registration.waiting.postMessage({ type: "skip-waiting" });
          showUpdateBar("A new TRAIN LOG is ready. Reload to open it.");
          return "ready";
        });
      }, function () {
        registration.removeEventListener("updatefound", onFound);
        return "unavailable";
      });
    };

    window.trainLogFieldVersion = function () {
      if (window.trainLogOffline && window.trainLogOffline.version) return window.trainLogOffline.version();
      return "";
    };

    // Drop only the offline file cache / service worker. Pairing, device id, and the
    // sighting log (IDBFS) stay. Use when Get Update stalls after a Mac release.
    window.trainLogRepairFieldInstall = async function () {
      if (!("serviceWorker" in navigator)) {
        return { ok: false, error: "This browser can't repair the offline copy." };
      }
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (let i = 0; i < regs.length; i++) {
          await regs[i].unregister();
        }
        if (window.caches && caches.keys) {
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter(function (key) {
                return key.indexOf("train-log-") === 0;
              })
              .map(function (key) {
                return caches.delete(key);
              })
          );
        }
        registration = null;
        return { ok: true };
      } catch (err) {
        return { ok: false, error: (err && err.message) || String(err) };
      }
    };

    // Updates are manual (Sync → Get Update). Don't probe the Mac on every tab focus.
    window.trainLogWorker = navigator.serviceWorker.register(base + "sw.js").then(function (reg) {
      registration = reg;
      return reg;
    });
    window.trainLogWorker.catch(function (err) {
      console.warn("Offline copy not available", err);
    });
  }

  function liftForKeyboard() {
    const viewport = window.visualViewport;
    if (!viewport) return;
    function place() {
      const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      const open = covered > 80;
      document.documentElement.style.setProperty("--keyboard-inset", open ? covered + "px" : "0px");
      const dialog = document.querySelector("dialog[open]");
      if (!dialog) return;
      if (open) {
        dialog.style.maxHeight = Math.max(180, Math.round(viewport.height - 16)) + "px";
        dialog.style.marginTop = Math.max(8, Math.round(viewport.offsetTop) + 8) + "px";
        dialog.style.height = "auto";
        const active = document.activeElement;
        if (active && dialog.contains(active) && active.scrollIntoView) {
          window.setTimeout(function () {
            active.scrollIntoView({ block: "center", inline: "nearest" });
          }, 50);
        }
      } else {
        dialog.style.maxHeight = "";
        dialog.style.marginTop = "";
        dialog.style.height = "";
      }
    }
    viewport.addEventListener("resize", place);
    viewport.addEventListener("scroll", place);
    document.addEventListener("focusin", function () {
      window.setTimeout(place, 60);
    });
  }
  liftForKeyboard();
})();
