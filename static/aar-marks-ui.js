/* Reporting Marks UI — re-integrated after 1.0.15 restart (slice A). */
(function () {
  "use strict";

  function escapeText(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function banner(message, kind) {
    if (window.trainLog && typeof window.trainLog.banner === "function") {
      window.trainLog.banner(message, kind);
      return;
    }
    var el = document.getElementById("banner") || document.getElementById("alert-banner");
    if (!el) {
      if (kind === "error") console.error(message);
      else console.log(message);
      return;
    }
    if (!message) {
      el.hidden = true;
      el.replaceChildren();
      el.className = "banner";
      return;
    }
    el.hidden = false;
    el.className = "banner" + (kind ? " is-" + kind : "");
    var msg = document.createElement("span");
    msg.className = "banner-text";
    msg.textContent = String(message);
    var dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "banner-dismiss";
    dismiss.setAttribute("aria-label", "Dismiss message");
    dismiss.textContent = "×";
    dismiss.addEventListener("click", function () {
      banner("");
    });
    el.replaceChildren(msg, dismiss);
  }

  async function api(path, options) {
    options = options || {};
    try {
      var response = await fetch(path, options);
      var text = await response.text();
      var data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (err) {
        data = { error: text || "Bad response." };
      }
      return { status: response.status, ok: response.ok, data: data };
    } catch (err) {
      return { status: 0, ok: false, data: { error: (err && err.message) || "Network error." } };
    }
  }

  let aarMarksBook = null;
  let aarMarksLoad = null;
  let aarMarksKind = "all";
  let aarMarksFilter = "all";
  let aarMarksLetter = "all";
  let aarMarksPage = 1;
  let aarMarksPageSize = 80;
  let aarMarksPick = "";
  let aarMarksSearchTimer = 0;
  let aarMarksSearchSeq = 0;

  function aarEditedSet(book) {
    const set = {};
    (book && book.edited || []).forEach(function (mark) {
      set[String(mark || "").toUpperCase()] = true;
    });
    return set;
  }

  function invalidateAarMarks() {
    aarMarksBook = null;
    aarMarksLoad = null;
  }

  function acceptAarBook(data) {
    const book = data && data.book ? data.book : data;
    if (!book || !Array.isArray(book.marks)) throw new Error("bad book");
    aarMarksBook = book;
    return book;
  }

  function loadAarMarks() {
    if (aarMarksBook) return Promise.resolve(aarMarksBook);
    if (!aarMarksLoad) {
      aarMarksLoad = fetch("/api/aar-marks").then(function (res) {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      }).then(function (data) {
        const book = acceptAarBook(data);
        // Empty success means the field VFS lacked the shipped list — fall through to static/.
        if (!book.marks || !book.marks.length) throw new Error("empty book");
        return book;
      }).catch(function () {
        aarMarksBook = null;
        return fetch("static/reference/aar-marks.json").then(function (res) {
          if (!res.ok) throw new Error(String(res.status));
          return res.json();
        }).then(function (data) {
          if (data && !data.edited) data.edited = [];
          aarMarksBook = data;
          return data;
        });
      });
    }
    return aarMarksLoad;
  }

  function namesToEditText(names) {
    return (names || []).map(function (row) {
      const flag = row && row.f ? String(row.f) : "";
      const name = row && row.n ? String(row.n) : "";
      if (!name) return "";
      return (flag === "*" || flag === "+" ? flag : "") + name;
    }).filter(Boolean).join("\n");
  }

  function editTextToNames(text) {
    return String(text || "").split(/\r?\n/).map(function (line) {
      line = line.replace(/^\s+/, "").replace(/\s+$/, "");
      if (!line) return null;
      let flag = "";
      if ((line.charAt(0) === "*" || line.charAt(0) === "+") && line.length > 1) {
        flag = line.charAt(0);
        line = line.slice(1).replace(/^\s+/, "");
      }
      if (!line) return null;
      return { n: line, f: flag };
    }).filter(Boolean);
  }

  function setAarEditMode(on) {
    const fly = document.getElementById("aar-marks-fly");
    const panel = document.getElementById("aar-marks-edit-panel");
    const actions = document.getElementById("aar-marks-fly-actions");
    const names = document.getElementById("aar-marks-fly-names");
    const hint = document.querySelector("#aar-marks-fly .aar-marks-fly-hint");
    if (fly) fly.classList.toggle("is-editing", Boolean(on));
    if (panel) panel.hidden = !on;
    if (actions) actions.hidden = on || fly && fly.classList.contains("is-empty");
    if (names) names.hidden = Boolean(on);
    if (hint) hint.hidden = Boolean(on);
  }

  function aarMarksUsesDetailSwap() {
    return window.matchMedia("(max-width: 1024px)").matches || document.documentElement.classList.contains("is-field");
  }

  function aarMarkKind(mark) {
    const m = String(mark || "").toUpperCase();
    // AAR equipment suffixes are almost always 4+ characters (GATX, TTX).
    // Short marks like CSX stay in Railroad unless the user filters otherwise.
    if (m.length >= 4 && /X$/.test(m)) return "x";
    if (m.length >= 4 && /Z$/.test(m)) return "z";
    if (m.length >= 4 && /U$/.test(m)) return "u";
    return "rail";
  }

  function aarKindLabel(kind, shortLabel) {
    if (shortLabel) {
      return kind === "x" ? "Private X" : kind === "z" ? "Trailer Z" : kind === "u" ? "Container U" : "Railroad";
    }
    return kind === "x" ? "Private car (X)"
      : kind === "z" ? "Trailer (Z)"
      : kind === "u" ? "Container (U)"
      : "Railroad / equipment";
  }

  function aarEntryFlags(entry) {
    const names = entry && entry.n || [];
    let reused = false;
    names.forEach(function (row) {
      if (row && row.f) reused = true;
    });
    return { multi: names.length > 1, reused: reused };
  }

  function aarTitleCaseName(raw) {
    const src = String(raw || "").trim();
    if (!src) return "";
    const small = {
      a: 1, an: 1, and: 1, as: 1, at: 1, by: 1, for: 1, from: 1, in: 1,
      into: 1, of: 1, on: 1, or: 1, the: 1, to: 1, with: 1
    };
    const special = {
      co: "Co", inc: "Inc", llc: "LLC", ltd: "Ltd", corp: "Corp",
      rr: "RR", rwy: "Rwy", ry: "Ry"
    };
    const upperSrc = src.toUpperCase();
    function keepMark(word) {
      const upper = word.toUpperCase();
      if (!/^[A-Z][A-Z0-9&]{0,5}$/.test(upper)) return false;
      // Parenthetical reporting marks: "(GATC) …", "(BN) …"
      if (upperSrc.indexOf("(" + upper + ")") !== -1) return true;
      if (/[0-9&]/.test(upper)) return true;
      if (upper.length >= 3 && /[XUZ]$/.test(upper)) return true;
      if (upperSrc.indexOf(upper + " (") === 0 || upperSrc.indexOf(upper + "(") === 0) return true;
      return false;
    }
    let wordIndex = 0;
    return src.replace(/[A-Za-z0-9&]+|[^A-Za-z0-9&]+/g, function (token) {
      if (!/[A-Za-z0-9]/.test(token)) return token;
      const lower = token.toLowerCase();
      if (keepMark(token)) {
        wordIndex += 1;
        return token.toUpperCase();
      }
      if (Object.prototype.hasOwnProperty.call(special, lower)) {
        wordIndex += 1;
        return special[lower];
      }
      let titled = lower.charAt(0).toUpperCase() + lower.slice(1);
      if (wordIndex > 0 && small[lower]) titled = lower;
      wordIndex += 1;
      return titled;
    });
  }

  function aarPrimaryName(entry) {
    const names = entry && entry.n || [];
    const plain = names.find(function (row) { return !row.f; });
    return (plain || names[0] || {}).n || "";
  }

  function aarQueryIsMark(query) {
    return /^[A-Z0-9&]{1,6}$/.test(String(query || "").trim().toUpperCase());
  }

  // Name hit: substring match, with a bonus when a word starts with the query
  // (so "UNI" matches "UNION PACIFIC", not only marks like UNI / MUNI).
  function aarNameHit(blob, q) {
    if (!q || !blob) return { hit: false, word: false };
    const at = blob.indexOf(q);
    if (at === -1) return { hit: false, word: false };
    const word = at === 0 || /[^A-Z0-9]/.test(blob.charAt(at - 1));
    return { hit: true, word: word };
  }

  function aarMarkLetter(mark) {
    const ch = String(mark || "").charAt(0).toUpperCase();
    return /[A-Z]/.test(ch) ? ch : "#";
  }

  function searchAarMarks(book, query, kind, filter, letter) {
    const rows = book && book.marks || [];
    const q = String(query || "").trim().toUpperCase();
    const wantLetter = String(letter || "all").toUpperCase();
    const markQuery = aarQueryIsMark(q);
    const hits = [];
    rows.forEach(function (entry) {
      const mark = entry.m;
      const markKind = aarMarkKind(mark);
      if (kind !== "all" && markKind !== kind) return;
      if (wantLetter !== "ALL" && aarMarkLetter(mark) !== wantLetter) return;
      const flags = aarEntryFlags(entry);
      if (filter === "reused" && !flags.reused) return;
      if (filter === "multi" && !flags.multi) return;
      const names = entry.n || [];
      const blob = names.map(function (row) { return row.n; }).join(" ").toUpperCase();
      if (!q) {
        hits.push({ entry: entry, kind: markKind, rank: 9 });
        return;
      }
      const exact = mark === q;
      const prefix = mark.indexOf(q) === 0;
      const markHit = mark.indexOf(q) !== -1;
      const nameInfo = aarNameHit(blob, q);
      if (!markHit && !nameInfo.hit) return;
      let rank = 5;
      if (exact) rank = 0;
      else if (prefix) rank = 1;
      else if (markHit) rank = 2;
      else if (nameInfo.word) rank = markQuery ? 3 : 3;
      else if (blob.indexOf(q) === 0) rank = 4;
      else rank = 5;
      hits.push({ entry: entry, kind: markKind, rank: rank });
    });
    if (q) hits.sort(function (a, b) { return a.rank - b.rank || (a.entry.m < b.entry.m ? -1 : a.entry.m > b.entry.m ? 1 : 0); });
    else hits.sort(function (a, b) { return a.entry.m < b.entry.m ? -1 : a.entry.m > b.entry.m ? 1 : 0; });
    const limit = aarMarksPageSize || 80;
    const pages = Math.max(1, Math.ceil(hits.length / limit) || 1);
    const page = Math.min(Math.max(1, aarMarksPage || 1), pages);
    const start = (page - 1) * limit;
    const pageRows = hits.slice(start, start + limit);
    return {
      rows: pageRows,
      total: hits.length,
      page: page,
      pages: pages,
      from: pageRows.length ? start + 1 : 0,
      to: start + pageRows.length,
      more: page < pages,
      searching: !!q,
    };
  }

  function clearAarFly() {
    const fly = document.getElementById("aar-marks-fly");
    const markEl = document.getElementById("aar-marks-fly-mark");
    const kindEl = document.getElementById("aar-marks-fly-kind");
    const list = document.getElementById("aar-marks-fly-names");
    aarMarksPick = "";
    if (fly) fly.classList.add("is-empty");
    if (markEl) markEl.textContent = "—";
    if (kindEl) kindEl.textContent = "Tap a row to read every name for that mark.";
    if (list) list.textContent = "";
    document.querySelectorAll(".aar-marks-row.is-on").forEach(function (btn) {
      btn.classList.remove("is-on");
    });
    const dialog = document.getElementById("aar-marks");
    if (dialog) dialog.classList.remove("is-phone-detail");
    const back = document.getElementById("aar-marks-back");
    if (back) back.hidden = true;
  }

  // openDetail: true only on an explicit row tap. Typing must never hide the search box.
  function showAarMark(entry, openDetail) {
    const fly = document.getElementById("aar-marks-fly");
    const markEl = document.getElementById("aar-marks-fly-mark");
    const kindEl = document.getElementById("aar-marks-fly-kind");
    const list = document.getElementById("aar-marks-fly-names");
    const actions = document.getElementById("aar-marks-fly-actions");
    const restoreBtn = document.getElementById("aar-marks-restore");
    if (!fly || !entry) return;
    aarMarksPick = entry.m;
    fly.classList.remove("is-empty");
    setAarEditMode(false);
    markEl.textContent = entry.m;
    const edited = aarMarksBook && aarEditedSet(aarMarksBook)[entry.m];
    kindEl.textContent = aarKindLabel(aarMarkKind(entry.m)) + (edited ? " · edited on this Mac" : "");
    list.textContent = "";
    const seen = {};
    (entry.n || []).forEach(function (row) {
      const key = String(row.n || "").toUpperCase();
      if (!key || seen[key]) return;
      seen[key] = true;
      const li = document.createElement("li");
      if (row.f) {
        const flag = document.createElement("span");
        flag.className = "aar-flag";
        flag.textContent = row.f === "+" ? "reused +" : "reused *";
        li.appendChild(flag);
      }
      li.appendChild(document.createTextNode(aarTitleCaseName(row.n)));
      list.appendChild(li);
    });
    if (actions) actions.hidden = false;
    if (restoreBtn) restoreBtn.hidden = !edited;
    document.querySelectorAll(".aar-marks-row").forEach(function (btn) {
      btn.classList.toggle("is-on", btn.getAttribute("data-aar-mark") === entry.m);
    });
    const dialog = document.getElementById("aar-marks");
    if (openDetail && dialog && aarMarksUsesDetailSwap()) {
      dialog.classList.add("is-phone-detail");
      const back = document.getElementById("aar-marks-back");
      if (back) back.hidden = false;
    }
  }


  let aarAdding = false;

  function setAarAddMode(on) {
    aarAdding = Boolean(on);
    const panel = document.getElementById("aar-marks-add-panel");
    const body = document.querySelector("#aar-marks .aar-marks-body");
    const tools = document.querySelector("#aar-marks .aar-marks-tools");
    if (panel) panel.hidden = !aarAdding;
    if (body) body.hidden = aarAdding;
    if (tools) tools.hidden = aarAdding;
    if (aarAdding) {
      setAarEditMode(false);
      clearAarFly();
      const markEl = document.getElementById("aar-marks-add-mark");
      const namesEl = document.getElementById("aar-marks-add-names");
      if (markEl) markEl.value = "";
      if (namesEl) namesEl.value = "";
      if (markEl) markEl.focus();
    }
  }

  function openAarAddMark() {
    setAarAddMode(true);
  }

  async function saveAarAddMark() {
    const markEl = document.getElementById("aar-marks-add-mark");
    const namesEl = document.getElementById("aar-marks-add-names");
    const mark = String((markEl && markEl.value) || "").trim().toUpperCase();
    const names = editTextToNames(namesEl && namesEl.value);
    if (!mark) {
      banner("Type a reporting mark first.", "error");
      if (markEl) markEl.focus();
      return;
    }
    if (!names.length) {
      banner("Add at least one name.", "error");
      if (namesEl) namesEl.focus();
      return;
    }
    const result = await api("/api/aar-marks/mark", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mark: mark, names: names }),
      quiet: true,
    });
    if (!result.ok) {
      banner((result.data && result.data.error) || "Could not save that mark.", "error");
      return;
    }
    invalidateAarMarks();
    acceptAarBook(result.data);
    setAarAddMode(false);
    aarMarksPick = mark;
    aarMarksLetter = "all";
    aarMarksKind = "all";
    aarMarksFilter = "all";
    aarMarksPage = 1;
    const qEl = document.getElementById("aar-marks-q");
    if (qEl) qEl.value = mark;
    banner(mark + " added.", "ok");
    renderAarMarks();
    const hit = (aarMarksBook.marks || []).find(function (row) { return row.m === mark; });
    if (hit) showAarMark(hit, true);
  }

  function openAarMarkEditor() {
    if (!aarMarksPick || !aarMarksBook) return;
    const entry = (aarMarksBook.marks || []).find(function (row) { return row.m === aarMarksPick; });
    if (!entry) return;
    const box = document.getElementById("aar-marks-edit-names");
    if (box) box.value = namesToEditText(entry.n);
    setAarEditMode(true);
    if (box) box.focus();
  }

  async function saveAarMarkEditor() {
    if (!aarMarksPick) return;
    const box = document.getElementById("aar-marks-edit-names");
    const names = editTextToNames(box && box.value);
    if (!names.length) {
      banner("Add at least one name.", "error");
      if (box) box.focus();
      return;
    }
    const result = await api("/api/aar-marks/mark", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mark: aarMarksPick, names: names }),
      quiet: true,
    });
    if (!result.ok) {
      banner((result.data && result.data.error) || "Could not save that mark.", "error");
      return;
    }
    invalidateAarMarks();
    acceptAarBook(result.data);
    setAarEditMode(false);
    banner(aarMarksPick + " updated.", "ok");
    renderAarMarks();
  }

  async function restoreAarMarkEditor() {
    if (!aarMarksPick) return;
    const sure = await window.askConfirm({
      title: "Restore " + aarMarksPick + "?",
      message: "Puts this mark back to the list as issued on this Mac.",
      ok: "Restore",
    });
    if (!sure) return;
    const result = await api("/api/aar-marks/mark/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mark: aarMarksPick }),
      quiet: true,
    });
    if (!result.ok) {
      banner((result.data && result.data.error) || "Could not restore that mark.", "error");
      return;
    }
    invalidateAarMarks();
    acceptAarBook(result.data);
    setAarEditMode(false);
    banner(aarMarksPick + " restored.", "ok");
    renderAarMarks();
  }

  function renderAarMarks() {
    const list = document.getElementById("aar-marks-list");
    const title = document.getElementById("aar-marks-title");
    const pager = document.getElementById("aar-marks-pager");
    const qEl = document.getElementById("aar-marks-q");
    if (!list) return;
    const seq = ++aarMarksSearchSeq;
    const queryNow = qEl ? qEl.value : "";
    loadAarMarks().then(function (book) {
      if (seq !== aarMarksSearchSeq) return;
      // Re-read the box so a slower response never paints an older query.
      const liveQuery = qEl ? qEl.value : queryNow;
      const found = searchAarMarks(book, liveQuery, aarMarksKind, aarMarksFilter, aarMarksLetter);
      aarMarksPage = found.page;
      if (title) {
        if (!found.total) {
          title.textContent = found.searching ? "No matches" : "";
        } else if (found.pages > 1) {
          title.textContent = found.from.toLocaleString() + "–" + found.to.toLocaleString() + " of " + found.total.toLocaleString() +
            (found.searching ? " matches" : " marks") + " · page " + found.page + " of " + found.pages;
        } else if (found.searching) {
          title.textContent = found.total + (found.total === 1 ? " match" : " matches");
        } else {
          title.textContent = found.total.toLocaleString() + " marks";
        }
      }
      if (pager) {
        pager.hidden = found.pages <= 1;
        const prev = pager.querySelector('[data-aar-page="prev"]');
        const next = pager.querySelector('[data-aar-page="next"]');
        if (prev) prev.disabled = found.page <= 1;
        if (next) next.disabled = found.page >= found.pages;
      }
      if (!found.rows.length) {
        list.innerHTML = '<p class="muted aar-marks-empty">' +
          (found.searching ? "Nothing in this mark list matches." : "The reporting mark list did not load.") +
          "</p>";
        // Keep the search tools visible — never jump to detail while filtering.
        if (aarMarksPick) {
          aarMarksPick = "";
          const fly = document.getElementById("aar-marks-fly");
          const markEl = document.getElementById("aar-marks-fly-mark");
          const kindEl = document.getElementById("aar-marks-fly-kind");
          const names = document.getElementById("aar-marks-fly-names");
          if (fly) fly.classList.add("is-empty");
          if (markEl) markEl.textContent = "—";
          if (kindEl) kindEl.textContent = "Tap a row to read every name for that mark.";
          if (names) names.textContent = "";
          setAarEditMode(false);
          const act = document.getElementById("aar-marks-fly-actions");
          if (act) act.hidden = true;
        }
        return;
      }
      const head = '<div class="aar-marks-head" aria-hidden="true"><span>Mark</span><span>Name</span></div>';
      const rows = found.rows.map(function (hit) {
        const entry = hit.entry;
        const on = entry.m === aarMarksPick ? " is-on" : "";
        const flags = aarEntryFlags(entry);
        const extras = (entry.n || []).length > 1 ? " · " + entry.n.length + " names" : "";
        const reused = flags.reused ? " · reused" : "";
        const edited = aarEditedSet(book)[entry.m] ? " · edited" : "";
        return '<button type="button" class="aar-marks-row' + on + '" role="option" data-aar-mark="' + escapeText(entry.m) + '">' +
          '<span class="aar-marks-mark">' + escapeText(entry.m) + "</span>" +
          '<span class="aar-marks-name">' + escapeText(aarTitleCaseName(aarPrimaryName(entry))) +
          '<span class="aar-marks-meta">' + escapeText(aarKindLabel(hit.kind, true)) + extras + reused + edited + "</span></span>" +
          "</button>";
      }).join("");
      list.innerHTML = head + rows;
      const wrap = list.closest(".aar-marks-list-wrap");
      if (wrap) wrap.scrollTop = 0;
      // Typing only refreshes the list. Detail opens on an explicit row tap.
      if (aarMarksPick) {
        const keep = found.rows.find(function (hit) { return hit.entry.m === aarMarksPick; });
        if (keep) showAarMark(keep.entry, false);
        else {
          aarMarksPick = "";
          const fly = document.getElementById("aar-marks-fly");
          const markEl = document.getElementById("aar-marks-fly-mark");
          const kindEl = document.getElementById("aar-marks-fly-kind");
          const names = document.getElementById("aar-marks-fly-names");
          if (fly) fly.classList.add("is-empty");
          if (markEl) markEl.textContent = "—";
          if (kindEl) kindEl.textContent = "Tap a row to read every name for that mark.";
          if (names) names.textContent = "";
          setAarEditMode(false);
          const act = document.getElementById("aar-marks-fly-actions");
          if (act) act.hidden = true;
          document.querySelectorAll(".aar-marks-row.is-on").forEach(function (btn) {
            btn.classList.remove("is-on");
          });
        }
      }
    }, function () {
      if (seq !== aarMarksSearchSeq) return;
      list.innerHTML = '<p class="muted aar-marks-empty">The reporting mark list did not load.</p>';
    });
  }

  function queueAarMarksSearch() {
    window.clearTimeout(aarMarksSearchTimer);
    aarMarksSearchTimer = window.setTimeout(function () {
      aarMarksPage = 1;
      renderAarMarks();
    }, 180);
  }

  function openAarMarks(seed) {
    const dialog = document.getElementById("aar-marks");
    if (!dialog || typeof dialog.showModal !== "function") return;
    const qEl = document.getElementById("aar-marks-q");
    if (seed && qEl) qEl.value = String(seed).toUpperCase();
    dialog.classList.remove("is-phone-detail");
    const back = document.getElementById("aar-marks-back");
    if (back) back.hidden = true;
    renderAarMarks();
    if (!dialog.open) dialog.showModal();
    if (qEl) qEl.focus();
  }

  document.addEventListener("click", function (event) {
    if (!event.target || event.target.id !== "aar-marks-back") return;
    const dialog = document.getElementById("aar-marks");
    if (dialog) dialog.classList.remove("is-phone-detail");
    event.target.hidden = true;
    const qEl = document.getElementById("aar-marks-q");
    if (qEl) qEl.focus();
  });

  document.addEventListener("click", function (event) {
    const opener = event.target.closest && event.target.closest("[data-aar-marks]");
    if (!opener) return;
    openAarMarks();
  });

  document.addEventListener("click", function (event) {
    const kind = event.target.closest && event.target.closest("#aar-marks [data-aar-kind]");
    if (!kind) return;
    aarMarksKind = kind.getAttribute("data-aar-kind") || "all";
    document.querySelectorAll("#aar-marks [data-aar-kind]").forEach(function (btn) {
      btn.classList.toggle("is-on", btn === kind);
    });
    aarMarksPage = 1;
    renderAarMarks();
  });

  function setAarMarksLetter(letter) {
    aarMarksLetter = String(letter || "all").toLowerCase() === "all" ? "all" : String(letter || "all").charAt(0).toUpperCase();
    document.querySelectorAll("#aar-marks [data-aar-letter]").forEach(function (btn) {
      btn.classList.toggle("is-on", (btn.getAttribute("data-aar-letter") || "") === aarMarksLetter);
    });
    const select = document.getElementById("aar-marks-letter");
    if (select) select.value = aarMarksLetter;
    aarMarksPage = 1;
    renderAarMarks();
  }

  document.addEventListener("click", function (event) {
    const filter = event.target.closest && event.target.closest("#aar-marks [data-aar-filter]");
    if (!filter) return;
    aarMarksFilter = filter.getAttribute("data-aar-filter") || "all";
    document.querySelectorAll("#aar-marks [data-aar-filter]").forEach(function (btn) {
      btn.classList.toggle("is-on", btn === filter);
    });
    aarMarksPage = 1;
    renderAarMarks();
  });

  document.addEventListener("click", function (event) {
    const letter = event.target.closest && event.target.closest("#aar-marks [data-aar-letter]");
    if (!letter) return;
    setAarMarksLetter(letter.getAttribute("data-aar-letter") || "all");
  });

  document.addEventListener("change", function (event) {
    if (!event.target || event.target.id !== "aar-marks-letter") return;
    setAarMarksLetter(event.target.value || "all");
  });

  document.addEventListener("input", function (event) {
    if (!event.target || event.target.id !== "aar-marks-q") return;
    // Never open detail while typing — only refresh the filtered list.
    const dialog = document.getElementById("aar-marks");
    if (dialog) dialog.classList.remove("is-phone-detail");
    const back = document.getElementById("aar-marks-back");
    if (back) back.hidden = true;
    queueAarMarksSearch();
  });

  document.addEventListener("keydown", function (event) {
    if (!event.target || event.target.id !== "aar-marks-q") return;
    if (event.key !== "Enter") return;
    // Enter searches; do not submit the dialog form / close it.
    event.preventDefault();
    window.clearTimeout(aarMarksSearchTimer);
    aarMarksPage = 1;
    renderAarMarks();
  });

  document.addEventListener("click", function (event) {
    const pageBtn = event.target.closest && event.target.closest("#aar-marks [data-aar-page]");
    if (pageBtn) {
      const dir = pageBtn.getAttribute("data-aar-page");
      if (dir === "prev") aarMarksPage = Math.max(1, (aarMarksPage || 1) - 1);
      else if (dir === "next") aarMarksPage = (aarMarksPage || 1) + 1;
      renderAarMarks();
      return;
    }
  });

  document.addEventListener("click", function (event) {
    const row = event.target.closest && event.target.closest(".aar-marks-row[data-aar-mark]");
    if (!row) return;
    const mark = row.getAttribute("data-aar-mark");
    loadAarMarks().then(function (book) {
      const hit = (book.marks || []).find(function (entry) { return entry.m === mark; });
      if (hit) showAarMark(hit, true);
    });
  });

  document.addEventListener("click", function (event) {
    if (!event.target) return;
    if (event.target.id === "aar-marks-edit") {
      openAarMarkEditor();
      return;
    }
    if (event.target.id === "aar-marks-edit-cancel") {
      setAarEditMode(false);
      return;
    }
    if (event.target.id === "aar-marks-edit-save") {
      saveAarMarkEditor();
      return;
    }
    if (event.target.id === "aar-marks-restore") {
      restoreAarMarkEditor();
      return;
    }
    if (event.target.id === "aar-marks-add") {
      openAarAddMark();
      return;
    }
    if (event.target.id === "aar-marks-add-cancel") {
      setAarAddMode(false);
      return;
    }
    if (event.target.id === "aar-marks-add-save") {
      saveAarAddMark();
    }
  });

  const aarDialog = document.getElementById("aar-marks");
  if (aarDialog) {
    aarDialog.addEventListener("close", function () {
      aarDialog.classList.remove("is-phone-detail");
      const back = document.getElementById("aar-marks-back");
      if (back) back.hidden = true;
      setAarEditMode(false);
      setAarAddMode(false);
      window.clearTimeout(aarMarksSearchTimer);
    });
  }

  if (/(?:\?|&)marks=1(?:&|$)/.test(location.search)) {
    setTimeout(function () { openAarMarks(); }, 200);
  }
})();

