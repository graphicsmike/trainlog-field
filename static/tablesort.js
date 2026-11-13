(function () {
  "use strict";

  const TABLES = "table.log-table:not(.dash-table), table.day-table";
  const state = {};
  let queued = false;

  function eligible(table) {
    return !table.closest("#view-log") && !table.closest(".act-changes");
  }

  function tableKey(table) {
    const body = table.querySelector("tbody[id]");
    if (body) return body.id;
    const host = table.closest("[id]");
    return host ? host.id : "";
  }

  function markHeaders(table) {
    const key = tableKey(table);
    const sort = state[key];
    const head = table.tHead && table.tHead.rows[0];
    if (!head) return;
    Array.prototype.forEach.call(head.cells, function (th, index) {
      if (!th.hasAttribute("data-tsort")) {
        if (!th.textContent.trim() || th.querySelector("input, select, button")) return;
        th.setAttribute("data-tsort", "");
        th.title = th.title || "Sort";
      }
      const on = sort && sort.col === index;
      th.classList.toggle("is-sort-asc", !!on && sort.dir > 0);
      th.classList.toggle("is-sort-desc", !!on && sort.dir < 0);
    });
  }

  function cellValue(cell) {
    if (!cell) return "";
    if (cell.hasAttribute("data-sort-value")) return cell.getAttribute("data-sort-value");
    const field = cell.querySelector("input:not([type=checkbox]), select, textarea");
    if (field) return field.value.trim();
    return cell.textContent.trim();
  }

  function compare(a, b) {
    if (a === b) return 0;
    const na = Number(a.replace(/,/g, ""));
    const nb = Number(b.replace(/,/g, ""));
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  }

  function groups(body) {
    const out = [];
    Array.prototype.forEach.call(body.rows, function (row) {
      if (row.classList.contains("activity-detail") && out.length) out[out.length - 1].push(row);
      else out.push([row]);
    });
    return out;
  }

  function sortTable(table) {
    const sort = state[tableKey(table)];
    const body = table.tBodies[0];
    if (!sort || !body) return;
    const current = groups(body);
    const sorted = current
      .map(function (group, index) {
        return { group: group, index: index, value: cellValue(group[0].cells[sort.col]) };
      })
      .sort(function (x, y) {
        const blankX = x.value === "";
        const blankY = y.value === "";
        if (blankX !== blankY) return blankX ? 1 : -1;
        return compare(x.value, y.value) * sort.dir || x.index - y.index;
      });
    const same = sorted.every(function (item, index) {
      return item.index === index;
    });
    if (same) return;
    const frag = document.createDocumentFragment();
    sorted.forEach(function (item) {
      item.group.forEach(function (row) {
        frag.appendChild(row);
      });
    });
    body.appendChild(frag);
  }

  function refresh() {
    queued = false;
    Array.prototype.forEach.call(document.querySelectorAll(TABLES), function (table) {
      if (!eligible(table)) return;
      markHeaders(table);
      sortTable(table);
    });
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(refresh);
  }

  document.addEventListener("click", function (event) {
    const th = event.target.closest("th[data-tsort]");
    if (!th) return;
    const table = th.closest("table");
    if (!table || !eligible(table)) return;
    const key = tableKey(table);
    const col = Array.prototype.indexOf.call(th.parentNode.children, th);
    const prev = state[key];
    state[key] = { col: col, dir: prev && prev.col === col ? -prev.dir : 1 };
    markHeaders(table);
    sortTable(table);
  });

  new MutationObserver(queue).observe(document.body, { childList: true, subtree: true });
  queue();
})();
