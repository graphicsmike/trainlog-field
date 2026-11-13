/* Offline durability: disk pressure, integrity, snapshots, day sheet, privacy lock, cold-start. */
(function () {
  "use strict";

  const $ = function (id) {
    return document.getElementById(id);
  };

  async function call(path, options) {
    try {
      const response = await fetch(path, options || {});
      let data = {};
      try {
        data = await response.json();
      } catch (err) {
        data = {};
      }
      return { status: response.status, ok: response.ok, data: data };
    } catch (err) {
      return { status: 0, ok: false, data: {} };
    }
  }

  function jsonBody(method, body) {
    return {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    };
  }

  function banner(text, kind) {
    if (window.trainLog && typeof window.trainLog.banner === "function") {
      window.trainLog.banner(text, kind);
      return;
    }
    const el = $("banner");
    if (!el) return;
    if (!text) {
      el.hidden = true;
      el.replaceChildren();
      el.className = "banner";
      return;
    }
    el.hidden = false;
    el.className = "banner" + (kind ? " is-" + kind : "");
    const msg = document.createElement("span");
    msg.className = "banner-text";
    msg.textContent = text;
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "banner-dismiss";
    dismiss.setAttribute("aria-label", "Dismiss message");
    dismiss.textContent = "×";
    dismiss.addEventListener("click", function () {
      banner("");
    });
    el.replaceChildren(msg, dismiss);
  }

  function formatBytes(n) {
    const bytes = Math.max(0, Number(n) || 0);
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  }

  function todayISO() {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return now.getFullYear() + "-" + m + "-" + d;
  }

  // --- Soft durable strip ---------------------------------------------------

  function ensureStrip() {
    let strip = $("durable-strip");
    if (strip) return strip;
    strip = document.createElement("div");
    strip.id = "durable-strip";
    strip.className = "durable-strip";
    strip.hidden = true;
    strip.setAttribute("role", "status");
    const host = document.querySelector(".masthead") || document.body;
    host.insertAdjacentElement("afterend", strip);
    return strip;
  }

  function showStrip(message, actions) {
    const strip = ensureStrip();
    strip.innerHTML = "";
    const text = document.createElement("p");
    text.className = "durable-strip-text";
    text.textContent = message;
    strip.appendChild(text);
    const tools = document.createElement("div");
    tools.className = "durable-strip-actions";
    (actions || []).forEach(function (action) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn tiny " + (action.primary ? "primary" : "ghost");
      btn.textContent = action.label;
      btn.addEventListener("click", action.onClick);
      tools.appendChild(btn);
    });
    strip.appendChild(tools);
    strip.hidden = !message;
  }

  function hideStrip() {
    const strip = $("durable-strip");
    if (strip) {
      strip.hidden = true;
      strip.innerHTML = "";
    }
  }

  // --- IndexedDB clip size --------------------------------------------------

  function clipStore() {
    return new Promise(function (resolve, reject) {
      const open = indexedDB.open("rr-entry-clip", 1);
      open.onupgradeneeded = function () {
        if (!open.result.objectStoreNames.contains("clips")) open.result.createObjectStore("clips");
      };
      open.onsuccess = function () {
        resolve(open.result);
      };
      open.onerror = function () {
        reject(open.error);
      };
    });
  }

  function measureClips() {
    return clipStore()
      .then(function (db) {
        return new Promise(function (resolve) {
          if (!db.objectStoreNames.contains("clips")) {
            resolve({ bytes: 0, count: 0 });
            return;
          }
          const tx = db.transaction("clips", "readonly");
          const store = tx.objectStore("clips");
          const req = store.openCursor();
          let bytes = 0;
          let count = 0;
          req.onsuccess = function () {
            const cursor = req.result;
            if (!cursor) return;
            const value = cursor.value;
            count += 1;
            if (value && typeof value.size === "number") bytes += value.size;
            else if (value instanceof Blob) bytes += value.size;
            else if (value && value.blob && typeof value.blob.size === "number") bytes += value.blob.size;
            cursor.continue();
          };
          tx.oncomplete = function () {
            resolve({ bytes: bytes, count: count });
          };
          tx.onerror = function () {
            resolve({ bytes: 0, count: 0 });
          };
        });
      })
      .catch(function () {
        return { bytes: 0, count: 0 };
      });
  }

  function clearClips() {
    return clipStore()
      .then(function (db) {
        return new Promise(function (resolve) {
          const tx = db.transaction("clips", "readwrite");
          tx.objectStore("clips").clear();
          tx.oncomplete = function () {
            resolve(true);
          };
          tx.onerror = function () {
            resolve(false);
          };
        });
      })
      .catch(function () {
        return false;
      });
  }

  // --- Disk / media pressure ------------------------------------------------

  async function checkDiskPressure() {
    const clips = await measureClips();
    const res = await call("/api/storage");
    if (!res.ok) return;
    const data = res.data || {};
    const parts = data.parts || {};
    const serverBytes = Number(data.total_bytes) || 0;
    const total = serverBytes + clips.bytes;
    const limit = Number(data.soft_limit_bytes) || 500 * 1024 * 1024;
    const settings = data.settings || {};
    const dismissedAt = Number(settings.disk_banner_dismissed_bytes) || 0;
    // Re-show if usage grew ~100 MB past last dismiss.
    if (total < limit) return;
    if (dismissedAt && total < dismissedAt + 100 * 1024 * 1024) return;

    const bits = [];
    if (clips.bytes) bits.push("Record clips " + formatBytes(clips.bytes));
    if (parts.snapshots) bits.push("snapshots " + formatBytes(parts.snapshots));
    if (parts.watch) bits.push("watch folder " + formatBytes(parts.watch));
    if (parts.database) bits.push("database " + formatBytes(parts.database));
    const detail = bits.length ? bits.join(" · ") : formatBytes(total);
    showStrip("Storage pressure — " + detail + ". Clear old clips or open the watch folder?", [
      {
        label: "Clear clips",
        primary: true,
        onClick: async function () {
          const ok = window.askConfirm
            ? await window.askConfirm({
                title: "Clear Record Clips?",
                message: "Deletes held Record clips on this device only. Sightings in the log stay.",
                ok: "Clear clips",
              })
            : window.confirm("Clear held Record clips?");
          if (!ok) return;
          await clearClips();
          hideStrip();
          banner("Record clips cleared.", "ok");
          checkDiskPressure();
        },
      },
      {
        label: "Dismiss",
        onClick: async function () {
          await call("/api/storage/dismiss", jsonBody("POST", { bytes: total }));
          hideStrip();
        },
      },
    ]);
  }

  // --- Integrity + cold-start ----------------------------------------------

  async function checkIntegrity() {
    const res = await call("/api/integrity");
    if (!res.ok) return;
    const notes = (res.data && res.data.notes) || [];
    const clips = await measureClips();
    const all = notes.slice();
    if (clips.count) {
      all.push({
        kind: "clips",
        text: "A held Record clip is still on this device (" + formatBytes(clips.bytes) + "). It is not in the log until you save that train.",
      });
    }
    if (!all.length) return;

    // Soft one-line for migrate/cold; keep trip issues visible.
    const cold = all.filter(function (n) {
      return n.kind === "cold";
    });
    const trips = all.filter(function (n) {
      return n.kind === "trip";
    });
    const migrate = all.filter(function (n) {
      return n.kind === "migrate";
    });
    const clipsNote = all.filter(function (n) {
      return n.kind === "clips";
    });

    if (cold.length) {
      banner(cold[0].text, "error");
    } else if (trips.length) {
      banner(trips[0].text + (trips.length > 1 ? " (+" + (trips.length - 1) + " more — see Review)" : ""), "error");
    } else if (migrate.length) {
      banner(migrate[0].text, "ok");
    } else if (clipsNote.length && !document.querySelector(".entry-clip:not([hidden])")) {
      // Orphaned hold with no visible clip UI.
      showStrip(clipsNote[0].text, [
        {
          label: "Clear clip",
          primary: true,
          onClick: async function () {
            await clearClips();
            hideStrip();
            banner("Held clip cleared.", "ok");
          },
        },
        { label: "Keep", onClick: hideStrip },
      ]);
    }

    const box = $("integrity-notes");
    if (box) {
      box.hidden = !all.length;
      box.innerHTML =
        "<h3 class=\"review-block-title\">Integrity</h3>" +
        "<ul class=\"integrity-list\">" +
        all
          .map(function (n) {
            return "<li>" + escapeHtml(n.text || "") + "</li>";
          })
          .join("") +
        "</ul>";
    }
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // --- Scheduled snapshots (Backup card + nag) ------------------------------

  function paintSnapshots(status) {
    const list = $("backup-snapshot-list");
    const keep = $("backup-snapshot-keep");
    const auto = $("backup-snapshot-auto");
    const nag = $("backup-snapshot-nag");
    if (!list) return;
    const snaps = (status && status.snapshots) || [];
    const settings = (status && status.settings) || {};
    list.innerHTML = "";
    if (!snaps.length) {
      list.innerHTML = '<p class="muted">No local snapshots yet.</p>';
    } else {
      snaps.forEach(function (snap) {
        const row = document.createElement("div");
        row.className = "backup-snap-row";
        const label = document.createElement("span");
        label.textContent = (snap.saved || snap.name) + " · " + formatBytes(snap.bytes || 0);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn tiny ghost";
        button.textContent = "Restore";
        button.dataset.snapshot = snap.name;
        row.appendChild(label);
        row.appendChild(button);
        list.appendChild(row);
      });
    }
    if (keep) keep.value = String((status && status.keep) || settings.snapshot_keep || 5);
    if (auto) auto.checked = status ? Boolean(status.auto) : settings.snapshot_auto !== false;
    if (nag) {
      const stale = Boolean(status && status.stale);
      nag.hidden = !stale;
      nag.textContent = stale
        ? "No fresh snapshot in the last day. Take one now, or leave Auto on."
        : "";
    }
  }

  async function refreshSnapshots() {
    const res = await call("/api/log-snapshots");
    if (!res.ok) return null;
    paintSnapshots(res.data);
    return res.data;
  }

  async function takeSnapshot(quiet) {
    const res = await call("/api/log-snapshots", { method: "POST" });
    if (!res.ok) {
      if (!quiet) banner((res.data && res.data.error) || "Could not save a snapshot.", "error");
      return;
    }
    paintSnapshots(res.data);
    if (!quiet) banner(res.data.name ? "Snapshot saved: " + res.data.name : "Snapshot saved.", "ok");
  }

  function wireSnapshots() {
    const list = $("backup-snapshot-list");
    if (list) {
      list.addEventListener("click", async function (event) {
        const button = event.target.closest("[data-snapshot]");
        if (!button) return;
        const ok = window.askConfirm
          ? await window.askConfirm({
              title: "Restore this snapshot?",
              message: "Trains in that copy are added back. Ones already in the log stay as they are.",
              ok: "Restore",
            })
          : window.confirm("Restore this snapshot?");
        if (!ok) return;
        const res = await call("/api/log-snapshots/restore", jsonBody("POST", { name: button.dataset.snapshot }));
        if (!res.ok) {
          banner((res.data && res.data.error) || "Could not restore that snapshot.", "error");
          return;
        }
        banner("Restored " + ((res.data && res.data.created) || 0) + " trains from the snapshot.", "ok");
        if (window.trainLog && window.trainLog.refreshLists) window.trainLog.refreshLists();
        refreshSnapshots();
      });
    }
    const now = $("backup-snapshot-now");
    if (now) now.addEventListener("click", function () {
      takeSnapshot(false);
    });
    const keep = $("backup-snapshot-keep");
    const auto = $("backup-snapshot-auto");
    async function saveSettings() {
      const payload = {};
      if (keep) payload.snapshot_keep = Number(keep.value) || 5;
      if (auto) payload.snapshot_auto = !!auto.checked;
      const res = await call("/api/log-snapshots/settings", jsonBody("PUT", payload));
      if (res.ok) paintSnapshots(res.data);
    }
    if (keep) keep.addEventListener("change", saveSettings);
    if (auto) auto.addEventListener("change", saveSettings);
  }

  async function nagSnapshots() {
    if (window.trainLogField) return;
    const status = await refreshSnapshots();
    if (!status || !status.stale || !status.auto) return;
    // Don't fight an existing disk strip.
    const strip = $("durable-strip");
    if (strip && !strip.hidden) return;
    showStrip("Local log snapshot is more than a day old.", [
      {
        label: "Snapshot now",
        primary: true,
        onClick: async function () {
          hideStrip();
          await takeSnapshot(false);
        },
      },
      { label: "Later", onClick: hideStrip },
    ]);
  }

  // --- Day sheet (print / PDF) ----------------------------------------------

  function logDateFilters() {
    const form = document.querySelector("#view-log form.filters") || document.querySelector("form.filters");
    const from = form && form.querySelector('[name="date_from"]');
    const to = form && form.querySelector('[name="date_to"]');
    const date = form && form.querySelector('[name="date"]');
    return {
      date_from: (from && from.value) || "",
      date_to: (to && to.value) || "",
      date: (date && date.value) || "",
    };
  }

  async function fetchDayEntries() {
    const filters = logDateFilters();
    const params = new URLSearchParams();
    if (filters.date) params.set("date", filters.date);
    else {
      const day = filters.date_from || filters.date_to || todayISO();
      params.set("date", day);
    }
    const res = await call("/api/entries?" + params.toString());
    if (!res.ok) return { day: params.get("date"), entries: [] };
    const rows = Array.isArray(res.data) ? res.data : (res.data && res.data.entries) || [];
    return { day: params.get("date"), entries: rows };
  }

  function daySheetHtml(day, entries) {
    const rows = entries
      .slice()
      .sort(function (a, b) {
        return String(a.time || "").localeCompare(String(b.time || ""));
      })
      .map(function (e, i) {
        return (
          "<tr><td>" +
          (i + 1) +
          "</td><td>" +
          escapeHtml(e.time || "") +
          "</td><td>" +
          escapeHtml(e.railroad || "") +
          "</td><td>" +
          escapeHtml(e.lead_locomotive || "") +
          "</td><td>" +
          escapeHtml(e.train_symbol || e.train_number || "") +
          "</td><td>" +
          escapeHtml(e.direction || "") +
          "</td><td>" +
          escapeHtml(e.location_spot || "") +
          "</td><td>" +
          escapeHtml(e.location_subdivision || "") +
          "</td><td>" +
          escapeHtml(e.notes || "") +
          "</td></tr>"
        );
      })
      .join("");
    return (
      "<!doctype html><html><head><meta charset='utf-8'><title>Day sheet " +
      escapeHtml(day) +
      "</title><style>" +
      "body{font:12px/1.35 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#111;margin:24px}" +
      "h1{font-size:18px;margin:0 0 4px}p{margin:0 0 14px;color:#444}" +
      "table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ccc;padding:5px 6px;text-align:left;vertical-align:top}" +
      "th{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#555}" +
      "@media print{body{margin:12px}button{display:none}}" +
      "</style></head><body>" +
      "<button onclick='window.print()' style='margin:0 0 12px;padding:6px 12px'>Print / Save PDF</button>" +
      "<h1>TRAIN LOG · " +
      escapeHtml(day) +
      "</h1><p>" +
      entries.length +
      " sighting" +
      (entries.length === 1 ? "" : "s") +
      " · café debrief sheet</p>" +
      "<table><thead><tr><th>#</th><th>Time</th><th>RR</th><th>Lead</th><th>Symbol</th><th>Dir</th><th>Location</th><th>Sub</th><th>Notes</th></tr></thead><tbody>" +
      (rows || "<tr><td colspan='9'>No trains on this date.</td></tr>") +
      "</tbody></table></body></html>"
    );
  }

  async function openDaySheet() {
    const pack = await fetchDayEntries();
    const html = daySheetHtml(pack.day, pack.entries);
    const win = window.open("", "_blank");
    if (!win) {
      banner("Allow pop-ups to open the day sheet.", "error");
      return;
    }
    win.document.write(html);
    win.document.close();
  }

  // --- Privacy lock ---------------------------------------------------------

  const LOCK_KEY = "rr-pad-lock";
  const LOCK_ON_KEY = "rr-pad-lock-on";

  function sha256(text) {
    const data = new TextEncoder().encode(String(text || ""));
    return crypto.subtle.digest("SHA-256", data).then(function (buf) {
      return Array.prototype.map
        .call(new Uint8Array(buf), function (b) {
          return b.toString(16).padStart(2, "0");
        })
        .join("");
    });
  }

  function lockEnabled() {
    try {
      return localStorage.getItem(LOCK_ON_KEY) === "1" && Boolean(localStorage.getItem(LOCK_KEY));
    } catch (e) {
      return false;
    }
  }

  function ensureLockGate() {
    let gate = $("pad-lock-gate");
    if (gate) return gate;
    gate = document.createElement("div");
    gate.id = "pad-lock-gate";
    gate.className = "pad-lock-gate";
    gate.hidden = true;
    gate.innerHTML =
      '<form class="pad-lock-card" id="pad-lock-form">' +
      "<h2>Pad locked</h2>" +
      '<p class="muted">Enter the pad PIN to use TRAIN LOG on this device.</p>' +
      '<label>PIN <input type="password" id="pad-lock-pin" inputmode="numeric" autocomplete="current-password" maxlength="32" /></label>' +
      '<p class="pad-lock-err" id="pad-lock-err" hidden></p>' +
      '<button type="submit" class="btn primary">Unlock</button>' +
      "</form>";
    document.body.appendChild(gate);
    $("pad-lock-form").addEventListener("submit", async function (event) {
      event.preventDefault();
      const pin = ($("pad-lock-pin") && $("pad-lock-pin").value) || "";
      const err = $("pad-lock-err");
      try {
        const hash = await sha256(pin);
        if (hash !== localStorage.getItem(LOCK_KEY)) {
          if (err) {
            err.hidden = false;
            err.textContent = "That PIN does not match.";
          }
          return;
        }
        sessionStorage.setItem("rr-pad-unlocked", "1");
        gate.hidden = true;
        document.documentElement.classList.remove("is-pad-locked");
        if ($("pad-lock-pin")) $("pad-lock-pin").value = "";
        if (err) err.hidden = true;
      } catch (e) {
        if (err) {
          err.hidden = false;
          err.textContent = "Could not check the PIN on this device.";
        }
      }
    });
    return gate;
  }

  function applyLockGate() {
    if (!lockEnabled()) {
      document.documentElement.classList.remove("is-pad-locked");
      const gate = $("pad-lock-gate");
      if (gate) gate.hidden = true;
      return;
    }
    if (sessionStorage.getItem("rr-pad-unlocked") === "1") return;
    document.documentElement.classList.add("is-pad-locked");
    const gate = ensureLockGate();
    gate.hidden = false;
    setTimeout(function () {
      const pin = $("pad-lock-pin");
      if (pin) pin.focus();
    }, 50);
  }

  function paintLockAppearance() {
    const on = $("appearance-pad-lock");
    const wrap = $("appearance-pad-lock-opts");
    if (on) on.checked = lockEnabled();
    if (wrap) wrap.hidden = !lockEnabled();
  }

  function wireLockAppearance() {
    const on = $("appearance-pad-lock");
    const wrap = $("appearance-pad-lock-opts");
    const setBtn = $("appearance-pad-lock-set");
    const clearBtn = $("appearance-pad-lock-clear");
    const pinEl = $("appearance-pad-lock-pin");
    if (!on) return;

    on.addEventListener("change", async function () {
      if (on.checked) {
        if (!localStorage.getItem(LOCK_KEY)) {
          if (wrap) wrap.hidden = false;
          banner("Set a PIN below to turn the pad lock on.", "error");
          on.checked = false;
          return;
        }
        localStorage.setItem(LOCK_ON_KEY, "1");
        sessionStorage.removeItem("rr-pad-unlocked");
        if (wrap) wrap.hidden = false;
        applyLockGate();
      } else {
        localStorage.setItem(LOCK_ON_KEY, "0");
        sessionStorage.setItem("rr-pad-unlocked", "1");
        if (wrap) wrap.hidden = true;
        applyLockGate();
      }
    });

    if (setBtn && pinEl) {
      setBtn.addEventListener("click", async function () {
        const pin = String(pinEl.value || "").trim();
        if (pin.length < 4) {
          banner("Use at least 4 characters for the pad PIN.", "error");
          return;
        }
        const hash = await sha256(pin);
        localStorage.setItem(LOCK_KEY, hash);
        localStorage.setItem(LOCK_ON_KEY, "1");
        on.checked = true;
        if (wrap) wrap.hidden = false;
        pinEl.value = "";
        sessionStorage.removeItem("rr-pad-unlocked");
        banner("Pad lock PIN saved. It will ask next time you open TRAIN LOG.", "ok");
        applyLockGate();
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener("click", async function () {
        const ok = window.askConfirm
          ? await window.askConfirm({
              title: "Remove Pad Lock?",
              message: "The PIN is cleared on this device. Anyone using this Mac can open the pad.",
              ok: "Remove lock",
            })
          : window.confirm("Remove pad lock?");
        if (!ok) return;
        localStorage.removeItem(LOCK_KEY);
        localStorage.setItem(LOCK_ON_KEY, "0");
        sessionStorage.setItem("rr-pad-unlocked", "1");
        on.checked = false;
        if (wrap) wrap.hidden = true;
        if (pinEl) pinEl.value = "";
        applyLockGate();
        banner("Pad lock removed.", "ok");
      });
    }

    const appearanceBtn = $("btn-appearance");
    if (appearanceBtn) {
      appearanceBtn.addEventListener("click", function () {
        paintLockAppearance();
      });
    }
  }

  // --- Timezone / clock skew (phone Sync hello) -----------------------------

  async function checkClockSkew() {
    if (!window.trainLogField) return;
    const res = await call("/sync/hello");
    if (!res.ok || !res.data || !res.data.server_epoch) return;
    const skew = Math.abs(Date.now() / 1000 - Number(res.data.server_epoch));
    if (skew < 180) return; // under 3 minutes is fine
    const mins = Math.round(skew / 60);
    banner(
      "This device's clock is about " +
        mins +
        " min off from the Mac. Time zones and overnight trips can look wrong until the clocks match.",
      "error"
    );
  }

  // --- Boot -----------------------------------------------------------------

  function wireDaySheet() {
    const btn = $("btn-day-sheet");
    if (btn) btn.addEventListener("click", openDaySheet);
  }

  function boot() {
    applyLockGate();
    wireLockAppearance();
    wireSnapshots();
    wireDaySheet();
    checkDiskPressure();
    checkIntegrity();
    nagSnapshots();
    checkClockSkew();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.trainLogDurability = {
    refreshSnapshots: refreshSnapshots,
    takeSnapshot: takeSnapshot,
    checkDisk: checkDiskPressure,
    openDaySheet: openDaySheet,
  };
})();
