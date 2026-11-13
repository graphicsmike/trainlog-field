(function () {
  let TRAIN_TYPES = ["PASS", "COAL", "AUTO", "CON", "PIG", "MIXED", "ETH-GAS", "GRAIN", "BR TBL", "MIL", "BALLAST", "COTTON", "SAND", "SODA", "CEMENT", "LGT HLP", "LGT PWR", "TIE TRN", "RAIL", "HGH WDE", "OCS", "EXCRSN", "SPECIAL", "HI-RAIL", "HERZOG", "LORAM", "MOW"];
  let RAILROAD_GROUPS = [];
  let RAILROADS = [];
  let FREIGHT_RAILROADS = [];
  let PASSENGER_RAILROADS = [];
  let RR_MEANINGS = {};
  let MARK_ALIASES = {};
  let TYPE_MEANINGS = {};
  let STATE_CODES = [];
  let STATE_ZONES = {};
  let SPLIT_STATES = [];
  const ROW_COUNT = 1;
  const TZ_ICON =
    '<svg class="tz-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="6.25"></circle><path d="M2 8h12"></path><path d="M8 1.75c1.7 1.9 2.6 4 2.6 6.25S9.7 12.35 8 14.25C6.3 12.35 5.4 10.25 5.4 8S6.3 3.65 8 1.75"></path></svg>';
  const SUN_ICON =
    '<svg class="sun-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="2.2" fill="currentColor"/><path fill="currentColor" d="M7.3 1h1.4v2.15H7.3zm0 11.85h1.4V15H7.3zM1 7.3h2.15v1.4H1zm11.85 0H15v1.4h-2.15zM3.2 2.2l1-1 1.5 1.52-1 1zm7.1 7.08 1-1 1.5 1.52-1 1zM3.2 13.8l1.5-1.52 1 1-1.5 1.52zm7.1-7.08 1.5-1.52 1 1-1.5 1.52z"/></svg>';
  const MOON_ICON =
    '<svg class="moon-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false"><path fill="currentColor" d="M10.7 1.2a6.9 6.9 0 1 0 4.1 10.6A6 6 0 0 1 10.7 1.2Z"/></svg>';
  const ENTRY_ID_TITLE =
    "Sighting number. Each train keeps its number for good, and numbers from deleted trains are never reused, so gaps are normal.";
  const DAY_TRAIN_TITLE =
    "Train number for this date — first train of the day is 1, then 2, and so on.";
  const rowsEl = document.getElementById("rows");
  const dayLogEl = document.getElementById("day-log");
  const dateEl = document.getElementById("session-date");
  const tripEl = document.getElementById("session-trip");
  const tripFromEl = document.getElementById("session-trip-from");
  const tripToEl = document.getElementById("session-trip-to");
  const bannerEl = document.getElementById("banner");
  const editBanner = document.getElementById("edit-banner");
  const confirmDialog = document.getElementById("confirm-dialog");
  const confirmMessage = document.getElementById("confirm-message");
  const confirmDetails = document.getElementById("confirm-details");

  let editingId = null;
  let pendingEditId = null;
  let pendingItems = [];
  let editingEntry = null;
  let pendingForceEntries = null;
  let SUBS_BY_RR = {};
  let SUB_COUNTS = {};
  let trainStart = 1;
  let dayEntries = [];

  const NO_FIX_TYPES = ["checkbox", "radio", "button", "submit", "reset", "file", "range", "color", "hidden"];

  function noAutoFix(el) {
    if (!el || !el.matches || !el.matches("input, textarea") || el.dataset.noFix) return;
    if (el.tagName === "INPUT" && NO_FIX_TYPES.indexOf((el.type || "").toLowerCase()) !== -1) return;
    el.dataset.noFix = "1";
    el.setAttribute("autocorrect", "off");
    el.setAttribute("spellcheck", "false");
    if (!el.hasAttribute("autocapitalize")) el.setAttribute("autocapitalize", "off");
    if (!el.hasAttribute("autocomplete")) el.setAttribute("autocomplete", "off");
  }

  // Phones read these when the keyboard opens, so set them on touch, before focus.
  ["touchstart", "mousedown", "focusin"].forEach(function (type) {
    document.addEventListener(
      type,
      function (event) {
        noAutoFix(event.target);
      },
      { capture: true, passive: true }
    );
  });
  document.querySelectorAll("input, textarea").forEach(noAutoFix);

  function todayISO() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return now.getFullYear() + "-" + month + "-" + day;
  }

  let submittedFromBottom = false;

  function showBanner(text, kind) {
    if (!bannerEl) return;
    if (!text) {
      bannerEl.hidden = true;
      bannerEl.replaceChildren();
      bannerEl.className = "banner";
      const dialogMsg = document.getElementById("edit-dialog-msg");
      if (dialogMsg) dialogMsg.hidden = true;
      return;
    }
    bannerEl.hidden = false;
    bannerEl.className = "banner" + (kind ? " is-" + kind : "");
    const msg = document.createElement("span");
    msg.className = "banner-text";
    msg.textContent = text;
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "banner-dismiss";
    dismiss.setAttribute("aria-label", "Dismiss message");
    dismiss.textContent = "×";
    dismiss.addEventListener("click", function () {
      showBanner("");
    });
    bannerEl.replaceChildren(msg, dismiss);
    if (submittedFromBottom && (kind === "error" || kind === "ok")) {
      submittedFromBottom = false;
      const bad = kind === "error" && document.querySelector("#view-entry .is-invalid");
      const target = bad || (kind === "ok" ? document.getElementById("rows") : bannerEl);
      if (target) target.scrollIntoView({ block: bad ? "center" : "start", behavior: "smooth" });
    }
    const dialogMsg = document.getElementById("edit-dialog-msg");
    const dialog = document.getElementById("edit-dialog");
    if (dialogMsg && dialog && dialog.open) {
      dialogMsg.hidden = kind === "ok";
      dialogMsg.textContent = text;
      dialogMsg.className = "edit-dialog-msg" + (kind ? " is-" + kind : "");
    }
  }

  const workEl = document.getElementById("work-progress");
  const workBar = workEl ? workEl.querySelector(".work-progress-bar") : null;
  const workFill = workEl ? workEl.querySelector("i") : null;
  const workLabel = document.getElementById("work-progress-label");
  let workDepth = 0;
  let workPollTimer = null;
  let workStartedAt = 0;

  function workElapsed() {
    if (!workStartedAt) return "";
    const sec = Math.max(0, Math.floor((Date.now() - workStartedAt) / 1000));
    if (sec < 5) return "";
    const min = Math.floor(sec / 60);
    const rest = sec % 60;
    return min ? " · " + min + ":" + String(rest).padStart(2, "0") : " · " + sec + "s";
  }

  function workShow(title, opts) {
    if (!workEl) return;
    opts = opts || {};
    workEl.hidden = false;
    workEl.setAttribute("aria-hidden", "false");
    const total = opts.total || 0;
    const current = opts.current || 0;
    const determinate = total > 0;
    workEl.classList.toggle("is-indeterminate", !determinate);
    let text = title || "Working…";
    if (determinate) text += " " + current + " of " + total;
    text += workElapsed();
    if (workLabel) workLabel.textContent = text;
    if (workBar) {
      workBar.setAttribute("aria-valuemax", determinate ? String(total) : "100");
      workBar.setAttribute("aria-valuenow", determinate ? String(current) : "0");
    }
    if (workFill && determinate) {
      workFill.style.width = Math.max(2, Math.min(100, (current / total) * 100)) + "%";
    } else if (workFill && !determinate) {
      workFill.style.width = "";
    }
  }

  function workStart(title, opts) {
    opts = opts || {};
    workDepth += 1;
    if (!workStartedAt) workStartedAt = Date.now();
    workShow(title, opts);
    if (opts.poll) workPoll();
  }

  function workSet(current, total, title) {
    if (!workDepth) workDepth = 1;
    if (!workStartedAt) workStartedAt = Date.now();
    workShow(title, { current: current, total: total });
  }

  function workPoll() {
    if (workPollTimer) return;
    workPollTimer = setInterval(function () {
      fetch("/api/work")
        .then(function (response) {
          return response.text().then(function (text) {
            return parseApiBody(text, response.headers.get("content-type") || "");
          });
        })
        .then(function (data) {
          if (!data || !data.active) return;
          workShow(data.message || data.title || "Working…", {
            current: data.current || 0,
            total: data.total || 0,
          });
        })
        .catch(function () {});
    }, 250);
  }

  function workDone() {
    workDepth = Math.max(0, workDepth - 1);
    if (workDepth) return;
    if (workPollTimer) {
      clearInterval(workPollTimer);
      workPollTimer = null;
    }
    workStartedAt = 0;
    if (workEl) {
      workEl.hidden = true;
      workEl.setAttribute("aria-hidden", "true");
    }
    if (workFill) workFill.style.width = "0";
  }

  const FIELD_TARGETS = {
    railroad: [".f-rr", ".f-rr-custom"],
    lead_locomotive: [".f-mark", ".f-loco", ".f-mark-custom"],
    direction: [".dir-group"],
    power_consist: [".f-c1", ".f-c2", ".f-c3"],
    train_types: [".type-group"],
    car_counts: [".f-cars-a", ".f-cars-b"],
    location_spot: [".f-loc"],
    location_state: [".f-state"],
    location_subdivision: [".f-sub", ".f-sub-custom"],
    time: [".f-hh", ".f-mm"],
    train_symbol: [".f-symbol"],
    train_number: [".f-passno"],
  };
  const FIELD_GROUPS = {
    lead_locomotive: [".lead-fields"],
    direction: [".dir-group"],
    power_consist: [".consist"],
    train_types: [".type-group"],
    car_counts: [".car-fields"],
    time: [".time-fields"],
  };

  function clearInvalid(scope) {
    const root = scope || document;
    Array.prototype.forEach.call(root.querySelectorAll(".is-invalid"), function (el) {
      el.classList.remove("is-invalid");
    });
  }

  function markFieldInvalid(row, field) {
    if (field === "date") {
      dateEl.classList.add("is-invalid");
      return;
    }
    if (!row || !field) return;
    (FIELD_TARGETS[field] || []).forEach(function (sel) {
      const el = row.querySelector(sel);
      if (el && !el.hidden) el.classList.add("is-invalid");
    });
    (FIELD_GROUPS[field] || []).forEach(function (sel) {
      const el = row.querySelector(sel);
      if (el) el.classList.add("is-invalid");
    });
  }

  function missingFields(payload) {
    const missing = [];
    if (!payload.railroad) missing.push("railroad");
    if (!payload.direction && !payload.stopped && !payload.in_siding && !payload.crew_change && !payload.no_crew) missing.push("direction");
    if (!payload.train_types || !payload.train_types.length) missing.push("train_types");
    if (!payload.location_spot) missing.push("location_spot");
    if (!payload.time) missing.push("time");
    if (!payload.date) missing.push("date");
    return missing;
  }

  function dropInvalid(el) {
    if (!el) return;
    el.classList.remove("is-invalid");
    const wrap = el.closest(".lead-fields, .consist, .car-fields, .time-fields, .dir-group, .type-group");
    if (wrap) wrap.classList.remove("is-invalid");
  }

  function growNotes(el) {
    if (!el) return;
    el.style.height = "auto";
    let h = 36;
    const row = el.closest(".train-row");
    if (row) {
      const raw = getComputedStyle(row).getPropertyValue("--pad-control-h").trim();
      const n = parseFloat(raw);
      if (n) h = n;
    }
    el.style.height = h + "px";
  }

  function setNotesOpen(row, on, focusBox) {
    const chip = row.querySelector(".f-notes-toggle");
    const field = row.querySelector(".field-notes");
    const box = row.querySelector(".f-notes");
    if (chip) chip.classList.toggle("is-on", on);
    row.classList.toggle("has-notes", on);
    if (field) field.hidden = !on;
    if (on && box) {
      growNotes(box);
      if (focusBox) box.focus();
    }
  }

  function cleanSymbol(text) {
    return String(text || "")
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, "");
  }

  function fitInput(el, minCh) {
    if (!el) return;
    el.style.width = "calc(" + Math.max(minCh, Math.ceil(el.value.length * 1.08) + 2) + "ch + 16px)";
  }

  function setSymbolOpen(row, on, focusBox) {
    const chip = row.querySelector(".f-symbol-toggle");
    const field = row.querySelector(".field-symbol");
    const box = row.querySelector(".f-symbol");
    if (chip) chip.classList.toggle("is-on", on);
    if (field) field.hidden = !on;
    if (on && box && focusBox) box.focus();
  }

  let SPECIAL_ROSTER = { heritage: [], steam: [], schemes: [], wheels: [] };

  function unitKey(text) {
    let upper = String(text || "").toUpperCase();
    const match = upper.match(/^\s*([A-Z][A-Z&]*)[\s-]*(\d.*)$/);
    if (match) {
      const mark = MARK_ALIASES[match[1]] || MARK_ALIASES[match[1].replace(/&/g, "")] || match[1];
      upper = mark + match[2];
    }
    return upper.replace(/[^A-Z0-9]/g, "");
  }

  function rosterFind(kind, unit) {
    const key = unitKey(unit);
    if (!key) return null;
    const field = kind === "steam" ? "engine" : "unit";
    return (
      (SPECIAL_ROSTER[kind] || []).filter(function (row) {
        return unitKey(row[field]) === key;
      })[0] || null
    );
  }

  async function loadSpecialRoster() {
    const result = await api("/api/special-power/roster", { quiet: true });
    if (!result.ok || !result.data) return;
    SPECIAL_ROSTER = result.data;
    document.querySelectorAll(".train-row").forEach(function (row) {
      refreshSpecialHint(row);
      if (row.querySelector(".sp-assist-input")) syncAssistHeritage(row);
      refreshConsistNote(row);
    });
  }

  function wheelOptions(value, blankLabel) {
    const known = (SPECIAL_ROSTER.wheels || []).map(function (pair) {
      return pair[0];
    });
    const other = value && known.indexOf(value) === -1;
    return (
      '<option value="">' +
      escapeText(blankLabel || "Select") +
      "</option>" +
      (SPECIAL_ROSTER.wheels || [])
        .map(function (pair) {
          return (
            '<option value="' +
            escapeText(pair[0]) +
            '"' +
            (pair[0] === value ? " selected" : "") +
            ">" +
            escapeText(pair[0] + (pair[1] ? " " + pair[1] : "")) +
            "</option>"
          );
        })
        .join("") +
      '<option value="Other"' +
      (other ? " selected" : "") +
      ">Other</option>"
    );
  }

  function selectHtml(cls, label, options, value) {
    return (
      '<select class="' +
      cls +
      '" aria-label="' +
      escapeText(label) +
      '">' +
      options
        .map(function (pair) {
          return (
            '<option value="' +
            escapeText(pair[0]) +
            '"' +
            (pair[0] === (value || "") ? " selected" : "") +
            ">" +
            escapeText(pair[1]) +
            "</option>"
          );
        })
        .join("") +
      "</select>"
    );
  }

  const SP_ERA_LABELS = { a250: "America 250" };
  const SP_POSITIONS = [
    ["lead", "Leading", "Leading"],
    ["trail", "Trailing", "Trailing"],
    ["dp", "DP", "Distributed power, mid-train or rear"],
    ["assist", "Assist", "Helping a steam engine"],
  ];

  function rosterSuggest(kind, query) {
    const text = String(query || "").trim().toUpperCase();
    const key = unitKey(text);
    if (!key) return [];
    const field = kind === "steam" ? "engine" : "unit";
    const words = text.length >= 3 && /[A-Z]{3}/.test(text) ? text : "";
    const scored = [];
    (SPECIAL_ROSTER[kind] || []).forEach(function (entry) {
      const k = unitKey(entry[field]);
      let score = -1;
      if (k === key) score = 0;
      else if (k.indexOf(key) === 0) score = 1;
      else if (/^\d/.test(key) && k.replace(/^[A-Z]+/, "").indexOf(key) === 0) score = 2;
      else if (k.indexOf(key) !== -1) score = 3;
      else if (words && [entry.scheme, entry.name].join(" ").toUpperCase().indexOf(words) !== -1) score = 4;
      if (score !== -1) scored.push([score, k.length, k, entry]);
    });
    scored.sort(function (a, b) {
      return a[0] - b[0] || a[1] - b[1] || (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0);
    });
    return scored.slice(0, 12).map(function (pick) {
      return pick[3];
    });
  }

  function spSuggestLabel(kind, entry) {
    const extra =
      kind === "steam"
        ? [entry.name, entry.wheels]
        : [entry.scheme, SP_ERA_LABELS[entry.era]];
    return (
      "<strong>" +
      escapeText(kind === "steam" ? entry.engine : entry.unit) +
      "</strong>" +
      extra
        .filter(Boolean)
        .map(function (part) {
          return ' <span class="sp-suggest-sep" aria-hidden="true">·</span> ' + escapeText(part);
        })
        .join("")
    );
  }

  function hideSpSuggest(input) {
    const box = input && input.parentNode.querySelector(".sp-suggest");
    if (!box) return;
    box.style.display = "none";
    box._items = [];
    box._active = -1;
  }

  function showSpSuggest(input) {
    const item = input.closest(".sp-item");
    const box = input.parentNode.querySelector(".sp-suggest");
    if (!item || !box) return;
    const kind = item.getAttribute("data-sp");
    const items = rosterSuggest(kind, input.value);
    const exact = items.length === 1 && unitKey(items[0][kind === "steam" ? "engine" : "unit"]) === unitKey(input.value);
    if (!items.length || exact) {
      hideSpSuggest(input);
      return;
    }
    box._items = items;
    box._active = -1;
    box.innerHTML = items
      .map(function (entry, index) {
        return '<button type="button" tabindex="-1" data-sp-pick="' + index + '">' + spSuggestLabel(kind, entry) + "</button>";
      })
      .join("");
    box.style.display = "block";
    placeSuggest(box, input);
  }

  function placeSuggest(box, input) {
    const rect = input.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 8;
    const above = rect.top - 8;
    const up = below < 180 && above > below;
    box.style.position = "fixed";
    box.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 300) - 4)) + "px";
    box.style.width = Math.min(Math.max(rect.width, 300), window.innerWidth - 8) + "px";
    box.style.maxHeight = Math.max(120, Math.min(320, up ? above : below)) + "px";
    box.style.top = up ? "auto" : rect.bottom + 2 + "px";
    box.style.bottom = up ? window.innerHeight - rect.top + 2 + "px" : "auto";
  }

  function showSchemeSuggest(input, whole) {
    const box = input.parentNode.querySelector(".sp-suggest");
    if (!box) return;
    const all = SPECIAL_ROSTER.schemes || [];
    const current = input.value.trim().toUpperCase();
    const picked = all.some(function (name) {
      return String(name).toUpperCase() === current;
    });
    const q = whole && picked ? "" : current;
    const names = all.filter(function (name) {
      return !q || String(name).toUpperCase().indexOf(q) !== -1;
    });
    names.sort(function (a, b) {
      return (String(a).toUpperCase().indexOf(q) === 0 ? 0 : 1) - (String(b).toUpperCase().indexOf(q) === 0 ? 0 : 1);
    });
    if (!names.length || (!whole && names.length === 1 && names[0].toUpperCase() === q)) {
      hideSpSuggest(input);
      return;
    }
    box._items = names;
    box._active = -1;
    box.classList.add("sp-menu");
    let checked = -1;
    box.innerHTML = names
      .map(function (name, index) {
        const on = String(name).toUpperCase() === current;
        if (on) checked = index;
        return (
          '<button type="button" tabindex="-1" data-scheme-pick="' +
          index +
          '"' +
          (on ? ' class="is-checked"' : "") +
          ">" +
          escapeText(name) +
          "</button>"
        );
      })
      .join("");
    box.scrollTop = 0;
    box.style.display = "block";
    placeSuggest(box, input);
    if (checked >= 0) {
      box._active = checked;
      const button = box.children[checked];
      button.classList.add("is-active");
      box.scrollTop = Math.max(0, button.offsetTop - (box.clientHeight - button.offsetHeight) / 2);
    }
  }

  function pickScheme(box, index) {
    const name = box && box._items && box._items[index];
    const input = box && box.parentNode.querySelector(".sp-scheme, .spl-scheme");
    if (!name || !input) return;
    input.value = name;
    hideSpSuggest(input);
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  const SCHEME_INPUTS = ".sp-scheme, .spl-scheme";
  window.addEventListener(
    "scroll",
    function (event) {
      if (event.target && event.target.closest && event.target.closest(".sp-suggest")) return;
      document.querySelectorAll(".sp-suggest").forEach(function (box) {
        if (box.style.display !== "block") return;
        const input = box.parentNode.querySelector("input");
        if (input) placeSuggest(box, input);
      });
    },
    true
  );
  window.addEventListener("resize", function () {
    document.querySelectorAll(".sp-suggest").forEach(function (box) {
      box.style.display = "none";
    });
  });
  document.addEventListener("focusin", function (event) {
    if (event.target.matches && event.target.matches(SCHEME_INPUTS)) showSchemeSuggest(event.target, true);
  });
  document.addEventListener("mouseover", function (event) {
    const pick = event.target.closest && event.target.closest(".sp-menu [data-scheme-pick]");
    if (!pick) return;
    const box = pick.parentNode;
    box._active = Number(pick.getAttribute("data-scheme-pick"));
    box.querySelectorAll("button").forEach(function (button) {
      button.classList.toggle("is-active", button === pick);
    });
  });
  document.addEventListener("input", function (event) {
    if (event.target.matches && event.target.matches(SCHEME_INPUTS)) showSchemeSuggest(event.target);
  });
  document.addEventListener("focusout", function (event) {
    if (!event.target.matches || !event.target.matches(SCHEME_INPUTS)) return;
    window.setTimeout(function () {
      if (document.activeElement !== event.target) hideSpSuggest(event.target);
    }, 150);
  });
  document.addEventListener("mousedown", function (event) {
    if (!event.target.closest || !event.target.closest(".sp-suggest")) return;
    event.preventDefault();
    const pick = event.target.closest("[data-scheme-pick]");
    if (pick) pickScheme(pick.closest(".sp-suggest"), Number(pick.getAttribute("data-scheme-pick")));
  });
  document.addEventListener(
    "keydown",
    function (event) {
      if (!event.target.matches || !event.target.matches(SCHEME_INPUTS)) return;
      const box = event.target.parentNode.querySelector(".sp-suggest");
      if (!box || box.style.display !== "block") return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        moveSpSuggest(box, event.key === "ArrowDown" ? 1 : -1);
      } else if (event.key === "Enter" && box._active >= 0) {
        event.preventDefault();
        event.stopPropagation();
        pickScheme(box, box._active);
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        hideSpSuggest(event.target);
      }
    },
    true
  );

  function moveSpSuggest(box, step) {
    const buttons = box.querySelectorAll("button");
    if (!buttons.length) return;
    box._active = (box._active + step + buttons.length) % buttons.length;
    buttons.forEach(function (button, index) {
      button.classList.toggle("is-active", index === box._active);
    });
    buttons[box._active].scrollIntoView({ block: "nearest" });
  }

  function pickSpSuggest(row, box, index) {
    const entry = box && box._items && box._items[index];
    if (!entry) return;
    const item = box.closest(".sp-item");
    const kind = item.getAttribute("data-sp");
    const input = item.querySelector(kind === "steam" ? ".sp-engine" : ".sp-unit");
    input.value = kind === "steam" ? entry.engine : entry.unit;
    hideSpSuggest(input);
    applyRosterToItem(item, true);
    refreshSpecialHint(row);
    refreshSpecialSummary(row);
    markEmpty(row);
  }

  function setSpPos(item, value) {
    const select = item.querySelector(":scope > .sp-pos");
    if (select) select.value = value || "";
    refreshSpDecode(item);
  }

  function openSpEditor(button) {
    const input = button.parentElement.querySelector("input");
    if (!input) return;
    button.hidden = true;
    input.hidden = false;
    input.focus();
    if (typeof input.select === "function") input.select();
  }

  function setSpEra(item, value) {
    const field = item.querySelector(".sp-era");
    if (field) field.value = value === "a250" ? "a250" : "";
  }

  function spBoardFace(unit) {
    const match = String(unit || "").trim().match(/^([A-Z&]+)[\s-]*(\d[\w-]*)$/i);
    if (match) return { mark: match[1].toUpperCase(), number: match[2].toUpperCase() };
    return null;
  }

  function spBoardFaceHtml(face) {
    return face ? "<b>" + escapeText(face.number) + "</b><small>" + escapeText(face.mark) + "</small>" : "";
  }

  function refreshSpBoard(item) {
    const board = item && item.querySelector(".sp-board");
    if (!board) return;
    const value = board.querySelector("input").value;
    const face = spBoardFace(value);
    board.classList.toggle("is-empty", !value.trim());
    board.classList.toggle("has-face", Boolean(face));
    board.querySelector(".sp-board-face").innerHTML = spBoardFaceHtml(face);
    const title = item.querySelector(".sp-title-field");
    if (title) title.classList.toggle("is-empty", !title.querySelector("input").value.trim());
  }

  function spBoardHtml(cls, label, value) {
    value = String(value || "");
    const face = spBoardFace(value);
    return (
      '<label class="sp-id-field sp-board' +
      (value.trim() ? "" : " is-empty") +
      (face ? " has-face" : "") +
      '"><input class="' +
      cls +
      '" type="text" autocomplete="off" spellcheck="false" aria-label="' +
      label +
      '" aria-autocomplete="list" value="' +
      escapeText(value) +
      '" /><span class="sp-board-face" aria-hidden="true">' +
      spBoardFaceHtml(face) +
      '</span><small class="sp-board-cap" aria-hidden="true">' +
      label +
      '</small><div class="suggest sp-suggest"></div></label>'
    );
  }

  function spTitleHtml(cls, label, value, suggest) {
    value = String(value || "");
    return (
      '<label class="sp-id-field sp-title-field' +
      (value.trim() ? "" : " is-empty") +
      '"><input class="' +
      cls +
      '" type="text" autocomplete="off" aria-label="' +
      label +
      '"' +
      (suggest ? ' aria-autocomplete="list"' : "") +
      ' value="' +
      escapeText(value) +
      '" /><small class="sp-title-cap" aria-hidden="true">' +
      label +
      "</small>" +
      (suggest ? '<div class="suggest sp-suggest"></div>' : "") +
      "</label>"
    );
  }

  function spTextField(cls, edit, label, value, suggest) {
    const text = String(value || "");
    const empty = !text.trim();
    return (
      '<span class="sp-text-field">' +
      '<input class="' +
      cls +
      '" type="text" autocomplete="off" spellcheck="false" aria-label="' +
      escapeText(label) +
      '"' +
      (suggest ? ' aria-autocomplete="list"' : "") +
      ' value="' +
      escapeText(text) +
      '" hidden />' +
      '<button type="button" class="sp-text sp-edit' +
      (empty ? " is-empty" : "") +
      '" data-edit="' +
      edit +
      '">' +
      escapeText(empty ? label : text) +
      "</button>" +
      (suggest ? '<div class="suggest sp-suggest" hidden></div>' : "") +
      "</span>"
    );
  }

  function spPosChips(selected) {
    return SP_POSITIONS.map(function (pos) {
      const on = selected === pos[0];
      return (
        '<button type="button" class="sp-pos-chip' +
        (on ? " is-on" : "") +
        '" data-sp-pos="' +
        pos[0] +
        '" aria-pressed="' +
        String(on) +
        '">' +
        escapeText(pos[1]) +
        "</button>"
      );
    }).join("");
  }

  function spPosSelect(selected) {
    return (
      '<select class="sp-pos" aria-label="Position in the train"><option value=""' +
      (selected ? "" : " selected") +
      ">Position</option>" +
      SP_POSITIONS.map(function (pos) {
        return '<option value="' + pos[0] + '"' + (selected === pos[0] ? " selected" : "") + ">" + escapeText(pos[1]) + "</option>";
      }).join("") +
      "</select>"
    );
  }

  function spPosLabel(value) {
    const hit = SP_POSITIONS.filter(function (pos) {
      return pos[0] === value;
    })[0];
    return hit ? hit[1] : "Position";
  }

  function heritageItemHtml(item) {
    item = item || {};
    return (
      '<div class="sp-item sp-card" data-sp="heritage">' +
      spBoardHtml("sp-unit", "Unit", item.unit) +
      spTitleHtml("sp-scheme", "Scheme", item.scheme, true) +
      '<div class="sp-meta">' +
      spPosSelect(item.position || "") +
      "</div>" +
      '<button type="button" class="sp-remove" aria-label="Remove this unit" title="Remove">×</button>' +
      '<input class="sp-era" type="hidden" value="' +
      (item.era === "a250" ? "a250" : "") +
      '" />' +
      "</div>"
    );
  }

  function steamWheelsHtml(wheels) {
    const known = (SPECIAL_ROSTER.wheels || []).some(function (pair) {
      return pair[0] === wheels;
    });
    const other = wheels && !known;
    return (
      '<select class="sp-wheels" aria-label="Wheel arrangement">' +
      wheelOptions(wheels || "", "Wheel arrangement") +
      "</select>" +
      '<input class="sp-wheels-other" type="text" aria-label="Other wheel arrangement" value="' +
      escapeText(other ? wheels : "") +
      '"' +
      (other ? "" : " hidden") +
      " />"
    );
  }

  function steamLineHtml(label, engine, name, wheels, removeLabel, extra) {
    return (
      '<div class="sp-main">' +
      spTextField("sp-engine", "engine", label, engine, true) +
      spTextField("sp-name", "name", "Name", name, false) +
      (removeLabel
        ? '<button type="button" class="sp-remove" aria-label="' + escapeText(removeLabel) + '" title="Remove">×</button>'
        : "") +
      "</div>" +
      '<div class="sp-chips">' +
      steamWheelsHtml(wheels) +
      (extra || "") +
      "</div>"
    );
  }

  function steamItemHtml(item) {
    item = item || {};
    const second = item.second || {};
    return (
      '<div class="sp-item sp-card" data-sp="steam">' +
      spBoardHtml("sp-engine", "Engine", item.engine) +
      spTitleHtml("sp-name", "Name", item.name, false) +
      '<div class="sp-meta">' +
      steamWheelsHtml(item.wheels) +
      '<span class="sp-meta-dot" aria-hidden="true">·</span>' +
      '<label class="sp-check"><input class="sp-dh" type="checkbox"' +
      (item.second ? " checked" : "") +
      " /> Doubleheader</label>" +
      '<label class="sp-check"><input class="sp-assist" type="checkbox"' +
      (item.diesel_assist ? " checked" : "") +
      " /> Diesel assist</label>" +
      "</div>" +
      '<button type="button" class="sp-remove" aria-label="Remove this steam engine" title="Remove">×</button>' +
      '<div class="sp-item sp-second sp-card" data-sp="steam"' +
      (item.second ? "" : " hidden") +
      ">" +
      spBoardHtml("sp-engine", "2nd Engine", second.engine) +
      spTitleHtml("sp-name", "Name", second.name, false) +
      '<div class="sp-meta">' +
      steamWheelsHtml(second.wheels) +
      "</div></div>" +
      '<div class="sp-assist-list"' +
      (item.diesel_assist ? "" : " hidden") +
      '><span class="sp-assist-head">Assist diesels</span>' +
      (item.assist || []).map(assistUnitHtml).join("") +
      '<button type="button" class="btn tiny ghost sp-assist-add">+ Add Diesel</button></div>' +
      "</div>"
    );
  }

  function assistUnitHtml(unit) {
    return (
      '<span class="sp-assist-unit"><input class="sp-assist-input sp-mini-board" type="text" autocomplete="off" spellcheck="false" aria-label="Assist diesel" aria-autocomplete="list" value="' +
      escapeText(unit || "") +
      '" /><div class="suggest sp-suggest" hidden></div><button type="button" class="sp-assist-remove" aria-label="Remove this diesel" title="Remove">×</button>' +
      '<small class="sp-assist-note"></small></span>'
    );
  }

  function assistUnits(row) {
    const units = [];
    row.querySelectorAll('.sp-item[data-sp="steam"]:not(.sp-second)').forEach(function (item) {
      if (!item.querySelector(".sp-assist").checked) return;
      item.querySelectorAll(".sp-assist-input").forEach(function (input) {
        const unit = input.value.trim();
        if (unit && units.indexOf(unit) === -1) units.push(unit);
      });
    });
    return units;
  }

  function heritageItemFor(row, unit) {
    const key = unitKey(unit);
    return Array.prototype.filter.call(row.querySelectorAll('.sp-item[data-sp="heritage"]'), function (item) {
      return unitKey(item.querySelector(".sp-unit").value) === key;
    })[0] || null;
  }

  function syncAssistHeritage(row) {
    const keys = assistUnits(row).map(unitKey);
    row.querySelectorAll('.sp-item[data-sp="heritage"][data-assist-auto]').forEach(function (item) {
      const unit = item.querySelector(".sp-unit").value;
      if (keys.indexOf(unitKey(unit)) === -1 && item.querySelector(".sp-pos").value === "assist") item.remove();
    });
    assistUnits(row).forEach(function (unit) {
      const found = rosterFind("heritage", unit);
      if (!found) return;
      let item = heritageItemFor(row, unit);
      if (!item) {
        item = addSpecialItem(row, "heritage", { unit: found.unit, scheme: found.scheme, era: found.era, position: "assist" });
        if (item) item.setAttribute("data-assist-auto", "");
      } else if (!item.querySelector(".sp-pos").value) {
        setSpPos(item, "assist");
      }
    });
    row.querySelectorAll(".sp-assist-input").forEach(function (input) {
      const note = input.parentNode.querySelector(".sp-assist-note");
      const found = input.value.trim() ? rosterFind("heritage", input.value) : null;
      note.textContent = found ? found.scheme + " heritage, added to Heritage Units" : "";
    });
  }

  const CONSIST_GROUPS = [
    ["head", "Trailing", "trail"],
    ["mid", "Mid-train DP", "dp"],
    ["rear", "Rear DP", "dp"],
  ];

  function consistCounts(row) {
    const count = function (selector) {
      const input = row.querySelector(selector);
      const value = input ? Math.floor(Number(input.value)) : 0;
      return value > 0 ? Math.min(value, 12) : 0;
    };
    const mid = count(".f-c2");
    const rear = count(".f-c3");
    if (!mid) return { head: Math.max(count(".f-c1") - 1, 0), mid: rear, rear: 0 };
    return { head: Math.max(count(".f-c1") - 1, 0), mid: mid, rear: rear };
  }

  function consistUnitText(row, value) {
    const text = String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
    if (!/^\d[\w-]*$/.test(text)) return text;
    const mark = markOf(row);
    return mark && mark !== "Other" ? mark + " " + text : text;
  }

  function fitConsistBox(input) {
    const len = input.value.length;
    input.style.width = len > 7 ? "max(84px, calc(" + len + "ch + " + (len * 0.04).toFixed(2) + "em + 16px))" : "";
  }

  function consistBoxValues(row) {
    const values = { head: [], mid: [], rear: [] };
    row.querySelectorAll(".cu-unit").forEach(function (input) {
      values[input.getAttribute("data-cu")].push(input.value);
    });
    return values;
  }

  function readConsistUnits(row) {
    const values = consistBoxValues(row);
    const units = {};
    CONSIST_GROUPS.forEach(function (group) {
      const list = values[group[0]]
        .map(function (value) {
          return consistUnitText(row, value);
        })
        .filter(Boolean);
      if (list.length) units[group[0]] = list;
    });
    return units;
  }

  function consistGroupLabel(row, key, values) {
    if (key !== "mid") return CONSIST_GROUPS.filter(function (group) {
      return group[0] === key;
    })[0][1];
    return consistCounts(row).rear || (values.rear || []).some(function (value) {
      return String(value || "").trim();
    })
      ? "Mid-train DP"
      : "DP";
  }

  function renderConsistUnits(row, values, force) {
    const box = row.querySelector(".consist-units");
    if (!box) return;
    const current = values || consistBoxValues(row);
    const counts = consistCounts(row);
    const plan = CONSIST_GROUPS.map(function (group) {
      const list = (current[group[0]] || []).slice();
      while (list.length > counts[group[0]] && !String(list[list.length - 1] || "").trim()) list.pop();
      return {
        group: group,
        label: consistGroupLabel(row, group[0], current),
        list: list,
        total: Math.max(counts[group[0]], list.length),
        count: counts[group[0]],
      };
    });
    const sig = plan
      .map(function (part) {
        return part.total + "/" + part.count + "/" + part.label;
      })
      .join(",");
    if (!force && box.getAttribute("data-sig") === sig) return;
    box.setAttribute("data-sig", sig);
    if (!box.querySelector(".cu-body")) {
      box.innerHTML =
        '<button type="button" class="sp-section-toggle cu-toggle" aria-expanded="false" title="Type the numbers of the other units, if you caught them">' +
        '<span class="sp-caret" aria-hidden="true"></span>Unit Numbers<span class="cu-count"></span></button>' +
        '<div class="cu-body" hidden></div>';
    }
    box.querySelector(".cu-body").innerHTML = plan
      .filter(function (part) {
        return part.total > 0;
      })
      .map(function (part) {
        let inputs = "";
        for (let i = 0; i < part.total; i += 1) {
          const extra = i >= part.count;
          const number = part.group[0] === "head" ? i + 2 : i + 1;
          inputs +=
            '<input class="cu-unit sp-mini-board' +
            (extra ? " is-extra" : "") +
            '" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" data-cu="' +
            part.group[0] +
            '" aria-label="' +
            escapeText(part.label + " unit " + number) +
            '" title="' +
            escapeText(
              extra
                ? "More units than the consist count. Clear it or raise the count."
                : part.label + " unit " + number + ". Type the number; it takes the lead's railroad unless you type a mark."
            ) +
            '" value="' +
            escapeText(part.list[i] || "") +
            '" />';
        }
        return (
          '<div class="cu-group" data-cu-group="' +
          part.group[0] +
          '"><small class="cu-cap">' +
          escapeText(part.label) +
          '</small><div class="cu-boxes">' +
          inputs +
          "</div></div>"
        );
      })
      .join("") + '<small class="cu-note" hidden></small>';
    box.hidden = !plan.some(function (part) {
      return part.total > 0;
    });
    box.querySelectorAll(".cu-unit").forEach(fitConsistBox);
    refreshConsistNote(row);
    refreshConsistCount(row);
  }

  function setConsistOpen(row, on, focus) {
    const box = row.querySelector(".consist-units");
    const body = box && box.querySelector(".cu-body");
    if (!body) return;
    box.classList.toggle("is-open", on);
    box.querySelector(".cu-toggle").setAttribute("aria-expanded", String(on));
    body.hidden = !on;
    refreshConsistCount(row);
    if (on && focus) {
      const inputs = Array.prototype.slice.call(body.querySelectorAll(".cu-unit"));
      const first = inputs.filter(function (input) {
        return !input.value.trim();
      })[0] || inputs[0];
      if (first) first.focus();
    }
  }

  function refreshConsistCount(row) {
    const out = row.querySelector(".cu-count");
    if (!out) return;
    const inputs = row.querySelectorAll(".cu-unit");
    const filled = Array.prototype.filter.call(inputs, function (input) {
      return input.value.trim();
    }).length;
    out.textContent = filled ? filled + " of " + inputs.length : "";
    out.hidden = !filled;
  }

  function refreshConsistNote(row) {
    const note = row.querySelector(".cu-note");
    if (!note) return;
    const extra = row.querySelector(".cu-unit.is-extra");
    const units = readConsistUnits(row);
    const heritage = [];
    CONSIST_GROUPS.forEach(function (group) {
      (units[group[0]] || []).forEach(function (unit) {
        const found = rosterFind("heritage", unit);
        if (found) heritage.push(found.unit + " " + found.scheme);
      });
    });
    const parts = [];
    if (heritage.length) parts.push(heritage.join(", ") + " heritage, added to Heritage Units");
    if (extra) parts.push("Boxes outlined in amber are past the consist count");
    note.textContent = parts.join(". ");
    note.hidden = !parts.length;
  }

  function syncConsistHeritage(row) {
    const units = readConsistUnits(row);
    const wanted = [];
    CONSIST_GROUPS.forEach(function (group) {
      (units[group[0]] || []).forEach(function (unit) {
        wanted.push({ unit: unit, position: group[2] });
      });
    });
    const keys = wanted.map(function (item) {
      return unitKey(item.unit);
    });
    row.querySelectorAll('.sp-item[data-sp="heritage"][data-consist-auto]').forEach(function (item) {
      const pos = item.querySelector(".sp-pos").value;
      if (keys.indexOf(unitKey(item.querySelector(".sp-unit").value)) === -1 && (pos === "trail" || pos === "dp")) item.remove();
    });
    wanted.forEach(function (want) {
      const found = rosterFind("heritage", want.unit);
      if (!found) return;
      const item = heritageItemFor(row, want.unit);
      if (!item) {
        const added = addSpecialItem(row, "heritage", { unit: found.unit, scheme: found.scheme, era: found.era, position: want.position });
        if (added) added.setAttribute("data-consist-auto", "");
      } else if (!item.querySelector(".sp-pos").value) {
        setSpPos(item, want.position);
      }
    });
    refreshSpecialSummary(row);
    refreshConsistNote(row);
  }

  function markConsistHeritage(row) {
    const units = readConsistUnits(row);
    CONSIST_GROUPS.forEach(function (group) {
      (units[group[0]] || []).forEach(function (unit) {
        const item = heritageItemFor(row, unit);
        if (item && item.querySelector(".sp-pos").value === group[2]) item.setAttribute("data-consist-auto", "");
      });
    });
  }

  function spLayout() {
    let saved = "";
    try { saved = localStorage.getItem("rr-sp-layout") || ""; } catch (err) { saved = ""; }
    return saved === "line" || saved === "column" ? saved : "board";
  }

  function applySpLayout(name) {
    const layout = name === "line" || name === "column" ? name : "board";
    document.documentElement.setAttribute("data-sp-layout", layout);
    document.querySelectorAll(".sp-layout").forEach(function (btn) {
      const on = btn.getAttribute("data-sp-layout") === layout;
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function specialPanelHtml() {
    return (
      '<div class="field-special" hidden>' +
      '<div class="sp-block" data-sp-block="heritage" hidden><div class="sp-head"><span>Heritage Units</span><div class="sp-head-tools">' +
      '<button type="button" class="sp-edit-list" data-sp-editor="heritage">Edit List</button>' +
      '<button type="button" class="btn tiny ghost" data-add-special="heritage">+ Add Heritage Unit</button></div></div>' +
      '<p class="sp-desc">Diesels in a heritage, tribute, or America 250 paint scheme. Type the unit and the scheme fills in.</p>' +
      '<div class="sp-list" data-empty="No heritage units on this train yet."></div></div>' +
      '<div class="sp-block" data-sp-block="steam" hidden><div class="sp-head"><span>Steam Specials</span><div class="sp-head-tools">' +
      '<button type="button" class="sp-edit-list" data-sp-editor="steam">Edit List</button>' +
      '<button type="button" class="btn tiny ghost" data-add-special="steam">+ Add Steam Engine</button></div></div>' +
      '<p class="sp-desc">Steam locomotives on the train. Type the engine and the name and wheel arrangement fill in.</p>' +
      '<div class="sp-list" data-empty="No steam engines on this train yet."></div></div>' +
      "</div>"
    );
  }

  function spItemBlank(item) {
    return !Array.prototype.some.call(item.querySelectorAll('input[type="text"]'), function (input) {
      return input.value.trim();
    }) && !(item.querySelector(".sp-pos") && item.querySelector(".sp-pos").value) && !(item.querySelector(".sp-assist") && item.querySelector(".sp-assist").checked) && !(item.querySelector(".sp-dh") && item.querySelector(".sp-dh").checked);
  }

  function blankSpecialItem(list) {
    return Array.prototype.filter.call(list.querySelectorAll(":scope > .sp-item"), spItemBlank)[0] || null;
  }

  function addSpecialItem(row, kind, item, focus) {
    const list = row.querySelector('[data-sp-block="' + kind + '"] .sp-list');
    if (!list) return null;
    const blank = blankSpecialItem(list);
    let added;
    if (blank && !item) {
      added = blank;
    } else {
      const html = kind === "steam" ? steamItemHtml(item) : heritageItemHtml(item);
      if (blank) {
        blank.insertAdjacentHTML("beforebegin", html);
        added = blank.previousElementSibling;
        blank.remove();
      } else {
        list.insertAdjacentHTML("beforeend", html);
        added = list.lastElementChild;
      }
      if (kind === "heritage" && item && item.unit) setSpEra(added, item.era, Boolean(rosterFind("heritage", item.unit)));
      refreshSpDecode(added);
    }
    if (focus) {
      const input = added.querySelector("input");
      if (input) input.focus();
    }
    return added;
  }

  function specialFromText(text) {
    const steam = rosterFind("steam", text);
    const heritage = rosterFind("heritage", text);
    if (steam && !heritage) return { kind: "steam", item: { engine: steam.engine, name: steam.name, wheels: steam.wheels } };
    if (heritage) return { kind: "heritage", item: { unit: heritage.unit, scheme: heritage.scheme, era: heritage.era } };
    return { kind: "heritage", item: { unit: String(text || "").toUpperCase().replace(/\s+/g, " ").trim() } };
  }

  function commitSpecialAdd(row, picked) {
    let kind;
    let item;
    if (picked && picked.kind) {
      kind = picked.kind;
      const entry = picked.entry;
      item =
        kind === "steam"
          ? { engine: entry.engine, name: entry.name, wheels: entry.wheels }
          : { unit: entry.unit, scheme: entry.scheme, era: entry.era };
    } else {
      const text = String(picked || "").trim();
      if (!text) return;
      const made = specialFromText(text);
      kind = made.kind;
      item = made.item;
      if (!item.unit && !item.engine) return;
    }
    setSpecialOpen(row, kind, true);
    const added = addSpecialItem(row, kind, item);
    if (added) applyRosterToItem(added, true);
    const input = row.querySelector(".sp-add-input");
    if (input) {
      input.value = "";
      hideSpSuggest(input);
    }
    refreshSpecialHint(row);
    refreshSpecialSummary(row);
    markEmpty(row);
  }

  function showAddSuggest(input) {
    const box = input.parentNode.querySelector(".sp-suggest");
    if (!box) return;
    const heritage = rosterSuggest("heritage", input.value).map(function (entry) {
      return { kind: "heritage", entry: entry };
    });
    const steam = rosterSuggest("steam", input.value).map(function (entry) {
      return { kind: "steam", entry: entry };
    });
    const items = heritage.concat(steam).slice(0, 8);
    if (!items.length) {
      hideSpSuggest(input);
      return;
    }
    box._items = items;
    box._active = -1;
    box.classList.remove("sp-menu");
    box.innerHTML = items
      .map(function (pick, index) {
        return '<button type="button" tabindex="-1" data-add-pick="' + index + '">' + spSuggestLabel(pick.kind, pick.entry) + "</button>";
      })
      .join("");
    box.style.display = "block";
    placeSuggest(box, input);
  }

  function showAssistSuggest(input) {
    const box = input.parentNode.querySelector(".sp-suggest");
    if (!box) return;
    const items = rosterSuggest("heritage", input.value);
    const exact = items.length === 1 && unitKey(items[0].unit) === unitKey(input.value);
    if (!items.length || exact) {
      hideSpSuggest(input);
      return;
    }
    box._items = items;
    box._active = -1;
    box.classList.remove("sp-menu");
    box.innerHTML = items
      .map(function (entry, index) {
        return '<button type="button" tabindex="-1" data-assist-pick="' + index + '">' + spSuggestLabel("heritage", entry) + "</button>";
      })
      .join("");
    box.style.display = "block";
    placeSuggest(box, input);
  }

  function pickAssistSuggest(input, entry) {
    if (!input || !entry) return;
    input.value = entry.unit;
    hideSpSuggest(input);
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function specialSummary(row, kind) {
    const special = readSpecial(row);
    const parts =
      kind === "steam"
        ? special.steam.map(function (item) {
            return [item.engine, item.name].filter(Boolean).join(" ") || item.wheels;
          })
        : special.heritage.map(function (item) {
            return item.unit || item.scheme;
          });
    return parts.filter(Boolean).join(", ");
  }

  function refreshSpecialSummary(row) {
    row.querySelectorAll(".f-special-toggle[data-sp-toggle]").forEach(function (chip) {
      const out = chip.querySelector(".sp-summary");
      if (!out) return;
      const text = specialSummary(row, chip.getAttribute("data-sp-toggle"));
      out.textContent = text;
      out.hidden = !text;
    });
  }

  function setSpecialOpen(row, kind, on, focusAdd) {
    const chip = row.querySelector('.f-special-toggle[data-sp-toggle="' + kind + '"]');
    const block = row.querySelector('[data-sp-block="' + kind + '"]');
    const field = row.querySelector(".field-special");
    if (chip) {
      chip.classList.toggle("is-on", on);
      chip.setAttribute("aria-expanded", String(on));
    }
    if (block) block.hidden = !on;
    if (field) field.hidden = !row.querySelector(".sp-block:not([hidden])");
    if (on) {
      const list = block && block.querySelector(".sp-list");
      if (list && !list.querySelector(".sp-item")) addSpecialItem(row, kind, null, focusAdd);
    }
    refreshSpecialSummary(row);
  }

  function readSpecial(row) {
    const heritage = [];
    row.querySelectorAll('.sp-item[data-sp="heritage"]').forEach(function (item) {
      const unit = item.querySelector(".sp-unit").value.trim();
      const scheme = item.querySelector(".sp-scheme").value.trim();
      if (!unit && !scheme) return;
      heritage.push({
        unit: unit,
        scheme: scheme,
        era: item.querySelector(".sp-era").value,
        position: item.querySelector(".sp-pos").value,
      });
    });
    const steam = [];
    const engineOf = function (el) {
      const pick = el.querySelector(".sp-wheels").value;
      return {
        engine: el.querySelector(".sp-engine").value.trim(),
        name: el.querySelector(".sp-name").value.trim(),
        wheels: pick === "Other" ? el.querySelector(".sp-wheels-other").value.trim() : pick,
      };
    };
    const filled = function (one) {
      return Boolean(one.engine || one.name || one.wheels);
    };
    row.querySelectorAll('.sp-item[data-sp="steam"]:not(.sp-second)').forEach(function (item) {
      const first = engineOf(item);
      const secondBox = item.querySelector(".sp-second");
      const second = secondBox && item.querySelector(".sp-dh").checked ? engineOf(secondBox) : null;
      const pair = Boolean(second && filled(second));
      if (!filled(first) && !pair) return;
      const assisted = item.querySelector(".sp-assist").checked;
      const assist = [];
      if (assisted) {
        item.querySelectorAll(".sp-assist-input").forEach(function (input) {
          const unit = input.value.trim().toUpperCase();
          if (unit && assist.indexOf(unit) === -1) assist.push(unit);
        });
      }
      const lead = filled(first) ? first : second;
      const out = { engine: lead.engine, name: lead.name, wheels: lead.wheels, diesel_assist: assisted, assist: assist };
      if (pair && filled(first)) {
        out.doubleheader = true;
        steam.push(out, { engine: second.engine, name: second.name, wheels: second.wheels, diesel_assist: false, assist: [] });
      } else {
        steam.push(out);
      }
    });
    return { heritage: heritage, steam: steam };
  }

  function readSpecialWithUnits(row) {
    const special = readSpecial(row);
    const units = readConsistUnits(row);
    if (Object.keys(units).length) special.units = units;
    return special;
  }

  function fillSpecial(row, value) {
    row.querySelectorAll(".sp-list").forEach(function (list) {
      list.innerHTML = "";
    });
    const special = value || {};
    (special.heritage || []).forEach(function (item) {
      addSpecialItem(row, "heritage", item);
    });
    const steam = special.steam || [];
    for (let i = 0; i < steam.length; i += 1) {
      const pair = steam[i].doubleheader && steam[i + 1];
      addSpecialItem(row, "steam", pair ? Object.assign({}, steam[i], { second: steam[i + 1] }) : steam[i]);
      if (pair) i += 1;
    }
    const assisted = assistUnits(row).map(unitKey);
    row.querySelectorAll('.sp-item[data-sp="heritage"]').forEach(function (item) {
      if (item.querySelector(".sp-pos").value === "assist" && assisted.indexOf(unitKey(item.querySelector(".sp-unit").value)) !== -1) {
        item.setAttribute("data-assist-auto", "");
      }
    });
    syncAssistHeritage(row);
    renderConsistUnits(row, special.units || {}, true);
    setConsistOpen(row, Object.keys(special.units || {}).length > 0);
    markConsistHeritage(row);
    setSpecialOpen(row, "heritage", Boolean((special.heritage || []).length));
    setSpecialOpen(row, "steam", Boolean((special.steam || []).length));
    refreshSpecialHint(row);
  }

  function leadUnitOf(row) {
    const loco = row.querySelector(".f-loco");
    if (!loco || !loco.value.trim()) return "";
    const mark = typeof markOf === "function" ? markOf(row) : "";
    return ((mark ? mark + " " : "") + loco.value.trim()).trim();
  }

  function specialHas(row, kind, unit) {
    const key = unitKey(unit);
    const field = kind === "steam" ? ".sp-engine" : ".sp-unit";
    return Array.prototype.some.call(row.querySelectorAll('.sp-item[data-sp="' + kind + '"]:not([hidden]) ' + field), function (input) {
      return unitKey(input.value) === key;
    });
  }


  let seenBeforeTimer = null;
  function leadTextOf(row) {
    const mark = row.querySelector(".f-mark");
    const custom = row.querySelector(".f-mark-custom");
    const loco = row.querySelector(".f-loco");
    const road = mark && mark.value === "Other" ? ((custom && custom.value) || "").trim() : ((mark && mark.value) || "").trim();
    const num = ((loco && loco.value) || "").trim();
    return (road + " " + num).trim();
  }
  function paintSeenHint(el, info, kind) {
    if (!el) return;
    if (!info || !info.count) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    const when = info.last_date || "";
    const where = info.last_location || "";
    const times = info.count === 1 ? "once before" : info.count + " times before";
    el.hidden = false;
    el.textContent =
      (kind === "lead" ? "Seen this lead " : "Seen this symbol ") +
      times +
      (when ? " · last " + when : "") +
      (where ? " at " + where : "") +
      ".";
  }
  function refreshSeenBefore(row) {
    if (!row) return;
    const leadEl = row.querySelector('.seen-before-hint[data-seen="lead"]');
    const symEl = row.querySelector('.seen-before-hint[data-seen="symbol"]');
    const lead = leadTextOf(row);
    const symbolOn = row.querySelector(".f-symbol-toggle") && row.querySelector(".f-symbol-toggle").classList.contains("is-on");
    const symbol = symbolOn ? ((row.querySelector(".f-symbol") && row.querySelector(".f-symbol").value) || "").trim() : "";
    const entryId = row.getAttribute("data-id") || "";
    if (!lead && !symbol) {
      paintSeenHint(leadEl, null, "lead");
      paintSeenHint(symEl, null, "symbol");
      return;
    }
    const url =
      "/api/catalog/seen-before?lead=" +
      encodeURIComponent(lead) +
      "&symbol=" +
      encodeURIComponent(symbol) +
      (entryId ? "&exclude_id=" + encodeURIComponent(entryId) : "");
    api(url, { quiet: true }).then(function (result) {
      if (!result || !result.ok) return;
      const data = result.data || {};
      paintSeenHint(leadEl, data.lead, "lead");
      paintSeenHint(symEl, data.symbol, "symbol");
    });
  }
  function scheduleSeenBefore(row) {
    clearTimeout(seenBeforeTimer);
    seenBeforeTimer = setTimeout(function () {
      refreshSeenBefore(row);
    }, 280);
  }

  function refreshSpecialHint(row) {
    const hint = row.querySelector(".sp-hint");
    if (!hint) return;
    const unit = leadUnitOf(row);
    const heritage = rosterFind("heritage", unit);
    const steam = heritage ? null : rosterFind("steam", unit);
    const found = heritage || steam;
    const kind = heritage ? "heritage" : "steam";
    if (!found || specialHas(row, kind, found.unit || found.engine)) {
      hint.hidden = true;
      hint.removeAttribute("data-kind");
      return;
    }
    hint.hidden = false;
    hint.setAttribute("data-kind", kind);
    hint.textContent = heritage
      ? (found.unit + " is the " + found.scheme + " heritage unit. Add it")
      : (found.engine + (found.name ? " " + found.name : "") + " is a " + (found.wheels || "steam engine") + ". Add it");
  }

  function paintSpText(input) {
    if (!input || document.activeElement === input) return;
    const kinds = [
      ["sp-unit", "unit", "Unit"],
      ["sp-scheme", "scheme", "Scheme"],
      ["sp-engine", "engine", "Engine"],
      ["sp-name", "name", "Name"],
    ];
    const hit = kinds.filter(function (row) {
      return input.classList.contains(row[0]);
    })[0];
    if (!hit) return;
    const button = input.parentElement.querySelector('[data-edit="' + hit[1] + '"]');
    if (!button) return;
    const value = input.value.trim();
    button.textContent = value || (hit[0] === "sp-engine" ? input.getAttribute("aria-label") || hit[2] : hit[2]);
    button.classList.toggle("is-empty", !value);
    button.hidden = false;
    input.hidden = true;
  }

  function refreshSpDecode(item) {
    if (!item) return;
    item.querySelectorAll(".sp-unit, .sp-scheme, .sp-engine, .sp-name").forEach(paintSpText);
    const pos = item.querySelector(":scope > .sp-pos");
    if (pos) {
      const current = item.querySelector(":scope > .sp-chips [data-sp-pos-open]");
      if (current) {
        current.textContent = spPosLabel(pos.value);
        current.classList.toggle("is-on", Boolean(pos.value));
      }
      item.querySelectorAll(":scope > .sp-chips [data-sp-pos]").forEach(function (btn) {
        const on = btn.getAttribute("data-sp-pos") === pos.value;
        btn.classList.toggle("is-on", on);
        btn.setAttribute("aria-pressed", String(on));
      });
    }
    const dh = item.querySelector(":scope > .sp-chips .sp-dh");
    const assist = item.querySelector(":scope > .sp-chips .sp-assist");
    item.querySelectorAll(":scope > .sp-chips [data-sp-flag]").forEach(function (btn) {
      const box = btn.getAttribute("data-sp-flag") === "dh" ? dh : assist;
      const on = Boolean(box && box.checked);
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", String(on));
    });
    item.querySelectorAll(".sp-wheel-wrap").forEach(function (wrap) {
      const select = wrap.querySelector(".sp-wheels");
      const current = wrap.querySelector("[data-sp-wheels-open]");
      if (!select || !current) return;
      const other = wrap.querySelector(".sp-wheels-other");
      const value = select.value;
      const label = value === "Other" ? (other && other.value.trim()) || "Other" : value || "Wheels";
      current.textContent = label;
      current.classList.toggle("is-on", Boolean(value));
      wrap.querySelectorAll("[data-sp-wheel]").forEach(function (btn) {
        btn.classList.toggle("is-on", btn.getAttribute("data-sp-wheel") === value);
      });
    });
  }

  function applyRosterToItem(item, picked) {
    const kind = item.getAttribute("data-sp");
    if (kind === "heritage") {
      const unit = item.querySelector(".sp-unit").value;
      const found = rosterFind("heritage", unit);
      const row = item.closest(".train-row");
      if (row && unit.trim() && !item.querySelector(".sp-pos").value && unitKey(unit) === unitKey(leadUnitOf(row))) setSpPos(item, "lead");
      if (found) {
        const scheme = item.querySelector(".sp-scheme");
        if (picked || !scheme.value.trim()) scheme.value = found.scheme || "";
        setSpEra(item, found.era);
      }
      refreshSpBoard(item);
      refreshSpDecode(item);
      return;
    }
    const found = rosterFind("steam", item.querySelector(".sp-engine").value);
    if (found) {
      const name = item.querySelector(".sp-name");
      if (found.name && (picked || !name.value.trim())) name.value = found.name;
      const wheels = item.querySelector(".sp-wheels");
      if (found.wheels && (picked || !wheels.value)) {
        wheels.innerHTML = wheelOptions(found.wheels, "Wheel arrangement");
        const other = item.querySelector(".sp-wheels-other");
        other.hidden = wheels.value !== "Other";
        other.value = other.hidden ? "" : found.wheels;
      }
    }
    refreshSpBoard(item);
    refreshSpDecode(item);
  }

  function parseApiBody(text, contentType) {
    if ((contentType || "").includes("json")) {
      try {
        return JSON.parse(text || "{}");
      } catch (err) {
        return { error: text || "Request failed." };
      }
    }
    try {
      return JSON.parse(text);
    } catch (err) {
      return { error: (text || "").trim() || "Request failed." };
    }
  }

  async function api(path, options) {
    options = options || {};
    const work = options.work || null;
    const quiet = Boolean(options.quiet);
    if (options.work) delete options.work;
    if ("quiet" in options) delete options.quiet;
    let localTimer = null;
    let startedHere = false;
    if (work) {
      workStart(work.title || "Working…", { poll: Boolean(work.poll), total: work.total || 0 });
      startedHere = true;
    } else if (!quiet) {
      localTimer = setTimeout(function () {
        localTimer = null;
        startedHere = true;
        workStart("Working…");
      }, 400);
    }
    try {
      const response = await fetch(path, options);
      const text = await response.text();
      return {
        status: response.status,
        ok: response.ok,
        data: parseApiBody(text, response.headers.get("content-type") || ""),
      };
    } catch (err) {
      return { status: 0, ok: false, data: { error: (err && err.message) || "Network error." } };
    } finally {
      if (localTimer) clearTimeout(localTimer);
      if (startedHere) workDone();
    }
  }

  const DASH_PANES = {
    dashboard: "log",
    settings: "stations",
    stations: "stations",
    "station-book": "stations",
    control: "stations",
    gazetteer: "stations",
    "control-panel": "stations",
    import: "review",
    review: "review",
    activity: "activity",
    datacheck: "review",
  };

  function currentView() {
    const name = (location.hash || "#entry").replace("#", "") || "entry";
    if (DASH_PANES[name]) return "dashboard";
    return name;
  }

  function dashboardPane() {
    const name = (location.hash || "").replace("#", "");
    return DASH_PANES[name] || "log";
  }

  function setView(name) {
    if (currentView() !== name) {
      location.hash = name;
      return;
    }
    document.querySelectorAll(".view").forEach(function (view) {
      view.classList.toggle("is-active", view.id === "view-" + name);
    });
    document.querySelectorAll(".masthead .tab").forEach(function (tab) {
      tab.classList.toggle("is-active", tab.getAttribute("data-view") === name);
    });
    document.querySelectorAll(".foot-debug").forEach(function (link) {
      link.classList.toggle("is-active", name === "debug");
    });
    if (name === "debug" && window.trainLogDebug) window.trainLogDebug.refresh();
    if (name === "log") {
      loadLog();
      if (window.trainLogDashboard && window.trainLogDashboard.load) {
        window.trainLogDashboard.load({ quiet: true });
      }
    }
    if (name === "entry") loadDayLog();
    if (name === "dashboard") {
      if (window.trainLogDashboard && window.trainLogDashboard.load) {
        window.trainLogDashboard.load();
        window.trainLogDashboard.showPane(dashboardPane());
      }
      if (dashboardPane() === "review") loadPending();
    }
  }

  function railroadOptions(selected) {
    let html = '<option value="">Select</option>';
    RAILROAD_GROUPS.forEach(function (group) {
      if (!group.railroads || !group.railroads.length) return;
      html += '<optgroup label="' + group.label.replace(/"/g, "&quot;") + '">';
      group.railroads.forEach(function (name) {
        const meaning = RR_MEANINGS[name] || "";
        html +=
          '<option value="' +
          name +
          '"' +
          (name === selected ? " selected" : "") +
          (meaning ? ' title="' + meaning.replace(/"/g, "&quot;") + '"' : "") +
          ">" +
          name +
          "</option>";
      });
      html += "</optgroup>";
    });
    const isKnown = RAILROADS.indexOf(selected) !== -1;
    html +=
      '<option value="Other"' +
      (selected && !isKnown ? " selected" : "") +
      ">Other</option>";
    return html;
  }

  function passNoHtml(value, show) {
    return (
      '<label class="field-passno"' +
      (show ? "" : " hidden") +
      '><span>Train #</span><input class="f-passno" type="text" maxlength="10" autocomplete="off" spellcheck="false" aria-label="Passenger train number" title="Train number, like Amtrak 3 or Metrolink 203" value="' +
      escapeText(value || "") +
      '" /></label>'
    );
  }

  function typeChip(type, selected) {
    const on = selected.indexOf(type) !== -1 ? " is-on" : "";
    const meaning = TYPE_MEANINGS[type] || "";
    return (
      '<button type="button" class="chip' +
      on +
      '" data-type="' +
      type +
      '"' +
      (meaning ? ' title="' + meaning.replace(/"/g, "&quot;") + '"' : "") +
      ">" +
      type +
      "</button>"
    );
  }

  function coalHtml(mark, show) {
    return (
      '<span class="field-coal"' +
      (show ? "" : " hidden") +
      '><label><span>Mark</span><input class="f-coal-mark" type="text" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Coal car reporting mark" title="Reporting mark on the coal cars, up to 4 letters" value="' +
      escapeText(mark || "") +
      '" /></label></span>'
    );
  }

  function conHtml(show) {
    return (
      '<span class="field-con"' +
      (show ? "" : " hidden") +
      '><label><input class="f-con-overseas" type="checkbox" /> Overseas</label>' +
      '<label><input class="f-con-domestic" type="checkbox" /> Domestic</label></span>'
    );
  }

  function typeChips(selected) {
    selected = selected || [];
    return TRAIN_TYPES.filter(function (type) {
      return type !== "PASS";
    })
      .map(function (type) {
        const chip = typeChip(type, selected);
        if (type === "COAL") return chip + coalHtml("", selected.indexOf("COAL") !== -1);
        if (type === "CON") return '<span class="type-con">' + chip + conHtml(selected.indexOf("CON") !== -1) + "</span>";
        return chip;
      })
      .join("");
  }

  function coalOn(row) {
    return Boolean(row.querySelector('.chip.is-on[data-type="COAL"]'));
  }

  function syncCoal(row, focusBox) {
    const field = row.querySelector(".field-coal");
    if (!field) return;
    field.hidden = !coalOn(row);
    const box = field.querySelector(".f-coal-mark");
    if (!field.hidden && focusBox && box) box.focus();
  }

  function setCoal(row, mark) {
    const markBox = row.querySelector(".f-coal-mark");
    if (markBox) markBox.value = mark || "";
    syncCoal(row);
  }

  function conOn(row) {
    return Boolean(row.querySelector('.chip.is-on[data-type="CON"]'));
  }

  function syncCon(row) {
    const field = row.querySelector(".field-con");
    if (!field) return;
    const on = conOn(row);
    field.hidden = !on;
    if (!on) {
      field.querySelectorAll("input").forEach(function (box) {
        box.checked = false;
      });
    }
  }

  function setCon(row, overseas, domestic) {
    const over = row.querySelector(".f-con-overseas");
    const domesticBox = row.querySelector(".f-con-domestic");
    if (over) over.checked = Boolean(overseas);
    if (domesticBox) domesticBox.checked = Boolean(domestic);
    syncCon(row);
  }

  function clockHour(row) {
    const hh = Number(row.querySelector(".f-hh").value);
    const ampmBtn = row.querySelector(".f-ampm.is-on");
    if (!ampmBtn || !hh || hh < 1 || hh > 12) return null;
    const pm = ampmBtn.getAttribute("data-ampm") === "PM";
    if (!pm) return hh === 12 ? 0 : hh;
    return hh === 12 ? 12 : hh + 12;
  }

  const MEAN_DAYLIGHT = {AB:[388,1124],AK:[414,1164],AL:[342,1073],AR:[364,1095],AZ:[381,1112],BC:[365,1100],CA:[352,1084],CO:[356,1088],CT:[345,1077],DC:[362,1094],DE:[356,1088],FL:[385,1115],GA:[388,1119],HI:[381,1110],IA:[368,1100],ID:[392,1125],IL:[351,1083],IN:[399,1131],KS:[388,1119],KY:[395,1127],LA:[363,1093],MA:[341,1074],MB:[381,1116],MD:[361,1093],ME:[330,1064],MI:[395,1128],MN:[370,1104],MO:[364,1096],MS:[353,1084],MT:[371,1106],NC:[372,1103],ND:[395,1129],NE:[393,1125],NH:[340,1073],NJ:[353,1085],NM:[359,1090],NV:[340,1073],NY:[356,1089],OH:[385,1117],OK:[384,1116],ON:[371,1104],OR:[356,1089],PA:[365,1097],QC:[347,1081],RI:[340,1073],SC:[378,1109],SD:[394,1128],TN:[340,1071],TX:[392,1122],UT:[381,1113],VA:[370,1101],VT:[344,1077],WA:[354,1089],WI:[353,1087],WV:[377,1108],WY:[364,1097]};
  const MEAN_DAYLIGHT_US = [368, 1100];

  function clockMinutes(row) {
    const hour = clockHour(row);
    if (hour === null) return null;
    const raw = row.querySelector(".f-mm").value;
    const mm = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(mm) || mm < 0 || mm > 59) return null;
    return hour * 60 + mm;
  }

  function zoneOffset(zone, ymd) {
    const utc = new Date(ymd + "T12:00:00Z");
    const map = {};
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).formatToParts(utc).forEach(function (part) {
      if (part.type !== "literal") map[part.type] = part.value;
    });
    const local = Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), Number(map.hour) % 24, Number(map.minute));
    return Math.round((local - utc.getTime()) / 60000);
  }

  function zoneIsDST(zone, ymd) {
    if (!zone || !ymd || !window.Intl) return false;
    try {
      const jan = zoneOffset(zone, ymd.slice(0, 4) + "-01-15");
      const day = zoneOffset(zone, ymd);
      return day - jan >= 30;
    } catch (err) {
      return false;
    }
  }

  function daylightSpan(row) {
    const state = stateOf(row);
    const pair = (MEAN_DAYLIGHT[state] || MEAN_DAYLIGHT_US).slice();
    const picked = row.querySelector(".f-tz");
    const zone = (picked && picked.value) || stateZone(state) || deviceZone();
    const ymd = (dateEl && dateEl.value) || todayISO();
    if (zoneIsDST(zone, ymd)) {
      pair[0] += 60;
      pair[1] += 60;
    }
    return pair;
  }

  function dayNightFromClock(row) {
    const mins = clockMinutes(row);
    if (mins === null) return "";
    const span = daylightSpan(row);
    return mins >= span[0] && mins < span[1] ? "day" : "night";
  }

  function setDayNight(row, choice) {
    const day = row.querySelector(".f-day");
    const night = row.querySelector(".f-night");
    if (!day || !night) return;
    day.classList.toggle("is-on", choice === "day");
    night.classList.toggle("is-on", choice === "night");
  }

  function syncDayNight(row) {
    const group = row.querySelector(".daynight-group");
    const photo = row.querySelector(".f-photo");
    if (!group || !photo) return;
    const on = photo.classList.contains("is-on");
    group.hidden = !on;
    if (!on) {
      setDayNight(row, "");
      row._dayNightManual = false;
      return;
    }
    if (!row._dayNightManual) {
      const choice = dayNightFromClock(row);
      if (choice) setDayNight(row, choice);
    }
  }

  function followClockDayNight(row) {
    row._dayNightManual = false;
    syncDayNight(row);
  }

  const TAB_FLOW_GROUPS = [
    ".f-rr",
    ".f-rr-custom",
    ".f-mark",
    ".f-mark-custom",
    ".f-loco",
    ".f-hh",
    ".f-mm",
    ".f-ampm",
    ".f-c1",
    ".f-c2",
    ".f-c3",
    ".f-cars-a",
    ".f-cars-b",
    ".dir-group .chip, .dir-group input",
    ".type-group .chip, .type-group input",
    ".f-load-flags input",
    ".f-sub",
    ".f-sub-custom",
    ".f-loc",
    ".f-photo, .f-video, .f-day, .f-night",
    ".f-symbol-toggle",
    ".f-symbol",
    ".f-notes-toggle",
    ".field-notes button, .field-notes input, .field-notes textarea",
  ];
  const TAB_FLOW = TAB_FLOW_GROUPS.join(", ");

  function flowRank(el) {
    for (let i = 0; i < TAB_FLOW_GROUPS.length; i += 1) {
      if (el.matches(TAB_FLOW_GROUPS[i])) return i;
    }
    return TAB_FLOW_GROUPS.length;
  }

  const LEAD_STATUSES = [
    ["Missed", "Missed"],
    ["Hidden", "Hidden"],
    ["Too dark to see", "Too Dark"],
    ["Too far", "Too Far"],
    ["Weather", "Weather"],
  ];

  function leadStatusOf(row) {
    return Array.prototype.map
      .call(row.querySelectorAll("[data-lead-status]:checked"), function (box) {
        return box.getAttribute("data-lead-status");
      })
      .join(", ");
  }

  function setStopFlags(row, stopped, inSiding, crewChange, noCrew) {
    [[".f-stopped", stopped], [".f-siding", inSiding], [".f-crew", crewChange], [".f-no-crew", noCrew]].forEach(function (pair) {
      const box = row.querySelector(pair[0]);
      if (box) box.checked = Boolean(pair[1]);
    });
  }

  function dirCellHtml(entry) {
    const tags = [];
    if (entry.stopped) tags.push(["Stop", "Stopped"]);
    if (entry.in_siding) tags.push(["Siding", "In siding"]);
    if (entry.crew_change) tags.push(["Crew", "Crew change"]);
    if (entry.no_crew) tags.push(["No crew", "No crew"]);
    const dir = escapeText(entry.direction || "");
    if (!tags.length) return dir;
    const note =
      '<span class="sub-rr" title="' +
      escapeText(tags.map(function (tag) { return tag[1]; }).join(", ")) +
      '">' +
      tags.map(function (tag) { return escapeText(tag[0]); }).join(" · ") +
      "</span>";
    return dir ? '<span class="sub-name">' + dir + "</span>" + note : note;
  }

  function setLeadStatus(row, value, keepNumber) {
    const loco = row.querySelector(".f-loco");
    const boxes = row.querySelectorAll("[data-lead-status]");
    if (!boxes.length) return;
    const chosen = String(value || "").split(/\s*,\s*/).filter(Boolean);
    boxes.forEach(function (box) {
      box.checked = chosen.indexOf(box.getAttribute("data-lead-status")) !== -1;
    });
    const status = leadStatusOf(row);
    if (status && !keepNumber) loco.value = "";
    loco.disabled = Boolean(status) && !loco.value;
    row.querySelector(".lead-stack").classList.toggle("has-status", Boolean(status));
  }

  function stepNumber(box, by) {
    if (!box || box.disabled || box.readOnly) return;
    const text = String(box.value || "").trim();
    const limit = box.maxLength > 0 ? box.maxLength : 7;
    const max = Math.pow(10, limit) - 1;
    const now = text === "" ? (by > 0 ? 0 : 1) : Number(text.replace(/[^\d.]/g, "")) || 0;
    const next = Math.max(0, Math.min(max, Math.floor(now) + by));
    let value = String(next);
    if (/^0\d/.test(text) && value.length < text.length) value = value.padStart(text.length, "0");
    box.value = value;
    box.dispatchEvent(new Event("input", { bubbles: true }));
    box.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function keepOnly(box, clean) {
    const before = box.value;
    const after = clean(before);
    if (after === before) return;
    const caret = box.selectionStart == null ? after.length : clean(before.slice(0, box.selectionStart)).length;
    box.value = after;
    try {
      box.setSelectionRange(caret, caret);
    } catch (err) {}
  }

  document.addEventListener(
    "input",
    function (event) {
      const box = event.target;
      if (event.isComposing || !box.matches) return;
      if (box.matches('input[data-num][inputmode="numeric"]')) {
        keepOnly(box, function (text) {
          return text.replace(/\D+/g, "");
        });
      } else if (box.matches("input.cu-unit")) {
        keepOnly(box, function (text) {
          return text.toUpperCase().replace(/[^A-Z0-9 ]+/g, "").replace(/ {2,}/g, " ").replace(/^ /, "");
        });
      }
    },
    true
  );

  if (!window.trainLogField) {
    document.addEventListener("mousedown", function (event) {
      if (event.target.closest && event.target.closest("[data-num-step]")) event.preventDefault();
    });
    document.addEventListener("click", function (event) {
      const btn = event.target.closest && event.target.closest("[data-num-step]");
      if (!btn) return;
      const box = btn.closest(".num-wrap").querySelector("input");
      stepNumber(box, Number(btn.getAttribute("data-num-step")));
      box.focus();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      const box = event.target;
      if (!box.matches || !box.matches("input[data-num]")) return;
      event.preventDefault();
      stepNumber(box, event.key === "ArrowUp" ? 1 : -1);
    });
  }

  function numBox(cls, label) {
    const box =
      '<input class="' + cls + '" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-num' +
      (label ? ' aria-label="' + label + '"' : "") +
      " />";
    if (window.trainLogField) return box;
    return (
      '<span class="num-wrap">' + box +
      '<span class="num-arrows" aria-hidden="true">' +
      '<button type="button" tabindex="-1" data-num-step="1" title="Up one">▴</button>' +
      '<button type="button" tabindex="-1" data-num-step="-1" title="Down one">▾</button>' +
      "</span></span>"
    );
  }

  function passChipHtml(selected, passNo) {
    selected = selected || [];
    if (TRAIN_TYPES.indexOf("PASS") === -1) return "";
    return typeChip("PASS", selected) + passNoHtml(passNo, selected.indexOf("PASS") !== -1);
  }

  function typeGroupHtml(selected, passNo) {
    const extras = (selected || []).filter(function (type) {
      return TRAIN_TYPES.indexOf(type) === -1;
    });
    return (
      passChipHtml(selected, passNo) +
      typeChips(selected) +
      '<button type="button" class="chip f-type-other' +
      (extras.length ? " is-on" : "") +
      '">Other</button>' +
      '<input class="f-type-custom" type="text"' +
      (extras.length ? "" : " hidden") +
      ' value="' +
      escapeText(extras.join("/")) +
      '" />'
    );
  }

  function passOn(row) {
    return Boolean(row.querySelector('.chip.is-on[data-type="PASS"]'));
  }

  function syncPassNo(row, focusBox) {
    const field = row.querySelector(".field-passno");
    if (!field) return;
    field.hidden = !passOn(row);
    const box = field.querySelector(".f-passno");
    if (!field.hidden && focusBox && box) box.focus();
  }

  function setPassNo(row, value) {
    const box = row.querySelector(".f-passno");
    if (box) box.value = value;
    syncPassNo(row);
  }

  function setTrainInfo(row, text, unlisted) {
    const el = row.querySelector(".f-train-info");
    if (!el) return;
    el.textContent = text || "";
    el.title = text ? text + "\n\nFilled in from the symbol and Train #. Saved with the train, apart from your notes." : "";
    el.hidden = !text;
    el.classList.toggle("is-unlisted", Boolean(text && unlisted));
  }

  function trainInfoOf(row) {
    const el = row.querySelector(".f-train-info");
    return el && !el.hidden ? el.textContent : "";
  }

  function refreshDecode(row) {
    window.clearTimeout(row._decodeTimer);
    row._decodeTimer = window.setTimeout(async function () {
      const railroad = railroadOf(row);
      const symbolOn = row.querySelector(".f-symbol-toggle").classList.contains("is-on");
      const symbol = symbolOn ? cleanSymbol(row.querySelector(".f-symbol").value) : "";
      const passBox = row.querySelector(".f-passno");
      const number = passOn(row) && passBox ? cleanSymbol(passBox.value) : "";
      const token = (row._decodeToken || 0) + 1;
      row._decodeToken = token;
      let found = { symbol: null, train_number: null };
      if (railroad && (symbol || number)) {
        const query = new URLSearchParams({ railroad: railroad, symbol: symbol, train_number: number });
        try {
          const res = await fetch("/api/reference/decode?" + query.toString());
          if (res.ok) found = await res.json();
        } catch (err) {
          found = { symbol: null, train_number: null };
        }
      }
      if (row._decodeToken !== token) return;
      const parts = [found.symbol, found.train_number].filter(function (info) {
        return info && info.text;
      });
      let text = parts
        .map(function (info) {
          return info.text;
        })
        .join(" — ");
      const stored = row._storedInfo;
      if (!text && stored && stored.text && (symbol || number) && stored.symbol === symbol && stored.number === number) {
        text = stored.text;
      }
      setTrainInfo(
        row,
        text,
        parts.length > 0 &&
          parts.every(function (info) {
            return info.listed === false;
          })
      );
      markSuggested(row, found.symbol);
    }, 200);
  }

  function markSuggested(row, info) {
    const types = (info && info.types) || [];
    const loads = (info && info.loads) || "";
    row.querySelectorAll(".chip[data-type]").forEach(function (chip) {
      const on = types.indexOf(chip.getAttribute("data-type")) !== -1;
      chip.classList.toggle("is-suggested", on);
      if (on) chip.setAttribute("aria-description", "Suggested from the symbol");
      else chip.removeAttribute("aria-description");
    });
    row.querySelectorAll("[data-load]").forEach(function (box) {
      const on = box.getAttribute("data-load") === loads;
      box.closest("label").classList.toggle("is-suggested", on);
    });
  }


  function readPadDefaultsData() {
    try {
      return (window.__padDefaults && window.__padDefaults()) || JSON.parse(localStorage.getItem("rr-pad-defaults") || "{}") || {};
    } catch (e) {
      return {};
    }
  }

  function writePadDefaultsData(data) {
    try {
      localStorage.setItem("rr-pad-defaults", JSON.stringify(data || {}));
    } catch (e) {}
  }

  function padBlankCount() {
    const n = Number(readPadDefaultsData().blankCards) || 1;
    return n >= 3 ? 3 : n >= 2 ? 2 : 1;
  }

  function setPadBlankCount(n) {
    const data = readPadDefaultsData();
    data.blankCards = n >= 3 ? 3 : n >= 2 ? 2 : 1;
    writePadDefaultsData(data);
    return data.blankCards;
  }

  function syncPadCardRemoveButtons() {
    if (!rowsEl) return;
    const rows = rowsEl.querySelectorAll(".train-row");
    const multi = rows.length > 1;
    rows.forEach(function (row) {
      const btn = row.querySelector(".row-remove");
      if (btn) btn.hidden = !multi;
    });
  }

  async function addPadEntryCard() {
    if (!rowsEl) return;
    const have = rowsEl.querySelectorAll(".train-row").length;
    if (have >= 3) {
      if (window.trainLog && window.trainLog.banner) window.trainLog.banner("Three entry cards is the max.", "warn");
      return;
    }
    setPadBlankCount(have + 1);
    await ensurePadBlankRows();
    syncPadCardRemoveButtons();
    const rows = rowsEl.querySelectorAll(".train-row");
    const last = rows[rows.length - 1];
    if (last) {
      last.scrollIntoView({ block: "nearest", behavior: "smooth" });
      const focus = last.querySelector(".f-rr") || last.querySelector("input, select, button");
      if (focus && focus.focus) focus.focus();
    }
  }

  async function removePadEntryCard(row) {
    if (!rowsEl || !row) return;
    const rows = rowsEl.querySelectorAll(".train-row");
    if (rows.length <= 1) return;
    if (rowIsFilled(readRow(row, false)) || rowHasClip(row)) {
      const ok = window.askConfirm
        ? await window.askConfirm({
            title: "Remove this entry card?",
            message: "What you typed on this card will be discarded. It is not a logged train.",
          })
        : window.confirm("Remove this entry card? What you typed will be discarded.");
      if (!ok) return;
    }
    row.remove();
    setPadBlankCount(rowsEl.querySelectorAll(".train-row").length);
    relabelRows();
    syncPadCardRemoveButtons();
    saveEntryDraft();
  }

  function tripOwnsPlace() {
    const name = tripEl && String(tripEl.value || "").trim();
    if (!name || typeof tripDetailsOf !== "function") return false;
    const details = tripDetailsOf(name);
    const defaults = details && details.logging_defaults;
    return Boolean(defaults && defaults.hotspots && defaults.hotspots.length);
  }

  function tripLoggingDefaults() {
    const name = tripEl && String(tripEl.value || "").trim();
    if (!name || typeof tripDetailsOf !== "function") return null;
    const details = tripDetailsOf(name);
    return (details && details.logging_defaults) || null;
  }

  function rememberPadFromEntry(entry) {
    if (!entry) return;
    const data = readPadDefaultsData();
    if (entry.railroad) data.lastRailroad = String(entry.railroad).trim();
    // Direction is not a pad default — do not remember it.
    if (data.directionMode) delete data.directionMode;
    if (data.direction) delete data.direction;
    if (data.lastDirection) delete data.lastDirection;
    writePadDefaultsData(data);
  }

  function applyPadDirection(row, direction) {
    if (!row || !direction) return;
    const on = row.querySelector("[data-dir].is-on");
    if (on) return;
    row.querySelectorAll("[data-dir]").forEach(function (btn) {
      btn.classList.toggle("is-on", btn.getAttribute("data-dir") === direction);
    });
  }

  function applyPadTrainType(row, type) {
    if (!row || !type) return;
    if (selectedTypes(row).length) return;
    const chip = row.querySelector('.chip[data-type="' + type.replace(/"/g, "") + '"]');
    if (chip) {
      chip.classList.add("is-on");
      dropInvalid(row.querySelector(".type-group"));
    }
  }

  function applyPadDefaultsToRow(row) {
    if (!row) return;
    const data = readPadDefaultsData();
    const rrMode = data.railroadMode || (data.railroad ? "fixed" : "none");
    const emptyRow = !rowIsFilled(readRow(row, false)) && !rowHasClip(row);
    let rr = "";
    if (rrMode === "fixed") rr = String(data.railroad || "").trim();
    else if (rrMode === "last") rr = String(data.lastRailroad || data.railroad || "").trim();
    const select = row.querySelector(".f-rr");
    const custom = row.querySelector(".f-rr-custom");
    // Fixed/last railroad must land on blank cards even after Clear / Submit.
    if (rr && select && (emptyRow || !select.value)) {
      if (typeof setSelectValue === "function") setSelectValue(select, custom, rr);
      else {
        select.value = rr;
        if (custom) {
          custom.hidden = true;
          custom.value = "";
        }
      }
      select.dataset.prev = select.value;
      if (typeof fillMarkSelect === "function") fillMarkSelect(row, markOf(row));
      if (typeof fillSubSelect === "function" && emptyRow) fillSubSelect(row, subOf(row) || "");
    }
    // Direction is per train — never preset from Pad Defaults.
    applyPadTrainType(row, String(data.trainType || "").trim());
    if (data.timeMode === "now") {
      const hh = row.querySelector(".f-hh");
      if (hh && !String(hh.value || "").trim() && !String((row.querySelector(".f-mm") || {}).value || "").trim()) {
        fillNow(row);
      }
    }
    if (!tripOwnsPlace() && locationFieldsBlank(row)) {
      const sub = String(data.homeSubdivision || "").trim();
      const other = String(data.homeLocationOther || "").trim();
      const station = String(data.homeStation || data.homeLocation || "").trim();
      const loc = other || station;
      const state = String(data.homeState || "").trim();
      if (sub || loc || state) {
        if (sub && typeof fillSubSelect === "function") fillSubSelect(row, sub);
        const locEl = row.querySelector(".f-loc");
        if (locEl && loc) locEl.value = loc;
        if (state && typeof applyRowState === "function") applyRowState(row, state);
      }
    }
    markEmpty(row);
  }

  async function reseedBlankRow(row) {
    if (!row) return;
    applyPadDefaultsToRow(row);
    const defaults = tripLoggingDefaults();
    if (defaults && (defaults.railroad || (defaults.hotspots && defaults.hotspots.length))) {
      await applyLoggingDefaultsToRow(row, { defaults: defaults, onlyEmpty: true });
    }
  }

  async function ensurePadBlankRows() {
    if (!rowsEl) return;
    const want = padBlankCount();
    while (rowsEl.querySelectorAll(".train-row").length < want) {
      entryRowAt(rowsEl.querySelectorAll(".train-row").length);
    }
    // Drop trailing empty extras beyond want only when all trailing are empty
    let rows = Array.prototype.slice.call(rowsEl.querySelectorAll(".train-row"));
    while (rows.length > want) {
      const last = rows[rows.length - 1];
      if (rowIsFilled(readRow(last, false)) || rowHasClip(last)) break;
      last.remove();
      rows.pop();
    }
    const empties = Array.prototype.filter.call(rowsEl.querySelectorAll(".train-row"), function (row) {
      return !rowIsFilled(readRow(row, false)) && !rowHasClip(row);
    });
    for (let i = 0; i < empties.length; i += 1) {
      await reseedBlankRow(empties[i]);
    }
    relabelRows();
    syncPadCardRemoveButtons();
  }
  function rowTemplate(index) {
    return (
      '<article class="train-row is-empty" data-row="' +
      index +
      '">' +
      '<div class="row-top"><span class="row-index">New entry</span>' +
      '<span class="row-top-actions">' +
      '<button type="button" class="btn tiny ghost row-clear">Clear</button>' +
      '<button type="button" class="btn tiny ghost row-remove" hidden title="Remove this entry card">Remove</button>' +
      "</span></div>" +
      '<div class="row-grid">' +
      '<label class="field-rr"><span>Railroad</span><select class="f-rr">' +
      railroadOptions("") +
      "</select>" +
      '<input class="f-rr-custom" type="text" hidden /></label>' +
      '<label class="lead-stack"><span>Lead loco</span>' +
      '<div class="lead-fields">' +
      '<select class="f-mark"><option value="">Select</option></select>' +
      numBox("f-loco", "Lead loco number") +
      '<span class="f-lead-status" role="group" aria-label="Couldn\'t read the number" title="Tick any that apply when you couldn\'t read the lead loco\'s number">' +
      LEAD_STATUSES.map(function (pair) {
        return '<label><input type="checkbox" data-lead-status="' + pair[0] + '" autocomplete="off" />' + pair[1] + "</label>";
      }).join("") +
      "</span>" +
      "</div>" +
      '<input class="f-mark-custom" type="text" hidden />' +
      '<p class="seen-before-hint muted" data-seen="lead" hidden></p>' +
      "</label>" +
      '<div class="power-block">' +
      '<div class="field-consist"><span>Consist (units x DP)</span><div class="consist">' +
      numBox("f-c1", "Units on the head end") +
      '<span class="x">x</span>' +
      numBox("f-c2", "Mid-train units") +
      '<span class="x">x</span>' +
      numBox("f-c3", "Units on the rear") +
      "</div>" +
      '<div class="consist-units" hidden></div>' +
      "</div>" +
      '<div class="power-split" aria-hidden="true"></div>' +
      '<div class="field-cars"><span>Cars</span><div class="car-fields">' +
      numBox("f-cars-a", "Cars") +
      '<span class="x">/</span>' +
      numBox("f-cars-b", "Cars, second count") +
      "</div></div>" +
      "</div>" +
      '<div class="field-time"><span>Time</span><div class="time-fields">' +
      '<input class="f-hh" type="number" min="1" max="12" />' +
      "<span class=\"x\">:</span>" +
      '<input class="f-mm" type="number" min="0" max="59" />' +
      '<div class="ampm-group" role="group" aria-label="AM or PM">' +
      '<button type="button" class="seg f-ampm" data-ampm="AM">AM</button>' +
      '<button type="button" class="seg f-ampm" data-ampm="PM">PM</button>' +
      "</div>" +
      '<button type="button" class="seg f-now" title="Fill in today\'s date and the time right now"' +
      (window.trainLogField ? "" : " hidden") +
      ">Now</button>" +
      '<div class="tz-pick"><button type="button" class="tz-btn" aria-haspopup="listbox" aria-label="Time zone" title="Time zone for this sighting. Guessed from the location. Click to change it.">' +
      TZ_ICON + '</button>' +
      '<select class="f-tz" tabindex="-1" aria-hidden="true"></select>' +
      '<span class="tz-flag f-tz-flag" hidden></span></div>' +
      "</div></div>" +
      '<div class="field-types">' +
      '<div class="field-dir"><span>Direction</span><div class="dir-group" role="group" aria-label="Direction">' +
      '<span class="dir-chips">' +
      '<button type="button" class="chip" data-dir="North">North</button>' +
      '<button type="button" class="chip" data-dir="South">South</button>' +
      '<button type="button" class="chip" data-dir="East">East</button>' +
      '<button type="button" class="chip" data-dir="West">West</button>' +
      "</span>" +
      '<span class="media-sep" aria-hidden="true"></span>' +
      '<span class="f-stop-flags" role="group" aria-label="Stopped, in a siding, crew change, or no crew onboard" title="Tick any that apply, with or without a direction">' +
      '<label><input type="checkbox" class="f-stopped" />Stopped</label>' +
      '<label><input type="checkbox" class="f-siding" />In Siding</label>' +
      '<label><input type="checkbox" class="f-crew" />Crew Change</label>' +
      '<label><input type="checkbox" class="f-no-crew" />No Crew</label>' +
      "</span>" +
      "</div></div>" +
      '<div class="type-head"><span>Train Type</span></div>' +
      '<div class="type-group">' +
      '<span class="type-chips">' +
      typeGroupHtml([], "") +
      "</span>" +
      '<span class="f-load-flags" role="group" aria-label="Loads or Empties" title="Tick one, both, or neither">' +
      '<label><input type="checkbox" data-load="Loads" />Loads</label>' +
      '<label><input type="checkbox" data-load="Empties" />Empties</label>' +
      "</span></div></div>" +
      "</div>" +
      '<div class="row-grid-2">' +
      '<label class="field-sub"><span>Subdivision</span><select class="f-sub">' +
      '<option value="">Select</option><option value="Other">Other</option>' +
      "</select>" +
      '<input class="f-sub-custom" type="text" hidden /></label>' +
      '<label class="autocomplete field-loc"><span>Location</span>' +
      '<div class="loc-fields"><input class="f-loc" type="text" aria-label="Location" />' +
      '<select class="f-state" aria-label="State" title="State where you saw the train. Picking a station fills it in and sets the time zone."></select></div>' +
      '<div class="suggest"></div></label>' +
      "</div>" +
      '<div class="field-media"><div class="media-head"><span class="pad-head">Media <span class="head-sep" aria-hidden="true"></span> Symbol <span class="head-sep" aria-hidden="true"></span> Notes</span>' +
      '<div class="f-train-info" hidden></div></div><div class="media-row">' +
      '<div class="media-group">' +
      '<button type="button" class="chip f-photo">Photo</button>' +
      '<button type="button" class="chip f-video">Video</button>' +
      '<div class="daynight-group" role="group" aria-label="Day or night photo" hidden>' +
      '<button type="button" class="seg f-day" title="Day" aria-label="Day">' + SUN_ICON + "</button>" +
      '<button type="button" class="seg f-night" title="Night" aria-label="Night">' + MOON_ICON + "</button>" +
      "</div>" +
      "</div>" +
      '<span class="media-sep" aria-hidden="true"></span>' +
      '<div class="media-pair">' +
      '<button type="button" class="chip f-symbol-toggle">Symbol</button>' +
      '<label class="field-symbol" hidden><input class="f-symbol" type="text" autocomplete="off" spellcheck="false" aria-label="Train symbol" title="Letters, numbers, and hyphens" /></label>' +
      '<p class="seen-before-hint muted" data-seen="symbol" hidden></p>' +
      "</div>" +
      '<span class="media-sep" aria-hidden="true"></span>' +
      '<div class="media-pair">' +
      '<button type="button" class="chip f-notes-toggle">Notes</button>' +
      '<div class="field-notes" hidden>' +
      '<textarea class="f-notes" rows="1" aria-label="Notes"></textarea>' +
      "</div></div>" +
      "</div>" +
      "</div>" +
      '<div class="field-record"><div class="record-card">' +
      '<button type="button" class="record-go f-record" title="Film the train and stamp the time">' +
      '<span class="record-icon" aria-hidden="true"></span>Record</button>' +
      '<p class="record-note">Films until Stop (max 10 min). Stamps time when you start. Clip stays on this card only.</p>' +
      '<div class="entry-clip" hidden>' +
      '<video class="entry-clip-video" playsinline></video>' +
      '<div class="entry-clip-bar">' +
      '<span class="entry-clip-time"></span>' +
      '<button type="button" class="btn" data-clip-stop hidden>Stop</button>' +
      '<button type="button" class="btn" data-clip-delete hidden>Delete</button>' +
      "</div></div></div></div>" +
      '<div class="field-heritage"><div class="media-head sp-toggles">' +
      '<button type="button" class="sp-section-toggle f-special-toggle" data-sp-toggle="heritage" aria-expanded="false" title="Show heritage units">' +
      '<span class="sp-caret" aria-hidden="true"></span>Heritage Units<span class="sp-summary" hidden></span></button>' +
      '<button type="button" class="sp-section-toggle f-special-toggle" data-sp-toggle="steam" aria-expanded="false" title="Show steam engines">' +
      '<span class="sp-caret" aria-hidden="true"></span>Steam Specials<span class="sp-summary" hidden></span></button>' +
      '<button type="button" class="sp-hint" hidden></button>' +
      "</div></div>" +
      specialPanelHtml() +
      "</article>"
    );
  }

  function clipStore() {
    return new Promise(function (resolve, reject) {
      const open = indexedDB.open("rr-entry-clip", 1);
      open.onupgradeneeded = function () {
        if (!open.result.objectStoreNames.contains("clips")) open.result.createObjectStore("clips");
      };
      open.onsuccess = function () { resolve(open.result); };
      open.onerror = function () { reject(open.error); };
    });
  }

  function saveEntryClip(file) {
    return clipStore().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction("clips", "readwrite");
        tx.objectStore("clips").put(file, "hold");
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function stopEntryClipTracks(row) {
    const stream = row._clipStream;
    if (stream) stream.getTracks().forEach(function (track) { track.stop(); });
    row._clipStream = null;
  }

  function showEntryPlayback(row, file, persist) {
    const box = row.querySelector(".entry-clip");
    const video = box.querySelector("video");
    if (row._clipUrl) URL.revokeObjectURL(row._clipUrl);
    row._clipUrl = URL.createObjectURL(file);
    row._clipFile = file;
    video.srcObject = null;
    video.muted = false;
    video.controls = true;
    video.src = row._clipUrl;
    box.hidden = false;
    box.querySelector("[data-clip-stop]").hidden = true;
    box.querySelector("[data-clip-delete]").hidden = false;
    box.querySelector(".entry-clip-time").textContent = "Kept until you delete it or save the train.";
    const go = row.querySelector(".f-record");
    if (go) go.classList.remove("is-on");
    if (persist !== false) saveEntryClip(file);
  }

  function rowHasClip(row) {
    if (!row) return false;
    if (row._clipFile) return true;
    if (row._clipRecorder && row._clipRecorder.state === "recording") return true;
    const box = row.querySelector(".entry-clip");
    return Boolean(box && !box.hidden);
  }

  function stopLiveRecordings() {
    const waits = [];
    if (!rowsEl) return Promise.resolve();
    Array.prototype.forEach.call(rowsEl.querySelectorAll(".train-row"), function (row) {
      const recorder = row._clipRecorder;
      if (!recorder || recorder.state !== "recording") return;
      waits.push(new Promise(function (resolve) {
        const done = recorder.onstop;
        recorder.onstop = function (event) {
          try { if (done) done.call(recorder, event); } catch (err) { /* still release the save */ }
          resolve();
        };
        try { recorder.stop(); } catch (err) { resolve(); }
      }));
    });
    return Promise.all(waits);
  }

  function flushLiveClips() {
    if (!rowsEl) return;
    Array.prototype.forEach.call(rowsEl.querySelectorAll(".train-row"), function (row) {
      const recorder = row._clipRecorder;
      if (!recorder || recorder.state !== "recording") return;
      const chunks = row._clipChunks || [];
      const type = recorder.mimeType || "video/mp4";
      if (chunks.length) {
        const ext = type.indexOf("webm") === -1 ? "mp4" : "webm";
        saveEntryClip(new File([new Blob(chunks, { type: type })], "train." + ext, { type: type }));
      }
      try { recorder.requestData(); } catch (err) { /* the stop below still writes what it has */ }
      try { recorder.stop(); } catch (err) { /* already stopping */ }
    });
  }

  function parkEntryCard() {
    const rows = [];
    let clip = false;
    if (rowsEl) {
      Array.prototype.forEach.call(rowsEl.querySelectorAll(".train-row"), function (row) {
        const payload = readRow(row, false);
        if (rowHasClip(row)) clip = true;
        if (rowIsFilled(payload) || rowHasClip(row)) rows.push(payload);
      });
    }
    return {
      date: dateEl ? dateEl.value : "",
      trip: readSessionTrip(),
      rows: rows,
      clip: clip,
    };
  }

  function collapseEntryForEdit() {
    if (!rowsEl) return;
    Array.prototype.slice.call(rowsEl.querySelectorAll(".train-row"), 1).forEach(function (row) {
      row.remove();
    });
    const row = rowsEl.querySelector(".train-row");
    if (row) resetEntryClip(row);
    relabelRows();
  }

  function restoreEntryCard(card) {
    if (!card || !rowsEl) return;
    if (dateEl && card.date) dateEl.value = card.date;
    if (card.trip) writeSessionTrip(card.trip);
    Array.prototype.slice.call(rowsEl.querySelectorAll(".train-row"), 1).forEach(function (row) {
      row.remove();
    });
    const list = card.rows && card.rows.length ? card.rows : [null];
    list.forEach(function (entry, index) {
      const row = entryRowAt(index);
      if (entry) fillRow(row, entry);
      else clearRow(row);
    });
    relabelRows();
    if (card.clip) restoreHeldClip();
  }

  function entryRowForNewTrain() {
    const rows = rowsEl.querySelectorAll(".train-row");
    for (let i = 0; i < rows.length; i += 1) {
      if (!rowIsFilled(readRow(rows[i], false)) && !rowHasClip(rows[i])) return rows[i];
    }
    return entryRowAt(rows.length);
  }

  function startEntryClip(row) {
    if (row._clipFile || (row._clipRecorder && row._clipRecorder.state === "recording")) return;
    const box = row.querySelector(".entry-clip");
    const video = box.querySelector("video");
    const note = box.querySelector(".entry-clip-time");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      const help = row.querySelector(".record-note");
      if (help) help.textContent = "This browser can't open the camera from the entry. Allow the camera for this page, or film with another device.";
      return;
    }
    box.hidden = false;
    fillNow(row);
    row.querySelector(".f-video").classList.add("is-on");
    row.querySelector(".f-record").classList.add("is-on");
    note.textContent = "Opening the camera…";
    box.querySelector("[data-clip-stop]").hidden = false;
    box.querySelector("[data-clip-delete]").hidden = true;
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }
    }).then(function (stream) {
      row._clipStream = stream;
      video.controls = false;
      video.muted = true;
      video.srcObject = stream;
      video.play().catch(function () {});
      row._clipChunks = [];
      let mime = "";
      if (window.MediaRecorder.isTypeSupported("video/mp4")) mime = "video/mp4";
      else if (window.MediaRecorder.isTypeSupported("video/webm")) mime = "video/webm";
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      row._clipRecorder = recorder;
      recorder.ondataavailable = function (event) {
        if (event.data && event.data.size) row._clipChunks.push(event.data);
      };
      recorder.onstop = function () {
        const type = recorder.mimeType || mime || "video/mp4";
        const ext = type.indexOf("webm") === -1 ? "mp4" : "webm";
        const chunks = row._clipChunks || [];
        row._clipChunks = [];
        window.clearTimeout(row._clipTimer);
        window.clearInterval(row._clipTick);
        row._clipRecorder = null;
        stopEntryClipTracks(row);
        if (row._clipDiscard) {
          row._clipDiscard = false;
          forgetHeldClip();
          resetEntryClip(row);
          return;
        }
        if (!chunks.length) return;
        showEntryPlayback(row, new File([new Blob(chunks, { type: type })], "train." + ext, { type: type }));
      };
      recorder.start(1000);
      const started = Date.now();
      note.textContent = "Recording. Set the phone down, then tap Stop.";
      row._clipTimer = window.setTimeout(function () {
        if (row._clipRecorder && row._clipRecorder.state === "recording") row._clipRecorder.stop();
      }, 600000);
      row._clipTick = window.setInterval(function () {
        if (!row._clipRecorder || row._clipRecorder.state !== "recording") {
          window.clearInterval(row._clipTick);
          return;
        }
        const sec = Math.floor((Date.now() - started) / 1000);
        note.textContent = "Recording " + Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0") + ". Stops at 10:00.";
      }, 500);
    }).catch(function () {
      row.querySelector(".f-record").classList.remove("is-on");
      box.hidden = true;
      box.querySelector("[data-clip-stop]").hidden = true;
      const help = row.querySelector(".record-note");
      if (help) help.textContent = "The camera didn't open. Allow the camera for this page.";
    });
  }

  function stopEntryClip(row) {
    window.clearTimeout(row._clipTimer);
    window.clearInterval(row._clipTick);
    if (row._clipRecorder && row._clipRecorder.state === "recording") row._clipRecorder.stop();
    else {
      stopEntryClipTracks(row);
      row.querySelector(".f-record").classList.remove("is-on");
    }
  }

  function forgetHeldClip() {
    return clipStore().then(function (db) {
      return new Promise(function (resolve) {
        const tx = db.transaction("clips", "readwrite");
        tx.objectStore("clips").delete("hold");
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { resolve(); };
      });
    }).catch(function () {});
  }

  function resetEntryClip(row) {
    const box = row.querySelector(".entry-clip");
    const video = box && box.querySelector("video");
    if (row._clipUrl) URL.revokeObjectURL(row._clipUrl);
    row._clipUrl = "";
    row._clipFile = null;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.srcObject = null;
      video.load();
    }
    if (box) {
      box.hidden = true;
      box.querySelector("[data-clip-stop]").hidden = true;
      box.querySelector("[data-clip-delete]").hidden = true;
      box.querySelector(".entry-clip-time").textContent = "";
    }
    const go = row.querySelector(".f-record");
    if (go) go.classList.remove("is-on");
  }

  function deleteEntryClip(row) {
    row._clipDiscard = true;
    if (row._clipRecorder && row._clipRecorder.state === "recording") {
      stopEntryClip(row);
      return;
    }
    row._clipDiscard = false;
    stopEntryClipTracks(row);
    resetEntryClip(row);
    forgetHeldClip();
  }

  function restoreHeldClip() {
    const row = rowsEl && rowsEl.querySelector(".train-row .field-record") && rowsEl.querySelector(".train-row");
    if (!row) return;
    clipStore().then(function (db) {
      return new Promise(function (resolve) {
        if (!db.objectStoreNames.contains("clips")) {
          resolve(null);
          return;
        }
        const tx = db.transaction("clips", "readonly");
        const req = tx.objectStore("clips").get("hold");
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { resolve(null); };
      });
    }).then(function (file) {
      if (file) showEntryPlayback(row, file, false);
    }).catch(function () {});
  }

  function forgetEntryDraft() {
    try {
      sessionStorage.removeItem("rr-entry-draft-v3");
      sessionStorage.removeItem("rr-entry-draft");
    } catch (err) { /* private browsing */ }
  }

  function saveEntryDraft() {
    if (!rowsEl || !dateEl) return;
    const rowEls = rowsEl.querySelectorAll(".train-row");
    if (!rowEls.length) return;
    const rows = [];
    Array.prototype.forEach.call(rowEls, function (row) {
      const payload = readRow(row, false);
      if (rowIsFilled(payload)) rows.push(payload);
    });
    const trip = readSessionTrip();
    if (!rows.length && !trip.trip_name && !trip.trip_date_from && !trip.trip_date_to) {
      forgetEntryDraft();
      return;
    }
    try {
      sessionStorage.setItem("rr-entry-draft-v3", JSON.stringify({
        date: dateEl.value,
        trip_name: trip.trip_name,
        trip_date_from: trip.trip_date_from,
        trip_date_to: trip.trip_date_to,
        rows: rows,
      }));
    } catch (err) { /* private browsing */ }
  }

  function restoreEntryDraft() {
    let raw = "";
    try { raw = sessionStorage.getItem("rr-entry-draft-v3") || ""; } catch (err) { return; }
    if (!raw) return;
    let draft = null;
    try { draft = JSON.parse(raw); } catch (err) { return; }
    if (!draft) return;
    if (draft.time && draft.ampm && !Array.isArray(draft.rows)) {
      const parts = String(draft.time).split(":");
      let hour = Number(parts[0]);
      if (draft.ampm === "PM" && hour < 12) hour += 12;
      if (draft.ampm === "AM" && hour === 12) hour = 0;
      draft.time = String(hour).padStart(2, "0") + ":" + (parts[1] || "00");
    }
    if (draft.date && dateEl) dateEl.value = draft.date;
    writeSessionTrip(draft);
    const list = Array.isArray(draft.rows) ? draft.rows : [draft];
    if (!list.length) return;
    Array.prototype.slice.call(rowsEl.querySelectorAll(".train-row"), 1).forEach(function (row) {
      row.remove();
    });
    list.forEach(function (entry, index) {
      fillRow(entryRowAt(index), entry);
    });
    relabelRows();
  }

  function takeOpenEntry() {
    try {
      if (sessionStorage.getItem("rr-open-entry") !== "1") return false;
      sessionStorage.removeItem("rr-open-entry");
      return true;
    } catch (err) {
      return false;
    }
  }

  function bindRow(row) {
    if (row && row.classList && row.classList.contains("is-empty")) applyPadDefaultsToRow(row);
    row.addEventListener("click", function (event) {
      const clipStop = event.target.closest("[data-clip-stop]");
      if (clipStop && row.contains(clipStop)) {
        stopEntryClip(row);
        return;
      }
      const clipDelete = event.target.closest("[data-clip-delete]");
      if (clipDelete && row.contains(clipDelete)) {
        deleteEntryClip(row);
        return;
      }
      const recordBtn = event.target.closest(".f-record");
      if (recordBtn && row.contains(recordBtn)) {
        startEntryClip(row);
        return;
      }
      const layoutBtn = event.target.closest(".sp-layout");
      if (layoutBtn && row.contains(layoutBtn)) {
        const name = layoutBtn.getAttribute("data-sp-layout");
        try { localStorage.setItem("rr-sp-layout", name); } catch (err) { /* keep the choice for this page */ }
        applySpLayout(name);
        return;
      }
      const addBtn = event.target.closest("[data-add-special]");
      if (addBtn && row.contains(addBtn)) {
        addSpecialItem(row, addBtn.getAttribute("data-add-special"), null, true);
        markEmpty(row);
        return;
      }
      const assistAdd = event.target.closest(".sp-assist-add");
      if (assistAdd && row.contains(assistAdd)) {
        assistAdd.insertAdjacentHTML("beforebegin", assistUnitHtml(""));
        assistAdd.previousElementSibling.querySelector("input").focus();
        return;
      }
      const assistRemove = event.target.closest(".sp-assist-remove");
      if (assistRemove && row.contains(assistRemove)) {
        assistRemove.closest(".sp-assist-unit").remove();
        syncAssistHeritage(row);
        refreshSpecialSummary(row);
        return;
      }
      const wheelOpen = event.target.closest("[data-sp-wheels-open]");
      if (wheelOpen && row.contains(wheelOpen)) {
        const list = wheelOpen.parentElement.querySelector(".sp-wheel-list");
        if (list) list.hidden = !list.hidden;
        return;
      }
      const wheelPick = event.target.closest("[data-sp-wheel]");
      if (wheelPick && row.contains(wheelPick)) {
        const wrap = wheelPick.closest(".sp-wheel-wrap");
        const select = wrap && wrap.querySelector(".sp-wheels");
        const list = wrap && wrap.querySelector(".sp-wheel-list");
        if (select) {
          select.value = wheelPick.getAttribute("data-sp-wheel");
          if (list) list.hidden = true;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
        return;
      }
      const editBtn = event.target.closest(".sp-edit");
      if (editBtn && row.contains(editBtn)) {
        openSpEditor(editBtn);
        return;
      }
      const posOpen = event.target.closest("[data-sp-pos-open]");
      if (posOpen && row.contains(posOpen)) {
        const list = posOpen.parentElement.querySelector(".sp-pos-list");
        if (list) list.hidden = !list.hidden;
        return;
      }
      const posBtn = event.target.closest("[data-sp-pos]");
      if (posBtn && row.contains(posBtn)) {
        const item = posBtn.closest(".sp-item");
        setSpPos(item, posBtn.classList.contains("is-on") ? "" : posBtn.getAttribute("data-sp-pos"));
        const list = item && item.querySelector(".sp-pos-list");
        if (list) list.hidden = true;
        if (item) item.removeAttribute("data-consist-auto");
        refreshSpecialSummary(row);
        markEmpty(row);
        return;
      }
      const flagBtn = event.target.closest("[data-sp-flag]");
      if (flagBtn && row.contains(flagBtn)) {
        const item = flagBtn.closest(".sp-item");
        const box = item && item.querySelector(flagBtn.getAttribute("data-sp-flag") === "dh" ? ":scope > .sp-chips .sp-dh" : ":scope > .sp-chips .sp-assist");
        if (box) {
          box.checked = !box.checked;
          box.dispatchEvent(new Event("change", { bubbles: true }));
        }
        return;
      }
      const removeBtn = event.target.closest(".sp-remove");
      if (removeBtn && row.contains(removeBtn)) {
        removeBtn.closest(".sp-item").remove();
        syncAssistHeritage(row);
        refreshSpecialHint(row);
        refreshSpecialSummary(row);
        markEmpty(row);
        return;
      }
      const hint = event.target.closest(".sp-hint");
      if (hint && row.contains(hint)) {
        const kind = hint.getAttribute("data-kind");
        const unit = leadUnitOf(row);
        const found = rosterFind(kind, unit);
        if (found) {
          setSpecialOpen(row, kind, true);
          addSpecialItem(
            row,
            kind,
            kind === "steam"
              ? { engine: found.engine, name: found.name, wheels: found.wheels }
              : { unit: found.unit, scheme: found.scheme, era: found.era, position: "lead" }
          );
        }
        refreshSpecialHint(row);
        markEmpty(row);
        return;
      }
      const chip = event.target.closest(".chip, .seg, .f-special-toggle");
      if (!chip || !row.contains(chip)) return;
      if (chip.classList.contains("f-now")) {
        fillNow(row);
        return;
      }
      if (chip.classList.contains("f-ampm")) {
        row.querySelectorAll(".f-ampm").forEach(function (btn) {
          btn.classList.toggle("is-on", btn === chip);
        });
        dropInvalid(row.querySelector(".time-fields"));
        followClockDayNight(row);
        return;
      }
      if (chip.dataset.dir) {
        const turnOn = !chip.classList.contains("is-on");
        row.querySelectorAll("[data-dir]").forEach(function (btn) {
          btn.classList.toggle("is-on", turnOn && btn === chip);
        });
        dropInvalid(row.querySelector(".dir-group"));
        markEmpty(row);
        return;
      }
      if (chip.classList.contains("f-type-other")) {
        chip.classList.toggle("is-on");
        row.querySelector(".f-type-custom").hidden = !chip.classList.contains("is-on");
        dropInvalid(row.querySelector(".type-group"));
        return;
      }
      if (chip.classList.contains("f-notes-toggle")) {
        const turnOn = !chip.classList.contains("is-on");
        setNotesOpen(row, turnOn, turnOn);
        return;
      }
      if (chip.classList.contains("f-symbol-toggle")) {
        const turnOn = !chip.classList.contains("is-on");
        setSymbolOpen(row, turnOn, turnOn);
        refreshDecode(row);
        return;
      }
      if (chip.classList.contains("f-special-toggle")) {
        setSpecialOpen(row, chip.getAttribute("data-sp-toggle"), !chip.classList.contains("is-on"), true);
        return;
      }
      if (chip.classList.contains("f-photo")) {
        chip.classList.toggle("is-on");
        syncDayNight(row);
        return;
      }
      if (chip.classList.contains("f-video")) {
        chip.classList.toggle("is-on");
        return;
      }
      if (chip.classList.contains("f-day") || chip.classList.contains("f-night")) {
        row._dayNightManual = true;
        const turnOn = !chip.classList.contains("is-on");
        row.querySelectorAll(".f-day, .f-night").forEach(function (btn) {
          btn.classList.toggle("is-on", turnOn && btn === chip);
        });
        return;
      }
      if (chip.dataset.type) {
        chip.classList.toggle("is-on");
        dropInvalid(row.querySelector(".type-group"));
        if (chip.dataset.type === "PASS") {
          syncPassNo(row, chip.classList.contains("is-on"));
          refreshDecode(row);
        }
        if (chip.dataset.type === "COAL") syncCoal(row, chip.classList.contains("is-on"));
        if (chip.dataset.type === "CON") syncCon(row);
      }
    });
    row.addEventListener("click", function (event) {
      const toggle = event.target.closest(".cu-toggle");
      if (!toggle) return;
      setConsistOpen(row, toggle.getAttribute("aria-expanded") !== "true", true);
    });
    row.addEventListener("change", function (event) {
      if (event.target.matches(".cu-unit")) {
        event.target.value = consistUnitText(row, event.target.value);
        fitConsistBox(event.target);
        renderConsistUnits(row);
        syncConsistHeritage(row);
        refreshConsistCount(row);
        return;
      }
      const item = event.target.closest(".sp-item");
      if (item && event.target.matches(".sp-unit, .sp-engine")) {
        event.target.value = event.target.value.toUpperCase().replace(/\s+/g, " ").trim();
        applyRosterToItem(item);
        refreshSpecialHint(row);
      }
      if (item) refreshSpecialSummary(row);
      if (item) refreshSpBoard(item);
      if (item) refreshSpDecode(item);
      if (item && event.target.matches(".sp-dh")) {
        const second = item.querySelector(".sp-second");
        second.hidden = !event.target.checked;
        if (event.target.checked && !second.querySelector(".sp-engine").value) {
          const input = second.querySelector(".sp-engine");
          if (input) input.focus();
        }
        refreshSpecialSummary(row);
        refreshSpecialHint(row);
      }
      if (item && event.target.matches(".sp-pos")) item.removeAttribute("data-consist-auto");
      if (item && event.target.matches(".sp-assist")) {
        const list = item.querySelector(".sp-assist-list");
        list.hidden = !event.target.checked;
        if (event.target.checked && !list.querySelector(".sp-assist-input")) {
          list.querySelector(".sp-assist-add").insertAdjacentHTML("beforebegin", assistUnitHtml(""));
          list.querySelector(".sp-assist-input").focus();
        }
        syncAssistHeritage(row);
        refreshSpecialSummary(row);
      }
      if (item && event.target.matches(".sp-assist-input")) {
        event.target.value = event.target.value.toUpperCase().replace(/\s+/g, " ").trim();
        syncAssistHeritage(row);
        refreshSpecialSummary(row);
      }
      if (item && event.target.matches(".sp-wheels")) {
        const wrap = event.target.closest(".sp-wheel-wrap") || item;
        const other = wrap.querySelector(".sp-wheels-other");
        other.hidden = event.target.value !== "Other";
        if (!other.hidden) other.focus();
        refreshSpDecode(item);
      }
      if (event.target.matches(".f-mark, .f-loco, .f-mark-custom")) {
        scheduleSeenBefore(row);
        const lead = unitKey(leadUnitOf(row));
        row.querySelectorAll('.sp-item[data-sp="heritage"]').forEach(function (heritage) {
          if (lead && !heritage.querySelector(".sp-pos").value && unitKey(heritage.querySelector(".sp-unit").value) === lead) setSpPos(heritage, "lead");
        });
        refreshSpecialHint(row);
      }
      if (event.target.matches(".f-stopped, .f-siding, .f-crew, .f-no-crew")) {
        dropInvalid(row.querySelector(".dir-group"));
        markEmpty(row);
      }
      if (event.target.matches("[data-lead-status]")) {
        setLeadStatus(row, leadStatusOf(row));
        refreshSpecialHint(row);
        markEmpty(row);
      }
    });
    row.addEventListener("mousedown", function (event) {
      const assistPick = event.target.closest("[data-assist-pick]");
      if (assistPick && row.contains(assistPick)) {
        event.preventDefault();
        const box = assistPick.closest(".sp-suggest");
        const input = box && box.parentNode.querySelector(".sp-assist-input");
        pickAssistSuggest(input, box && box._items && box._items[Number(assistPick.getAttribute("data-assist-pick"))]);
        return;
      }
      const addPick = event.target.closest("[data-add-pick]");
      if (addPick && row.contains(addPick)) {
        event.preventDefault();
        const box = addPick.closest(".sp-suggest");
        commitSpecialAdd(row, box && box._items && box._items[Number(addPick.getAttribute("data-add-pick"))]);
        return;
      }
      const pick = event.target.closest("[data-sp-pick]");
      if (!pick || !row.contains(pick)) return;
      event.preventDefault();
      pickSpSuggest(row, pick.closest(".sp-suggest"), Number(pick.getAttribute("data-sp-pick")));
    });
    row.addEventListener("keydown", function (event) {
      if (event.target.matches(".sp-add-input")) {
        const box = event.target.parentNode.querySelector(".sp-suggest");
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          if (!box || box.style.display !== "block") return;
          event.preventDefault();
          moveSpSuggest(box, event.key === "ArrowDown" ? 1 : -1);
        } else if (event.key === "Enter") {
          event.preventDefault();
          if (box && box.style.display === "block" && box._active >= 0) commitSpecialAdd(row, box._items[box._active]);
          else commitSpecialAdd(row, event.target.value);
        } else if (event.key === "Escape") {
          event.preventDefault();
          hideSpSuggest(event.target);
        }
        return;
      }
      if (event.target.matches(".sp-assist-input")) {
        const box = event.target.parentNode.querySelector(".sp-suggest");
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          if (!box || box.style.display !== "block") return;
          event.preventDefault();
          moveSpSuggest(box, event.key === "ArrowDown" ? 1 : -1);
        } else if (event.key === "Enter" && box && box.style.display === "block" && box._active >= 0) {
          event.preventDefault();
          pickAssistSuggest(event.target, box._items[box._active]);
        } else if (event.key === "Escape") {
          event.preventDefault();
          hideSpSuggest(event.target);
        }
        return;
      }
      if (!event.target.matches(".sp-unit, .sp-engine")) return;
      const box = event.target.parentNode.querySelector(".sp-suggest");
      if (!box || box.style.display !== "block") return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        moveSpSuggest(box, event.key === "ArrowDown" ? 1 : -1);
      } else if (event.key === "Enter" && box._active >= 0) {
        event.preventDefault();
        pickSpSuggest(row, box, box._active);
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        hideSpSuggest(event.target);
      }
    });
    row.addEventListener("focusout", function (event) {
      if (event.target.matches(".sp-add-input, .sp-assist-input")) {
        window.setTimeout(function () {
          if (document.activeElement !== event.target) hideSpSuggest(event.target);
        }, 150);
        return;
      }
      if (!event.target.matches(".sp-unit, .sp-engine")) return;
      window.setTimeout(function () {
        if (document.activeElement !== event.target) hideSpSuggest(event.target);
      }, 150);
    });
    row.addEventListener("input", function (event) {
      if (event.target.matches(".sp-unit, .sp-engine")) showSpSuggest(event.target);
      if (event.target.matches(".sp-add-input")) showAddSuggest(event.target);
      if (event.target.matches(".sp-assist-input")) showAssistSuggest(event.target);
      if (event.target.matches(".sp-unit, .sp-scheme, .sp-engine, .sp-name")) refreshSpBoard(event.target.closest(".sp-item"));
      if (event.target.matches(".f-loco")) {
        refreshSpecialHint(row);
        scheduleSeenBefore(row);
      }
      if (event.target.matches(".f-c1, .f-c2, .f-c3")) renderConsistUnits(row);
      if (event.target.matches(".cu-unit")) fitConsistBox(event.target);
      if (event.target.matches(".f-symbol, .f-passno")) {
        refreshDecode(row);
        if (event.target.matches(".f-symbol")) scheduleSeenBefore(row);
      }
      if (event.target.matches(".f-symbol")) fitInput(event.target, 13);
      if (event.target.matches(".f-type-custom")) fitInput(event.target, 12);
    });

    const rr = row.querySelector(".f-rr");
    const custom = row.querySelector(".f-rr-custom");
    const mark = row.querySelector(".f-mark");
    const markCustom = row.querySelector(".f-mark-custom");
    rr.addEventListener("change", async function () {
      custom.hidden = rr.value !== "Other";
      if (custom.hidden) custom.value = "";
      const follow = !markOf(row) || markOf(row) === rr.dataset.prev;
      const nextMark = follow ? (rr.value === "Other" ? "" : rr.value) : markOf(row);
      fillMarkSelect(row, nextMark);
      rr.dataset.prev = rr.value;
      refreshDecode(row);
      await ensureSubs(true);
      fillSubSelect(row);
      markEmpty(row);
      const loc = row.querySelector(".f-loc");
      loadSuggestions(loc.value, row.querySelector(".suggest"), loc, row);
    });
    mark.addEventListener("change", function () {
      markCustom.hidden = mark.value !== "Other";
      if (markCustom.hidden) markCustom.value = "";
      markEmpty(row);
    });

    row.querySelector(".row-clear").addEventListener("click", async function () {
      clearRow(row);
      await reseedBlankRow(row);
      saveEntryDraft();
    });
    const removeBtn = row.querySelector(".row-remove");
    if (removeBtn && !removeBtn._boundRemove) {
      removeBtn._boundRemove = true;
      removeBtn.addEventListener("click", function () {
        removePadEntryCard(row);
      });
    }

    const loc = row.querySelector(".f-loc");
    const suggest = row.querySelector(".suggest");
    let timer = null;
    loc.addEventListener("input", function () {
      markEmpty(row);
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        loadSuggestions(loc.value, suggest, loc, row);
      }, 180);
    });
    loc.addEventListener("focus", function () {
      loadSuggestions(loc.value, suggest, loc, row);
    });
    loc.addEventListener("blur", function () {
      window.setTimeout(function () {
        suggest.style.display = "none";
        guessLocationZone(row);
      }, 180);
    });
    const stateSelect = row.querySelector(".f-state");
    setRowState(row, "");
    stateSelect.addEventListener("change", function () {
      applyRowState(row, stateSelect.value);
    });
    const zoneSelect = row.querySelector(".f-tz");
    setRowZone(row, defaultZone());
    const zoneBtn = row.querySelector(".tz-btn");
    if (zoneBtn) {
      zoneBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        toggleZoneMenu(row);
      });
    }
    zoneSelect.addEventListener("change", function () {
      updateZoneFlag(row);
      zonePick = { zone: zoneSelect.value, device: deviceZone() };
      Array.prototype.forEach.call(rowsEl.querySelectorAll(".train-row"), function (other) {
        if (other !== row && !rowIsFilled(readRow(other))) setRowZone(other, zoneSelect.value);
        syncDayNight(other);
      });
      syncDayNight(row);
    });
    row.querySelectorAll(".f-loco, .f-c1, .f-c2, .f-c3, .f-cars-a, .f-cars-b").forEach(function (box) {
      box.maxLength = 4;
      box.addEventListener("input", function () {
        const digits = box.value.replace(/\D/g, "").slice(0, box.maxLength > 0 ? box.maxLength : undefined);
        if (digits !== box.value) box.value = digits;
      });
    });
    row.addEventListener("keydown", function (event) {
      if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
      const stops = Array.prototype.filter.call(row.querySelectorAll(TAB_FLOW), function (el) {
        return !el.disabled && !el.hidden && el.offsetParent !== null;
      }).sort(function (a, b) {
        return flowRank(a) - flowRank(b);
      });
      const at = stops.indexOf(event.target);
      if (at === -1) return;
      const next = stops[at + (event.shiftKey ? -1 : 1)];
      if (!next) return;
      event.preventDefault();
      next.focus();
    });
    const coalMark = row.querySelector(".f-coal-mark");
    if (coalMark) {
      coalMark.addEventListener("input", function () {
        const letters = coalMark.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
        if (letters !== coalMark.value) coalMark.value = letters;
      });
    }
    row.querySelector(".f-sub").addEventListener("change", function () {
      const select = row.querySelector(".f-sub");
      const custom = row.querySelector(".f-sub-custom");
      custom.hidden = select.value !== "Other";
      if (custom.hidden) custom.value = "";
      fillSubSelect(row, subOf(row));
      markEmpty(row);
      loadSuggestions(loc.value, suggest, loc, row);
    });
    row.querySelector(".f-sub").addEventListener("focus", function () {
      ensureSubs(true).then(function () {
        fillSubSelect(row);
      });
    });

    row.querySelectorAll("input, select, textarea").forEach(function (field) {
      field.addEventListener("input", function () {
        dropInvalid(field);
        markEmpty(row);
        if (field.classList.contains("f-notes")) growNotes(field);
        if (field.classList.contains("f-hh") || field.classList.contains("f-mm")) followClockDayNight(row);
        if (field.classList.contains("f-symbol") || field.classList.contains("f-passno")) {
          const clean = cleanSymbol(field.value);
          if (clean !== field.value) {
            const at = Math.max(0, (field.selectionStart || 0) - (field.value.length - clean.length));
            field.value = clean;
            field.setSelectionRange(at, at);
          }
        }
      });
      field.addEventListener("change", function () {
        dropInvalid(field);
      });
    });
    growNotes(row.querySelector(".f-notes"));
    rr.dataset.prev = rr.value;
    fillMarkSelect(row, "");
  }

  function markEmpty(row) {
    const data = readRow(row, false);
    const used = Boolean(
      data.railroad ||
        data.lead_locomotive ||
        data.direction ||
        data.stopped ||
        data.in_siding ||
        data.crew_change ||
        data.no_crew ||
        data.power_consist ||
        data.location_spot ||
        data.car_counts ||
        (data.train_types && data.train_types.length)
    );
    row.classList.toggle("is-empty", !used);
  }

  async function loadSuggestions(query, suggest, loc, row) {
    const railroad = railroadOf(row);
    const subdivision = subOf(row);
    if (!query && !subdivision) {
      suggest.style.display = "none";
      return;
    }
    const params = new URLSearchParams();
    params.set("q", query || "");
    if (railroad) params.set("railroad", railroad);
    if (subdivision) params.set("subdivision", subdivision);
    const result = await api("/api/locations/autocomplete?" + params.toString());
    const items = result.data || [];
    if (!items.length) {
      suggest.style.display = "none";
      return;
    }
    suggest.innerHTML = items
      .map(function (item) {
        const label = item.location_spot_label || item.location_spot || "";
        return "<button type=\"button\">" + label + "</button>";
      })
      .join("");
    Array.prototype.forEach.call(suggest.children, function (button, index) {
      button.addEventListener("mousedown", function (event) {
        event.preventDefault();
        loc.value = items[index].location_spot_label || items[index].location_spot || "";
        if (items[index].location_subdivision) {
          fillSubSelect(row, items[index].location_subdivision);
        }
        if (items[index].location_state) applyRowState(row, items[index].location_state);
        suggest.style.display = "none";
        markEmpty(row);
      });
    });
    suggest.style.display = "block";
  }

  function isPassengerRailroad(name) {
    return PASSENGER_RAILROADS.indexOf(name) !== -1;
  }

  function railroadChoices(includePassenger) {
    const extra = includePassenger && isPassengerRailroad(includePassenger) ? [includePassenger] : [];
    return FREIGHT_RAILROADS.concat(extra);
  }

  function fillMarkSelect(row, selected) {
    const select = row.querySelector(".f-mark");
    const custom = row.querySelector(".f-mark-custom");
    if (selected == null) selected = markOf(row);
    const marks = railroadChoices(railroadOf(row));
    let html = '<option value="">Select</option>';
    RAILROAD_GROUPS.forEach(function (group) {
      const names = (group.railroads || []).filter(function (name) {
        return !isPassengerRailroad(name) || name === railroadOf(row);
      });
      if (!names.length) return;
      html += '<optgroup label="' + String(group.label || "").replace(/"/g, "&quot;") + '">';
      names.forEach(function (name) {
        const meaning = RR_MEANINGS[name] || "";
        html +=
          '<option value="' +
          name +
          '"' +
          (meaning ? ' title="' + meaning.replace(/"/g, "&quot;") + '"' : "") +
          ">" +
          name +
          "</option>";
      });
      html += "</optgroup>";
    });
    html += '<option value="Other">Other</option>';
    select.innerHTML = html;
    if (!selected) {
      select.value = "";
      custom.hidden = true;
      custom.value = "";
      return;
    }
    if (marks.indexOf(selected) !== -1) {
      select.value = selected;
      custom.hidden = true;
      custom.value = "";
      return;
    }
    if (selected === "Other") {
      select.value = "Other";
      custom.hidden = false;
      return;
    }
    select.value = "Other";
    custom.hidden = false;
    custom.value = selected;
  }

  function subRailroadKeys(rr) {
    if (rr) return [rr];
    const seen = {};
    const keys = [];
    RAILROADS.concat(Object.keys(SUBS_BY_RR)).forEach(function (name) {
      if (seen[name] || !(SUBS_BY_RR[name] && SUBS_BY_RR[name].length)) return;
      seen[name] = true;
      keys.push(name);
    });
    return keys;
  }

  function fillSubSelect(row, selected) {
    if (selected == null) selected = subOf(row);
    const select = row.querySelector(".f-sub");
    const custom = row.querySelector(".f-sub-custom");
    const rr = railroadOf(row);
    const keys = subRailroadKeys(rr);
    let html = '<option value="">Select</option>';
    keys.forEach(function (key) {
      const names = SUBS_BY_RR[key] || [];
      if (!names.length) return;
      html += '<optgroup label="' + key + '">';
      names.forEach(function (name) {
        const count = selected === name ? SUB_COUNTS[name] : null;
        const label = count ? name + " (" + count + ")" : name;
        html +=
          '<option value="' +
          name.replace(/"/g, "&quot;") +
          '">' +
          label.replace(/</g, "&lt;") +
          "</option>";
      });
      html += "</optgroup>";
    });
    html += '<option value="Other">Other</option>';
    select.innerHTML = html;
    const values = Array.prototype.map.call(select.options, function (option) {
      return option.value;
    });
    if (!selected) {
      select.value = "";
      custom.hidden = true;
      custom.value = "";
      return;
    }
    if (values.indexOf(selected) !== -1) {
      select.value = selected;
      custom.hidden = true;
      custom.value = "";
      return;
    }
    select.value = "Other";
    custom.hidden = false;
    custom.value = selected;
  }

  async function ensureRailroads(force) {
    if (!force && RAILROADS.length) return;
    const result = await api("/api/railroads");
    const data = result.data || {};
    RAILROAD_GROUPS = data.groups || [];
    RAILROADS = data.all || [];
    FREIGHT_RAILROADS = data.freight || [];
    PASSENGER_RAILROADS = data.passenger || [];
    window.RAILROADS_FOR_SETTINGS = RAILROADS.slice();
    window.TRAIN_TYPES_FOR_SETTINGS = TRAIN_TYPES.slice();
    window.STATE_CODES_FOR_SETTINGS = STATE_CODES.slice();
    window.SUBS_BY_RR_FOR_SETTINGS = SUBS_BY_RR;
    if (data.types && data.types.length) TRAIN_TYPES = data.types;
    RR_MEANINGS = (data.meanings && data.meanings.railroads) || {};
    MARK_ALIASES = data.mark_aliases || {};
    TYPE_MEANINGS = (data.meanings && data.meanings.types) || {};
    const states = data.states || {};
    STATE_CODES = states.codes || [];
    STATE_ZONES = states.zones || {};
    SPLIT_STATES = states.split || [];
    Array.prototype.forEach.call(rowsEl.querySelectorAll(".train-row"), function (row) {
      setRowState(row, stateOf(row));
    });
    fillFilterRailroads();
    fillAcroKey();
  }

  function rebuildTypeChips() {
    Array.prototype.forEach.call(rowsEl.querySelectorAll(".train-row"), function (row) {
      const group = row.querySelector(".type-group");
      if (!group) return;
      const chips = group.querySelector(".type-chips") || group;
      const passBox = group.querySelector(".f-passno");
      const coal = row.querySelector(".f-coal-mark");
      const overseas = row.querySelector(".f-con-overseas");
      const domestic = row.querySelector(".f-con-domestic");
      const coalMark = coal ? coal.value : "";
      const con = {
        overseas: Boolean(overseas && overseas.checked),
        domestic: Boolean(domestic && domestic.checked),
      };
      chips.innerHTML = typeGroupHtml(selectedTypes(row), passBox ? passBox.value : "");
      setCoal(row, coalMark);
      setCon(row, con.overseas, con.domestic);
      fitInput(group.querySelector(".f-type-custom"), 12);
    });
  }

  async function refreshLists() {
    await ensureRailroads(true);
    await ensureSubs(true);
    rebuildTypeChips();
    Array.prototype.forEach.call(rowsEl.querySelectorAll(".train-row"), function (row) {
      const railroad = railroadOf(row);
      const sub = subOf(row);
      const mark = markOf(row);
      const rr = row.querySelector(".f-rr");
      const custom = row.querySelector(".f-rr-custom");
      rr.innerHTML = railroadOptions(railroad);
      setSelectValue(rr, custom, railroad);
      rr.dataset.prev = rr.value === "Other" ? "" : rr.value;
      fillMarkSelect(row, mark);
      fillSubSelect(row, sub);
    });
  }

  function fillFilterRailroads() {
    const select = document.querySelector('#filter-form select[name="railroad"]');
    if (!select) return;
    const current = select.value;
    let html = '<option value="">Any</option>';
    RAILROAD_GROUPS.forEach(function (group) {
      if (!group.railroads || !group.railroads.length) return;
      html += '<optgroup label="' + String(group.label || "").replace(/"/g, "&quot;") + '">';
      group.railroads.forEach(function (name) {
        html += '<option value="' + name + '">' + name + "</option>";
      });
      html += "</optgroup>";
    });
    select.innerHTML = html;
    if (current) select.value = current;
    fillFilterSelect("filter-state", STATE_CODES.map(function (code) {
      return [code, code];
    }));
    fillFilterSelect("filter-zone", TZ_CHOICES);
  }

  function fillFilterSelect(id, choices) {
    const select = document.getElementById(id);
    if (!select) return;
    const current = select.value;
    select.innerHTML =
      '<option value="">Any</option>' +
      choices
        .map(function (choice) {
          return '<option value="' + escapeText(choice[0]) + '">' + escapeText(choice[1]) + "</option>";
        })
        .join("");
    if (current && choices.some(function (choice) { return choice[0] === current; })) select.value = current;
  }

  async function fillFilterTrips() {
    const result = await api("/api/trips");
    const trips = (result.data && result.data.trips) || [];
    fillFilterSelect("filter-trip", trips.map(function (trip) {
      const name = tripNameOf(trip);
      return [name, name];
    }));
  }

  const SYMBOL_KEYS = {
    BNSF: {
      how: "First letter is the train type, then origin and destination codes, then the date (Q-LACCHI1-23).",
      rows: [
        ["Z", "Priority intermodal (UPS, LTL)"],
        ["Q", "Guaranteed intermodal"],
        ["S", "Stack intermodal"],
        ["B", "Baretables (empty intermodal flats)"],
        ["V", "Vehicles (autoracks)"],
        ["H", "Priority manifest"],
        ["M", "Manifest (mixed freight)"],
        ["G / X", "Grain, loaded / empty"],
        ["C / E", "Coal, loaded / empty"],
        ["U", "Unit trains (ethanol, crude, rock)"],
        ["L / R / T", "Local / road switcher / transfer"],
        ["W / D", "Work train / light engines"],
        ["A / O", "Amtrak or passenger / office car special"],
      ],
    },
    UP: {
      how: "One or two letters for the type, then two-letter origin and destination codes, then the date (MNPCI-23).",
      rows: [
        ["Z", "Expedited intermodal (highest priority)"],
        ["K", "Priority intermodal"],
        ["I", "Intermodal"],
        ["A", "Automotive"],
        ["Q", "Priority manifest"],
        ["M", "Manifest (mixed freight)"],
        ["G", "Grain (GS shuttle, GE empties)"],
        ["C", "Coal"],
        ["U", "Ethanol and other unit trains"],
        ["O / R", "Ore / rock and sand"],
        ["L / Y", "Local / yard job"],
        ["W / E", "Work train / light engines"],
        ["S / P", "Special / passenger"],
      ],
    },
    CSX: {
      how: "One letter for the type, then a three-digit number. Older Q symbols became I and M.",
      rows: [
        ["I", "Intermodal"],
        ["M", "Manifest (M2xx automotive)"],
        ["B", "Bulk (ethanol, oil, ore, phosphate, coke)"],
        ["C / E", "Coal, loaded / empty"],
        ["G", "Grain"],
        ["L / U", "Local / extra or recrewed local"],
        ["Y", "Yard job or transfer"],
        ["F / Z", "Foreign railroad running on CSX"],
        ["S / P", "Special / passenger"],
        ["W", "Work train"],
      ],
    },
    NS: {
      how: "The hundreds digit is the train type. Locals use a division letter and number (V14, H02).",
      rows: [
        ["0xx", "Amtrak and specials"],
        ["1xx", "Manifest (long haul)"],
        ["2xx", "Intermodal and automotive"],
        ["3xx", "Manifest (regional)"],
        ["4xx–6xx", "Bulk: grain, ethanol, aggregates, chemicals, extras"],
        ["7xx–8xx", "Coal, loaded and empty"],
        ["9xx", "Work trains and light engines"],
      ],
    },
  };
  let symbolKeyRoad = "BNSF";

  function symbolKeyBodyHtml(road) {
    const key = SYMBOL_KEYS[road];
    return (
      '<div class="symbol-key-tabs" role="tablist">' +
      Object.keys(SYMBOL_KEYS)
        .map(function (name) {
          return (
            '<button type="button" class="chip' +
            (name === road ? " is-on" : "") +
            '" data-symbol-road="' +
            name +
            '" role="tab" aria-selected="' +
            (name === road) +
            '">' +
            name +
            "</button>"
          );
        })
        .join("") +
      "</div>" +
      '<p class="symbol-key-how">' +
      escapeText(key.how) +
      "</p><dl>" +
      key.rows
        .map(function (row) {
          return "<dt>" + escapeText(row[0]) + "</dt><dd>" + escapeText(row[1]) + "</dd>";
        })
        .join("") +
      '</dl><p class="symbol-key-note">For reference only. Symbols vary by region and change over time.</p>'
    );
  }

  document.addEventListener("click", function (event) {
    const tab = event.target.closest("[data-symbol-inline] [data-symbol-road]");
    if (!tab) return;
    symbolKeyRoad = tab.getAttribute("data-symbol-road");
    const body = tab.closest("[data-symbol-inline]").querySelector("[data-symbol-inline-body]");
    if (body) body.innerHTML = symbolKeyBodyHtml(symbolKeyRoad);
  });

  const legendBtn = document.getElementById("dash-log-legend");
  if (legendBtn) {
    legendBtn.addEventListener("click", function () {
      const rr = document.querySelector("#rows .train-row .f-rr");
      const picked = rr ? String(rr.value || "").toUpperCase() : "";
      if (SYMBOL_KEYS[picked]) symbolKeyRoad = picked;
      const body = document.querySelector("#dash-log-key [data-symbol-inline-body]");
      if (body) body.innerHTML = symbolKeyBodyHtml(symbolKeyRoad);
    });
  }

  document.addEventListener("click", function (event) {
    const opener = event.target.closest && event.target.closest("[data-train-ref], #dash-train-ref");
    if (!opener) return;
    const row = opener.closest(".train-row") || document.querySelector("#rows .train-row");
    const rr = row && row.querySelector(".f-rr");
    const picked = rr ? String(rr.value || "").toUpperCase() : "";
    if (SYMBOL_KEYS[picked]) symbolKeyRoad = picked;
    const body = document.querySelector("#train-ref [data-symbol-inline-body]");
    if (body) body.innerHTML = symbolKeyBodyHtml(symbolKeyRoad);
  });

  const PLACARDS = [
    { file: "dangerous.png", name: "Dangerous", cls: "", guide: "111", text: "A mixed load of different hazards, not one commodity. A loaded tank car shows the placard for what it carries." },
    { file: "explosive.png", name: "Explosives", cls: "1.1, 1.2, 1.3", guide: "112", text: "1.1 is a mass explosion. 1.2 projects fragments but is not a mass explosion. 1.3 is a fire with a minor blast or projection, not a mass explosion." },
    { file: "explosive-14.png", name: "Explosives 1.4", cls: "1.4", guide: "114", text: "No significant hazard. Effects stay mostly in the package." },
    { file: "blasting.png", name: "Blasting agents", cls: "1.5", guide: "112", text: "Very insensitive, with a mass explosion hazard." },
    { file: "explosive-16.png", name: "Explosives 1.6", cls: "1.6", guide: "114", text: "Extremely insensitive articles. No mass explosion." },
    { file: "flammable-gas.png", name: "Flammable gas", cls: "2.1", guide: "118", text: "Flammable gases." },
    { file: "nonflammable-gas.png", name: "Non-flammable gas", cls: "2.2", guide: "120", text: "Gases that are not flammable and not toxic." },
    { file: "poison-gas.png", name: "Inhalation hazard", cls: "2.3", guide: "123", text: "Toxic gases." },
    { file: "oxygen.png", name: "Oxygen", cls: "2.2", guide: "122", text: "Oxygen. Yellow, used instead of the green non-flammable gas placard." },
    { file: "flammable.png", name: "Flammable", cls: "3", guide: "127", text: "Flammable liquids, and combustible liquids in the U.S." },
    { file: "combustible.png", name: "Combustible", cls: "3", guide: "127", text: "A combustible liquid. The placard reads COMBUSTIBLE." },
    { file: "hot.png", name: "Hot", cls: "", guide: "", text: "An elevated-temperature mark, not a hazard class. Often beside the placard for the commodity." },
    { file: "flammable-solid.png", name: "Flammable solid", cls: "4.1", guide: "134", text: "Flammable solids." },
    { file: "spontaneous.png", name: "Spontaneously combustible", cls: "4.2", guide: "136", text: "Liable to spontaneous combustion." },
    { file: "dangerous-wet.png", name: "Dangerous when wet", cls: "4.3", guide: "139", text: "Contact with water emits flammable gases." },
    { file: "oxidizer.png", name: "Oxidizer", cls: "5.1", guide: "143", text: "Oxidizing substances." },
    { file: "peroxide.png", name: "Organic peroxide", cls: "5.2", guide: "148", text: "Organic peroxides." },
    { file: "poison.png", name: "Poison", cls: "6.1", guide: "153", text: "Toxic substances. The placard may read POISON or TOXIC." },
    { file: "inhalation.png", name: "Inhalation hazard", cls: "6.1", guide: "153", text: "A poison whose vapor is the danger. The words INHALATION HAZARD are added." },
    { file: "infectious.png", name: "Infectious", cls: "6.2", guide: "158", text: "Infectious substances." },
    { file: "radioactive.png", name: "Radioactive", cls: "7", guide: "163", text: "Radioactive material." },
    { file: "corrosive.png", name: "Corrosive", cls: "8", guide: "153", text: "Corrosive substances." },
    { file: "class9.png", name: "Class 9", cls: "9", guide: "171", text: "Miscellaneous dangerous substances. A marine-pollutant mark, a dead tree and a fish, may be shown with it." },
  ];

  let ergBook = null;
  let ergBookLoad = null;
  let ergGuides = null;
  let ergGuidesLoad = null;
  let placardTicket = 0;
  let placardPick = null;

  function loadErgBook() {
    if (ergBook) return Promise.resolve(ergBook);
    if (!ergBookLoad) {
      // Relative so GitHub Pages (/trainlog-field/) and Mac (/) both resolve.
      ergBookLoad = fetch("static/erg/ids.json").then(function (res) {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      }).then(function (data) {
        ergBook = data;
        return data;
      });
    }
    return ergBookLoad;
  }

  function loadErgGuides() {
    if (ergGuides) return Promise.resolve(ergGuides);
    if (!ergGuidesLoad) {
      ergGuidesLoad = fetch("static/erg/guides.json").then(function (res) {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      }).then(function (data) {
        ergGuides = data;
        return data;
      });
    }
    return ergGuidesLoad;
  }

  function guideNumbers(raw) {
    const found = [];
    String(raw || "").replace(/\d{3}/g, function (num) {
      if (found.indexOf(num) === -1) found.push(num);
    });
    return found;
  }

  function fillGuideParts(parent, parts) {
    parts.forEach(function (part) {
      if (part.h && parts.length > 1) {
        const heading = document.createElement("p");
        heading.className = "erg-sub";
        heading.textContent = part.h;
        parent.appendChild(heading);
      }
      let list = null;
      let lastSub = "";
      (part.items || []).forEach(function (item) {
        if (item.sub && item.sub !== lastSub) {
          lastSub = item.sub;
          list = null;
          const sub = document.createElement("p");
          sub.className = "erg-sub";
          sub.textContent = item.sub;
          parent.appendChild(sub);
        }
        if (!list) {
          list = document.createElement("ul");
          parent.appendChild(list);
        }
        const li = document.createElement("li");
        li.textContent = item.t;
        list.appendChild(li);
      });
    });
  }

  function guideItemCount(blocks) {
    return (blocks || []).reduce(function (sum, block) {
      return sum + ((block.items && block.items.length) || 0);
    }, 0);
  }

  function firstGuideLine(blocks) {
    const block = (blocks || [])[0];
    const item = block && block.items && block.items[0];
    return item ? item.t : "";
  }

  function guideIcon(name) {
    function svg(body) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + "</svg>";
    }
    const icons = {
      "Immediate": svg('<path d="M12 2l9 10-9 10L3 12z"/><path d="M12 8v5M12 16h.01"/>'),
      "Do this": svg('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
      "Fire": svg('<path d="M12 2s5 5 5 9a5 5 0 1 1-10 0c0-2 2-4 2-6 1 2 3 3 3 3z"/>'),
      "Spill or leak": svg('<path d="M12 2s7 8 7 12a7 7 0 1 1-14 0C5 10 12 2 12 2z"/>'),
      "Stay back": svg('<circle cx="12" cy="12" r="3"/><path d="M12 5V2M12 22v-3M5 12H2M22 12h-3"/>'),
      "Hazards": svg('<path d="M12 3l9 16H3z"/><path d="M12 9v4M12 17h.01"/>'),
      "Protective equipment": svg('<path d="M4 11a8 8 0 0 1 16 0v5H4z"/><path d="M2 16h20"/>'),
      "First aid": svg('<path d="M12 4v16M4 12h16"/>')
    };
    return icons[name] || icons["Do this"];
  }

  function addGuideIcon(bar, panels, title, blocks, tableNote, hazard) {
    if (!guideItemCount(blocks)) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "erg-icon" + (hazard ? " is-hazard" : "");
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("aria-label", title);
    btn.title = title;
    if (hazard) btn.style.setProperty("--hazard", hazard);
    btn.innerHTML = guideIcon(title);
    const panel = document.createElement("div");
    panel.className = "erg-panel";
    panel.hidden = true;
    const heading = document.createElement("p");
    heading.className = "erg-sub";
    heading.textContent = title;
    panel.appendChild(heading);
    if (tableNote) {
      const note = document.createElement("p");
      note.className = "erg-note";
      note.textContent = "Table 1 in the green pages may set a larger distance. Those tables are not copied here.";
      panel.appendChild(note);
    }
    fillGuideParts(panel, blocks);
    btn.addEventListener("click", function () {
      const open = btn.getAttribute("aria-pressed") === "true";
      bar.querySelectorAll(".erg-icon").forEach(function (other) {
        other.setAttribute("aria-pressed", "false");
      });
      panels.querySelectorAll(".erg-panel").forEach(function (other) {
        other.hidden = true;
      });
      if (!open) {
        btn.setAttribute("aria-pressed", "true");
        panel.hidden = false;
      }
    });
    bar.appendChild(btn);
    panels.appendChild(panel);
  }

  const HAZARD_COLOR = {
    "explosive.png": "#e07a1f",
    "explosive-14.png": "#e07a1f",
    "explosive-16.png": "#e07a1f",
    "blasting.png": "#e07a1f",
    "flammable.png": "#c23b42",
    "combustible.png": "#c23b42",
    "flammable-gas.png": "#c23b42",
    "flammable-solid.png": "#c23b42",
    "spontaneous.png": "#c23b42",
    "nonflammable-gas.png": "#1f8a4c",
    "oxygen.png": "#e2c200",
    "poison-gas.png": "#f2f2f2",
    "poison.png": "#f2f2f2",
    "inhalation.png": "#f2f2f2",
    "infectious.png": "#f2f2f2",
    "dangerous-wet.png": "#2f6fad",
    "oxidizer.png": "#d4b000",
    "peroxide.png": "#d4b000",
    "radioactive.png": "#e2c200",
    "corrosive.png": "#f2f2f2",
    "class9.png": "#f2f2f2",
    "dangerous.png": "#c23b42",
    "hot.png": "#c23b42"
  };

  function hazardColor(files) {
    const colors = [];
    (files || []).forEach(function (file) {
      const color = HAZARD_COLOR[file];
      if (color && colors.indexOf(color) === -1) colors.push(color);
    });
    if (!colors.length) return "";
    if (colors.length === 1) return colors[0];
    const strong = colors.filter(function (color) { return color !== "#f2f2f2"; });
    return (strong[0] || colors[0]);
  }

  function hazardInk(hex) {
    const n = parseInt(String(hex).slice(1), 16);
    if (!n && n !== 0) return "#161616";
    const y = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
    return y > 160 ? "#161616" : "#fff";
  }

  function immediateItems(distance) {
    const items = [];
    (distance || []).forEach(function (block) {
      (block.items || []).forEach(function (item) {
        if ((item.sub || "") === "Immediate precautionary measure" && item.t) items.push({ t: item.t });
      });
    });
    return items;
  }

  function immediateMessage(items) {
    let text = "";
    items.forEach(function (item) {
      const piece = String(item.t || "").trim();
      if (!piece || /[.]$/.test(text)) return;
      text = text ? text + " " + piece : piece;
    });
    return text;
  }

  function guideThreat(parts, lines) {
    const blob = JSON.stringify((parts && parts.hazards) || []);
    if (/TOXIC;|Highly toxic|Extremely Hazardous|life-threatening|extremely irritating/.test(blob)) return true;
    if (/highly flammable|extremely flammable|may explode/i.test(blob)) return true;
    return lines.some(function (item) { return /immediately/i.test(item.t || ""); });
  }

  function appendGuide(parent, book, num, named, files) {
    const parts = book.parts || {};
    if (book.title || named) {
      const title = document.createElement("p");
      title.className = "erg-title";
      title.textContent = named
        ? "Guide " + num + (book.title ? " · " + book.title : "")
        : book.title;
      const slot = !named && parent.querySelector(".placard-hit-copy");
      if (slot) {
        const names = slot.querySelector(".placard-hit-names");
        if (names) slot.insertBefore(title, names);
        else slot.appendChild(title);
      } else parent.appendChild(title);
    }
    const actions = parts.actions || [];
    const now = actions.filter(function (block) { return block.h === "Right away"; });
    const later = actions.filter(function (block) { return block.h !== "Right away"; });
    const distance = parts.distance || [];
    const lines = immediateItems(distance);
    const near = immediateMessage(lines) || firstGuideLine(distance);
    const color = hazardColor(files);
    const threat = lines.length > 0 && guideThreat(parts, lines);
    if (near) {
      const bar = document.createElement("p");
      bar.className = "erg-distance" + (threat ? " is-flash" : "");
      if (color) {
        bar.style.setProperty("--hazard", color);
        bar.style.setProperty("--hazard-on", hazardInk(color));
      }
      if (threat) {
        bar.addEventListener("animationend", function () {
          bar.classList.remove("is-flash");
          bar.classList.add("is-done");
        });
      }
      bar.textContent = near;
      parent.appendChild(bar);
    }
    const options = document.createElement("div");
    options.className = "erg-options";
    const panels = document.createElement("div");
    panels.className = "erg-panels";
    if (lines.length) {
      addGuideIcon(options, panels, "Immediate", [{ h: "", items: lines }], false, color);
    }
    addGuideIcon(options, panels, "Do this", now.map(function (block) {
      return { h: "", items: block.items };
    }), false);
    later.forEach(function (block) {
      addGuideIcon(options, panels, block.h || "Actions", [block], false);
    });
    addGuideIcon(options, panels, "Stay back", distance, JSON.stringify(distance).indexOf("Table 1") !== -1);
    addGuideIcon(options, panels, "Hazards", parts.hazards, false);
    addGuideIcon(options, panels, "Protective equipment", parts.gear, false);
    addGuideIcon(options, panels, "First aid", parts.firstaid, false);
    if (options.childElementCount) {
      parent.appendChild(options);
      parent.appendChild(panels);
    }
  }

  function renderPlacards() {
    const grid = document.getElementById("placard-grid");
    if (!grid || grid.childElementCount) return;
    grid.innerHTML = PLACARDS.map(function (item, index) {
      return (
        '<button type="button" class="placard-pick" data-placard="' + index + '" aria-pressed="false">' +
        '<img src="static/erg/placards/' + item.file + '" alt="" width="72" height="72" />' +
        "<span>" + escapeText(item.name) + "</span></button>"
      );
    }).join("");
  }

  function showPlacardPick() {
    const el = document.getElementById("placard-picked");
    if (!el) return;
    if (!placardPick) {
      el.textContent = "";
      return;
    }
    let text = placardPick.name;
    if (placardPick.cls) text += " · Class " + placardPick.cls;
    text += ". " + placardPick.text;
    const typed = document.getElementById("placard-no");
    const hasNumber = typed && String(typed.value || "").replace(/\D/g, "").length === 4;
    if (placardPick.guide && !hasNumber) {
      text += " If there is no four-digit number, the guidebook starts at Guide " + placardPick.guide + ".";
    }
    el.textContent = text;
  }

  function placardsForNumber(files) {
    const buttons = document.querySelectorAll("#placard-grid [data-placard]");
    let first = null;
    buttons.forEach(function (btn) {
      const item = PLACARDS[Number(btn.getAttribute("data-placard"))];
      const on = !!(item && files.indexOf(item.file) !== -1);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      if (on && !first) first = btn;
    });
    const dialog = document.getElementById("placards");
    if (first && first.scrollIntoView && !(dialog && dialog.classList.contains("is-numbered"))) {
      first.scrollIntoView({ block: "nearest" });
    }
    const matched = PLACARDS.filter(function (item) { return files.indexOf(item.file) !== -1; });
    placardPick = matched.length === 1 ? matched[0] : null;
    showPlacardPick();
  }

  function showPlacardHit() {
    const input = document.getElementById("placard-no");
    const hit = document.getElementById("placard-hit");
    if (!input || !hit) return;
    const num = String(input.value || "").replace(/\D/g, "").slice(0, 4);
    if (input.value !== num) input.value = num;
    const dialog = document.getElementById("placards");
    const numbered = num.length === 4;
    placardTicket += 1;
    if (dialog) dialog.classList.toggle("is-numbered", numbered);
    if (!numbered) {
      hit.textContent = "";
      placardsForNumber([]);
      markErgTop();
      return;
    }
    loadErgBook().then(function (book) {
      const row = book[num];
      if (!row) {
        showUnlistedNumber(hit, num);
        return;
      }
      const files = row.p || [];
      const names = row.n || [];
      placardsForNumber(files);
      hit.textContent = "";
      const head = document.createElement("div");
      head.className = "placard-hit-head";
      if (files.length) {
        const icons = document.createElement("div");
        icons.className = "placard-hit-icons";
        files.forEach(function (file) {
          const img = document.createElement("img");
          img.className = "placard-hit-img";
          img.src = "static/erg/placards/" + file;
          img.alt = "";
          icons.appendChild(img);
        });
        head.appendChild(icons);
      }
      const idWrap = document.createElement("div");
      idWrap.className = "placard-hit-copy";
      const idLine = document.createElement("p");
      idLine.className = "placard-hit-id";
      idLine.textContent = num + " · Guide " + row.g;
      idWrap.appendChild(idLine);
      if (names.length) {
        const list = document.createElement("ul");
        list.className = "placard-hit-names";
        names.forEach(function (name) {
          const item = document.createElement("li");
          item.textContent = name;
          list.appendChild(item);
        });
        idWrap.appendChild(list);
      }
      head.appendChild(idWrap);
      hit.appendChild(head);
      if (names.join(" ").toLowerCase().indexOf("n.o.s.") !== -1) {
        const note = document.createElement("p");
        note.className = "placard-hit-note";
        note.textContent = "n.o.s. means not otherwise specified: it fits that line, but has no name of its own.";
        hit.appendChild(note);
      }
      const ticket = placardTicket;
      const guidesForRow = guideNumbers(row.g);
      loadErgGuides().then(function (guides) {
        if (ticket !== placardTicket) return;
        const known = guidesForRow.filter(function (num) { return guides[num]; });
        known.forEach(function (num, index) {
          appendGuide(hit, guides[num], num, known.length > 1 || index > 0, files);
        });
        const credit = document.createElement("p");
        credit.className = "erg-credit";
        credit.textContent = known.length
          ? "2024 ERG · first minutes of a transportation incident, not a workplace safety sheet."
          : "This number has no action page in the 2024 guidebook.";
        hit.appendChild(credit);
      }, function () {
        if (ticket !== placardTicket) return;
        const credit = document.createElement("p");
        credit.className = "erg-credit";
        credit.textContent = "The action pages did not load.";
        hit.appendChild(credit);
      });
      markErgTop();
    }, function () {
      hit.textContent = "The number list did not load.";
    });
  }

  let ergTop = null;
  let ergTopLoad = null;

  function loadErgTop() {
    if (ergTop) return Promise.resolve(ergTop);
    if (!ergTopLoad) {
      ergTopLoad = fetch("static/erg/top100.json").then(function (res) {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      }).then(function (data) {
        ergTop = data;
        return data;
      });
    }
    return ergTopLoad;
  }

  function markErgTop() {
    const input = document.getElementById("placard-no");
    const current = input ? String(input.value || "").replace(/\D/g, "").slice(0, 4) : "";
    document.querySelectorAll(".erg-top-row").forEach(function (row) {
      row.classList.toggle("is-on", row.getAttribute("data-erg-id") === current);
    });
  }

  function showUnlistedNumber(hit, num) {
    const ticket = placardTicket;
    loadErgTop().then(function (top) {
      if (ticket !== placardTicket) return;
      const known = top.find(function (item) { return item.id === num; });
      markErgTop();
      if (!known) {
        hit.textContent = "That number is not in the 2024 guidebook.";
        placardsForNumber([]);
        return;
      }
      placardsForNumber(known.file ? [known.file] : []);
      hit.textContent = "";
      const idLine = document.createElement("p");
      idLine.className = "placard-hit-id";
      idLine.textContent = num + " · " + known.name;
      hit.appendChild(idLine);
      const note = document.createElement("p");
      note.className = "placard-hit-note";
      note.textContent = "Class " + known.cls + ", " + known.hazard + ". " + known.use + ".";
      hit.appendChild(note);
      if (!known.guide) return;
      const division = document.createElement("p");
      division.className = "placard-hit-note";
      division.textContent = "The guidebook lists this explosive by division, not by this number.";
      hit.appendChild(division);
      loadErgGuides().then(function (guides) {
        if (ticket !== placardTicket || !guides[known.guide]) return;
        appendGuide(hit, guides[known.guide], known.guide, true, known.file ? [known.file] : []);
        const credit = document.createElement("p");
        credit.className = "erg-credit";
        credit.textContent = "2024 ERG · first minutes of a transportation incident, not a workplace safety sheet.";
        hit.appendChild(credit);
      });
    }, function () {
      if (ticket !== placardTicket) return;
      hit.textContent = "That number is not in the 2024 guidebook.";
      placardsForNumber([]);
    });
  }

  function guideLabel(raw) {
    const parts = [];
    String(raw || "").split(/\s*\/\s*/).forEach(function (part) {
      if (part && parts.indexOf(part) === -1) parts.push(part);
    });
    return parts.join(" / ");
  }

  function searchErgRows(top, book, query) {
    const byId = {};
    top.forEach(function (row) { byId[row.id] = row; });
    if (!query) return { title: "", rows: top, more: 0, searching: false };
    const q = query.toLowerCase();
    const digits = /^\d+$/.test(q);
    const hits = [];
    const seen = {};
    function push(id, rec) {
      if (seen[id]) return;
      const rich = byId[id];
      const names = (rec && rec.n) || (rich ? [rich.name] : []);
      const name = (rich && rich.name) || names[0] || "";
      if (!name) return;
      const guide = guideLabel((rec && rec.g) || (rich && rich.guide) || "");
      const others = [];
      names.forEach(function (item) {
        if (item && item.toLowerCase() !== name.toLowerCase() && others.indexOf(item) === -1) others.push(item);
      });
      const detail = rich
        ? [rich.use, rich.cls && rich.hazard ? rich.cls + " " + rich.hazard : ""].filter(Boolean).join(" · ")
        : others.join(", ");
      const blob = [id, name, others.join(" "), guide, rich ? rich.cls + " " + rich.hazard + " " + rich.use : ""].join(" ").toLowerCase();
      const idHit = digits && id.indexOf(q) !== -1;
      const textHit = !digits && blob.indexOf(q) !== -1;
      if (!idHit && !textHit) return;
      seen[id] = true;
      let rank = 5;
      if (id === q) rank = 0;
      else if (digits && id.indexOf(q) === 0) rank = 1;
      else if (name.toLowerCase().indexOf(q) === 0) rank = 2;
      else if (names.some(function (item) { return String(item).toLowerCase().indexOf(q) === 0; })) rank = 3;
      else if (name.toLowerCase().indexOf(q) !== -1) rank = 4;
      hits.push({
        id: id,
        name: name,
        cls: rich ? rich.cls : "",
        hazard: rich ? rich.hazard : "",
        use: rich ? rich.use : "",
        guide: guide,
        detail: detail,
        rank: rank,
      });
    }
    Object.keys(book || {}).forEach(function (id) { push(id, book[id]); });
    top.forEach(function (row) { if (!book || !book[row.id]) push(row.id, null); });
    hits.sort(function (a, b) { return a.rank - b.rank || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
    const limit = 40;
    const shown = hits.slice(0, limit);
    const title = hits.length
      ? (hits.length > limit ? shown.length + " of " + hits.length : hits.length + (hits.length === 1 ? " match" : " matches"))
      : "No matches";
    return { title: title, rows: shown, more: Math.max(0, hits.length - limit), searching: true };
  }

  function ergTopButton(row, current, searching) {
    const on = row.id === current ? " is-on" : "";
    let meta = "";
    let klass = "";
    let use = "";
    if (!searching) {
      meta = row.cls + " · " + row.hazard + " · " + row.use;
      klass = "<b>" + escapeText(row.cls) + "</b> " + escapeText(row.hazard);
      use = escapeText(row.use);
    } else {
      const bits = [];
      if (row.guide) bits.push("Guide " + row.guide);
      if (row.detail) bits.push(row.detail);
      meta = bits.join(" · ");
      klass = row.guide ? "Guide " + escapeText(row.guide) : "";
      use = escapeText(row.detail || "");
    }
    return '<button type="button" class="erg-top-row' + on + '" data-erg-id="' + escapeText(row.id) + '">' +
      '<span class="erg-top-id">' + escapeText(row.id) + "</span>" +
      '<span class="erg-top-body">' +
      '<span class="erg-top-name">' + escapeText(row.name) + "</span>" +
      '<span class="erg-top-meta">' + escapeText(meta) + "</span>" +
      '<span class="erg-top-class">' + klass + "</span>" +
      '<span class="erg-top-use">' + use + "</span>" +
      "</span></button>";
  }

  function renderErgTop() {
    const list = document.getElementById("placard-common-list");
    const qEl = document.getElementById("placard-common-q");
    const title = document.getElementById("placard-common-title");
    if (!list) return;
    loadErgTop().then(function (top) {
      return loadErgBook().then(function (book) {
        return { top: top, book: book };
      }, function () {
        return { top: top, book: {} };
      });
    }).then(function (loaded) {
      const q = (qEl && qEl.value || "").trim();
      const found = searchErgRows(loaded.top, loaded.book, q);
      if (title) title.textContent = found.title;
      const current = String((document.getElementById("placard-no") || {}).value || "").replace(/\D/g, "").slice(0, 4);
      const head = found.searching
        ? '<div class="erg-top-head" aria-hidden="true"><span>No.</span><span>Material</span><span>Guide</span><span>Details</span></div>'
        : '<div class="erg-top-head" aria-hidden="true"><span>No.</span><span>Material</span><span>Class</span><span>Where you see it</span></div>';
      const rows = found.rows.map(function (row) { return ergTopButton(row, current, found.searching); }).join("");
      const empty = found.searching
        ? '<p class="muted erg-top-empty">Nothing in the 2024 guidebook matches.</p>'
        : '<p class="muted erg-top-empty">The common numbers did not load.</p>';
      const more = found.more ? '<p class="muted erg-top-empty">Keep typing to narrow this list.</p>' : "";
      list.innerHTML = head + (rows || empty) + more;
    }, function () {
      list.innerHTML = '<p class="muted erg-top-empty">The number list did not load.</p>';
    });
  }

  document.addEventListener("click", function (event) {
    const opener = event.target.closest && event.target.closest("[data-entry-legend]");
    if (!opener) return;
    const dialog = document.getElementById("entry-legend-dialog");
    if (!dialog || typeof dialog.showModal !== "function" || dialog.open) return;
    dialog.showModal();
  });

  document.addEventListener("click", function (event) {
    const opener = event.target.closest && event.target.closest("[data-placards]");
    if (!opener) return;
    const dialog = document.getElementById("placards");
    if (!dialog || typeof dialog.showModal !== "function") return;
    renderPlacards();
    renderErgTop();
    loadErgBook().catch(function () {});
    loadErgGuides().catch(function () {});
    if (!dialog.open) dialog.showModal();
    const no = document.getElementById("placard-no");
    if (no) no.focus();
  });
  document.addEventListener("click", function (event) {
    const pick = event.target.closest && event.target.closest("#placard-grid [data-placard]");
    if (!pick) return;
    const item = PLACARDS[Number(pick.getAttribute("data-placard"))];
    if (!item) return;
    const on = placardPick !== item;
    placardPick = on ? item : null;
    document.querySelectorAll("#placard-grid [data-placard]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn === pick && on ? "true" : "false");
    });
    showPlacardPick();
  });
  const placardNo = document.getElementById("placard-no");
  if (placardNo) placardNo.addEventListener("input", showPlacardHit);
  const placardCommonQ = document.getElementById("placard-common-q");
  if (placardCommonQ) {
    placardCommonQ.addEventListener("input", renderErgTop);
    placardCommonQ.addEventListener("keydown", function (event) {
      if (event.key === "Enter") event.preventDefault();
    });
  }
  document.addEventListener("click", function (event) {
    const row = event.target.closest && event.target.closest(".erg-top-row");
    if (!row || !placardNo) return;
    placardNo.value = row.getAttribute("data-erg-id") || "";
    showPlacardHit();
    const hit = document.getElementById("placard-hit");
    if (hit && hit.scrollIntoView) hit.scrollIntoView({ block: "nearest" });
  });

  function acroKeyHtml(meanings, groups, types) {
    meanings = meanings || {};
    const roads = meanings.railroads || RR_MEANINGS || {};
    const typeMap = meanings.types || TYPE_MEANINGS || {};
    const groupList = groups || RAILROAD_GROUPS || [];
    const typeList = types && types.length ? types : TRAIN_TYPES;
    function pairs(names, map) {
      return names
        .filter(Boolean)
        .map(function (name) {
          const meaning = map[name] || "";
          return (
            "<div><dt>" +
            escapeText(name) +
            "</dt><dd>" +
            escapeText(meaning) +
            "</dd></div>"
          );
        })
        .join("");
    }
    const seen = {};
    const roadBlocks = [];
    groupList.forEach(function (group) {
      const names = [];
      (group.railroads || []).forEach(function (name) {
        if (!name || seen[name]) return;
        seen[name] = 1;
        names.push(name);
      });
      if (!names.length) return;
      roadBlocks.push(
        '<section class="acro-key-group"><h5>' +
          escapeText(group.label || "") +
          "</h5><dl>" +
          pairs(names, roads) +
          "</dl></section>"
      );
    });
    if (!roadBlocks.length && !typeList.length) return "";
    return (
      "<h3>Legend</h3>" +
      '<div class="acro-key-grid">' +
      (roadBlocks.length
        ? '<div class="acro-key-roads"><h4>Railroads</h4>' + roadBlocks.join("") + "</div>"
        : "") +
      (typeList.length
        ? '<div class="acro-key-types"><h4>Train Types</h4><dl>' + pairs(typeList, typeMap) + "</dl></div>"
        : "") +
      "</div>"
    );
  }

  function fillAcroKey(meanings, groups, types) {
    const html = acroKeyHtml(meanings, groups, types);
    ["entry-key", "dash-log-key", "import-key"].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = html;
      if (id === "entry-key") {
        el.hidden = !html;
        const opener = document.querySelector("[data-entry-legend]");
        if (opener) opener.hidden = !html;
        return;
      }
      if (id === "dash-log-key") {
        (el.querySelector(".acro-key-grid") || el).insertAdjacentHTML(
          "beforeend",
          '<div class="symbol-key-inline" data-symbol-inline><h4>Train Symbols</h4><div data-symbol-inline-body>' +
            symbolKeyBodyHtml(symbolKeyRoad) +
            "</div></div>"
        );
        const btn = document.getElementById("dash-log-legend");
        if (btn) btn.hidden = !html;
        return;
      }
      el.hidden = !html;
    });
  }

  function applySubsPayload(data) {
    if (data && data.grouped) {
      SUBS_BY_RR = data.grouped;
    window.SUBS_BY_RR_FOR_SETTINGS = SUBS_BY_RR;
      SUB_COUNTS = data.counts || {};
      return;
    }
    SUBS_BY_RR = data || {};
  }

  async function ensureSubs(force) {
    if (!force && Object.keys(SUBS_BY_RR).length) return;
    const result = await api("/api/subdivisions");
    applySubsPayload(result.data);
  }

  async function addSubdivisionCsv(file, row) {
    try {
      const text = await file.text();
      const body = new FormData();
      body.append("file", new Blob([text], { type: "text/csv" }), file.name || "subdivision.csv");
      const result = await api("/api/subdivisions/import", {
        method: "POST",
        body: body,
        work: { title: "Importing subdivision CSV…", poll: true },
      });
      const data = result.data || {};
      if (!result.ok) {
        showBanner(data.error || "Could not add that subdivision CSV.", "error");
        return;
      }
      SUBS_BY_RR = data.grouped || SUBS_BY_RR;
      if (data.counts) SUB_COUNTS = data.counts;
      showBanner(data.message || "Subdivision list updated.", "ok");
      const editor = document.getElementById("sub-editor");
      if (editor && editor.open) editor.close();
      if (window.trainLogDashboard && window.trainLogDashboard.load) window.trainLogDashboard.load();
      if (!row) return;
      fillSubSelect(row, data.subdivision || subOf(row));
      const loc = row.querySelector(".f-loc");
      if (loc) loadSuggestions(loc.value, row.querySelector(".suggest"), loc, row);
    } catch (err) {
      showBanner((err && err.message) || "Could not add that subdivision CSV.", "error");
    }
  }

  function relabelRows() {
    const next = dayEntries.length + 1;
    Array.prototype.forEach.call(rowsEl.querySelectorAll(".train-row"), function (row, index) {
      const label = row.querySelector(".row-index");
      if (label && !editingId) label.textContent = "Train " + (next + index);
    });
    const dayCountText = dayEntries.length
      ? dayEntries.length + (dayEntries.length === 1 ? " train logged" : " trains logged")
      : "No trains yet";
    ["day-count", "masthead-day-count", "under-day-count"].forEach(function (id) {
      const countEl = document.getElementById(id);
      if (countEl) countEl.textContent = dayCountText;
    });
    paintLastTrain();
  }

  function entryMinutes(time) {
    const match = /^(\d{1,2}):(\d{2})/.exec(String(time || ""));
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  }

  function agoText(mins) {
    if (mins < 1) return "just now";
    if (mins < 60) return mins + " min ago";
    const hours = Math.floor(mins / 60);
    const rest = mins % 60;
    return hours + " hr" + (rest ? " " + rest + " min" : "") + " ago";
  }

  function paintLastTrain() {
    const targets = ["last-train", "under-last-train"]
      .map(function (id) { return document.getElementById(id); })
      .filter(Boolean);
    const mastAgo = document.getElementById("masthead-last-ago");
    if (!targets.length && !mastAgo) return;
    let best = null;
    dayEntries.forEach(function (entry) {
      const at = entryMinutes(entry.time);
      if (at == null) return;
      if (!best || at > best.at || (at === best.at && Number(entry.id) > Number(best.entry.id))) best = { at: at, entry: entry };
    });
    if (!best) {
      targets.forEach(function (el) {
        el.hidden = true;
        el.textContent = "";
      });
      if (mastAgo) {
        mastAgo.hidden = true;
        mastAgo.textContent = "";
      }
      return;
    }
    const now = new Date();
    const since = now.getHours() * 60 + now.getMinutes() - best.at;
    const ago = since >= 0 ? agoText(since) : "";
    const entry = best.entry;
    const bits = [entry.lead_locomotive || entry.railroad, entry.direction, entry.location_spot, formatPadTime(entry.time)].filter(Boolean);
    const text = "Last train" + (ago ? " " + ago : "") + (bits.length ? " · " + bits.join(" · ") : "");
    targets.forEach(function (el) {
      el.hidden = false;
      el.textContent = text;
    });
    if (mastAgo) {
      if (ago) {
        mastAgo.hidden = false;
        mastAgo.textContent = ago;
      } else {
        mastAgo.hidden = true;
        mastAgo.textContent = "";
      }
    }
  }

  function directionWord(value) {
    const raw = String(value || "").trim();
    const key = raw.toLowerCase();
    const map = {
      n: "north",
      s: "south",
      e: "east",
      w: "west",
      north: "north",
      south: "south",
      east: "east",
      west: "west",
      stopped: "stopped",
    };
    return map[key] || raw;
  }

  function shortPlace(value) {
    return String(value || "")
      .replace(/\s*\(mp[^)]*\)/i, "")
      .trim();
  }

  function formatLoggedBanner(filled, result, isUpdate) {
    const rows = Array.isArray(filled) ? filled : [];
    const created = (result && result.data && result.data.created) || [];
    const sample = (created[0] && created[0].entry) || rows[0] || null;
    const count = isUpdate ? 1 : created.length || rows.length || 0;
    if (!sample || !count) return isUpdate ? "Train updated." : "Train logged.";
    const lead = String(sample.lead_locomotive || "").trim();
    const road = String(sample.railroad || "").trim();
    const power = lead || road;
    const dir = directionWord(sample.direction);
    const place = shortPlace(sample.location_spot || sample.location_subdivision || "");
    const when = formatPadTime(sample.time);
    const bits = [];
    if (power) bits.push(power);
    if (dir) bits.push(dir);
    if (place) bits.push("at " + place);
    if (when) bits.push("· " + when);
    const detail = bits.join(" ").replace(/\s+·/g, " ·").trim();
    if (isUpdate) return detail ? "Updated " + detail + "." : "Train updated.";
    if (count > 1) return "Logged " + count + " trains.";
    return detail ? "Logged " + detail + "." : "Train logged.";
  }

  let gapEnds = 0;
  let gapTick = 0;
  let gapLength = 15 * 60;
  const GAP_DONE = "Time to go!";
  try {
    const saved = Number(localStorage.getItem("rr-gap-length"));
    if (saved >= 1 && saved <= 99 * 60 + 59) gapLength = saved;
  } catch (err) {}

  function clearGapMessage() {
    if (bannerEl && bannerEl.textContent === GAP_DONE) showBanner("");
  }

  function paintGapTimer() {
    const btn = document.getElementById("btn-gap-timer");
    const board = document.getElementById("gap-board");
    const status = document.getElementById("gap-status");
    const start = document.getElementById("gap-start");
    const stop = document.getElementById("gap-stop");
    const edit = document.getElementById("gap-edit");
    const left = gapEnds ? Math.max(0, Math.ceil((gapEnds - Date.now()) / 1000)) : gapLength;
    const running = gapEnds && left > 0;
    const done = gapEnds && left === 0;
    const label = done ? GAP_DONE : Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0");
    if (board) {
      board.classList.toggle("is-running", !!running);
      board.classList.toggle("is-done", !!done);
    }
    const face = (Math.floor(left / 60) + "" ).padStart(2, "0") + String(left % 60).padStart(2, "0");
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    face.split("").forEach(function (ch, index) {
      const flap = document.getElementById("gap-d" + index);
      if (!flap || flap.textContent === ch) return;
      flap.textContent = ch;
      if (reduceMotion) return;
      flap.classList.remove("is-flip");
      void flap.offsetWidth;
      flap.classList.add("is-flip");
    });
    if (status) {
      status.textContent = done ? GAP_DONE : (running ? "Clock is running" : "");
      status.hidden = !status.textContent;
    }
    if (start) start.hidden = !!running;
    if (stop) stop.hidden = !running;
    if (edit) edit.hidden = !!running;
    if (running) closeGapEdit();
    const idleMin = Math.floor(gapLength / 60);
    const idleSec = gapLength % 60;
    const idleLabel = idleSec ? idleMin + ":" + String(idleSec).padStart(2, "0") : idleMin + " min";
    const chipText = done ? "Done" : running || gapEnds ? label : idleLabel;
    const title = done
      ? "Time to go! Open the countdown."
      : "Open the countdown timer, " + idleLabel + ".";
    const aria = done
      ? "Time to go! Open the countdown."
      : "Open the countdown timer, " + (gapEnds ? label : idleLabel);
    // Live countdown belongs on the rail / pad chip. The Tools drawer button stays "Timer".
    const peeks = document.querySelectorAll("#btn-gap-timer, .foot-rail-timer");
    Array.prototype.forEach.call(peeks, function (peek) {
      const peekLabel = peek.querySelector(".gap-peek-label");
      if (peekLabel) peekLabel.textContent = chipText;
      else peek.textContent = chipText;
      peek.classList.toggle("is-running", !!running);
      peek.classList.toggle("is-done", !!done);
      peek.title = title;
      peek.setAttribute("aria-label", aria);
    });
    Array.prototype.forEach.call(document.querySelectorAll(".foot-gap"), function (peek) {
      const peekLabel = peek.querySelector(".gap-peek-label");
      if (peekLabel) peekLabel.textContent = "Timer";
      peek.classList.toggle("is-running", !!running);
      peek.classList.toggle("is-done", !!done);
      peek.title = done ? "Time to go! Open the countdown." : "Open the countdown timer";
      peek.setAttribute(
        "aria-label",
        done ? "Time to go! Open the countdown." : "Open the countdown timer, " + (gapEnds ? label : idleLabel)
      );
    });
    if (!btn) return;
    if (done) {
      showBanner(GAP_DONE);
      if (gapTick) {
        window.clearInterval(gapTick);
        gapTick = 0;
      }
    }
  }

  function readGapEdit() {
    const minEl = document.getElementById("gap-edit-min");
    const secEl = document.getElementById("gap-edit-sec");
    if (!minEl || !secEl) return null;
    const min = Math.max(0, Math.min(99, Math.floor(Number(minEl.value) || 0)));
    let sec = Math.floor(Number(secEl.value) || 0);
    if (sec < 0) sec = 0;
    if (sec > 59) sec = 59;
    const total = min * 60 + sec;
    return total >= 1 ? total : null;
  }

  function closeGapEdit() {
    const row = document.getElementById("gap-edit-row");
    const edit = document.getElementById("gap-edit");
    if (row) row.hidden = true;
    if (edit) edit.textContent = "Edit time";
  }

  function openGapEdit() {
    const row = document.getElementById("gap-edit-row");
    const edit = document.getElementById("gap-edit");
    const minEl = document.getElementById("gap-edit-min");
    const secEl = document.getElementById("gap-edit-sec");
    if (minEl) minEl.value = String(Math.floor(gapLength / 60));
    if (secEl) secEl.value = String(gapLength % 60);
    if (row) row.hidden = false;
    if (edit) edit.textContent = "Cancel";
    if (minEl) minEl.focus();
  }

  function saveGapLength(total) {
    gapLength = total;
    try { localStorage.setItem("rr-gap-length", String(gapLength)); } catch (err) {}
  }

  function applyGapEdit() {
    const total = readGapEdit();
    if (!total) return;
    saveGapLength(total);
    closeGapEdit();
    gapEnds = 0;
    if (gapTick) window.clearInterval(gapTick);
    gapTick = 0;
    clearGapMessage();
    paintGapTimer();
  }

  function startGapTimer() {
    const row = document.getElementById("gap-edit-row");
    if (row && !row.hidden) {
      const total = readGapEdit();
      if (!total) return;
      saveGapLength(total);
      closeGapEdit();
    }
    clearGapMessage();
    gapEnds = Date.now() + gapLength * 1000;
    if (gapTick) window.clearInterval(gapTick);
    gapTick = window.setInterval(paintGapTimer, 1000);
    paintGapTimer();
  }

  function stopGapTimer() {
    gapEnds = 0;
    if (gapTick) window.clearInterval(gapTick);
    gapTick = 0;
    clearGapMessage();
    paintGapTimer();
  }

  function openGapTimer() {
    const dialog = document.getElementById("gap-timer");
    if (dialog && !dialog.open) dialog.showModal();
    paintGapTimer();
  }


  function formatPadTime(value) {
    const text = String(value || "");
    const parts = text.split(":");
    if (parts.length < 2) return text;
    let hour = Number(parts[0]);
    const minute = parts[1];
    if (!Number.isFinite(hour)) return text;
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return hour + ":" + minute + " " + ampm;
  }

  const TZ_CHOICES = [
    ["America/New_York", "Eastern"],
    ["America/Chicago", "Central"],
    ["America/Denver", "Mountain"],
    ["America/Phoenix", "Arizona"],
    ["America/Los_Angeles", "Pacific"],
    ["America/Anchorage", "Alaska"],
    ["Pacific/Honolulu", "Hawaii"],
  ];
  let zonePick = null;

  function deviceZone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch (e) {
      return "";
    }
  }

  function defaultZone() {
    const device = deviceZone();
    return zonePick && zonePick.device === device ? zonePick.zone : device;
  }

  function zoneLabel(zone) {
    const hit = TZ_CHOICES.filter(function (choice) {
      return choice[0] === zone;
    })[0];
    return hit ? hit[1] : "";
  }

  function zoneAbbr(zone, date) {
    if (!zone) return "";
    try {
      const when = date ? new Date(date + "T12:00:00Z") : new Date();
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" }).formatToParts(when);
      const named = parts.filter(function (part) {
        return part.type === "timeZoneName";
      })[0];
      return named ? named.value : zone;
    } catch (e) {
      return zone;
    }
  }

  function zoneOptionsHtml(selected, date) {
    const choices = TZ_CHOICES.slice();
    [selected, deviceZone()].forEach(function (zone) {
      if (
        zone &&
        !choices.some(function (choice) {
          return choice[0] === zone;
        })
      ) {
        choices.push([zone, zone.split("/").pop().replace(/_/g, " ")]);
      }
    });
    return (
      '<option value="">No Zone</option>' +
      choices
        .map(function (choice) {
          return (
            '<option value="' +
            escapeText(choice[0]) +
            '"' +
            (choice[0] === selected ? " selected" : "") +
            ">" +
            escapeText(choice[1] + " " + zoneAbbr(choice[0], date)) +
            "</option>"
          );
        })
        .join("")
    );
  }

  function stateOf(row) {
    const select = row.querySelector(".f-state");
    return select ? select.value : "";
  }

  function setRowState(row, state) {
    const select = row.querySelector(".f-state");
    if (!select) return;
    const codes = STATE_CODES.slice();
    if (state && codes.indexOf(state) === -1) codes.push(state);
    select.innerHTML =
      '<option value="">—</option>' +
      codes
        .map(function (code) {
          return '<option value="' + escapeText(code) + '">' + escapeText(code) + "</option>";
        })
        .join("");
    select.value = state || "";
  }

  function stateZone(state) {
    if (!state || SPLIT_STATES.indexOf(state) !== -1) return "";
    return STATE_ZONES[state] || "";
  }

  function spotKey(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/\s*\(mp[^)]*\)/g, "")
      .replace(/\s*[·•].*$/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function newestZoned(match) {
    let best = null;
    const seen = {};
    dayEntries.concat(logEntries).forEach(function (entry) {
      if (!entry || seen[entry.id] || !entry.time_zone || !match(entry)) return;
      seen[entry.id] = true;
      if (!best || Number(entry.id) > Number(best.id)) best = entry;
    });
    return best;
  }

  function zoneForState(state) {
    if (!state) return "";
    const recent = newestZoned(function (entry) {
      return (entry.location_state || "") === state;
    });
    if (recent) return recent.time_zone;
    return STATE_ZONES[state] || "";
  }

  function guessLocationZone(row) {
    if (!row || row._zoneManual) return;
    const state = stateOf(row);
    if (state) {
      const zone = zoneForState(state);
      if (zone) {
        row._zoneGuessed = true;
        setRowZone(row, zone);
      }
      return;
    }
    const typed = spotKey(row.querySelector(".f-loc") && row.querySelector(".f-loc").value);
    if (typed.length < 3) return;
    const match = newestZoned(function (entry) {
      const spot = spotKey(entry.location_spot);
      return Boolean(spot && (spot === typed || (typed.length >= 4 && spot.indexOf(typed) === 0)));
    });
    if (!match) return;
    if (match.location_state) applyRowState(row, match.location_state);
    else {
      row._zoneGuessed = true;
      setRowZone(row, match.time_zone);
    }
  }

  function applyRowState(row, state) {
    setRowState(row, state);
    row._zoneManual = false;
    row._zoneGuessed = true;
    const zone = zoneForState(state);
    if (zone) {
      setRowZone(row, zone);
      if (!editingId) zonePick = { zone: zone, device: deviceZone() };
    }
    syncDayNight(row);
  }

  function fillNow(row) {
    const now = new Date();
    const today = todayISO();
    if (dateEl.value !== today) {
      dateEl.value = today;
      dateEl.dispatchEvent(new Event("change"));
    }
    const pm = now.getHours() >= 12;
    row.querySelector(".f-hh").value = now.getHours() % 12 || 12;
    row.querySelector(".f-mm").value = String(now.getMinutes()).padStart(2, "0");
    row.querySelectorAll(".f-ampm").forEach(function (btn) {
      btn.classList.toggle("is-on", (btn.getAttribute("data-ampm") === "PM") === pm);
    });
    const zone = deviceZone();
    if (zone) setRowZone(row, zone);
    dropInvalid(row.querySelector(".time-fields"));
    followClockDayNight(row);
    markEmpty(row);
  }

  function zoneButtonLabel(zone) {
    const date = (dateEl && dateEl.value) || "";
    const abbr = zoneAbbr(zone, date);
    const label = zoneLabel(zone) || (zone ? String(zone).split("/").pop().replace(/_/g, " ") : "");
    if (label && abbr) return label + ", " + abbr;
    return label || abbr || "No time zone";
  }

  function closeZoneMenus() {
    if (!rowsEl) return;
    Array.prototype.forEach.call(rowsEl.querySelectorAll(".tz-menu"), function (menu) {
      menu.hidden = true;
    });
  }

  function toggleZoneMenu(row) {
    const pick = row.querySelector(".tz-pick");
    const select = row.querySelector(".f-tz");
    if (!pick || !select) return;
    let menu = pick.querySelector(".tz-menu");
    if (menu && !menu.hidden) {
      menu.hidden = true;
      return;
    }
    closeZoneMenus();
    if (!menu) {
      menu = document.createElement("div");
      menu.className = "tz-menu";
      menu.setAttribute("role", "listbox");
      menu.hidden = true;
      pick.appendChild(menu);
    }
    const date = (dateEl && dateEl.value) || "";
    const current = select.value || "";
    const choices = [["", "No zone"]];
    TZ_CHOICES.forEach(function (choice) { choices.push(choice); });
    [current, deviceZone()].forEach(function (zone) {
      if (zone && !choices.some(function (choice) { return choice[0] === zone; })) {
        choices.push([zone, zone.split("/").pop().replace(/_/g, " ")]);
      }
    });
    menu.innerHTML = choices.map(function (choice) {
      const abbr = choice[0] ? zoneAbbr(choice[0], date) : "";
      const text = choice[0] ? choice[1] + (abbr ? " " + abbr : "") : choice[1];
      return '<button type="button" role="option" data-zone="' + escapeText(choice[0]) + '"' +
        (choice[0] === current ? ' class="is-on" aria-selected="true"' : "") + ">" + escapeText(text) + "</button>";
    }).join("");
    Array.prototype.forEach.call(menu.querySelectorAll("button"), function (button) {
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        row._zoneManual = true;
        row._zoneGuessed = false;
        setRowZone(row, button.getAttribute("data-zone") || "");
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
    menu.hidden = false;
  }

  function setRowZone(row, zone) {
    const select = row.querySelector(".f-tz");
    if (!select) return;
    select.innerHTML = zoneOptionsHtml(zone || "", dateEl && dateEl.value);
    select.value = zone || "";
    const btn = row.querySelector(".tz-btn");
    if (btn) {
      const named = zoneButtonLabel(zone);
      btn.setAttribute("aria-label", "Time zone, " + named);
      btn.title = named + (row._zoneManual
        ? ". Click to change the time zone."
        : row._zoneGuessed
          ? ". Guessed from the location. Click to change it."
          : ". This device's zone until a location is entered. Click to change it.");
    }
    updateZoneFlag(row);
    const menu = row.querySelector(".tz-menu");
    if (menu) menu.hidden = true;
  }

  function previousZone(date, beforeId) {
    let best = null;
    const seen = {};
    dayEntries.concat(logEntries).forEach(function (entry) {
      if (seen[entry.id] || entry.date !== date || !entry.time_zone) return;
      seen[entry.id] = true;
      if (beforeId && Number(entry.id) >= Number(beforeId)) return;
      if (!best || Number(entry.id) > Number(best.id)) best = entry;
    });
    return best ? best.time_zone : "";
  }

  function updateZoneFlag(row) {
    const flag = row.querySelector(".f-tz-flag");
    const select = row.querySelector(".f-tz");
    if (!flag || !select) return;
    const date = (dateEl && dateEl.value) || "";
    const before = previousZone(date, editingId);
    const zone = select.value;
    if (!before || !zone || before === zone) {
      flag.hidden = true;
      flag.textContent = "";
      flag.removeAttribute("title");
      return;
    }
    const from = zoneAbbr(before, date);
    const to = zoneAbbr(zone, date);
    flag.hidden = false;
    flag.textContent = "⇆ " + to;
    var tip = "Time zone changed from " + from + " to " + to + " since the last train logged this date.";
    try {
      if (zoneIsDST(before, date) !== zoneIsDST(zone, date)) {
        tip += " DST may have flipped — check the wall clock.";
      }
    } catch (e) {}
    tip += " Overnight trips often need an explicit zone pick when the date rolls.";
    flag.title = tip;
  }

  function updateZoneFlags() {
    Array.prototype.forEach.call(rowsEl.querySelectorAll(".train-row"), updateZoneFlag);
  }

  function zoneChanges(entries) {
    const byDate = {};
    entries.forEach(function (entry) {
      (byDate[entry.date] = byDate[entry.date] || []).push(entry);
    });
    const changes = {};
    Object.keys(byDate).forEach(function (date) {
      let last = "";
      byDate[date]
        .slice()
        .sort(function (a, b) {
          return (a.id || 0) - (b.id || 0);
        })
        .forEach(function (entry) {
          const zone = entry.time_zone || "";
          if (!zone) return;
          if (last && zone !== last) {
            changes[entry.id] = { from: zoneAbbr(last, date), to: zoneAbbr(zone, date) };
          }
          last = zone;
        });
    });
    return changes;
  }

  function timeCellHtml(text, entry, changes) {
    const change = changes[entry.id];
    const abbr = zoneAbbr(entry.time_zone, entry.date);
    return (
      '<span class="tz-time"' +
      (abbr ? ' title="' + escapeText(abbr) + '"' : "") +
      ">" +
      escapeText(text) +
      "</span>" +
      (change
        ? ' <span class="tz-flag" title="Time zone changed: ' +
          escapeText(change.from + " → " + change.to) +
          '">⇆ ' +
          escapeText(change.to) +
          "</span>"
        : "")
    );
  }

  function zoneCellHtml(entry) {
    const abbr = zoneAbbr(entry.time_zone, entry.date);
    if (!abbr) return '<span class="tz-cell is-none" title="No time zone set">—</span>';
    const away = entry.time_zone !== deviceZone();
    return (
      '<span class="tz-cell" title="' +
      escapeText((zoneLabel(entry.time_zone) || entry.time_zone) + (away ? " (not this Mac's zone)" : "")) +
      '">' + escapeText(abbr) + "</span>"
    );
  }

  const DAY_LOG_LAYOUTS = ["cards", "table"];
  let dayLogLayout = "cards";
  try {
    const savedDayLayout = localStorage.getItem("rr-day-log-layout");
    if (DAY_LOG_LAYOUTS.indexOf(savedDayLayout) !== -1) dayLogLayout = savedDayLayout;
  } catch (e) {}

  function dayLogCap() {
    // Phone/iPad keep a short stack (8 = even 4×2 cards on iPad, 2×4 on phone).
    // Mac shows the full day in a scrollable grid/table.
    return document.documentElement.classList.contains("is-field") ? 8 : 0;
  }

  function dayLogUsesCards() {
    return dayLogLayout !== "table";
  }

  function dayLogHeadHtml(headingText) {
    return (
      '<div class="day-log-head">' +
      '<p class="day-log-heading">' +
      escapeText(headingText) +
      "</p>" +
      '<label class="day-log-layout-picker">View' +
      '<select id="day-log-layout" aria-label="Logged trains layout">' +
      '<option value="cards">Cards</option>' +
      '<option value="table">Table</option>' +
      "</select></label></div>"
    );
  }

  function syncDayLogLayoutControl() {
    const layout = document.getElementById("day-log-layout");
    if (layout) layout.value = dayLogLayout;
  }

  function renderDayLog() {
    if (!dayLogEl) return;
    // Keep the panel in the entry form (never a body-mounted flyout).
    if (dayLogEl.parentElement === document.body) {
      const form = document.getElementById("entry-form");
      if (form) form.appendChild(dayLogEl);
    }
    dayLogEl.classList.remove("is-open");
    document.documentElement.classList.remove("day-log-flyout-open");
    const asCards = dayLogUsesCards();
    dayLogEl.classList.toggle("is-cards", asCards);
    dayLogEl.classList.toggle("is-table", !asCards);
    relabelRows();
    const cap = dayLogCap();
    const heading =
      !dayEntries.length
        ? "Logged this date"
        : cap && dayEntries.length > cap
          ? "Logged this date · last " + cap + " of " + dayEntries.length
          : "Logged this date · " + dayEntries.length + (dayEntries.length === 1 ? " train" : " trains");
    if (!dayEntries.length) {
      dayLogEl.innerHTML = dayLogHeadHtml(heading) + '<p class="day-empty">No trains logged on this date yet.</p>';
      syncDayLogLayoutControl();
      updateZoneFlags();
      return;
    }
    const changes = zoneChanges(dayEntries);
    const start = cap ? Math.max(0, dayEntries.length - cap) : 0;
    const shown = dayEntries.slice(start).reverse();
    function dayTrainNo(entry) {
      for (let i = 0; i < dayEntries.length; i++) {
        if (Number(dayEntries[i].id) === Number(entry.id)) return i + 1;
      }
      return 0;
    }
    let body = "";
    if (asCards) {
      body =
        '<div class="day-card-list">' +
        shown
          .map(function (entry) {
            const editing = editingId && Number(editingId) === Number(entry.id);
            const trainNo = dayTrainNo(entry);
            const miniBits = [
              entry.railroad || "",
              entry.lead_locomotive || "",
              entry.direction || "",
              entry.location_spot || "",
            ].filter(Boolean);
            return (
              '<article class="day-card is-mini' +
              (editing ? " is-editing" : "") +
              '" data-id="' +
              entry.id +
              '" tabindex="0" role="button" aria-label="View train ' +
              trainNo +
              '">' +
              '<div class="day-card-top">' +
              '<span class="entry-id" title="' +
              DAY_TRAIN_TITLE +
              '">' +
              trainNo +
              '</span><span class="day-card-time">' +
              timeCellHtml(formatPadTime(entry.time), entry, changes) +
              "</span></div>" +
              '<div class="day-card-mini">' +
              escapeText(miniBits.join(" · ") || "—") +
              "</div></article>"
            );
          })
          .join("") +
        "</div>";
    } else {
      const rows = shown
        .map(function (entry) {
          const editing = editingId && Number(editingId) === Number(entry.id);
          const trainNo = dayTrainNo(entry);
          const loc =
            (entry.location_spot || "") +
            (entry.location_state ? ", " + entry.location_state : "");
          return (
            '<tr class="' +
            (editing ? "is-editing" : "") +
            '" data-id="' +
            entry.id +
            '" tabindex="0" role="button" aria-label="View train ' +
            trainNo +
            '">' +
            '<td class="n"><span class="entry-id" title="' +
            DAY_TRAIN_TITLE +
            '">' +
            trainNo +
            "</span></td>" +
            "<td>" +
            timeCellHtml(formatPadTime(entry.time), entry, changes) +
            "</td><td>" +
            escapeText(entry.railroad || "") +
            "</td><td>" +
            leadCellHtml(entry) +
            "</td><td>" +
            escapeText(entry.train_symbol || "") +
            "</td><td>" +
            dirCellHtml(entry) +
            "</td><td>" +
            escapeText(entry.power_consist || "") +
            "</td><td>" +
            typeCellHtml(entry) +
            "</td><td>" +
            escapeText(loadDisplay(entry)) +
            "</td><td>" +
            escapeText(entry.car_counts || "") +
            '</td><td class="loc">' +
            escapeText(loc) +
            "</td><td>" +
            mediaCellHtml(entry, "") +
            "</td></tr>"
          );
        })
        .join("");
      body =
        '<div class="table-wrap day-table-wrap"><table class="day-table"><thead><tr>' +
        "<th>#</th><th>Time</th><th>RR</th><th>Lead</th><th>Symbol</th><th>Dir</th>" +
        "<th>Consist</th><th>Type</th><th>L/E</th><th>Cars</th><th>Location</th><th></th>" +
        "</tr></thead><tbody>" +
        rows +
        "</tbody></table></div>";
    }
    dayLogEl.innerHTML = dayLogHeadHtml(heading) + body;
    syncDayLogLayoutControl();
    const wrap = dayLogEl.querySelector(".day-card-list, .day-table-wrap");
    if (wrap) wrap.scrollTop = 0;
    updateZoneFlags();
  }

  async function loadDayLog() {
    if (!dateEl.value) {
      dayEntries = [];
      renderDayLog();
      const qsDialogEmpty = document.getElementById("quick-spots-dialog");
      if (qsDialogEmpty && qsDialogEmpty.open) paintQuickSpots();
      return;
    }
    const result = await api("/api/entries?date=" + encodeURIComponent(dateEl.value));
    dayEntries = (result.data || []).slice().reverse();
    renderDayLog();
    const qsDialog = document.getElementById("quick-spots-dialog");
    if (qsDialog && qsDialog.open) paintQuickSpots();
  }

  function setSelectValue(select, custom, value) {
    const known = !value || RAILROADS.indexOf(value) !== -1;
    select.value = known ? value || "" : "Other";
    custom.hidden = known;
    custom.value = known ? "" : value;
  }

  function railroadOf(row) {
    const select = row.querySelector(".f-rr");
    if (select.value === "Other") return row.querySelector(".f-rr-custom").value.trim();
    return select.value;
  }

  function subOf(row) {
    const select = row.querySelector(".f-sub");
    if (!select) return "";
    if (select.value === "Other") return row.querySelector(".f-sub-custom").value.trim();
    return select.value;
  }

  function markOf(row) {
    const select = row.querySelector(".f-mark");
    if (select.value === "Other") return row.querySelector(".f-mark-custom").value.trim();
    return select.value;
  }

  function selectedLoadStatus(row) {
    return ["Loads", "Empties"].filter(function (name) {
      const box = row.querySelector('[data-load="' + name + '"]');
      return box && box.checked;
    }).join("/");
  }

  function typeDisplay(entry) {
    return entry.train_types_label || (entry.train_types || []).join("/") || "";
  }

  function typeCellHtml(entry) {
    const label = escapeText(typeDisplay(entry));
    const coal = entry.coal_mark || "";
    const trade = [entry.con_overseas ? "Ovr" : "", entry.con_domestic ? "Dom" : ""].filter(Boolean).join(" · ");
    if (!entry.train_number && !coal && !trade) return label;
    return (
      '<span class="sub-name">' +
      label +
      "</span>" +
      (entry.train_number
        ? '<span class="sub-rr" title="' + escapeText(entry.train_number_info || "Train number") + '">#' + escapeText(entry.train_number) + "</span>"
        : "") +
      (coal ? '<span class="sub-rr" title="Coal train">' + escapeText(coal) + "</span>" : "") +
      (trade ? '<span class="sub-rr" title="' + escapeText([entry.con_overseas ? "Overseas" : "", entry.con_domestic ? "Domestic" : ""].filter(Boolean).join(", ")) + '">' + escapeText(trade) + "</span>" : "")
    );
  }

  function leadCellHtml(entry) {
    const lead = escapeText(entry.lead_locomotive || "");
    if (!entry.lead_status) return lead;
    const short = String(entry.lead_status)
      .split(/\s*,\s*/)
      .map(function (part) {
        if (part === "Too dark to see") return "Dark";
        if (part === "Too far") return "Far";
        return part;
      })
      .join(" · ");
    const note = '<span class="sub-rr" title="' + escapeText(entry.lead_status) + '">' + escapeText(short) + "</span>";
    return lead ? '<span class="sub-name">' + lead + "</span>" + note : note;
  }

  function mediaCellHtml(entry, sep) {
    const parts = [entry.photographed ? "P" : "", entry.videoed ? "V" : ""].filter(Boolean).join(sep);
    return (
      parts +
      (entry.night ? '<span class="night-tag" title="Night">' + MOON_ICON + "</span>" : "")
    );
  }

  function loadDisplay(entry) {
    return entry.load_status || "";
  }

  function selectedTypes(row) {
    const types = Array.prototype.map.call(row.querySelectorAll(".chip.is-on[data-type]"), function (chip) {
      return chip.getAttribute("data-type");
    });
    const other = row.querySelector(".f-type-other");
    const custom = row.querySelector(".f-type-custom").value.trim();
    if (other.classList.contains("is-on") && custom) types.push(custom);
    return types;
  }

  function readCars(row) {
    const a = row.querySelector(".f-cars-a").value.trim();
    const b = row.querySelector(".f-cars-b").value.trim();
    if (a && b) return a + "/" + b;
    return a || b;
  }

  function readConsist(row) {
    const a = row.querySelector(".f-c1").value.trim();
    const b = row.querySelector(".f-c2").value.trim();
    const c = row.querySelector(".f-c3").value.trim();
    if (a === "" && b === "" && c === "") return "";
    const units = a === "" ? "0" : String(Number(a));
    const helpers = b === "" ? "0" : String(Number(b));
    if (c === "") return units + "x" + helpers;
    const extra = String(Number(c));
    if (helpers === "0") return units + "x" + extra;
    return units + "x" + helpers + "x" + extra;
  }

  function readRow(row, requireComplete) {
    const hh = row.querySelector(".f-hh").value;
    const mm = row.querySelector(".f-mm").value;
    const ampmBtn = row.querySelector(".f-ampm.is-on");
    const ampm = ampmBtn ? ampmBtn.getAttribute("data-ampm") : "";
    const time = hh !== "" && mm !== "" && ampm ? String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0") : "";
    const payload = {
      row: Number(row.getAttribute("data-row")),
      date: dateEl.value,
      railroad: railroadOf(row),
      lead_mark: markOf(row),
      lead_locomotive: row.querySelector(".f-loco").value.trim(),
      direction: (row.querySelector("[data-dir].is-on") || {}).getAttribute
        ? row.querySelector("[data-dir].is-on").getAttribute("data-dir")
        : "",
      stopped: row.querySelector(".f-stopped").checked,
      in_siding: row.querySelector(".f-siding").checked,
      crew_change: row.querySelector(".f-crew").checked,
      no_crew: row.querySelector(".f-no-crew").checked,
      power_consist: readConsist(row),
      train_types: selectedTypes(row),
      load_status: selectedLoadStatus(row),
      car_counts: readCars(row),
      car_counts_b: "",
      location_spot: row.querySelector(".f-loc").value.trim(),
      location_state: stateOf(row),
      location_subdivision: subOf(row),
      time: time,
      ampm: ampm,
      time_zone: row.querySelector(".f-tz").value,
      trip_name: (tripEl && tripEl.value.trim()) || "",
      trip_date_from: (tripFromEl && tripFromEl.value) || "",
      trip_date_to: (tripToEl && tripToEl.value) || "",
      notes: row.querySelector(".f-notes-toggle").classList.contains("is-on")
        ? row.querySelector(".f-notes").value.trim()
        : "",
      train_symbol: row.querySelector(".f-symbol-toggle").classList.contains("is-on")
        ? cleanSymbol(row.querySelector(".f-symbol").value)
        : "",
      train_number: passOn(row) && row.querySelector(".f-passno")
        ? cleanSymbol(row.querySelector(".f-passno").value)
        : "",
      train_info: trainInfoOf(row),
      special_power: readSpecialWithUnits(row),
      photographed: row.querySelector(".f-photo").classList.contains("is-on"),
      videoed: row.querySelector(".f-video").classList.contains("is-on"),
      night: row.querySelector(".f-night").classList.contains("is-on"),
      lead_status: leadStatusOf(row),
      coal_mark: coalOn(row) && row.querySelector(".f-coal-mark") ? row.querySelector(".f-coal-mark").value.trim() : "",
      con_overseas: conOn(row) && row.querySelector(".f-con-overseas") ? row.querySelector(".f-con-overseas").checked : false,
      con_domestic: conOn(row) && row.querySelector(".f-con-domestic") ? row.querySelector(".f-con-domestic").checked : false,
    };
    if (requireComplete) {
      return payload;
    }
    return payload;
  }

  function rowIsFilled(payload) {
    return Boolean(
      payload.railroad ||
        payload.lead_locomotive ||
        payload.direction ||
        payload.stopped ||
        payload.in_siding ||
        payload.crew_change ||
        payload.no_crew ||
        payload.power_consist ||
        payload.location_spot ||
        payload.location_subdivision ||
        payload.car_counts ||
        (payload.train_types && payload.train_types.length) ||
        payload.load_status ||
        payload.notes ||
        payload.train_symbol ||
        payload.train_number ||
        payload.lead_status ||
        payload.coal_mark ||
        payload.con_overseas ||
        payload.con_domestic ||
        (payload.special_power && (payload.special_power.heritage.length || payload.special_power.steam.length || payload.special_power.units)) ||
        payload.time
    );
  }

  function clearRow(row) {
    clearInvalid(row);
    row.querySelector(".f-rr").value = "";
    row.querySelector(".f-rr-custom").hidden = true;
    row.querySelector(".f-rr-custom").value = "";
    row.querySelector(".f-rr").dataset.prev = "";
    row.querySelector(".f-mark").value = "";
    row.querySelector(".f-mark-custom").hidden = true;
    row.querySelector(".f-mark-custom").value = "";
    fillMarkSelect(row, "");
    row.querySelector(".f-loco").value = "";
    row.querySelector(".f-loco").maxLength = 4;
    setLeadStatus(row, "");
    row.querySelectorAll("[data-dir]").forEach(function (btn) {
      btn.classList.remove("is-on");
    });
    setStopFlags(row, false, false, false);
    row.querySelector(".f-c1").value = "";
    row.querySelector(".f-c2").value = "";
    row.querySelector(".f-c3").value = "";
    row.querySelector(".f-cars-a").value = "";
    row.querySelector(".f-cars-b").value = "";
    row.querySelectorAll(".chip[data-type]").forEach(function (chip) {
      chip.classList.remove("is-on");
    });
    setPassNo(row, "");
    setCoal(row, "", "");
    setCon(row, false, false);
    row.querySelector(".f-type-other").classList.remove("is-on");
    row.querySelector(".f-type-custom").hidden = true;
    row.querySelector(".f-type-custom").value = "";
    row.querySelectorAll("[data-load]").forEach(function (box) {
      box.checked = false;
    });
    row.querySelector(".f-loc").value = "";
    setRowState(row, "");
    fillSubSelect(row, "");
    row.querySelector(".f-hh").value = "";
    row.querySelector(".f-mm").value = "";
    row.querySelectorAll(".f-ampm").forEach(function (btn) {
      btn.classList.remove("is-on");
    });
    setRowZone(row, defaultZone());
    row.querySelector(".f-notes").value = "";
    row._storedInfo = null;
    setTrainInfo(row, "");
    setNotesOpen(row, false);
    row.querySelector(".f-symbol").value = "";
    fitInput(row.querySelector(".f-symbol"), 13);
    fitInput(row.querySelector(".f-type-custom"), 12);
    setSymbolOpen(row, false);
    row._dayNightManual = false;
    row.querySelectorAll(".f-photo, .f-video, .f-day, .f-night").forEach(function (chip) {
      chip.classList.remove("is-on");
    });
    syncDayNight(row);
    fillSpecial(row, null);
    refreshDecode(row);
    markEmpty(row);
  }

  function fillRow(row, entry) {
    const rr = entry.railroad || "";
    setSelectValue(row.querySelector(".f-rr"), row.querySelector(".f-rr-custom"), rr);
    row.querySelector(".f-rr").dataset.prev = row.querySelector(".f-rr").value;
    let loco = entry.lead_locomotive || "";
    let mark = entry.lead_mark || "";
    const knownMarks = RAILROADS;
    for (let i = 0; i < knownMarks.length; i += 1) {
      const prefix = knownMarks[i] + " ";
      if (loco.toUpperCase().indexOf(prefix) === 0) {
        mark = knownMarks[i];
        loco = loco.slice(prefix.length);
        break;
      }
      if (entry.lead_status && loco.toUpperCase() === knownMarks[i]) {
        mark = knownMarks[i];
        loco = "";
        break;
      }
    }
    fillMarkSelect(row, mark);
    row.querySelector(".f-loco").maxLength = Math.max(4, loco.replace(/\D/g, "").length);
    row.querySelector(".f-loco").value = loco;
    setLeadStatus(row, entry.lead_status || "", true);
    row.querySelectorAll("[data-dir]").forEach(function (btn) {
      const code = btn.getAttribute("data-dir");
      const current = entry.direction || "";
      btn.classList.toggle("is-on", code === current || code.charAt(0) === current);
    });
    setStopFlags(row, entry.stopped, entry.in_siding, entry.crew_change, entry.no_crew);
    const consist = (entry.power_consist || "").split(/[xX×]/).filter(function (part) {
      return part !== "";
    });
    row.querySelector(".f-c1").value = consist[0] || "";
    row.querySelector(".f-c2").value = consist.length === 1 ? "0" : consist[1] || "";
    row.querySelector(".f-c3").value = consist.length >= 3 ? consist[2] : "";
    const cars = (entry.car_counts || "").split("/");
    row.querySelector(".f-cars-a").value = cars[0] || "";
    row.querySelector(".f-cars-b").value = cars[1] || "";
    const types = entry.train_types || [];
    row.querySelectorAll(".chip[data-type]").forEach(function (chip) {
      chip.classList.toggle("is-on", types.indexOf(chip.getAttribute("data-type")) !== -1);
    });
    setPassNo(row, entry.train_number || "");
    setCoal(row, entry.coal_mark || "");
    setCon(row, entry.con_overseas, entry.con_domestic);
    const extras = types.filter(function (type) {
      return TRAIN_TYPES.indexOf(type) === -1;
    });
    row.querySelector(".f-type-other").classList.toggle("is-on", extras.length > 0);
    row.querySelector(".f-type-custom").hidden = extras.length === 0;
    row.querySelector(".f-type-custom").value = extras.join("/");
    const loads = (entry.load_status || "").split("/").filter(Boolean);
    row.querySelectorAll("[data-load]").forEach(function (box) {
      box.checked = loads.indexOf(box.getAttribute("data-load")) !== -1;
    });
    row.querySelector(".f-loc").value = entry.location_spot || "";
    setRowState(row, entry.location_state || "");
    fillSubSelect(row, entry.location_subdivision || "");
    if (entry.time) {
      const parts = entry.time.split(":");
      let hour = Number(parts[0]);
      const minute = parts[1] || "00";
      const pm = hour >= 12;
      hour = hour % 12;
      if (hour === 0) hour = 12;
      row.querySelector(".f-hh").value = hour;
      row.querySelector(".f-mm").value = minute;
      row.querySelectorAll(".f-ampm").forEach(function (btn) {
        const isPm = btn.getAttribute("data-ampm") === "PM";
        btn.classList.toggle("is-on", pm ? isPm : !isPm);
      });
    } else {
      row.querySelectorAll(".f-ampm").forEach(function (btn) {
        btn.classList.remove("is-on");
      });
    }
    setRowZone(row, entry.time_zone || "");
    row._zoneManual = Boolean(entry.time_zone);
    row.querySelector(".f-notes").value = entry.notes || "";
    row._storedInfo = {
      text: entry.train_info || "",
      symbol: cleanSymbol(entry.train_symbol),
      number: cleanSymbol(entry.train_number),
    };
    setTrainInfo(row, entry.train_info || "");
    setNotesOpen(row, Boolean(entry.notes));
    row.querySelector(".f-symbol").value = entry.train_symbol || "";
    fitInput(row.querySelector(".f-symbol"), 13);
    fitInput(row.querySelector(".f-type-custom"), 12);
    setSymbolOpen(row, Boolean(entry.train_symbol));
    row._dayNightManual = false;
    row.querySelector(".f-photo").classList.toggle("is-on", Boolean(entry.photographed));
    row.querySelector(".f-video").classList.toggle("is-on", Boolean(entry.videoed));
    row.querySelector(".f-day").classList.remove("is-on");
    row.querySelector(".f-night").classList.toggle("is-on", Boolean(entry.night));
    syncDayNight(row);
    fillSpecial(row, entry.special_power);
    refreshDecode(row);
    markEmpty(row);
  }

  let resolveFormReady = function () {};
  const formReady = new Promise(function (resolve) { resolveFormReady = resolve; });

  window.__padDefaultsChanged = function () {
    if (!rowsEl) return;
    ensurePadBlankRows().then(function () {
      Array.prototype.forEach.call(rowsEl.querySelectorAll(".train-row.is-empty"), function (row) {
        applyPadDefaultsToRow(row);
      });
      syncPadCardRemoveButtons();
    });
    const spotsDialog = document.getElementById("quick-spots-dialog");
    if (spotsDialog && spotsDialog.open && typeof paintSpotsPadStarters === "function") {
      paintSpotsPadStarters();
    }
  };

  async function buildRows() {
    try {
      await ensureRailroads();
      rowsEl.innerHTML = "";
      const n = padBlankCount();
      for (let i = 0; i < n; i += 1) {
        rowsEl.insertAdjacentHTML("beforeend", rowTemplate(i));
      }
      Array.prototype.forEach.call(rowsEl.querySelectorAll(".train-row"), bindRow);
      await ensureSubs();
      window.SUBS_BY_RR_FOR_SETTINGS = SUBS_BY_RR;
      Array.prototype.forEach.call(rowsEl.querySelectorAll(".train-row"), function (row) {
        fillSubSelect(row, "");
        fillMarkSelect(row, "");
      });
      await loadDayLog();
      await refreshTripNames();
      await ensurePadBlankRows();
    } finally {
      resolveFormReady();
    }
  }

  let savedTrip = null;

  function readSessionTrip() {
    return {
      trip_name: tripEl ? tripEl.value.trim() : "",
      trip_date_from: tripFromEl ? tripFromEl.value : "",
      trip_date_to: tripToEl ? tripToEl.value : "",
    };
  }

  function writeSessionTrip(trip) {
    if (!tripEl) return;
    tripEl.value = (trip && trip.trip_name) || "";
    if (tripFromEl) tripFromEl.value = (trip && trip.trip_date_from) || "";
    if (tripToEl) tripToEl.value = (trip && trip.trip_date_to) || "";
    syncTripDetailsButton();
  }

  const tripDetailsBtn = document.getElementById("btn-trip-details");
  const tripDetailsDialog = document.getElementById("trip-details-dialog");

  function tripDetailsOf(name) {
    const key = String(name || "").trim().toLowerCase();
    if (!key || !tripEl) return null;
    const match = (tripEl._trips || []).filter(function (trip) {
      return typeof trip !== "string" && tripNameOf(trip).toLowerCase() === key;
    })[0];
    return (match && match.details) || null;
  }

  function milesDriven(details) {
    const start = String((details && details.start_miles) || "").trim();
    const end = String((details && details.end_miles) || "").trim();
    if (start === "" || end === "" || isNaN(start) || isNaN(end) || Number(end) < Number(start)) return null;
    return Math.round((Number(end) - Number(start)) * 10) / 10;
  }

  function fuelRows(details) {
    const log = details && details.fuel_log;
    return Array.isArray(log) ? log : [];
  }

  function hasTripDetails(details) {
    const defaults = details && details.logging_defaults;
    const hasDefaults = Boolean(defaults && (defaults.railroad || (defaults.hotspots && defaults.hotspots.length)));
    const hasPack = Boolean(details && details.packing && details.packing.length);
    return Boolean(details && (details.start_miles || details.end_miles || details.notes || details.attendees || details.vehicle || fuelRows(details).length || hasDefaults || hasPack));
  }

  function markTripMissing() {
    tripEl.classList.add("is-invalid");
    tripEl.addEventListener("input", function clear() {
      tripEl.classList.remove("is-invalid");
      tripEl.removeEventListener("input", clear);
    });
  }

  function syncTripDetailsButton() {
    if (!tripDetailsBtn || !tripEl) return;
    const name = tripEl.value.trim();
    const hasRange = Boolean((tripFromEl && tripFromEl.value) || (tripToEl && tripToEl.value));
    const has = Boolean(name || hasRange || hasTripDetails(tripDetailsOf(name)));
    tripDetailsBtn.classList.toggle("is-waiting", false);
    tripDetailsBtn.classList.toggle("has-details", has);
    tripDetailsBtn.title = name
      ? hasTripDetails(tripDetailsOf(name)) || hasRange
        ? "Trip name, dates, mileage, Logging Defaults, fuel, notes, and who came along on " + name + ". Open to change them."
        : "Add dates, mileage, Logging Defaults, fuel, notes, and who came along on " + name + "."
      : "Set the trip name, date range, mileage, Logging Defaults, fuel, notes, and who came along.";
    const label = name ? (name.length > 18 ? name.slice(0, 16) + "…" : name) : "Trip Details";
    const span = tripDetailsBtn.querySelector("span.trip-details-label");
    if (span) span.textContent = label;
    else tripDetailsBtn.textContent = label;
  }

  function syncSessionMore() {
    // Session "More" control was removed when trip fields moved into Trip Details.
    // Keep this name so date/match listeners still refresh the Trip Details chip.
    syncTripDetailsButton();
    const btn = document.getElementById("btn-session-more");
    if (!btn) return;
    const filled = Boolean(
      (tripEl && tripEl.value.trim()) ||
      (tripFromEl && tripFromEl.value) ||
      (tripToEl && tripToEl.value) ||
      (tripDetailsBtn && tripDetailsBtn.classList.contains("has-details"))
    );
    btn.classList.toggle("has-note", filled);
  }

  function pickList(kind, pastNames) {
    const listed = ((tripEl._picks && tripEl._picks[kind]) || []).slice();
    const keys = listed.map(function (name) {
      return name.toLowerCase();
    });
    const past = [];
    pastNames.forEach(function (name) {
      name = String(name || "").trim();
      if (name && keys.indexOf(name.toLowerCase()) === -1) {
        keys.push(name.toLowerCase());
        past.push(name);
      }
    });
    return listed.concat(
      past.sort(function (a, b) {
        return a.localeCompare(b);
      })
    );
  }

  function knownVehicles() {
    return pickList(
      "vehicles",
      (tripEl._trips || []).map(function (trip) {
        return trip && trip.details && trip.details.vehicle;
      })
    );
  }

  function fillPickSelect(select, label, names) {
    if (!select) return;
    select.hidden = !names.length;
    select.innerHTML =
      '<option value="">' +
      label +
      "</option>" +
      names
        .map(function (name) {
          return '<option value="' + escapeText(name) + '">' + escapeText(name) + "</option>";
        })
        .join("");
    select.value = "";
  }

  function knownAttendees() {
    const past = [];
    (tripEl._trips || []).forEach(function (trip) {
      attendeeList(trip && trip.details && trip.details.attendees).forEach(function (name) {
        past.push(name);
      });
    });
    return pickList("attendees", past);
  }

  function attendeeList(text) {
    return String(text || "")
      .split(/\s*[,;]\s*/)
      .map(function (name) {
        return name.trim();
      })
      .filter(Boolean);
  }

  function hideWhoSuggest(which) {
    ["trip-vehicle-suggest", "trip-attendee-suggest"].forEach(function (id) {
      if (which && id !== which) return;
      const box = document.getElementById(id);
      if (!box) return;
      box.hidden = true;
      box.innerHTML = "";
      box.style.display = "none";
    });
  }

  function paintWhoSuggest(box, names, onPick) {
    if (!box) return;
    if (!names.length) {
      box.hidden = true;
      box.innerHTML = "";
      box.style.display = "none";
      return;
    }
    box.innerHTML = names
      .map(function (name) {
        return '<button type="button">' + escapeText(name) + "</button>";
      })
      .join("");
    Array.prototype.forEach.call(box.children, function (button, index) {
      button.addEventListener("mousedown", function (event) {
        event.preventDefault();
        onPick(names[index]);
        hideWhoSuggest();
      });
    });
    box.hidden = false;
    box.style.display = "block";
  }

  function showVehicleSuggest() {
    const input = document.getElementById("trip-vehicle");
    const box = document.getElementById("trip-vehicle-suggest");
    if (!input || !box) return;
    const query = input.value.trim().toLowerCase();
    if (!query) {
      hideWhoSuggest("trip-vehicle-suggest");
      return;
    }
    const matches = knownVehicles().filter(function (name) {
      const lower = name.toLowerCase();
      return lower !== query && lower.indexOf(query) !== -1;
    }).slice(0, 8);
    paintWhoSuggest(box, matches, function (name) {
      input.value = name;
    });
  }

  function showAttendeeSuggest() {
    const input = document.getElementById("trip-attendees");
    const box = document.getElementById("trip-attendee-suggest");
    if (!input || !box) return;
    const raw = input.value;
    const parts = raw.split(/[,;]/);
    const prefix = parts.slice(0, -1).map(function (part) { return part.trim(); }).filter(Boolean);
    const fragment = (parts[parts.length - 1] || "").replace(/^\s+/, "");
    const query = fragment.trim().toLowerCase();
    if (!query) {
      hideWhoSuggest("trip-attendee-suggest");
      return;
    }
    const chosen = prefix.map(function (name) { return name.toLowerCase(); });
    const matches = knownAttendees().filter(function (name) {
      const lower = name.toLowerCase();
      if (chosen.indexOf(lower) !== -1) return false;
      return lower.indexOf(query) !== -1;
    }).slice(0, 8);
    paintWhoSuggest(box, matches, function (name) {
      const next = prefix.concat([name]);
      input.value = next.join(", ") + ", ";
      input.focus();
    });
  }

  // Kept for Manage / older call sites that refreshed the old pick menus.
  function renderVehiclePicks() {
    fillPickSelect(document.getElementById("trip-vehicle-picks"), "Pick a vehicle…", knownVehicles());
  }

  function renderAttendeePicks() {
    fillPickSelect(document.getElementById("trip-attendee-picks"), "Add an attendee…", knownAttendees());
  }

  function lastSavedTripField(field) {
    const trips = (tripEl && tripEl._trips) || [];
    for (let i = 0; i < trips.length; i += 1) {
      const details = trips[i] && trips[i].details;
      const value = details && String(details[field] || "").trim();
      if (value) return value;
    }
    return "";
  }

  function showTripMiles() {
    const start = document.getElementById("trip-start-miles").value.replace(/,/g, "").trim();
    const end = document.getElementById("trip-end-miles").value.replace(/,/g, "").trim();
    const out = document.getElementById("trip-miles-total");
    const driven = milesDriven({ start_miles: start, end_miles: end });
    out.replaceChildren();
    out.hidden = false;
    const num = document.createElement("b");
    num.className = "trip-miles-num" + (driven === null ? " is-empty" : "");
    num.textContent = driven === null ? "—" : driven.toLocaleString();
    const unit = document.createElement("span");
    unit.className = "trip-miles-unit";
    unit.textContent = "miles driven";
    out.append(num, unit);
    showFuelMetrics();
  }

  function fuelDayLabel(iso) {
    const parts = String(iso || "").split("-");
    if (parts.length !== 3) return iso ? iso : "";
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(date.getTime())) return iso;
    return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  }

  function entryCard() {
    return document.getElementById("trip-fuel-entry");
  }

  function cleanTempInput(raw) {
    let text = String(raw || "").replace(/[°º]/g, "").replace(/\s*f$/i, "").trim();
    if (text.endsWith(".0")) text = text.slice(0, -2);
    return text;
  }

  function draftFuel() {
    const card = entryCard();
    return {
      date: card.querySelector(".trip-fuel-date").value.trim(),
      time: (card.querySelector(".trip-fuel-time") && card.querySelector(".trip-fuel-time").value.trim()) || "",
      gallons: card.querySelector(".trip-fuel-gallons").value.replace(/,/g, "").trim(),
      cost: card.querySelector(".trip-fuel-cost").value.replace(/[$,]/g, "").trim(),
      place: card.querySelector(".trip-fuel-place").value.trim(),
      temperature: cleanTempInput(card.querySelector(".trip-fuel-temp").value),
    };
  }

  function draftBlank(item) {
    return !item.date && !item.time && !item.gallons && !item.cost && !item.place && !item.temperature;
  }

  function fuelDraftError(item) {
    if (draftBlank(item)) return "";
    if (item.temperature && (!/^-?\d{1,3}(?:\.\d)?$/.test(item.temperature) || Number(item.temperature) < -80 || Number(item.temperature) > 130)) {
      return "Outside temperature is a number in °F, like 72";
    }
    if (item.gallons && (!/^\d{1,4}(?:\.\d{1,3})?$/.test(item.gallons) || Number(item.gallons) <= 0)) {
      return "Gallons must be a number, like 12.4";
    }
    if (item.cost && !/^\d{1,5}(?:\.\d{1,2})?$/.test(item.cost)) {
      return "Fuel cost must be a number, like 48.20";
    }
    if (!item.gallons && !item.cost && !item.date) return "Each fill-up needs gallons or a cost";
    if (item.place.length > 80) return "The fill-up place is too long";
    if (item.time && !/^\d{1,2}:\d{2}$/.test(item.time)) return "Fill-up time looks like 15:42";
    return "";
  }

  function showTripError(text) {
    const error = document.getElementById("trip-details-error");
    if (!error) return;
    error.textContent = text || "";
    error.hidden = !text;
  }

  function itemFromRow(row) {
    return {
      date: row.dataset.date || "",
      time: row.dataset.time || "",
      gallons: row.dataset.gallons || "",
      cost: row.dataset.cost || "",
      place: row.dataset.place || "",
      temperature: row.dataset.temperature || "",
    };
  }

  function listItems() {
    return Array.prototype.map.call(document.querySelectorAll("#trip-fuel-log .trip-fuel-item"), itemFromRow);
  }

  function readFuelLog() {
    const rows = listItems();
    const draft = draftFuel();
    if (!draftBlank(draft)) {
      const at = entryCard()._editIndex;
      if (typeof at === "number" && at >= 0 && at <= rows.length) rows.splice(at, 0, draft);
      else rows.push(draft);
    }
    return rows;
  }

  function fuelNumber(text) {
    const n = Number(String(text || "").replace(/[$,]/g, "").trim());
    return text !== "" && text != null && !isNaN(n) ? n : null;
  }

  function pricePerGallon(gallons, cost) {
    const g = fuelNumber(gallons);
    const c = fuelNumber(cost);
    if (g === null || c === null || g <= 0) return "";
    return (Math.round((c / g) * 1000) / 1000).toFixed(3);
  }

  function fuelListItem(item) {
    const gallons = item.gallons || "";
    const cost = item.cost || "";
    const bits = [];
    const day = fuelDayLabel(item.date);
    if (day) bits.push(day);
    if (item.time) bits.push(formatPadTime(item.time));
    if (item.place) bits.push(item.place);
    if (item.temperature) bits.push(item.temperature + "°F");
    if (gallons) bits.push(Number(gallons).toLocaleString() + " gal");
    const perGallon = pricePerGallon(gallons, cost);
    if (perGallon) bits.push("$" + perGallon + "/gal");
    if (cost !== "" && !isNaN(cost)) {
      bits.push(Number(cost).toLocaleString(undefined, { style: "currency", currency: "USD" }));
    }
    const label = bits.join(" · ") || "Fill-up";
    return (
      '<div class="trip-fuel-item" data-date="' +
      escapeText(item.date || "") +
      '" data-time="' +
      escapeText(item.time || "") +
      '" data-place="' +
      escapeText(item.place || "") +
      '" data-gallons="' +
      escapeText(gallons) +
      '" data-cost="' +
      escapeText(cost) +
      '" data-temperature="' +
      escapeText(item.temperature || "") +
      '">' +
      '<button type="button" class="trip-fuel-item-main" title="Edit fill-up">' +
      escapeText(label) +
      "</button>" +
      '<button type="button" class="trip-fuel-remove" aria-label="Remove fill-up" title="Remove">×</button>' +
      "</div>"
    );
  }

  function renderFuelList(items) {
    const box = document.getElementById("trip-fuel-log");
    const rows = items || [];
    box.innerHTML = rows.map(fuelListItem).join("");
    box.hidden = !rows.length;
  }

  function setDraftMode(editing) {
    const add = document.getElementById("trip-fuel-add");
    const remove = document.getElementById("trip-fuel-remove-draft");
    const label = document.getElementById("trip-fuel-entry-label");
    if (add) add.textContent = editing ? "Update Fill-up" : "Add Fill-up";
    if (remove) remove.hidden = !editing;
    if (label) label.textContent = editing ? "Edit fill-up" : "New fill-up";
  }

  function clearDraft() {
    const card = entryCard();
    card.querySelectorAll("input").forEach(function (input) {
      input.value = "";
    });
    card._editIndex = null;
    setDraftMode(false);
  }

  function fillDraft(item, index) {
    const card = entryCard();
    card.querySelector(".trip-fuel-date").value = item.date || "";
    const timeEl = card.querySelector(".trip-fuel-time");
    if (timeEl) timeEl.value = item.time || "";
    card.querySelector(".trip-fuel-place").value = item.place || "";
    card.querySelector(".trip-fuel-gallons").value = item.gallons || "";
    card.querySelector(".trip-fuel-cost").value = item.cost || "";
    card.querySelector(".trip-fuel-temp").value = item.temperature || "";
    card.querySelector(".trip-fuel-price").value = pricePerGallon(item.gallons, item.cost);
    card._editIndex = index;
    setDraftMode(true);
  }

  function stampFuelTime() {
    const card = entryCard();
    const timeEl = card && card.querySelector(".trip-fuel-time");
    if (!timeEl) return;
    const now = new Date();
    timeEl.value =
      String(now.getHours()).padStart(2, "0") +
      ":" +
      String(now.getMinutes()).padStart(2, "0");
    timeEl.focus();
  }

  function commitDraft() {
    const item = draftFuel();
    if (draftBlank(item)) {
      entryCard().querySelector(".trip-fuel-date").focus();
      return;
    }
    const message = fuelDraftError(item);
    if (message) {
      showTripError(message);
      return;
    }
    const rows = listItems();
    const at = entryCard()._editIndex;
    if (typeof at === "number" && at >= 0 && at <= rows.length) rows.splice(at, 0, item);
    else rows.push(item);
    renderFuelList(rows);
    clearDraft();
    showTripError("");
    showFuelMetrics();
  }

  function syncFuelRow(row, source) {
    const gallons = row.querySelector(".trip-fuel-gallons");
    const price = row.querySelector(".trip-fuel-price");
    const cost = row.querySelector(".trip-fuel-cost");
    const g = fuelNumber(gallons.value);
    const p = fuelNumber(price.value);
    const c = fuelNumber(cost.value);
    if (source === price && g !== null && g > 0 && p !== null) {
      cost.value = (Math.round(g * p * 100) / 100).toFixed(2);
    } else if (source === gallons && g !== null && g > 0 && p !== null && document.activeElement === gallons) {
      cost.value = (Math.round(g * p * 100) / 100).toFixed(2);
    } else if (g !== null && g > 0 && c !== null) {
      price.value = pricePerGallon(g, c);
    }
  }

  function renderFuelLog(items) {
    renderFuelList(items || []);
    clearDraft();
    showFuelMetrics();
  }

  function tripTrainCount(name) {
    const trips = (tripEl && tripEl._trips) || [];
    const hit = trips.filter(function (trip) {
      return tripNameOf(trip) === name;
    })[0];
    const count = hit && Number(hit.trains);
    return count > 0 ? count : 0;
  }

  function rateNumber(value) {
    return (Math.round(value * 1000) / 1000).toLocaleString();
  }

  function fuelTotals(rows) {
    let gallons = 0;
    let cost = 0;
    let haveGallons = false;
    let haveCost = false;
    rows.forEach(function (item) {
      if (item.gallons !== "" && !isNaN(item.gallons) && Number(item.gallons) > 0) {
        gallons += Number(item.gallons);
        haveGallons = true;
      }
      if (item.cost !== "" && !isNaN(item.cost) && Number(item.cost) >= 0) {
        cost += Number(item.cost);
        haveCost = true;
      }
    });
    return { gallons: gallons, cost: cost, haveGallons: haveGallons, haveCost: haveCost };
  }

  function fuelText(rows, driven, brief, trains) {
    const totals = fuelTotals(rows);
    const gallons = totals.gallons;
    const cost = totals.cost;
    const parts = [];
    if (totals.haveGallons) parts.push((Math.round(gallons * 10) / 10).toLocaleString() + " gal");
    if (totals.haveCost) {
      parts.push(cost.toLocaleString(undefined, { style: "currency", currency: "USD" }));
    }
    if (totals.haveGallons && totals.haveCost && gallons > 0) {
      parts.push((cost / gallons).toLocaleString(undefined, { style: "currency", currency: "USD" }) + "/gal");
    }
    if (totals.haveGallons && driven && gallons > 0) {
      parts.push((Math.round((driven / gallons) * 10) / 10).toLocaleString() + " mpg");
    }
    if (totals.haveCost && driven && driven > 0) {
      parts.push((cost / driven).toLocaleString(undefined, { style: "currency", currency: "USD" }) + "/mile");
    }
    if (!brief && trains > 0 && driven > 0) parts.push(rateNumber(trains / driven) + " trains/mile");
    if (!brief && trains > 0 && totals.haveGallons && gallons > 0) parts.push(rateNumber(trains / gallons) + " trains/gal");
    if (!brief && trains > 0 && totals.haveCost) {
      parts.push((cost / trains).toLocaleString(undefined, { style: "currency", currency: "USD" }) + "/train");
    }
    return (brief ? parts.slice(0, 2) : parts).join(" · ");
  }

  function showFuelMetrics() {
    const out = document.getElementById("trip-fuel-metrics");
    if (!out) return;
    const driven = milesDriven({
      start_miles: document.getElementById("trip-start-miles").value,
      end_miles: document.getElementById("trip-end-miles").value,
    });
    const rows = readFuelLog();
    const liveName = (tripEl && tripEl.value.trim()) || (tripDetailsDialog && tripDetailsDialog._name) || "";
    const trains = tripTrainCount(liveName);
    const text = fuelText(rows, driven, false, 0);
    out.innerHTML = text
      ? text
          .split(" · ")
          .map(function (part) {
            return "<span>" + escapeText(part) + "</span>";
          })
          .join("")
      : "";
    const board = document.getElementById("trip-rate-board");
    if (!board) return;
    const totals = fuelTotals(rows);
    const money = function (n) {
      return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
    };
    const figures = [
      [trains > 0 && driven > 0 ? rateNumber(trains / driven) : "—", "Trains per mile"],
      [trains > 0 && totals.haveGallons && totals.gallons > 0 ? rateNumber(trains / totals.gallons) : "—", "Trains per gallon"],
      [trains > 0 && totals.haveCost ? money(totals.cost / trains) : "—", "Cost per train"],
    ];
    board.innerHTML = figures
      .map(function (fig) {
        return '<div class="trip-rate-figure"><b>' + escapeText(fig[0]) + "</b><span>" + escapeText(fig[1]) + "</span></div>";
      })
      .join("");
  }

  let tripPackingKit = null;
  let tripPackingKitDraft = null;

  function escapePacking(text) {
    return escapeText(String(text || ""));
  }

  async function loadTripPackingKit(force) {
    if (tripPackingKit && !force) return tripPackingKit;
    const result = await api("/api/trip-packing/kit", { quiet: true });
    if (result.ok && result.data && Array.isArray(result.data.kit)) {
      tripPackingKit = result.data.kit;
      return tripPackingKit;
    }
    tripPackingKit = [
      { label: "Scanner + spare batteries", group: "radio" },
      { label: "Camera + charged cards", group: "photo" },
      { label: "Phone + cable", group: "power" },
    ];
    return tripPackingKit;
  }

  function packingFromKit(kit) {
    return (kit || []).map(function (row) {
      const item = { label: String(row.label || "").trim(), done: false };
      if (row.group) item.group = String(row.group);
      return item;
    }).filter(function (row) { return row.label; });
  }

  function readTripPacking() {
    return Array.prototype.map.call(document.querySelectorAll("#trip-packing-list .trip-packing-item"), function (row) {
      const item = {
        label: row.getAttribute("data-label") || "",
        done: !!(row.querySelector('input[type="checkbox"]') && row.querySelector('input[type="checkbox"]').checked),
      };
      const group = row.getAttribute("data-group") || "";
      if (group) item.group = group;
      return item;
    }).filter(function (row) { return row.label; });
  }

  function packingGroupOrder() {
    return ["photo", "radio", "power", "kit", "safety"];
  }

  function setTripPackingListOpen(open) {
    const body = document.getElementById("trip-packing-body");
    const btn = document.getElementById("trip-packing-toggle");
    if (body) body.hidden = !open;
    if (btn) {
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.textContent = open ? "Hide list" : "Show list";
    }
  }

  function updateTripPackingProgress() {
    const el = document.getElementById("trip-packing-progress");
    const chips = document.getElementById("trip-packing-groups");
    const rows = readTripPacking();
    if (el) {
      if (!rows.length) el.textContent = "Use Manage to add the gear you take trackside.";
      else {
        const done = rows.filter(function (row) { return row.done; }).length;
        el.textContent = done + " of " + rows.length + " packed" + (done === rows.length ? " — ready" : "");
      }
    }
    if (!chips) return;
    if (!rows.length) {
      chips.innerHTML = "";
      return;
    }
    const byGroup = {};
    rows.forEach(function (row) {
      const key = String(row.group || "other").trim() || "other";
      if (!byGroup[key]) byGroup[key] = { total: 0, done: 0 };
      byGroup[key].total += 1;
      if (row.done) byGroup[key].done += 1;
    });
    const order = packingGroupOrder().concat(
      Object.keys(byGroup).filter(function (key) {
        return packingGroupOrder().indexOf(key) === -1;
      }).sort()
    );
    chips.innerHTML = order.filter(function (key) { return byGroup[key]; }).map(function (key) {
      const info = byGroup[key];
      const done = info.done === info.total;
      return (
        '<button type="button" class="trip-packing-chip' + (done ? " is-done" : "") + '" data-packing-group="' + escapePacking(key) + '" role="listitem">' +
        '<span class="trip-packing-chip-name">' + escapePacking(key) + "</span>" +
        '<span class="trip-packing-chip-count">' + info.done + "/" + info.total + "</span>" +
        "</button>"
      );
    }).join("");
    Array.prototype.forEach.call(document.querySelectorAll("#trip-packing-list .trip-packing-section"), function (section) {
      const items = section.querySelectorAll(".trip-packing-item");
      const done = section.querySelectorAll(".trip-packing-item.is-on").length;
      const countEl = section.querySelector(".trip-packing-section-count") ||
        section.querySelector(".trip-packing-section-title span:last-child");
      if (countEl) countEl.textContent = done + "/" + items.length;
      const allBtn = section.querySelector(".trip-packing-section-all");
      if (allBtn) {
        const allOn = items.length > 0 && done === items.length;
        allBtn.textContent = allOn ? "Clear" : "All";
        allBtn.setAttribute("aria-pressed", allOn ? "true" : "false");
        const key = allBtn.getAttribute("data-packing-all") || "group";
        allBtn.title = allOn ? ("Clear every item in " + key) : ("Mark every item in " + key + " packed");
      }
    });
  }

  function setTripPackingSectionAll(section, on) {
    if (!section) return;
    Array.prototype.forEach.call(section.querySelectorAll(".trip-packing-item"), function (item) {
      const box = item.querySelector('input[type="checkbox"]');
      if (!box) return;
      box.checked = !!on;
      item.classList.toggle("is-on", !!on);
    });
    updateTripPackingProgress();
  }

  function renderTripPacking(items) {
    const box = document.getElementById("trip-packing-list");
    if (!box) return;
    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) {
      box.innerHTML = '<p class="muted trip-packing-empty">No packing list yet.</p>';
      updateTripPackingProgress();
      setTripPackingListOpen(false);
      return;
    }
    const byGroup = {};
    rows.forEach(function (row) {
      const label = String(row.label || "").trim();
      if (!label) return;
      const group = String(row.group || "other").trim() || "other";
      if (!byGroup[group]) byGroup[group] = [];
      byGroup[group].push({ label: label, group: group === "other" ? "" : group, done: !!row.done });
    });
    const order = packingGroupOrder().concat(
      Object.keys(byGroup).filter(function (key) {
        return packingGroupOrder().indexOf(key) === -1;
      }).sort()
    );
    box.innerHTML = order.filter(function (key) { return byGroup[key] && byGroup[key].length; }).map(function (key) {
      const list = byGroup[key];
      const done = list.filter(function (row) { return row.done; }).length;
      const itemsHtml = list.map(function (row) {
        const on = row.done ? " is-on" : "";
        const checked = row.done ? " checked" : "";
        return (
          '<label class="trip-packing-item' + on + '" data-label="' + escapePacking(row.label) + '" data-group="' + escapePacking(row.group) + '" role="listitem">' +
          '<input type="checkbox"' + checked + " />" +
          '<span class="trip-packing-label">' + escapePacking(row.label) + "</span>" +
          "</label>"
        );
      }).join("");
      const allOn = done === list.length && list.length > 0;
      return (
        '<section class="trip-packing-section" data-packing-section="' + escapePacking(key) + '">' +
        '<div class="trip-packing-section-head">' +
        '<h3 class="trip-packing-section-title"><span>' + escapePacking(key) + '</span><span class="trip-packing-section-count">' + done + "/" + list.length + "</span></h3>" +
        '<button type="button" class="btn ghost tiny trip-packing-section-all" data-packing-all="' + escapePacking(key) + '" aria-pressed="' + (allOn ? "true" : "false") + '" title="' +
        (allOn ? "Clear every item in " + escapePacking(key) : "Mark every item in " + escapePacking(key) + " packed") + '">' +
        (allOn ? "Clear" : "All") +
        "</button>" +
        "</div>" +
        '<div class="trip-packing-section-items">' + itemsHtml + "</div>" +
        "</section>"
      );
    }).join("");
    updateTripPackingProgress();
    // Keep the dialog short: start collapsed unless everything is already packed.
    const allDone = rows.every(function (row) { return row.done; });
    setTripPackingListOpen(false);
    if (allDone) {
      const btn = document.getElementById("trip-packing-toggle");
      if (btn) btn.textContent = "Show list";
    }
  }

  function setTripManageOpen(open, opts) {
    const manage = document.getElementById("trip-manage-panel");
    const btn = document.getElementById("btn-trip-picks-manage");
    const reset = document.getElementById("dash-picks-reset");
    if (manage) manage.hidden = !open;
    if (btn) {
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.textContent = open ? "Hide" : "Manage";
    }
    if (reset) reset.hidden = !open;
    if (open && !(opts && opts.skipKit)) {
      // Load kit draft when Manage opens so both lists are ready.
      openTripPackingKitEditor({ embedded: true });
    }
  }

  function setTripPackingKitPanel(open) {
    // Kit editor lives inside Manage; keep this name for older call sites.
    if (open) setTripManageOpen(true);
    else setTripManageOpen(false, { skipKit: true });
  }

  function renderTripPackingKitDraft() {
    const box = document.getElementById("trip-packing-kit-rows");
    if (!box) return;
    const rows = tripPackingKitDraft || [];
    if (!rows.length) {
      box.innerHTML = '<p class="muted">None yet — add the gear you usually take.</p>';
      return;
    }
    box.innerHTML = rows.map(function (row, index) {
      return (
        '<div class="trip-packing-kit-row" data-index="' + index + '">' +
        '<span class="trip-packing-kit-label">' + escapePacking(row.label) + "</span>" +
        (row.group ? '<span class="trip-packing-group">' + escapePacking(row.group) + "</span>" : "") +
        '<button type="button" class="btn ghost trip-packing-kit-del" data-kit-del="' + index + '" aria-label="Remove">×</button>' +
        "</div>"
      );
    }).join("");
  }

  async function openTripPackingKitEditor(opts) {
    await loadTripPackingKit(true);
    tripPackingKitDraft = (tripPackingKit || []).map(function (row) { return Object.assign({}, row); });
    renderTripPackingKitDraft();
    setTripPackingListOpen(false);
    if (!(opts && opts.embedded)) setTripManageOpen(true, { skipKit: true });
    const input = document.getElementById("trip-packing-kit-new");
    if (input && !(opts && opts.embedded)) input.focus();
  }

  function addTripPackingKitDraftItem() {
    const input = document.getElementById("trip-packing-kit-new");
    const groupEl = document.getElementById("trip-packing-kit-group");
    const label = ((input && input.value) || "").replace(/\s+/g, " ").trim();
    if (!label) {
      showBanner("Type a gear name first.", "error");
      if (input) input.focus();
      return;
    }
    tripPackingKitDraft = tripPackingKitDraft || [];
    if (tripPackingKitDraft.some(function (row) { return String(row.label || "").toLowerCase() === label.toLowerCase(); })) {
      showBanner(label + " is already on your kit.", "error");
      if (input) input.focus();
      return;
    }
    const row = { label: label };
    const group = groupEl && groupEl.value ? groupEl.value : "";
    if (group) row.group = group;
    tripPackingKitDraft.push(row);
    if (input) input.value = "";
    renderTripPackingKitDraft();
    if (input) input.focus();
  }

  async function saveTripPackingKitDraft() {
    const result = await api("/api/trip-packing/kit", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kit: tripPackingKitDraft || [] }),
      quiet: true,
    });
    if (!result.ok) {
      showBanner((result.data && result.data.error) || "Could not save your packing kit.", "error");
      return;
    }
    tripPackingKit = result.data.kit || [];
    tripPackingKitDraft = tripPackingKit.map(function (row) { return Object.assign({}, row); });
    renderTripPackingKitDraft();
    showBanner("Packing kit saved on this device.", "ok");
  }

  async function restoreTripPackingKit() {
    const sure = await window.askConfirm({
      title: "Restore the Shipped Packing Kit?",
      message: "Puts the starter gear list back on this device. This trip's ticks stay until you tap Use My Kit.",
      ok: "Restore Shipped",
    });
    if (!sure) return;
    const result = await api("/api/trip-packing/kit/reset", { method: "POST", quiet: true });
    if (!result.ok) {
      showBanner((result.data && result.data.error) || "Could not restore the packing kit.", "error");
      return;
    }
    tripPackingKit = result.data.kit || [];
    tripPackingKitDraft = tripPackingKit.map(function (row) { return Object.assign({}, row); });
    renderTripPackingKitDraft();
    showBanner("Shipped packing kit restored.", "ok");
  }

  async function resetTripPackingFromKit() {
    const sure = await window.askConfirm({
      title: "Use Your Kit on This Trip?",
      message: "Replaces this trip's packing list with your default kit and clears the ticks.",
      ok: "Use My Kit",
    });
    if (!sure) return;
    const kit = await loadTripPackingKit(true);
    renderTripPacking(packingFromKit(kit));
  }

  function currentLoggingDefaults() {
    if (!tripEl) return null;
    const details = tripDetailsOf(tripEl.value.trim());
    const raw = details && details.logging_defaults;
    if (!raw || typeof raw !== "object") return null;
    if (!raw.railroad && !(raw.hotspots && raw.hotspots.length)) return null;
    return raw;
  }

  function paintDayBoard() {
    const board = document.getElementById("day-board");
    if (!board) return;
    const defaults = currentLoggingDefaults();
    const spots = (defaults && defaults.hotspots) || [];
    if (!spots.length) {
      board.hidden = true;
      board.innerHTML = "";
      return;
    }
    let active = Number(defaults.active);
    if (isNaN(active) || active < 0 || active >= spots.length) active = 0;
    board.hidden = false;
    board.innerHTML =
      '<span class="day-board-label">Spots</span>' +
      spots
        .map(function (spot, index) {
          const label = hotspotLabel(spot) || "Spot " + (index + 1);
          return (
            '<button type="button" class="chip' +
            (index === active ? " is-on" : "") +
            '" data-hotspot="' +
            index +
            '" title="' +
            escapeText([spot.subdivision, spot.location, spot.state].filter(Boolean).join(" · ")) +
            '">' +
            escapeText(label) +
            "</button>"
          );
        })
        .join("");
    Array.prototype.forEach.call(board.querySelectorAll("[data-hotspot]"), function (btn) {
      btn.addEventListener("click", function () {
        setActiveHotspot(Number(btn.getAttribute("data-hotspot")));
      });
    });
  }

  async function setActiveHotspot(index) {
    const name = tripEl && tripEl.value.trim();
    if (!name) return;
    const details = tripDetailsOf(name);
    if (!details || !details.logging_defaults || !details.logging_defaults.hotspots) return;
    const spots = details.logging_defaults.hotspots;
    if (!spots.length) return;
    index = Math.max(0, Math.min(Number(index) || 0, spots.length - 1));
    details.logging_defaults.active = index;
    paintDayBoard();
    const card = openSpotRow() || openBlankRow();
    if (card) {
      await applyLoggingDefaultsToRow(card, { defaults: details.logging_defaults, onlyEmpty: false });
    }
    try {
      await api("/api/trips/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name,
          start_miles: details.start_miles || "",
          end_miles: details.end_miles || "",
          vehicle: details.vehicle || "",
          attendees: details.attendees || "",
          notes: details.notes || "",
          fuel_log: fuelRows(details),
          logging_defaults: details.logging_defaults,
          packing: Array.isArray(details.packing) ? details.packing : [],
        }),
        quiet: true,
      });
      await refreshTripNames();
      paintDayBoard();
      const again = openSpotRow() || openBlankRow();
      if (again) {
        await applyLoggingDefaultsToRow(again, {
          defaults: (tripDetailsOf(name) && tripDetailsOf(name).logging_defaults) || details.logging_defaults,
          onlyEmpty: false,
        });
      }
    } catch (err) {
      /* keep in-memory active even if save fails */
    }
  }

  async function offerApplyTripDefaults(name) {
    name = String(name || (tripEl && tripEl.value) || "").trim();
    const details = tripDetailsOf(name);
    const defaults = details && details.logging_defaults;
    if (!defaults || (!defaults.railroad && !(defaults.hotspots && defaults.hotspots.length))) {
      paintDayBoard();
      return;
    }
    paintDayBoard();
    const row = openBlankRow();
    if (!row) return;
    if (locationFieldsBlank(row)) {
      applyLoggingDefaultsToRow(row, { defaults: defaults, onlyEmpty: false });
      return;
    }
    const sure = await window.askConfirm({
      title: "Apply This Trip's Defaults?",
      message: "Fill railroad, subdivision, location, and state on the open card from " + name + "'s Logging Defaults?",
      ok: "Apply",
    });
    if (!sure) return;
    applyLoggingDefaultsToRow(row, { defaults: defaults, onlyEmpty: false });
  }

  function fillTripDefaultRailroadSelect(selected) {
    const select = document.getElementById("trip-default-rr");
    const custom = document.getElementById("trip-default-rr-custom");
    if (!select) return;
    select.innerHTML = railroadOptions(selected || "");
    if (selected && RAILROADS.indexOf(selected) === -1) {
      select.value = "Other";
      if (custom) {
        custom.hidden = false;
        custom.value = selected;
      }
    } else {
      select.value = selected || "";
      if (custom) {
        custom.hidden = true;
        custom.value = "";
      }
    }
  }

  function readTripDefaultRailroad() {
    const select = document.getElementById("trip-default-rr");
    const custom = document.getElementById("trip-default-rr-custom");
    if (!select) return "";
    if (select.value === "Other") return custom ? custom.value.trim() : "";
    return select.value.trim();
  }

  function hotspotStateOptions(selected) {
    const codes = STATE_CODES.slice();
    if (selected && codes.indexOf(selected) === -1) codes.push(selected);
    return (
      '<option value="">—</option>' +
      codes
        .map(function (code) {
          return (
            '<option value="' +
            escapeText(code) +
            '"' +
            (code === selected ? " selected" : "") +
            ">" +
            escapeText(code) +
            "</option>"
          );
        })
        .join("")
    );
  }

  function hotspotSubOptions(rr) {
    const keys = subRailroadKeys(rr);
    let html = '<option value="">Select</option>';
    keys.forEach(function (key) {
      const names = SUBS_BY_RR[key] || [];
      if (!names.length) return;
      if (!rr && keys.length > 1) html += '<optgroup label="' + escapeText(key) + '">';
      names.forEach(function (name) {
        html += '<option value="' + String(name).replace(/"/g, "&quot;") + '">' + escapeText(name) + "</option>";
      });
      if (!rr && keys.length > 1) html += "</optgroup>";
    });
    html += '<option value="Other">Other</option>';
    return html;
  }

  function fillHotspotSubSelect(card, selected) {
    const select = card.querySelector(".trip-hotspot-sub");
    const custom = card.querySelector(".trip-hotspot-sub-custom");
    if (!select) return;
    const rr = readTripDefaultRailroad();
    const known = [];
    subRailroadKeys(rr).forEach(function (key) {
      (SUBS_BY_RR[key] || []).forEach(function (name) {
        known.push(name);
      });
    });
    select.innerHTML = hotspotSubOptions(rr);
    if (!selected) {
      select.value = "";
      if (custom) {
        custom.hidden = true;
        custom.value = "";
      }
      return;
    }
    if (known.indexOf(selected) !== -1) {
      select.value = selected;
      if (custom) {
        custom.hidden = true;
        custom.value = "";
      }
      return;
    }
    select.value = "Other";
    if (custom) {
      custom.hidden = false;
      custom.value = selected;
    }
  }

  function hotspotSubOf(card) {
    const select = card.querySelector(".trip-hotspot-sub");
    const custom = card.querySelector(".trip-hotspot-sub-custom");
    if (!select) return "";
    if (select.value === "Other") return custom ? custom.value.trim() : "";
    return select.value.trim();
  }

  function hotspotSummaryText(spot) {
    spot = spot || {};
    const title = hotspotLabel(spot) || "Hotspot";
    const bits = [spot.subdivision, spot.location, spot.state].filter(Boolean);
    return { title: title, detail: bits.join(" · ") };
  }

  function hotspotEditorRow(spot, index, open) {
    spot = spot || {};
    const state = String(spot.state || "").toUpperCase();
    const summary = hotspotSummaryText(spot);
    const hasPlace = Boolean(spot.subdivision || spot.location);
    const isOpen = open || !hasPlace;
    return (
      '<div class="trip-hotspot' +
      (isOpen ? " is-open" : "") +
      '" data-hotspot-index="' +
      index +
      '">' +
      '<div class="trip-hotspot-summary">' +
      '<button type="button" class="trip-hotspot-summary-main" data-hotspot-toggle="' +
      index +
      '">' +
      '<span class="trip-hotspot-summary-title">' +
      escapeText(summary.title) +
      "</span>" +
      (summary.detail
        ? '<span class="trip-hotspot-summary-detail">' + escapeText(summary.detail) + "</span>"
        : '<span class="trip-hotspot-summary-detail muted">Tap to edit</span>') +
      "</button>" +
      '<button type="button" class="btn tiny ghost" data-hotspot-edit="' +
      index +
      '">' +
      (isOpen ? "Done" : "Edit") +
      "</button>" +
      '<button type="button" class="btn tiny ghost" data-hotspot-remove="' +
      index +
      '">Remove</button>' +
      "</div>" +
      '<div class="trip-hotspot-body">' +
      '<div class="trip-hotspot-grid">' +
      '<label class="trip-hotspot-sub-field"><span>Subdivision</span>' +
      '<select class="trip-hotspot-sub" aria-label="Subdivision"></select>' +
      '<input class="trip-hotspot-sub-custom" type="text" maxlength="120" hidden autocomplete="off" aria-label="Other subdivision" />' +
      "</label>" +
      '<label class="trip-hotspot-loc autocomplete"><span>Location / Hotspot</span>' +
      '<div class="trip-hotspot-loc-fields">' +
      '<input class="trip-hotspot-loc-input" type="text" maxlength="120" autocomplete="off" aria-label="Location" value="' +
      escapeText(spot.location || "") +
      '" />' +
      '<select class="trip-hotspot-state" aria-label="State">' +
      hotspotStateOptions(state) +
      "</select></div>" +
      '<div class="suggest trip-hotspot-suggest"></div></label>' +
      '<label class="trip-hotspot-chip"><span>Chip Label (optional)</span><input class="trip-hotspot-label" type="text" maxlength="80" autocomplete="off" value="' +
      escapeText(spot.label || "") +
      '" placeholder="e.g. Gallup" /></label>' +
      "</div></div></div>"
    );
  }

  function refreshHotspotSummary(card) {
    if (!card) return;
    const spot = {
      subdivision: hotspotSubOf(card),
      location: hotspotLocOf(card),
      state: ((card.querySelector(".trip-hotspot-state") && card.querySelector(".trip-hotspot-state").value) || ""),
      label: ((card.querySelector(".trip-hotspot-label") && card.querySelector(".trip-hotspot-label").value) || "").trim(),
    };
    const summary = hotspotSummaryText(spot);
    const title = card.querySelector(".trip-hotspot-summary-title");
    const detail = card.querySelector(".trip-hotspot-summary-detail");
    if (title) title.textContent = summary.title;
    if (detail) {
      detail.textContent = summary.detail || "Tap to edit";
      detail.classList.toggle("muted", !summary.detail);
    }
  }

  function setHotspotOpen(card, open) {
    if (!card) return;
    card.classList.toggle("is-open", Boolean(open));
    const edit = card.querySelector("[data-hotspot-edit]");
    if (edit) edit.textContent = open ? "Done" : "Edit";
    if (!open) refreshHotspotSummary(card);
  }

  function hotspotLocOf(card) {
    const loc = card.querySelector(".trip-hotspot-loc-input");
    return loc ? loc.value.trim() : "";
  }

  async function loadHotspotSuggestions(card) {
    const loc = card.querySelector(".trip-hotspot-loc-input");
    const suggest = card.querySelector(".trip-hotspot-suggest");
    if (!loc || !suggest) return;
    const railroad = readTripDefaultRailroad();
    const subdivision = hotspotSubOf(card);
    const query = loc.value.trim();
    if (!query && !subdivision) {
      suggest.style.display = "none";
      return;
    }
    const params = new URLSearchParams();
    params.set("q", query || "");
    if (railroad) params.set("railroad", railroad);
    if (subdivision) params.set("subdivision", subdivision);
    const result = await api("/api/locations/autocomplete?" + params.toString(), { quiet: true });
    const items = Array.isArray(result.data) ? result.data : [];
    if (!items.length) {
      suggest.style.display = "none";
      return;
    }
    suggest.innerHTML = items
      .map(function (item) {
        const label = item.location_spot_label || item.location_spot || "";
        return '<button type="button">' + escapeText(label) + "</button>";
      })
      .join("");
    Array.prototype.forEach.call(suggest.children, function (button, index) {
      button.addEventListener("mousedown", function (event) {
        event.preventDefault();
        const item = items[index];
        loc.value = item.location_spot_label || item.location_spot || "";
        if (item.location_subdivision) fillHotspotSubSelect(card, item.location_subdivision);
        if (item.location_state) {
          const state = card.querySelector(".trip-hotspot-state");
          if (state) {
            state.innerHTML = hotspotStateOptions(item.location_state);
            state.value = item.location_state;
          }
        }
        refreshHotspotSummary(card);
        suggest.style.display = "none";
      });
    });
    suggest.style.display = "block";
  }

  function bindHotspotCard(card, spot) {
    fillHotspotSubSelect(card, (spot && spot.subdivision) || "");
    refreshHotspotSummary(card);
    const sub = card.querySelector(".trip-hotspot-sub");
    const subCustom = card.querySelector(".trip-hotspot-sub-custom");
    if (sub) {
      sub.addEventListener("change", function () {
        if (subCustom) {
          const other = sub.value === "Other";
          subCustom.hidden = !other;
          if (!other) subCustom.value = "";
          if (other) subCustom.focus();
        }
        refreshHotspotSummary(card);
        const loc = card.querySelector(".trip-hotspot-loc-input");
        if (loc && (document.activeElement === loc || loc.value || hotspotSubOf(card))) {
          loadHotspotSuggestions(card);
        }
      });
    }
    if (subCustom) {
      const refresh = function () {
        refreshHotspotSummary(card);
        loadHotspotSuggestions(card);
      };
      subCustom.addEventListener("change", refresh);
      subCustom.addEventListener("blur", refresh);
    }
    const loc = card.querySelector(".trip-hotspot-loc-input");
    const suggest = card.querySelector(".trip-hotspot-suggest");
    let timer = null;
    if (loc && suggest) {
      loc.addEventListener("input", function () {
        refreshHotspotSummary(card);
        window.clearTimeout(timer);
        timer = window.setTimeout(function () {
          loadHotspotSuggestions(card);
        }, 180);
      });
      loc.addEventListener("focus", function () {
        loadHotspotSuggestions(card);
      });
      loc.addEventListener("blur", function () {
        window.setTimeout(function () {
          suggest.style.display = "none";
        }, 180);
      });
    }
    const state = card.querySelector(".trip-hotspot-state");
    if (state) state.addEventListener("change", function () { refreshHotspotSummary(card); });
    const label = card.querySelector(".trip-hotspot-label");
    if (label) label.addEventListener("input", function () { refreshHotspotSummary(card); });
  }

  function refreshHotspotSubMenus() {
    Array.prototype.forEach.call(document.querySelectorAll("#trip-hotspots .trip-hotspot"), function (card) {
      fillHotspotSubSelect(card, hotspotSubOf(card));
    });
  }

  function renderHotspotEditor(defaults, opts) {
    opts = opts || {};
    const box = document.getElementById("trip-hotspots");
    if (!box) return;
    const spots = (defaults && defaults.hotspots) || [];
    const openIndex = opts.openIndex;
    box.innerHTML = spots
      .map(function (spot, index) {
        return hotspotEditorRow(spot, index, openIndex === index);
      })
      .join("");
    Array.prototype.forEach.call(box.querySelectorAll(".trip-hotspot"), function (card, index) {
      bindHotspotCard(card, spots[index]);
    });
    Array.prototype.forEach.call(box.querySelectorAll("[data-hotspot-remove]"), function (btn) {
      btn.addEventListener("click", function (event) {
        event.stopPropagation();
        const current = readLoggingDefaultsFromForm();
        const idx = Number(btn.getAttribute("data-hotspot-remove"));
        current.hotspots.splice(idx, 1);
        if (current.active >= current.hotspots.length) current.active = Math.max(0, current.hotspots.length - 1);
        fillTripDefaultRailroadSelect(current.railroad);
        renderHotspotEditor(current);
      });
    });
    Array.prototype.forEach.call(box.querySelectorAll("[data-hotspot-toggle], [data-hotspot-edit]"), function (btn) {
      btn.addEventListener("click", function (event) {
        event.stopPropagation();
        const card = btn.closest(".trip-hotspot");
        if (!card) return;
        if (card.classList.contains("is-open")) {
          setHotspotOpen(card, false);
          return;
        }
        Array.prototype.forEach.call(box.querySelectorAll(".trip-hotspot.is-open"), function (other) {
          if (other !== card) setHotspotOpen(other, false);
        });
        setHotspotOpen(card, true);
      });
    });
  }


  function readLoggingDefaultsFromForm() {
    const spots = [];
    Array.prototype.forEach.call(document.querySelectorAll("#trip-hotspots .trip-hotspot"), function (card) {
      const subdivision = hotspotSubOf(card);
      const location = hotspotLocOf(card);
      const state = ((card.querySelector(".trip-hotspot-state") && card.querySelector(".trip-hotspot-state").value) || "").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 2);
      const label = (card.querySelector(".trip-hotspot-label") && card.querySelector(".trip-hotspot-label").value.trim()) || "";
      if (!subdivision && !location) return;
      const row = { subdivision: subdivision, location: location, state: state };
      if (label) row.label = label;
      spots.push(row);
    });
    const prior = (tripDetailsDialog && tripDetailsOf(tripDetailsDialog._name) || {}).logging_defaults || {};
    let active = Number(prior.active);
    if (isNaN(active) || active < 0) active = 0;
    if (spots.length) active = Math.min(active, spots.length - 1);
    else active = 0;
    return { railroad: readTripDefaultRailroad(), hotspots: spots, active: active };
  }

  function syncTripDetailsTitle() {
    const title = document.getElementById("trip-details-title");
    if (!title) return;
    const name = tripEl ? tripEl.value.trim() : "";
    title.textContent = name || "New Trip";
  }

  async function openTripDetails(name) {
    if (!tripDetailsDialog) return;
    if (typeof name === "string" && name.trim()) {
      if (tripEl) tripEl.value = name.trim();
      syncTripDetailsButton();
    }
    const current = tripEl ? tripEl.value.trim() : "";
    if (!current) {
      showBanner("Type a trip name first. Then add mileage, notes, and who came along.", "error");
      if (tripEl) {
        markTripMissing();
        tripEl.focus();
      }
      return;
    }
    tripDetailsDialog._name = current;
    hideTripSuggest();
    // Refresh trips + pick lists so vehicle/attendees and dropdowns are current.
    await refreshTripNames();
    if (!Object.keys(SUBS_BY_RR).length) await ensureSubs();
    if (!STATE_CODES.length) await ensureRailroads();
    const details = tripDetailsOf(current) || {};
    syncTripDetailsTitle();
    document.getElementById("trip-start-miles").value = details.start_miles || "";
    document.getElementById("trip-end-miles").value = details.end_miles || "";
    document.getElementById("trip-vehicle").value =
      String(details.vehicle || "").trim() || lastSavedTripField("vehicle");
    document.getElementById("trip-attendees").value =
      String(details.attendees || "").trim() || lastSavedTripField("attendees");
    document.getElementById("trip-notes").value = details.notes || "";
    document.getElementById("trip-details-error").hidden = true;
    const defaults = details.logging_defaults || {};
    fillTripDefaultRailroadSelect(defaults.railroad || "");
    renderHotspotEditor(defaults);
    renderVehiclePicks();
    renderAttendeePicks();
    renderFuelLog(fuelRows(details));
    if (Array.isArray(details.packing) && details.packing.length) {
      renderTripPacking(details.packing);
    } else {
      const kit = await loadTripPackingKit(false);
      renderTripPacking(packingFromKit(kit));
    }
    setTripManageOpen(false, { skipKit: true });
    showTripMiles();
    tripDetailsDialog._opened = tripDetailsValues();
    tripDetailsDialog.showModal();
    hideTripSuggest();
    if (tripEl && !tripEl.value.trim()) tripEl.focus();
  }

  function tripDetailsValues() {
    return [
      tripEl ? tripEl.value : "",
      tripFromEl ? tripFromEl.value : "",
      tripToEl ? tripToEl.value : "",
      document.getElementById("trip-start-miles").value,
      document.getElementById("trip-end-miles").value,
      document.getElementById("trip-vehicle").value,
      document.getElementById("trip-attendees").value,
      document.getElementById("trip-notes").value,
      JSON.stringify(readFuelLog()),
      JSON.stringify(readLoggingDefaultsFromForm()),
      JSON.stringify(readTripPacking()),
    ].join("\u0000");
  }

  async function closeTripDetails() {
    if (tripDetailsValues() !== tripDetailsDialog._opened) {
      const sure = await window.askConfirm({
        title: "Discard Your Trip Details Changes?",
        message: "What you typed here hasn't been saved.",
        ok: "Discard",
      });
      if (!sure) return;
    }
    setTripManageOpen(false, { skipKit: true });
    tripDetailsDialog.close();
  }

  async function saveTripDetails() {
    const name = tripEl ? tripEl.value.trim() : "";
    const error = document.getElementById("trip-details-error");
    if (!name) {
      error.textContent = "Add a trip name before saving.";
      error.hidden = false;
      markTripMissing();
      if (tripEl) tripEl.focus();
      return;
    }
    tripDetailsDialog._name = name;
    const draft = draftFuel();
    if (!draftBlank(draft)) {
      const message = fuelDraftError(draft);
      if (message) {
        error.textContent = message;
        error.hidden = false;
        return;
      }
    }
    const result = await api("/api/trips/details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name,
        start_miles: document.getElementById("trip-start-miles").value,
        end_miles: document.getElementById("trip-end-miles").value,
        vehicle: document.getElementById("trip-vehicle").value,
        attendees: document.getElementById("trip-attendees").value,
        notes: document.getElementById("trip-notes").value,
        fuel_log: readFuelLog(),
        logging_defaults: readLoggingDefaultsFromForm(),
        packing: readTripPacking(),
      }),
    });
    if (!result.ok) {
      error.textContent = (result.data && result.data.error) || "Could not save the trip details.";
      error.hidden = false;
      return;
    }
    tripDetailsDialog.close();
    showBanner(result.data.message, "ok");
    await refreshTripNames();
    syncTripDetailsButton();
    paintDayBoard();
    const blank = openBlankRow();
    if (blank && locationFieldsBlank(blank)) applyLoggingDefaultsToRow(blank, { onlyEmpty: false });
    if (currentView() === "log") renderLog();
    document.dispatchEvent(new CustomEvent("trainlog:entries-changed"));
  }

  if (tripDetailsBtn && tripDetailsDialog) {
    tripDetailsBtn.addEventListener("click", function () {
      openTripDetails();
    });
    document.getElementById("trip-details-save").addEventListener("click", saveTripDetails);
    document.getElementById("trip-details-cancel").addEventListener("click", closeTripDetails);
    const packingList = document.getElementById("trip-packing-list");
    if (packingList) {
      packingList.addEventListener("change", function (event) {
        const item = event.target.closest && event.target.closest(".trip-packing-item");
        if (!item) return;
        item.classList.toggle("is-on", !!(event.target.checked));
        updateTripPackingProgress();
      });
      packingList.addEventListener("click", function (event) {
        const allBtn = event.target.closest && event.target.closest("[data-packing-all]");
        if (!allBtn) return;
        event.preventDefault();
        const section = allBtn.closest(".trip-packing-section");
        if (!section) return;
        const items = section.querySelectorAll(".trip-packing-item");
        const done = section.querySelectorAll(".trip-packing-item.is-on").length;
        const markOn = !(items.length && done === items.length);
        setTripPackingSectionAll(section, markOn);
      });
    }
    const packingToggle = document.getElementById("trip-packing-toggle");
    if (packingToggle) {
      packingToggle.addEventListener("click", function () {
        const body = document.getElementById("trip-packing-body");
        setTripPackingListOpen(!(body && !body.hidden));
      });
    }
    const packingGroups = document.getElementById("trip-packing-groups");
    if (packingGroups) {
      packingGroups.addEventListener("click", function (event) {
        const chip = event.target.closest && event.target.closest("[data-packing-group]");
        if (!chip) return;
        setTripPackingListOpen(true);
        const key = chip.getAttribute("data-packing-group") || "";
        const section = document.querySelector('#trip-packing-list [data-packing-section="' + key.replace(/"/g, "") + '"]');
        if (section && section.scrollIntoView) section.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    }
    const packingResetTrip = document.getElementById("trip-packing-reset-trip");
    if (packingResetTrip) packingResetTrip.addEventListener("click", resetTripPackingFromKit);
    const packingAdd = document.getElementById("trip-packing-kit-add");
    if (packingAdd) packingAdd.addEventListener("click", addTripPackingKitDraftItem);
    const packingNew = document.getElementById("trip-packing-kit-new");
    if (packingNew) packingNew.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") return;
      event.preventDefault();
      addTripPackingKitDraftItem();
    });
    const packingKitRows = document.getElementById("trip-packing-kit-rows");
    if (packingKitRows) packingKitRows.addEventListener("click", function (event) {
      const del = event.target.closest && event.target.closest("[data-kit-del]");
      if (!del) return;
      const index = Number(del.getAttribute("data-kit-del"));
      if (!tripPackingKitDraft || isNaN(index)) return;
      tripPackingKitDraft.splice(index, 1);
      renderTripPackingKitDraft();
    });
    const packingKitSave = document.getElementById("trip-packing-kit-save");
    if (packingKitSave) packingKitSave.addEventListener("click", saveTripPackingKitDraft);
    const packingKitRestore = document.getElementById("trip-packing-kit-restore");
    if (packingKitRestore) packingKitRestore.addEventListener("click", restoreTripPackingKit);

    const tripHotspotAdd = document.getElementById("trip-hotspot-add");
    if (tripHotspotAdd) {
      tripHotspotAdd.addEventListener("click", function () {
        const current = readLoggingDefaultsFromForm();
        current.hotspots.push({ subdivision: "", location: "", state: "", label: "" });
        fillTripDefaultRailroadSelect(current.railroad);
        renderHotspotEditor(current, { openIndex: current.hotspots.length - 1 });
      });
    }
    const tripDefaultRr = document.getElementById("trip-default-rr");
    const tripDefaultRrCustom = document.getElementById("trip-default-rr-custom");
    if (tripDefaultRr) {
      tripDefaultRr.addEventListener("change", function () {
        if (tripDefaultRrCustom) {
          const other = tripDefaultRr.value === "Other";
          tripDefaultRrCustom.hidden = !other;
          if (!other) tripDefaultRrCustom.value = "";
        }
        refreshHotspotSubMenus();
      });
    }
    const picksBtn = document.getElementById("btn-trip-picks-manage");
    if (picksBtn) {
      picksBtn.addEventListener("click", function () {
        const manage = document.getElementById("trip-manage-panel");
        const open = !(manage && !manage.hidden);
        setTripManageOpen(open);
      });
    }
    const packingEdit = document.getElementById("trip-packing-edit");
    if (packingEdit) {
      packingEdit.addEventListener("click", function () {
        openTripPackingKitEditor();
      });
    }
    if (tripEl) {
      tripEl.addEventListener("input", function () {
        syncTripDetailsTitle();
        syncTripDetailsButton();
        if (tripDetailsDialog && tripDetailsDialog.open) {
          tripDetailsDialog._name = tripEl.value.trim();
          showFuelMetrics();
        }
      });
    }

    ["trip-start-miles", "trip-end-miles"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", showTripMiles);
    });
    const fuelAdd = document.getElementById("trip-fuel-add");
    if (fuelAdd) fuelAdd.addEventListener("click", commitDraft);
    const fuelStamp = document.querySelector("#trip-fuel-entry .trip-fuel-stamp");
    if (fuelStamp) fuelStamp.addEventListener("click", stampFuelTime);
    const fuelRemoveDraft = document.getElementById("trip-fuel-remove-draft");
    if (fuelRemoveDraft) {
      fuelRemoveDraft.addEventListener("click", function () {
        clearDraft();
        showTripError("");
        showFuelMetrics();
      });
    }
    const fuelEntry = document.getElementById("trip-fuel-entry");
    if (fuelEntry) {
      fuelEntry.addEventListener("input", function (event) {
        syncFuelRow(entryCard(), event.target);
        showFuelMetrics();
      });
    }
    const fuelLog = document.getElementById("trip-fuel-log");
    if (fuelLog) {
      fuelLog.addEventListener("click", function (event) {
        const row = event.target.closest(".trip-fuel-item");
        if (!row) return;
        const domIndex = Array.prototype.indexOf.call(row.parentNode.children, row);
        const at = entryCard()._editIndex;
        const full = typeof at === "number" && domIndex >= at ? domIndex + 1 : domIndex;
        if (event.target.closest(".trip-fuel-remove")) {
          row.remove();
          if (typeof at === "number" && full < at) entryCard()._editIndex = at - 1;
          const box = document.getElementById("trip-fuel-log");
          box.hidden = !box.querySelector(".trip-fuel-item");
          showFuelMetrics();
          return;
        }
        const current = draftFuel();
        if (!draftBlank(current)) {
          const message = fuelDraftError(current);
          if (message) {
            showTripError(message);
            return;
          }
        }
        const rows = readFuelLog();
        const item = rows.splice(full, 1)[0];
        renderFuelList(rows);
        fillDraft(item, full);
        showTripError("");
        showFuelMetrics();
      });
    }

    tripDetailsDialog.addEventListener("cancel", function (event) {
      event.preventDefault();
      closeTripDetails();
    });
        const vehicleInput = document.getElementById("trip-vehicle");
    const attendeesInput = document.getElementById("trip-attendees");
    const vehiclePicks = document.getElementById("trip-vehicle-picks");
    const attendeePicks = document.getElementById("trip-attendee-picks");
    if (vehicleInput) {
      vehicleInput.addEventListener("input", showVehicleSuggest);
      vehicleInput.addEventListener("blur", function () {
        window.setTimeout(function () { hideWhoSuggest("trip-vehicle-suggest"); }, 120);
      });
      vehicleInput.addEventListener("keydown", function (event) {
        if (event.key === "Escape") hideWhoSuggest("trip-vehicle-suggest");
      });
    }
    if (attendeesInput) {
      attendeesInput.addEventListener("input", showAttendeeSuggest);
      attendeesInput.addEventListener("blur", function () {
        window.setTimeout(function () { hideWhoSuggest("trip-attendee-suggest"); }, 120);
      });
      attendeesInput.addEventListener("keydown", function (event) {
        if (event.key === "Escape") hideWhoSuggest("trip-attendee-suggest");
      });
    }
    if (vehiclePicks && !vehiclePicks._boundTripPick) {
      vehiclePicks._boundTripPick = true;
      vehiclePicks.addEventListener("change", function () {
        const value = String(vehiclePicks.value || "").trim();
        if (!value || !vehicleInput) return;
        vehicleInput.value = value;
        vehiclePicks.value = "";
        hideWhoSuggest("trip-vehicle-suggest");
      });
    }
    if (attendeePicks && !attendeePicks._boundTripPick) {
      attendeePicks._boundTripPick = true;
      attendeePicks.addEventListener("change", function () {
        const value = String(attendeePicks.value || "").trim();
        if (!value || !attendeesInput) return;
        const existing = attendeeList(attendeesInput.value);
        const lower = existing.map(function (name) { return name.toLowerCase(); });
        if (lower.indexOf(value.toLowerCase()) === -1) existing.push(value);
        attendeesInput.value = existing.join(", ");
        attendeePicks.value = "";
        hideWhoSuggest("trip-attendee-suggest");
      });
    }
  }

  function tripNameOf(trip) {
    return ((trip && trip.name) || trip || "").trim();
  }

  function applyTripMatch(name) {
    if (!tripEl) return;
    const match = (tripEl._trips || []).filter(function (trip) {
      return tripNameOf(trip) === name;
    })[0];
    if (!match || typeof match === "string") return;
    if (tripFromEl && !tripFromEl.value && match.trip_date_from) tripFromEl.value = match.trip_date_from;
    if (tripToEl && !tripToEl.value && match.trip_date_to) tripToEl.value = match.trip_date_to;
    syncSessionMore();
  }

  function hideTripSuggest() {
    const suggest = document.getElementById("trip-suggest");
    if (suggest) suggest.style.display = "none";
  }

  function showTripSuggest() {
    const suggest = document.getElementById("trip-suggest");
    if (!tripEl || !suggest) return;
    const query = tripEl.value.trim().toLowerCase();
    // Wait until the user types before listing recent trip names.
    if (!query) {
      suggest.style.display = "none";
      suggest.innerHTML = "";
      return;
    }
    const trips = (tripEl._trips || []).filter(function (trip) {
      const name = tripNameOf(trip);
      if (!name) return false;
      return name.toLowerCase().indexOf(query) !== -1;
    });
    if (!trips.length) {
      suggest.style.display = "none";
      return;
    }
    suggest.innerHTML = trips
      .map(function (trip) {
        return "<button type=\"button\">" + escapeText(tripNameOf(trip)) + "</button>";
      })
      .join("");
    Array.prototype.forEach.call(suggest.children, function (button, index) {
      button.addEventListener("mousedown", function (event) {
        event.preventDefault();
        const name = tripNameOf(trips[index]);
        tripEl.value = name;
        applyTripMatch(name);
        syncTripDetailsButton();
        hideTripSuggest();
        offerApplyTripDefaults(name);
      });
    });
    suggest.style.display = "block";
  }

  async function refreshTripNames() {
    if (!tripEl) return;
    const result = await api("/api/trips");
    tripEl._trips = (result.data && result.data.trips) || [];
    tripEl._picks = (result.data && result.data.picks) || {};
    syncTripDetailsButton();
    paintDayBoard();
    const suggest = document.getElementById("trip-suggest");
    if (suggest && suggest.style.display === "block") showTripSuggest();
  }

  function setEditMode(entry) {
    if (!entry) pendingEditId = null;
    editingId = entry ? entry.id || null : null;
    editingEntry = entry || null;
    const cancel = document.getElementById("btn-cancel-edit");
    const quick = document.getElementById("btn-quick-add");
    const submit = document.getElementById("btn-submit");
    const submitBottom = document.getElementById("btn-submit-bottom");
    const submitRefs = document.getElementById("btn-submit-refs");
    const row = rowsEl.querySelector(".train-row");
    if (!entry && row) clearRow(row);
    if (entry) {
      savedTrip = readSessionTrip();
      dateEl.value = entry.date;
      writeSessionTrip(entry);
      fillRow(row, entry);
      const label = row.querySelector(".row-index");
      if (label) label.innerHTML = 'Editing train <span class="entry-id" title="' + ENTRY_ID_TITLE + '">#' + entry.id + "</span>";
      editBanner.hidden = false;
      editBanner.textContent = "Editing entry #" + entry.id;
      cancel.hidden = false;
      quick.hidden = true;
      submit.textContent = "Save Changes";
      if (submitBottom) submitBottom.textContent = "Save Changes";
      if (submitRefs) submitRefs.textContent = "Save Changes";
    } else {
      if (savedTrip) {
        writeSessionTrip(savedTrip);
        savedTrip = null;
      }
      editBanner.hidden = true;
      cancel.hidden = true;
      quick.hidden = false;
      submit.textContent = "Submit";
      if (submitBottom) submitBottom.textContent = "Submit";
      if (submitRefs) submitRefs.textContent = "Submit";
    }
    renderDayLog();
  }

  async function startEdit(id) {
    const result = await api("/api/entries/" + id);
    if (!result.ok) {
      showBanner(
        (result.data && result.data.error) || "That train is no longer in the log.",
        "error"
      );
      return false;
    }
    setEditMode(result.data);
    showBanner("Editing entry #" + id + ". Save changes when ready.");
    if (currentView() !== "entry") {
      location.hash = "entry";
    } else {
      setView("entry");
    }
    return true;
  }

  const editDialog = document.getElementById("edit-dialog");
  const editDialogMsg = document.getElementById("edit-dialog-msg");
  const sessionMeta = document.querySelector("#entry-form .session-meta");
  let editHome = null;
  let editReturn = null;

  function moveIntoEditDialog() {
    editHome = {
      rowsParent: rowsEl.parentNode,
      rowsNext: rowsEl.nextSibling,
      metaParent: sessionMeta.parentNode,
      metaNext: sessionMeta.nextSibling,
    };
    document.getElementById("edit-dialog-session").appendChild(sessionMeta);
    document.getElementById("edit-dialog-card").appendChild(rowsEl);
  }

  function moveHomeFromEditDialog() {
    if (!editHome) return;
    editHome.metaParent.insertBefore(sessionMeta, editHome.metaNext);
    editHome.rowsParent.insertBefore(rowsEl, editHome.rowsNext);
    editHome = null;
  }

  function logScroller() {
    return document.querySelector("#view-log .table-wrap");
  }

  async function openEditDialog(id) {
    if (!editDialog || editReturn) return startEdit(id);
    const result = await api("/api/entries/" + id);
    if (!result.ok) {
      showBanner((result.data && result.data.error) || "That train is no longer in the log.", "error");
      return false;
    }
    await stopLiveRecordings();
    const view = currentView();
    const wrap = logScroller();
    const card = parkEntryCard();
    editReturn = {
      view: view,
      scrollTop: wrap ? wrap.scrollTop : 0,
      date: dateEl.value,
      id: Number(id),
      draft: card.rows[0] || null,
      card: card,
    };
    collapseEntryForEdit();
    setEditMode(result.data);
    const width = view === "log" && wrap ? Math.round(wrap.getBoundingClientRect().width) : 0;
    editDialog.style.width = width ? width + "px" : "";
    document.getElementById("edit-dialog-title").innerHTML =
      'Edit train <span class="entry-id" title="' + ENTRY_ID_TITLE + '">#' + escapeText(String(id)) + "</span>";
    editDialogMsg.hidden = true;
    moveIntoEditDialog();
    editDialog.showModal();
    return true;
  }

  async function openPendingEdit(item) {
    if (!editDialog || editReturn || !item) return false;
    await stopLiveRecordings();
    const card = parkEntryCard();
    editReturn = {
      view: currentView(),
      scrollTop: 0,
      date: dateEl.value,
      id: null,
      draft: card.rows[0] || null,
      card: card,
    };
    collapseEntryForEdit();
    const payload = Object.assign({}, item.payload || {});
    delete payload.id;
    setEditMode(payload);
    pendingEditId = item.id;
    const row = rowsEl.querySelector(".train-row");
    const label = row && row.querySelector(".row-index");
    if (label) label.textContent = "Held Import";
    editBanner.textContent = "Editing a held import. Saving adds it to the log.";
    editDialog.style.width = "";
    document.getElementById("edit-dialog-title").textContent = "Edit Held Import";
    document.getElementById("edit-dialog-save").textContent = "Add to Log";
    editDialogMsg.hidden = true;
    moveIntoEditDialog();
    editDialog.showModal();
    return true;
  }

  function endEditDialog(saved) {
    const back = editReturn;
    editReturn = null;
    if (!back) return null;
    document.getElementById("edit-dialog-save").textContent = "Save Changes";
    if (!saved && (editingId || pendingEditId)) setEditMode(null);
    moveHomeFromEditDialog();
    if (back.card) restoreEntryCard(back.card);
    else {
      dateEl.value = back.date;
      const row = rowsEl.querySelector(".train-row");
      if (back.draft && row) fillRow(row, back.draft);
    }
    if (editDialog.open) editDialog.close();
    return back;
  }

  function flashRow(row) {
    row.classList.remove("row-flash");
    void row.offsetWidth;
    row.classList.add("row-flash");
    window.setTimeout(function () {
      row.classList.remove("row-flash");
    }, 2400);
  }

  async function afterEditDialog(back, saved) {
    if (back.view === "log") {
      await loadLog();
      const wrap = logScroller();
      if (wrap) wrap.scrollTop = back.scrollTop;
      const row = document.querySelector('#log-body tr[data-id="' + back.id + '"]');
      if (row && wrap) {
        const box = row.getBoundingClientRect();
        const view = wrap.getBoundingClientRect();
        const head = wrap.querySelector("thead");
        const headH = head ? head.getBoundingClientRect().height : 0;
        if (box.top < view.top + headH || box.bottom > view.bottom) row.scrollIntoView({ block: "center" });
        if (saved) flashRow(row);
      }
    }
    if (back.view === "dashboard" && (dashboardPane() === "review" || dashboardPane() === "import")) {
      loadPending();
      refreshPendingBadge();
    }
    if (saved) document.dispatchEvent(new CustomEvent("trainlog:entry-saved", { detail: { id: back.id } }));
  }

  if (editDialog) {
    document.getElementById("edit-dialog-save").addEventListener("click", function () {
      document.getElementById("entry-form").requestSubmit();
    });
    document.getElementById("edit-dialog-cancel").addEventListener("click", function () {
      editDialog.close();
    });
    editDialog.addEventListener("cancel", function (event) {
      const openList = Array.prototype.some.call(editDialog.querySelectorAll(".suggest"), function (el) {
        return el.style.display === "block";
      });
      if (openList) event.preventDefault();
    });
    editDialog.addEventListener("close", function () {
      if (!editReturn) return;
      const back = endEditDialog(false);
      loadDayLog();
      showBanner("Edit cancelled.");
      afterEditDialog(back, false);
    });
  }

  function collectFilled() {
    return Array.prototype.map
      .call(rowsEl.querySelectorAll(".train-row"), function (row) {
        return readRow(row, true);
      })
      .filter(rowIsFilled);
  }

  async function askDuplicate(duplicates) {
    confirmMessage.textContent =
      "This looks like a train you already logged at this location within 1 minute. Save anyway?";
    confirmDetails.innerHTML = duplicates
      .map(function (item) {
        const existing = (item.existing || [])[0] || {};
        return (
          "Row " +
          (Number(item.row) + 1) +
          " matches #" +
          (existing.id || "?") +
          " · " +
          (existing.date || "") +
          " " +
          (existing.time || "") +
          " · " +
          (existing.lead_locomotive || "") +
          " at " +
          (existing.location_spot || "")
        );
      })
      .join("<br />");
    confirmDialog.showModal();
    return new Promise(function (resolve) {
      confirmDialog.addEventListener(
        "close",
        function () {
          resolve(confirmDialog.returnValue === "confirm");
        },
        { once: true }
      );
    });
  }

  async function submitEntries(entries, force) {
    const result = await sendEntries(entries, force);
    if (result && result.ok) {
      loadSpecialRoster();
      document.dispatchEvent(new CustomEvent("trainlog:entries-changed"));
    }
    return result;
  }

  async function sendEntries(entries, force) {
    const body = entries.map(function (entry) {
      return Object.assign({}, entry, { force: Boolean(force) });
    });
    if (pendingEditId) {
      const kept = editingEntry
        ? { location_region: editingEntry.location_region, location_coordinates: editingEntry.location_coordinates }
        : {};
      return api("/api/import/pending/" + pendingEditId + "/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry: Object.assign(kept, body[0]) }),
      });
    }
    if (editingId) {
      const kept = editingEntry
        ? { location_region: editingEntry.location_region, location_coordinates: editingEntry.location_coordinates }
        : {};
      const result = await api("/api/entries/" + editingId, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign(kept, body[0], { force: Boolean(force) })),
      });
      return result;
    }
    return api("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: body }),
    });
  }

  document.getElementById("entry-form").addEventListener(
    "submit",
    function (event) {
      submittedFromBottom = Boolean(event.submitter && event.submitter.closest(".entry-bottom-actions"));
    },
    true
  );


  let quickSpotFavorites = [];

  function hotspotLabel(spot) {
    if (!spot) return "";
    return String(spot.label || spot.location || spot.subdivision || "").trim();
  }

  function activeHotspot(defaults) {
    if (!defaults || !defaults.hotspots || !defaults.hotspots.length) return null;
    let idx = Number(defaults.active);
    if (isNaN(idx) || idx < 0 || idx >= defaults.hotspots.length) idx = 0;
    return defaults.hotspots[idx];
  }

  function locationFieldsBlank(row) {
    return !railroadOf(row) && !subOf(row) && !(row.querySelector(".f-loc") && row.querySelector(".f-loc").value.trim()) && !stateOf(row);
  }

  async function applyLoggingDefaultsToRow(row, opts) {
    opts = opts || {};
    const defaults = opts.defaults;
    if (!row || !defaults) return false;
    const onlyEmpty = opts.onlyEmpty !== false;
    if (onlyEmpty && !locationFieldsBlank(row)) return false;
    if (!Object.keys(SUBS_BY_RR).length) await ensureSubs();
    const spot = activeHotspot(defaults);
    const rr = defaults.railroad || "";
    if (rr) {
      setSelectValue(row.querySelector(".f-rr"), row.querySelector(".f-rr-custom"), rr);
      row.querySelector(".f-rr").dataset.prev = row.querySelector(".f-rr").value;
      fillMarkSelect(row, markOf(row));
    }
    const sub = (spot && spot.subdivision) || "";
    fillSubSelect(row, sub);
    const loc = row.querySelector(".f-loc");
    if (loc) loc.value = (spot && spot.location) || "";
    if (spot && spot.state) applyRowState(row, spot.state);
    else if (!onlyEmpty) setRowState(row, "");
    markEmpty(row);
    return true;
  }

  function openBlankRow() {
    const rows = rowsEl.querySelectorAll(".train-row");
    for (let i = 0; i < rows.length; i += 1) {
      if (!rowIsFilled(readRow(rows[i], false)) && !rowHasClip(rows[i])) return rows[i];
    }
    return null;
  }

  function rowIsPlaceOnly(row) {
    if (!row || rowHasClip(row)) return false;
    const data = readRow(row, false);
    return !Boolean(
      data.lead_locomotive ||
        data.direction ||
        data.stopped ||
        data.in_siding ||
        data.crew_change ||
        data.no_crew ||
        data.power_consist ||
        data.car_counts ||
        (data.train_types && data.train_types.length) ||
        data.load_status ||
        data.notes ||
        data.train_symbol ||
        data.train_number ||
        data.lead_status ||
        data.coal_mark ||
        data.con_overseas ||
        data.con_domestic ||
        (data.special_power && (data.special_power.heritage.length || data.special_power.steam.length || data.special_power.units)) ||
        data.time
    );
  }

  function openSpotRow() {
    const rows = rowsEl.querySelectorAll(".train-row");
    for (let i = 0; i < rows.length; i += 1) {
      if (rowIsPlaceOnly(rows[i])) return rows[i];
    }
    return null;
  }

  function spotFromEntry(entry) {
    if (!entry) return null;
    const location = String(entry.location_spot || "").trim();
    const subdivision = String(entry.location_subdivision || "").trim();
    if (!location && !subdivision) return null;
    const spot = {
      railroad: String(entry.railroad || "").trim(),
      subdivision: subdivision,
      location: location,
      state: String(entry.location_state || "").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 2),
    };
    const shortLoc = location.replace(/\s*\(mp[^)]*\)/i, "").trim();
    if (shortLoc) spot.label = shortLoc;
    return spot;
  }

  function spotIdentityKey(spot) {
    return [
      String((spot && spot.railroad) || "").toLowerCase(),
      String((spot && spot.subdivision) || "").toLowerCase(),
      String((spot && spot.location) || "").toLowerCase(),
      String((spot && spot.state) || "").toLowerCase(),
    ].join("|");
  }

  function todayQuickSpots() {
    const seen = {};
    const spots = [];
    (dayEntries || []).slice().reverse().forEach(function (entry) {
      const spot = spotFromEntry(entry);
      if (!spot) return;
      const key = spotIdentityKey(spot);
      if (seen[key]) return;
      seen[key] = true;
      spots.push(spot);
    });
    return spots;
  }

  async function applySpotToOpenCard(spot) {
    if (!spot) return false;
    const card = openSpotRow() || openBlankRow();
    if (!card) {
      showBanner("Open a blank train card first.", "error");
      return false;
    }
    const ok = await applyLoggingDefaultsToRow(card, {
      defaults: { railroad: spot.railroad || "", hotspots: [spot], active: 0 },
      onlyEmpty: false,
    });
    if (ok) applyPadDefaultsToRow(card);
    return ok;
  }

  function spotsPadStarterBits() {
    const data = readPadDefaultsData();
    const rrMode = data.railroadMode || (data.railroad ? "fixed" : "none");
    let railroad = "";
    if (rrMode === "fixed") railroad = String(data.railroad || "").trim();
    else if (rrMode === "last") railroad = String(data.lastRailroad || data.railroad || "").trim();
    const trainType = String(data.trainType || "").trim();
    const timeNow = data.timeMode === "now";
    const sub = String(data.homeSubdivision || "").trim();
    const other = String(data.homeLocationOther || "").trim();
    const station = String(data.homeStation || data.homeLocation || "").trim();
    const loc = other || station;
    const state = String(data.homeState || "").trim();
    const homeLabel = [sub, loc, state].filter(Boolean).join(" · ");
    return {
      railroad: railroad,
      trainType: trainType,
      timeNow: timeNow,
      home: Boolean(sub || loc || state),
      homeLabel: homeLabel,
      hasAny: Boolean(railroad || trainType || timeNow || sub || loc || state),
    };
  }

  function openCardForSpotsPad() {
    const card = openSpotRow() || openBlankRow();
    if (!card) {
      showBanner("Open a blank train card first.", "error");
      return null;
    }
    return card;
  }

  async function applySpotsPadStarter(kind) {
    const card = openCardForSpotsPad();
    if (!card) return false;
    const bits = spotsPadStarterBits();
    if (kind === "all") {
      applyPadDefaultsToRow(card);
      showBanner("Applied pad starters.", "ok");
      return true;
    }
    if (kind === "home") {
      if (!bits.home) return false;
      const data = readPadDefaultsData();
      const sub = String(data.homeSubdivision || "").trim();
      const other = String(data.homeLocationOther || "").trim();
      const station = String(data.homeStation || data.homeLocation || "").trim();
      const loc = other || station;
      const state = String(data.homeState || "").trim();
      if (sub && typeof fillSubSelect === "function") fillSubSelect(card, sub);
      const locEl = card.querySelector(".f-loc");
      if (locEl && loc) locEl.value = loc;
      if (state && typeof applyRowState === "function") applyRowState(card, state);
      markEmpty(card);
      showBanner("Applied home place.", "ok");
      return true;
    }
    if (kind === "railroad") {
      if (!bits.railroad) return false;
      const select = card.querySelector(".f-rr");
      const custom = card.querySelector(".f-rr-custom");
      if (select) {
        if (typeof setSelectValue === "function") setSelectValue(select, custom, bits.railroad);
        else {
          select.value = bits.railroad;
          if (custom) custom.hidden = true;
        }
        select.dataset.prev = select.value;
        if (typeof fillMarkSelect === "function") fillMarkSelect(card, markOf(card));
      }
      markEmpty(card);
      showBanner("Applied railroad.", "ok");
      return true;
    }
    if (kind === "type") {
      if (!bits.trainType) return false;
      applyPadTrainType(card, bits.trainType);
      markEmpty(card);
      showBanner("Applied train type.", "ok");
      return true;
    }
    if (kind === "time") {
      if (!bits.timeNow) return false;
      fillNow(card);
      markEmpty(card);
      showBanner("Stamped time.", "ok");
      return true;
    }
    return false;
  }

  function paintSpotsPadStarters() {
    const box = document.getElementById("quick-spots-pad-actions");
    const empty = document.getElementById("quick-spots-pad-empty");
    if (!box) return;
    const bits = spotsPadStarterBits();
    if (empty) empty.hidden = bits.hasAny;
    if (!bits.hasAny) {
      box.innerHTML = "";
      return;
    }
    const chips = [];
    if (bits.home) {
      chips.push({
        kind: "home",
        label: "Home place",
        title: bits.homeLabel || "Home place from Pad Defaults",
      });
    }
    if (bits.railroad) {
      chips.push({ kind: "railroad", label: "Railroad · " + bits.railroad, title: "Apply " + bits.railroad });
    }
    if (bits.trainType) {
      chips.push({ kind: "type", label: bits.trainType, title: "Apply train type " + bits.trainType });
    }
    if (bits.timeNow) {
      chips.push({ kind: "time", label: "Stamp time", title: "Stamp the current time" });
    }
    chips.push({ kind: "all", label: "Apply all", title: "Apply every Pad Defaults starter to the open card", primary: true });
    box.innerHTML = chips
      .map(function (chip) {
        return (
          '<button type="button" class="btn' +
          (chip.primary ? " primary" : " ghost") +
          ' quick-spots-pad-btn" data-spots-pad="' +
          escapeText(chip.kind) +
          '" title="' +
          escapeText(chip.title) +
          '">' +
          escapeText(chip.label) +
          "</button>"
        );
      })
      .join("");
    Array.prototype.forEach.call(box.querySelectorAll("[data-spots-pad]"), function (btn) {
      btn.addEventListener("click", async function (event) {
        event.preventDefault();
        await applySpotsPadStarter(btn.getAttribute("data-spots-pad"));
      });
    });
  }

  function isFavoriteSpot(spot) {
    const key = spotIdentityKey(spot);
    return quickSpotFavorites.some(function (item) {
      return spotIdentityKey(item) === key;
    });
  }

  async function loadQuickSpotFavorites() {
    const result = await api("/api/quick-spots", { quiet: true });
    if (result.ok && Array.isArray(result.data && result.data.favorites)) {
      quickSpotFavorites = result.data.favorites;
    }
    return quickSpotFavorites;
  }

  async function toggleFavoriteSpot(spot) {
    if (!spot) return;
    const removing = isFavoriteSpot(spot);
    const result = await api(removing ? "/api/quick-spots/remove" : "/api/quick-spots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spot: spot }),
    });
    if (!result.ok) {
      showBanner((result.data && result.data.error) || "Could not update favorites.", "error");
      return;
    }
    quickSpotFavorites = (result.data && result.data.favorites) || [];
    paintQuickSpots();
    showBanner(removing ? "Removed from Quick Spots." : "Saved to Quick Spots favorites.", "ok");
  }

  function quickSpotRowHtml(spot, opts) {
    opts = opts || {};
    const label = hotspotLabel(spot) || spot.location || spot.subdivision || "Spot";
    const detail = [spot.railroad, spot.subdivision, spot.state].filter(Boolean).join(" · ");
    const fav = isFavoriteSpot(spot);
    return (
      '<div class="quick-spots-row">' +
      '<button type="button" class="quick-spots-apply" data-spot-apply="' +
      escapeText(JSON.stringify(spot)) +
      '">' +
      '<span class="quick-spots-name">' +
      escapeText(label) +
      "</span>" +
      (detail ? '<span class="quick-spots-detail">' + escapeText(detail) + "</span>" : "") +
      "</button>" +
      '<button type="button" class="btn tiny ghost quick-spots-star' +
      (fav ? " is-on" : "") +
      '" data-spot-star="' +
      escapeText(JSON.stringify(spot)) +
      '" title="' +
      (fav ? "Remove from favorites" : "Save to favorites") +
      '" aria-label="' +
      (fav ? "Remove from favorites" : "Save to favorites") +
      '">' +
      (fav ? "★" : "☆") +
      "</button>" +
      (opts.favorited
        ? '<button type="button" class="btn tiny ghost" data-spot-remove="' +
          escapeText(JSON.stringify(spot)) +
          '" title="Remove" aria-label="Remove">✕</button>'
        : "") +
      "</div>"
    );
  }

  function paintQuickSpots() {
    const todayBox = document.getElementById("quick-spots-today");
    const favBox = document.getElementById("quick-spots-favorites");
    if (!todayBox || !favBox) return;
    paintSpotsPadStarters();
    const today = todayQuickSpots();
    todayBox.innerHTML = today.length
      ? today.map(function (spot) { return quickSpotRowHtml(spot); }).join("")
      : '<p class="quick-spots-empty muted">No places logged today yet.</p>';
    favBox.innerHTML = quickSpotFavorites.length
      ? quickSpotFavorites.map(function (spot) { return quickSpotRowHtml(spot, { favorited: true }); }).join("")
      : '<p class="quick-spots-empty muted">Star a Today spot, or a location in Subdivisions, to keep it here.</p>';
    const panel = document.getElementById("quick-spots-dialog") || document.getElementById("quick-spots-panel");
    if (!panel) return;
    Array.prototype.forEach.call(panel.querySelectorAll("[data-spot-apply]"), function (btn) {
      btn.addEventListener("click", async function (event) {
        event.preventDefault();
        let spot = null;
        try { spot = JSON.parse(btn.getAttribute("data-spot-apply") || "null"); } catch (err) { spot = null; }
        if (await applySpotToOpenCard(spot)) {
          closeQuickSpots();
          showBanner("Filled from Spots.", "ok");
        }
      });
    });
    Array.prototype.forEach.call(panel.querySelectorAll("[data-spot-star]"), function (btn) {
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        let spot = null;
        try { spot = JSON.parse(btn.getAttribute("data-spot-star") || "null"); } catch (err) { spot = null; }
        toggleFavoriteSpot(spot);
      });
    });
    Array.prototype.forEach.call(panel.querySelectorAll("[data-spot-remove]"), function (btn) {
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        let spot = null;
        try { spot = JSON.parse(btn.getAttribute("data-spot-remove") || "null"); } catch (err) { spot = null; }
        toggleFavoriteSpot(spot);
      });
    });
  }

  window.trainLogQuickSpots = {
    load: loadQuickSpotFavorites,
    toggle: toggleFavoriteSpot,
    isFavorite: isFavoriteSpot,
    list: function () { return quickSpotFavorites.slice(); },
    refresh: paintQuickSpots,
    key: spotIdentityKey,
  };

  let quickSpotsAnchor = null;

  function setQuickSpotsExpanded(open) {
    const btn = document.getElementById("btn-quick-spots");
    const anchor = quickSpotsAnchor;
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (anchor && anchor !== btn) anchor.setAttribute("aria-expanded", open ? "true" : "false");
    document.querySelectorAll('.entry-bottom-actions [data-press="btn-quick-spots"]').forEach(function (el) {
      el.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  function closeQuickSpots() {
    const dialog = document.getElementById("quick-spots-dialog");
    if (dialog && dialog.open) dialog.close();
    setQuickSpotsExpanded(false);
    quickSpotsAnchor = null;
  }

  async function openQuickSpots(anchor) {
    const dialog = document.getElementById("quick-spots-dialog");
    if (!dialog || typeof dialog.showModal !== "function") return;
    quickSpotsAnchor = anchor || document.getElementById("btn-quick-spots");
    await loadQuickSpotFavorites();
    paintQuickSpots();
    if (!dialog.open) dialog.showModal();
    setQuickSpotsExpanded(true);
  }

  async function toggleQuickSpots(anchor) {
    const dialog = document.getElementById("quick-spots-dialog");
    if (!dialog) return;
    if (dialog.open) closeQuickSpots();
    else await openQuickSpots(anchor);
  }

  document.querySelectorAll(".entry-bottom-actions [data-press], .entry-refs [data-press]").forEach(function (button) {
    button.addEventListener("click", function (event) {
      const id = button.dataset.press;
      if (id === "btn-quick-spots") {
        event.preventDefault();
        event.stopPropagation();
        toggleQuickSpots(button);
        return;
      }
      const target = document.getElementById(id);
      if (target) target.click();
    });
  });

  const quickSpotsBtn = document.getElementById("btn-quick-spots");
  if (quickSpotsBtn) {
    quickSpotsBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      toggleQuickSpots(quickSpotsBtn);
    });
  }
  const quickSpotsDialog = document.getElementById("quick-spots-dialog");
  if (quickSpotsDialog) {
    quickSpotsDialog.addEventListener("close", function () {
      setQuickSpotsExpanded(false);
      quickSpotsAnchor = null;
    });
    quickSpotsDialog.addEventListener("click", function (event) {
      if (event.target === quickSpotsDialog) closeQuickSpots();
    });
  }
  document.getElementById("entry-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    clearInvalid();
    const filled = collectFilled();
    if (!filled.length) {
      showBanner("Fill in the train before submitting.", "error");
      return;
    }
    if (!dateEl.value) {
      dateEl.classList.add("is-invalid");
      showBanner("Date Trackside is required.", "error");
      return;
    }
    filled.forEach(function (payload) {
      const row = rowsEl.querySelector('.train-row[data-row="' + payload.row + '"]');
      missingFields(payload).forEach(function (field) {
        markFieldInvalid(row, field);
      });
    });
    showBanner("");
    await stopLiveRecordings();
    let result = await submitEntries(filled, false);
    if (result.status === 409 || (result.data && result.data.duplicate)) {
      const dupes = result.data.duplicates || [{ existing: result.data.existing || [], row: 0 }];
      const ok = await askDuplicate(dupes);
      if (!ok) {
        showBanner("Not saved. Change the row, or confirm if it really is a second sighting.", "error");
        return;
      }
      const forced = (result.data.duplicates || []).map(function (item) {
        return Object.assign({}, item.entry || filled[item.row], { force: true, row: item.row });
      });
      if (editingId) {
        result = await submitEntries(filled, true);
      } else {
        const createdOk = result.data.created || [];
        result = await submitEntries(forced.length ? forced : filled, true);
        if (createdOk.length && result.data && result.data.created) {
          result.data.created = createdOk.concat(result.data.created);
        }
      }
    }
    const saveFailed =
      (!result.ok && result.status !== 201) ||
      (result.data && result.data.success === false && !result.data.duplicate && !(result.data.created || []).length);
    if (saveFailed) {
      const err = result.data && (result.data.error || (result.data.errors && result.data.errors[0] && result.data.errors[0].error) || result.data.message);
      showBanner(err || "Could not save entries.", "error");
      if (result.data && result.data.field && filled[0]) {
        markFieldInvalid(rowsEl.querySelector('.train-row[data-row="' + filled[0].row + '"]'), result.data.field);
      }
      if (result.data && result.data.errors) {
        result.data.errors.forEach(function (item) {
          markFieldInvalid(rowsEl.querySelector('.train-row[data-row="' + item.row + '"]'), item.field);
        });
      }
      return;
    }
    if (result.data && result.data.errors && result.data.errors.length) {
      result.data.errors.forEach(function (item) {
        markFieldInvalid(rowsEl.querySelector('.train-row[data-row="' + item.row + '"]'), item.field);
      });
      showBanner(
        (result.data.message || "Saved some rows") +
          " — " +
          result.data.errors.map(function (item) {
            return "row " + (Number(item.row) + 1) + ": " + item.error;
          }).join("; "),
        "error"
      );
    } else {
      const wasPendingAccept = Boolean(pendingEditId);
      const wasEdit = Boolean(editingId || pendingEditId);
      showBanner(formatLoggedBanner(filled, result, wasEdit), "ok");
      if (wasEdit) {
        setEditMode(null);
        const back = endEditDialog(true);
        if (back) afterEditDialog(back, true);
        if (wasPendingAccept) {
          loadPending();
          refreshPendingBadge();
        }
      } else {
        const afterMode = readPadDefaultsData().afterSubmit || "clear";
        filled.forEach(function (item) {
          rememberPadFromEntry(item);
          const row = rowsEl.querySelector('.train-row[data-row="' + item.row + '"]');
          if (!row) return;
          clearRow(row);
          resetEntryClip(row);
          if (afterMode === "keep-railroad" || afterMode === "keep-place") {
            if (item.railroad) {
              setSelectValue(row.querySelector(".f-rr"), row.querySelector(".f-rr-custom"), item.railroad);
              row.querySelector(".f-rr").dataset.prev = row.querySelector(".f-rr").value;
              fillMarkSelect(row, "");
            }
          }
          if (afterMode === "keep-place") {
            fillSubSelect(row, item.location_subdivision || "");
            const loc = row.querySelector(".f-loc");
            if (loc) loc.value = item.location_spot || "";
            if (item.location_state) applyRowState(row, item.location_state);
            else setRowState(row, "");
          }
        });
        forgetHeldClip();
        forgetEntryDraft();
        // Keep other entry cards the user is still filling — only trim empty extras.
        await ensurePadBlankRows();
      }
      await loadDayLog();
      await refreshTripNames();
    }
    refreshPendingBadge();
  });

  document.getElementById("btn-clear-all").addEventListener("click", function () {
    if (editingId) {
      setEditMode(null);
    }
    Array.prototype.forEach.call(rowsEl.querySelectorAll(".train-row"), clearRow);
    Array.prototype.slice.call(rowsEl.querySelectorAll(".train-row"), 1).forEach(function (row) {
      row.remove();
    });
    relabelRows();
    forgetEntryDraft();
    showBanner("Form cleared.");
  });

  document.getElementById("btn-cancel-edit").addEventListener("click", function () {
    setEditMode(null);
    showBanner("Edit cancelled.");
  });

  let quickAddBusy = false;
  let quickAddQuietUntil = 0;
  const addEntryBtn = document.getElementById("btn-add-entry-card");
  if (addEntryBtn && !addEntryBtn._boundAddCard) {
    addEntryBtn._boundAddCard = true;
    addEntryBtn.addEventListener("click", function () {
      addPadEntryCard();
    });
  }
  window.trainLogAddEntryCard = addPadEntryCard;

  document.getElementById("btn-quick-add").addEventListener("click", async function () {
    if (quickAddBusy || Date.now() < quickAddQuietUntil) return;
    quickAddBusy = true;
    let filled = false;
    try {
      await formReady;
      const result = await api("/api/locomotives/last");
      const last = result.data && result.data.last_entry;
      let quickRaw = "";
      try { quickRaw = sessionStorage.getItem("rr-quick-units") || ""; } catch (err) { quickRaw = ""; }
      let quickFields = null;
      if (quickRaw) {
        try { quickFields = JSON.parse(quickRaw); } catch (err) { quickFields = null; }
      }
      if (!last && !quickFields) {
        showBanner("Nothing to copy yet — log a train first.", "error");
        return;
      }
      const row = entryRowForNewTrain();
      if (!row) return;
      relabelRows();
      if (quickRaw) {
        try { sessionStorage.removeItem("rr-quick-units"); } catch (err) { /* already consumed */ }
      }
      clearRow(row);
      if (last) {
        setSelectValue(row.querySelector(".f-rr"), row.querySelector(".f-rr-custom"), last.railroad || "");
        row.querySelector(".f-rr").dataset.prev = row.querySelector(".f-rr").value;
        fillMarkSelect(row, "");
        if (!Object.keys(SUBS_BY_RR).length) await ensureSubs();
        fillSubSelect(row, last.location_subdivision || "");
        row.querySelector(".f-loc").value = last.location_spot || "";
        applyRowState(row, last.location_state || "");
      }
      if (quickFields) {
        applyReadUnits(quickFields, last
          ? "Quick Add copied railroad, subdivision, location, and state, and filled "
          : "Filled ");
      } else {
        markEmpty(row);
        showBanner("Quick Add copied railroad, subdivision, location, and state.");
      }
      const loco = row.querySelector(".f-loco");
      if (loco) loco.focus();
      filled = true;
    } finally {
      quickAddBusy = false;
      if (filled) quickAddQuietUntil = Date.now() + 700;
    }
  });

  function filterQuery() {
    const form = document.getElementById("filter-form");
    const data = new FormData(form);
    const params = new URLSearchParams();
    data.forEach(function (value, key) {
      if (value) params.set(key, value);
    });
    if (logIds) params.set("ids", logIds.ids.join(","));
    const query = params.toString();
    return query ? "?" + query : "";
  }

  let logIds = null;
  function setLogIds(pick) {
    logIds = pick && pick.ids ? { ids: pick.ids.slice(), label: pick.label || "" } : null;
    const note = document.getElementById("log-ids-note");
    const text = document.getElementById("log-ids-text");
    if (!note || !text) return;
    note.hidden = !logIds;
    if (logIds) {
      const n = logIds.ids.length;
      text.textContent = "Showing only " + n + " train" + (n === 1 ? "" : "s") + (logIds.label ? " from " + logIds.label : "") + ".";
    }
  }

  function showLogIds(ids, label) {
    document.getElementById("filter-form").reset();
    setLogIds({ ids: ids, label: label });
    if (currentView() === "log") loadLog();
    else location.hash = "log";
  }

  let logEntries = [];
  let logSelected = {};
  let logSortKey = "date";
  let logSortDir = -1;

  function logSortValue(entry, key) {
    if (key === "location") {
      return (entry.location_spot || "").toLowerCase();
    }
    if (key === "location_subdivision") {
      return (entry.location_subdivision || "").toLowerCase();
    }
    if (key === "media") {
      return (entry.photographed ? "P" : "") + (entry.videoed ? "V" : "") + (entry.night ? "N" : "");
    }
    if (key === "train_types") return (entry.train_types_label || "").toLowerCase();
    if (key === "notes") return notesText(entry).toLowerCase();
    if (key === "cars") return entry.car_counts || "";
    if (key === "date") return (entry.date || "") + "#" + String(entry.id || 0).padStart(10, "0");
    const value = entry[key];
    return value == null ? "" : String(value).toLowerCase();
  }

  function sortedLogEntries() {
    const rows = logEntries.slice();
    rows.sort(function (a, b) {
      const av = logSortValue(a, logSortKey);
      const bv = logSortValue(b, logSortKey);
      if (av < bv) return -1 * logSortDir;
      if (av > bv) return 1 * logSortDir;
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.id || 0) - (a.id || 0);
    });
    return rows;
  }

  function syncLogSortHeaders() {
    Array.prototype.forEach.call(document.querySelectorAll("#view-log .log-table th[data-sort]"), function (th) {
      const key = th.getAttribute("data-sort");
      th.classList.toggle("is-sort-asc", key === logSortKey && logSortDir === 1);
      th.classList.toggle("is-sort-desc", key === logSortKey && logSortDir === -1);
    });
  }

  function escapeText(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function logAmpm(time) {
    const text = String(time || "").trim();
    if (!text || text.indexOf(":") === -1) return "";
    const hour = parseInt(text.split(":", 1)[0], 10);
    if (!isFinite(hour) || hour < 0 || hour > 23) return "";
    return hour < 12 ? "AM" : "PM";
  }

  function logMinutes(time) {
    const text = String(time || "").trim();
    if (!text || text.indexOf(":") === -1) return null;
    const parts = text.split(":");
    const hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);
    if (!isFinite(hour) || !isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return hour * 60 + minute;
  }

  function logSpecialPower(entry) {
    const raw = entry && entry.special_power;
    if (!raw) return { heritage: [], steam: [] };
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return {
          heritage: (parsed && parsed.heritage) || [],
          steam: (parsed && parsed.steam) || [],
        };
      } catch (err) {
        return { heritage: [], steam: [] };
      }
    }
    return {
      heritage: raw.heritage || [],
      steam: raw.steam || [],
    };
  }

  function logMeetCount(entries) {
    const opposite = { North: "South", South: "North", East: "West", West: "East" };
    const windowMins = 3;
    const buckets = {};
    entries.forEach(function (entry) {
      const minute = logMinutes(entry.time);
      const day = entry.date || "";
      const spot = (entry.location_spot || "").trim().toLowerCase();
      const dir = entry.direction || "";
      if (minute == null || !day || !spot || !opposite[dir]) return;
      const key = day + "\0" + spot;
      (buckets[key] = buckets[key] || []).push({ minute: minute, dir: dir, id: entry.id || 0 });
    });
    let total = 0;
    Object.keys(buckets).forEach(function (key) {
      const stamps = buckets[key].sort(function (a, b) {
        return a.minute - b.minute || a.id - b.id;
      });
      for (let i = 0; i < stamps.length; i += 1) {
        for (let j = i + 1; j < stamps.length; j += 1) {
          if (stamps[j].minute - stamps[i].minute > windowMins) break;
          if (stamps[j].dir === opposite[stamps[i].dir]) total += 1;
        }
      }
    });
    return total;
  }

  function logKpiTileCard(cells, tint) {
    return (
      '<div class="dash-kpi dash-kpi-grid is-tiles"' +
      (tint ? ' data-kpi="' + escapeText(tint) + '"' : "") +
      ">" +
      cells
        .map(function (item) {
          return (
            '<div class="dash-kpi-cell is-tile">' +
            "<b>" +
            escapeText(String(item.value)) +
            "</b><span>" +
            escapeText(String(item.label)) +
            "</span></div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderLogStats() {
    const el = document.getElementById("log-stats");
    const kpis = document.getElementById("log-kpis");
    if (!el || !kpis) return;
    if (!logEntries.length) {
      el.hidden = true;
      kpis.innerHTML = "";
      return;
    }
    const days = {};
    const locs = {};
    const subs = {};
    const states = {};
    const trips = {};
    const types = {};
    const symbols = {};
    const leads = {};
    const consists = {};
    const rrCounts = {};
    const dirs = { North: 0, East: 0, South: 0, West: 0 };
    let photos = 0;
    let videos = 0;
    let either = 0;
    let notes = 0;
    let loads = 0;
    let empties = 0;
    let night = 0;
    let am = 0;
    let pm = 0;
    let heritage = 0;
    let steam = 0;
    let a250 = 0;
    logEntries.forEach(function (entry) {
      const date = entry.date || "";
      if (date) days[date] = true;
      const spot = (entry.location_spot || "").trim();
      if (spot) locs[spot] = true;
      const sub = (entry.location_subdivision || "").trim();
      if (sub) subs[sub] = true;
      const state = (entry.location_state || "").trim().toUpperCase();
      if (state) states[state] = true;
      const trip = (entry.trip_name || "").trim();
      if (trip) trips[trip] = true;
      const symbol = (entry.train_symbol || "").trim();
      if (symbol) symbols[symbol] = true;
      const lead = (entry.lead_locomotive || "").trim();
      if (lead) leads[lead] = true;
      const consist = (entry.power_consist || "").trim();
      if (consist) consists[consist] = true;
      const rr = (entry.railroad || "").trim() || "Unknown";
      rrCounts[rr] = (rrCounts[rr] || 0) + 1;
      (entry.train_types || []).forEach(function (name) {
        if (name) types[name] = true;
      });
      if (!(entry.train_types || []).length) types.Unspecified = true;
      const dir = entry.direction || "";
      if (Object.prototype.hasOwnProperty.call(dirs, dir)) dirs[dir] += 1;
      if (entry.photographed) photos += 1;
      if (entry.videoed) videos += 1;
      if (entry.photographed || entry.videoed) either += 1;
      if ((entry.notes || "").trim()) notes += 1;
      if (entry.night) night += 1;
      const loadParts = String(entry.load_status || "")
        .split("/")
        .filter(Boolean);
      if (loadParts.indexOf("Loads") !== -1) loads += 1;
      if (loadParts.indexOf("Empties") !== -1) empties += 1;
      const period = logAmpm(entry.time);
      if (period === "AM") am += 1;
      if (period === "PM") pm += 1;
      const special = logSpecialPower(entry);
      if (special.heritage.length) {
        heritage += 1;
        special.heritage.forEach(function (item) {
          if (item && String(item.era || "").toLowerCase() === "a250") a250 += 1;
        });
      }
      if (special.steam.length) steam += 1;
    });
    const trains = logEntries.length;
    const dayCount = Object.keys(days).length || 1;
    const avg = (trains / dayCount).toFixed(1);
    const mediaPct = trains ? Math.round((100 * either) / trains) : 0;
    const meets = logMeetCount(logEntries);
    const topRoads = Object.keys(rrCounts)
      .map(function (name) {
        return { name: name, trains: rrCounts[name] };
      })
      .sort(function (a, b) {
        return b.trains - a.trains || a.name.localeCompare(b.name);
      });
    const top3 = topRoads.slice(0, 3);
    const otherTrains = topRoads.slice(3).reduce(function (sum, row) {
      return sum + row.trains;
    }, 0);
    while (top3.length < 3) top3.push({ name: "—", trains: 0 });
    el.hidden = false;
    kpis.innerHTML =
      logKpiTileCard([
        { value: trains, label: "Trains" },
        { value: loads, label: "Loads" },
        { value: empties, label: "Empties" },
        { value: night, label: "Night" },
      ], "trains") +
      logKpiTileCard([
        { value: Object.keys(days).length, label: "Days" },
        { value: avg, label: "Avg" },
        { value: am, label: "AM" },
        { value: pm, label: "PM" },
      ], "when") +
      logKpiTileCard([
        { value: Object.keys(locs).length, label: "Spots" },
        { value: Object.keys(subs).length, label: "Subs" },
        { value: Object.keys(states).length, label: "States" },
        { value: Object.keys(trips).length, label: "Trips" },
      ], "where") +
      logKpiTileCard([
        { value: dirs.North, label: "North" },
        { value: dirs.East, label: "East" },
        { value: dirs.South, label: "South" },
        { value: dirs.West, label: "West" },
      ], "direction") +
      logKpiTileCard([
        { value: photos, label: "Photos" },
        { value: videos, label: "Videos" },
        { value: mediaPct + "%", label: "Either" },
        { value: notes, label: "Notes" },
      ], "media") +
      logKpiTileCard([
        { value: Object.keys(symbols).length, label: "Symbols" },
        { value: Object.keys(types).length, label: "Types" },
        { value: Object.keys(leads).length, label: "Leads" },
        { value: Object.keys(consists).length, label: "Consists" },
      ], "symbols") +
      logKpiTileCard([
        { value: top3[0].trains, label: top3[0].name },
        { value: top3[1].trains, label: top3[1].name },
        { value: top3[2].trains, label: top3[2].name },
        { value: otherTrains, label: "Other" },
      ], "mix") +
      logKpiTileCard([
        { value: heritage, label: "Heritage" },
        { value: steam, label: "Steam" },
        { value: a250, label: "A250" },
        { value: meets, label: "Meets" },
      ], "special");
  }

  function logLoadCell(entry) {
    return entry.load_status ? "Yes" : "No";
  }

  const LOG_COLS = [
    { key: "date", label: "Date" },
    { key: "time", label: "Time" },
    { key: "time_zone", label: "Zone" },
    { key: "railroad", label: "RR" },
    { key: "lead_locomotive", label: "Lead" },
    { key: "train_symbol", label: "Symbol" },
    { key: "direction", label: "Dir" },
    { key: "power_consist", label: "Consist" },
    { key: "train_types", label: "Type" },
    { key: "load_status", label: "L/E" },
    { key: "cars", label: "Cars" },
    { key: "location", label: "Location" },
    { key: "location_state", label: "State" },
    { key: "location_subdivision", label: "Sub" },
    { key: "notes", label: "Notes" },
    { key: "media", label: "Media" },
  ];
  const ICON_PENCIL =
    '<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  const ICON_TRASH =
    '<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';
  const ICON_NOTE =
    '<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/></svg>';
  const NOTES_MODES = ["short", "icon", "full"];
  let notesMode = "short";
  try {
    const savedMode = localStorage.getItem("rr-log-notes-mode");
    if (NOTES_MODES.indexOf(savedMode) !== -1) notesMode = savedMode;
  } catch (e) {}

  let subOwnerSource = null;
  let subOwnerExact = {};
  let subOwnerBase = {};

  function buildSubOwners() {
    if (subOwnerSource === SUBS_BY_RR) return;
    subOwnerSource = SUBS_BY_RR;
    subOwnerExact = {};
    subOwnerBase = {};
    Object.keys(SUBS_BY_RR || {}).forEach(function (rr) {
      (SUBS_BY_RR[rr] || []).forEach(function (name) {
        (subOwnerExact[name] = subOwnerExact[name] || []).push(rr);
        const base = name.replace(/\s*\([^()]+\)$/, "");
        (subOwnerBase[base] = subOwnerBase[base] || []).push(rr);
      });
    });
  }

  function subOwnerTag(name, trainRr) {
    buildSubOwners();
    if (!subOwnerExact[name] && !subOwnerBase[name] && !/\bsub$/i.test(name)) name += " Sub";
    const exact = subOwnerExact[name];
    if (exact && exact.length) {
      const freight = exact.filter(function (rr) { return FREIGHT_RAILROADS.indexOf(rr) !== -1; });
      return (freight.length ? freight : exact).join("/");
    }
    const loose = subOwnerBase[name] || [];
    if (trainRr && loose.indexOf(trainRr) !== -1) return trainRr;
    return "";
  }

  function subCellHtml(text, trainRr) {
    const match = /^(.*\S)\s*\(([^()]+)\)$/.exec(text);
    const name = match ? match[1] : text;
    const tag = match ? match[2] : subOwnerTag(text, trainRr);
    if (!tag) return escapeText(text);
    return '<span class="sub-name">' + escapeText(name) + '</span><span class="sub-rr">' + escapeText(tag) + "</span>";
  }

  function specialText(entry) {
    const special = (entry && entry.special_power) || {};
    const eras = { a250: "America 250" };
    const spots = { lead: "leading", trail: "trailing", dp: "DP", assist: "steam assist" };
    const parts = [];
    (special.heritage || []).forEach(function (item) {
      const extra = [eras[item.era], spots[item.position]].filter(Boolean).join(", ");
      parts.push("Heritage " + [item.unit, item.scheme].filter(Boolean).join(" ") + (extra ? " (" + extra + ")" : ""));
    });
    const steam = special.steam || [];
    const engineText = function (item) {
      return [item.engine, item.name].filter(Boolean).join(" ") + (item.wheels ? " (" + item.wheels + ")" : "");
    };
    for (let i = 0; i < steam.length; i += 1) {
      const item = steam[i];
      const assist = item.diesel_assist ? "diesel assist" + ((item.assist || []).length ? " " + item.assist.join(" + ") : "") : "";
      if (item.doubleheader && steam[i + 1]) {
        parts.push("Steam doubleheader " + engineText(item) + " + " + engineText(steam[i + 1]) + (assist ? ", " + assist : ""));
        i += 1;
        continue;
      }
      const extra = [item.wheels, assist].filter(Boolean).join(", ");
      parts.push("Steam " + [item.engine, item.name].filter(Boolean).join(" ") + (extra ? " (" + extra + ")" : ""));
    }
    return parts.join(" · ");
  }

  function infoText(entry) {
    return [specialText(entry), entry.train_info || ""].filter(Boolean).join(" · ");
  }

  function notesText(entry) {
    return [infoText(entry), entry.notes || ""].filter(Boolean).join(" · ");
  }

  function notesHtml(entry) {
    const info = infoText(entry);
    const note = entry.notes || "";
    return (
      (info ? '<span class="note-info">' + escapeText(info) + "</span>" : "") +
      (info && note ? " " : "") +
      (note ? '<span class="note-own">' + escapeText(note) + "</span>" : "")
    );
  }

  function notesCellHtml(entry) {
    const note = notesText(entry);
    if (!note) return "";
    if (notesMode === "full") return notesHtml(entry);
    if (notesMode === "icon") {
      return (
        '<button type="button" class="note-open note-icon" data-note="' +
        entry.id +
        '" title="' +
        escapeText(note) +
        '" aria-label="Read notes for entry #' +
        entry.id +
        '">' +
        ICON_NOTE +
        "</button>"
      );
    }
    return (
      '<button type="button" class="note-open note-text" data-note="' +
      entry.id +
      '" title="Click to read all">' +
      notesHtml(entry) +
      "</button>"
    );
  }

  const notePop = document.getElementById("note-pop");
  function closeNotePop() {
    if (notePop && !notePop.hidden) notePop.hidden = true;
  }
  function openNotePop(button) {
    if (!notePop) return;
    const id = button.getAttribute("data-note");
    const entry = logEntries.find(function (item) {
      return String(item.id) === String(id);
    });
    if (!entry) return;
    document.getElementById("note-pop-title").textContent =
      "Notes · #" + entry.id + (entry.date ? " · " + entry.date : "");
    const popText = document.getElementById("note-pop-text");
    popText.innerHTML =
      (infoText(entry) ? '<span class="note-info">' + escapeText(infoText(entry)) + "</span>" : "") +
      (entry.notes ? '<span class="note-own">' + escapeText(entry.notes) + "</span>" : "");
    notePop.hidden = false;
    const at = button.getBoundingClientRect();
    const box = notePop.getBoundingClientRect();
    let left = Math.min(at.left, window.innerWidth - box.width - 12);
    let top = at.bottom + 6;
    if (top + box.height > window.innerHeight - 12) top = Math.max(12, at.top - box.height - 6);
    notePop.style.left = Math.max(12, left) + "px";
    notePop.style.top = top + "px";
    document.getElementById("note-pop-close").focus();
  }
  if (notePop) {
    document.getElementById("note-pop-close").addEventListener("click", closeNotePop);
    document.addEventListener("click", function (event) {
      if (!notePop.hidden && !notePop.contains(event.target) && !event.target.closest("[data-note]")) closeNotePop();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeNotePop();
    });
    const scroller = document.querySelector("#view-log .table-wrap");
    if (scroller) scroller.addEventListener("scroll", closeNotePop, { passive: true });
  }

  function setNotesMode(mode) {
    if (NOTES_MODES.indexOf(mode) === -1) return;
    notesMode = mode;
    try {
      localStorage.setItem("rr-log-notes-mode", mode);
    } catch (e) {}
    applyNotesMode();
    renderLog();
  }
  function applyNotesMode() {
    const view = document.getElementById("view-log");
    if (view) view.classList.toggle("notes-full", notesMode === "full");
    const select = document.getElementById("log-notes-mode");
    if (select) select.value = notesMode;
  }
  applyNotesMode();
  const notesModeSelect = document.getElementById("log-notes-mode");
  if (notesModeSelect) {
    notesModeSelect.addEventListener("change", function () {
      setNotesMode(notesModeSelect.value);
    });
  }

  const LOG_COL_KEYS = LOG_COLS.map(function (col) {
    return col.key;
  });
  let hiddenLogCols = {};
  try {
    const savedCols = JSON.parse(localStorage.getItem("rr-log-hidden-cols") || "[]");
    if (Array.isArray(savedCols)) {
      savedCols.forEach(function (key) {
        if (LOG_COL_KEYS.indexOf(key) !== -1) hiddenLogCols[key] = true;
      });
    }
  } catch (e) {}

  function saveHiddenLogCols() {
    const keys = LOG_COL_KEYS.filter(function (key) {
      return hiddenLogCols[key];
    });
    try {
      localStorage.setItem("rr-log-hidden-cols", JSON.stringify(keys));
    } catch (e) {}
  }

  function visibleLogColCount() {
    return (
      2 +
      LOG_COLS.filter(function (col) {
        return !hiddenLogCols[col.key];
      }).length
    );
  }

  function applyLogColumns() {
    const table = document.querySelector("#view-log .log-table");
    if (!table) return;
    table.querySelectorAll("[data-col]").forEach(function (el) {
      const key = el.getAttribute("data-col");
      el.hidden = Boolean(key && hiddenLogCols[key]);
    });
    const menu = document.getElementById("log-col-menu");
    if (menu) {
      Array.prototype.forEach.call(menu.querySelectorAll("input[data-col]"), function (input) {
        input.checked = !hiddenLogCols[input.getAttribute("data-col")];
      });
    }
    fitLogText();
  }

  const LOG_FONT_MIN = 11;
  const LOG_TEXT_SIZES = { small: 12, medium: 13.5, large: 15, fit: 18 };
  const LOG_LAYOUTS = ["auto", "table", "cards"];
  let logFitWidth = 0;
  let logLayout = "auto";
  let logTextSize = "medium";
  try {
    const savedLayout = localStorage.getItem("rr-log-layout");
    if (LOG_LAYOUTS.indexOf(savedLayout) !== -1) logLayout = savedLayout;
    const savedText = localStorage.getItem("rr-log-text-size");
    if (LOG_TEXT_SIZES[savedText]) logTextSize = savedText;
  } catch (e) {}

  function fitLogText() {
    const view = document.getElementById("view-log");
    const wrap = document.querySelector("#view-log .table-wrap");
    const table = wrap && wrap.querySelector(".log-table");
    if (document.documentElement.classList.contains("is-field")) {
      view.classList.add("log-cards");
      return;
    }
    const room = wrap ? wrap.clientWidth : 0;
    if (!table || !room) return;
    logFitWidth = room;
    view.classList.remove("log-cards");
    if (getComputedStyle(table).display !== "table") return;
    function widthAt(px) {
      table.style.setProperty("--log-font", px + "px");
      return table.offsetWidth;
    }
    table.style.width = "min-content";
    const fontMax = LOG_TEXT_SIZES[logTextSize];
    const lowWidth = widthAt(LOG_FONT_MIN);
    const highWidth = widthAt(fontMax);
    let size = fontMax;
    if (highWidth > room) {
      const perPx = (highWidth - lowWidth) / (fontMax - LOG_FONT_MIN) || 1;
      size = Math.floor((LOG_FONT_MIN + (room - lowWidth) / perPx) * 4) / 4;
      size = Math.max(LOG_FONT_MIN, Math.min(fontMax, size));
      while (size > LOG_FONT_MIN && widthAt(size) > room) size -= 0.25;
    }
    table.style.setProperty("--log-font", size + "px");
    table.style.width = "";
    view.classList.toggle("log-cards", logLayout === "cards" || (logLayout === "auto" && lowWidth > room));
  }

  const logLayoutSelect = document.getElementById("log-layout");
  if (logLayoutSelect) {
    logLayoutSelect.value = logLayout;
    logLayoutSelect.addEventListener("change", function () {
      if (LOG_LAYOUTS.indexOf(logLayoutSelect.value) === -1) return;
      logLayout = logLayoutSelect.value;
      try {
        localStorage.setItem("rr-log-layout", logLayout);
      } catch (e) {}
      fitLogText();
    });
  }

  const logTextSelect = document.getElementById("log-text-size");
  if (logTextSelect) {
    logTextSelect.value = logTextSize;
    logTextSelect.addEventListener("change", function () {
      if (!LOG_TEXT_SIZES[logTextSelect.value]) return;
      logTextSize = logTextSelect.value;
      try {
        localStorage.setItem("rr-log-text-size", logTextSize);
      } catch (e) {}
      fitLogText();
    });
  }

  if (window.ResizeObserver) {
    const logWrap = document.querySelector("#view-log .table-wrap");
    if (logWrap) {
      new ResizeObserver(function () {
        if (logWrap.clientWidth && logWrap.clientWidth !== logFitWidth) {
          window.requestAnimationFrame(fitLogText);
        }
      }).observe(logWrap);
    }
  }

  function setLogColHidden(key, hide) {
    if (LOG_COL_KEYS.indexOf(key) === -1) return;
    if (hide) {
      const remaining = LOG_COLS.filter(function (col) {
        return col.key !== key && !hiddenLogCols[col.key];
      }).length;
      if (!remaining) return;
      hiddenLogCols[key] = true;
    } else {
      delete hiddenLogCols[key];
    }
    saveHiddenLogCols();
    applyLogColumns();
    const empty = document.querySelector("#log-body td.muted");
    if (empty && empty.parentNode && empty.parentNode.children.length === 1) {
      empty.colSpan = visibleLogColCount();
    }
    document.querySelectorAll("#log-body tr.trip-head td").forEach(function (cell) {
      cell.colSpan = visibleLogColCount();
    });
  }

  const LOG_GROUP_KEY = "rr-log-group";
  const LOG_GROUP_MODES = ["trip-day", "trip", "day", "month", "location", "none"];
  let logGroupMode = (function () {
    try {
      const saved = localStorage.getItem(LOG_GROUP_KEY);
      return LOG_GROUP_MODES.indexOf(saved) !== -1 ? saved : "trip-day";
    } catch (err) {
      return "trip-day";
    }
  })();
  const groupOpenChoice = {};
  let newestGroups = {};
  let logGroupEntries = {};

  function entryStamp(entry) {
    return (entry.date || "") + " " + (entry.time || "") + " " + String(entry.id || 0).padStart(9, "0");
  }

  function dayLabel(date) {
    const when = new Date(date + "T12:00:00");
    if (!date || isNaN(when.getTime())) return date || "No date";
    return when.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }

  function monthLabel(month) {
    const when = new Date(month + "-15T12:00:00");
    if (!month || isNaN(when.getTime())) return month || "No date";
    return when.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  function groupLevels(entry) {
    const trip = (entry.trip_name || "").trim();
    const date = entry.date || "";
    const day = { key: "d:" + date, kind: "day", name: dayLabel(date) };
    if (logGroupMode === "trip") return trip ? [{ key: "t:" + trip, kind: "trip", name: trip }] : [];
    if (logGroupMode === "day") return [day];
    if (logGroupMode === "trip-day") {
      if (!trip) return [day];
      return [
        { key: "t:" + trip, kind: "trip", name: trip },
        { key: "t:" + trip + "|" + day.key, kind: "day", name: day.name },
      ];
    }
    if (logGroupMode === "month") {
      const month = date.slice(0, 7);
      return [{ key: "m:" + month, kind: "month", name: monthLabel(month) }];
    }
    if (logGroupMode === "location") {
      const spot = (entry.location_spot || "").trim();
      return [{ key: "l:" + spot, kind: "location", name: spot || "No location" }];
    }
    return [];
  }

  function buildLogTree(rows) {
    const top = [];
    const nodes = {};
    rows.forEach(function (entry) {
      let list = top;
      groupLevels(entry).forEach(function (level, depth) {
        let node = nodes[level.key];
        if (!node) {
          node = { key: level.key, kind: level.kind, name: level.name, depth: depth, entries: [], items: [] };
          nodes[level.key] = node;
          list.push({ node: node });
        }
        node.entries.push(entry);
        list = node.items;
      });
      list.push({ entry: entry });
    });
    return top;
  }

  function findNewestGroups(entries) {
    let newest = null;
    entries.forEach(function (entry) {
      if (!newest || entryStamp(entry) > entryStamp(newest)) newest = entry;
    });
    const keys = {};
    if (newest) {
      groupLevels(newest).forEach(function (level) {
        keys[level.key] = true;
      });
    }
    return keys;
  }

  function isGroupOpen(key) {
    return Object.prototype.hasOwnProperty.call(groupOpenChoice, key) ? groupOpenChoice[key] : !!newestGroups[key];
  }

  function groupSummary(group, kind) {
    const days = {};
    const roads = {};
    let photos = 0;
    group.forEach(function (entry) {
      if (entry.date) days[entry.date] = true;
      const rr = (entry.railroad || "").trim();
      if (rr) roads[rr] = (roads[rr] || 0) + 1;
      if (entry.photographed) photos += 1;
    });
    const dayCount = Object.keys(days).length;
    const parts = [group.length + " train" + (group.length === 1 ? "" : "s")];
    if (dayCount && kind !== "day") parts.push(dayCount + " day" + (dayCount === 1 ? "" : "s"));
    const top = Object.keys(roads)
      .sort(function (a, b) {
        return roads[b] - roads[a] || a.localeCompare(b);
      })
      .slice(0, 3)
      .map(function (rr) {
        return rr + " " + roads[rr];
      });
    if (top.length) parts.push(top.join(", "));
    if (photos) parts.push(photos + " photo" + (photos === 1 ? "" : "s"));
    return parts.join(" · ");
  }

  function applyGroupVisibility() {
    document.querySelectorAll("#log-body tr[data-group]").forEach(function (row) {
      const topOpen = isGroupOpen(row.dataset.group);
      const sub = row.dataset.sub || "";
      const head = row.dataset.head;
      if (head) {
        const open = isGroupOpen(head);
        row.classList.toggle("is-closed", !open);
        const btn = row.querySelector(".trip-toggle");
        if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
        row.hidden = head !== row.dataset.group && !topOpen;
      } else {
        row.hidden = !topOpen || (!!sub && !isGroupOpen(sub));
      }
    });
    syncExpandAll();
  }

  const expandAllBtn = document.getElementById("log-expand-all");

  function syncExpandAll() {
    if (!expandAllBtn) return;
    const heads = document.querySelectorAll("#log-body tr[data-head]");
    expandAllBtn.hidden = heads.length === 0;
    const anyClosed = Array.prototype.some.call(heads, function (head) {
      return !isGroupOpen(head.dataset.head);
    });
    expandAllBtn.textContent = anyClosed ? "Expand All" : "Collapse All";
    expandAllBtn.setAttribute("aria-pressed", anyClosed ? "false" : "true");
  }

  if (expandAllBtn) {
    expandAllBtn.addEventListener("click", function () {
      const heads = document.querySelectorAll("#log-body tr[data-head]");
      const open = Array.prototype.some.call(heads, function (head) {
        return !isGroupOpen(head.dataset.head);
      });
      heads.forEach(function (head) {
        groupOpenChoice[head.dataset.head] = open;
      });
      applyGroupVisibility();
    });
  }

  function toggleGroup(key, all) {
    const open = !isGroupOpen(key);
    if (all) {
      const row = document.querySelector('#log-body tr[data-head="' + CSS.escape(key) + '"]');
      const sub = !!(row && row.classList.contains("is-sub"));
      document.querySelectorAll("#log-body tr[data-head]").forEach(function (head) {
        if (head.classList.contains("is-sub") === sub) groupOpenChoice[head.dataset.head] = open;
      });
    } else {
      groupOpenChoice[key] = open;
    }
    applyGroupVisibility();
  }

  function groupHeadRow(node, parents) {
    const sub = node.depth > 0;
    let parts = [];
    if (node.kind === "trip") {
      const first = node.entries[0] || {};
      let from = first.trip_date_from || "";
      let to = first.trip_date_to || "";
      if (!from || !to) {
        const dates = node.entries
          .map(function (entry) {
            return entry.date;
          })
          .filter(Boolean)
          .sort();
        if (dates.length) {
          from = from || dates[0];
          to = to || dates[dates.length - 1];
        }
      }
      if (from && to && from > to) {
        const swap = from;
        from = to;
        to = swap;
      }
      if (from) parts.push('<span class="trip-head-part"><i>Start</i>' + escapeText(from) + "</span>");
      if (to) parts.push('<span class="trip-head-part"><i>End</i>' + escapeText(to) + "</span>");
      const details = tripDetailsOf(node.name);
      if (details) {
        const driven = milesDriven(details);
        if (driven !== null) parts.push('<span class="trip-head-part"><i>Miles</i>' + escapeText(driven.toLocaleString()) + "</span>");
        const fuel = fuelText(fuelRows(details), driven, true);
        if (fuel) parts.push('<span class="trip-head-part"><i>Fuel</i>' + escapeText(fuel) + "</span>");
        if (details.vehicle) parts.push('<span class="trip-head-part"><i>Vehicle</i>' + escapeText(details.vehicle) + "</span>");
        if (details.attendees) parts.push('<span class="trip-head-part"><i>With</i>' + escapeText(details.attendees) + "</span>");
        if (details.notes) {
          parts.push('<span class="trip-head-part trip-head-notes" title="' + escapeText(details.notes) + '"><i>Notes</i>' + escapeText(details.notes.split("\n")[0].slice(0, 60)) + (details.notes.length > 60 || details.notes.indexOf("\n") !== -1 ? "…" : "") + "</span>");
        }
      }
      parts.push('<button type="button" class="trip-head-details" data-trip-details="' + escapeText(node.name) + '" title="Mileage, fuel, notes, and who came along">Details…</button>');
    }
    logGroupEntries[node.key] = node.entries.map(function (entry) {
      return String(entry.id);
    });
    const open = isGroupOpen(node.key);
    const hidden = sub && !isGroupOpen(parents[0]);
    return (
      '<tr class="trip-head' +
      (sub ? " is-sub" : "") +
      (open ? "" : " is-closed") +
      '" data-kind="' +
      node.kind +
      '" data-group="' +
      escapeText(sub ? parents[0] : node.key) +
      '"' +
      (sub ? ' data-sub="' + escapeText(node.key) + '"' : "") +
      ' data-head="' +
      escapeText(node.key) +
      '"' +
      (hidden ? " hidden" : "") +
      '><td colspan="' +
      visibleLogColCount() +
      '"><input type="checkbox" class="group-select" data-group-select="' +
      escapeText(node.key) +
      '" aria-label="Select every train in ' +
      escapeText(node.name) +
      '" title="Select every train in this folder" />' +
      '<button type="button" class="trip-toggle" aria-expanded="' +
      (open ? "true" : "false") +
      '" title="Show or hide these trains. Option-click opens or closes every folder at this level.">' +
      '<span class="trip-caret" aria-hidden="true"></span><span class="trip-head-name">' +
      escapeText(node.name) +
      "</span></button>" +
      (parts.length ? '<span class="trip-head-dates">' + parts.join("") + "</span>" : "") +
      '<span class="trip-head-summary">' +
      escapeText(groupSummary(node.entries, node.kind)) +
      "</span>" +
      "</td></tr>"
    );
  }

  function renderLogTree(items, html, changes, parents) {
    items.forEach(function (item) {
      if (item.entry) {
        html.push(logDataRow(item.entry, parents, changes));
        return;
      }
      html.push(groupHeadRow(item.node, parents));
      renderLogTree(item.node.items, html, changes, parents.concat(item.node.key));
    });
  }

  function syncGroupSelects() {
    document.querySelectorAll("#log-body input[data-group-select]").forEach(function (box) {
      const ids = logGroupEntries[box.getAttribute("data-group-select")] || [];
      const picked = ids.filter(function (id) {
        return logSelected[id];
      }).length;
      box.checked = picked > 0 && picked === ids.length;
      box.indeterminate = picked > 0 && picked < ids.length;
    });
  }

  const groupBySelect = document.getElementById("log-group-by");
  if (groupBySelect) {
    groupBySelect.value = logGroupMode;
    groupBySelect.addEventListener("change", function () {
      logGroupMode = LOG_GROUP_MODES.indexOf(groupBySelect.value) !== -1 ? groupBySelect.value : "trip-day";
      try {
        localStorage.setItem(LOG_GROUP_KEY, logGroupMode);
      } catch (err) {
        /* Private browsing: the choice lasts until the page reloads. */
      }
      renderLog();
    });
  }

  function logDataRow(entry, parents, changes) {
    const media = mediaCellHtml(entry, "/");
    return (
      '<tr data-id="' +
      entry.id +
      '"' +
      (parents.length
        ? ' class="trip-row" data-group="' +
          escapeText(parents[0]) +
          '"' +
          (parents[1] ? ' data-sub="' + escapeText(parents[1]) + '"' : "") +
          (isGroupOpen(parents[0]) && (!parents[1] || isGroupOpen(parents[1])) ? "" : " hidden")
        : "") +
      ">" +
      '<td class="log-select"><input type="checkbox" data-select="' +
      entry.id +
      '"' +
      (logSelected[entry.id] ? " checked" : "") +
      ' aria-label="Select sighting ' +
      entry.id +
      '" /><span class="entry-id" title="' + ENTRY_ID_TITLE + '">#' +
      entry.id +
      "</span></td>" +
      '<td data-col="date">' +
      escapeText(entry.date) +
      '</td><td data-col="time">' +
      timeCellHtml(entry.time, entry, {}) +
      '</td><td data-col="time_zone">' +
      zoneCellHtml(entry) +
      '</td><td data-col="railroad">' +
      escapeText(entry.railroad) +
      '</td><td data-col="lead_locomotive">' +
      leadCellHtml(entry) +
      '</td><td data-col="train_symbol"' +
      (entry.symbol_info ? ' title="' + escapeText(entry.symbol_info) + '"' : "") +
      ">" +
      escapeText(entry.train_symbol || "") +
      '</td><td data-col="direction">' +
      dirCellHtml(entry) +
      '</td><td data-col="power_consist">' +
      escapeText(entry.power_consist) +
      '</td><td data-col="train_types">' +
      typeCellHtml(entry) +
      '</td><td data-col="load_status">' +
      logLoadCell(entry) +
      '</td><td data-col="cars">' +
      escapeText(entry.car_counts) +
      '</td><td data-col="location">' +
      escapeText(entry.location_spot || "") +
      '</td><td data-col="location_state">' +
      escapeText(entry.location_state || "") +
      '</td><td data-col="location_subdivision">' +
      subCellHtml(entry.location_subdivision || "", entry.railroad) +
      '</td><td data-col="notes" class="notes">' +
      notesCellHtml(entry) +
      '</td><td data-col="media">' +
      media +
      '</td><td data-col="actions" class="log-actions"><button type="button" class="btn tiny ghost icon-btn" data-edit="' +
      entry.id +
      '" title="Edit" aria-label="Edit entry #' +
      entry.id +
      '">' +
      ICON_PENCIL +
      '</button><button type="button" class="btn tiny ghost icon-btn is-danger" data-del="' +
      entry.id +
      '" title="Delete" aria-label="Delete entry #' +
      entry.id +
      '">' +
      ICON_TRASH +
      "</button></td></tr>"
    );
  }

  function syncLogSelection() {
    const shown = {};
    logEntries.forEach(function (entry) {
      shown[entry.id] = true;
    });
    Object.keys(logSelected).forEach(function (id) {
      if (!shown[id]) delete logSelected[id];
    });
    const count = Object.keys(logSelected).length;
    const button = document.getElementById("btn-log-tz");
    if (button) {
      button.disabled = count === 0;
      button.textContent = count ? "Change Selected (" + count + ")…" : "Change Selected…";
    }
    const delButton = document.getElementById("btn-log-delete");
    if (delButton) {
      delButton.disabled = count === 0;
      delButton.textContent = count ? "Delete Selected (" + count + ")…" : "Delete Selected…";
    }
    const all = document.getElementById("log-select-all");
    if (all) {
      all.checked = count > 0 && count === logEntries.length;
      all.indeterminate = count > 0 && count < logEntries.length;
    }
    syncGroupSelects();
  }

  function renderLog() {
    const rows = sortedLogEntries();
    const changes = zoneChanges(logEntries);
    document.getElementById("log-count").textContent = logEntries.length + " entries";
    renderLogStats();
    const body = document.getElementById("log-body");
    syncLogSortHeaders();
    syncLogSelection();
    if (!rows.length) {
      body.innerHTML =
        '<tr><td colspan="' + visibleLogColCount() + '" class="muted">No entries match.</td></tr>';
      applyLogColumns();
      syncExpandAll();
      return;
    }
    newestGroups = findNewestGroups(logEntries);
    logGroupEntries = {};
    const html = [];
    renderLogTree(buildLogTree(rows), html, changes, []);
    body.innerHTML = html.join("");
    syncGroupSelects();
    applyLogColumns();
    syncExpandAll();
  }

  async function loadLog() {
    await fillFilterTrips();
    const result = await api("/api/entries" + filterQuery());
    logEntries = result.data || [];
    try {
      await ensureSubs();
    } catch (err) {
      /* Sub railroad tags are optional; the Log still renders without them. */
    }
    renderLog();
  }

  document.querySelector("#view-log .log-table thead").addEventListener("click", function (event) {
    const th = event.target.closest("th[data-sort]");
    if (!th) return;
    const key = th.getAttribute("data-sort");
    if (logSortKey === key) {
      logSortDir *= -1;
    } else {
      logSortKey = key;
      logSortDir = 1;
    }
    renderLog();
  });

  document.getElementById("log-body").addEventListener("click", async function (event) {
    if (event.target.closest(".group-select")) return;
    const detailsBtn = event.target.closest("[data-trip-details]");
    if (detailsBtn) {
      openTripDetails(detailsBtn.getAttribute("data-trip-details"));
      return;
    }
    const groupHead = event.target.closest("tr.trip-head[data-head]");
    if (groupHead) {
      toggleGroup(groupHead.dataset.head, event.altKey);
      return;
    }
    const card = document.getElementById("view-log").classList.contains("log-cards") && event.target.closest("tr[data-id]");
    if (card && !event.target.closest("[data-edit], [data-del], .log-select")) {
      openTrainCard(card.getAttribute("data-id"));
      return;
    }
    const noteBtn = event.target.closest("[data-note]");
    if (noteBtn) {
      openNotePop(noteBtn);
      return;
    }
    const editBtn = event.target.closest("[data-edit]");
    const delBtn = event.target.closest("[data-del]");
    const editId = editBtn && editBtn.getAttribute("data-edit");
    const delId = delBtn && delBtn.getAttribute("data-del");
    if (editId) {
      await openEditDialog(editId);
    }
    if (delId) await deleteLogEntry(delId);
  });

  async function deleteLogEntry(delId) {
    const doomed = logEntries.find(function (item) {
      return String(item.id) === String(delId);
    }) || {};
    const sure = await window.askConfirm({
      title: "Delete Train #" + delId + "?",
      message: "This train comes out of the log. Activity keeps a copy, but the train cannot be put back.",
      details: [
        ["Date", [doomed.date, doomed.time].filter(Boolean).join(" ")],
        ["Railroad", doomed.railroad],
        ["Lead", doomed.lead_locomotive],
        ["Symbol", doomed.train_symbol],
        ["Train #", doomed.train_number],
        ["Location", doomed.location_spot],
      ],
      ok: "Delete Train",
    });
    if (!sure) return;
    await api("/api/entries/" + delId, { method: "DELETE" });
    loadLog();
    if (dateEl && dateEl.value) loadDayLog();
    refreshPendingBadge();
  }

  const TRAIN_CARD_LABELS = {
    date: "Date",
    time: "Time",
    time_zone: "Zone",
    railroad: "Railroad",
    lead_locomotive: "Lead",
    train_symbol: "Symbol",
    direction: "Direction",
    power_consist: "Consist",
    train_types: "Type",
    load_status: "Loads/Empties",
    cars: "Cars",
    location: "Location",
    location_state: "State",
    location_subdivision: "Subdivision",
    notes: "Notes",
    media: "Media",
  };
  const trainCardDialog = document.getElementById("train-card-dialog");
  let trainCardId = null;

  function findTrainCardEntry(id) {
    const match = function (item) {
      return String(item.id) === String(id);
    };
    return (logEntries || []).find(match) || (dayEntries || []).find(match) || null;
  }

  function openTrainCard(id) {
    const entry = findTrainCardEntry(id);
    if (!trainCardDialog || !entry) return;
    trainCardId = id;
    document.getElementById("train-card-title").innerHTML =
      "Train " + '<span class="entry-id" title="' + ENTRY_ID_TITLE + '">#' + escapeText(String(id)) + "</span>";
    const parts = [];
    function add(key, html) {
      const label = TRAIN_CARD_LABELS[key];
      if (!label || !String(html || "").trim()) return;
      parts.push("<dt>" + label + "</dt><dd" + (key === "notes" ? ' class="train-card-notes"' : "") + ">" + html + "</dd>");
    }
    const row = document.querySelector('#log-body tr[data-id="' + id + '"]');
    if (row) {
      row.querySelectorAll("td[data-col]").forEach(function (td) {
        const key = td.getAttribute("data-col");
        let html = key === "notes" ? notesHtml(entry) : td.innerHTML;
        if (key === "media") {
          const kinds = [];
          if (entry.photographed) kinds.push("Photo");
          if (entry.videoed) kinds.push("Video");
          if (entry.night) kinds.push("Night");
          html = kinds.join(", ");
        }
        add(key, html);
      });
    } else {
      const zone = entry.time_zone || entry.timezone || "";
      add("date", escapeText(entry.date || ""));
      add("time", escapeText(formatPadTime(entry.time) || entry.time || ""));
      add("time_zone", escapeText(zone));
      add("railroad", escapeText(entry.railroad || ""));
      add("lead_locomotive", leadCellHtml(entry));
      add("train_symbol", escapeText(entry.train_symbol || ""));
      add("direction", dirCellHtml(entry));
      add("power_consist", escapeText(entry.power_consist || ""));
      add("train_types", typeCellHtml(entry));
      add("load_status", escapeText(loadDisplay(entry)));
      add("cars", escapeText(entry.car_counts || ""));
      add("location", escapeText(entry.location_spot || ""));
      add("location_state", escapeText(entry.location_state || ""));
      add("location_subdivision", escapeText(entry.location_subdivision || ""));
      add("notes", notesHtml(entry));
      const kinds = [];
      if (entry.photographed) kinds.push("Photo");
      if (entry.videoed) kinds.push("Video");
      if (entry.night) kinds.push("Night");
      add("media", kinds.join(", "));
    }
    document.getElementById("train-card-body").innerHTML = parts.join("");
    trainCardDialog.returnValue = "";
    trainCardDialog.showModal();
  }

  if (trainCardDialog) {
    trainCardDialog.addEventListener("close", function () {
      const id = trainCardId;
      trainCardId = null;
      if (!id) return;
      if (trainCardDialog.returnValue === "edit") openEditDialog(id);
      if (trainCardDialog.returnValue === "delete") deleteLogEntry(id);
    });
  }

  document.getElementById("log-body").addEventListener("change", function (event) {
    const groupKey = event.target.getAttribute("data-group-select");
    if (groupKey) {
      const on = event.target.checked;
      (logGroupEntries[groupKey] || []).forEach(function (entryId) {
        if (on) logSelected[entryId] = true;
        else delete logSelected[entryId];
        const box = document.querySelector('#log-body input[data-select="' + entryId + '"]');
        if (box) box.checked = on;
      });
      syncLogSelection();
      return;
    }
    const id = event.target.getAttribute("data-select");
    if (!id) return;
    if (event.target.checked) logSelected[id] = true;
    else delete logSelected[id];
    syncLogSelection();
  });

  document.getElementById("log-select-all").addEventListener("change", function (event) {
    logSelected = {};
    if (event.target.checked) {
      logEntries.forEach(function (entry) {
        logSelected[entry.id] = true;
      });
    }
    renderLog();
  });

  document.getElementById("btn-log-delete").addEventListener("click", async function () {
    const picked = logEntries.filter(function (entry) {
      return logSelected[entry.id];
    });
    if (!picked.length) return;
    const dates = picked
      .map(function (entry) {
        return entry.date;
      })
      .filter(Boolean)
      .sort();
    const trips = [];
    picked.forEach(function (entry) {
      if (entry.trip_name && trips.indexOf(entry.trip_name) < 0) trips.push(entry.trip_name);
    });
    const n = picked.length;
    const sure = await window.askConfirm({
      title: "Delete " + n + " Selected Train" + (n === 1 ? "" : "s") + "?",
      message:
        "Only the ticked trains come out of the log. Everything else stays. Activity keeps a copy, but the trains cannot be put back.",
      details: [
        ["Trains", String(n)],
        ["Dates", dates.length ? (dates[0] === dates[dates.length - 1] ? dates[0] : dates[0] + " to " + dates[dates.length - 1]) : ""],
        ["Trips", trips.join(", ")],
      ],
      ok: "Delete " + n + " Train" + (n === 1 ? "" : "s"),
    });
    if (!sure) return;
    const result = await api("/api/entries/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: picked.map(function (entry) {
          return entry.id;
        }),
      }),
    });
    if (!result.ok) {
      showBanner((result.data && result.data.error) || "Could not delete those trains.", "error");
      return;
    }
    logSelected = {};
    showBanner((result.data && result.data.message) || "Deleted.", "ok");
    loadLog();
    refreshPendingBadge();
    document.dispatchEvent(new CustomEvent("trainlog:entries-changed"));
  });

  const LEAVE = "__leave__";
  const TRIP_NONE = "__none__";
  const TRIP_NEW = "__new__";
  const bulkTrip = document.getElementById("bulk-trip");
  const bulkTripName = document.getElementById("bulk-trip-name");
  let bulkTrips = [];
  let bulkDays = [];

  function bulkTripValue() {
    if (bulkTrip.value === LEAVE) return null;
    if (bulkTrip.value === TRIP_NONE) return "";
    if (bulkTrip.value === TRIP_NEW) return bulkTripName.value.trim();
    return bulkTrip.value;
  }

  function syncBulkTrip() {
    const isNew = bulkTrip.value === TRIP_NEW;
    document.getElementById("bulk-trip-new-row").hidden = !isNew;
    const note = document.getElementById("bulk-trip-note");
    const name = bulkTripValue();
    let text = "";
    if (name === "") {
      text = "Takes these sightings out of their trip. The sightings stay in the log.";
    } else if (name) {
      const match = bulkTrips.filter(function (trip) {
        return tripNameOf(trip).toLowerCase() === name.toLowerCase();
      })[0];
      const dates = bulkDays.slice();
      if (match) {
        [match.trip_date_from, match.trip_date_to, match.latest].forEach(function (value) {
          if (value) dates.push(value);
        });
      }
      dates.sort();
      if (dates.length) {
        text =
          (match && isNew ? "Joins the trip " + tripNameOf(match) + ". " : "") +
          "Trip dates: " + dates[0] + " to " + dates[dates.length - 1] +
          (match ? ", stretched to cover the selected days." : ", from the selected days.");
      }
    }
    note.textContent = text;
    note.hidden = !text;
  }

  function syncBulkSave() {
    const tripName = bulkTripValue();
    const any =
      (tripName !== null && (tripName !== "" || bulkTrip.value === TRIP_NONE)) ||
      ["bulk-sub", "bulk-state", "tz-dialog-zone"].some(function (id) {
        return document.getElementById(id).value !== LEAVE;
      });
    const newMissing = bulkTrip.value === TRIP_NEW && !bulkTripName.value.trim();
    document.getElementById("bulk-save").disabled = !any || newMissing;
  }

  document.getElementById("btn-log-tz").addEventListener("click", async function () {
    const ids = Object.keys(logSelected);
    if (!ids.length) return;
    const picked = logEntries.filter(function (entry) {
      return logSelected[entry.id];
    });
    const first = picked[0];
    document.getElementById("tz-dialog-count").textContent =
      ids.length + " sighting" + (ids.length === 1 ? "" : "s") + " selected.";
    try {
      await ensureSubs();
    } catch (err) {
      /* The subdivision list can be empty; state and zone still work. */
    }
    const rrs = [];
    picked.forEach(function (entry) {
      if (entry.railroad && rrs.indexOf(entry.railroad) < 0) rrs.push(entry.railroad);
    });
    const leave = '<option value="' + LEAVE + '" selected>Leave as Is</option>';
    bulkDays = [];
    picked.forEach(function (entry) {
      if (entry.date && bulkDays.indexOf(entry.date) < 0) bulkDays.push(entry.date);
    });
    try {
      const tripResult = await api("/api/trips");
      bulkTrips = (tripResult.data && tripResult.data.trips) || [];
    } catch (err) {
      bulkTrips = [];
    }
    bulkTrip.innerHTML =
      leave +
      '<option value="' + TRIP_NEW + '">New Trip…</option>' +
      '<option value="' + TRIP_NONE + '">No Trip</option>' +
      (bulkTrips.length
        ? '<optgroup label="Your Trips">' +
          bulkTrips
            .map(function (trip) {
              const name = tripNameOf(trip);
              return '<option value="' + escapeText(name) + '">' + escapeText(name) + "</option>";
            })
            .join("") +
          "</optgroup>"
        : "");
    bulkTrip.value = LEAVE;
    bulkTripName.value = "";
    syncBulkTrip();
    document.getElementById("bulk-sub").innerHTML =
      leave + '<option value="">No Subdivision</option>' + subGroupsHtml(rrs);
    document.getElementById("bulk-state").innerHTML =
      leave +
      '<option value="">No State</option>' +
      STATE_CODES.map(function (code) {
        return '<option value="' + escapeText(code) + '">' + escapeText(code) + "</option>";
      }).join("");
    const zone = document.getElementById("tz-dialog-zone");
    zone.innerHTML =
      leave +
      '<option value="__state__">Match each sighting\'s state</option>' +
      zoneOptionsHtml("", first && first.date);
    zone.value = LEAVE;
    syncBulkSave();
    document.getElementById("tz-dialog").showModal();
  });

  ["bulk-sub", "bulk-state", "tz-dialog-zone"].forEach(function (id) {
    document.getElementById(id).addEventListener("change", syncBulkSave);
  });
  bulkTrip.addEventListener("change", function () {
    syncBulkTrip();
    syncBulkSave();
    if (bulkTrip.value === TRIP_NEW) bulkTripName.focus();
  });
  bulkTripName.addEventListener("input", function () {
    syncBulkTrip();
    syncBulkSave();
  });
  bulkTripName.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (!document.getElementById("bulk-save").disabled) document.getElementById("tz-dialog").close("save");
  });

  document.getElementById("tz-dialog").addEventListener("close", async function () {
    if (this.returnValue !== "save") return;
    const ids = Object.keys(logSelected).map(Number);
    if (!ids.length) return;
    const body = { ids: ids };
    const tripName = bulkTripValue();
    if (tripName !== null && (tripName !== "" || bulkTrip.value === TRIP_NONE)) body.trip_name = tripName;
    const sub = document.getElementById("bulk-sub").value;
    const state = document.getElementById("bulk-state").value;
    const zone = document.getElementById("tz-dialog-zone").value;
    if (sub !== LEAVE) body.subdivision = sub;
    if (state !== LEAVE) body.state = state;
    if (zone === "__state__") body.zone_from_state = true;
    else if (zone !== LEAVE) body.time_zone = zone;
    if (Object.keys(body).length === 1) return;
    const result = await api("/api/entries/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!result.ok) {
      showBanner((result.data && result.data.error) || "Could not change those sightings.", "error");
      return;
    }
    showBanner((result.data && result.data.message) || "Sightings updated.", "ok");
    logSelected = {};
    await loadLog();
    if (dateEl.value) loadDayLog();
    if ("trip_name" in body) refreshTripNames();
  });

  function refreshFilterMoreBadge() {
    const more = document.getElementById("filters-more");
    const btn = document.getElementById("btn-filter-more");
    if (!more || !btn) return;
    let active = 0;
    more.querySelectorAll("input, select").forEach(function (el) {
      if ((el.value || "").trim()) active += 1;
    });
    const open = !more.hidden;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.classList.toggle("has-active", active > 0);
    const label = open ? "Less" : "More";
    btn.textContent = active ? label + " · " + active : label;
  }

  function setFiltersMoreOpen(open) {
    const more = document.getElementById("filters-more");
    if (!more) return;
    more.hidden = !open;
    try {
      sessionStorage.setItem("logFiltersMore", open ? "1" : "0");
    } catch (err) {}
    refreshFilterMoreBadge();
  }

  (function initFiltersMore() {
    const more = document.getElementById("filters-more");
    const btn = document.getElementById("btn-filter-more");
    const form = document.getElementById("filter-form");
    if (!more || !btn || !form) return;
    let preferOpen = false;
    try {
      preferOpen = sessionStorage.getItem("logFiltersMore") === "1";
    } catch (err) {}
    more.querySelectorAll("input, select").forEach(function (el) {
      if ((el.value || "").trim()) preferOpen = true;
    });
    setFiltersMoreOpen(preferOpen);
    btn.addEventListener("click", function () {
      setFiltersMoreOpen(more.hidden);
    });
    form.addEventListener("input", refreshFilterMoreBadge);
    form.addEventListener("change", refreshFilterMoreBadge);
  })();

  document.getElementById("filter-form").addEventListener("submit", function (event) {
    event.preventDefault();
    loadLog();
  });
  document.getElementById("btn-filter-reset").addEventListener("click", function () {
    document.getElementById("filter-form").reset();
    setLogIds(null);
    refreshFilterMoreBadge();
    loadLog();
  });
  document.getElementById("log-ids-clear").addEventListener("click", function () {
    setLogIds(null);
    loadLog();
  });

  const footScreen = document.getElementById("foot-screen");
  if (footScreen) {
    const kicker = document.querySelector(".masthead .kicker");
    let version = ((kicker && kicker.textContent) || "").split("·").pop().trim();
    const phoneQuery = window.matchMedia("(max-width: 700px)");
    const showScreen = function () {
      const screen = window.trainLogField ? (phoneQuery.matches ? "Phone" : "Tablet") : "Desktop";
      footScreen.textContent = screen + " view · Version " + version;
    };
    showScreen();
    if (phoneQuery.addEventListener) phoneQuery.addEventListener("change", showScreen);
    // Prefer the running app version so a stale kicker in the HTML can't lie after an update.
    api("/api/health", { quiet: true }).then(function (result) {
      const body = result && result.data;
      if (!result || !result.ok || !body || !body.version) return;
      version = String(body.version);
      if (kicker) kicker.textContent = "Field Book for Railfans · " + version;
      showScreen();
    });
  }

  const wipeButton = document.getElementById("btn-wipe");
  if (wipeButton) wipeButton.innerHTML = ICON_TRASH;

  if (window.trainLogField) {
    let filterTimer = null;
    const filterForm = document.getElementById("filter-form");
    const wipe = wipeButton;
    if (wipe) {
      const slot = document.createElement("div");
      slot.className = "filter-wipe";
      slot.appendChild(wipe);
      const primary = filterForm.querySelector(".filters-primary") || filterForm;
      primary.appendChild(slot);
    }
    filterForm.addEventListener("change", function () {
      clearTimeout(filterTimer);
      loadLog();
    });
    filterForm.addEventListener("input", function (event) {
      if (event.target.type !== "search") return;
      clearTimeout(filterTimer);
      filterTimer = setTimeout(loadLog, 400);
    });
  }

  function exportHref(fmt) {
    return "/api/export?format=" + fmt + (filterQuery() ? "&" + filterQuery().slice(1) : "");
  }

  async function saveDownload(url, filename) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        showBanner("Could not export.", "error");
        return;
      }
      const blob = await response.blob();
      if (window.trainLogSaveFile && (await window.trainLogSaveFile(blob, filename))) return;
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () {
        URL.revokeObjectURL(href);
      }, 2000);
      showBanner("Saving " + filename + ".", "ok");
    } catch (err) {
      showBanner("Could not export.", "error");
    }
  }

  document.getElementById("btn-export-csv").addEventListener("click", function () {
    if (nativeAction("export-csv", filterQuery())) return;
    saveDownload(exportHref("csv"), "train-log.csv");
  });
  document.getElementById("btn-export-json").addEventListener("click", function () {
    if (nativeAction("export-json", filterQuery())) return;
    saveDownload(exportHref("json"), "train-log.json");
  });
  document.getElementById("btn-backup").addEventListener("click", function () {
    if (nativeAction("backup")) return;
    saveDownload("/api/database/backup", "train-log.db");
  });
  function recoveryPackName() {
    const stamp = new Date().toISOString().slice(0, 10);
    return "TRAIN-LOG-recovery-" + stamp + ".zip";
  }
  const btnBackupAirDrop = document.getElementById("btn-backup-airdrop");
  if (btnBackupAirDrop) {
    btnBackupAirDrop.addEventListener("click", function () {
      if (nativeAction("backup-airdrop")) return;
      saveDownload("/api/database/backup", "train-log.db");
    });
  }
  const btnRecoveryPack = document.getElementById("btn-recovery-pack");
  if (btnRecoveryPack) {
    btnRecoveryPack.addEventListener("click", function () {
      if (nativeAction("recovery-pack")) return;
      saveDownload("/api/database/recovery-pack", recoveryPackName());
    });
  }
  const btnRecoveryAirDrop = document.getElementById("btn-recovery-airdrop");
  if (btnRecoveryAirDrop) {
    btnRecoveryAirDrop.addEventListener("click", function () {
      if (nativeAction("recovery-pack-airdrop")) return;
      saveDownload("/api/database/recovery-pack", recoveryPackName());
    });
  }
  document.getElementById("btn-copy-sheet").addEventListener("click", async function () {
    const headers = [
      "date",
      "trip",
      "time",
      "railroad",
      "lead_locomotive",
      "direction",
      "stopped",
      "in_siding",
      "crew_change",
      "no_crew",
      "power_consist",
      "train_types",
      "load_status",
      "car_counts",
      "location",
      "subdivision",
      "state",
      "symbol",
      "train_number",
      "train_info",
      "notes",
      "photographed",
      "videoed",
      "trip_from",
      "trip_to",
      "time_zone",
      "location_region",
      "location_coordinates",
      "lead_status",
      "night",
      "coal_mark",
      "con_overseas",
      "con_domestic",
    ];
    function cell(value) {
      return String(value == null ? "" : value).replace(/\t/g, " ").replace(/\r?\n/g, " ");
    }
    const lines = [headers.join("\t")];
    sortedLogEntries().forEach(function (entry) {
      lines.push(
        [
          cell(entry.date),
          cell(entry.trip_name || ""),
          cell(entry.time),
          cell(entry.railroad),
          cell(entry.lead_locomotive),
          cell(entry.direction),
          entry.stopped ? "true" : "false",
          entry.in_siding ? "true" : "false",
          entry.crew_change ? "true" : "false",
          entry.no_crew ? "true" : "false",
          cell(entry.power_consist),
          cell(entry.train_types_label || (entry.train_types || []).join("|")),
          cell(entry.load_status || ""),
          cell(entry.car_counts),
          cell(entry.location_spot),
          cell(entry.location_subdivision || ""),
          cell(entry.location_state || ""),
          cell(entry.train_symbol || ""),
          cell(entry.train_number || ""),
          cell(entry.train_info || ""),
          cell(entry.notes),
          entry.photographed ? "true" : "false",
          entry.videoed ? "true" : "false",
          cell(entry.trip_date_from || ""),
          cell(entry.trip_date_to || ""),
          cell(entry.time_zone || ""),
          cell(entry.location_region || ""),
          cell(entry.location_coordinates == null ? "" :
            typeof entry.location_coordinates === "string" ? entry.location_coordinates : JSON.stringify(entry.location_coordinates)),
          cell(entry.lead_status || ""),
          entry.night ? "true" : "false",
          cell(entry.coal_mark || ""),
          entry.con_overseas ? "true" : "",
          entry.con_domestic ? "true" : "",
        ].join("\t")
      );
    });
    const text = lines.join("\n");
    async function copyText() {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      throw new Error("clipboard");
    }
    try {
      await copyText();
      showBanner("Copied for a spreadsheet. Paste into Google Sheets or Excel. TRAIN LOG stays offline.", "ok");
    } catch (err) {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      if (ok) {
        showBanner("Copied for a spreadsheet. Paste into Google Sheets or Excel. TRAIN LOG stays offline.", "ok");
      } else {
        showBanner("Could not copy. Use Export CSV instead, then File → Import in Google Sheets.", "error");
      }
    }
  });
  document.getElementById("btn-wipe").addEventListener("click", function () {
    document.getElementById("wipe-dialog").showModal();
  });
  document.getElementById("wipe-dialog").addEventListener("close", async function () {
    if (this.returnValue !== "wipe") return;
    const result = await api("/api/entries/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    if (!result.ok) {
      showBanner((result.data && result.data.error) || "Could not delete log data.");
      return;
    }
    showBanner((result.data && result.data.message) || "All log data deleted.", "ok");
    loadLog();
    refreshPendingBadge();
  });

  function isQtApp() {
    return /QtWebEngine/i.test(navigator.userAgent || "");
  }

  function nativeAction(name, extraQuery) {
    if (!isQtApp()) return false;
    let href = "/__native__/" + name;
    if (extraQuery) {
      href += extraQuery.charAt(0) === "?" ? extraQuery : "?" + extraQuery;
    }
    window.location.href = href;
    return true;
  }

  async function importFile(file) {
    workStart("Reading file…");
    try {
      const text = await file.text();
      const name = file.name || "upload.csv";
      const payload = { source: name };
      const trimmed = text.replace(/^\uFEFF/, "").trim();
      if (/\.json$/i.test(name) || trimmed.charAt(0) === "{" || trimmed.charAt(0) === "[") {
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch (err) {
          showBanner("Could not read that JSON file.", "error");
          return;
        }
        if (Array.isArray(parsed)) payload.entries = parsed;
        else if (parsed && Array.isArray(parsed.entries)) payload.entries = parsed.entries;
        else if (parsed && typeof parsed.csv === "string") payload.csv = parsed.csv;
        else payload.entries = [parsed];
      } else {
        payload.csv = text;
      }
      workShow("Importing trains…");
      workPoll();
      const result = await api("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        quiet: true,
      });
      const data = result.data || {};
      if (!result.ok) {
        showBanner((data && data.error) || "Could not import that file.", "error");
        return;
      }
      const created = data.count || 0;
      const pending = data.pending || 0;
      const errors = data.errors || [];
      if (!created && !pending) {
        showBanner(data.message || "No trains found in that file.", "error");
        await refreshPendingBadge();
        return;
      }
      showBanner(data.message || "Import finished.", pending || errors.length || data.to_check ? "" : "ok");
      await refreshPendingBadge();
      if (pending || data.to_check) {
        if (location.hash === "#import" || location.hash === "#review" || location.hash === "#datacheck") loadPending();
        else location.hash = "review";
      } else loadLog();
    } catch (err) {
      showBanner("Could not import that file.", "error");
    } finally {
      workDone();
    }
  }

  const logMenus = [
    ["btn-log-cols", "log-col-menu"],
    ["btn-log-import", "log-import-menu"],
    ["btn-log-export", "log-export-menu"],
  ]
    .map(function (ids) {
      return { btn: document.getElementById(ids[0]), menu: document.getElementById(ids[1]) };
    })
    .filter(function (pair) {
      return pair.btn && pair.menu;
    });
  function closeLogMenus(except) {
    logMenus.forEach(function (pair) {
      if (pair === except || pair.menu.hidden) return;
      pair.menu.hidden = true;
      pair.btn.setAttribute("aria-expanded", "false");
    });
  }
  logMenus.forEach(function (pair) {
    pair.btn.addEventListener("click", function (event) {
      event.stopPropagation();
      const open = pair.menu.hidden;
      closeLogMenus(pair);
      pair.menu.hidden = !open;
      pair.btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    pair.menu.addEventListener("click", function (event) {
      if (event.target.closest("button")) {
        closeLogMenus();
        return;
      }
      event.stopPropagation();
    });
  });
  if (logMenus.length) {
    document.addEventListener("click", function () {
      closeLogMenus();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeLogMenus();
    });
  }
  const logColMenu = document.getElementById("log-col-menu");
  if (logColMenu) {
    logColMenu.addEventListener("change", function (event) {
      const input = event.target;
      const key = input && input.getAttribute("data-col");
      if (!key) return;
      setLogColHidden(key, !input.checked);
      input.checked = !hiddenLogCols[key];
    });
  }
  applyLogColumns();

  document.getElementById("btn-import").addEventListener("click", function () {
    if (nativeAction("import")) {
      workStart("Importing file…", { poll: true });
      return;
    }
    document.getElementById("import-file").click();
  });
  document.getElementById("btn-import-2").addEventListener("click", function () {
    if (nativeAction("import")) {
      workStart("Importing file…", { poll: true });
      return;
    }
    document.getElementById("import-file").click();
  });
  document.getElementById("import-file").addEventListener("change", function (event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (file) importFile(file);
  });

  let guessItems = [];
  const guessTicked = new Set();
  let guessAnchor = null;
  const guessEl = {
    section: document.getElementById("guess-review"),
    body: document.getElementById("guess-body"),
    filter: document.getElementById("guess-filter"),
    rr: document.getElementById("guess-rr"),
    sub: document.getElementById("guess-sub"),
    zone: document.getElementById("guess-zone"),
    setSub: document.getElementById("guess-set-sub"),
    setZone: document.getElementById("guess-set-zone"),
    keep: document.getElementById("guess-keep"),
    all: document.getElementById("guess-all"),
    picked: document.getElementById("guess-picked"),
    count: document.getElementById("guess-count"),
  };

  function guessShown() {
    const filter = guessEl.filter.value;
    const rr = guessEl.rr.value;
    return guessItems.filter(function (item) {
      if (rr && item.entry.railroad !== rr) return false;
      if (filter === "all") return true;
      const parts = filter.split("-");
      return item[parts[0] + "_status"] === parts[1];
    });
  }

  function guessCell(text, status, reason) {
    if (status === "missing") {
      return '<span class="guess-missing" title="' + escapeText(reason || "Not set") + '">—</span>';
    }
    if (status === "guessed") {
      return '<span class="guess-value" title="' + escapeText("Guess: " + (reason || "")) + '">' + escapeText(text) + "</span>";
    }
    return escapeText(text || "");
  }

  function guessSubOptions(rows) {
    const keep = guessEl.sub.value;
    const rrs = [];
    rows.forEach(function (item) {
      const rr = item.entry.railroad;
      if (rr && rrs.indexOf(rr) < 0) rrs.push(rr);
    });
    guessEl.sub.innerHTML =
      '<option value="">Pick One</option><option value="__none__">No Subdivision</option>' + subGroupsHtml(rrs);
    if (keep && guessEl.sub.querySelector('option[value="' + CSS.escape(keep) + '"]')) guessEl.sub.value = keep;
  }

  function subGroupsHtml(rrs) {
    const used = {};
    let html = "";
    rrs.slice().sort().forEach(function (rr) {
      const subs = (SUBS_BY_RR[rr] || []).slice().sort();
      if (!subs.length) return;
      html += '<optgroup label="' + escapeText(rr) + '">';
      subs.forEach(function (name) {
        used[name] = true;
        html += '<option value="' + escapeText(name) + '">' + escapeText(name) + "</option>";
      });
      html += "</optgroup>";
    });
    const rest = {};
    Object.keys(SUBS_BY_RR).forEach(function (rr) {
      (SUBS_BY_RR[rr] || []).forEach(function (name) {
        if (!used[name]) rest[name] = true;
      });
    });
    const others = Object.keys(rest).sort();
    if (others.length) {
      html += '<optgroup label="' + (rrs.length ? "Other Subdivisions" : "All Subdivisions") + '">';
      others.forEach(function (name) {
        html += '<option value="' + escapeText(name) + '">' + escapeText(name) + "</option>";
      });
      html += "</optgroup>";
    }
    return html;
  }

  function renderGuesses() {
    const shown = guessShown();
    const shownIds = {};
    shown.forEach(function (item) {
      shownIds[item.entry.id] = true;
    });
    Array.from(guessTicked).forEach(function (id) {
      if (!shownIds[id]) guessTicked.delete(id);
    });
    guessEl.body.innerHTML = shown.length
      ? shown
          .map(function (item) {
            const e = item.entry;
            const id = e.id;
            const on = guessTicked.has(id);
            const zoneText = e.time_zone ? (zoneLabel(e.time_zone) || e.time_zone) + " " + zoneAbbr(e.time_zone, e.date) : "";
            return (
              '<tr data-id="' + id + '"' + (on ? ' class="is-ticked"' : "") + ">" +
              '<td class="guess-check"><input type="checkbox" data-guess-id="' + id + '"' + (on ? " checked" : "") +
              ' aria-label="Tick sighting ' + id + '" /></td>' +
              "<td>" + escapeText(e.date) + "</td>" +
              "<td>" + escapeText(formatPadTime(e.time)) + "</td>" +
              "<td>" + escapeText(e.railroad) + "</td>" +
              "<td>" + escapeText(e.lead_locomotive) + "</td>" +
              "<td>" + escapeText(e.location_spot) + "</td>" +
              "<td>" + escapeText(e.location_state || "") + "</td>" +
              "<td>" + guessCell(e.location_subdivision, item.sub_status, item.sub_reason) + "</td>" +
              "<td>" + guessCell(zoneText.trim(), item.zone_status, item.zone_reason) + "</td>" +
              '<td class="log-actions"><button type="button" class="btn tiny ghost icon-btn" data-guess-edit="' + id +
              '" title="Edit train #' + id + '" aria-label="Edit train #' + id + '">' + ICON_PENCIL + "</button></td>" +
              "</tr>"
            );
          })
          .join("")
      : '<tr><td colspan="10" class="muted">Nothing matches this filter.</td></tr>';
    const ticked = shown.filter(function (item) {
      return guessTicked.has(item.entry.id);
    });
    const n = ticked.length;
    guessEl.all.checked = n > 0 && n === shown.length;
    guessEl.all.indeterminate = n > 0 && n < shown.length;
    guessEl.picked.textContent = n ? n + " ticked" : "None ticked";
    guessEl.setSub.disabled = !n;
    guessEl.setZone.disabled = !n;
    guessEl.keep.disabled = !n;
    guessEl.count.textContent = guessItems.length + (guessItems.length === 1 ? " sighting to check" : " sightings to check");
    guessSubOptions(n ? ticked : shown);
  }

  async function loadGuesses() {
    if (!guessEl.section) return;
    const result = await api("/api/import/review", { quiet: true });
    guessItems = (result.data && result.data.items) || [];
    guessEl.section.hidden = guessItems.length === 0;
    if (!guessItems.length) {
      guessTicked.clear();
      return;
    }
    await ensureSubs();
    const keepRr = guessEl.rr.value;
    const rrs = [];
    guessItems.forEach(function (item) {
      if (item.entry.railroad && rrs.indexOf(item.entry.railroad) < 0) rrs.push(item.entry.railroad);
    });
    guessEl.rr.innerHTML =
      '<option value="">All</option>' +
      rrs
        .sort()
        .map(function (rr) {
          return '<option value="' + escapeText(rr) + '">' + escapeText(rr) + "</option>";
        })
        .join("");
    if (rrs.indexOf(keepRr) >= 0) guessEl.rr.value = keepRr;
    if (!guessEl.zone.options.length) {
      guessEl.zone.innerHTML =
        '<option value="">Pick One</option>' +
        TZ_CHOICES.map(function (choice) {
          return '<option value="' + escapeText(choice[0]) + '">' + escapeText(choice[1] + " " + zoneAbbr(choice[0])) + "</option>";
        }).join("") +
        '<option value="__none__">No Zone</option>';
    }
    renderGuesses();
  }

  async function applyGuesses(body) {
    const ids = Array.from(guessTicked);
    if (!ids.length) return;
    body.ids = ids;
    const result = await api("/api/import/review/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = result.data || {};
    if (!result.ok) {
      showBanner(data.error || "Could not update those sightings.", "error");
      return;
    }
    showBanner(data.message || "Updated.", "ok");
    guessTicked.clear();
    guessAnchor = null;
    await loadGuesses();
    refreshPendingBadge();
  }

  if (guessEl.section) {
    guessEl.filter.addEventListener("change", renderGuesses);
    guessEl.rr.addEventListener("change", renderGuesses);
    guessEl.all.addEventListener("change", function () {
      const on = guessEl.all.checked;
      guessShown().forEach(function (item) {
        if (on) guessTicked.add(item.entry.id);
        else guessTicked.delete(item.entry.id);
      });
      renderGuesses();
    });
    guessEl.body.addEventListener("click", function (event) {
      const edit = event.target.closest("[data-guess-edit]");
      if (edit) {
        openEditDialog(edit.getAttribute("data-guess-edit"));
        return;
      }
      const row = event.target.closest("tr[data-id]");
      if (!row) return;
      const id = Number(row.getAttribute("data-id"));
      const box = row.querySelector("input[type=checkbox]");
      const on = event.target === box ? box.checked : !guessTicked.has(id);
      const shown = Array.prototype.map.call(guessEl.body.querySelectorAll("tr[data-id]"), function (tr) {
        return Number(tr.getAttribute("data-id"));
      });
      if (event.shiftKey && guessAnchor !== null && shown.indexOf(guessAnchor) >= 0) {
        const a = shown.indexOf(guessAnchor);
        const b = shown.indexOf(id);
        shown.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(function (rowId) {
          if (on) guessTicked.add(rowId);
          else guessTicked.delete(rowId);
        });
      } else if (on) guessTicked.add(id);
      else guessTicked.delete(id);
      guessAnchor = id;
      renderGuesses();
    });
    guessEl.setSub.addEventListener("click", function () {
      const value = guessEl.sub.value;
      if (!value) {
        showBanner("Pick a subdivision first.", "error");
        guessEl.sub.focus();
        return;
      }
      applyGuesses({ subdivision: value === "__none__" ? "" : value });
    });
    guessEl.setZone.addEventListener("click", function () {
      const value = guessEl.zone.value;
      if (!value) {
        showBanner("Pick a time zone first.", "error");
        guessEl.zone.focus();
        return;
      }
      applyGuesses({ time_zone: value === "__none__" ? "" : value });
    });
    guessEl.keep.addEventListener("click", function () {
      applyGuesses({ keep: true });
    });
  }

  function pendingSummary(row) {
    return [row.date, row.time, row.lead_locomotive, row.location_spot].filter(Boolean).join(" · ");
  }

  function pendingConflictActions(item) {
    const phone = /(?:phone|field) sync/i.test(item.source || "");
    const preferExisting = phone ? "Prefer Mac" : "Keep existing";
    const preferIncoming = phone ? "Prefer phone" : "Use incoming";
    return (
      '<button type="button" class="btn tiny primary" data-resolve="keep_both" data-pending-id="' +
      item.id +
      '" title="Add the incoming copy as a new sighting; keep the Mac row as it is">Keep both</button> ' +
      '<button type="button" class="btn tiny ghost" data-resolve="prefer_existing" data-pending-id="' +
      item.id +
      '" title="Drop the incoming edit and leave the Mac row alone">' +
      escapeText(preferExisting) +
      "</button> " +
      '<button type="button" class="btn tiny ghost" data-resolve="prefer_incoming" data-pending-id="' +
      item.id +
      '" title="Overwrite the Mac row with the incoming edit">' +
      escapeText(preferIncoming) +
      "</button>"
    );
  }

  async function loadPending() {
    loadGuesses();
    const result = await api("/api/import/pending");
    const items = (result.data && result.data.pending) || [];
    document.getElementById("pending-empty").hidden = items.length > 0;
    const body = document.getElementById("pending-body");
    body.closest(".table-wrap").hidden = items.length === 0;
    pendingItems = items;
    body.innerHTML = items
      .map(function (item) {
        const incoming = item.payload || {};
        const existing = item.match_entry || {};
        const conflict = !!item.conflict;
        const existingEdit = existing.id
          ? ' <button type="button" class="btn tiny ghost icon-btn" data-existing-edit="' + existing.id +
            '" title="Edit train #' + existing.id + ' already in the log" aria-label="Edit train #' + existing.id + '">' +
            ICON_PENCIL + "</button>"
          : "";
        const actions = conflict
          ? pendingConflictActions(item)
          : (
            '<button type="button" class="btn tiny ghost" data-pending-edit="' +
            item.id +
            '" title="Open the incoming train in the edit card; saving adds it to the log">Edit…</button> ' +
            '<button type="button" class="btn tiny primary" data-accept="' +
            item.id +
            '">Add</button> <button type="button" class="btn tiny ghost" data-discard="' +
            item.id +
            '">Discard</button>'
          );
        return (
          "<tr" + (conflict ? ' class="pending-conflict"' : "") + "><td>" +
          escapeText(item.source || "") +
          "</td><td>" +
          escapeText(item.reason || "") +
          "</td><td>" +
          escapeText(pendingSummary(incoming)) +
          "</td><td>" +
          escapeText(pendingSummary(existing)) +
          existingEdit +
          '</td><td class="log-actions">' +
          actions +
          "</td></tr>"
        );
      })
      .join("");
  }

  document.getElementById("pending-body").addEventListener("click", async function (event) {
    const editPending = event.target.closest("[data-pending-edit]");
    if (editPending) {
      const pid = Number(editPending.getAttribute("data-pending-edit"));
      openPendingEdit(pendingItems.find(function (item) { return item.id === pid; }));
      return;
    }
    const editExisting = event.target.closest("[data-existing-edit]");
    if (editExisting) {
      openEditDialog(editExisting.getAttribute("data-existing-edit"));
      return;
    }
    const resolveBtn = event.target.closest("[data-resolve]");
    if (resolveBtn) {
      const resolution = resolveBtn.getAttribute("data-resolve");
      const pendingId = resolveBtn.getAttribute("data-pending-id");
      const phone = /(?:phone|field) sync/i.test(
        ((pendingItems || []).find(function (item) { return String(item.id) === String(pendingId); }) || {}).source || ""
      );
      if (resolution === "prefer_existing") {
        const sure = await window.askConfirm({
          title: phone ? "Prefer This Mac?" : "Keep Existing?",
          message: phone
            ? "The phone's edit is dropped. The Mac sighting stays as it is."
            : "The incoming row is dropped. The log keeps the existing sighting.",
          ok: phone ? "Prefer Mac" : "Keep existing",
        });
        if (!sure) return;
      }
      if (resolution === "prefer_incoming") {
        const sure = await window.askConfirm({
          title: phone ? "Prefer Phone?" : "Use Incoming?",
          message: phone
            ? "The Mac sighting is overwritten with the phone's edit. This cannot be undone from Review."
            : "The existing sighting is overwritten with the incoming row. This cannot be undone from Review.",
          ok: phone ? "Prefer phone" : "Use incoming",
        });
        if (!sure) return;
      }
      await api("/api/import/pending/" + pendingId + "/resolve", {
        method: "POST",
        body: JSON.stringify({ resolution: resolution }),
      });
      loadPending();
      refreshPendingBadge();
      return;
    }
    const accept = event.target.getAttribute("data-accept");
    const discard = event.target.getAttribute("data-discard");
    if (discard) {
      const sure = await window.askConfirm({
        title: "Discard This Held Import?",
        message: "The incoming row is dropped and is not added to the log.",
        ok: "Discard",
      });
      if (!sure) return;
    }
    if (accept) await api("/api/import/pending/" + accept + "/accept", { method: "POST" });
    if (discard) await api("/api/import/pending/" + discard + "/discard", { method: "POST" });
    if (accept || discard) {
      loadPending();
      refreshPendingBadge();
    }
  });

  async function refreshPendingBadge() {
    const result = await api("/api/import/pending");
    const count = ((result.data && result.data.count) || 0) + ((result.data && result.data.review_count) || 0);
    document.querySelectorAll(".pending-badge").forEach(function (el) {
      el.hidden = count === 0;
      el.textContent = String(count);
    });
  }

  document.querySelectorAll(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      const view = tab.getAttribute("data-view");
      if (!view) return;
      location.hash = view;
    });
  });

  window.addEventListener("hashchange", function () {
    setView(currentView());
  });

  window.trainLog = {
    specialText: specialText,
    goNewEntry: function () {
      location.hash = "entry";
    },
    goLog: function () {
      location.hash = "log";
    },
    goDashboard: function () {
      location.hash = "dashboard";
    },
    goSettings: function () {
      location.hash = "settings";
    },
    goStations: function () {
      location.hash = "settings";
    },
    goControlPanel: function () {
      location.hash = "settings";
    },
    goGazetteer: function () {
      location.hash = "settings";
    },
    goImport: function () {
      location.hash = "review";
    },
    goActivity: function () {
      location.hash = "activity";
    },
    editEntry: openEditDialog,
    showLogIds: showLogIds,
    refreshLists: refreshLists,
    refreshTrips: refreshTripNames,
    acroKeyHtml: acroKeyHtml,
    fillAcroKey: fillAcroKey,
    banner: showBanner,
    work: { start: workStart, set: workSet, done: workDone },
    setTheme: function (theme) {
      if (window.trainLogTheme) window.trainLogTheme.apply(theme);
    },
    toggleTheme: function () {
      if (window.trainLogTheme) return window.trainLogTheme.toggle();
      return null;
    },
    currentTheme: function () {
      return window.trainLogTheme ? window.trainLogTheme.current() : "light";
    },
  };

  dateEl.value = todayISO();
  dateEl.addEventListener("change", function () {
    dropInvalid(dateEl);
    loadDayLog();
    if (rowsEl) Array.prototype.forEach.call(rowsEl.querySelectorAll(".train-row"), syncDayNight);
  });
  dateEl.addEventListener("input", function () {
    dropInvalid(dateEl);
  });
  if (tripEl) {
    tripEl.addEventListener("focus", function () {
      if (tripEl.value.trim()) showTripSuggest();
    });
    tripEl.addEventListener("input", function () {
      showTripSuggest();
      syncTripDetailsButton();
    });
    tripEl.addEventListener("keydown", function (event) {
      if (event.key === "Escape") hideTripSuggest();
    });
    tripEl.addEventListener("blur", function () {
      window.setTimeout(hideTripSuggest, 120);
    });
    tripEl.addEventListener("change", function () {
      const name = tripEl.value.trim();
      applyTripMatch(name);
      offerApplyTripDefaults(name);
    });
  }
  [tripFromEl, tripToEl].forEach(function (box) {
    if (!box) return;
    box.addEventListener("input", syncSessionMore);
    box.addEventListener("change", syncSessionMore);
  });
  const sessionMoreBtn = document.getElementById("btn-session-more");
  const sessionExtra = document.getElementById("session-extra");
  if (sessionMoreBtn && sessionExtra) {
    sessionMoreBtn.addEventListener("click", function () {
      const open = sessionExtra.classList.toggle("is-open");
      sessionMoreBtn.classList.toggle("is-open", open);
      sessionMoreBtn.setAttribute("aria-expanded", open ? "true" : "false");
      sessionMoreBtn.textContent = open ? "Less" : "More";
    });
  }
  syncSessionMore();
  const gapTimerBtn = document.getElementById("btn-gap-timer");
  if (gapTimerBtn) gapTimerBtn.addEventListener("click", openGapTimer);
  const gapDialog = document.getElementById("gap-timer");
  const gapClose = document.getElementById("gap-timer-close");
  const gapStart = document.getElementById("gap-start");
  const gapStop = document.getElementById("gap-stop");
  if (gapClose && gapDialog) gapClose.addEventListener("click", function () { gapDialog.close(); });
  if (gapDialog) {
    gapDialog.addEventListener("click", function (event) {
      if (event.target === gapDialog) gapDialog.close();
    });
  }
  if (gapStart) gapStart.addEventListener("click", startGapTimer);
  if (gapStop) gapStop.addEventListener("click", stopGapTimer);
  const gapEdit = document.getElementById("gap-edit");
  const gapEditSet = document.getElementById("gap-edit-set");
  if (gapEdit) {
    gapEdit.addEventListener("click", function () {
      const row = document.getElementById("gap-edit-row");
      if (row && !row.hidden) closeGapEdit();
      else openGapEdit();
    });
  }
  if (gapEditSet) gapEditSet.addEventListener("click", applyGapEdit);
  paintGapTimer();
  window.setInterval(paintLastTrain, 30000);
  const addCsvFile = document.getElementById("add-csv-file");
  if (addCsvFile) {
    addCsvFile.addEventListener("change", function () {
      const file = addCsvFile.files && addCsvFile.files[0];
      addCsvFile.value = "";
      if (file) addSubdivisionCsv(file, rowsEl.querySelector(".train-row"));
    });
  }
  dayLogEl.addEventListener("click", function (event) {
    if (event.target.closest("a, button, select, label")) return;
    const row = event.target.closest(".day-card[data-id], .day-table tbody tr[data-id]");
    if (!row) return;
    openTrainCard(row.getAttribute("data-id"));
  });
  dayLogEl.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = event.target.closest(".day-card[data-id], .day-table tbody tr[data-id]");
    if (!row) return;
    event.preventDefault();
    openTrainCard(row.getAttribute("data-id"));
  });
  dayLogEl.addEventListener("change", function (event) {
    if (!event.target || event.target.id !== "day-log-layout") return;
    if (DAY_LOG_LAYOUTS.indexOf(event.target.value) === -1) return;
    dayLogLayout = event.target.value;
    try {
      localStorage.setItem("rr-day-log-layout", dayLogLayout);
    } catch (err) {}
    renderDayLog();
  });

  const spList = { kind: "heritage", rows: { heritage: [], steam: [] }, editing: null, limit: 400, changedOnly: false };
  const SP_LIST_LABELS = { heritage: "Heritage Units", a250: "America 250", steam: "Steam Engines" };
  const spListDialog = document.getElementById("sp-list-dialog");
  const SP_ERAS = { a250: "America 250" };
  const SP_SOURCES = { edited: "Edited", added: "Added" };
  const SP_NOUNS = { heritage: "heritage units", a250: "America 250 units", steam: "steam engines" };

  function spListField(kind) {
    return kind === "steam" ? "engine" : "unit";
  }

  function spDataKind(kind) {
    return kind === "steam" ? "steam" : "heritage";
  }

  function spViewRows(kind) {
    if (kind === "steam") return spList.rows.steam;
    return spList.rows.heritage.filter(function (row) {
      return (row.era === "a250") === (kind === "a250");
    });
  }

  function spJson(method, body) {
    return { method: method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  }

  async function loadSpList() {
    const result = await api("/api/special-power/list", { quiet: true });
    if (result.ok && result.data) {
      spList.rows = { heritage: result.data.heritage || [], steam: result.data.steam || [] };
    }
    renderSpCounts();
    if (spListDialog && spListDialog.open) renderSpList();
  }

  function renderSpCounts() {
    ["heritage", "a250", "steam"].forEach(function (kind) {
      const el = document.getElementById("dash-sp-counts-" + kind);
      if (!el) return;
      const rows = spViewRows(kind);
      const changed = rows.filter(function (row) {
        return row.source === "edited" || row.source === "added";
      }).length;
      const noun =
        kind === "steam" ? (rows.length === 1 ? "engine" : "engines") :
        rows.length === 1 ? "unit" : "units";
      el.textContent =
        rows.length.toLocaleString() + " " + noun +
        (changed ? " · " + changed + " changed on this Mac" : "");
    });
  }

  function spListMatches(row, q) {
    if (!q) return true;
    const text = [row.unit, row.engine, row.scheme, row.name, row.wheels, SP_ERAS[row.era], SP_SOURCES[row.source]]
      .filter(Boolean)
      .join(" ")
      .toUpperCase();
    const compact = unitKey(q);
    return text.indexOf(q.toUpperCase()) !== -1 || (compact && unitKey(row.unit || row.engine).indexOf(compact) !== -1);
  }

  function spRowChanged(row) {
    return row.source === "edited" || row.source === "added";
  }

  function spListShown(kind, q) {
    return spViewRows(kind).filter(function (row) {
      return (!spList.changedOnly || spRowChanged(row)) && spListMatches(row, q);
    });
  }

  function parkSpForm() {
    const form = document.getElementById("sp-list-form");
    const home = document.getElementById("sp-list-meta");
    if (form && home && form.nextElementSibling !== home) home.parentNode.insertBefore(form, home);
  }

  function placeSpForm() {
    const form = document.getElementById("sp-list-form");
    parkSpForm();
    if (!form || form.hidden || !spList.editing) return;
    const target = Array.prototype.filter.call(document.querySelectorAll("#sp-list-body tr[data-sp-id]"), function (tr) {
      return tr.getAttribute("data-sp-id") === spList.editing;
    })[0];
    if (!target) return;
    target.classList.add("is-editing");
    target.insertAdjacentHTML("afterend", '<tr class="sp-list-edit-tr"><td colspan="' + (spList.kind === "steam" ? 5 : 4) + '"></td></tr>');
    target.nextElementSibling.firstElementChild.appendChild(form);
  }

  function renderSpList() {
    if (!spListDialog) return;
    const kind = spList.kind;
    const field = spListField(kind);
    spListDialog.querySelectorAll("[data-sp-list-kind]").forEach(function (chip) {
      chip.classList.toggle("is-on", chip.getAttribute("data-sp-list-kind") === kind);
    });
    const changedChip = document.getElementById("sp-list-changed");
    if (changedChip) {
      changedChip.classList.toggle("is-on", spList.changedOnly);
      changedChip.setAttribute("aria-pressed", String(spList.changedOnly));
    }
    document.getElementById("sp-list-add").textContent =
      kind === "steam" ? "Add Steam Engine" : kind === "a250" ? "Add America 250 Unit" : "Add Heritage Unit";
    const q = document.getElementById("sp-list-q").value.trim();
    const all = spViewRows(kind);
    const shown = spListShown(kind, q);
    const changed = all.filter(spRowChanged).length;
    const noun = SP_NOUNS[kind];
    const elsewhere = q
      ? ["heritage", "a250", "steam"]
          .filter(function (other) {
            return other !== kind;
          })
          .map(function (other) {
            const count = spListShown(other, q).length;
            return count
              ? '<button type="button" class="sp-list-jump" data-sp-list-kind="' + other + '">' + count + " in " + SP_LIST_LABELS[other] + "</button>"
              : "";
          })
          .filter(Boolean)
      : [];
    document.getElementById("sp-list-meta").innerHTML =
      escapeText(
        (shown.length > spList.limit
          ? "Showing " + spList.limit + " of " + shown.length + " " + noun + ". Search to narrow the list."
          : shown.length + (q || spList.changedOnly ? " of " + all.length : "") + " " + noun + ".") +
          (changed ? " " + changed + " changed on this Mac." : "")
      ) + (elsewhere.length ? " Also found: " + elsewhere.join(", ") + "." : "");
    parkSpForm();
    document.getElementById("sp-list-head").innerHTML =
      kind === "steam"
        ? "<tr><th>Engine</th><th>Name</th><th>Wheel Arrangement</th><th></th><th></th></tr>"
        : "<tr><th>Unit</th><th>Scheme</th><th></th><th></th></tr>";
    document.getElementById("sp-list-body").innerHTML = shown
      .slice(0, spList.limit)
      .map(function (row) {
        const id = escapeText(row[field]);
        return (
          '<tr data-sp-id="' +
          id +
          '" title="Click to edit"><td>' +
          id +
          "</td><td>" +
          escapeText(kind === "steam" ? row.name : row.scheme) +
          "</td>" +
          (kind === "steam" ? "<td>" + escapeText(row.wheels || "") + "</td>" : "") +
          '<td class="sp-list-source">' +
          escapeText(SP_SOURCES[row.source] || "") +
          '</td><td class="sp-list-actions">' +
          '<button type="button" class="btn tiny ghost" data-sp-list-edit="' +
          id +
          '">Edit</button>' +
          '<button type="button" class="btn tiny ghost" data-sp-list-remove="' +
          id +
          '">Remove</button></td></tr>'
        );
      })
      .join("");
    placeSpForm();
  }

  function spFormHtml(kind, row) {
    row = row || {};
    const fields =
      kind === "steam"
        ? '<label><span>Engine</span><input class="spl-id" type="text" autocomplete="off" spellcheck="false" value="' +
          escapeText(row.engine || "") +
          '" /></label>' +
          '<label class="sp-wide"><span>Name</span><input class="spl-name" type="text" autocomplete="off" value="' +
          escapeText(row.name || "") +
          '" /></label>' +
          '<label class="sp-wide"><span>Wheel arrangement</span><div class="sp-wheels-fields">' +
          '<select class="spl-wheels" aria-label="Wheel arrangement">' +
          wheelOptions(row.wheels || "") +
          '</select><input class="spl-wheels-other" type="text" aria-label="Other wheel arrangement" value="' +
          escapeText(row.wheels && !(SPECIAL_ROSTER.wheels || []).some(function (p) { return p[0] === row.wheels; }) ? row.wheels : "") +
          '" hidden /></div></label>'
        : '<label><span>Unit</span><input class="spl-id" type="text" autocomplete="off" spellcheck="false" value="' +
          escapeText(row.unit || "") +
          '" /></label>' +
          '<label class="sp-wide sp-id-field"><span>Scheme</span><input class="spl-scheme" type="text" autocomplete="off" aria-autocomplete="list" value="' +
          escapeText(row.scheme || "") +
          '" /><div class="suggest sp-suggest"></div></label>';
    return (
      '<div class="sp-item">' +
      fields +
      '<button type="button" class="btn primary" data-sp-list-save>Save</button>' +
      '<button type="button" class="btn ghost" data-sp-list-cancel>Cancel</button>' +
      '</div><p class="sp-list-error" hidden></p>'
    );
  }

  function openSpForm(row) {
    const form = document.getElementById("sp-list-form");
    spList.editing = row ? row[spListField(spList.kind)] : "";
    form.innerHTML = spFormHtml(spList.kind, row);
    form.hidden = false;
    parkSpForm();
    document.querySelectorAll("#sp-list-body tr.is-editing").forEach(function (tr) {
      tr.classList.remove("is-editing");
    });
    document.querySelectorAll("#sp-list-body .sp-list-edit-tr").forEach(function (tr) {
      tr.remove();
    });
    placeSpForm();
    const other = form.querySelector(".spl-wheels-other");
    if (other) other.hidden = form.querySelector(".spl-wheels").value !== "Other";
    form.querySelector(".spl-id").focus();
  }

  function closeSpForm() {
    const form = document.getElementById("sp-list-form");
    form.hidden = true;
    form.innerHTML = "";
    spList.editing = null;
    parkSpForm();
    document.querySelectorAll("#sp-list-body tr.is-editing").forEach(function (tr) {
      tr.classList.remove("is-editing");
    });
    document.querySelectorAll("#sp-list-body .sp-list-edit-tr").forEach(function (tr) {
      tr.remove();
    });
  }

  async function saveSpForm() {
    const form = document.getElementById("sp-list-form");
    const kind = spList.kind;
    const body = { kind: spDataKind(kind), original: spList.editing || "" };
    body[spListField(kind)] = form.querySelector(".spl-id").value;
    if (kind === "steam") {
      const pick = form.querySelector(".spl-wheels").value;
      body.name = form.querySelector(".spl-name").value;
      body.wheels = pick === "Other" ? form.querySelector(".spl-wheels-other").value : pick;
    } else {
      body.scheme = form.querySelector(".spl-scheme").value;
      body.era = kind === "a250" ? "a250" : "";
    }
    const result = await api("/api/special-power/item", spJson("POST", body));
    if (!result.ok) {
      const error = form.querySelector(".sp-list-error");
      error.textContent = (result.data && result.data.error) || "Could not save.";
      error.hidden = false;
      return;
    }
    const saved = result.data.row || {};
    if (kind !== "steam") spList.kind = saved.era === "a250" ? "a250" : "heritage";
    closeSpForm();
    document.getElementById("sp-list-q").value = saved[spListField(kind)] || "";
    await loadSpList();
    loadSpecialRoster();
  }

  function openSpList(kind) {
    if (!spListDialog) return;
    if (!kind || !SP_NOUNS[kind]) kind = "heritage";
    if (SP_NOUNS[kind]) spList.kind = kind;
    closeSpForm();
    document.getElementById("sp-list-q").value = "";
    if (!spListDialog.open) spListDialog.showModal();
    renderSpList();
    loadSpList();
    document.getElementById("sp-list-q").focus();
  }

  document.addEventListener("click", function (event) {
    const opener = event.target.closest && event.target.closest("[data-sp-editor]");
    if (opener) openSpList(opener.getAttribute("data-sp-editor"));
  });

  if (spListDialog) {
    document.getElementById("sp-list-q").addEventListener("input", renderSpList);
    document.getElementById("sp-list-add").addEventListener("click", function () {
      openSpForm(null);
    });
    document.getElementById("sp-list-restore").addEventListener("click", async function () {
      const ok = await window.askConfirm({
        title: "Restore the Shipped Heritage and Steam List?",
        message: "Units you added are removed, edited units go back to the shipped scheme, and removed units come back. Sightings in your log are not changed.",
        ok: "Restore Shipped",
      });
      if (!ok) return;
      await api("/api/special-power/restore", spJson("POST", {}));
      closeSpForm();
      await loadSpList();
      loadSpecialRoster();
    });
    spListDialog.addEventListener("click", async function (event) {
      const kindChip = event.target.closest("[data-sp-list-kind]");
      if (kindChip) {
        spList.kind = kindChip.getAttribute("data-sp-list-kind");
        closeSpForm();
        renderSpList();
        return;
      }
      if (event.target.closest("#sp-list-changed")) {
        spList.changedOnly = !spList.changedOnly;
        closeSpForm();
        renderSpList();
        return;
      }
      if (event.target.closest("[data-sp-list-save]")) return saveSpForm();
      if (event.target.closest("[data-sp-list-cancel]")) return closeSpForm();
      const field = spListField(spList.kind);
      const clickedRow = event.target.closest("#sp-list-body tr[data-sp-id]");
      if (clickedRow && !event.target.closest("button")) {
        const id = clickedRow.getAttribute("data-sp-id");
        if (spList.editing === id) return;
        openSpForm(spViewRows(spList.kind).filter(function (row) { return row[field] === id; })[0] || null);
        return;
      }
      const edit = event.target.closest("[data-sp-list-edit]");
      if (edit) {
        const id = edit.getAttribute("data-sp-list-edit");
        openSpForm(spViewRows(spList.kind).filter(function (row) { return row[field] === id; })[0] || null);
        return;
      }
      const remove = event.target.closest("[data-sp-list-remove]");
      if (remove) {
        const id = remove.getAttribute("data-sp-list-remove");
        const ok = await window.askConfirm({
          title: "Remove " + id + " from the list?",
          message: "The pad stops filling it in. Sightings already in your log keep it. Restore shipped brings shipped units back.",
          ok: "Remove",
        });
        if (!ok) return;
        await api("/api/special-power/item", spJson("DELETE", { kind: spDataKind(spList.kind), unit: id }));
        await loadSpList();
        loadSpecialRoster();
      }
    });
    spListDialog.addEventListener("change", function (event) {
      if (!event.target.matches(".spl-wheels")) return;
      const other = spListDialog.querySelector(".spl-wheels-other");
      other.hidden = event.target.value !== "Other";
      if (!other.hidden) other.focus();
    });
    spListDialog.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && event.target.closest && event.target.closest("#sp-list-form")) {
        event.preventDefault();
        closeSpForm();
        document.getElementById("sp-list-q").focus();
        return;
      }
      if (event.key !== "Enter" || event.target.tagName !== "INPUT") return;
      event.preventDefault();
      if (event.target.closest("#sp-list-form")) saveSpForm();
    });
  }

  const DIALOG_DISMISS =
    '#edit-dialog-cancel, #sub-editor-cancel, #trip-details-cancel, .type-filters-dialog-close, menu button[value="cancel"], menu button[value="close"]';
  document.querySelectorAll("dialog").forEach(function (dialog) {
    if (dialog.querySelector(".dialog-x")) return;
    const xHtml = '<button type="button" class="dialog-x" aria-label="Close" title="Close">×</button>';
    const actions = dialog.querySelector(".edit-dialog-actions");
    let xBtn;
    if (actions) {
      actions.insertAdjacentHTML("beforeend", xHtml);
      xBtn = actions.lastElementChild;
      xBtn.classList.add("is-inline");
    } else {
      const bar = document.createElement("div");
      bar.className = "dialog-x-bar";
      bar.innerHTML = xHtml;
      dialog.insertBefore(bar, dialog.firstChild);
      xBtn = bar.querySelector(".dialog-x");
    }
    xBtn.addEventListener("click", function () {
      const dismiss = dialog.querySelector(DIALOG_DISMISS);
      if (dismiss) dismiss.click();
      else dialog.close();
    });
  });

  const quickUnitsDialog = document.getElementById("quick-units-dialog");
  if (quickUnitsDialog) {
    const go = document.getElementById("quick-units-go");
    if (go) {
      go.addEventListener("click", function () {
        if (quickUnitsDialog.open) quickUnitsDialog.close();
        window.setTimeout(function () {
          const btn = document.getElementById("btn-quick-add");
          if (btn) btn.click();
        }, 0);
      });
    }
  }

  function noteQuickUnits() {
    let raw = "";
    try { raw = sessionStorage.getItem("rr-quick-units") || ""; } catch (err) { return; }
    if (!raw) return;
    let fields = null;
    try { fields = JSON.parse(raw); } catch (err) { return; }
    const consist = (fields && fields.consist) || "the units";
    const message = "Tap Quick Add to fill " + consist + " with the last railroad, subdivision, and location.";
    const text = document.getElementById("quick-units-message");
    if (!quickUnitsDialog || typeof quickUnitsDialog.showModal !== "function" || !text) {
      showBanner(message);
      return;
    }
    text.textContent = message;
    if (!quickUnitsDialog.open) quickUnitsDialog.showModal();
    const go = document.getElementById("quick-units-go");
    if (go) go.focus();
  }

  function entryRowAt(index) {
    const rows = rowsEl.querySelectorAll(".train-row");
    if (rows[index]) return rows[index];
    const n = rows.length;
    rowsEl.insertAdjacentHTML("beforeend", rowTemplate(n));
      Array.prototype.forEach.call(rowsEl.querySelectorAll(".train-row.is-empty"), applyPadDefaultsToRow);
    const row = rowsEl.querySelector('.train-row[data-row="' + n + '"]');
    bindRow(row);
    fillSubSelect(row, "");
    fillMarkSelect(row, "");
    return row;
  }

  function takeReadUnitQueue() {
    let raw = "";
    try { raw = sessionStorage.getItem("rr-read-units-queue") || ""; } catch (err) { return []; }
    if (!raw) {
      try { raw = sessionStorage.getItem("rr-read-units") || ""; } catch (err2) { return []; }
      if (!raw) return [];
    }
    try {
      sessionStorage.removeItem("rr-read-units-queue");
      sessionStorage.removeItem("rr-read-units");
    } catch (err) { /* already consumed */ }
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (err) { return []; }
    const list = Array.isArray(parsed) ? parsed : [{ seq: 1, kind: "fill", fields: parsed }];
    return list.filter(function (item) {
      return item && item.fields;
    }).sort(function (a, b) {
      return (Number(a.seq) || 0) - (Number(b.seq) || 0);
    });
  }

  async function applyReadUnitQueue() {
    const items = takeReadUnitQueue();
    if (!items.length) return;
    let last = null;
    if (items.some(function (item) { return item.kind === "quick"; })) {
      try {
        const result = await api("/api/locomotives/last");
        last = result.data && result.data.last_entry;
      } catch (err) { last = null; }
    }
    let slot = 0;
    const have = rowsEl.querySelectorAll(".train-row");
    while (slot < have.length && rowIsFilled(readRow(have[slot], false))) slot += 1;
    items.forEach(function (item) {
      const row = entryRowAt(slot);
      slot += 1;
      if (item.kind === "quick" && last) {
        clearRow(row);
        setSelectValue(row.querySelector(".f-rr"), row.querySelector(".f-rr-custom"), last.railroad || "");
        row.querySelector(".f-rr").dataset.prev = row.querySelector(".f-rr").value;
        fillMarkSelect(row, "");
        fillSubSelect(row, last.location_subdivision || "");
        row.querySelector(".f-loc").value = last.location_spot || "";
        applyRowState(row, last.location_state || "");
      }
      applyReadUnits(item.fields, "", row, true);
    });
    relabelRows();
    saveEntryDraft();
    setView("entry");
    const word = items.length === 1 ? "train" : "trains";
    showBanner(items.length + " " + word + " added in the order you saw them. Nothing is saved until you save the entry.", "ok");
    const first = rowsEl.querySelector(".train-row");
    const lead = first && first.querySelector(".lead-stack");
    if (lead) lead.scrollIntoView({ block: "center" });
  }

  function applyReadUnits(preset, bannerLead, targetRow, quiet) {
    let fields = preset || null;
    if (!fields) {
      let raw = "";
      try { raw = sessionStorage.getItem("rr-read-units") || ""; } catch (err) { return; }
      if (!raw) return;
      try { sessionStorage.removeItem("rr-read-units"); } catch (err) { /* already consumed */ }
      try { fields = JSON.parse(raw); } catch (err) { return; }
    }
    const number = String((fields && fields.number) || "").trim();
    const mark = String((fields && fields.mark) || "").trim().toUpperCase();
    const head = Array.isArray(fields && fields.head) ? fields.head.map(function (value) {
      return String(value || "").trim();
    }).filter(Boolean) : [];
    const midLines = Array.isArray(fields && fields.mid) ? fields.mid.map(function (value) {
      return String(value || "").trim();
    }).filter(Boolean) : [];
    const rearLines = Array.isArray(fields && fields.rear) ? fields.rear.map(function (value) {
      return String(value || "").trim();
    }).filter(Boolean) : [];
    const midCount = Math.min(12, Math.max(Number(fields && fields.midCount) || 0, midLines.length));
    const rearCount = Math.min(12, Math.max(Number(fields && fields.rearCount) || 0, rearLines.length));
    if (!number && !head.length && !midLines.length && !rearLines.length) return;
    const row = targetRow || rowsEl.querySelector(".train-row");
    if (!row) return;
    if (mark && !railroadOf(row) && RAILROADS.indexOf(mark) !== -1) {
      setSelectValue(row.querySelector(".f-rr"), row.querySelector(".f-rr-custom"), mark);
      row.querySelector(".f-rr").dataset.prev = row.querySelector(".f-rr").value;
    }
    if (mark) fillMarkSelect(row, mark);
    setLeadStatus(row, "", true);
    const loco = row.querySelector(".f-loco");
    loco.maxLength = Math.max(4, number.replace(/\D/g, "").length || 4);
    loco.value = number;
    const headCount = Math.min(12, (number ? 1 : 0) + head.length);
    let boxMid = [];
    let boxRear = [];
    row.querySelector(".f-c1").value = headCount ? String(headCount) : "";
    if (midCount && rearCount) {
      row.querySelector(".f-c2").value = String(midCount);
      row.querySelector(".f-c3").value = String(rearCount);
      boxMid = midLines;
      boxRear = rearLines;
    } else if (rearCount) {
      row.querySelector(".f-c2").value = String(rearCount);
      row.querySelector(".f-c3").value = "";
      boxMid = rearLines;
    } else if (midCount) {
      row.querySelector(".f-c2").value = String(midCount);
      row.querySelector(".f-c3").value = "";
      boxMid = midLines;
    } else {
      row.querySelector(".f-c2").value = "";
      row.querySelector(".f-c3").value = "";
    }
    renderConsistUnits(row, { head: head, mid: boxMid, rear: boxRear }, true);
    if (head.length || midCount || rearCount) setConsistOpen(row, true, false);
    syncConsistHeritage(row);
    refreshSpecialHint(row);
    markEmpty(row);
    if (quiet) return;
    setView("entry");
    const consist = (fields && fields.consist) || (headCount ? headCount + "x" : "");
    showBanner(
      (bannerLead || "Filled ") + consist + ". Nothing is saved until you save the entry.",
      "ok"
    );
    const lead = row.querySelector(".lead-stack");
    if (lead) lead.scrollIntoView({ block: "center" });
  }

  const entryForm = document.getElementById("entry-form");
  if (entryForm) {
    let draftTimer = 0;
    const queueDraft = function () {
      clearTimeout(draftTimer);
      draftTimer = setTimeout(saveEntryDraft, 250);
    };
    entryForm.addEventListener("input", queueDraft);
    entryForm.addEventListener("change", queueDraft);
    entryForm.addEventListener("click", queueDraft);
  }
  window.addEventListener("pagehide", function () {
    flushLiveClips();
    saveEntryDraft();
  });
  document.addEventListener("click", function () {
    closeZoneMenus();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeZoneMenus();
  });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flushLiveClips();
  });
  window.addEventListener("pageshow", function (event) {
    if (!event.persisted) return;
    const openEntry = takeOpenEntry();
    let queued = false;
    try { queued = !!sessionStorage.getItem("rr-read-units-queue"); } catch (err) { queued = false; }
    if (!openEntry && !queued) return;
    if (openEntry) setView("entry");
    applyReadUnitQueue().then(saveEntryDraft, saveEntryDraft);
  });

  buildRows().then(function () {
    const openEntry = takeOpenEntry();
    setView(openEntry ? "entry" : currentView());
    restoreEntryDraft();
    restoreHeldClip();
    paintDayBoard();
    loadQuickSpotFavorites().then(function () { paintQuickSpots(); });
    return applyReadUnitQueue();
  }).then(function () {
    saveEntryDraft();
    noteQuickUnits();
    refreshPendingBadge();
    loadSpecialRoster();
    loadSpList();
  });

  // Footer utility sheet + ticker preference
  (function () {
    const foot = document.querySelector("footer.page-foot[data-foot]");
    const handle = foot && foot.querySelector(".foot-drawer-handle");
    const scrim = document.getElementById("foot-scrim");
    const railStatus = document.getElementById("foot-rail-status");
    function isField() {
      return document.documentElement.classList.contains("is-field");
    }
    function setOpen(open) {
      if (!foot) return;
      open = !!open;
      foot.classList.toggle("is-foot-open", open);
      document.documentElement.classList.toggle("foot-sheet-open", open && isField());
      if (handle) handle.setAttribute("aria-expanded", open ? "true" : "false");
      if (scrim) {
        if (open && isField()) scrim.removeAttribute("hidden");
        else scrim.setAttribute("hidden", "");
      }
      try {
        localStorage.setItem("rr-foot-open", open ? "1" : "0");
      } catch (e) {}
    }
    function closeSheet() {
      if (isField()) setOpen(false);
    }
    function paintRailStatus() {
      if (!railStatus) return;
      const badge = document.getElementById("sync-mac-badge");
      const syncBtn = document.getElementById("btn-sync-mac");
      const n = badge && !badge.hidden ? String(badge.textContent || "").trim() : "";
      const pending = n && n !== "0";
      if (pending) {
        railStatus.hidden = false;
        railStatus.textContent = n + (n === "1" ? " ready to sync" : " ready to sync");
      } else if (syncBtn && !syncBtn.hidden) {
        railStatus.hidden = false;
        railStatus.textContent = "Paired";
      } else {
        railStatus.hidden = true;
        railStatus.textContent = "";
      }
    }
    if (foot) {
      // Mac: tools always visible. Field: start collapsed (ignore sticky-open so trackside stays clean).
      let open = !isField();
      if (isField()) open = false;
      setOpen(open);
      if (handle) {
        handle.addEventListener("click", function () {
          setOpen(!foot.classList.contains("is-foot-open"));
        });
      }
      if (scrim) {
        scrim.addEventListener("click", closeSheet);
      }
      // Launching a tool from the sheet closes it so dialogs aren't buried.
      ["btn-appearance", "btn-sync-mac"].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.addEventListener("click", closeSheet);
      });
      const footSettings = document.getElementById("btn-foot-settings");
      if (footSettings) {
        footSettings.addEventListener("click", function () {
          closeSheet();
          if (window.trainLog && typeof window.trainLog.goSettings === "function") {
            window.trainLog.goSettings();
          } else {
            location.hash = "settings";
          }
        });
      }
      function clickOrFallback(id, href, filename) {
        const logBtn = document.getElementById(id);
        if (logBtn) {
          logBtn.click();
          return;
        }
        const a = document.createElement("a");
        a.href = href;
        a.download = filename || "";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      const footAirDrop = document.getElementById("btn-foot-airdrop");
      if (footAirDrop) {
        footAirDrop.addEventListener("click", function () {
          closeSheet();
          const dialog = document.getElementById("airdrop-format-dialog");
          if (!dialog || typeof dialog.showModal !== "function") {
            saveDownload("/api/export?format=json", "train-log.json");
            return;
          }
          if (dialog.open) dialog.close();
          dialog.returnValue = "cancel";
          dialog.showModal();
        });
      }
      const airdropFormat = document.getElementById("airdrop-format-dialog");
      if (airdropFormat && !airdropFormat._bound) {
        airdropFormat._bound = true;
        airdropFormat.addEventListener("close", function () {
          const fmt = airdropFormat.returnValue;
          if (fmt !== "json" && fmt !== "csv") return;
          saveDownload("/api/export?format=" + fmt, "train-log." + fmt);
        });
      }
      const footRecovery = document.getElementById("btn-foot-recovery");
      if (footRecovery) {
        footRecovery.addEventListener("click", function () {
          closeSheet();
          const stamp = new Date().toISOString().slice(0, 10);
          clickOrFallback(
            "btn-recovery-pack",
            "/api/database/recovery-pack",
            "TRAIN-LOG-recovery-" + stamp + ".zip"
          );
        });
      }
      const docs = foot.querySelector(".foot-docs");
      if (docs) docs.addEventListener("click", closeSheet);
    }
    document.querySelectorAll(".page-foot [data-press]").forEach(function (button) {
      button.addEventListener("click", function () {
        const id = button.getAttribute("data-press");
        const target = id && document.getElementById(id);
        if (target) target.click();
        if (id === "btn-gap-timer") closeSheet();
      });
    });
    const tickerBtn = document.getElementById("btn-foot-ticker");
    function paintTicker() {
      let on = true;
      try {
        on = localStorage.getItem("rr-ticker-on") !== "0";
      } catch (e) {}
      if (tickerBtn) tickerBtn.setAttribute("aria-pressed", on ? "true" : "false");
      ["last-train", "under-last-train"].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.classList.toggle("is-ticker-off", !on);
      });
      document.documentElement.classList.toggle("is-ticker-off", !on);
    }
    if (tickerBtn) {
      tickerBtn.addEventListener("click", function () {
        const on = tickerBtn.getAttribute("aria-pressed") !== "true";
        try {
          localStorage.setItem("rr-ticker-on", on ? "1" : "0");
        } catch (e) {}
        paintTicker();
      });
    }
    paintTicker();
    paintRailStatus();
    window.trainLogPaintFootRail = paintRailStatus;
    const syncBadge = document.getElementById("sync-mac-badge");
    if (syncBadge && window.MutationObserver) {
      new MutationObserver(paintRailStatus).observe(syncBadge, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true
      });
    }
  })();

    // Appearance dialog (theme, text size, Prefer Night, entry card tint)
  (function () {
    const dlg = document.getElementById("appearance-dialog");
    const btn = document.getElementById("btn-appearance");
    const night = document.getElementById("appearance-prefer-night");
    const padTint = document.getElementById("appearance-pad-tint");
    const padTintOpts = document.getElementById("appearance-pad-tint-opts");
    const padTintColor = document.getElementById("appearance-pad-tint-color");
    const PAD_TINT_KEY = "rr-pad-card-tint";
    const PAD_TINT_COLOR_KEY = "rr-pad-card-tint-color";
    const PRESET_HEX = {
      "#9a3412": 1,
      "#047857": 1,
      "#1d4ed8": 1,
      "#b45309": 1,
      "#0f766e": 1,
      "#b91c1c": 1,
      "#5b4b8a": 1,
      "#475569": 1,
    };

    function readPad() {
      try {
        return JSON.parse(localStorage.getItem("rr-pad-defaults") || "{}") || {};
      } catch (e) {
        return {};
      }
    }
    function writePad(data) {
      try {
        localStorage.setItem("rr-pad-defaults", JSON.stringify(data || {}));
      } catch (e) {}
    }
    function readPadTint() {
      try {
        const saved = localStorage.getItem(PAD_TINT_KEY);
        if (saved === "0" || saved === "1") return saved === "1";
      } catch (e) {}
      return true;
    }
    function normalizeTintColor(raw) {
      const value = String(raw || "").trim().toLowerCase();
      if (value === "accent") return "accent";
      if (/^#[0-9a-f]{6}$/.test(value)) return value;
      return "#9a3412";
    }
    function readPadTintColor() {
      try {
        const saved = localStorage.getItem(PAD_TINT_COLOR_KEY);
        if (saved == null || saved === "") return "#9a3412";
        return normalizeTintColor(saved);
      } catch (e) {
        return "#9a3412";
      }
    }
    function applyPadTintColor(color) {
      const chosen = normalizeTintColor(color);
      const root = document.documentElement;
      if (chosen === "accent") {
        root.setAttribute("data-pad-tint-mode", "accent");
        root.style.removeProperty("--pad-tint");
      } else {
        root.removeAttribute("data-pad-tint-mode");
        root.style.setProperty("--pad-tint", chosen);
      }
      try {
        localStorage.setItem(PAD_TINT_COLOR_KEY, chosen);
      } catch (e) {}
      if (padTintOpts) {
        padTintOpts.querySelectorAll("[data-pad-tint]").forEach(function (el) {
          const key = normalizeTintColor(el.getAttribute("data-pad-tint"));
          el.classList.toggle("is-on", key === chosen);
          el.setAttribute("aria-selected", key === chosen ? "true" : "false");
        });
      }
      if (padTintColor) {
        padTintColor.value = chosen === "accent" ? "#9a3412" : chosen;
        padTintColor.classList.toggle("is-on", chosen !== "accent" && !PRESET_HEX[chosen]);
      }
    }
    function applyPadTint(on) {
      document.documentElement.classList.toggle("pad-card-tint", !!on);
      try {
        localStorage.setItem(PAD_TINT_KEY, on ? "1" : "0");
      } catch (e) {}
      if (padTintOpts) padTintOpts.hidden = !on;
      if (on) applyPadTintColor(readPadTintColor());
      else {
        document.documentElement.removeAttribute("data-pad-tint-mode");
        document.documentElement.style.removeProperty("--pad-tint");
      }
    }
    function paintAppearance() {
      if (night) night.checked = Boolean(readPad().preferNight);
      if (padTint) padTint.checked = readPadTint();
      applyPadTintColor(readPadTintColor());
      if (padTintOpts) padTintOpts.hidden = !readPadTint();
    }
    if (btn && dlg) {
      btn.addEventListener("click", function () {
        paintAppearance();
        if (typeof dlg.showModal === "function") dlg.showModal();
        else dlg.setAttribute("open", "");
      });
    }
    if (night) {
      night.addEventListener("change", function () {
        const data = readPad();
        data.preferNight = !!night.checked;
        writePad(data);
        try {
          window.__TRAINLOG_APPEARANCE__ = Object.assign({}, window.__TRAINLOG_APPEARANCE__ || {}, {
            preferNight: !!data.preferNight,
          });
        } catch (e) {}
        try {
          fetch("/api/appearance", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              preferNight: !!data.preferNight,
              theme: data.preferNight
                ? "night"
                : (window.trainLogTheme && window.trainLogTheme.current && window.trainLogTheme.current()) || "paper",
            }),
          }).catch(function () {});
        } catch (e) {}
        if (data.preferNight) {
          if (window.trainLogTheme && typeof window.trainLogTheme.apply === "function") {
            window.trainLogTheme.apply("night");
          } else {
            const theme = document.getElementById("theme-select");
            if (theme && theme.value !== "night") {
              theme.value = "night";
              theme.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }
        }
      });
    }
    if (padTint) {
      padTint.addEventListener("change", function () {
        applyPadTint(!!padTint.checked);
      });
    }
    if (padTintOpts) {
      padTintOpts.addEventListener("click", function (event) {
        const swatch = event.target.closest("[data-pad-tint]");
        if (!swatch || !padTintOpts.contains(swatch)) return;
        applyPadTintColor(swatch.getAttribute("data-pad-tint"));
      });
    }
    if (padTintColor) {
      padTintColor.addEventListener("input", function () {
        applyPadTintColor(padTintColor.value);
      });
      padTintColor.addEventListener("change", function () {
        applyPadTintColor(padTintColor.value);
      });
    }
    applyPadTint(readPadTint());
    paintAppearance();
  })();

function bootPadDefaults() {
    document.querySelectorAll("#rows .train-row.is-empty").forEach(function (row) {
      applyPadDefaultsToRow(row);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootPadDefaults);
  else bootPadDefaults();
  // Prefer night once if saved (disk appearance covers port/origin changes on Mac).
  try {
    const disk = window.__TRAINLOG_APPEARANCE__ || {};
    const pad = JSON.parse(localStorage.getItem("rr-pad-defaults") || "{}");
    const preferNight = (pad && pad.preferNight) || !!disk.preferNight;
    if (preferNight) {
      if (window.trainLogTheme && typeof window.trainLogTheme.apply === "function") {
        window.trainLogTheme.apply("night");
      } else {
        const theme = document.getElementById("theme-select");
        if (theme && theme.value !== "night") {
          theme.value = "night";
          theme.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    } else if (disk.theme && window.trainLogTheme && typeof window.trainLogTheme.apply === "function") {
      const current = window.trainLogTheme.current && window.trainLogTheme.current();
      if (current !== disk.theme) window.trainLogTheme.apply(disk.theme);
    }
  } catch (e) {}

})();
