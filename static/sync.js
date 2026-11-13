(function () {
  "use strict";

  const field = Boolean(window.trainLogField);
  const $ = function (id) {
    return document.getElementById(id);
  };
  const SYNC_ORIGIN_KEY = "rr-sync-origin";

  // Field app may be installed from the public git site; /sync/* still talks to the Mac.
  (function captureMacOrigin() {
    try {
      const params = new URLSearchParams(location.search);
      const mac = params.get("mac");
      if (mac && /^https:\/\//i.test(mac)) {
        localStorage.setItem(SYNC_ORIGIN_KEY, mac.replace(/\/$/, ""));
      }
    } catch (err) {}
  })();

  function syncOrigin() {
    if (!field) return "";
    try {
      const saved = localStorage.getItem(SYNC_ORIGIN_KEY);
      if (saved) return saved.replace(/\/$/, "");
    } catch (err) {}
    return location.origin;
  }

  function hasMacSyncOrigin() {
    if (!field) return true;
    try {
      const saved = localStorage.getItem(SYNC_ORIGIN_KEY);
      if (saved && /^https:\/\//i.test(saved)) {
        // Public install site has no /sync/* — need a real Mac / easy-link origin.
        return !/github\.io$/i.test(new URL(saved).hostname);
      }
    } catch (err) {}
    // No mac= saved yet. OK only when this page is already the Mac Field Sync server.
    return !/github\.io$/i.test(location.hostname);
  }

  function rememberMacOrigin(raw) {
    if (!raw || !/^https:\/\//i.test(raw)) return;
    try {
      localStorage.setItem(SYNC_ORIGIN_KEY, String(raw).replace(/\/$/, ""));
    } catch (err) {}
  }

  const NEED_MAC_LINK =
    "This install doesn't know which Mac to sync with. Open Sync with Mac → Scan Mac QR and point at the Link / Pair code on the Mac (Log → Field Sync), or type the 6-digit code after opening that link from the Home Screen app.";

  function syncUrl(path) {
    if (!field || path.indexOf("/sync/") !== 0) return path;
    return syncOrigin() + path;
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  // Transient Wi-Fi drops used to fail the whole Sync with one fetch error.
  // Retry a few times before telling the user the Mac is unreachable.
  async function call(path, options) {
    const attempts = 3;
    let last = { status: 0, ok: false, data: {} };
    for (let tryNo = 1; tryNo <= attempts; tryNo++) {
      try {
        const response = await fetch(syncUrl(path), options || {});
        let data = {};
        try {
          data = await response.json();
        } catch (err) {
          data = {};
        }
        last = { status: response.status, ok: response.ok, data: data };
        // Don't retry auth / validation — only dead air and 5xx.
        if (response.ok || (response.status > 0 && response.status < 500)) return last;
      } catch (err) {
        last = { status: 0, ok: false, data: {} };
      }
      if (tryNo < attempts) await sleep(400 * tryNo);
    }
    return last;
  }

  function jsonBody(method, body, headers) {
    return {
      method: method,
      headers: Object.assign({ "Content-Type": "application/json" }, headers || {}),
      body: JSON.stringify(body || {}),
    };
  }

  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }

  // --- Mac: Log → Phone sync ---------------------------------------------------------------

  let macTimer = null;

  function renderMac(state) {
    const on = Boolean(state.enabled);
    $("phone-sync-on").checked = on;
    const status = $("phone-sync-status");
    status.classList.toggle("is-error", Boolean(state.error));
    const serving = state.app_version ? " Serving TRAIN LOG " + state.app_version + "." : "";
    if (state.error) status.textContent = state.error;
    else if (on && state.running) {
      status.textContent = "On. Phones on your Wi-Fi can reach this Mac at " + state.host + "." + serving;
    } else if (on) status.textContent = "Starting…" + serving;
    else status.textContent = "Off. No phone can reach this Mac." + serving;
    if (on && !state.field_built) {
      status.textContent += " The field app isn't built into this copy of TRAIN LOG yet, so a phone can pair but can't install it.";
    }
    if (on && state.running && !state.last_reached) {
      status.textContent +=
        " If the field device stalls after Add to Home Screen, check System Settings → Privacy & Security → Local Network and allow TRAIN LOG, then Let Field Devices Through Firewall.";
    }
    const wall = state.firewall || {};
    const firewallText = {
      block_all:
        "The Mac firewall is set to block all incoming connections, so no phone can reach TRAIN LOG. Turn that off in System Settings, Network, Firewall, Options.",
      blocked: "The Mac firewall is blocking TRAIN LOG, so your field devices can't reach it.",
      unproven:
        "After a TRAIN LOG update, the Mac firewall often treats the new app as a stranger. Until you let it through, the field devices stay on the old copy and can't update. Tap Let through, then Sync with Mac on the device.",
    }[wall.reason];
    $("phone-sync-firewall").hidden = !(on && state.running && firewallText);
    $("phone-sync-firewall-text").textContent = firewallText || "";
    $("phone-sync-firewall-fix").hidden = wall.reason === "block_all";
    $("phone-sync-reached").hidden = !(on && state.last_reached);
    $("phone-sync-reached").textContent = state.last_reached ? "A phone last reached this Mac " + state.last_reached + "." : "";
    $("phone-sync-setup").hidden = !on;
    const code = String(state.code || "");
    $("phone-sync-code").textContent = code.length === 6 ? code.slice(0, 3) + " " + code.slice(3) : code;
    const cert = $("phone-sync-cert");
    if (cert) cert.textContent = state.cert || "not ready";
    const hostLine = $("phone-sync-host");
    if (hostLine) hostLine.textContent = state.host || (state.addresses && state.addresses[0]) || "…";
    function paintQr(id, svg) {
      const el = $(id);
      if (!el) return;
      const mark = String(svg || "");
      el.hidden = mark.indexOf("<svg") !== 0;
      el.innerHTML = el.hidden ? "" : mark;
    }
    paintQr("phone-sync-qr", state.qr);
    paintQr("phone-sync-setup-qr", state.setup_qr);
    paintQr("phone-sync-app-qr", state.app_qr);
    paintQr("phone-sync-install-qr", state.install_qr);
    const easy = $("phone-sync-easy");
    if (easy) {
      if (state.easy_link) {
        easy.textContent = "Easy link ready — field devices do not need a Mac certificate. " + state.easy_link;
      } else if (state.easy_link_starting) {
        easy.textContent = "Starting easy link… keep this Mac online for about half a minute.";
      } else if (state.easy_link_error) {
        easy.textContent = "Easy link unavailable — " + state.easy_link_error + " Using Wi‑Fi IP; Trust step may be required.";
      } else if (state.enabled) {
        easy.textContent = "Easy link not ready yet…";
      } else {
        easy.textContent = "";
      }
    }
    const trustCard = $("phone-sync-trust-card");
    if (trustCard) trustCard.hidden = !state.needs_certificate;
    if (state.restored && window.trainLog && window.trainLog.banner) window.trainLog.banner(state.restored, "ok");
    for (const [id, url] of [
      ["phone-sync-setup-url", state.setup_url],
      ["phone-sync-app-url", state.app_url],
      ["phone-sync-install-url", state.install_url],
    ]) {
      if (!$(id)) continue;
      $(id).textContent = url || "";
      $(id).href = url || "#";
    }
    const repair = $("phone-sync-repair-url");
    if (repair) {
      const repairUrl = state.repair_url || "#";
      repair.href = repairUrl;
      repair.textContent = repairUrl === "#" ? "Repair Install" : repairUrl;
    }
    const body = $("phone-sync-devices");
    body.innerHTML = "";
    const devices = state.devices || [];
    if (!devices.length) {
      body.innerHTML = '<tr><td colspan="5" class="muted">No devices paired yet.</td></tr>';
    }
    devices.forEach(function (device) {
      const row = document.createElement("tr");
      [device.name, device.paired_at || "", device.last_sync || "Never", String(device.received || 0)].forEach(function (text) {
        const cell = document.createElement("td");
        cell.textContent = text;
        row.appendChild(cell);
      });
      const actions = document.createElement("td");
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn tiny ghost";
      remove.textContent = "Unpair";
      remove.dataset.phoneUnpair = device.id;
      actions.appendChild(remove);
      row.appendChild(actions);
      body.appendChild(row);
    });
  }

  async function refreshMac() {
    const res = await call("/api/phone-sync");
    if (res.ok) renderMac(res.data);
  }

  // Live Field Sync UI retired: field Updates use the public site; sightings move by export/import.
  if (!field && $("btn-phone-sync") && !$("btn-phone-sync").hidden) {
    let firewallNagShown = false;
    function openPhoneSync() {
      $("phone-sync-dialog").showModal();
      clearInterval(macTimer);
      macTimer = setInterval(function () {
        if (!$("phone-sync-dialog").open) return clearInterval(macTimer);
        refreshMac();
      }, 5000);
    }
    $("btn-phone-sync").addEventListener("click", async function () {
      await refreshMac();
      openPhoneSync();
    });
    $("phone-sync-on").addEventListener("change", async function (event) {
      const res = await call("/api/phone-sync", jsonBody("POST", { enabled: event.target.checked }));
      renderMac(res.data && "enabled" in res.data ? res.data : { enabled: false, error: "Could not change Phone sync." });
    });
    $("phone-sync-firewall-fix").addEventListener("click", async function () {
      const button = $("phone-sync-firewall-fix");
      button.disabled = true;
      $("phone-sync-firewall-text").textContent = "Waiting for your Mac password…";
      const res = await call("/api/phone-sync/firewall", { method: "POST" });
      button.disabled = false;
      if (res.data && "enabled" in res.data) renderMac(res.data);
      const status = $("phone-sync-status");
      if (res.ok) {
        status.classList.remove("is-error");
        status.textContent = "Done. The Mac firewall now lets your field devices reach TRAIN LOG. Tap Sync with Mac on the field device.";
      } else {
        status.classList.add("is-error");
        status.textContent = (res.data && res.data.error) || "Could not change the firewall.";
      }
    });
    if ($("phone-sync-reveal-cert")) {
      $("phone-sync-reveal-cert").addEventListener("click", async function () {
        const res = await call("/api/phone-sync/reveal-certificate", { method: "POST" });
        if (!res.ok) {
          if (window.trainLog && window.trainLog.banner) {
            window.trainLog.banner((res.data && res.data.error) || "Could not show the certificate.", "error");
          }
          return;
        }
        if (window.trainLog && window.trainLog.banner) {
          window.trainLog.banner("Certificate shown in Finder — AirDrop it to the field device, Install the profile, then turn on full trust.", "ok");
        }
      });
    }
        $("phone-sync-new-code").addEventListener("click", async function () {
      const res = await call("/api/phone-sync/code", { method: "POST" });
      if (res.ok) renderMac(res.data);
    });
    setTimeout(async function () {
      const res = await call("/api/phone-sync");
      const state = res.data || {};
      const wall = state.firewall || {};
      if (!res.ok || !state.enabled || !wall.blocking) return;
      if (wall.reason === "unproven" && !(state.devices || []).length && !state.last_reached) return;
      if (window.trainLog && window.trainLog.banner) {
        window.trainLog.banner("The Mac firewall may be keeping your field devices out of TRAIN LOG. Open Log, then Field Sync, to let it through.", "error");
      }
      // After an update the new Mac build is often blocked; open Field Sync once so Let through is one click away.
      if (!firewallNagShown && ((state.devices || []).length || state.last_reached)) {
        firewallNagShown = true;
        openPhoneSync();
      }
    }, 4000);
    $("phone-sync-devices").addEventListener("click", async function (event) {
      const btn = event.target.closest("[data-phone-unpair]");
      if (!btn) return;
      const res = await call("/api/phone-sync/devices/" + encodeURIComponent(btn.dataset.phoneUnpair), { method: "DELETE" });
      if (res.ok) renderMac(res.data);
    });
  }

  // --- Field device: stand-alone install (Updates from Pages; sightings via export/import) ---

  if (!field) return;

  document.querySelectorAll("[data-mac-only]").forEach(function (el) {
    el.hidden = true;
  });
  if ($("btn-sync-mac")) $("btn-sync-mac").hidden = false;
  if ($("btn-add-home")) $("btn-add-home").hidden = false;
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});

  const FIELD_SITE = "https://graphicsmike.github.io/trainlog-field/";

  function result(text, isError) {
    const el = $("sync-mac-result");
    if (!el) return;
    el.textContent = "";
    el.classList.toggle("is-error", Boolean(isError));
    if (!text) return;
    const msg = document.createElement("span");
    msg.className = "sync-mac-result-text";
    msg.textContent = text;
    el.appendChild(msg);
  }

  function localFieldVersion() {
    try {
      const kicker = document.querySelector(".masthead .kicker");
      const match = kicker && kicker.textContent && kicker.textContent.match(/(\d+\.\d+\.\d+)/);
      if (match) return match[1];
    } catch (err) {}
    if (window.trainLogOffline && window.trainLogOffline.version) {
      try {
        return String(window.trainLogOffline.version() || "").split("-")[0] || "";
      } catch (err) {}
    }
    return "";
  }

  function versionNewer(remote, local) {
    function parts(v) {
      return String(v || "0")
        .split(/[^\d]+/)
        .filter(Boolean)
        .map(function (n) {
          return parseInt(n, 10) || 0;
        });
    }
    const a = parts(remote);
    const b = parts(local);
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const x = a[i] || 0;
      const y = b[i] || 0;
      if (x > y) return true;
      if (x < y) return false;
    }
    return false;
  }

  function paintVersions(remote) {
    const line = $("sync-mac-versions");
    if (!line) return;
    const local = localFieldVersion() || "…";
    if (!remote) {
      line.textContent = "This device " + local + " · checking the field site…";
      return;
    }
    if (versionNewer(remote, local)) {
      line.textContent = "This device " + local + " · site " + remote + " — tap Get Update.";
    } else {
      line.textContent = "This device " + local + " · matches the field site (" + remote + ").";
    }
  }

  function fieldSiteUrl(path) {
    const base = FIELD_SITE.replace(/\/?$/, "/");
    return base + String(path || "").replace(/^\//, "");
  }

  function startRepairInstall() {
    try {
      const url = new URL(fieldSiteUrl(""));
      url.searchParams.set("repair", "1");
      url.searchParams.set("v", localFieldVersion() || "");
      location.assign(url.toString());
    } catch (err) {
      location.assign(fieldSiteUrl("?repair=1"));
    }
  }

  function fromHomeScreen() {
    return navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  }

  function showAddHome() {
    const dialog = $("add-home-dialog");
    if (!dialog) return;
    const already = $("add-home-already");
    const steps = $("add-home-steps");
    const onHome = fromHomeScreen();
    if (already) already.hidden = !onHome;
    if (steps) steps.hidden = onHome;
    const urlEl = $("add-home-url");
    if (urlEl) urlEl.textContent = location.href;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function wireAddHome(id) {
    const btn = $(id);
    if (!btn) return;
    btn.addEventListener("click", showAddHome);
  }

  async function refreshSnapshots() {
    const box = $("sync-mac-snapshots");
    const list = $("sync-mac-snapshot-list");
    if (!box || !list) return;
    const res = await call("/api/log-snapshots");
    const rows = (res.data && res.data.snapshots) || [];
    box.hidden = !rows.length;
    list.innerHTML = "";
    rows.forEach(function (row) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn ghost";
      btn.dataset.snapshot = row.name;
      btn.textContent = row.label || row.name;
      list.appendChild(btn);
    });
  }

  function queueSnapshot() {
    call("/api/log-snapshots", { method: "POST" }).then(refreshSnapshots);
  }

  async function renderDevice() {
    if ($("sync-mac-pair")) $("sync-mac-pair").hidden = true;
    if ($("sync-mac-ready")) $("sync-mac-ready").hidden = false;
    result("");
    paintVersions("");
    try {
      const res = await fetch(fieldSiteUrl("version.json"), { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        paintVersions((data && data.version) || "");
      } else {
        paintVersions(localFieldVersion());
      }
    } catch (err) {
      paintVersions(localFieldVersion());
    }
    refreshSnapshots();
  }

  $("btn-sync-mac").addEventListener("click", async function () {
    await renderDevice();
    $("sync-mac-dialog").showModal();
  });

  wireAddHome("btn-add-home");
  wireAddHome("sync-mac-add-home");
  if ($("add-home-copy")) {
    $("add-home-copy").addEventListener("click", async function () {
      try {
        await navigator.clipboard.writeText(location.href);
        result("Address copied.");
      } catch (err) {
        result("Could not copy the address.", true);
      }
    });
  }

  function saveExport() {
    if (window.trainLog && window.trainLog.exportLog) {
      window.trainLog.exportLog();
      return;
    }
    // Fallback: JSON download via API
    call("/api/export?format=json").then(async function (res) {
      if (!res.ok) return result("Could not save a copy.", true);
      // call() parses JSON; for export we need raw — use fetch
    });
    fetch("/api/export?format=json")
      .then(function (r) {
        return r.blob().then(function (blob) {
          return { ok: r.ok, blob: blob };
        });
      })
      .then(async function (out) {
        if (!out.ok) return result("Could not save a copy.", true);
        const name = "train-log-" + new Date().toISOString().slice(0, 10) + ".json";
        if (window.trainLogSaveFile && (await window.trainLogSaveFile(out.blob, name))) {
          result("Copy ready to share or save.");
          queueSnapshot();
          return;
        }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(out.blob);
        a.download = name;
        a.click();
        result("Download started.");
        queueSnapshot();
      })
      .catch(function () {
        result("Could not save a copy.", true);
      });
  }

  if ($("sync-mac-save-ready")) $("sync-mac-save-ready").addEventListener("click", saveExport);
  if ($("sync-mac-import")) {
    $("sync-mac-import").addEventListener("click", function () {
      const btn = document.getElementById("btn-import") || document.getElementById("btn-import-2");
      if (btn) btn.click();
      else result("Use Import File from the Log tools.", true);
    });
  }
  if ($("sync-mac-repair")) {
    $("sync-mac-repair").addEventListener("click", function () {
      result("Repairing install from the field site…");
      startRepairInstall();
    });
  }
  if ($("sync-mac-update")) {
    $("sync-mac-update").addEventListener("click", function () {
      if (window.trainLogUpdates && window.trainLogUpdates.open) window.trainLogUpdates.open();
      else startRepairInstall();
    });
  }
  if ($("sync-mac-reload")) {
    $("sync-mac-reload").addEventListener("click", function () {
      if (window.trainLogReloadNewVersion) window.trainLogReloadNewVersion();
      else location.reload();
    });
  }
  if ($("sync-mac-snapshot-list")) {
    $("sync-mac-snapshot-list").addEventListener("click", async function (event) {
      const button = event.target.closest("[data-snapshot]");
      if (!button) return;
      const ok = window.askConfirm
        ? await window.askConfirm({
            title: "Restore this copy?",
            message: "Trains in that copy are added back. Ones already in the log are left as they are.",
          })
        : window.confirm("Restore this copy?");
      if (!ok) return;
      const res = await call("/api/log-snapshots/restore", jsonBody("POST", { name: button.dataset.snapshot }));
      if (!res.ok) return result((res.data && res.data.error) || "Could not restore that copy.", true);
      result("Restored " + ((res.data && res.data.created) || 0) + " trains from the copy on this device.");
      if (window.trainLog && window.trainLog.refreshLists) window.trainLog.refreshLists();
    });
  }

  document.addEventListener("trainlog:entry-saved", queueSnapshot);
  setTimeout(refreshSnapshots, 2500);

  // --- Field Updates from the public field site (no Mac, no key code) ---------------------

  const dataDialog = $("data-dialog");
  const updatesBtn = $("btn-updates");
  if (dataDialog && updatesBtn) {
    const checkBtn = $("data-check");
    const installBtn = $("data-install");
    const appBtn = $("update-app-install");
    const builtInBtn = $("data-built-in");
    const keyBox = $("update-key-box");
    const keyLine = $("update-key-line");
    const badge = $("updates-badge");
    const stationBlock = $("update-station-block");
    const fieldHint = $("update-field-hint");
    let lastLatest = "";

    function appResult(text, notes) {
      const el = $("update-app-result");
      if (el) el.textContent = text || "";
      const notesEl = $("update-app-notes");
      if (notesEl) {
        notesEl.textContent = notes || "";
        notesEl.hidden = !notes;
      }
    }

    async function latestSiteVersion() {
      const res = await fetch(fieldSiteUrl("version.json"), { cache: "no-store" });
      if (!res.ok) throw new Error("Could not reach the field site (" + res.status + ").");
      const data = await res.json();
      return String((data && data.version) || "");
    }

    function openFieldUpdates() {
      if (stationBlock) stationBlock.hidden = true;
      if (fieldHint) fieldHint.hidden = false;
      if (keyBox) keyBox.hidden = true;
      if (keyLine) keyLine.hidden = true;
      if (installBtn) installBtn.hidden = true;
      if (builtInBtn) builtInBtn.hidden = true;
      if (appBtn) {
        appBtn.hidden = true;
        appBtn.textContent = "Get Update";
      }
      const local = localFieldVersion() || "…";
      if ($("update-app-current")) {
        $("update-app-current").textContent = "This device has TRAIN LOG " + local + ".";
      }
      appResult("");
      if (!dataDialog.open) dataDialog.showModal();
      checkFieldUpdates();
    }

    async function checkFieldUpdates() {
      if (checkBtn) checkBtn.disabled = true;
      appResult("Checking the field site…");
      try {
        const found = await latestSiteVersion();
        const local = localFieldVersion();
        lastLatest = found || "";
        paintVersions(found);
        if (!found) {
          appResult("No version stamp on the field site yet.");
          if (appBtn) appBtn.hidden = true;
        } else if (local && !versionNewer(found, local)) {
          appResult("You have the newest TRAIN LOG (" + local + ").");
          if (appBtn) appBtn.hidden = true;
          if (badge) badge.hidden = true;
        } else {
          appResult(
            "TRAIN LOG " + found + " is on the field site.",
            "Tap Get Update to refresh this Home Screen install. Sightings stay on this device."
          );
          if (appBtn) {
            appBtn.hidden = false;
            appBtn.textContent = "Get Update to " + found;
          }
          if (badge) badge.hidden = false;
        }
      } catch (err) {
        appResult(err.message || "Couldn't check for updates.");
        if (appBtn) appBtn.hidden = true;
      }
      if (checkBtn) checkBtn.disabled = false;
    }

    function runFieldGetUpdate() {
      const url = new URL(fieldSiteUrl(""));
      url.searchParams.set("repair", "1");
      if (lastLatest) url.searchParams.set("v", lastLatest);
      appResult("Refreshing from the field site…");
      location.assign(url.toString());
    }

    updatesBtn.hidden = false;
    window.trainLogUpdates = { open: openFieldUpdates };
    updatesBtn.addEventListener("click", openFieldUpdates);
    if ($("app-update-open")) $("app-update-open").addEventListener("click", openFieldUpdates);
    if (checkBtn) checkBtn.addEventListener("click", checkFieldUpdates);
    if (appBtn) {
      appBtn.addEventListener("click", function () {
        if (appBtn.textContent.indexOf("Reload") === 0) {
          if (window.trainLogReloadNewVersion) window.trainLogReloadNewVersion();
          else location.reload();
          return;
        }
        runFieldGetUpdate();
      });
    }
    setTimeout(async function () {
      try {
        const found = await latestSiteVersion();
        const local = localFieldVersion();
        if (found && local && versionNewer(found, local) && badge) badge.hidden = false;
      } catch (err) {}
    }, 8000);
  }
})();
