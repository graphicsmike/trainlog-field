(function () {
  "use strict";

  const importDialog = document.getElementById("lib-import-dialog");
  const ZONES = ["Eastern", "Central", "Mountain", "Arizona", "Pacific", "Alaska", "Hawaii", "Multiple"];
  const STATUS_TEXT = {
    listed: "From a list",
    verified: "Verified",
    check: "Check",
    "no AAR mark": "No AAR mark",
  };
  const EDIT_KEYS = ["name", "mark", "aliases", "group", "rr_class", "operation", "region", "states", "time_zone", "miles", "mark_status", "notes"];
  const views = [];

  function esc(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function banner(text, kind) {
    if (window.trainLog && window.trainLog.banner) window.trainLog.banner(text, kind);
  }

  async function call(path, options) {
    try {
      const response = await fetch(path, options);
      const data = await response.json().catch(function () {
        return {};
      });
      return { ok: response.ok && data.success !== false, data: data };
    } catch (err) {
      return { ok: false, data: { error: "Could not reach TRAIN LOG." } };
    }
  }

  function postJson(path, body) {
    return call(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function changed(from) {
    views.forEach(function (view) {
      if (view !== from) view.load();
    });
  }

  function stateCodes(row) {
    const text = row.states || "";
    if (/^multiple/i.test(text)) return ["Multiple"];
    return text.split(/\s*\/\s*/).filter(Boolean);
  }

  function fillSelect(el, label, values) {
    const current = el.value;
    el.innerHTML =
      '<option value="">' + esc(label) + "</option>" +
      values
        .map(function (value) {
          return '<option value="' + esc(value) + '">' + esc(value) + "</option>";
        })
        .join("");
    if (values.indexOf(current) !== -1) el.value = current;
  }

  function field(label, value, wide) {
    if (value === null || value === undefined || value === "") return "";
    return '<div' + (wide ? ' class="is-wide"' : "") + "><dt>" + esc(label) + "</dt><dd>" + esc(value) + "</dd></div>";
  }

  function milesText(value) {
    if (value === null || value === undefined || value === "") return "";
    var n = Number(value);
    if (!isFinite(n)) return "";
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " miles";
  }

  function options(values, current, blankLabel) {
    const list = values.slice();
    if (current && list.indexOf(current) === -1) list.push(current);
    return (
      (blankLabel !== undefined ? '<option value="">' + esc(blankLabel) + "</option>" : "") +
      list
        .map(function (value) {
          return '<option value="' + esc(value) + '"' + (value === current ? " selected" : "") + ">" + esc(value) + "</option>";
        })
        .join("")
    );
  }

  function makeLibrary(root) {
    const listEl = root.querySelector(".dash-lib-list");
    const detailEl = root.querySelector(".dash-lib-detail");
    const countEl = root.querySelector(".dash-lib-count");
    const searchEl = root.querySelector(".lib-search");
    const groupEl = root.querySelector(".lib-group");
    const regionEl = root.querySelector(".lib-region");
    const stateEl = root.querySelector(".lib-state");
    const ttEl = root.querySelector(".lib-tt-filter");
    const restoreBtn = root.querySelector(".lib-restore");
    const view = { load: load };
    let lib = null;
    let picked = "";
    let editing = null;
    let listScroll = 0;
    const collapsedGroups = {};

    function syncPhone() {
      const libEl = root.querySelector(".dash-lib");
      if (!libEl || !window.matchMedia) return;
      const on = window.matchMedia("(max-width: 700px)").matches && !!(picked || editing);
      libEl.classList.toggle("is-phone-detail", on);
      root.classList.toggle("is-phone-detail", on);
    }

    async function load() {
      const result = await call("/api/library");
      if (!result.ok) {
        listEl.innerHTML = '<p class="muted">Could not load the railroad library.</p>';
        return;
      }
      lib = result.data;
      fillFilters();
      render();
    }

    function fillFilters() {
      const rows = lib.rows;
      fillSelect(groupEl, "All Groups", lib.groups);
      const regions = lib.regions.slice();
      rows.forEach(function (row) {
        if (row.region && regions.indexOf(row.region) === -1) regions.push(row.region);
      });
      fillSelect(regionEl, "All Regions", regions);
      const states = {};
      rows.forEach(function (row) {
        stateCodes(row).forEach(function (code) {
          states[code] = true;
        });
      });
      fillSelect(
        stateEl,
        "All States",
        Object.keys(states).sort(function (a, b) {
          if (a === "Multiple") return 1;
          if (b === "Multiple") return -1;
          return a.localeCompare(b);
        })
      );
    }

    function shownRows() {
      const q = searchEl.value.trim().toLowerCase();
      return lib.rows.filter(function (row) {
        if (groupEl.value && row.group !== groupEl.value) return false;
        if (regionEl.value && row.region !== regionEl.value) return false;
        if (stateEl.value && stateCodes(row).indexOf(stateEl.value) === -1) return false;
        if (ttEl && ttEl.checked && !row.timetables) return false;
        if (!q) return true;
        return [row.name, row.mark, row.aliases, row.operation, row.states, row.rr_class, row.notes]
          .join(" ")
          .toLowerCase()
          .indexOf(q) !== -1;
      });
    }

    function render() {
      if (!lib) return;
      if (listEl.scrollTop > 0) listScroll = listEl.scrollTop;
      const rows = shownRows();
      countEl.textContent =
        rows.length === lib.rows.length
          ? lib.rows.length + " railroads"
          : rows.length + " of " + lib.rows.length + " railroads";
      if (restoreBtn) restoreBtn.disabled = !lib.custom;
      const extra = root.querySelector(".lib-extra");
      if (extra) {
        const n = lib.extra_count || 0;
        const phoneLib = root.id === "lib-dialog" && window.matchMedia("(max-width: 700px)").matches;
        extra.hidden = !lib.extra && !n;
        extra.textContent = lib.extra
          ? (phoneLib ? "Hide more" : "Hide More Railroads")
          : (phoneLib ? "More railroads" : "Add More Railroads") + (n ? " (" + n + ")" : "");
      }
      if (!rows.length) {
        listEl.innerHTML = '<p class="muted dash-lib-empty">No railroads match.</p>';
      } else {
        const groupCounts = {};
        const byGroup = [];
        rows.forEach(function (row) {
          const g = row.group || "Other";
          groupCounts[g] = (groupCounts[g] || 0) + 1;
          if (!byGroup.length || byGroup[byGroup.length - 1].name !== g) {
            byGroup.push({ name: g, rows: [] });
          }
          byGroup[byGroup.length - 1].rows.push(row);
        });
        listEl.innerHTML = byGroup
          .map(function (group) {
            const open = !collapsedGroups[group.name];
            const head =
              '<button type="button" class="dash-lib-group-head' + (open ? "" : " is-collapsed") +
              '" data-lib-group="' + esc(group.name) + '" aria-expanded="' + (open ? "true" : "false") + '">' +
              '<span class="dash-lib-group-caret" aria-hidden="true">▸</span>' +
              '<span class="dash-lib-group-label">' + esc(group.name) + "</span>" +
              '<span class="dash-lib-group-count">' + groupCounts[group.name] + "</span>" +
              "</button>";
            if (!open) return head;
            return (
              head +
              group.rows
                .map(function (row) {
                  const meta = [row.rr_class, row.states].filter(Boolean).join(" · ");
                  return (
                    '<button type="button" class="dash-lib-row' + (row.id === picked ? " is-picked" : "") +
                    '" role="option" aria-selected="' + (row.id === picked) + '" data-lib-id="' + esc(row.id) + '">' +
                    '<span class="dash-lib-mark">' + esc(row.mark || "—") + "</span>" +
                    '<span class="dash-lib-name">' + esc(row.name) + "</span>" +
                    '<span class="dash-lib-meta">' + esc(meta) + "</span>" +
                    '<span class="dash-lib-badges">' +
                    (row.timetables ? '<span class="dash-lib-badge is-tt" title="You have timetables for this railroad">TT</span>' : "") +
                    (row.mark_status === "check" ? '<span class="dash-lib-badge is-check" title="This mark still needs confirming">Check</span>' : "") +
                    (row.on_menu ? '<span class="dash-lib-badge is-menu" title="On the Railroad menu">Menu</span>' : "") +
                    "</span></button>"
                  );
                })
                .join("")
            );
          })
          .join("");
      }
      renderDetail();
      if (listScroll) listEl.scrollTop = listScroll;
    }

    function pickedRow() {
      if (!lib || !picked) return null;
      return (
        lib.rows.find(function (row) {
          return row.id === picked;
        }) || null
      );
    }

    function renderDetail() {
      if (editing) {
        renderEditor();
        return;
      }
      const row = pickedRow();
      if (!row) {
        detailEl.innerHTML =
          '<p class="muted dash-lib-hint">Pick a railroad on the left to see its details.</p>';
        syncPhone();
        return;
      }
      const miles = milesText(row.miles);
      detailEl.innerHTML =
        '<button type="button" class="dash-lib-back" data-lib-back>Back to the list</button>' +
        '<div class="dash-lib-detail-head">' +
        '<span class="dash-lib-detail-mark">' + esc(row.mark || "No mark") + "</span>" +
        "<h4>" + esc(row.name) + "</h4>" +
        "</div>" +
        '<dl class="dash-lib-fields">' +
        field("Group", row.group) +
        field("Class", row.rr_class) +
        field("Operation", row.operation) +
        field("Region", row.region) +
        field("States", row.states) +
        field("Time Zone", row.time_zone) +
        '<div class="dash-lib-mile-fact"><dt>Track Miles</dt><dd>' +
        (miles ? "<span>" + esc(miles) + "</span>" : "") +
        '<label class="dash-lib-tt" title="Tick when you have employee timetables (ETTs) for this railroad">' +
        '<input type="checkbox" data-lib-tt' + (row.timetables ? " checked" : "") + " /> Timetables</label></dd></div>" +
        field("Other Marks", row.aliases) +
        field("Mark Status", STATUS_TEXT[row.mark_status] || row.mark_status) +
        field("Notes", row.notes, true) +
        field("Source", row.custom ? "Added or edited on this Mac" : row.extra ? "More railroads list" : "Shipped with TRAIN LOG", true) +
        "</dl>" +
        '<div class="dash-lib-actions">' +
        '<button type="button" class="btn ghost" data-lib-edit>Edit</button>' +
        (row.on_menu
          ? '<button type="button" class="btn ghost" disabled>On Railroad Menu</button>'
          : '<button type="button" class="btn primary" data-lib-menu' + (row.mark ? "" : " disabled title=\"Give it a mark first\"") + ">Add to Railroad Menu</button>") +
        '<button type="button" class="btn ghost is-danger" data-lib-remove>Remove</button>' +
        "</div>";
      syncPhone();
    }

    function classOptions(group, current) {
      return options((lib.class_choices && lib.class_choices[group]) || [], current, "Not Set");
    }

    function renderEditor() {
      const row = editing.row;
      const statuses = lib.statuses.map(function (s) {
        return '<option value="' + esc(s) + '"' + (s === row.mark_status ? " selected" : "") + ">" + esc(STATUS_TEXT[s] || s) + "</option>";
      });
      detailEl.innerHTML =
        '<form class="dash-lib-form">' +
        '<button type="button" class="dash-lib-back" data-lib-back>Back to the list</button>' +
        "<h4>" + (editing.original ? "Edit " + esc(row.mark || row.name) : "Add a Railroad") + "</h4>" +
        '<div class="dash-lib-form-grid">' +
        '<label class="is-wide"><span>Railroad Name</span><input name="name" type="text" value="' + esc(row.name) + '" /></label>' +
        '<label><span>Reporting Mark</span><input name="mark" type="text" maxlength="12" value="' + esc(row.mark) + '" /></label>' +
        '<label><span>Other Marks</span><input name="aliases" type="text" value="' + esc(row.aliases) + '" /></label>' +
        '<label><span>Group</span><select name="group">' + options(lib.groups, row.group || "Freight") + "</select></label>" +
        '<label><span>Class</span><select name="rr_class">' + classOptions(row.group || "Freight", row.rr_class) + "</select></label>" +
        '<label class="is-wide"><span>Operation</span><input name="operation" type="text" value="' + esc(row.operation) + '" /></label>' +
        '<label><span>Region</span><select name="region">' + options(lib.regions, row.region, "Not Set") + "</select></label>" +
        '<label><span>States</span><input name="states" type="text" value="' + esc(row.states) + '" /></label>' +
        '<label><span>Time Zone</span><select name="time_zone">' + options(ZONES, row.time_zone, "From the States") + "</select></label>" +
        '<div class="dash-lib-mile-row">' +
        '<label><span>Track Miles</span><input name="miles" type="number" min="0" step="any" inputmode="decimal" value="' + esc(row.miles == null ? "" : row.miles) + '" /></label>' +
        '<label class="dash-lib-tt-edit"><input name="timetables" type="checkbox"' + (row.timetables ? " checked" : "") + " /> Timetables</label>" +
        "</div>" +
        '<label><span>Mark Status</span><select name="mark_status">' + statuses.join("") + "</select></label>" +
        '<label class="is-wide"><span>Notes</span><textarea name="notes" rows="2">' + esc(row.notes) + "</textarea></label>" +
        "</div>" +
        '<p class="muted dash-lib-form-note">States are two-letter codes split by a slash, like NM / CO. Leave Time Zone on From the States to fill it in from them.</p>' +
        '<div class="dash-lib-actions">' +
        '<button type="button" class="btn ghost" data-lib-cancel>Cancel</button>' +
        '<button type="submit" class="btn primary">Save</button>' +
        "</div></form>";
      const form = detailEl.querySelector(".dash-lib-form");
      form.elements.group.addEventListener("change", function () {
        form.elements.rr_class.innerHTML = classOptions(form.elements.group.value, "");
      });
      form.addEventListener("submit", saveEditor);
      form.elements.name.focus();
      syncPhone();
    }

    async function saveRow(row, original) {
      const result = await postJson("/api/library", { row: row, original: original });
      if (!result.ok) {
        banner((result.data && result.data.error) || "Could not save that railroad.", "error");
        return null;
      }
      return result.data.row;
    }

    async function saveEditor(event) {
      event.preventDefault();
      const form = event.target;
      const row = {};
      EDIT_KEYS.forEach(function (key) {
        row[key] = form.elements[key].value;
      });
      row.timetables = form.elements.timetables.checked ? "yes" : "";
      const saved = await saveRow(row, editing.original);
      if (!saved) return;
      banner("Saved " + (saved.mark || saved.name) + " in the railroad library.", "ok");
      editing = null;
      picked = saved.id;
      await load();
      changed(view);
      scrollPickedIntoView();
    }

    function scrollPickedIntoView() {
      const el = listEl.querySelector(".dash-lib-row.is-picked");
      if (el) el.scrollIntoView({ block: "nearest" });
    }

    listEl.addEventListener("click", function (event) {
      const head = event.target.closest("[data-lib-group]");
      if (head && listEl.contains(head)) {
        const group = head.getAttribute("data-lib-group");
        collapsedGroups[group] = !collapsedGroups[group];
        render();
        return;
      }
      const btn = event.target.closest("[data-lib-id]");
      if (!btn) return;
      picked = btn.getAttribute("data-lib-id");
      editing = null;
      const row = lib && lib.rows.find(function (item) { return item.id === picked; });
      if (row) collapsedGroups[row.group || "Other"] = false;
      render();
    });

    listEl.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const rows = Array.prototype.slice.call(listEl.querySelectorAll("[data-lib-id]"));
      const at = rows.indexOf(document.activeElement);
      if (at === -1) return;
      event.preventDefault();
      const next = rows[Math.max(0, Math.min(rows.length - 1, at + (event.key === "ArrowDown" ? 1 : -1)))];
      picked = next.getAttribute("data-lib-id");
      editing = null;
      const row = lib && lib.rows.find(function (item) { return item.id === picked; });
      if (row) collapsedGroups[row.group || "Other"] = false;
      render();
      const again = listEl.querySelector('[data-lib-id="' + CSS.escape(picked) + '"]');
      if (again) again.focus();
    });

    detailEl.addEventListener("change", async function (event) {
      const box = event.target.closest("[data-lib-tt]");
      const row = pickedRow();
      if (!box || !row) return;
      const saved = await saveRow(Object.assign({}, row, { timetables: box.checked ? "yes" : "" }), row.id);
      if (!saved) {
        box.checked = !box.checked;
        return;
      }
      banner((saved.mark || saved.name) + (saved.timetables ? " has timetables." : " has no timetables."), "ok");
      await load();
      changed(view);
    });

    detailEl.addEventListener("click", async function (event) {
      if (event.target.closest("[data-lib-back]")) {
        editing = null;
        picked = "";
        render();
        return;
      }
      const row = pickedRow();
      if (event.target.closest("[data-lib-cancel]")) {
        editing = null;
        renderDetail();
        return;
      }
      if (!row) return;
      if (event.target.closest("[data-lib-edit]")) {
        editing = { original: row.id, row: Object.assign({}, row) };
        renderDetail();
        return;
      }
      if (event.target.closest("[data-lib-menu]")) {
        const result = await postJson("/api/library/menu", { id: row.id });
        if (!result.ok) {
          banner((result.data && result.data.error) || "Could not add it to the Railroad menu.", "error");
          return;
        }
        banner(result.data.message, "ok");
        document.dispatchEvent(new CustomEvent("trainlog:catalog-reload"));
        await load();
        changed(view);
        return;
      }
      if (event.target.closest("[data-lib-remove]")) {
        const sure = await window.askConfirm({
          title: "Remove " + (row.mark || row.name) + " From the Library?",
          message: row.custom
            ? "It comes out of the library. Restore Shipped puts back the shipped list."
            : row.extra
              ? "It comes out of the more-railroads list on this Mac. Restore Shipped puts it back. The Railroad menu and your log are not changed."
              : "It comes out of the library on this Mac. Restore Shipped puts it back. The Railroad menu and your log are not changed.",
          details: [["Railroad", row.name]],
          ok: "Remove",
        });
        if (!sure) return;
        const result = await call("/api/library/" + encodeURIComponent(row.id), { method: "DELETE" });
        if (!result.ok) {
          banner((result.data && result.data.error) || "Could not remove it.", "error");
          return;
        }
        banner("Removed " + (row.mark || row.name) + " from the railroad library.", "ok");
        picked = "";
        await load();
        changed(view);
      }
    });

    [searchEl, groupEl, regionEl, stateEl, ttEl].forEach(function (el) {
      if (el) el.addEventListener(el === searchEl ? "input" : "change", render);
    });

    root.querySelector(".lib-add").addEventListener("click", function () {
      if (!lib) return;
      editing = {
        original: "",
        row: { name: "", mark: "", aliases: "", group: groupEl.value || "Freight", rr_class: "", operation: "", region: regionEl.value || "", states: "", time_zone: "", miles: null, mark_status: "check", notes: "", timetables: "" },
      };
      renderDetail();
    });

    const extraBtn = root.querySelector(".lib-extra");
    if (extraBtn) {
      extraBtn.addEventListener("click", async function () {
        if (!lib) return;
        const on = !lib.extra;
        const result = await postJson("/api/library/extra", { on: on });
        if (!result.ok) {
          banner((result.data && result.data.error) || "Could not change the extra railroad list.", "error");
          return;
        }
        banner(on ? "More railroads added." : "More railroads hidden.", "ok");
        editing = null;
        await load();
        changed(view);
      });
    }

    if (restoreBtn) {
      restoreBtn.addEventListener("click", async function () {
        const sure = await window.askConfirm({
          title: "Restore the Shipped Railroad Library?",
          message: "Railroads you added, edited, or removed here go back to the list as shipped, and More Railroads turns off. The Railroad menu and your log are not changed.",
          ok: "Restore Shipped",
        });
        if (!sure) return;
        const result = await postJson("/api/library/restore", {});
        if (!result.ok) {
          banner((result.data && result.data.error) || "Could not restore the library.", "error");
          return;
        }
        banner("Railroad library restored.", "ok");
        editing = null;
        await load();
        changed(view);
      });
    }

    const importOpen = root.querySelector(".lib-import-open");
    if (importOpen) importOpen.addEventListener("click", openImport);

    view.loaded = function () {
      return Boolean(lib);
    };
    if (window.matchMedia) {
      window.matchMedia("(max-width: 700px)").addEventListener("change", syncPhone);
    }
    views.push(view);
    return view;
  }

  const importText = document.getElementById("lib-import-text");
  const importFile = document.getElementById("lib-import-file");
  const importResult = document.getElementById("lib-import-result");

  function openImport() {
    importText.value = "";
    importFile.value = "";
    importResult.hidden = true;
    importResult.textContent = "";
    importDialog.showModal();
    importText.focus();
  }

  importFile.addEventListener("change", function () {
    const file = importFile.files && importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      importText.value = String(reader.result || "");
    };
    reader.readAsText(file);
  });

  document.getElementById("lib-import-go").addEventListener("click", async function () {
    const text = importText.value;
    if (!text.trim()) {
      importResult.hidden = false;
      importResult.textContent = "Paste a list or choose a file first.";
      return;
    }
    const result = await postJson("/api/library/import", {
      text: text,
      group: document.getElementById("lib-import-group").value,
    });
    importResult.hidden = false;
    if (!result.ok) {
      importResult.textContent = (result.data && result.data.error) || "Could not import that list.";
      return;
    }
    const data = result.data;
    const lines = [data.message];
    if (data.added.length) lines.push("Added: " + data.added.join(", "));
    if (data.filled.length) lines.push("Filled in: " + data.filled.join(", "));
    data.skipped.forEach(function (item) {
      lines.push("Skipped " + (item.name || "a row") + ": " + item.why);
    });
    importResult.textContent = lines.join("\n");
    changed(null);
  });

  const panel = document.getElementById("dash-lib-panel");
  const settingsView = panel ? makeLibrary(panel) : null;
  if (settingsView) settingsView.load();

  const dialog = document.getElementById("lib-dialog");
  const dialogView = dialog ? makeLibrary(dialog) : null;

  document.addEventListener("click", function (event) {
    const opener = event.target.closest && event.target.closest("[data-open-library]");
    if (!opener || !dialog) return;
    event.preventDefault();
    dialogView.load();
    dialog.showModal();
    const search = dialog.querySelector(".lib-search");
    if (search) search.focus();
  });

  document.addEventListener("trainlog:catalog-loaded", function () {
    views.forEach(function (view) {
      if (view.loaded()) view.load();
    });
  });
})();
