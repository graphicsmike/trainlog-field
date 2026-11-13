(function () {
  const MAX = 60;
  const state = { errors: [], requests: [], actions: [], started: new Date().toISOString() };
  const outbox = [];
  const nativeFetch = window.fetch.bind(window);

  function push(list, item) {
    list.push(item);
    if (list.length > MAX) list.shift();
  }

  function view() {
    return (location.hash || "#entry").replace("#", "") || "entry";
  }

  function bump() {
    const badge = document.getElementById("debug-badge");
    if (!badge) return;
    badge.textContent = String(state.errors.length);
    badge.hidden = state.errors.length === 0;
  }

  function noteError(kind, message, extra) {
    const item = Object.assign({ at: new Date().toISOString(), kind: kind, message: String(message || "").slice(0, 2000), view: view() }, extra || {});
    push(state.errors, item);
    outbox.push(item);
    bump();
  }

  window.addEventListener("error", function (event) {
    if (event.target && event.target !== window && event.target.tagName) {
      noteError("resource", "Could not load " + (event.target.src || event.target.href || event.target.tagName));
      return;
    }
    noteError("error", event.message, {
      source: event.filename,
      line: event.lineno,
      col: event.colno,
      stack: event.error && event.error.stack ? String(event.error.stack).slice(0, 4000) : undefined,
    });
  }, true);

  window.addEventListener("unhandledrejection", function (event) {
    const reason = event.reason;
    noteError("promise", (reason && reason.message) || String(reason), {
      stack: reason && reason.stack ? String(reason.stack).slice(0, 4000) : undefined,
    });
  });

  const nativeConsoleError = console.error.bind(console);
  console.error = function () {
    try {
      noteError("console", Array.prototype.map.call(arguments, function (a) {
        return a && a.stack ? a.stack : typeof a === "object" ? JSON.stringify(a) : String(a);
      }).join(" "));
    } catch (e) {}
    return nativeConsoleError.apply(console, arguments);
  };

  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    const method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
    if (url.indexOf("/api/debug/") !== -1) return nativeFetch(input, init);
    const started = Date.now();
    return nativeFetch(input, init).then(
      function (response) {
        if (!response.ok) {
          const entry = { at: new Date().toISOString(), method: method, url: url.slice(0, 300), status: response.status, ms: Date.now() - started, view: view() };
          response.clone().text().then(function (text) {
            entry.body = String(text || "").slice(0, 400);
          }).catch(function () {});
          push(state.requests, entry);
          if (response.status >= 500) noteError("request", method + " " + url + " → " + response.status, { url: url, status: response.status });
        }
        return response;
      },
      function (err) {
        push(state.requests, { at: new Date().toISOString(), method: method, url: url.slice(0, 300), status: 0, error: String(err && err.message), view: view() });
        noteError("network", method + " " + url + " failed: " + (err && err.message), { url: url, status: 0 });
        throw err;
      }
    );
  };

  function label(el) {
    const text = (el.getAttribute("aria-label") || el.textContent || el.value || "").replace(/\s+/g, " ").trim().slice(0, 50);
    return (el.id ? "#" + el.id + " " : "") + (text ? "“" + text + "”" : el.tagName.toLowerCase());
  }

  document.addEventListener("click", function (event) {
    const el = event.target.closest && event.target.closest("button, a, .chip, .tab, [role='menuitem']");
    if (!el) return;
    push(state.actions, { at: new Date().toISOString(), action: "click", target: label(el), view: view() });
  }, true);

  document.addEventListener("change", function (event) {
    const el = event.target;
    if (!el || el.tagName !== "SELECT") return;
    push(state.actions, { at: new Date().toISOString(), action: "choose", target: label(el).split("“")[0].trim() || el.tagName.toLowerCase(), value: String(el.value).slice(0, 60), view: view() });
  }, true);

  window.addEventListener("hashchange", function () {
    push(state.actions, { at: new Date().toISOString(), action: "view", target: view(), view: view() });
  });

  setInterval(function () {
    if (!outbox.length) return;
    const batch = outbox.splice(0, 20);
    nativeFetch("/api/debug/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ errors: batch }),
    }).catch(function () {});
  }, 3000);

  function clientInfo() {
    const prefs = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.indexOf("rr-") === 0) prefs[key] = String(localStorage.getItem(key)).slice(0, 200);
      }
    } catch (e) {}
    return {
      notes: (document.getElementById("debug-notes") || {}).value || "",
      page_opened_at: state.started,
      view: view(),
      url: location.href,
      user_agent: navigator.userAgent,
      language: navigator.language,
      screen: screen.width + "x" + screen.height,
      window: window.innerWidth + "x" + window.innerHeight,
      pixel_ratio: window.devicePixelRatio,
      theme: document.documentElement.getAttribute("data-theme") || "",
      scripts: Array.prototype.map.call(document.scripts, function (s) { return s.src.replace(location.origin, ""); }).filter(Boolean),
      preferences: prefs,
      offline: window.trainLogOffline ? window.trainLogOffline.summary() : undefined,
      errors_this_session: state.errors.slice().reverse(),
      failed_requests: state.requests.slice().reverse(),
      recent_actions: state.actions.slice(-40).reverse(),
    };
  }

  async function fetchReport() {
    const response = await nativeFetch("/api/debug/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client: clientInfo() }),
    });
    if (!response.ok) throw new Error("Report request failed (" + response.status + ")");
    return response.json();
  }

  function stamp() {
    const d = new Date();
    const p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes());
  }

  function say(text, kind) {
    if (window.trainLog && window.trainLog.banner) {
      window.trainLog.banner(text, kind);
      return;
    }
    const el = document.getElementById("banner");
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
      say("");
    });
    el.replaceChildren(msg, dismiss);
  }

  function escapeText(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function whenText(iso) {
    const d = new Date(iso);
    return isNaN(d) ? String(iso || "") : d.toLocaleString();
  }

  async function refresh() {
    const body = document.getElementById("debug-errors-body");
    const empty = document.getElementById("debug-errors-empty");
    const summary = document.getElementById("debug-summary");
    if (!body) return;
    let report;
    try {
      report = await fetchReport();
    } catch (err) {
      say("Could not load debug details: " + err.message, "error");
      return;
    }
    const errors = report.errors || [];
    empty.hidden = errors.length > 0;
    const wrap = body.closest(".table-wrap");
    if (wrap) wrap.hidden = errors.length === 0;
    body.innerHTML = errors
      .slice(0, 100)
      .map(function (item) {
        const where = (item.detail && (item.detail.where || item.detail.source || item.detail.url || item.detail.view)) || "";
        return (
          "<tr><td>" + escapeText(whenText(item.at)) + "</td><td>" + escapeText(item.kind) +
          (where ? '<span class="debug-where">' + escapeText(where) + "</span>" : "") +
          "</td><td>" + escapeText(item.message) + "</td></tr>"
        );
      })
      .join("");
    const db = report.database || {};
    const book = report.station_book || {};
    const rows = [
      ["Version", (report.app && report.app.version) + (report.app && report.app.packaged ? " (Mac app)" : " (dev server)")],
      ["macOS", (report.system && report.system.macos) + " · " + (report.system && report.system.machine)],
      ["Trains", db.entry_count],
      ["Held imports", db.pending_import_count],
      ["Database", db.path],
      ["Station book", (book.files || 0) + " files, " + (book.locations || 0) + " locations"],
      ["Added or edited", (book.added_or_edited || []).length],
      ["Hidden", (book.hidden || []).length],
      ["Watch folder", report.watch_folder && report.watch_folder.path],
      ["Errors logged", errors.length],
    ];
    summary.innerHTML = rows
      .map(function (row) {
        return "<div><dt>" + escapeText(row[0]) + "</dt><dd>" + escapeText(row[1] == null ? "—" : row[1]) + "</dd></div>";
      })
      .join("");
  }

  async function exportReport() {
    try {
      const report = await fetchReport();
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const filename = "TRAIN-LOG-debug-" + stamp() + ".json";
      if (!(window.trainLogSaveFile && (await window.trainLogSaveFile(blob, filename)))) {
        const href = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = href;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(href); }, 2500);
      }
      say("Debug report ready. Send the file with your next set of changes.", "ok");
    } catch (err) {
      say("Could not build the debug report: " + err.message, "error");
    }
  }

  async function copyReport() {
    try {
      const report = await fetchReport();
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      say("Debug report copied. Paste it into your next message.", "ok");
    } catch (err) {
      say("Could not copy the report: " + err.message + ". Use Export instead.", "error");
    }
  }

  async function clearLog() {
    const sure = await window.askConfirm({
      title: "Clear the Error Log?",
      message: "The next report will only show new errors.",
      ok: "Clear",
    });
    if (!sure) return;
    await nativeFetch("/api/debug/clear", { method: "POST" });
    state.errors.length = 0;
    state.requests.length = 0;
    bump();
    say("Error log cleared.", "ok");
    refresh();
  }

  document.addEventListener("DOMContentLoaded", function () {
    const bind = function (id, fn) {
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", fn);
    };
    bind("debug-export", exportReport);
    bind("debug-copy", copyReport);
    bind("debug-clear", clearLog);
    bind("debug-refresh", refresh);
    bump();
  });

  window.trainLogDebug = { refresh: refresh, exportReport: exportReport, note: noteError, state: state };
})();
