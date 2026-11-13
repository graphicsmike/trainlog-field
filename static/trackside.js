(function () {
  "use strict";

  // iPhone and iPad: the Dashboard's Log Stats pane becomes a short summary of one day or one trip out trackside.
  if (!window.trainLogField) return;

  const pane = document.getElementById("dash-pane-log");
  const view = document.getElementById("view-dashboard");
  if (!pane || !view) return;

  const SCOPE_KEY = "rr-trackside-scope";
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const tab = document.querySelector('.dash-tabs .tab[data-dash-pane="log"]');
  if (tab) tab.textContent = "Trackside";

  const root = document.createElement("section");
  root.id = "dash-trackside";
  root.className = "trackside";
  root.setAttribute("aria-label", "Trackside summary");
  root.innerHTML =
    '<div class="trackside-scope">' +
    '<div class="trackside-seg" role="group" aria-label="Show">' +
    '<button type="button" class="seg" data-trackside-scope="day">Day</button>' +
    '<button type="button" class="seg" data-trackside-scope="trip">Trip</button>' +
    "</div>" +
    '<select id="trackside-pick" aria-label="Which day or trip"></select>' +
    "</div>" +
    '<div id="trackside-body" class="trackside-body"></div>';
  // Sit under the Log KPI tiles so the full-size rail stays on top.
  const logTop = pane.querySelector(".dash-log-top");
  if (logTop && logTop.nextSibling) pane.insertBefore(root, logTop.nextSibling);
  else if (logTop) pane.appendChild(root);
  else pane.insertBefore(root, pane.firstChild);

  const pick = root.querySelector("#trackside-pick");
  const body = root.querySelector("#trackside-body");
  let entries = [];
  let scope = localStorage.getItem(SCOPE_KEY) === "trip" ? "trip" : "day";
  let chosen = { day: "", trip: "" };

  function esc(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function todayIso() {
    const now = new Date();
    return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  }

  function dayLabel(iso, withYear) {
    const parts = String(iso || "").split("-").map(Number);
    if (parts.length !== 3 || !parts[0]) return iso || "";
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    let text = DAYS[date.getDay()] + ", " + MONTHS[date.getMonth()] + " " + date.getDate();
    if (withYear) text += ", " + date.getFullYear();
    return text;
  }

  function minutes(time) {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(time || ""));
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  }

  function clock(total) {
    if (total == null) return "";
    const h = Math.floor(total / 60);
    const m = total % 60;
    return (h % 12 || 12) + ":" + String(m).padStart(2, "0") + " " + (h < 12 ? "AM" : "PM");
  }

  function span(total) {
    if (total < 60) return total + " min";
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h + " hr" + (m ? " " + m + " min" : "");
  }

  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }

  function sortEntries(list) {
    return list.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      const ta = minutes(a.time);
      const tb = minutes(b.time);
      if (ta !== tb) return (ta == null ? -1 : ta) - (tb == null ? -1 : tb);
      return (a.id || 0) - (b.id || 0);
    });
  }

  function count(list, keyFn) {
    const map = new Map();
    list.forEach(function (entry) {
      [].concat(keyFn(entry)).forEach(function (key) {
        if (!key) return;
        map.set(key, (map.get(key) || 0) + 1);
      });
    });
    return Array.from(map.entries()).sort(function (a, b) {
      return b[1] - a[1] || (a[0] < b[0] ? -1 : 1);
    });
  }

  function days() {
    return count(entries, function (e) {
      return e.date;
    }).sort(function (a, b) {
      return a[0] < b[0] ? 1 : -1;
    });
  }

  function trips() {
    const map = new Map();
    entries.forEach(function (e) {
      if (!e.trip_name) return;
      const item = map.get(e.trip_name) || { name: e.trip_name, count: 0, last: "" };
      item.count += 1;
      if (e.date > item.last) item.last = e.date;
      map.set(e.trip_name, item);
    });
    return Array.from(map.values()).sort(function (a, b) {
      return a.last < b.last ? 1 : a.last > b.last ? -1 : a.name < b.name ? -1 : 1;
    });
  }

  function fillPick() {
    const today = todayIso();
    let options = [];
    if (scope === "day") {
      options = days().map(function (row) {
        return { value: row[0], label: (row[0] === today ? "Today, " : "") + dayLabel(row[0], row[0].slice(0, 4) !== today.slice(0, 4)) + " (" + row[1] + ")" };
      });
      if (!options.some(function (o) { return o.value === today; })) options.unshift({ value: today, label: "Today, " + dayLabel(today) + " (0)" });
    } else {
      options = trips().map(function (trip) {
        return { value: trip.name, label: trip.name + " (" + trip.count + ")" };
      });
    }
    const values = options.map(function (o) { return o.value; });
    let value = chosen[scope];
    if (values.indexOf(value) === -1) {
      if (scope === "day") {
        value = days().some(function (row) { return row[0] === today; }) || !days().length ? today : days()[0][0];
      } else {
        value = values[0] || "";
      }
    }
    chosen[scope] = value;
    pick.innerHTML = options.length
      ? options.map(function (o) {
          return '<option value="' + esc(o.value) + '"' + (o.value === value ? " selected" : "") + ">" + esc(o.label) + "</option>";
        }).join("")
      : '<option value="">No trips yet</option>';
    pick.disabled = !options.length;
  }

  function listCard(title, rows, limit) {
    if (!rows.length) return "";
    const shown = rows.slice(0, limit || rows.length);
    const top = shown[0][1] || 1;
    let html = '<div class="trackside-card"><h3>' + esc(title) + '</h3><ul class="trackside-list">';
    shown.forEach(function (row) {
      html +=
        '<li><span class="trackside-name">' + esc(row[0]) + '</span><b>' + row[1] + "</b>" +
        '<i style="width:' + Math.max(4, Math.round((row[1] / top) * 100)) + '%"></i></li>';
    });
    html += "</ul>";
    if (rows.length > shown.length) html += '<p class="trackside-more">and ' + plural(rows.length - shown.length, "more") + "</p>";
    return html + "</div>";
  }


  function render() {
    fillPick();
    root.querySelectorAll("[data-trackside-scope]").forEach(function (button) {
      const on = button.getAttribute("data-trackside-scope") === scope;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const value = chosen[scope];
    const today = todayIso();
    const list = sortEntries(
      entries.filter(function (e) {
        return scope === "day" ? e.date === value : value && e.trip_name === value;
      })
    );
    if (!entries.length) {
      body.innerHTML = '<p class="trackside-empty">No trains logged yet. Log one on New Entry and it shows up here.</p>';
      return;
    }
    if (scope === "trip" && !value) {
      body.innerHTML = '<p class="trackside-empty">No trips yet. Type a Trip name at the top of New Entry and each train you log joins it.</p>';
      return;
    }
    if (!list.length) {
      body.innerHTML = '<p class="trackside-empty">No trains logged ' + (value === today ? "today" : "on " + esc(dayLabel(value))) + " yet.</p>";
      return;
    }

    const times = list.map(function (e) { return minutes(e.time); }).filter(function (t) { return t != null; });
    const dates = Array.from(new Set(list.map(function (e) { return e.date; }))).sort();
    let sub = "";
    if (scope === "day" && times.length) {
      const first = Math.min.apply(null, times);
      const last = Math.max.apply(null, times);
      sub = clock(first) + (last > first ? " to " + clock(last) + " · " + span(last - first) : "");
      if (last - first >= 30) sub += " · " + (list.length / ((last - first) / 60)).toFixed(1) + " an hour";
    } else if (scope === "trip") {
      sub = dayLabel(dates[0]) + (dates.length > 1 ? " to " + dayLabel(dates[dates.length - 1]) : "") + " · " + plural(dates.length, "day");
    }

    const photos = list.filter(function (e) { return e.photographed; }).length;
    const videos = list.filter(function (e) { return e.videoed; }).length;
    const night = list.filter(function (e) { return e.night; }).length;
    const special = list.filter(function (e) {
      const sp = e.special_power || {};
      return (sp.heritage && sp.heritage.length) || (sp.steam && sp.steam.length);
    }).length;

    let html =
      '<div class="trackside-card trackside-head">' +
      '<p class="trackside-count"><b>' + list.length + "</b> " + (list.length === 1 ? "train" : "trains") + "</p>" +
      (sub ? '<p class="trackside-sub">' + esc(sub) + "</p>" : "") +
      "</div>" +
      listCard("Railroads", count(list, function (e) { return e.railroad; })) +
      listCard("Train Types", count(list, function (e) { return e.train_types || []; })) +
      listCard("Where", count(list, function (e) { return e.location_spot; }), 6);

    const extras = [];
    if (photos) extras.push(plural(photos, "photo"));
    if (videos) extras.push(plural(videos, "video"));
    if (night) extras.push(night + " at night");
    if (special) extras.push(special + " with heritage or steam");
    if (extras.length) html += '<div class="trackside-card"><h3>Media and Special Power</h3><p class="trackside-extras">' + esc(extras.join(" · ")) + "</p></div>";
    body.innerHTML = html;
  }

  let loading = null;
  async function refresh() {
    if (loading) return loading;
    loading = (async function () {
      try {
        const response = await fetch("/api/entries");
        const data = response.ok ? await response.json() : [];
        entries = Array.isArray(data) ? data : [];
      } catch (err) {
        entries = [];
      }
      render();
    })();
    try {
      await loading;
    } finally {
      loading = null;
    }
  }

  root.addEventListener("click", function (event) {
    const button = event.target.closest("[data-trackside-scope]");
    if (!button) return;
    scope = button.getAttribute("data-trackside-scope");
    localStorage.setItem(SCOPE_KEY, scope);
    render();
  });
  pick.addEventListener("change", function () {
    chosen[scope] = pick.value;
    render();
  });

  function visible() {
    return view.classList.contains("is-active") && pane.classList.contains("is-active");
  }
  new MutationObserver(function () {
    if (visible()) refresh();
  }).observe(view, { attributes: true, attributeFilter: ["class"] });
  new MutationObserver(function () {
    if (visible()) refresh();
  }).observe(pane, { attributes: true, attributeFilter: ["class"] });
  ["trainlog:entry-saved", "trainlog:entries-changed"].forEach(function (name) {
    document.addEventListener(name, refresh);
  });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && visible()) refresh();
  });
  refresh();
})();
