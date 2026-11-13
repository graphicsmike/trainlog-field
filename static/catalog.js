(function () {
  const kpisEl = document.getElementById("dash-kpis");
  if (!kpisEl) return;

  const ENTRY_ID_TITLE =
    "Sighting number. Each train keeps its number for good, and numbers from deleted trains are never reused, so gaps are normal.";

  const roadsEl = document.getElementById("dash-roads");
  const logKpisEl = document.getElementById("dash-log-kpis");
  const logRoadsEl = document.getElementById("dash-log-roads");
  const logTypesEl = document.getElementById("dash-log-types");
  const logListsEl = document.getElementById("dash-log-lists");
  const logEmptyEl = document.getElementById("dash-log-empty");
  const logToolsEl = document.getElementById("dash-log-tools");
  const logRrSortEl = document.getElementById("dash-log-rr-sort");
  const logTypeRrEl = document.getElementById("dash-log-type-rr");
  const logListSortEl = document.getElementById("dash-log-list-sort");
  const logListTopEl = document.getElementById("dash-log-list-top");
  const logChartExportEl = document.getElementById("dash-log-chart-export");
  const logMoreStatsEl = document.getElementById("dash-log-more-stats");
  const logMoreStatsDialog = document.getElementById("dash-more-stats");
  const logMoreStatsBody = document.getElementById("dash-more-stats-body");
  const logMoreStatsPick = document.getElementById("dash-more-stats-pick");
  const logExportDialog = document.getElementById("dash-export-graph");
  const logExportStatus = document.getElementById("dash-export-status");
  const logExportSvgBtn = document.getElementById("dash-export-svg");
  const logExportPreview = document.getElementById("dash-export-preview");
  const logExportPdfBtn = document.getElementById("dash-export-pdf");
  const logExportPicksEl = document.getElementById("dash-export-picks");
  const logFromEl = document.getElementById("dash-log-from");
  const logToEl = document.getElementById("dash-log-to");
  const logDatesResetEl = document.getElementById("dash-log-dates-reset");
  const logTripEl = document.getElementById("dash-log-trip");
  const logTripSortEl = document.getElementById("dash-log-trip-sort");
  const subBody = document.getElementById("dash-sub-body");
  const searchEl = document.getElementById("dash-sub-search");
  const filterEl = document.getElementById("dash-sub-rr");
  const rrGroupsEl = document.getElementById("dash-rr-groups");
  const typesEl = document.getElementById("dash-types");
  const editor = document.getElementById("sub-editor");
  let catalog = null;
  let logRrSort = "count";
  let logListSort = "count";
  let logTypeRr = "";
  let logTypeChart = "bars";
  let logDateFrom = "";
  let logDateTo = "";
  let logTrip = "";
  let logTripSort = "name";
  let listTop = 6;
  function clampListTop(raw) {
    const n = parseInt(raw, 10);
    return n >= 1 && n <= 25 ? n : 6;
  }
  const LIST_CHART_KEYS = ["locations", "subdivisions", "leads", "consists"];
  let extraSlots = [];
  try {
    const savedExtra = JSON.parse(localStorage.getItem("rr-log-extra-slots") || "[]");
    if (Array.isArray(savedExtra)) {
      extraSlots = savedExtra.filter(function (slot, i, all) {
        return /^chart-\d+$/.test(slot) && all.indexOf(slot) === i;
      });
    }
  } catch (e) {}
  function listSlots() {
    return LIST_CHART_KEYS.concat(extraSlots);
  }
  function boardSlots() {
    return ["types"].concat(listSlots());
  }
  function boardCardIds() {
    return ["types", "roads"].concat(listSlots());
  }
  const DEFAULT_BOARD_ORDER = ["roads", "leads", "consists", "types", "locations", "subdivisions"];
  let boardOrder = DEFAULT_BOARD_ORDER.slice();
  function cleanBoardOrder(list) {
    const ids = boardCardIds();
    const out = (Array.isArray(list) ? list : []).filter(function (card, i, all) {
      return ids.indexOf(card) !== -1 && all.indexOf(card) === i;
    });
    ids.forEach(function (card) {
      if (out.indexOf(card) === -1) out.push(card);
    });
    return ["roads"].concat(
      out.filter(function (card) {
        return card !== "roads";
      })
    );
  }
  try {
    const savedLayout = localStorage.getItem("rr-log-layout");
    localStorage.removeItem("rr-log-layout");
    const savedOrder = JSON.parse(localStorage.getItem("rr-log-board-order") || "null");
    boardOrder = cleanBoardOrder(savedLayout && savedLayout !== "custom" ? DEFAULT_BOARD_ORDER : savedOrder || DEFAULT_BOARD_ORDER);
  } catch (e) {
    boardOrder = cleanBoardOrder(DEFAULT_BOARD_ORDER);
  }
  try {
    listTop = clampListTop(localStorage.getItem("rr-log-list-top"));
  } catch (e) {}
  try {
    const savedTrip = localStorage.getItem("rr-log-trip");
    if (savedTrip) logTrip = savedTrip;
  } catch (e) {}
  try {
    if (localStorage.getItem("rr-log-trip-sort") === "date") logTripSort = "date";
  } catch (e) {}
  const RR_TYPE_TOP = 6;
  const listCharts = {};
  const TYPE_COLORS = [
    "#ef4444",
    "#3b82f6",
    "#eab308",
    "#22c55e",
    "#a855f7",
    "#f97316",
    "#06b6d4",
    "#ec4899",
    "#84cc16",
    "#64748b",
    "#14b8a6",
    "#f43f5e",
  ];
  function readChartMode(key) {
    try {
      const saved = localStorage.getItem(key);
      if (saved === "donut" || saved === "columns" || saved === "bars" || saved === "tiles") {
        return saved;
      }
    } catch (e) {}
    return "bars";
  }
  logTypeChart = readChartMode("rr-log-type-chart");
  listSlots().forEach(function (kind) {
    listCharts[kind] = readChartMode("rr-log-list-chart-" + kind);
  });
  const SOURCE_META = [
    { id: "types", group: "Trains", title: "Train Types", key: "type" },
    { id: "railroads", group: "Trains", title: "Railroads", key: "railroad" },
    { id: "roadcards", group: "Trains", title: "Railroad Cards", key: "railroad", cards: true },
    { id: "rrclass", group: "Trains", title: "Railroad Class", key: "class" },
    { id: "rrgroup", group: "Trains", title: "Freight / Passenger / Tourist", key: "group", keepOrder: true },
    { id: "rrregion", group: "Where", title: "Railroad Region", key: "region", keepOrder: true },
    { id: "rroperation", group: "Trains", title: "Operation", key: "operation" },
    { id: "contrade", group: "Trains", title: "Container Trade", key: "trade", keepOrder: true },
    { id: "leadstatus", group: "Power", title: "Lead Loco Status", key: "status" },
    { id: "trainstatus", group: "Trains", title: "Stopped, Siding, Crew", key: "status" },
    { id: "directions", group: "Trains", title: "Direction", key: "direction", keepOrder: true },
    { id: "cars", group: "Trains", title: "Train Length", key: "cars", keepOrder: true },
    { id: "passenger", group: "Trains", title: "Passenger Trains by Number", key: "train" },
    { id: "symbols", group: "Symbols", title: "Train Symbols", key: "symbol" },
    { id: "symbolseries", group: "Symbols", title: "Symbol Series", key: "series" },
    { id: "symbollanes", group: "Symbols", title: "Symbol Lanes", key: "lane" },
    { id: "symbolorigins", group: "Symbols", title: "Symbol Origins", key: "origin" },
    { id: "symboldests", group: "Symbols", title: "Symbol Destinations", key: "destination" },
    { id: "symbolroads", group: "Symbols", title: "Symbols by Railroad", key: "railroad" },
    { id: "symbolcheck", group: "Symbols", title: "Symbols in the Reference", key: "name" },
    { id: "heritageunits", group: "Special Power", title: "Heritage Units", key: "unit" },
    { id: "heritageschemes", group: "Special Power", title: "Heritage Schemes", key: "scheme" },
    { id: "heritagepositions", group: "Special Power", title: "Heritage Unit Position", key: "position", keepOrder: true },
    { id: "heritageroads", group: "Special Power", title: "Heritage Units by Railroad", key: "railroad" },
    { id: "steamengines", group: "Special Power", title: "Steam Engines", key: "engine" },
    { id: "steamwheels", group: "Special Power", title: "Wheel Arrangements", key: "wheels" },
    { id: "steamstates", group: "Special Power", title: "Steam Sightings by State", key: "state" },
    { id: "steamruns", group: "Special Power", title: "Steam Doubleheaders and Assists", key: "name", keepOrder: true },
    { id: "assistdiesels", group: "Special Power", title: "Steam Assist Diesels", key: "unit" },
    { id: "consistunits", group: "Power", title: "Trailing and DP Units", key: "unit" },
    { id: "loads", group: "Trains", title: "Loads / Empties", key: "status" },
    { id: "locations", group: "Where", title: "Locations", key: "location" },
    { id: "subdivisions", group: "Where", title: "Subdivisions", key: "subdivision" },
    { id: "states", group: "Where", title: "States", key: "state" },
    { id: "zones", group: "Where", title: "Time Zones", key: "zone" },
    { id: "trips", group: "Where", title: "Trips", key: "trip" },
    { id: "hours", group: "When", title: "Hour of Day", key: "hour", keepOrder: true },
    { id: "dayparts", group: "When", title: "Time of Day", key: "part", keepOrder: true },
    { id: "ampm", group: "When", title: "AM / PM", key: "period", keepOrder: true },
    { id: "weekdays", group: "When", title: "Day of Week", key: "day", keepOrder: true },
    { id: "months", group: "When", title: "Month", key: "month", keepOrder: true },
    { id: "seasons", group: "When", title: "Season", key: "season", keepOrder: true },
    { id: "years", group: "When", title: "Year", key: "year", keepOrder: true },
    { id: "busiest", group: "When", title: "Busiest Days", key: "day", total: true },
    { id: "dates", group: "When", title: "Trains by Date", key: "day", keepOrder: true, recent: true, chart: "columns" },
    { id: "monthline", group: "When", title: "Trains by Month", key: "month", keepOrder: true, chart: "columns" },
    { id: "waits", group: "When", title: "Wait Between Trains", key: "gap", keepOrder: true },
    { id: "leads", group: "Power", title: "Lead Locos", key: "lead" },
    { id: "consists", group: "Power", title: "Consist", key: "consist" },
    { id: "units", group: "Power", title: "Units on the Head End", key: "units", keepOrder: true },
    { id: "dp", group: "Power", title: "Helpers / DP", key: "name" },
    { id: "leadpower", group: "Power", title: "Home vs Foreign Power", key: "name" },
    { id: "leadmarks", group: "Power", title: "Lead Loco Railroads", key: "mark" },
    { id: "newleads", group: "Power", title: "New Lead Locos by Month", key: "month", keepOrder: true },
    { id: "media", group: "Media", title: "Photo / Video / Notes", key: "name", total: true },
  ];
  const DRILLABLE = new Set(
    SOURCE_META.map(function (meta) {
      return meta.id;
    }).concat(["leadrepeats", "meets"])
  );
  const MORE_DRILL = {
    morelocations: "locations",
    moresubdivisions: "subdivisions",
    morerailroads: "railroads",
    moretypes: "types",
    moreleads: "leads",
    moreconsists: "consists",
    gaps: "waits",
  };
  function drillKind(kind) {
    return MORE_DRILL[kind] || kind;
  }
  const slotSource = {};
  boardSlots().forEach(function (slot) {
    let saved = "";
    try {
      saved = localStorage.getItem("rr-log-source-" + slot) || "";
      if (!saved && slot === "types" && localStorage.getItem("rr-log-type-set") === "railroads") saved = "railroads";
    } catch (e) {}
    slotSource[slot] = sourceMeta(saved) ? saved : sourceMeta(slot) ? slot : "types";
  });

  function shownSources() {
    return boardSlots().map(function (slot) {
      return slotSource[slot];
    });
  }

  function saveExtraSlots() {
    try {
      localStorage.setItem("rr-log-extra-slots", JSON.stringify(extraSlots));
    } catch (e) {}
  }

  function addChartCard(sourceId) {
    if (!sourceMeta(sourceId)) return "";
    let n = 1;
    while (extraSlots.indexOf("chart-" + n) !== -1) n += 1;
    const slot = "chart-" + n;
    extraSlots.push(slot);
    slotSource[slot] = sourceId;
    listCharts[slot] = sourceMeta(sourceId).chart || "bars";
    exportPicks[slot] = true;
    try {
      localStorage.setItem("rr-log-source-" + slot, sourceId);
      if (sourceMeta(sourceId).chart) localStorage.setItem("rr-log-list-chart-" + slot, listCharts[slot]);
      else localStorage.removeItem("rr-log-list-chart-" + slot);
    } catch (e) {}
    return slot;
  }

  function dropChartCard(slot) {
    const at = extraSlots.indexOf(slot);
    if (at === -1) return;
    extraSlots.splice(at, 1);
    delete slotSource[slot];
    delete listCharts[slot];
    delete exportPicks[slot];
    try {
      localStorage.removeItem("rr-log-source-" + slot);
      localStorage.removeItem("rr-log-list-chart-" + slot);
    } catch (e) {}
  }
  function sourceMeta(id) {
    return SOURCE_META.filter(function (meta) {
      return meta.id === id;
    })[0] || null;
  }
  const MORE_CHART_KEYS = [
    "zones", "hours", "weekdays", "months", "years", "busiest", "units", "dp", "loads", "media", "ampm", "trips",
    "dayparts", "seasons", "states", "directions", "cars", "symbols", "passenger", "leadpower", "leadmarks",
    "symbolseries", "symbollanes", "symbolorigins", "symboldests", "symbolroads", "symbolcheck",
    "heritageunits", "heritageschemes", "heritagepositions", "heritageroads",
    "steamengines", "steamwheels", "steamstates", "steamruns", "assistdiesels", "consistunits", "gaps", "leadrepeats",
    "nightflag", "coalmarks",
    "morelocations", "moresubdivisions", "morerailroads", "moretypes", "moreleads", "moreconsists",
  ];
  const moreCharts = {};
  MORE_CHART_KEYS.forEach(function (kind) {
    moreCharts[kind] = readChartMode("rr-more-chart-" + kind);
  });
  const EXPORT_SECTIONS = [
    { group: "Log Stats", items: [
      ["totals", "Totals"],
      ["types", "Train Types / Railroads Chart"],
      ["railroads", "Railroad Cards"],
      ["locations", "Locations"],
      ["subdivisions", "Subdivisions"],
      ["leads", "Lead Locos"],
      ["consists", "Consist"],
    ] },
    { group: "More Stats", items: [
      ["glance", "At a Glance"],
      ["hours", "Hour of Day"],
      ["dayparts", "Time of Day"],
      ["ampm", "AM / PM"],
      ["weekdays", "Day of Week"],
      ["months", "Month"],
      ["seasons", "Season"],
      ["years", "Year"],
      ["busiest", "Busiest Days"],
      ["states", "States"],
      ["zones", "Time Zones"],
      ["trips", "Trips"],
      ["directions", "Direction"],
      ["cars", "Train Length"],
      ["symbols", "Train Symbols"],
      ["symbolseries", "Symbol Series"],
      ["symbollanes", "Symbol Lanes"],
      ["symbolorigins", "Symbol Origins"],
      ["symboldests", "Symbol Destinations"],
      ["symbolroads", "Symbols by Railroad"],
      ["symbolcheck", "Symbols in the Reference"],
      ["heritageunits", "Heritage Units"],
      ["heritageschemes", "Heritage Schemes"],
      ["heritagepositions", "Heritage Unit Position"],
      ["heritageroads", "Heritage Units by Railroad"],
      ["steamengines", "Steam Engines"],
      ["steamwheels", "Wheel Arrangements"],
      ["steamstates", "Steam Sightings by State"],
      ["steamruns", "Steam Doubleheaders and Assists"],
      ["assistdiesels", "Steam Assist Diesels"],
      ["passenger", "Passenger Trains by Number"],
      ["loads", "Loads / Empties"],
      ["units", "Units on the Head End"],
      ["dp", "Helpers / DP"],
      ["consistunits", "Trailing and DP Units"],
      ["leadpower", "Home vs Foreign Power"],
      ["leadmarks", "Lead Loco Railroads"],
      ["leadrepeats", "Repeat Lead Locos"],
      ["gaps", "Gaps Between Trains"],
      ["media", "Photo / Video / Notes"],
      ["mediarate", "Media Capture Rate"],
      ["nightflag", "Night Flag"],
      ["coalmarks", "Coal Marks"],
      ["huntlist", "Hunt List"],
      ["firsts", "Firsts by Month"],
    ] },
  ];
  const EXPORT_DEFAULT = ["totals", "types", "railroads", "locations", "subdivisions", "leads", "consists"];
  let exportPicks = {};
  (function () {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem("rr-export-sections") || "null");
    } catch (e) {}
    (Array.isArray(saved) ? saved : EXPORT_DEFAULT).forEach(function (key) {
      exportPicks[key] = true;
    });
  })();
  let exportThemeId = "";
  try {
    exportThemeId = localStorage.getItem("rr-export-theme") || "";
  } catch (e) {}

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

  function api(path, options) {
    options = options || {};
    const work = options.work || null;
    const quiet = Boolean(options.quiet);
    if (options.work) delete options.work;
    if ("quiet" in options) delete options.quiet;
    let localTimer = null;
    let startedHere = false;
    const workApi = window.trainLog && window.trainLog.work;
    if (workApi && !quiet) {
      if (work) {
        workApi.start(work.title || "Working…", { poll: Boolean(work.poll) });
        startedHere = true;
      } else {
        localTimer = setTimeout(function () {
          localTimer = null;
          startedHere = true;
          workApi.start("Working…");
        }, 400);
      }
    }
    return fetch(path, options)
      .then(function (response) {
        return response.text().then(function (text) {
          return {
            ok: response.ok,
            status: response.status,
            data: parseApiBody(text, response.headers.get("content-type") || ""),
          };
        });
      })
      .catch(function (err) {
        return { ok: false, status: 0, data: { error: (err && err.message) || "Network error." } };
      })
      .then(function (result) {
        if (localTimer) clearTimeout(localTimer);
        if (startedHere && workApi) workApi.done();
        return result;
      });
  }

  function escapeText(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function banner(text, kind) {
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
      banner("");
    });
    el.replaceChildren(msg, dismiss);
  }

  function notifyLists() {
    if (window.trainLog && window.trainLog.refreshLists) window.trainLog.refreshLists();
  }

  function maxLocations() {
    const rows = (catalog && catalog.railroads) || [];
    let max = 1;
    rows.forEach(function (row) {
      if (row.locations > max) max = row.locations;
    });
    return max;
  }

  function renderKpis() {
    const totals = catalog.totals || {};
    const cards = [
      [totals.subdivisions, "Subdivisions"],
      [totals.locations, "Locations"],
      [totals.railroads, "Railroads"],
      [totals.types, "Train types"],
      [totals.trackage_rights, "Trackage-rights files"],
      [totals.user_files, "Edited on this Mac"],
    ];
    const stationTints = ["where", "where", "trains", "trains", "symbols", "progress"];
    kpisEl.innerHTML = cards
      .map(function (card, i) {
        return (
          '<div class="dash-kpi" data-kpi="' +
          stationTints[i % stationTints.length] +
          '"><b>' +
          card[0] +
          "</b><span>" +
          card[1] +
          "</span></div>"
        );
      })
      .join("");
  }

  let stationChart = "cards";
  try {
    const saved = localStorage.getItem("rr-station-chart");
    if (["cards", "bars", "columns", "donut", "tiles"].indexOf(saved) !== -1) stationChart = saved;
  } catch (e) {}

  function renderStationChartSelect() {
    const tools = document.getElementById("dash-roads-tools");
    if (!tools) return;
    const options = [
      ["cards", "Cards"],
      ["bars", "Bars"],
      ["columns", "Columns"],
      ["donut", "Donut"],
      ["tiles", "Tiles"],
    ];
    tools.innerHTML =
      '<label class="dash-list-chart"><select data-station-chart aria-label="By railroad chart">' +
      options
        .map(function (item) {
          return (
            '<option value="' + item[0] + '"' + (item[0] === stationChart ? " selected" : "") + ">" + item[1] + "</option>"
          );
        })
        .join("") +
      "</select></label>";
  }

  function renderRoads() {
    renderStationChartSelect();
    if (stationChart !== "cards") {
      const rows = ((catalog && catalog.railroads) || []).map(function (row) {
        return { railroad: row.railroad, trains: row.locations || 0 };
      });
      roadsEl.classList.add("is-chart");
      roadsEl.innerHTML =
        '<p class="muted dash-list-caption">Locations in the station book, by railroad</p>' +
        typeChart(rows, "railroad", stationChart, { keepOrder: true, unit: "locations" });
      return;
    }
    roadsEl.classList.remove("is-chart");
    const max = maxLocations();
    roadsEl.innerHTML = ((catalog && catalog.railroads) || [])
      .map(function (row) {
        const width = Math.round((row.locations / max) * 100);
        const empty = row.subdivisions === 0 ? " is-empty" : "";
        const extra =
          row.unique_locations && row.unique_locations !== row.locations
            ? " · " + row.unique_locations + " unique names"
            : "";
        return (
          '<article class="dash-road' +
          empty +
          '"><div class="dash-road-top"><span>' +
          escapeText(row.railroad) +
          "</span><small>" +
          escapeText(row.group) +
          "</small></div><div class=\"dash-meter\"><i style=\"width:" +
          width +
          '%"></i></div><p>' +
          row.subdivisions +
          " subs · " +
          row.locations +
          " locations" +
          extra +
          "</p></article>"
        );
      })
      .join("");
  }

  function fillFilter() {
    const current = filterEl.value;
    let html = '<option value="">All Railroads</option>';
    ((catalog && catalog.groups) || []).forEach(function (group) {
      (group.railroads || []).forEach(function (name) {
        html += '<option value="' + escapeText(name) + '">' + escapeText(name) + "</option>";
      });
    });
    filterEl.innerHTML = html;
    if (current) filterEl.value = current;
  }

  const subSort = { key: "railroads", dir: 1 };
  try {
    const saved = JSON.parse(localStorage.getItem("trainlog.subSort") || "null");
    if (saved && ["subdivision", "railroads", "locations"].indexOf(saved.key) !== -1) {
      subSort.key = saved.key;
      subSort.dir = saved.dir === -1 ? -1 : 1;
    }
  } catch (e) {}

  function subSortValue(item, key) {
    if (key === "locations") return Number(item.locations) || 0;
    if (key === "railroads") return (item.railroads || []).join(", ");
    return item.subdivision || "";
  }

  function compareSubs(a, b) {
    const left = subSortValue(a, subSort.key);
    const right = subSortValue(b, subSort.key);
    let order = typeof left === "number"
      ? left - right
      : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
    if (!order && subSort.key !== "subdivision") {
      order = String(a.subdivision || "").localeCompare(String(b.subdivision || ""), undefined, { numeric: true, sensitivity: "base" });
      return order;
    }
    return order * subSort.dir;
  }

  function syncSubSortHeads() {
    document.querySelectorAll("th[data-sub-sort]").forEach(function (th) {
      const on = th.getAttribute("data-sub-sort") === subSort.key;
      th.classList.toggle("is-sort-asc", on && subSort.dir === 1);
      th.classList.toggle("is-sort-desc", on && subSort.dir === -1);
      th.setAttribute("aria-sort", on ? (subSort.dir === 1 ? "ascending" : "descending") : "none");
    });
  }

  document.querySelectorAll("th[data-sub-sort]").forEach(function (th) {
    th.addEventListener("click", function () {
      const key = th.getAttribute("data-sub-sort");
      if (subSort.key === key) subSort.dir = -subSort.dir;
      else {
        subSort.key = key;
        subSort.dir = key === "locations" ? -1 : 1;
      }
      try { localStorage.setItem("trainlog.subSort", JSON.stringify(subSort)); } catch (e) {}
      renderSubs();
    });
  });

  function renderSubs() {
    const q = (searchEl.value || "").trim().toLowerCase();
    const rr = filterEl.value || "";
    const rows = ((catalog && catalog.subdivisions) || []).filter(function (item) {
      if (rr && (item.railroads || []).indexOf(rr) === -1) return false;
      if (!q) return true;
      const hay = (item.subdivision + " " + (item.railroads || []).join(" ") + " " + item.filename).toLowerCase();
      return hay.indexOf(q) !== -1;
    }).sort(compareSubs);
    syncSubSortHeads();
    if (!rows.length) {
      subBody.innerHTML = '<tr><td colspan="4" class="muted">No subdivisions match.</td></tr>';
      return;
    }
    subBody.innerHTML = rows
      .map(function (item) {
        const source = item.hidden
          ? "Hidden"
          : item.source === "bundled"
          ? "Shipped"
          : item.source === "edited"
          ? "Edited"
          : "This Mac";
        return (
          "<tr" +
          (item.hidden ? ' class="is-hidden-sub"' : "") +
          "><td>" +
          escapeText(item.subdivision) +
          '<span class="dash-sub-source">' +
          source +
          "</span></td><td>" +
          escapeText((item.railroads || []).join(", ")) +
          "</td><td>" +
          item.locations +
          '</td><td class="dash-sub-actions"><button type="button" class="btn tiny ghost dash-sub-menu-btn" aria-haspopup="menu" title="Edit, hide, or delete" data-sub-menu="' +
          escapeText(item.filename) +
          '" data-sub-hidden="' +
          (item.hidden ? "1" : "") +
          '">⋯</button></td></tr>'
        );
      })
      .join("");
  }

  function meaningOf(kind, name) {
    const pack = (catalog && catalog.meanings) || {};
    const bucket = pack[kind] || {};
    return bucket[name] || "";
  }

  function classChoices(group) {
    return ((catalog && catalog.class_choices) || {})[group] || [];
  }

  function rrClassTag(name, group) {
    const current = ((catalog && catalog.classes) || {})[name] || "";
    return (
      '<button type="button" class="dash-rr-class' +
      (current ? "" : " is-unset") +
      '" data-rr-class="' +
      escapeText(name) +
      '" data-rr-group="' +
      escapeText(group) +
      '" aria-haspopup="menu" aria-label="' +
      escapeText(name) +
      " class: " +
      escapeText(current || "Not Set") +
      '" title="Pick a class">' +
      escapeText(current || "+ Class") +
      "</button>"
    );
  }

  let rrClassPop = null;
  function closeRrClassPop(focusBack) {
    if (!rrClassPop) return;
    const owner = rrClassPop.ownerBtn;
    rrClassPop.remove();
    rrClassPop = null;
    if (focusBack && owner && document.body.contains(owner)) owner.focus();
  }

  function openRrClassPop(btn) {
    const name = btn.getAttribute("data-rr-class");
    if (rrClassPop && rrClassPop.ownerBtn === btn) {
      closeRrClassPop(true);
      return;
    }
    closeRrClassPop(false);
    const current = ((catalog && catalog.classes) || {})[name] || "";
    const pop = document.createElement("div");
    pop.className = "rr-class-pop";
    pop.setAttribute("role", "menu");
    pop.setAttribute("aria-label", name + " class");
    pop.innerHTML =
      classChoices(btn.getAttribute("data-rr-group"))
        .concat([""])
        .map(function (label) {
          return (
            '<button type="button" role="menuitemradio" aria-checked="' +
            (label === current) +
            '" data-pick-class="' +
            escapeText(label) +
            '"' +
            (label ? "" : ' class="is-clear"') +
            ">" +
            escapeText(label || "Not Set") +
            "</button>"
          );
        })
        .join("");
    pop.ownerBtn = btn;
    document.body.appendChild(pop);
    const box = btn.getBoundingClientRect();
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    const left = Math.max(8, Math.min(box.right - w, window.innerWidth - w - 8));
    const top = box.bottom + 4 + h > window.innerHeight - 8 ? box.top - h - 4 : box.bottom + 4;
    pop.style.left = left + "px";
    pop.style.top = Math.max(8, top) + "px";
    rrClassPop = pop;
    const on = pop.querySelector('[aria-checked="true"]') || pop.querySelector("button");
    if (on) on.focus();
    pop.addEventListener("click", function (event) {
      const pick = event.target.closest("[data-pick-class]");
      if (pick) saveRrClass(name, pick.getAttribute("data-pick-class"));
    });
    pop.addEventListener("keydown", function (event) {
      const items = Array.prototype.slice.call(pop.querySelectorAll("button"));
      const at = items.indexOf(document.activeElement);
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRrClassPop(true);
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const next = (at + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items[next].focus();
      } else if (event.key === "Tab") {
        closeRrClassPop(false);
      }
    });
  }

  async function saveRrClass(name, rrClass) {
    closeRrClassPop(false);
    const result = await api("/api/catalog/railroads/class", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name, rr_class: rrClass }),
    });
    if (!result.ok) {
      banner((result.data && result.data.error) || "Could not save that class.", "error");
      await loadCatalog();
      return;
    }
    if (catalog) catalog.classes = result.data.classes;
    renderRailroads();
    notifyLists();
    const again = rrGroupsEl.querySelector('[data-rr-class="' + CSS.escape(name) + '"]');
    if (again) again.focus();
  }

  document.addEventListener("mousedown", function (event) {
    if (rrClassPop && !rrClassPop.contains(event.target) && event.target !== rrClassPop.ownerBtn) closeRrClassPop(false);
  });
  window.addEventListener("resize", function () {
    closeRrClassPop(false);
  });
  document.addEventListener(
    "scroll",
    function (event) {
      if (rrClassPop && !rrClassPop.contains(event.target)) closeRrClassPop(false);
    },
    true
  );

  function renderRailroads() {
    rrGroupsEl.innerHTML = ((catalog && catalog.groups) || [])
      .map(function (group) {
        const classed = classChoices(group.label).length > 0;
        const rows = (group.railroads || [])
          .map(function (name) {
            return (
              '<div class="dash-acro-row" data-order-row="' +
              escapeText(name) +
              '">' +
              dragHandle(name) +
              "<b title=\"" +
              escapeText(meaningOf("railroads", name) || name) +
              '">' +
              escapeText(name) +
              "</b>" +
              '<input class="dash-acro-meaning" data-acro-rr="' +
              escapeText(name) +
              '" value="' +
              escapeText(meaningOf("railroads", name)) +
              '" aria-label="' +
              escapeText(name) +
              ' stands for" />' +
              (classed ? rrClassTag(name, group.label) : "") +
              '<button type="button" data-del-rr="' +
              escapeText(name) +
              '" aria-label="Remove ' +
              escapeText(name) +
              '">×</button></div>'
            );
          })
          .join("");
        return (
          '<div class="dash-rr-group' +
          (classed ? " is-classed" : "") +
          '" data-group-label="' +
          escapeText(group.label) +
          '"><h4>' +
          escapeText(group.label) +
          '</h4><div class="dash-acro-list" data-order-list><div class="dash-acro-cols"><span></span><span>Mark</span>' +
          "<span>Stands for</span>" +
          (classed ? "<span>Class</span>" : "") +
          "</div>" +
          rows +
          "</div></div>"
        );
      })
      .join("");
  }

  function dragHandle(name) {
    return (
      '<button type="button" class="dash-drag" data-drag-handle aria-label="Move ' +
      escapeText(name) +
      '" title="Drag to reorder, or focus and press the up or down arrow">⋮⋮</button>'
    );
  }

  function renderTypes() {
    const head =
      '<div class="dash-acro-cols"><span></span><span>Type</span><span>Stands for</span></div>';
    typesEl.setAttribute("data-order-list", "");
    typesEl.innerHTML =
      head +
      ((catalog && catalog.types) || [])
        .map(function (name) {
          const pinned = name.toUpperCase() === "PASS";
          return (
            '<div class="dash-acro-row" data-order-row="' +
            escapeText(name) +
            '"' +
            (pinned ? " data-pinned" : "") +
            ">" +
            (pinned
              ? '<span class="dash-drag is-pinned" title="PASS always stays first">•</span>'
              : dragHandle(name)) +
            "<b title=\"" +
            escapeText(meaningOf("types", name) || name) +
            '">' +
            escapeText(name) +
            '</b><input class="dash-acro-meaning" data-acro-type="' +
            escapeText(name) +
            '" value="' +
            escapeText(meaningOf("types", name)) +
            '" aria-label="' +
            escapeText(name) +
            ' stands for" /><button type="button" data-del-type="' +
            escapeText(name) +
            '">×</button></div>'
          );
        })
        .join("");
    renderTypeFilters();
  }

  function renderTypeFilters() {
    const types = (catalog && catalog.types) || [];
    const options = types
      .map(function (name) {
        return '<option value="' + escapeText(name) + '">' + escapeText(name) + "</option>";
      })
      .join("");
    document.querySelectorAll(".type-filter-to").forEach(function (toEl) {
      const current = toEl.value;
      toEl.innerHTML = options;
      if (current && types.indexOf(current) !== -1) toEl.value = current;
    });
    const rows = (catalog && catalog.type_filters) || [];
    const head =
      '<div class="dash-acro-cols dash-filter-cols"><span>Incoming</span><span>Store as</span><span></span></div>';
    let html;
    if (!rows.length) {
      html = head + '<p class="muted dash-filter-empty">No extra labels yet.</p>';
    } else {
      html =
        head +
        rows
          .map(function (row) {
            const incoming = row.incoming || "";
            const stored = row.stored || "";
            const meaning = meaningOf("types", stored);
            const storedLabel = stored + (meaning ? " (" + meaning + ")" : "");
            return (
              '<div class="dash-acro-row dash-filter-row">' +
              "<b title=\"" +
              escapeText(incoming) +
              '">' +
              escapeText(incoming) +
              '</b><span class="dash-filter-store" title="' +
              escapeText(storedLabel) +
              '">' +
              escapeText(storedLabel) +
              '</span><button type="button" data-del-type-filter="' +
              escapeText(incoming) +
              '" aria-label="Remove ' +
              escapeText(incoming) +
              '">×</button></div>'
            );
          })
          .join("");
    }
    document.querySelectorAll(".type-filters-list").forEach(function (el) {
      el.innerHTML = html;
    });
    const logBtn = document.getElementById("btn-log-type-filters");
    if (logBtn) {
      logBtn.textContent = rows.length ? "Import Filters (" + rows.length + ")" : "Import Filters";
    }
  }

  function sortBy(rows, nameKey, mode) {
    const copy = (rows || []).slice();
    copy.sort(function (a, b) {
      const an = String(a[nameKey] || "");
      const bn = String(b[nameKey] || "");
      if (mode === "name") return an.localeCompare(bn);
      if ((b.trains || 0) !== (a.trains || 0)) return (b.trains || 0) - (a.trains || 0);
      return an.localeCompare(bn);
    });
    return copy;
  }

  function chartName(row, key) {
    if (!row) return "";
    if (key && row[key] != null) return String(row[key]);
    return String(row.type || "");
  }

  function topList(rows, nameKey) {
    const ranked = sortBy(rows || [], nameKey, "count");
    return {
      all: ranked.length,
      rows: sortBy(ranked.slice(0, listTop), nameKey, logListSort),
    };
  }

  function sourceSelect(slot) {
    const current = slotSource[slot];
    const groups = [];
    SOURCE_META.forEach(function (meta) {
      if (groups.indexOf(meta.group) === -1) groups.push(meta.group);
    });
    return (
      '<label class="dash-list-chart"><select data-source="' +
      escapeText(slot) +
      '" aria-label="Chart data" title="Pick what this chart shows">' +
      groups
        .map(function (group) {
          return (
            '<optgroup label="' +
            escapeText(group) +
            '">' +
            SOURCE_META.filter(function (meta) {
              return meta.group === group;
            })
              .map(function (meta) {
                return (
                  '<option value="' +
                  meta.id +
                  '"' +
                  (meta.id === current ? " selected" : "") +
                  ">" +
                  escapeText(meta.title) +
                  "</option>"
                );
              })
              .join("") +
            "</optgroup>"
          );
        })
        .join("") +
      "</select></label>"
    );
  }

  function railroadChartRows(log) {
    return sortBy(
      (log.railroads || []).filter(function (row) {
        return row.trains > 0;
      }),
      "railroad",
      logRrSort
    );
  }

  function sourceRows(log, id) {
    const trains = (log.totals && log.totals.trains) || 0;
    const rows = {
      types: typesForFilter(log),
      railroads: railroadChartRows(log),
      roadcards: railroadChartRows(log),
      rrclass: log.railroad_classes,
      rrgroup: log.railroad_groups,
      rrregion: log.railroad_regions,
      rroperation: log.railroad_operations,
      contrade: log.con_trade,
      leadstatus: log.lead_conditions,
      trainstatus: log.train_status,
      dates: log.trains_by_date,
      monthline: log.trains_by_month,
      waits: log.gaps,
      newleads: log.new_leads,
      directions: log.directions_more,
      cars: log.car_lengths,
      symbols: log.symbols,
      symbolseries: log.symbol_series,
      symbollanes: log.symbol_lanes,
      symbolorigins: log.symbol_origins,
      symboldests: log.symbol_destinations,
      symbolroads: log.symbol_roads,
      symbolcheck: log.symbol_check,
      heritageunits: log.heritage_units,
      heritageschemes: log.heritage_schemes,
      heritagepositions: log.heritage_positions,
      heritageroads: log.heritage_roads,
      steamengines: log.steam_engines,
      steamwheels: log.steam_wheels,
      steamstates: log.steam_states,
      steamruns: log.steam_runs,
      assistdiesels: log.assist_diesels,
      consistunits: log.consist_units,
      passenger: log.passenger_trains,
      loads: log.loads,
      locations: log.locations,
      subdivisions: log.subdivisions,
      states: log.states,
      zones: log.time_zones,
      trips: log.trips,
      hours: log.hours,
      dayparts: log.day_parts,
      ampm: log.ampm,
      weekdays: log.weekdays,
      months: log.months,
      seasons: log.seasons,
      years: log.years,
      busiest: log.busiest_days,
      leads: log.leads,
      consists: log.consists,
      units: log.units,
      dp: log.dp,
      leadpower: log.lead_power,
      leadmarks: log.lead_marks,
      media: log.media,
    }[id];
    return { rows: (rows || []).slice(), total: trains };
  }

  function boardSpec(log, slot) {
    const meta = sourceMeta(slotSource[slot]) || sourceMeta(slot);
    const data = sourceRows(log, meta.id);
    const filtered = meta.id === "types" && logTypeRr;
    return {
      id: meta.id,
      group: meta.group || "",
      title: filtered ? meta.title + " · " + logTypeRr : meta.title,
      rows: data.rows,
      key: meta.key,
      keepOrder: Boolean(meta.keepOrder || meta.cards),
      recent: Boolean(meta.recent),
      cards: Boolean(meta.cards),
      total: meta.total ? data.total : 0,
      empty: filtered ? "No types for that railroad." : "None yet.",
    };
  }

  function roadCardHtml(row, withTypes, drill) {
    const mixAll = withTypes ? sortBy(row.types || [], "type", "count") : [];
    const mixItems = mixAll.slice(0, RR_TYPE_TOP);
    return (
      '<article class="dash-kpi dash-rr-kpi' +
      (withTypes ? "" : " is-plain") +
      '"' +
      drillAttr(row, "railroad", { drill: drill }) +
      '><p class="dash-rr-head"><b>' +
      row.trains +
      "</b><span>" +
      escapeText(row.railroad) +
      "</span><small>" +
      escapeText(row.group) +
      "</small></p>" +
      (mixItems.length
        ? '<ol class="dash-rr-types">' +
          mixItems
            .map(function (item) {
              return "<li><span>" + escapeText(item.type) + "</span><b>" + item.trains + "</b></li>";
            })
            .join("") +
          "</ol>" +
          (mixAll.length > RR_TYPE_TOP
            ? '<p class="muted dash-rr-more">Top ' + RR_TYPE_TOP + " of " + mixAll.length + "</p>"
            : "")
        : "") +
      "</article>"
    );
  }

  function roadCardsHtml(rows, drill) {
    return (
      '<div class="dash-road-cards">' +
      rows
        .map(function (row) {
          return roadCardHtml(row, false, drill);
        })
        .join("") +
      "</div>"
    );
  }

  function gripHtml(card, title) {
    return (
      '<button type="button" class="dash-grip" data-grip="' +
      escapeText(card) +
      '" aria-label="Move ' +
      escapeText(title) +
      '" title="Drag to move this card. Arrow keys move it too.">⠿</button>'
    );
  }

  function boardPick(spec) {
    if (spec.recent) return { all: spec.rows.length, rows: spec.rows.slice(-listTop), natural: true, recent: true };
    if (spec.keepOrder) return { all: spec.rows.length, rows: spec.rows, natural: true };
    return topList(spec.rows, spec.key);
  }

  function boardCaption(picked) {
    if (picked.recent && picked.all > picked.rows.length) return "Last " + picked.rows.length + " of " + picked.all + " days";
    if (picked.natural) return picked.all ? "All " + picked.all : "No trains in this range";
    return listCaption(picked);
  }

  function chartModeSelect(title, kind, mode) {
    const options = [
      ["bars", "Bars"],
      ["columns", "Columns"],
      ["donut", "Donut"],
      ["tiles", "Tiles"],
    ];
    return (
      '<label class="dash-list-chart"><select data-list-chart="' +
      escapeText(kind) +
      '" aria-label="' +
      escapeText(title) +
      ' chart">' +
      options
        .map(function (item) {
          return (
            '<option value="' +
            item[0] +
            '"' +
            (item[0] === mode ? " selected" : "") +
            ">" +
            item[1] +
            "</option>"
          );
        })
        .join("") +
      "</select></label>"
    );
  }

  const SPLIT_ROWS = {
    types: "type", railroads: "railroad", directions: "direction", cars: "cars", loads: "loads",
    locations: "location", subdivisions: "subdivision", states: "state", zones: "zone", trips: "trip",
    hours: "hour", dayparts: "part", ampm: "ampm", weekdays: "weekday", months: "month", seasons: "season",
    years: "year", units: "units", dp: "dp", leadpower: "leadpower", leadmarks: "leadmark", media: "media",
  };
  const SPLIT_CHOICES = [
    ["", "No Split"],
    ["direction", "Split by Direction"],
    ["railroad", "Split by Railroad"],
    ["type", "Split by Train Type"],
    ["loads", "Split by Loads / Empties"],
    ["part", "Split by Time of Day"],
    ["media", "Split by Photo / Video"],
  ];
  const SPLIT_COLORS = ["var(--accent)", "#4e79a7", "#f28e2b", "#59a14f", "#e15759", "#76b7b2", "#edc948", "#b07aa1", "#9c755f", "#bab0ac"];
  const listSplits = {};
  let splitCache = {};
  let splitCacheFor = null;

  function slotSplitRows(kind) {
    return SPLIT_ROWS[slotSource[kind] || kind] || "";
  }

  function slotSplit(kind) {
    if (!(kind in listSplits)) {
      try {
        listSplits[kind] = localStorage.getItem("rr-log-split-" + kind) || "";
      } catch (e) {
        listSplits[kind] = "";
      }
    }
    const rows = slotSplitRows(kind);
    const split = listSplits[kind];
    return rows && split && split !== rows ? split : "";
  }

  function splitSelect(kind, title) {
    const rows = slotSplitRows(kind);
    if (!rows) return "";
    const current = slotSplit(kind);
    return (
      '<label class="dash-list-chart"><select data-list-split="' +
      escapeText(kind) +
      '" aria-label="' +
      escapeText(title) +
      ' split">' +
      SPLIT_CHOICES.filter(function (item) {
        return item[0] !== rows;
      })
        .map(function (item) {
          return '<option value="' + item[0] + '"' + (item[0] === current ? " selected" : "") + ">" + item[1] + "</option>";
        })
        .join("") +
      "</select></label>"
    );
  }

  function splitUrl(kind) {
    const base = catalogQuery();
    return (
      "/api/catalog/compare" +
      (base ? base + "&" : "?") +
      "rows=" + encodeURIComponent(slotSplitRows(kind)) +
      "&cols=" + encodeURIComponent(slotSplit(kind)) +
      "&limit=" + encodeURIComponent(listTop)
    );
  }

  function stackedBars(grid) {
    const rows = grid.rows.names;
    const cols = grid.cols.names;
    if (!rows.length) return '<p class="muted">None yet.</p>';
    const top = Math.max.apply(null, grid.rows.totals.concat([1]));
    let usesOther = false;
    const bars = rows
      .map(function (name, r) {
        const total = grid.rows.totals[r];
        let shown = 0;
        const parts = cols.map(function (col, c) {
          const n = grid.cells[r][c];
          shown += n;
          if (!n) return "";
          return (
            '<i style="flex:' + n + ";background:" + SPLIT_COLORS[c % SPLIT_COLORS.length] + '" title="' +
            escapeText(name + " · " + col + ": " + n) + '"></i>'
          );
        });
        const rest = grid.rows.multi || grid.cols.multi ? 0 : total - shown;
        if (rest > 0) {
          usesOther = true;
          parts.push('<i class="is-other" style="flex:' + rest + '" title="' + escapeText(name + " · Other: " + rest) + '"></i>');
        }
        return (
          '<div class="split-row"><span class="split-label">' + escapeText(name) +
          '</span><span class="split-track"><span class="split-bar" style="width:' +
          ((100 * total) / top).toFixed(1) + '%">' + parts.join("") +
          '</span></span><b class="split-total">' + total + "</b></div>"
        );
      })
      .join("");
    const legend = cols
      .map(function (col, c) {
        return '<span><i style="background:' + SPLIT_COLORS[c % SPLIT_COLORS.length] + '"></i>' + escapeText(col) + "</span>";
      })
      .concat(usesOther ? ['<span><i class="is-other"></i>Other</span>'] : [])
      .join("");
    return '<div class="split-chart">' + bars + '</div><div class="split-legend">' + legend + "</div>";
  }

  async function fillSplits() {
    if (!logListsEl) return;
    if (splitCacheFor !== catalog) {
      splitCache = {};
      splitCacheFor = catalog;
    }
    const holders = Array.prototype.slice.call(logListsEl.querySelectorAll("[data-split-body]"));
    for (const holder of holders) {
      const kind = holder.getAttribute("data-split-body");
      const url = splitUrl(kind);
      if (!splitCache[url]) {
        const result = await api(url, { quiet: true });
        splitCache[url] = result.ok && result.data && result.data.rows ? result.data : { error: true };
      }
      const live = document.querySelector('[data-split-body="' + kind + '"]');
      if (live && splitUrl(kind) === url) {
        live.innerHTML = splitCache[url].error
          ? '<p class="muted">Could not split this chart.</p>'
          : stackedBars(splitCache[url]);
      }
    }
  }

  function listTile(log, kind) {
    const spec = boardSpec(log, kind);
    const picked = boardPick(spec);
    const mode = listCharts[kind] || "bars";
    const caption = boardCaption(picked);
    const split = spec.cards ? "" : slotSplit(kind);
    const body =
      picked.all === 0
        ? '<p class="muted">' + escapeText(spec.empty) + "</p>"
        : spec.cards
          ? roadCardsHtml(picked.rows, true)
          : split
            ? '<div data-split-body="' + escapeText(kind) + '"><p class="muted">Splitting…</p></div>'
            : typeChart(picked.rows, spec.key, mode, { keepOrder: spec.keepOrder, total: spec.total || undefined, drill: DRILLABLE.has(spec.id) });
    return (
      '<section class="dash-panel dash-list-tile dash-board-card' +
      (spec.cards ? " is-cards" : "") +
      '" data-slot="' +
      escapeText(kind) +
      '" data-card="' +
      escapeText(kind) +
      '" data-group="' +
      escapeText(spec.group || "") +
      '"><div class="dash-list-head"><div class="dash-card-title"><h3>' +
      escapeText(spec.title) +
      "</h3><span class=\"dash-card-actions\">" +
      gripHtml(kind, spec.title) +
      (extraSlots.indexOf(kind) !== -1
        ? '<button type="button" class="dash-card-remove" data-remove-slot="' +
          escapeText(kind) +
          '" aria-label="Remove ' +
          escapeText(spec.title) +
          ' chart" title="Remove this chart from the board">×</button>'
        : "") +
      '</span></div><p class="muted dash-list-caption">' +
      escapeText(caption) +
      '</p><div class="dash-types-tools">' +
      sourceSelect(kind) +
      (spec.cards ? "" : (split ? "" : chartModeSelect(spec.title, kind, mode)) + splitSelect(kind, spec.title)) +
      '</div></div><div class="dash-list-body">' +
      body +
      "</div></section>"
    );
  }

  function directionStats(log) {
    const byName = { North: 0, East: 0, South: 0, West: 0 };
    ((log && log.directions) || []).forEach(function (row) {
      if (row && Object.prototype.hasOwnProperty.call(byName, row.direction)) {
        byName[row.direction] = row.trains || 0;
      }
    });
    const totals = (log && log.totals) || {};
    byName.Stopped = totals.stopped || 0;
    byName.InSiding = totals.in_siding || 0;
    byName.CrewChange = totals.crew_change || 0;
    byName.NoCrew = totals.no_crew || 0;
    return byName;
  }

  function directionLine(log) {
    const byName = directionStats(log);
    return (
      "North " +
      byName.North +
      " · East " +
      byName.East +
      " · South " +
      byName.South +
      " · West " +
      byName.West +
      (byName.Stopped ? " · Stopped " + byName.Stopped : "") +
      (byName.InSiding ? " · In Siding " + byName.InSiding : "") +
      (byName.CrewChange ? " · Crew Change " + byName.CrewChange : "") +
      (byName.NoCrew ? " · No Crew Onboard " + byName.NoCrew : "")
    );
  }

  function kpiWord(n, one, many) {
    return (n || 0) === 1 ? one : many;
  }

  function kpiNum(value) {
    return "<b>" + escapeText(String(value)) + "</b>";
  }

  function kpiLabel(text) {
    return text ? "<span>" + escapeText(String(text)) + "</span>" : "";
  }

  function kpiLine(value, label) {
    return '<p class="dash-kpi-line">' + kpiNum(value) + kpiLabel(label) + "</p>";
  }

  function kpiCell(value, label) {
    return '<div class="dash-kpi-cell">' + kpiNum(value) + kpiLabel(label) + "</div>";
  }

  function kpiStatCard(value, label, extras, tint) {
    let html = '<div class="dash-kpi"' + (tint ? ' data-kpi="' + escapeText(tint) + '"' : '') + '>' + kpiLine(value, label);
    if (extras && extras.length) {
      const split = extras.length > 1 && extras.every(function (item) { return item.label; });
      html += '<div class="dash-kpi-extra' + (split ? " is-split" : "") + '">';
      extras.forEach(function (item) {
        if (!item.label) html += '<p class="dash-kpi-note">' + escapeText(String(item.value)) + "</p>";
        else html += kpiLine(item.value, item.label);
      });
      html += "</div>";
    }
    html += "</div>";
    return html;
  }

  function kpiGridCard(cells, tint) {
    return (
      '<div class="dash-kpi dash-kpi-grid' +
      (cells.length > 2 ? " is-dirs" : "") +
      '"' +
      (tint ? ' data-kpi="' + escapeText(tint) + '"' : '') +
      '>' +
      cells
        .map(function (item) {
          return kpiCell(item.value, item.label);
        })
        .join("") +
      "</div>"
    );
  }

  function kpiTileCard(cells, tint) {
    return (
      '<div class="dash-kpi dash-kpi-grid is-tiles"' +
      (tint ? ' data-kpi="' + escapeText(tint) + '"' : "") +
      ">" +
      cells
        .map(function (item) {
          return (
            '<div class="dash-kpi-cell is-tile"><b>' +
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

  function specialTrainCounts(log) {
    const rows = log.special_sightings || [];
    const heritage = {};
    const steam = {};
    const a250 = {};
    rows.forEach(function (row) {
      const id = row && row.id != null ? String(row.id) : "";
      if (!id) return;
      if (row.kind === "Heritage") {
        heritage[id] = true;
        if (/america\s*250|\ba250\b/i.test(row.detail || "")) a250[id] = true;
      }
      if (row.kind === "Steam") steam[id] = true;
    });
    return {
      heritage: Object.keys(heritage).length,
      steam: Object.keys(steam).length,
      a250: Object.keys(a250).length,
    };
  }

  function topRailroadTiles(log) {
    const roads = sortBy(
      (log.railroads || []).filter(function (row) {
        return row.trains > 0;
      }),
      "railroad",
      "trains"
    );
    const top3 = roads.slice(0, 3);
    const other = roads.slice(3).reduce(function (sum, row) {
      return sum + (row.trains || 0);
    }, 0);
    while (top3.length < 3) top3.push({ railroad: "—", trains: 0 });
    return [
      { value: top3[0].trains || 0, label: top3[0].railroad || "—" },
      { value: top3[1].trains || 0, label: top3[1].railroad || "—" },
      { value: top3[2].trains || 0, label: top3[2].railroad || "—" },
      { value: other, label: "Other" },
    ];
  }

  function typeColor(index) {
    return TYPE_COLORS[index % TYPE_COLORS.length];
  }

  function typeTotal(rows) {
    return (
      rows.reduce(function (sum, row) {
        return sum + row.trains;
      }, 0) || 1
    );
  }

  function typePct(count, total) {
    const pct = (count / (total || 1)) * 100;
    if (pct >= 10) return Math.round(pct) + "%";
    if (pct >= 1) return pct.toFixed(1) + "%";
    return "<1%";
  }

  function drillAttr(row, labelKey, opts) {
    if (!opts || !opts.drill) return "";
    const name = chartName(row, labelKey);
    return (
      ' data-drill="' +
      escapeText(name) +
      '" tabindex="0" role="button" title="See the ' +
      row.trains +
      " train" +
      (row.trains === 1 ? "" : "s") +
      " for " +
      escapeText(name) +
      '"'
    );
  }

  function typeLegend(rows, total, labelKey, opts) {
    return (
      '<ol class="dash-type-legend">' +
      rows
        .map(function (row, i) {
          return (
            "<li" +
            drillAttr(row, labelKey, opts) +
            '><i style="background:' +
            typeColor(i) +
            '"></i><span>' +
            escapeText(chartName(row, labelKey)) +
            "</span><b>" +
            row.trains +
            "</b><em>" +
            typePct(row.trains, total) +
            "</em></li>"
          );
        })
        .join("") +
      "</ol>"
    );
  }

  function polar(cx, cy, r, angle) {
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }

  function chartOrder(rows, labelKey, opts) {
    return opts && opts.keepOrder ? (rows || []).slice() : sortBy(rows, labelKey || "type", logListSort);
  }

  function chartPctBase(ordered, opts) {
    return (opts && opts.total) || typeTotal(ordered);
  }

  function typeBars(rows, labelKey, opts) {
    const ordered = chartOrder(rows, labelKey, opts);
    const total = chartPctBase(ordered, opts);
    const max = Math.max.apply(
      null,
      [1].concat(
        ordered.map(function (row) {
          return row.trains;
        })
      )
    );
    return ordered
      .map(function (row, i) {
        const width = Math.round((row.trains / max) * 100);
        return (
          '<div class="dash-type-row"' +
          drillAttr(row, labelKey, opts) +
          '><span title="' +
          escapeText(chartName(row, labelKey)) +
          '">' +
          escapeText(chartName(row, labelKey)) +
          '</span><div class="dash-meter"><i style="width:' +
          width +
          "%;background:" +
          typeColor(i) +
          '"></i></div><b>' +
          row.trains +
          "</b><em>" +
          typePct(row.trains, total) +
          "</em></div>"
        );
      })
      .join("");
  }

  function typeDonut(rows, labelKey, opts) {
    const ordered = chartOrder(rows, labelKey, opts);
    const total = typeTotal(ordered);
    const pctBase = chartPctBase(ordered, opts);
    const cx = 64;
    const cy = 64;
    const r = 56;
    const r2 = 34;
    let angle = -Math.PI / 2;
    const slices = ordered
      .map(function (row, i) {
        const sweep = (row.trains / total) * Math.PI * 2;
        const a0 = angle;
        angle += sweep;
        const p0 = polar(cx, cy, r, a0);
        const p1 = polar(cx, cy, r, angle);
        const i0 = polar(cx, cy, r2, angle);
        const i1 = polar(cx, cy, r2, a0);
        const large = sweep > Math.PI ? 1 : 0;
        const d =
          "M " +
          p0.x.toFixed(2) +
          " " +
          p0.y.toFixed(2) +
          " A " +
          r +
          " " +
          r +
          " 0 " +
          large +
          " 1 " +
          p1.x.toFixed(2) +
          " " +
          p1.y.toFixed(2) +
          " L " +
          i0.x.toFixed(2) +
          " " +
          i0.y.toFixed(2) +
          " A " +
          r2 +
          " " +
          r2 +
          " 0 " +
          large +
          " 0 " +
          i1.x.toFixed(2) +
          " " +
          i1.y.toFixed(2) +
          " Z";
        return '<path d="' + d + '" fill="' + typeColor(i) + '"></path>';
      })
      .join("");
    return (
      '<div class="dash-donut-wrap"><svg class="dash-donut" viewBox="0 0 128 128">' +
      slices +
      '<text x="64" y="60" text-anchor="middle" class="dash-donut-total">' +
      total +
      '</text><text x="64" y="76" text-anchor="middle" class="dash-donut-caption">' +
      escapeText((opts && opts.unit) || "trains") +
      "</text></svg>" +
      typeLegend(ordered, pctBase, labelKey, opts) +
      "</div>"
    );
  }

  function typeColumns(rows, labelKey, opts) {
    const ordered = chartOrder(rows, labelKey, opts);
    const total = chartPctBase(ordered, opts);
    const max = Math.max.apply(
      null,
      [1].concat(
        ordered.map(function (row) {
          return row.trains;
        })
      )
    );
    const showCount = ordered.length <= 14;
    const showPct = ordered.length <= 10;
    return (
      '<div class="dash-cols-wrap"><div class="dash-cols">' +
      ordered
        .map(function (row, i) {
          const h = Math.max(6, Math.round((row.trains / max) * 100));
          return (
            '<div class="dash-col">' +
            (showCount ? "<b>" + row.trains + "</b>" : "") +
            '<div class="dash-col-track"><i style="height:' +
            h +
            "%;background:" +
            typeColor(i) +
            '"></i></div>' +
            (showPct ? "<em>" + typePct(row.trains, total) + "</em>" : "") +
            "</div>"
          );
        })
        .join("") +
      "</div>" +
      typeLegend(ordered, total, labelKey, opts) +
      "</div>"
    );
  }

  function layoutTiles(items, x, y, w, h, vertical) {
    if (!items.length) return [];
    if (items.length === 1) {
      return [{ x: x, y: y, w: w, h: h, row: items[0] }];
    }
    const total = items.reduce(function (sum, row) {
      return sum + row.trains;
    }, 0) || 1;
    let acc = 0;
    let cut = 1;
    for (let i = 0; i < items.length; i++) {
      acc += items[i].trains;
      cut = i + 1;
      if (acc >= total / 2) break;
    }
    if (cut >= items.length) cut = items.length - 1;
    const leftItems = items.slice(0, cut);
    const rightItems = items.slice(cut);
    const leftSum = leftItems.reduce(function (sum, row) {
      return sum + row.trains;
    }, 0);
    const frac = leftSum / total;
    if (vertical) {
      const lw = w * frac;
      return layoutTiles(leftItems, x, y, lw, h, false).concat(
        layoutTiles(rightItems, x + lw, y, w - lw, h, false)
      );
    }
    const lh = h * frac;
    return layoutTiles(leftItems, x, y, w, lh, true).concat(
      layoutTiles(rightItems, x, y + lh, w, h - lh, true)
    );
  }

  function typeTiles(rows, labelKey, opts) {
    const ordered = chartOrder(rows, labelKey, opts);
    const total = chartPctBase(ordered, opts);
    const rects = layoutTiles(ordered, 0.4, 0.4, 99.2, 99.2, true);
    return (
      '<div class="dash-tiles-wrap"><svg class="dash-tiles" viewBox="0 0 100 100">' +
      rects
        .map(function (rect, i) {
          const showCount = rect.w > 12 && rect.h > 10;
          const name = chartName(rect.row, labelKey);
          const showName = showCount && rect.w > 3 + name.length * 2.2 && rect.h > 14;
          return (
            '<g><rect x="' +
            rect.x.toFixed(2) +
            '" y="' +
            rect.y.toFixed(2) +
            '" width="' +
            Math.max(0.4, rect.w - 0.4).toFixed(2) +
            '" height="' +
            Math.max(0.4, rect.h - 0.4).toFixed(2) +
            '" rx="1.2" fill="' +
            typeColor(i) +
            '"></rect>' +
            (showCount
              ? (showName
                  ? '<text x="' +
                    (rect.x + 1.5).toFixed(2) +
                    '" y="' +
                    (rect.y + 5).toFixed(2) +
                    '" class="dash-tile-label">' +
                    escapeText(name) +
                    "</text>"
                  : "") +
                '<text x="' +
                (rect.x + 1.5).toFixed(2) +
                '" y="' +
                (showName ? rect.y + 10 : rect.y + 6).toFixed(2) +
                '" class="dash-tile-count">' +
                rect.row.trains +
                (rect.w > 20 && rect.h > 22 ? "  " + typePct(rect.row.trains, total) : "") +
                "</text>"
              : "") +
            "</g>"
          );
        })
        .join("") +
      "</svg>" +
      typeLegend(ordered, total, labelKey, opts) +
      "</div>"
    );
  }

  function typeChart(rows, labelKey, mode, opts) {
    labelKey = labelKey || "type";
    mode = mode || "bars";
    if (!rows.length) return '<p class="muted">None yet.</p>';
    if (mode === "donut") return typeDonut(rows, labelKey, opts);
    if (mode === "columns") return typeColumns(rows, labelKey, opts);
    if (mode === "tiles") return typeTiles(rows, labelKey, opts);
    return typeBars(rows, labelKey, opts);
  }

  function logNote(text, kind) {
    if (window.trainLog && window.trainLog.banner) {
      window.trainLog.banner(text, kind);
      return;
    }
    banner(text, kind);
  }

  function chartModeLabel(mode) {
    return { bars: "Bars", columns: "Columns", donut: "Donut", tiles: "Tiles", cards: "Cards" }[mode] || "Bars";
  }

  function listCaption(picked) {
    if (!picked.all) return "No trains in this range";
    if (picked.all <= listTop) return "All " + picked.all + ", by train count";
    return "Top " + listTop + " of " + picked.all + ", by train count";
  }

  const CARD_W = 148;
  const CARD_H = 64;
  const CARD_GAP = 8;

  function cardCols(width) {
    return Math.max(1, Math.floor((width + CARD_GAP) / (CARD_W + CARD_GAP)));
  }

  function chartBlockH(mode, n, width) {
    const head = 58;
    if (!n) return head + 36;
    if (mode === "cards") return head + 16 + Math.ceil(n / cardCols(width - 32)) * (CARD_H + CARD_GAP);
    if (mode === "bars") return head + Math.max(110, n * 28);
    return head + Math.max(260, 16 + n * 22);
  }

  function strBytes(text) {
    const out = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 255;
    return out;
  }

  function joinBytes(parts) {
    let n = 0;
    for (let i = 0; i < parts.length; i++) n += parts[i].length;
    const out = new Uint8Array(n);
    let o = 0;
    for (let i = 0; i < parts.length; i++) {
      out.set(parts[i], o);
      o += parts[i].length;
    }
    return out;
  }

  function pad10(value) {
    const text = String(value);
    return ("0000000000" + text).slice(-10);
  }

  const VECTOR_FONT = "Helvetica, Arial, sans-serif";
  let vectorMeasure = null;

  function vecNum(n) {
    return String(Math.round(n * 100) / 100);
  }

  function VectorCanvas(width, height) {
    this.width = width;
    this.height = height;
    this.items = [];
    this._ctx = null;
  }

  VectorCanvas.prototype.getContext = function () {
    if (!this._ctx) this._ctx = new VectorContext(this);
    return this._ctx;
  };

  function VectorContext(canvas) {
    this.canvas = canvas;
    this.fillStyle = "#000000";
    this.strokeStyle = "#000000";
    this.lineWidth = 1;
    this.textAlign = "left";
    this.textBaseline = "alphabetic";
    this._size = 10;
    this._bold = false;
    this._font = "10px sans-serif";
    this._path = [];
    this._start = null;
    this._at = null;
  }

  Object.defineProperty(VectorContext.prototype, "font", {
    get: function () {
      return this._font;
    },
    set: function (value) {
      this._font = String(value || "");
      const size = /(\d+(?:\.\d+)?)px/.exec(this._font);
      const weight = /(^|\s)(bold|[6-9]00)(\s|$)/.exec(this._font);
      this._size = size ? Number(size[1]) : 10;
      this._bold = Boolean(weight);
    },
  });

  VectorContext.prototype._cssFont = function () {
    return (this._bold ? "bold " : "") + this._size + "px " + VECTOR_FONT;
  };

  VectorContext.prototype.measureText = function (text) {
    if (!vectorMeasure) vectorMeasure = document.createElement("canvas").getContext("2d");
    vectorMeasure.font = this._cssFont();
    return vectorMeasure.measureText(String(text));
  };

  VectorContext.prototype.beginPath = function () {
    this._path = [];
    this._start = null;
    this._at = null;
  };

  VectorContext.prototype.moveTo = function (x, y) {
    this._path.push(["M", x, y]);
    this._start = [x, y];
    this._at = [x, y];
  };

  VectorContext.prototype.lineTo = function (x, y) {
    if (!this._at) return this.moveTo(x, y);
    this._path.push(["L", x, y]);
    this._at = [x, y];
  };

  VectorContext.prototype.closePath = function () {
    if (!this._start) return;
    this._path.push(["Z"]);
    this._at = this._start.slice();
  };

  VectorContext.prototype.arc = function (cx, cy, r, a0, a1, ccw) {
    let sweep = a1 - a0;
    const full = Math.PI * 2;
    if (ccw) {
      if (sweep > 0) sweep -= full * Math.ceil(sweep / full);
      if (sweep < -full) sweep = -full;
    } else {
      if (sweep < 0) sweep += full * Math.ceil(-sweep / full);
      if (sweep > full) sweep = full;
    }
    const sx = cx + r * Math.cos(a0);
    const sy = cy + r * Math.sin(a0);
    if (this._at) this.lineTo(sx, sy);
    else this.moveTo(sx, sy);
    const n = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-9));
    const step = sweep / n;
    const k = (4 / 3) * Math.tan(step / 4);
    let a = a0;
    for (let i = 0; i < n; i++) {
      const b = a + step;
      const ax = cx + r * Math.cos(a);
      const ay = cy + r * Math.sin(a);
      const bx = cx + r * Math.cos(b);
      const by = cy + r * Math.sin(b);
      this._path.push([
        "C",
        ax - k * r * Math.sin(a),
        ay + k * r * Math.cos(a),
        bx + k * r * Math.sin(b),
        by - k * r * Math.cos(b),
        bx,
        by,
      ]);
      a = b;
    }
    this._at = [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };

  VectorContext.prototype.rect = function (x, y, w, h) {
    this.moveTo(x, y);
    this.lineTo(x + w, y);
    this.lineTo(x + w, y + h);
    this.lineTo(x, y + h);
    this.closePath();
  };

  VectorContext.prototype.roundRect = function (x, y, w, h, radius) {
    const r = Math.max(0, Math.min(Number(radius) || 0, w / 2, h / 2));
    if (!r) return this.rect(x, y, w, h);
    const q = Math.PI / 2;
    this.moveTo(x + r, y);
    this.arc(x + w - r, y + r, r, -q, 0);
    this.arc(x + w - r, y + h - r, r, 0, q);
    this.arc(x + r, y + h - r, r, q, 2 * q);
    this.arc(x + r, y + r, r, 2 * q, 3 * q);
    this.closePath();
  };

  VectorContext.prototype.fill = function () {
    if (this._path.length) this.canvas.items.push({ kind: "fill", path: this._path.slice(), color: this.fillStyle });
  };

  VectorContext.prototype.stroke = function () {
    if (this._path.length) {
      this.canvas.items.push({ kind: "stroke", path: this._path.slice(), color: this.strokeStyle, width: this.lineWidth });
    }
  };

  VectorContext.prototype.fillRect = function (x, y, w, h) {
    this.canvas.items.push({
      kind: "fill",
      path: [["M", x, y], ["L", x + w, y], ["L", x + w, y + h], ["L", x, y + h], ["Z"]],
      color: this.fillStyle,
    });
  };

  VectorContext.prototype.fillText = function (text, x, y) {
    text = String(text);
    if (!text) return;
    const width = this.measureText(text).width;
    let left = x;
    if (this.textAlign === "right" || this.textAlign === "end") left = x - width;
    else if (this.textAlign === "center") left = x - width / 2;
    this.canvas.items.push({
      kind: "text",
      text: text,
      x: x,
      left: left,
      y: y,
      size: this._size,
      bold: this._bold,
      align: this.textAlign,
      color: this.fillStyle,
    });
  };

  function vectorRgb(color) {
    const text = String(color || "#000").trim();
    const rgb = text.match(/^rgba?\(([^)]+)\)/i);
    if (rgb) {
      const parts = rgb[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
      return [0, 1, 2].map(function (i) {
        return Math.max(0, Math.min(255, Math.round(parts[i] || 0)));
      });
    }
    let hex = text.replace("#", "");
    if (hex.length === 3) hex = hex.replace(/./g, "$&$&");
    const n = parseInt(hex.slice(0, 6), 16);
    if (!isFinite(n)) return [0, 0, 0];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function svgPath(path) {
    return path
      .map(function (op) {
        return op[0] + op.slice(1).map(vecNum).join(" ");
      })
      .join("");
  }

  function xmlText(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function vectorToSvg(canvas) {
    const out = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="' +
        canvas.width +
        '" height="' +
        canvas.height +
        '" viewBox="0 0 ' +
        canvas.width +
        " " +
        canvas.height +
        '" font-family="' +
        VECTOR_FONT +
        '">',
    ];
    canvas.items.forEach(function (item) {
      if (item.kind === "fill") {
        out.push('<path d="' + svgPath(item.path) + '" fill="' + xmlText(item.color) + '"/>');
      } else if (item.kind === "stroke") {
        out.push(
          '<path d="' + svgPath(item.path) + '" fill="none" stroke="' + xmlText(item.color) + '" stroke-width="' + vecNum(item.width) + '"/>'
        );
      } else {
        const anchor = item.align === "right" || item.align === "end" ? "end" : item.align === "center" ? "middle" : "start";
        out.push(
          '<text x="' +
            vecNum(item.x) +
            '" y="' +
            vecNum(item.y) +
            '" font-size="' +
            item.size +
            '"' +
            (item.bold ? ' font-weight="bold"' : "") +
            (anchor !== "start" ? ' text-anchor="' + anchor + '"' : "") +
            ' fill="' +
            xmlText(item.color) +
            '" style="white-space:pre">' +
            xmlText(item.text) +
            "</text>"
        );
      }
    });
    out.push("</svg>");
    return out.join("\n");
  }

  const WIN_ANSI = {
    "€": 128, "‚": 130, "„": 132, "…": 133, "‘": 145, "’": 146, "“": 147, "”": 148,
    "•": 149, "–": 150, "—": 151, "™": 153,
  };
  const PDF_SWAP = { "→": "->", "←": "<-", "≥": ">=", "≤": "<=", "−": "-" };

  function pdfString(text) {
    let out = "";
    Array.from(String(text)).forEach(function (ch) {
      if (PDF_SWAP[ch]) {
        out += PDF_SWAP[ch];
        return;
      }
      let code = WIN_ANSI[ch] || ch.charCodeAt(0);
      if (code > 255) code = 63;
      if (code === 40 || code === 41 || code === 92) out += "\\" + ch;
      else if (code < 32 || code > 126) out += "\\" + ("00" + code.toString(8)).slice(-3);
      else out += ch;
    });
    return "(" + out + ")";
  }

  function pdfPath(path) {
    return path
      .map(function (op) {
        const nums = op.slice(1).map(vecNum).join(" ");
        if (op[0] === "M") return nums + " m";
        if (op[0] === "L") return nums + " l";
        if (op[0] === "C") return nums + " c";
        return "h";
      })
      .join("\n");
  }

  function pdfColor(color, op) {
    return vectorRgb(color)
      .map(function (v) {
        return vecNum(v / 255);
      })
      .join(" ") + " " + op;
  }

  function vectorToPdf(canvas) {
    const scale = 0.75;
    const pageW = vecNum(canvas.width * scale);
    const pageH = vecNum(canvas.height * scale);
    const lines = [scale + " 0 0 " + -scale + " 0 " + pageH + " cm"];
    canvas.items.forEach(function (item) {
      if (item.kind === "fill") {
        lines.push(pdfColor(item.color, "rg"), pdfPath(item.path), "f");
      } else if (item.kind === "stroke") {
        lines.push(pdfColor(item.color, "RG"), vecNum(item.width) + " w", pdfPath(item.path), "S");
      } else {
        lines.push(
          pdfColor(item.color, "rg"),
          "BT /" + (item.bold ? "F2" : "F1") + " " + item.size + " Tf 1 0 0 -1 " + vecNum(item.left) + " " + vecNum(item.y) + " Tm " + pdfString(item.text) + " Tj ET"
        );
      }
    });
    const contents = lines.join("\n") + "\n";
    const chunks = [];
    const offsets = [0];
    function pos() {
      let n = 0;
      for (let i = 0; i < chunks.length; i++) n += chunks[i].length;
      return n;
    }
    function push(part) {
      chunks.push(typeof part === "string" ? strBytes(part) : part);
    }
    function obj(num, body, stream) {
      offsets[num] = pos();
      push(num + " 0 obj\n");
      push(body);
      if (stream) {
        push("\nstream\n");
        push(stream);
        push("\nendstream");
      }
      push("\nendobj\n");
    }
    push("%PDF-1.4\n");
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    obj(
      3,
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
        pageW +
        " " +
        pageH +
        "] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>"
    );
    obj(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    obj(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    obj(6, "<< /Length " + contents.length + " >>", strBytes(contents));
    const xrefAt = pos();
    let xref = "xref\n0 7\n0000000000 65535 f \n";
    for (let i = 1; i < 7; i++) xref += pad10(offsets[i]) + " 00000 n \n";
    push(xref);
    push("trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n" + xrefAt + "\n%%EOF\n");
    return new Blob([joinBytes(chunks)], { type: "application/pdf" });
  }

  async function downloadBlob(blob, filename) {
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
    }, 2500);
  }

  const pendingExport = { svg: null, pdf: null, preview: "", stem: "train-log-stats" };

  function fitText(ctx, text, maxW) {
    text = String(text || "");
    if (ctx.measureText(text).width <= maxW) return text;
    while (text.length > 1 && ctx.measureText(text + "…").width > maxW) {
      text = text.slice(0, -1);
    }
    return text + "…";
  }

  function roundBox(ctx, x, y, w, h, r) {
    r = r || 8;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  function mixColor(a, b, share) {
    const x = vectorRgb(a);
    const y = vectorRgb(b);
    return (
      "#" +
      [0, 1, 2]
        .map(function (i) {
          return Math.round(x[i] + (y[i] - x[i]) * share)
            .toString(16)
            .padStart(2, "0");
        })
        .join("")
    );
  }

  function exportThemeKnown(id) {
    const themes = window.trainLogTheme && window.trainLogTheme.list ? window.trainLogTheme.list() : [];
    return themes.some(function (theme) {
      return theme.id === id;
    });
  }

  function exportTheme() {
    let probe = null;
    if (exportThemeId && exportThemeKnown(exportThemeId)) {
      probe = document.createElement("span");
      probe.hidden = true;
      probe.setAttribute("data-theme", exportThemeId);
      document.body.appendChild(probe);
    }
    const css = window.getComputedStyle(probe || document.documentElement);
    function pick(name, fallback) {
      const value = css.getPropertyValue(name).trim();
      return /^(#|rgb)/i.test(value) ? value : fallback;
    }
    const paper = pick("--bg", "#f3f5f8");
    const ink = pick("--ink", "#152033");
    const theme = {
      paper: paper,
      ink: ink,
      muted: pick("--muted", "#5b6b7c"),
      cardBg: pick("--surface", "#ffffff"),
      cardLine: pick("--border", "#d5dde6"),
      track: pick("--surface-muted", "#eef1f5"),
      rule: mixColor(paper, ink, 0.18),
    };
    if (probe) probe.remove();
    return theme;
  }

  function renderExportThemePick() {
    const sel = document.getElementById("dash-export-theme");
    if (!sel || !window.trainLogTheme || !window.trainLogTheme.list) return;
    if (sel.options.length < 2) {
      window.trainLogTheme.list().forEach(function (theme) {
        const opt = document.createElement("option");
        opt.value = theme.id;
        opt.textContent = theme.label;
        sel.appendChild(opt);
      });
    }
    if (!exportThemeKnown(exportThemeId)) exportThemeId = "";
    sel.value = exportThemeId;
    if (logExportPreview) {
      if (exportThemeId) logExportPreview.setAttribute("data-theme", exportThemeId);
      else logExportPreview.removeAttribute("data-theme");
    }
  }

  function drawLogStatsVector(log, picks) {
    picks = picks || {};
    const theme = exportTheme();
    const black = theme.ink;
    const onColor = "#ffffff";
    const paper = theme.paper;
    const track = theme.track;
    const cardBg = theme.cardBg;
    const cardLine = theme.cardLine;
    const muted = theme.muted;
    const W = 1600;
    const M = 40;
    const inner = W - M * 2;
    const totals = log.totals || {};
    const trains = totals.trains || 0;
    const range =
      totals.first_date && totals.last_date
        ? totals.first_date === totals.last_date
          ? totals.first_date
          : totals.first_date + " – " + totals.last_date
        : "All Dates";
    const chartSet = boardSpec(log, "types");
    const typeRows = chartSet.keepOrder ? chartSet.rows : sortBy(chartSet.rows, chartSet.key, logListSort);
    const typeMode = chartSet.cards ? "cards" : logTypeChart;
    const typeTitle = chartSet.title;
    const roads = sortBy(
      (log.railroads || []).filter(function (row) {
        return row.trains > 0;
      }),
      "railroad",
      logRrSort
    );
    const lists = listSlots().filter(function (kind) {
      return picks[kind];
    }).map(function (kind) {
      const spec = boardSpec(log, kind);
      const picked = boardPick(spec);
      return {
        title: spec.title,
        key: spec.key,
        mode: spec.cards ? "cards" : listCharts[kind] || "bars",
        caption: boardCaption(picked),
        rows: picked.rows,
        total: spec.total || undefined,
      };
    });
    const typeH = chartBlockH(typeMode, typeRows.length, inner);
    const roadCols = 4;
    const roadGap = 12;
    const roadW = (inner - roadGap * (roadCols - 1)) / roadCols;
    const roadCardH = 168;
    const roadRowsN = Math.max(1, Math.ceil(roads.length / roadCols) || 1);
    const roadsH = roads.length ? 36 + roadRowsN * roadCardH + (roadRowsN - 1) * roadGap : 56;
    const gridGap = 12;
    const halfW = (inner - gridGap) / 2;
    function gridRows(items) {
      const out = [];
      for (let i = 0; i < items.length; i += 2) {
        const pair = items.slice(i, i + 2);
        out.push({
          items: pair,
          h: Math.max(
            220,
            pair.reduce(function (h, item) {
              return Math.max(h, chartBlockH(item.mode, item.rows.length, halfW));
            }, 0)
          ),
        });
      }
      return out;
    }
    function gridH(rows) {
      if (!rows.length) return 0;
      return rows.reduce(function (h, row) {
        return h + row.h;
      }, 0) + gridGap * (rows.length - 1);
    }
    const listRows = gridRows(lists);
    const moreSpecs = moreStatsSpecs(log)
      .filter(function (spec) {
        return picks[spec.kind] && !spec.render;
      })
      .map(function (spec) {
        const rows = spec.keepOrder ? spec.rows.slice() : sortBy(spec.rows, spec.key, logListSort);
        return Object.assign({}, spec, {
          rows: rows,
          caption: rows.length ? rows.length + (rows.length === 1 ? " row" : " rows") : "No trains in this range",
        });
      });
    const moreRows = gridRows(moreSpecs);
    const facts = picks.glance ? log.facts || [] : [];
    const factCols = 4;
    const factsH = facts.length ? 40 + Math.ceil(facts.length / factCols) * 52 : 0;
    const showTypes = !!picks.types;
    const showRoads = !!picks.railroads;
    const showChartsLine = showTypes || lists.length > 0;
    let height = M + 78;
    if (picks.totals) height += 124;
    if (showChartsLine) height += 28;
    if (showTypes) height += typeH + 28;
    if (showRoads) height += roadsH + 16;
    if (lists.length) height += 12 + gridH(listRows) + 20;
    if (facts.length || moreSpecs.length) {
      height += 12 + (facts.length ? factsH + gridGap : 0) + gridH(moreRows) + 20;
    }
    height += 16 + M;
    const canvas = new VectorCanvas(W, Math.min(16000, Math.max(480, height)));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textBaseline = "alphabetic";

    function paintLegend(rows, nameKey, total, x, y, w) {
      ctx.font = "13px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      rows.forEach(function (row, i) {
        const top = y + i * 22;
        ctx.fillStyle = typeColor(i);
        ctx.beginPath();
        ctx.arc(x + 6, top + 4, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = black;
        ctx.fillText(fitText(ctx, chartName(row, nameKey), Math.max(40, w - 92)), x + 18, top + 8);
        ctx.textAlign = "right";
        ctx.fillText(String(row.trains), x + w - 44, top + 8);
        ctx.fillText(typePct(row.trains, total), x + w - 4, top + 8);
        ctx.textAlign = "left";
      });
    }

    function paintChart(box, rows, nameKey, mode, title, caption, pctTotal) {
      roundBox(ctx, box.x, box.y, box.w, box.h, 10);
      ctx.fillStyle = cardBg;
      ctx.fill();
      ctx.strokeStyle = cardLine;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = black;
      ctx.font = "600 18px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(title, box.x + 16, box.y + 26);
      ctx.font = "12px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = muted;
      ctx.fillText(
        caption + "  ·  " + chartModeLabel(mode),
        box.x + 16,
        box.y + 44
      );
      const plotX = box.x + 16;
      const plotY = box.y + 58;
      const plotW = box.w - 32;
      const plotH = box.h - 74;
      if (!rows.length) {
        ctx.fillStyle = muted;
        ctx.font = "13px system-ui, -apple-system, sans-serif";
        ctx.fillText("None yet.", plotX, plotY + 24);
        return;
      }
      if (mode === "cards") {
        const cols = cardCols(plotW);
        const w = (plotW - CARD_GAP * (cols - 1)) / cols;
        rows.forEach(function (row, i) {
          const x = plotX + (i % cols) * (w + CARD_GAP);
          const top = plotY + 8 + Math.floor(i / cols) * (CARD_H + CARD_GAP);
          roundBox(ctx, x, top, w, CARD_H, 8);
          ctx.fillStyle = paper;
          ctx.fill();
          ctx.strokeStyle = cardLine;
          ctx.stroke();
          ctx.textAlign = "left";
          ctx.fillStyle = black;
          ctx.font = "600 20px system-ui, -apple-system, sans-serif";
          const count = String(row.trains);
          ctx.fillText(count, x + 10, top + 26);
          const countW = ctx.measureText(count).width;
          ctx.font = "600 13px system-ui, -apple-system, sans-serif";
          ctx.fillText(fitText(ctx, chartName(row, nameKey), w - countW - 26), x + 16 + countW, top + 26);
          ctx.fillStyle = muted;
          ctx.font = "10px system-ui, -apple-system, sans-serif";
          ctx.fillText(fitText(ctx, String(row.group || "").toUpperCase(), w - 20), x + 10, top + 48);
        });
        return;
      }
      const sum = typeTotal(rows);
      const total = pctTotal || sum;
      const max = Math.max.apply(
        null,
        [1].concat(
          rows.map(function (row) {
            return row.trains;
          })
        )
      );
      if (mode === "bars") {
        ctx.font = "13px system-ui, -apple-system, sans-serif";
        const labelW = Math.min(
          280,
          rows.reduce(function (w, row) {
            return Math.max(w, ctx.measureText(chartName(row, nameKey)).width);
          }, 72)
        );
        const barX = plotX + labelW + 12;
        const barW = Math.max(40, plotW - labelW - 88);
        const rowH = Math.min(28, plotH / rows.length);
        rows.forEach(function (row, i) {
          const y = plotY + i * rowH;
          ctx.fillStyle = black;
          ctx.textAlign = "left";
          ctx.fillText(fitText(ctx, chartName(row, nameKey), labelW), plotX, y + 16);
          ctx.fillStyle = track;
          ctx.fillRect(barX, y + 5, barW, 12);
          ctx.fillStyle = typeColor(i);
          ctx.fillRect(barX, y + 5, Math.max(3, (row.trains / max) * barW), 12);
          ctx.fillStyle = black;
          ctx.fillText(row.trains + "  " + typePct(row.trains, total), barX + barW + 10, y + 16);
        });
        return;
      }
      const mapW = plotW * 0.58;
      if (mode === "columns") {
        const gap = 8;
        const colW = Math.max(10, (mapW - gap * Math.max(0, rows.length - 1)) / rows.length);
        const barBottom = plotY + plotH;
        const barMax = Math.max(40, plotH - 28);
        rows.forEach(function (row, i) {
          const x = plotX + i * (colW + gap);
          const h = Math.max(6, (row.trains / max) * barMax);
          ctx.fillStyle = track;
          ctx.fillRect(x, plotY + 20, colW, barMax);
          ctx.fillStyle = typeColor(i);
          ctx.fillRect(x, barBottom - h, colW, h);
          ctx.fillStyle = black;
          ctx.font = "12px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "center";
          const count = String(row.trains);
          const pct = typePct(row.trains, total);
          if (ctx.measureText(count).width + 4 < colW) {
            ctx.fillText(count, x + colW / 2, barBottom - h - 14);
          }
          if (ctx.measureText(pct).width + 4 < colW) {
            ctx.fillText(pct, x + colW / 2, barBottom - h - 2);
          }
          ctx.textAlign = "left";
        });
        paintLegend(rows, nameKey, total, plotX + mapW + 20, plotY, plotW - mapW - 20);
        return;
      }
      if (mode === "tiles") {
        const rects = layoutTiles(rows, 0, 0, 100, 100, true);
        rects.forEach(function (rect, i) {
          const x = plotX + (rect.x / 100) * mapW;
          const y = plotY + (rect.y / 100) * plotH;
          const w = (rect.w / 100) * mapW - 4;
          const h = (rect.h / 100) * plotH - 4;
          ctx.fillStyle = typeColor(i);
          roundBox(ctx, x, y, Math.max(2, w), Math.max(2, h), 6);
          ctx.fill();
          const name = chartName(rect.row, nameKey);
          ctx.font = "600 13px system-ui, -apple-system, sans-serif";
          const nameW = ctx.measureText(name).width;
          const showName = w > nameW + 18 && h > 36;
          if (showName) {
            ctx.fillStyle = onColor;
            ctx.fillText(name, x + 8, y + 20);
          }
          if (w > 44 && h > 24) {
            ctx.fillStyle = onColor;
            ctx.font = "12px system-ui, -apple-system, sans-serif";
            ctx.fillText(
              rect.row.trains + "  " + typePct(rect.row.trains, total),
              x + 8,
              y + (showName ? 38 : 20)
            );
          }
        });
        paintLegend(rows, nameKey, total, plotX + mapW + 20, plotY, plotW - mapW - 20);
        return;
      }
      const cx = plotX + Math.min(150, plotW * 0.22);
      const cy = plotY + plotH / 2;
      const r = Math.min(120, plotH / 2 - 8, mapW * 0.38);
      const hole = r * 0.58;
      let angle = -Math.PI / 2;
      rows.forEach(function (row, i) {
        const sweep = (row.trains / sum) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, angle, angle + sweep);
        ctx.arc(cx, cy, hole, angle + sweep, angle, true);
        ctx.closePath();
        ctx.fillStyle = typeColor(i);
        ctx.fill();
        angle += sweep;
      });
      ctx.fillStyle = black;
      ctx.font = "600 22px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(sum), cx, cy - 2);
      ctx.font = "12px system-ui, -apple-system, sans-serif";
      ctx.fillText("trains", cx, cy + 16);
      ctx.textAlign = "left";
      paintLegend(rows, nameKey, total, plotX + mapW + 20, plotY, plotW - mapW - 20);
    }

    let y = M;
    ctx.fillStyle = black;
    ctx.font = "600 28px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("TRAIN LOG", M, y + 28);
    ctx.font = "13px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = muted;
    ctx.fillText("Field Book for Railfans  ·  Log Stats", M, y + 50);
    ctx.fillStyle = black;
    ctx.font = "13px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(range, W - M, y + 28);
    ctx.fillStyle = muted;
    ctx.fillText(trains + " trains  ·  " + (totals.days || 0) + " days trackside", W - M, y + 50);
    ctx.textAlign = "left";
    y += 78;

    const dirs = directionStats(log);
    const kpiH = 104;
    const kpiW = inner / 7;
    const kpiGap = 8;
    function paintKpiBox(x, y, w, h) {
      roundBox(ctx, x, y, w, h, 8);
      ctx.fillStyle = cardBg;
      ctx.fill();
      ctx.strokeStyle = cardLine;
      ctx.stroke();
    }
    function paintKpiLine(x, y, value, label, numSize, labelSize) {
      ctx.textAlign = "left";
      ctx.fillStyle = black;
      ctx.font = "600 " + numSize + "px system-ui, -apple-system, sans-serif";
      const num = String(value);
      ctx.fillText(num, x, y);
      const numW = ctx.measureText(num).width;
      ctx.fillStyle = muted;
      ctx.font = "500 " + labelSize + "px system-ui, -apple-system, sans-serif";
      ctx.fillText(label, x + numW + 6, y);
    }
    function paintKpiCell(x, y, value, label, numSize) {
      ctx.textAlign = "left";
      ctx.fillStyle = black;
      ctx.font = "600 " + numSize + "px system-ui, -apple-system, sans-serif";
      ctx.fillText(String(value), x, y);
      ctx.fillStyle = muted;
      ctx.font = "500 10px system-ui, -apple-system, sans-serif";
      ctx.fillText(label, x, y + 14);
    }
    function paintRule(x, y, w) {
      ctx.strokeStyle = theme.rule;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.stroke();
    }
    const kpiCards = [
      function (x, y, w) {
        paintKpiBox(x, y, w, kpiH);
        paintKpiLine(x + 12, y + 28, trains, kpiWord(trains, "train", "trains"), 22, 12);
        paintRule(x + 12, y + 42, w - 24);
        paintKpiLine(x + 12, y + 62, totals.loads || 0, kpiWord(totals.loads, "load", "loads"), 14, 10);
        paintKpiLine(x + 12 + (w - 24) / 2, y + 62, totals.empties || 0, kpiWord(totals.empties, "empty", "empties"), 14, 10);
      },
      function (x, y, w) {
        paintKpiBox(x, y, w, kpiH);
        paintKpiLine(
          x + 12,
          y + 28,
          totals.days || 0,
          kpiWord(totals.days, "day trackside", "days trackside"),
          22,
          12
        );
        if (range && range !== "All Dates") {
          paintRule(x + 12, y + 42, w - 24);
          ctx.fillStyle = muted;
          ctx.font = "500 10px system-ui, -apple-system, sans-serif";
          ctx.fillText(fitText(ctx, range, w - 24), x + 12, y + 62);
        }
      },
      function (x, y, w) {
        paintKpiBox(x, y, w, kpiH);
        const loc = totals.unique_locations || 0;
        const subs = totals.unique_subdivisions || 0;
        paintKpiLine(x + 12, y + 28, loc, kpiWord(loc, "location", "locations"), 22, 12);
        paintRule(x + 12, y + 42, w - 24);
        paintKpiLine(x + 12, y + 64, subs, kpiWord(subs, "subdivision", "subdivisions"), 14, 10);
      },
      function (x, y, w) {
        paintKpiBox(x, y, w, kpiH);
        const col = (w - 24) / 2;
        paintKpiCell(x + 12, y + 28, dirs.North, "North", 16);
        paintKpiCell(x + 12 + col, y + 28, dirs.East, "East", 16);
        paintKpiCell(x + 12, y + 68, dirs.South, "South", 16);
        paintKpiCell(x + 12 + col, y + 68, dirs.West, "West", 16);
      },
      function (x, y, w) {
        paintKpiBox(x, y, w, kpiH);
        const col = (w - 24) / 2;
        paintKpiCell(x + 12, y + 36, totals.photos || 0, kpiWord(totals.photos, "photo", "photos"), 20);
        paintKpiCell(x + 12 + col, y + 36, totals.videos || 0, kpiWord(totals.videos, "video", "videos"), 20);
      },
      function (x, y, w) {
        paintKpiBox(x, y, w, kpiH);
        const col = (w - 24) / 2;
        paintKpiCell(x + 12, y + 28, totals.unique_types || 0, kpiWord(totals.unique_types, "type", "types"), 16);
        paintKpiCell(x + 12 + col, y + 28, totals.unique_consists || 0, kpiWord(totals.unique_consists, "consist", "consists"), 16);
        paintKpiCell(x + 12, y + 68, totals.unique_railroads || 0, kpiWord(totals.unique_railroads, "railroad", "railroads"), 16);
        paintKpiCell(x + 12 + col, y + 68, totals.unique_trips || 0, kpiWord(totals.unique_trips, "trip", "trips"), 16);
      },
      function (x, y, w) {
        paintKpiBox(x, y, w, kpiH);
        const col = (w - 24) / 2;
        paintKpiCell(x + 12, y + 36, totals.am || 0, "AM", 20);
        paintKpiCell(x + 12 + col, y + 36, totals.pm || 0, "PM", 20);
      },
    ];
    if (picks.totals) {
      kpiCards.forEach(function (paint, i) {
        paint(M + i * kpiW, y, kpiW - kpiGap);
      });
      y += 124;
    }

    if (showChartsLine) {
    ctx.fillStyle = muted;
    ctx.font = "11px system-ui, -apple-system, sans-serif";
    ctx.fillText(
      "Chart " +
        chartModeLabel(typeMode) +
        "  ·  " +
        typeTitle +
        "  ·  Lists " +
        "Top " +
        listTop +
        "  ·  Sort " +
        (logListSort === "name" ? "A–Z" : "most trains"),
      M,
      y + 14
    );
    y += 28;
    }
    if (showTypes) {
    paintChart(
      { x: M, y: y, w: inner, h: typeH },
      typeRows,
      chartSet.key,
      typeMode,
      typeTitle,
      typeRows.length
        ? typeRows.length +
          (chartSet.key === "railroad" ? " railroads" : chartSet.key === "type" ? " types" : typeRows.length === 1 ? " row" : " rows") +
          (chartSet.total ? "" : "  ·  " + typeTotal(typeRows) + " trains")
        : "No trains in this range",
      chartSet.total || undefined
    );
    y += typeH + 28;
    }

    if (showRoads) {
    ctx.fillStyle = black;
    ctx.font = "600 16px system-ui, -apple-system, sans-serif";
    ctx.fillText("Railroads", M, y);
    y += 12;
    if (!roads.length) {
      ctx.fillStyle = muted;
      ctx.font = "13px system-ui, -apple-system, sans-serif";
      ctx.fillText("None yet.", M, y + 24);
    } else {
      roads.forEach(function (row, i) {
        const col = i % roadCols;
        const rowI = Math.floor(i / roadCols);
        const x = M + col * (roadW + roadGap);
        const top = y + 24 + rowI * (roadCardH + roadGap);
        roundBox(ctx, x, top, roadW, roadCardH, 8);
        ctx.fillStyle = cardBg;
        ctx.fill();
        ctx.strokeStyle = cardLine;
        ctx.stroke();
        ctx.fillStyle = black;
        ctx.font = "600 22px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(String(row.trains), x + 12, top + 28);
        ctx.font = "600 13px system-ui, -apple-system, sans-serif";
        ctx.fillText(fitText(ctx, row.railroad, roadW - 24), x + 12, top + 48);
        ctx.font = "11px system-ui, -apple-system, sans-serif";
        ctx.fillStyle = muted;
        ctx.fillText(fitText(ctx, String(row.group || "").toUpperCase(), roadW - 24), x + 12, top + 64);
        const mixAll = sortBy(row.types || [], "type", "count");
        const mix = mixAll.slice(0, RR_TYPE_TOP);
        const colW = (roadW - 24) / 2;
        mix.forEach(function (item, n) {
          const c = n % 2;
          const line = Math.floor(n / 2);
          const ix = x + 12 + c * colW;
          const iy = top + 86 + line * 16;
          ctx.fillStyle = black;
          ctx.font = "11px system-ui, -apple-system, sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(fitText(ctx, item.type, colW - 30), ix, iy);
          ctx.textAlign = "right";
          ctx.fillText(String(item.trains), ix + colW - 6, iy);
          ctx.textAlign = "left";
        });
        if (mixAll.length > RR_TYPE_TOP) {
          ctx.fillStyle = muted;
          ctx.font = "11px system-ui, -apple-system, sans-serif";
          ctx.fillText("Top 6 of " + mixAll.length, x + 12, top + roadCardH - 12);
        }
      });
    }
    y += roadsH + 16;
    }

    function paintGrid(rows, top) {
      rows.forEach(function (row) {
        row.items.forEach(function (item, col) {
          paintChart(
            { x: M + col * (halfW + gridGap), y: top, w: halfW, h: row.h },
            item.rows,
            item.key,
            item.mode,
            item.title,
            item.caption,
            item.total
          );
        });
        top += row.h + gridGap;
      });
    }

    if (lists.length) {
      ctx.fillStyle = black;
      ctx.font = "600 16px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Charts", M, y);
      y += 12;
      paintGrid(listRows, y);
      y += gridH(listRows) + 20;
    }

    if (facts.length || moreSpecs.length) {
      ctx.fillStyle = black;
      ctx.font = "600 16px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("More Stats", M, y);
      y += 12;
      if (facts.length) {
        roundBox(ctx, M, y, inner, factsH, 10);
        ctx.fillStyle = cardBg;
        ctx.fill();
        ctx.strokeStyle = cardLine;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = black;
        ctx.font = "600 18px system-ui, -apple-system, sans-serif";
        ctx.fillText("At a Glance", M + 16, y + 26);
        const factW = (inner - 32) / factCols;
        facts.forEach(function (fact, i) {
          const fx = M + 16 + (i % factCols) * factW;
          const fy = y + 40 + Math.floor(i / factCols) * 52;
          ctx.fillStyle = muted;
          ctx.font = "600 11px system-ui, -apple-system, sans-serif";
          ctx.fillText(fitText(ctx, String(fact.name).toUpperCase(), factW - 12), fx, fy + 14);
          ctx.fillStyle = black;
          ctx.font = "600 20px system-ui, -apple-system, sans-serif";
          ctx.fillText(fitText(ctx, fact.value, factW - 12), fx, fy + 38);
        });
        y += factsH + gridGap;
      }
      paintGrid(moreRows, y);
      y += gridH(moreRows) + 20;
    }
    ctx.fillStyle = muted;
    ctx.font = "11px system-ui, -apple-system, sans-serif";
    ctx.fillText("Created by Michael Amrine", M, Math.min(canvas.height - 16, y));
    return canvas;
  }

  let exportRun = 0;
  let exportTimer = null;

  function exportSections() {
    return EXPORT_SECTIONS.map(function (section) {
      if (section.group !== "Log Stats") return section;
      return {
        group: section.group,
        items: section.items.concat(
          extraSlots.map(function (slot) {
            return [slot, slot];
          })
        ),
      };
    });
  }

  function renderExportPicks() {
    if (!logExportPicksEl) return;
    logExportPicksEl.innerHTML = exportSections().map(function (section) {
      return (
        '<fieldset class="export-picks-group"><legend>' +
        escapeText(section.group) +
        "</legend>" +
        section.items
          .map(function (item) {
            let label = item[1];
            if (section.group === "Log Stats" && boardSlots().indexOf(item[0]) !== -1) {
              const meta = sourceMeta(slotSource[item[0]]) || sourceMeta(item[0]);
              label = (item[0] === "types" ? "Main chart: " : "Chart: ") + meta.title;
            }
            return (
              '<label><input type="checkbox" data-export-pick="' +
              item[0] +
              '"' +
              (exportPicks[item[0]] ? " checked" : "") +
              "> " +
              escapeText(label) +
              "</label>"
            );
          })
          .join("") +
        "</fieldset>"
      );
    }).join("");
  }

  function saveExportPicks() {
    const keys = Object.keys(exportPicks).filter(function (key) {
      return exportPicks[key];
    });
    try {
      localStorage.setItem("rr-export-sections", JSON.stringify(keys));
    } catch (e) {}
    return keys;
  }

  function assembleExport() {
    const log = (catalog && catalog.log) || {};
    const run = ++exportRun;
    pendingExport.svg = null;
    pendingExport.pdf = null;
    if (logExportSvgBtn) logExportSvgBtn.disabled = true;
    if (logExportPdfBtn) logExportPdfBtn.disabled = true;
    const picked = saveExportPicks();
    if (!picked.length) {
      showExportPreview(null);
      if (logExportStatus) logExportStatus.textContent = "Pick at least one section to export.";
      return;
    }
    if (logExportStatus) logExportStatus.textContent = "Assembling…";
    const workApi = window.trainLog && window.trainLog.work;
    if (workApi) workApi.start("Assembling Log Stats…");
    const stale = function () {
      if (run === exportRun && logExportDialog.open) return false;
      if (workApi) workApi.done();
      return true;
    };
    setTimeout(function () {
      if (stale()) return;
      let svg = "";
      let pdf = null;
      try {
        const drawing = drawLogStatsVector(log, exportPicks);
        svg = vectorToSvg(drawing);
        pdf = vectorToPdf(drawing);
      } catch (err) {
        if (workApi) workApi.done();
        if (logExportStatus) logExportStatus.textContent = "Could not assemble that graph.";
        logNote("Could not assemble that graph.", "error");
        return;
      }
      pendingExport.svg = new Blob([svg], { type: "image/svg+xml" });
      pendingExport.pdf = pdf;
      showExportPreview(pendingExport.svg);
      if (logExportSvgBtn) logExportSvgBtn.disabled = false;
      if (logExportPdfBtn) logExportPdfBtn.disabled = false;
      if (logExportStatus) {
        logExportStatus.textContent =
          picked.length + (picked.length === 1 ? " section" : " sections") + " ready. SVG and PDF are vector files.";
      }
      if (workApi) workApi.done();
    }, 40);
  }

  function showExportPreview(blob) {
    if (pendingExport.preview) URL.revokeObjectURL(pendingExport.preview);
    pendingExport.preview = blob ? URL.createObjectURL(blob) : "";
    if (!logExportPreview) return;
    logExportPreview.innerHTML = pendingExport.preview
      ? '<img src="' + pendingExport.preview + '" alt="Preview of the exported graph" />'
      : '<p class="muted">Pick at least one section to see a preview.</p>';
  }

  function exportLogStats() {
    const log = (catalog && catalog.log) || {};
    const trains = (log.totals && log.totals.trains) || 0;
    if (!trains) {
      logNote("Nothing to export yet.", "error");
      return;
    }
    if (!logExportDialog) return;
    renderExportPicks();
    renderExportThemePick();
    logExportDialog.showModal();
    assembleExport();
  }

  function fillTypeRrFilter(log) {
    if (!logTypeRrEl) return;
    const current = logTypeRr;
    let html = '<option value="">All Railroads</option>';
    (log.types_by_railroad || []).forEach(function (row) {
      html +=
        '<option value="' +
        escapeText(row.railroad) +
        '">' +
        escapeText(row.railroad) +
        "</option>";
    });
    logTypeRrEl.innerHTML = html;
    logTypeRrEl.value = current;
    if (logTypeRrEl.value !== current) logTypeRr = "";
  }

  function catalogQuery() {
    const parts = [];
    if (logDateFrom) parts.push("date_from=" + encodeURIComponent(logDateFrom));
    if (logDateTo) parts.push("date_to=" + encodeURIComponent(logDateTo));
    if (logTrip) parts.push("trip_name=" + encodeURIComponent(logTrip));
    return parts.length ? "?" + parts.join("&") : "";
  }

  function tripRangeLabel(trip) {
    const from = (trip && trip.trip_date_from) || "";
    const to = (trip && trip.trip_date_to) || "";
    if (from && to && from !== to) return from + " – " + to;
    return from || to || (trip && trip.latest) || "";
  }

  function fillTripFilter() {
    if (!logTripEl) return;
    const trips = ((catalog && catalog.trips) || []).slice();
    if (logTripSort === "date") {
      trips.sort(function (a, b) {
        const latest = ((b && b.latest) || "").localeCompare((a && a.latest) || "");
        if (latest) return latest;
        return ((a && a.name) || "").localeCompare((b && b.name) || "", undefined, { sensitivity: "base" });
      });
    } else {
      trips.sort(function (a, b) {
        return ((a && a.name) || "").localeCompare((b && b.name) || "", undefined, { sensitivity: "base" });
      });
    }
    const current = logTrip;
    let html = '<option value="">All Trips</option>';
    trips.forEach(function (trip) {
      const name = (trip && trip.name) || "";
      if (!name) return;
      const range = tripRangeLabel(trip);
      html +=
        '<option value="' +
        escapeText(name) +
        '">' +
        escapeText(name + (range ? " · " + range : "")) +
        "</option>";
    });
    logTripEl.innerHTML = html;
    logTripEl.value = current;
    if (logTripEl.value !== current) logTrip = "";
    if (logTripSortEl) logTripSortEl.value = logTripSort === "date" ? "date" : "name";
    logTripEl.disabled = trips.length === 0;
  }

  function fillDateInputs(log) {
    const span = log.span || {};
    const min = span.first_date || "";
    const max = span.last_date || "";
    [logFromEl, logToEl].forEach(function (el) {
      if (!el) return;
      el.min = min;
      el.max = max;
    });
    if (logFromEl) logFromEl.value = logDateFrom;
    if (logToEl) logToEl.value = logDateTo;
  }

  function typesForFilter(log) {
    if (!logTypeRr) return log.types || [];
    const match = (log.types_by_railroad || []).filter(function (row) {
      return row.railroad === logTypeRr;
    })[0];
    return (match && match.types) || [];
  }

  const BOARD_ROW = 2;
  const BOARD_GAP = 10;
  let boardObserver = null;

  function boardCards() {
    const board = document.querySelector(".dash-log-board");
    return board ? Array.prototype.slice.call(board.querySelectorAll(".dash-board-card[data-card]")) : [];
  }

  function packBoard() {
    boardCards().forEach(function (card) {
      if (card.offsetParent === null) return;
      const h = card.getBoundingClientRect().height;
      card.style.gridRowEnd = "span " + Math.max(1, Math.ceil((h + BOARD_GAP) / BOARD_ROW));
    });
  }

  function watchBoard() {
    if (!window.ResizeObserver) return;
    if (!boardObserver) {
      boardObserver = new ResizeObserver(function () {
        window.requestAnimationFrame(packBoard);
      });
    }
    boardObserver.disconnect();
    boardCards().forEach(function (card) {
      boardObserver.observe(card);
    });
  }

  const cardPop = (function () {
    const SIZE_KEY = "rr-card-pop-size";
    let state = null;

    function keyAttr(card) {
      return card.hasAttribute("data-card") ? "data-card" : "data-set-card";
    }
    function cardTitle(card) {
      const heading =
        card.querySelector(".set-manage h3") ||
        card.querySelector(".set-tile > h3") ||
        card.querySelector("h3");
      return heading ? heading.textContent.trim() : "Card";
    }
    function savedSizes() {
      try {
        const saved = JSON.parse(localStorage.getItem(SIZE_KEY) || "{}");
        return saved && typeof saved === "object" ? saved : {};
      } catch (e) {
        return {};
      }
    }
    function popSize() {
      if (!state) return "fit";
      const saved = savedSizes()[state.attr + ":" + state.key];
      // Settings cards default to card-sized (fit). Large only if the user chose Fill Window.
      if (state.attr === "data-set-card" && saved !== "large") return "fit";
      return saved === "large" ? "large" : "fit";
    }
    function applySize(dialog) {
      const size = popSize();
      dialog.classList.toggle("is-fit", size === "fit");
      dialog.classList.toggle("is-large", size !== "fit");
      const btn = dialog.querySelector("[data-pop-size]");
      if (btn) btn.textContent = size === "fit" ? "Fill Window" : "Fit to Card";
    }
    function makeHolder(card) {
      const holder = document.createElement("section");
      const attr = keyAttr(card);
      holder.className = "dash-panel dash-board-card card-pop-holder";
      holder.setAttribute(attr, card.getAttribute(attr));
      if (card.hasAttribute("data-size")) holder.setAttribute("data-size", card.getAttribute("data-size"));
      holder.style.order = card.style.order;
      holder.style.gridRowEnd = card.style.gridRowEnd;
      holder.style.height = Math.max(96, card.offsetHeight) + "px";
      holder.innerHTML =
        '<div class="card-pop-holder-in"><strong>' +
        escapeText(cardTitle(card)) +
        '</strong><span class="muted">Open in a popup. Close it to put the card back.</span></div>';
      return holder;
    }
    function dialogFor(pane) {
      // Host on body so the popup can open from New Entry while Dashboard is display:none.
      const paneId = pane.id || "dash-pane";
      let dialog = document.querySelector('dialog.card-pop[data-pop-for="' + paneId + '"]');
      if (!dialog) {
        dialog = pane.querySelector(":scope > dialog.card-pop");
        if (dialog) {
          dialog.setAttribute("data-pop-for", paneId);
          document.body.appendChild(dialog);
        }
      }
      if (dialog) return dialog;
      dialog = document.createElement("dialog");
      dialog.className = "card-pop";
      dialog.setAttribute("data-pop-for", paneId);
      dialog.innerHTML =
        '<div class="card-pop-bar"><h2 class="card-pop-title"></h2>' +
        '<button type="button" class="btn ghost" data-pop-size></button>' +
        '<button type="button" class="btn ghost card-pop-close" data-pop-close aria-label="Close" title="Close (Esc)">×</button></div>' +
        '<div class="card-pop-body"></div>';
      document.body.appendChild(dialog);
      dialog.addEventListener("close", function () {
        if (state && state.dialog === dialog && !dialog.open) restore();
      });
      dialog.addEventListener("cancel", function (event) {
        event.preventDefault();
        close();
      });
      dialog.addEventListener("click", function (event) {
        if (event.target === dialog || event.target.closest("[data-pop-close]")) {
          close();
          return;
        }
        if (event.target.closest("[data-pop-size]") && state) {
          const sizes = savedSizes();
          sizes[state.attr + ":" + state.key] = popSize() === "fit" ? "large" : "fit";
          try {
            localStorage.setItem(SIZE_KEY, JSON.stringify(sizes));
          } catch (e) {}
          applySize(dialog);
        }
      });
      return dialog;
    }
    function relayout(board) {
      if (!board) return;
      if (board.classList.contains("dash-settings-board")) {
        settingsBoard.layout();
        if (typeof settingsExtras !== "undefined" && settingsExtras.bind) settingsExtras.bind();
      } else applyLayout();
    }
    function seat(card) {
      card.querySelectorAll("h3").forEach(function (heading) {
        heading.classList.add("card-pop-hide");
      });
      state.dialog.querySelector(".card-pop-title").textContent = cardTitle(card);
      state.dialog.setAttribute("aria-label", cardTitle(card));
      const body = state.dialog.querySelector(".card-pop-body");
      body.innerHTML = "";
      body.appendChild(card);
      state.card = card;
    }
    function open(card) {
      const board = card.closest(".dash-log-board, .dash-settings-board");
      const pane = card.closest(".dash-pane");
      if (!board || !pane) return;
      if (state) close();
      const holder = makeHolder(card);
      const dialog = dialogFor(pane);
      if (dialog.parentElement !== document.body) document.body.appendChild(dialog);
      state = { board: board, attr: keyAttr(card), key: card.getAttribute(keyAttr(card)), holder: holder, dialog: dialog, card: null };
      card.replaceWith(holder);
      seat(card);
      applySize(dialog);
      dialog.showModal();
      if (board.classList.contains("dash-settings-board") && typeof window.__settingsRememberOpen === "function") {
        window.__settingsRememberOpen(card.getAttribute(keyAttr(card)), cardTitle(card));
      }
      if (board.classList.contains("dash-settings-board")) {
        const paintSubs = function () {
          if (state && state.key !== "subdivisions") return;
          try {
            if (typeof window.__tlFillFilter === "function") window.__tlFillFilter();
            if (typeof window.__tlRenderSubs === "function") window.__tlRenderSubs();
          } catch (err) {}
        };
        // Dashboard catalog is lazy; New Entry can open Settings cards first.
        const loader = window.trainLogDashboard && window.trainLogDashboard.load;
        if (typeof loader === "function") {
          Promise.resolve(loader({ quiet: true })).then(paintSubs).catch(paintSubs);
        } else {
          paintSubs();
        }
      }
      const body = dialog.querySelector(".card-pop-body");
      body.scrollTop = 0;
      relayout(board);
    }
    function restore() {
      if (!state) return;
      const done = state;
      state = null;
      const card = done.card;
      if (card) {
        const heading = card.querySelector(".card-pop-hide");
        if (heading) heading.classList.remove("card-pop-hide");
      }
      if (card && done.holder.isConnected) {
        card.style.order = done.holder.style.order;
        if (done.holder.hasAttribute("data-size")) card.setAttribute("data-size", done.holder.getAttribute("data-size"));
        done.holder.replaceWith(card);
      } else if (done.holder.isConnected) {
        done.holder.remove();
      }
      done.dialog.querySelector(".card-pop-body").innerHTML = "";
      relayout(done.board);
      const back = done.board.querySelector('[' + done.attr + '="' + done.key + '"] .dash-pop');
      if (back) back.focus();
    }
    function close() {
      if (state && state.dialog.open) state.dialog.close();
      restore();
    }
    function sync(board) {
      if (!state || state.board !== board) return;
      const fresh = board.querySelector('.dash-board-card[' + state.attr + '="' + state.key + '"]:not(.card-pop-holder)');
      if (fresh) {
        if (state.holder.isConnected) state.holder.remove();
        state.holder = makeHolder(fresh);
        fresh.replaceWith(state.holder);
        seat(fresh);
      } else if (!state.holder.isConnected) {
        state.card = null;
        close();
      }
    }
    function addButtons(board) {
      if (!board) return;
      board.querySelectorAll(".dash-board-card:not(.card-pop-holder) .dash-card-actions").forEach(function (actions) {
        if (actions.querySelector(".dash-pop")) return;
        const card = actions.closest(".dash-board-card");
        // Settings launcher tiles already open via Open/Manage — no duplicate ⤢.
        if (card && card.closest("#dash-settings-board") && card.querySelector(":scope > .set-tile")) return;
        const title = cardTitle(card);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dash-pop";
        btn.textContent = "⤢";
        btn.title = "Open in a popup";
        btn.setAttribute("aria-label", "Open " + title + " in a popup");
        const grip = actions.querySelector(".dash-grip");
        actions.insertBefore(btn, grip || null);
      });
    }

    document.addEventListener("click", function (event) {
      const pop = event.target.closest && event.target.closest(".dash-pop");
      if (pop) {
        const card = pop.closest(".dash-board-card");
        if (card) open(card);
        return;
      }
      const openBtn = event.target.closest && event.target.closest("[data-settings-open]");
      if (openBtn) {
        event.preventDefault();
        const key = openBtn.getAttribute("data-settings-open");
        const card = document.querySelector('#dash-settings-board .dash-board-card[data-set-card="' + key + '"]');
        if (card) {
          // Opening from New Entry / elsewhere: make sure Settings packing is ready.
          try {
            if (typeof settingsBoard !== "undefined" && settingsBoard.layout) settingsBoard.layout();
            if (typeof settingsExtras !== "undefined" && settingsExtras.bind) settingsExtras.bind();
          } catch (err) {}
          open(card);
        }
        return;
      }
      // Clicking a settings launcher tile opens its manage flyout (skip real controls).
      const tile = event.target.closest && event.target.closest("#dash-settings-board > .dash-board-card[data-set-card]");
      if (tile && !tile.closest("dialog.card-pop") && !event.target.closest("button, a, input, select, textarea, label, .dash-grip, .dash-card-actions")) {
        const key = tile.getAttribute("data-set-card");
        if (key === "heritage" || key === "a250" || key === "steam") {
          const btn = tile.querySelector("[data-sp-editor]");
          if (btn) btn.click();
          return;
        }
        if (key === "symbolguide") {
          const btn = tile.querySelector("#dash-train-ref");
          if (btn) btn.click();
          return;
        }
        if (key === "placards") {
          const btn = tile.querySelector("[data-placards]");
          if (btn) btn.click();
          return;
        }
        if (key === "marks") {
          const btn = tile.querySelector("[data-aar-marks]");
          if (btn) btn.click();
          return;
        }
        if (key === "backup") {
          // Face buttons still run Backup / AirDrop / Recovery; the tile opens Local Snapshots.
          open(tile);
          if (window.trainLogDurability && window.trainLogDurability.refreshSnapshots) {
            window.trainLogDurability.refreshSnapshots();
          }
          return;
        }
        open(tile);
      }
    });
    window.addEventListener("hashchange", close);

    window.cardPopOpen = open;
    return { open: open, close: close, sync: sync, addButtons: addButtons, isOpen: function () { return Boolean(state); } };
  })();

  const CARD_SIZES = [
    ["half", "½ Col"],
    ["1", "1 Col"],
    ["2", "2 Cols"],
    ["3", "3 Cols"],
    ["full", "Full"],
  ];
  let cardSizes = {};
  try {
    cardSizes = JSON.parse(localStorage.getItem("rr-log-card-size") || "{}") || {};
  } catch (e) {
    cardSizes = {};
  }

  function defaultCardSize(name) {
    return name === "roads" ? "auto" : "1";
  }

  function cardSize(name) {
    const size = cardSizes[name];
    const known = CARD_SIZES.some(function (item) {
      return item[0] === size;
    });
    return known || (size === "auto" && name === "roads") ? size : defaultCardSize(name);
  }

  function cardSizeSelect(name, title) {
    const choices = (name === "roads" ? [["auto", "Auto"]] : []).concat(CARD_SIZES);
    const current = cardSize(name);
    return (
      '<select class="dash-card-size" data-card-size="' +
      escapeText(name) +
      '" aria-label="' +
      escapeText(title) +
      ' card width" title="Card width">' +
      choices
        .map(function (item) {
          return '<option value="' + item[0] + '"' + (item[0] === current ? " selected" : "") + ">" + item[1] + "</option>";
        })
        .join("") +
      "</select>"
    );
  }

  function applyCardSizes() {
    boardCards().forEach(function (card) {
      const name = card.getAttribute("data-card");
      card.setAttribute("data-size", cardSize(name));
      if (card.classList.contains("card-pop-holder") || card.querySelector("[data-card-size]")) return;
      const heading = card.querySelector("h3");
      let actions = card.querySelector(".dash-card-actions");
      if (!actions) {
        const holder = card.querySelector(".dash-list-head");
        if (!holder) return;
        holder.insertAdjacentHTML("beforeend", '<span class="dash-card-actions"></span>');
        actions = holder.lastElementChild;
        const grip = card.querySelector(".dash-grip");
        if (grip) actions.appendChild(grip);
      }
      actions.insertAdjacentHTML("afterbegin", cardSizeSelect(name, heading ? heading.textContent : name));
    });
  }

  function setCardSize(name, size) {
    if (size === defaultCardSize(name)) delete cardSizes[name];
    else cardSizes[name] = size;
    try {
      localStorage.setItem("rr-log-card-size", JSON.stringify(cardSizes));
    } catch (e) {}
    applyLayout();
  }

  document.addEventListener("change", function (event) {
    const name = event.target.getAttribute && event.target.getAttribute("data-card-size");
    if (name) setCardSize(name, event.target.value);
  });

  function applyLayout() {
    const board = document.querySelector(".dash-log-board");
    cardPop.sync(board);
    boardOrder = cleanBoardOrder(boardOrder);
    applyCardSizes();
    cardPop.addButtons(board);
    boardCards().forEach(function (card) {
      card.style.order = String(boardOrder.indexOf(card.getAttribute("data-card")));
    });
    packBoard();
    watchBoard();
  }

  function saveBoardOrder(order) {
    boardOrder = cleanBoardOrder(order);
    try {
      localStorage.setItem("rr-log-board-order", JSON.stringify(boardOrder));
    } catch (e) {}
    applyLayout();
  }

  function moveBoardCard(card, target, after) {
    if (card === target) return;
    const order = boardOrder.filter(function (name) {
      return name !== card;
    });
    let at = order.indexOf(target);
    if (at === -1) return;
    if (after) at += 1;
    order.splice(at, 0, card);
    saveBoardOrder(order);
  }

  function nudgeBoardCard(card, step) {
    const i = boardOrder.indexOf(card);
    const j = i + step;
    if (i === -1 || j < 0 || j >= boardOrder.length) return;
    const order = boardOrder.slice();
    order.splice(i, 1);
    order.splice(j, 0, card);
    saveBoardOrder(order);
  }

  (function wireBoardDrag() {
    const board = document.querySelector(".dash-log-board");
    if (!board) return;
    let dragging = "";
    function clearMarks() {
      boardCards().forEach(function (card) {
        card.classList.remove("is-drop-before", "is-drop-after", "is-dragging");
      });
    }
    function dropSpot(event) {
      const card = event.target.closest && event.target.closest(".dash-board-card[data-card]");
      if (!card || card.getAttribute("data-card") === dragging) return null;
      const box = card.getBoundingClientRect();
      const after =
        box.width > box.height * 1.6
          ? event.clientX > box.left + box.width / 2
          : event.clientY > box.top + box.height / 2;
      return { card: card, after: after };
    }
    board.addEventListener("pointerdown", function (event) {
      const grip = event.target.closest && event.target.closest(".dash-grip");
      const card = grip && grip.closest(".dash-board-card");
      if (card) card.setAttribute("draggable", "true");
    });
    board.addEventListener("pointerup", function () {
      if (dragging) return;
      boardCards().forEach(function (card) {
        card.removeAttribute("draggable");
      });
    });
    board.addEventListener("dragstart", function (event) {
      const card = event.target.closest && event.target.closest(".dash-board-card[draggable]");
      if (!card) return;
      dragging = card.getAttribute("data-card");
      card.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragging);
      try {
        event.dataTransfer.setDragImage(card, 24, 18);
      } catch (e) {}
    });
    board.addEventListener("dragover", function (event) {
      if (!dragging) return;
      const spot = dropSpot(event);
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      boardCards().forEach(function (card) {
        card.classList.toggle("is-drop-before", Boolean(spot && card === spot.card && !spot.after));
        card.classList.toggle("is-drop-after", Boolean(spot && card === spot.card && spot.after));
      });
    });
    board.addEventListener("drop", function (event) {
      if (!dragging) return;
      event.preventDefault();
      const spot = dropSpot(event);
      const moved = dragging;
      dragging = "";
      clearMarks();
      if (spot) moveBoardCard(moved, spot.card.getAttribute("data-card"), spot.after);
    });
    board.addEventListener("dragend", function () {
      dragging = "";
      clearMarks();
      boardCards().forEach(function (card) {
        card.removeAttribute("draggable");
      });
    });
    board.addEventListener("keydown", function (event) {
      const grip = event.target.closest && event.target.closest(".dash-grip");
      if (!grip) return;
      const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const card = grip.getAttribute("data-grip");
      nudgeBoardCard(card, step);
      const again = board.querySelector('.dash-grip[data-grip="' + card + '"]');
      if (again) again.focus();
    });
    window.addEventListener("resize", function () {
      window.requestAnimationFrame(packBoard);
    });
  })();

  const settingsBoard = (function () {
    const board = document.getElementById("dash-settings-board");
    const resetBtn = document.getElementById("dash-settings-reset");
    const DEFAULT_ORDER = ["subdivisions", "heritage", "a250", "steam", "symbolguide", "placards", "marks", "railroads", "types", "library", "backup", "paddefaults"];
    const DEFAULT_SIZES = {};
    let order = DEFAULT_ORDER.slice();
    let sizes = {};
    let observer = null;
    try {
      order = JSON.parse(localStorage.getItem("rr-settings-board-order") || "null") || order;
      sizes = JSON.parse(localStorage.getItem("rr-settings-card-size") || "{}") || {};
    } catch (e) {}

    function cleanOrder(list) {
      const kept = (Array.isArray(list) ? list : []).filter(function (name, i, all) {
        return DEFAULT_ORDER.indexOf(name) !== -1 && all.indexOf(name) === i;
      });
      DEFAULT_ORDER.forEach(function (name) {
        if (kept.indexOf(name) !== -1) return;
        // Insert missing shipped cards next to their DEFAULT_ORDER neighbors.
        const at = DEFAULT_ORDER.indexOf(name);
        let spot = kept.length;
        for (let i = at - 1; i >= 0; i -= 1) {
          const prev = kept.indexOf(DEFAULT_ORDER[i]);
          if (prev !== -1) {
            spot = prev + 1;
            break;
          }
        }
        kept.splice(spot, 0, name);
      });
      return kept;
    }
    function cards() {
      return board ? Array.prototype.slice.call(board.querySelectorAll(".dash-board-card[data-set-card]")) : [];
    }
    function sizeOf(name) {
      const size = sizes[name];
      const known = CARD_SIZES.some(function (item) {
        return item[0] === size;
      });
      return known ? size : DEFAULT_SIZES[name] || "1";
    }
    function sizeSelect(name, title) {
      const current = sizeOf(name);
      return (
        '<select class="dash-card-size" data-set-size="' +
        escapeText(name) +
        '" aria-label="' +
        escapeText(title) +
        ' card width" title="Card width">' +
        CARD_SIZES.map(function (item) {
          return '<option value="' + item[0] + '"' + (item[0] === current ? " selected" : "") + ">" + item[1] + "</option>";
        }).join("") +
        "</select>"
      );
    }
    function addActions() {
      cards().forEach(function (card) {
        if (card.classList.contains("card-pop-holder") || card.querySelector(".dash-card-actions")) return;
        const name = card.getAttribute("data-set-card");
        const tile = card.querySelector(":scope > .set-tile") || card;
        const heading = tile.querySelector("h3") || card.querySelector("h3");
        if (!heading) return;
        const title = heading.textContent || name;
        // Grip only on launcher tiles — width control retired for equal cards.
        tile.insertAdjacentHTML(
          "beforeend",
          '<span class="dash-card-actions">' + gripHtml(name, title) + "</span>"
        );
      });
    }
    function matchHeights() {
      const pair = ["heritage", "symbolguide"].map(function (name) {
        return board.querySelector('[data-set-card="' + name + '"]');
      });
      if (!pair[0] || !pair[1]) return;
      pair.forEach(function (card) {
        card.style.minHeight = "";
      });
      if (pair[0].offsetParent === null) return;
      const tallest = Math.ceil(Math.max(pair[0].getBoundingClientRect().height, pair[1].getBoundingClientRect().height));
      pair.forEach(function (card) {
        card.style.minHeight = tallest + "px";
      });
      board.style.setProperty("--set-pair", tallest + "px");
    }
    function pack() {
      if (!board) return;
      // Launcher tiles are equal CSS grid cells — no masonry span packing.
      cards().forEach(function (card) {
        card.style.gridRowEnd = "";
        card.style.minHeight = "";
      });
      board.style.removeProperty("--set-pair");
    }
    function changed() {
      return order.join() !== DEFAULT_ORDER.join() || Object.keys(sizes).length > 0;
    }
    function layout() {
      if (!board) return;
      order = cleanOrder(order);
      cardPop.sync(board);
      addActions();
      cardPop.addButtons(board);
      cards().forEach(function (card) {
        const name = card.getAttribute("data-set-card");
        card.setAttribute("data-size", sizeOf(name));
        card.style.order = String(order.indexOf(name));
        const select = card.querySelector("[data-set-size]");
        if (select) select.value = sizeOf(name);
      });
      if (resetBtn) resetBtn.hidden = !changed();
      pack();
      window.requestAnimationFrame(function () {
        pack();
      });
      if (window.ResizeObserver) {
        if (!observer) {
          let packTimer = 0;
          observer = new ResizeObserver(function () {
            clearTimeout(packTimer);
            packTimer = setTimeout(function () {
              window.requestAnimationFrame(pack);
            }, 80);
          });
        }
        observer.disconnect();
        cards().forEach(function (card) {
          observer.observe(card);
        });
      }
    }
    function save() {
      try {
        localStorage.setItem("rr-settings-board-order", JSON.stringify(order));
        localStorage.setItem("rr-settings-card-size", JSON.stringify(sizes));
      } catch (e) {}
      layout();
    }
    function move(card, target, after) {
      if (card === target) return;
      const next = order.filter(function (name) {
        return name !== card;
      });
      let at = next.indexOf(target);
      if (at === -1) return;
      if (after) at += 1;
      next.splice(at, 0, card);
      order = next;
      save();
    }
    function nudge(card, step) {
      const i = order.indexOf(card);
      const j = i + step;
      if (i === -1 || j < 0 || j >= order.length) return;
      order.splice(i, 1);
      order.splice(j, 0, card);
      save();
    }

    if (board) {
      let dragging = "";
      const clearMarks = function () {
        cards().forEach(function (card) {
          card.classList.remove("is-drop-before", "is-drop-after", "is-dragging");
        });
      };
      const dropSpot = function (event) {
        const card = event.target.closest && event.target.closest(".dash-board-card[data-set-card]");
        if (!card || card.getAttribute("data-set-card") === dragging) return null;
        const box = card.getBoundingClientRect();
        const after =
          box.width > box.height * 1.6 ? event.clientX > box.left + box.width / 2 : event.clientY > box.top + box.height / 2;
        return { card: card, after: after };
      };
      board.addEventListener("change", function (event) {
        const name = event.target.getAttribute && event.target.getAttribute("data-set-size");
        if (!name) return;
        if (event.target.value === (DEFAULT_SIZES[name] || "1")) delete sizes[name];
        else sizes[name] = event.target.value;
        save();
      });
      board.addEventListener("pointerdown", function (event) {
        const grip = event.target.closest && event.target.closest(".dash-grip");
        const card = grip && grip.closest(".dash-board-card");
        if (card) card.setAttribute("draggable", "true");
      });
      board.addEventListener("pointerup", function () {
        if (dragging) return;
        cards().forEach(function (card) {
          card.removeAttribute("draggable");
        });
      });
      board.addEventListener("dragstart", function (event) {
        const card = event.target.closest && event.target.closest(".dash-board-card[draggable]");
        if (!card) return;
        dragging = card.getAttribute("data-set-card");
        card.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", dragging);
        try {
          event.dataTransfer.setDragImage(card, 24, 18);
        } catch (e) {}
      });
      board.addEventListener("dragover", function (event) {
        if (!dragging) return;
        const spot = dropSpot(event);
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        cards().forEach(function (card) {
          card.classList.toggle("is-drop-before", Boolean(spot && card === spot.card && !spot.after));
          card.classList.toggle("is-drop-after", Boolean(spot && card === spot.card && spot.after));
        });
      });
      board.addEventListener("drop", function (event) {
        if (!dragging) return;
        event.preventDefault();
        const spot = dropSpot(event);
        const moved = dragging;
        dragging = "";
        clearMarks();
        if (spot) move(moved, spot.card.getAttribute("data-set-card"), spot.after);
      });
      board.addEventListener("dragend", function () {
        dragging = "";
        clearMarks();
        cards().forEach(function (card) {
          card.removeAttribute("draggable");
        });
      });
      board.addEventListener("keydown", function (event) {
        const grip = event.target.closest && event.target.closest(".dash-grip");
        if (!grip) return;
        const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
        if (!step) return;
        event.preventDefault();
        const card = grip.getAttribute("data-grip");
        nudge(card, step);
        const again = board.querySelector('.dash-grip[data-grip="' + card + '"]');
        if (again) again.focus();
      });
      window.addEventListener("resize", function () {
        window.requestAnimationFrame(pack);
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        order = DEFAULT_ORDER.slice();
        sizes = {};
        try {
          localStorage.removeItem("rr-settings-board-order");
          localStorage.removeItem("rr-settings-card-size");
        } catch (e) {}
        layout();
      });
    }
    return { layout: layout, order: function () { return order.slice(); } };
  })();

  const settingsExtras = (function () {
    const RECENT_KEY = "rr-settings-recent";
    const PAD_KEY = "rr-pad-defaults";
    const TITLES = {
      subdivisions: "Subdivisions",
      heritage: "Heritage Units",
      a250: "America 250",
      steam: "Steam Engines",
      symbolguide: "Symbol Guide",
      placards: "Placards",
      marks: "Reporting Marks",
      railroads: "Railroads",
      types: "Train Types",
      library: "Railroad Library",
      backup: "Backup",
      paddefaults: "Pad Defaults",
    };

    function readRecent() {
      try {
        const list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
        return Array.isArray(list) ? list.filter(function (item) { return item && item.key; }).slice(0, 5) : [];
      } catch (e) {
        return [];
      }
    }
    function writeRecent(list) {
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5)));
      } catch (e) {}
    }
    function rememberOpen(key, title) {
      /* Settings search/recents stay off the Settings pad. */
    }
    function paintRecent() {
      const wrap = document.getElementById("dash-settings-recent");
      const list = document.getElementById("dash-settings-recent-list");
      if (!wrap || !list) return;
      wrap.hidden = true;
      list.innerHTML = "";
    }
    function filterTiles(query) {
      const q = String(query || "").trim().toLowerCase();
      document.querySelectorAll("#dash-settings-board > .dash-board-card[data-set-card]").forEach(function (card) {
        if (!q) {
          card.classList.remove("is-settings-filtered");
          return;
        }
        const text = (card.textContent || "").replace(/\s+/g, " ").toLowerCase();
        card.classList.toggle("is-settings-filtered", text.indexOf(q) === -1);
      });
    }
    function readPadDefaults() {
      try {
        const raw = JSON.parse(localStorage.getItem(PAD_KEY) || "{}");
        return raw && typeof raw === "object" ? raw : {};
      } catch (e) {
        return {};
      }
    }
    function writePadDefaults(data) {
      try {
        localStorage.setItem(PAD_KEY, JSON.stringify(data || {}));
      } catch (e) {}
    }
    function railroadNames() {
      const names = (window.RAILROADS_FOR_SETTINGS || []).slice();
      if (!names.length) {
        const sample = document.querySelector("#rows .f-rr, .f-rr");
        if (sample) {
          Array.prototype.forEach.call(sample.options, function (opt) {
            if (opt.value && opt.value !== "Other") names.push(opt.value);
          });
        }
      }
      return names;
    }
    function fillSelectOptions(sel, values, blankLabel, current) {
      if (!sel) return;
      const keep = current != null ? current : sel.value;
      const seen = {};
      sel.innerHTML = '<option value="">' + escapeText(blankLabel || "No default") + "</option>";
      (values || []).forEach(function (name) {
        if (!name || seen[name]) return;
        seen[name] = true;
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
      });
      if (keep) sel.value = keep;
      if (keep && sel.value !== keep) {
        const opt = document.createElement("option");
        opt.value = keep;
        opt.textContent = keep;
        sel.appendChild(opt);
        sel.value = keep;
      }
    }
    function fillPadRailroadSelect() {
      const sel = document.getElementById("dash-pad-default-rr");
      const data = readPadDefaults();
      fillSelectOptions(sel, railroadNames(), "Choose…", data.railroad || "");
    }
    function fillPadTrainTypeSelect() {
      const sel = document.getElementById("dash-pad-train-type");
      const types = (window.TRAIN_TYPES_FOR_SETTINGS || []).slice();
      if (!types.length) {
        document.querySelectorAll("#rows .chip[data-type]").forEach(function (chip) {
          const t = chip.getAttribute("data-type");
          if (t && types.indexOf(t) === -1) types.push(t);
        });
      }
      fillSelectOptions(sel, types, "None", readPadDefaults().trainType || "");
    }
    function currentPadRailroad() {
      const modeEl = document.getElementById("dash-pad-rr-mode");
      const rrSel = document.getElementById("dash-pad-default-rr");
      const mode = (modeEl && modeEl.value) || "none";
      if (mode === "fixed" && rrSel) return String(rrSel.value || "").trim();
      const data = readPadDefaults();
      const savedMode = data.railroadMode || (data.railroad ? "fixed" : "none");
      if (savedMode === "fixed") return String(data.railroad || "").trim();
      if (savedMode === "last") return String(data.lastRailroad || "").trim();
      return "";
    }
    async function loadPadGroupedSubs() {
      if (window.SUBS_BY_RR_FOR_SETTINGS) return window.SUBS_BY_RR_FOR_SETTINGS;
      try {
        const res = await fetch("/api/subdivisions");
        const body = await res.json();
        window.SUBS_BY_RR_FOR_SETTINGS = (body && (body.grouped || body)) || {};
      } catch (e) {
        window.SUBS_BY_RR_FOR_SETTINGS = {};
      }
      return window.SUBS_BY_RR_FOR_SETTINGS;
    }
    async function fetchPadStations(subdivision, railroad) {
      if (!subdivision) return [];
      const params = new URLSearchParams();
      params.set("subdivision", subdivision);
      params.set("q", "");
      if (railroad) params.set("railroad", railroad);
      try {
        const res = await fetch("/api/locations/autocomplete?" + params.toString());
        const body = await res.json();
        return Array.isArray(body) ? body : [];
      } catch (e) {
        return [];
      }
    }
    function stationLabel(item) {
      return String((item && (item.location_spot_label || item.location_spot)) || "").trim();
    }
    async function fillPadHomeSubSelect() {
      const sel = document.getElementById("dash-pad-home-sub");
      if (!sel) return;
      const data = readPadDefaults();
      const rr = currentPadRailroad();
      const grouped = await loadPadGroupedSubs();
      const seen = {};
      const names = [];
      Object.keys(grouped || {}).forEach(function (key) {
        if (rr && key !== rr) return;
        (grouped[key] || []).forEach(function (name) {
          if (!name || seen[name]) return;
          seen[name] = true;
          names.push(name);
        });
      });
      // If fixed railroad has none yet, still show full alpha list so the control isn't empty
      if (!names.length) {
        Object.keys(grouped || {}).forEach(function (key) {
          (grouped[key] || []).forEach(function (name) {
            if (!name || seen[name]) return;
            seen[name] = true;
            names.push(name);
          });
        });
      }
      names.sort(function (a, b) { return a.localeCompare(b, undefined, { sensitivity: "base" }); });
      const current = (document.getElementById("dash-pad-home-sub") || {}).value || data.homeSubdivision || "";
      fillSelectOptions(sel, names, "None", current);
    }
    async function fillPadHomeStationAndState(opts) {
      opts = opts || {};
      const subSel = document.getElementById("dash-pad-home-sub");
      const stationSel = document.getElementById("dash-pad-home-station");
      const stateSel = document.getElementById("dash-pad-home-state");
      if (!stationSel || !stateSel) return;
      const data = readPadDefaults();
      const sub = (subSel && subSel.value) || "";
      const keepStation = opts.station != null ? opts.station : (stationSel.value || data.homeStation || data.homeLocation || "");
      const keepState = opts.state != null ? opts.state : (stateSel.value || data.homeState || "");
      if (!sub) {
        stationSel._padStations = [];
        fillSelectOptions(stationSel, [], "Pick a subdivision first", "");
        fillSelectOptions(stateSel, [], "—", "");
        stationSel.disabled = true;
        stateSel.disabled = true;
        return;
      }
      stationSel.disabled = false;
      stateSel.disabled = false;
      const items = await fetchPadStations(sub, currentPadRailroad());
      items.sort(function (a, b) {
        return stationLabel(a).localeCompare(stationLabel(b), undefined, { sensitivity: "base" });
      });
      stationSel._padStations = items;
      const labels = [];
      const seen = {};
      items.forEach(function (item) {
        const label = stationLabel(item);
        if (!label || seen[label]) return;
        seen[label] = true;
        labels.push(label);
      });
      const stateFiltered = keepState
        ? items.filter(function (item) { return String(item.location_state || "") === keepState; })
        : items;
      // Rebuild station list; if state filter empties it, show all
      const useItems = stateFiltered.length ? stateFiltered : items;
      const useLabels = [];
      const seen2 = {};
      useItems.forEach(function (item) {
        const label = stationLabel(item);
        if (!label || seen2[label]) return;
        seen2[label] = true;
        useLabels.push(label);
      });
      let stationValue = keepStation;
      if (stationValue && useLabels.indexOf(stationValue) === -1 && labels.indexOf(stationValue) === -1) {
        stationValue = "";
      }
      if (stationValue && useLabels.indexOf(stationValue) === -1) {
        // Selected station isn't in this state — clear so State actually filters the list
        stationValue = "";
      }
      fillSelectOptions(stationSel, useLabels.length ? useLabels : labels, "None", stationValue);

      const states = [];
      const stateSeen = {};
      items.forEach(function (item) {
        const code = String(item.location_state || "").trim().toUpperCase();
        if (!code || stateSeen[code]) return;
        stateSeen[code] = true;
        states.push(code);
      });
      states.sort();
      fillSelectOptions(stateSel, states, "—", keepState);

      // If station known, sync state from book unless user already picked one that matches list
      if (keepStation) {
        const match = items.filter(function (item) { return stationLabel(item) === keepStation; })[0];
        if (match && match.location_state) {
          if (!keepState || states.indexOf(keepState) === -1) stateSel.value = match.location_state;
        }
      }
    }
    function syncPadFormVisibility() {
      const rrMode = (document.getElementById("dash-pad-rr-mode") || {}).value || "none";
      const rrFixed = rrMode === "fixed";
      const rrWrap = document.getElementById("dash-pad-rr-wrap");
      const fixedRow = document.getElementById("dash-pad-fixed-row");
      if (rrWrap) rrWrap.hidden = !rrFixed;
      if (fixedRow) {
        fixedRow.hidden = !rrFixed;
        fixedRow.classList.toggle("is-single", true);
      }
    }
    async function paintPadForm() {
      const data = readPadDefaults();
      const rrModeEl = document.getElementById("dash-pad-rr-mode");
      const timeEl = document.getElementById("dash-pad-time-mode");
      const afterEl = document.getElementById("dash-pad-after-submit");
      const blankEl = document.getElementById("dash-pad-blank-cards");
      const otherEl = document.getElementById("dash-pad-home-loc-other");
      // Migrate old railroad-only saves
      let rrMode = data.railroadMode || "";
      if (!rrMode) rrMode = data.railroad ? "fixed" : "none";
      if (rrModeEl) rrModeEl.value = rrMode;
      if (timeEl) timeEl.value = data.timeMode === "now" ? "now" : "blank";
      if (afterEl) afterEl.value = data.afterSubmit || "clear";
      if (blankEl) blankEl.value = String(data.blankCards >= 3 ? 3 : data.blankCards === 2 ? 2 : 1);
      // Migrate old homeLocation into station or other
      let station = data.homeStation || "";
      let other = data.homeLocationOther || "";
      if (!station && !other && data.homeLocation) {
        station = data.homeLocation;
      }
      if (otherEl) otherEl.value = other;
      fillPadRailroadSelect();
      fillPadTrainTypeSelect();
      await fillPadHomeSubSelect();
      const rrSel = document.getElementById("dash-pad-default-rr");
      if (rrSel) rrSel.value = data.railroad || "";
      const typeSel = document.getElementById("dash-pad-train-type");
      if (typeSel) typeSel.value = data.trainType || "";
      const subSel = document.getElementById("dash-pad-home-sub");
      if (subSel && data.homeSubdivision) subSel.value = data.homeSubdivision;
      await fillPadHomeStationAndState({ station: station, state: data.homeState || "" });
      syncPadFormVisibility();
    }
    function savePadForm() {
      const prev = readPadDefaults();
      const rrMode = ((document.getElementById("dash-pad-rr-mode") || {}).value) || "none";
      const rrSel = document.getElementById("dash-pad-default-rr");
      const data = {
        preferNight: Boolean(prev.preferNight),
        railroadMode: rrMode,
        railroad: rrMode === "fixed" && rrSel ? String(rrSel.value || "").trim() : "",
        timeMode: ((document.getElementById("dash-pad-time-mode") || {}).value) === "now" ? "now" : "blank",
        afterSubmit: ((document.getElementById("dash-pad-after-submit") || {}).value) || "clear",
        blankCards: (function () { const n = Number(((document.getElementById("dash-pad-blank-cards") || {}).value) || 1); return n >= 3 ? 3 : n >= 2 ? 2 : 1; })(),
        trainType: String(((document.getElementById("dash-pad-train-type") || {}).value) || "").trim(),
        homeSubdivision: String(((document.getElementById("dash-pad-home-sub") || {}).value) || "").trim(),
        homeStation: String(((document.getElementById("dash-pad-home-station") || {}).value) || "").trim(),
        homeLocationOther: String(((document.getElementById("dash-pad-home-loc-other") || {}).value) || "").trim(),
        homeLocation: String(((document.getElementById("dash-pad-home-station") || {}).value) || ((document.getElementById("dash-pad-home-loc-other") || {}).value) || "").trim(),
        homeState: String(((document.getElementById("dash-pad-home-state") || {}).value) || "").trim(),
        lastRailroad: prev.lastRailroad || "",
      };
      if (["clear", "keep-railroad", "keep-place"].indexOf(data.afterSubmit) === -1) data.afterSubmit = "clear";
      writePadDefaults(data);
      if (window.__padDefaultsChanged) window.__padDefaultsChanged(data);
      const status = document.getElementById("dash-pad-defaults-status");
      if (status) {
        status.hidden = false;
        status.textContent = "Saved on this Mac.";
        window.setTimeout(function () { status.hidden = true; }, 1800);
      }
    }
    async function paintAttention() {
      const marksEl = document.querySelector('[data-attn="marks"]');
      const libEl = document.querySelector('[data-attn="library"]');
      let checkCount = 0;
      try {
        const res = await fetch("/api/library");
        const data = await res.json();
        const rows = (data && (data.rows || data.library || data)) || [];
        if (Array.isArray(rows)) {
          checkCount = rows.filter(function (row) { return row && row.mark_status === "check"; }).length;
        }
      } catch (e) {}
      if (libEl) {
        if (checkCount > 0) {
          libEl.hidden = false;
          libEl.innerHTML = '<span class="badge">' + checkCount + "</span> marks need confirming";
        } else {
          libEl.hidden = true;
          libEl.textContent = "";
        }
      }
      // Marks card: mirror library attention when Check marks exist
      if (marksEl) {
        if (checkCount > 0) {
          marksEl.hidden = false;
          marksEl.innerHTML = '<span class="badge">' + checkCount + "</span> related library checks";
        } else {
          marksEl.hidden = true;
          marksEl.textContent = "";
        }
      }
      // Import review pending badge already exists elsewhere; surface on board if pending count known
      const pending = document.querySelector(".pending-badge");
      const n = pending && !pending.hidden ? Number(pending.textContent || 0) : 0;
      // no dedicated import card on settings — skip
    }
    function bind() {

    try {
      const raw = JSON.parse(localStorage.getItem("rr-card-pop-size") || "{}");
      let changed = false;
      Object.keys(raw || {}).forEach(function (key) {
        if (key.indexOf("data-set-card:") === 0 && raw[key] === "large") {
          delete raw[key];
          changed = true;
        }
      });
      if (changed) localStorage.setItem("rr-card-pop-size", JSON.stringify(raw));
    } catch (e) {}
    /* cleared settings large */
      /* settings search/recents stay removed */
      const backup = document.getElementById("dash-settings-backup");
      if (backup && !backup._bound) {
        backup._bound = true;
        backup.addEventListener("click", function () {
          const logBtn = document.getElementById("btn-backup");
          if (logBtn) logBtn.click();
          else window.location.href = "/api/database/backup";
        });
      }
      const airdrop = document.getElementById("dash-settings-airdrop");
      if (airdrop && !airdrop._bound) {
        airdrop._bound = true;
        airdrop.addEventListener("click", function () {
          const logBtn = document.getElementById("btn-backup-airdrop");
          if (logBtn) logBtn.click();
        });
      }
      const recovery = document.getElementById("dash-settings-recovery");
      if (recovery && !recovery._bound) {
        recovery._bound = true;
        recovery.addEventListener("click", function () {
          const logBtn = document.getElementById("btn-recovery-pack");
          if (logBtn) logBtn.click();
        });
      }
      const savePad = document.getElementById("dash-pad-defaults-save");
      if (savePad && !savePad._bound) {
        savePad._bound = true;
        savePad.addEventListener("click", savePadForm);
      }
      const rrMode = document.getElementById("dash-pad-rr-mode");
      const rrSel = document.getElementById("dash-pad-default-rr");
      if (rrMode && !rrMode._bound) {
        rrMode._bound = true;
        rrMode.addEventListener("change", async function () {
          syncPadFormVisibility();
          await fillPadHomeSubSelect();
          await fillPadHomeStationAndState();
        });
      }
      if (rrSel && !rrSel._boundPad) {
        rrSel._boundPad = true;
        rrSel.addEventListener("change", async function () {
          await fillPadHomeSubSelect();
          await fillPadHomeStationAndState();
        });
      }
      const homeSub = document.getElementById("dash-pad-home-sub");
      if (homeSub && !homeSub._boundPad) {
        homeSub._boundPad = true;
        homeSub.addEventListener("change", function () {
          fillPadHomeStationAndState({ station: "", state: "" });
        });
      }
      const homeStation = document.getElementById("dash-pad-home-station");
      if (homeStation && !homeStation._boundPad) {
        homeStation._boundPad = true;
        homeStation.addEventListener("change", function () {
          const items = homeStation._padStations || [];
          const label = homeStation.value;
          const match = items.filter(function (item) { return stationLabel(item) === label; })[0];
          const stateSel = document.getElementById("dash-pad-home-state");
          if (match && match.location_state && stateSel) stateSel.value = match.location_state;
        });
      }
      const homeState = document.getElementById("dash-pad-home-state");
      if (homeState && !homeState._boundPad) {
        homeState._boundPad = true;
        homeState.addEventListener("change", function () {
          const stationSel = document.getElementById("dash-pad-home-station");
          fillPadHomeStationAndState({
            station: stationSel ? stationSel.value : "",
            state: homeState.value || "",
          });
        });
      }
      paintRecent();
      paintPadForm();
      paintAttention();
    }
    window.__settingsRememberOpen = rememberOpen;
    window.__padDefaults = readPadDefaults;
    return { bind: bind, rememberOpen: rememberOpen, readPadDefaults: readPadDefaults, paintAttention: paintAttention };
  })();



  function paintGlance(log, trains) {
    const el = document.getElementById("dash-log-glance");
    if (!el) return;
    const g = log.glance || {};
    if (!trains) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    el.hidden = false;
    const last = g.last_sighting || null;
    const streak = g.streak_days || 0;
    const pct = g.collection_pct || 0;
    const hunt = g.hunt_left || 0;
    const cells = [
      {
        tint: "when",
        label: "Last sighting",
        value: last && last.label ? last.label : "—",
      },
      {
        tint: "where",
        label: "Open trip",
        value: g.open_trip || "—",
      },
      {
        tint: "progress",
        label: "Current streak",
        value: streak ? streak + (streak === 1 ? " day" : " days") : "—",
      },
      {
        tint: "progress",
        label: "Collection",
        value: (g.collection_total ? pct + "%" : "—") + (hunt ? " · " + hunt + " still hunting" : ""),
      },
    ];
    el.innerHTML =
      '<div class="dash-glance-grid">' +
      cells
        .map(function (cell) {
          return (
            '<div class="dash-glance-card" data-kpi="' +
            escapeText(cell.tint) +
            '"><span class="dash-glance-label">' +
            escapeText(cell.label) +
            '</span><b class="dash-glance-value">' +
            escapeText(cell.value) +
            "</b></div>"
          );
        })
        .join("") +
      "</div>";
  }

  function huntBody(log) {
    const hunt = (log.collection && log.collection.hunt) || {};
    const groups = [
      ["heritage", "Heritage units"],
      ["a250", "America 250"],
      ["steam", "Steam engines"],
      ["railroads", "Railroads on your list"],
    ];
    const blocks = groups
      .map(function (pair) {
        const rows = hunt[pair[0]] || [];
        if (!rows.length) {
          return (
            '<div class="hunt-group"><h4 class="progress-head">' +
            escapeText(pair[1]) +
            '</h4><p class="muted">All caught up.</p></div>'
          );
        }
        return (
          '<div class="hunt-group"><h4 class="progress-head">' +
          escapeText(pair[1]) +
          " · " +
          rows.length +
          " left</h4><ul class=\"hunt-list\">" +
          rows
            .slice(0, 40)
            .map(function (row) {
              return (
                "<li><span>" +
                escapeText(row.name) +
                "</span>" +
                (row.detail ? '<span class="muted">' + escapeText(row.detail) + "</span>" : "") +
                "</li>"
              );
            })
            .join("") +
          (rows.length > 40 ? '<li class="muted">+' + (rows.length - 40) + " more</li>" : "") +
          "</ul></div>"
        );
      })
      .filter(Boolean);
    if (!blocks.length) return '<p class="muted">Nothing to hunt yet — add heritage, steam, or railroads first.</p>';
    return blocks.join("");
  }

  function mediaRateBody(log) {
    const rows = log.media_rate || [];
    if (!rows.length) return '<p class="muted">None yet.</p>';
    return (
      '<table class="sightings-table"><thead><tr><th>Month</th><th>Trains</th><th>Photo</th><th>Video</th><th>Either</th><th>Notes</th></tr></thead><tbody>' +
      rows
        .slice(0, 24)
        .map(function (row) {
          return (
            "<tr><td><strong>" +
            escapeText(row.month) +
            "</strong></td><td>" +
            row.trains +
            "</td><td>" +
            row.photo_pct +
            "%</td><td>" +
            row.video_pct +
            "%</td><td>" +
            row.media_pct +
            "%</td><td>" +
            row.notes_pct +
            "%</td></tr>"
          );
        })
        .join("") +
      '</tbody></table><p class="muted">Share of trains that month with a photo, video, either, or notes.</p>'
    );
  }

  function renderLog() {
    const log = (catalog && catalog.log) || {};
    const totals = log.totals || {};
    const span = log.span || {};
    const trains = totals.trains || 0;
    const bookTrains = span.trains || trains;
    fillDateInputs(log);
    fillTripFilter();
    if (logEmptyEl) {
      if (!bookTrains) {
        logEmptyEl.hidden = false;
        logEmptyEl.textContent = "No trains logged yet. Sightings on the pad will show up here.";
      } else if (!trains) {
        logEmptyEl.hidden = false;
        if (logTrip && (logDateFrom || logDateTo)) {
          logEmptyEl.textContent = "No trains match those filters.";
        } else if (logTrip) {
          logEmptyEl.textContent = "No trains in that trip.";
        } else {
          logEmptyEl.textContent = "No trains in that date range.";
        }
      } else {
        logEmptyEl.hidden = true;
      }
    }
    if (logToolsEl) logToolsEl.hidden = bookTrains === 0;
    const board = document.querySelector(".dash-log-board");
    if (board) board.hidden = trains === 0;
    paintGlance(log, trains);
    applyLayout();
    const range =
      totals.first_date && totals.last_date
        ? totals.first_date === totals.last_date
          ? totals.first_date
          : totals.first_date + " – " + totals.last_date
        : "—";
    const dirs = directionStats(log);
    const loc = totals.unique_locations || 0;
    const subs = totals.unique_subdivisions || 0;
    const photos = totals.photos || 0;
    const videos = totals.videos || 0;
    const days = totals.days || 0;
    const dayCount = days || 1;
    const avg = trains ? (trains / dayCount).toFixed(1) : "0";
    const either = totals.media != null ? totals.media : Math.max(0, photos + videos - (totals.both_media || 0));
    const mediaPct = trains ? Math.round((100 * either) / trains) : 0;
    const special = specialTrainCounts(log);
    const meetsTotal = ((log.meets || {}).total) || 0;
    if (logKpisEl) {
      logKpisEl.classList.add("is-e4");
      logKpisEl.innerHTML =
        kpiTileCard([
          { value: trains, label: "Trains" },
          { value: totals.loads || 0, label: "Loads" },
          { value: totals.empties || 0, label: "Empties" },
          { value: totals.night || 0, label: "Night" },
        ], "trains") +
        kpiTileCard([
          { value: days, label: "Days" },
          { value: avg, label: "Avg" },
          { value: totals.am || 0, label: "AM" },
          { value: totals.pm || 0, label: "PM" },
        ], "when") +
        kpiTileCard([
          { value: loc, label: "Spots" },
          { value: subs, label: "Subs" },
          { value: (log.states || []).length, label: "States" },
          { value: totals.unique_trips || 0, label: "Trips" },
        ], "where") +
        kpiTileCard([
          { value: dirs.North, label: "North" },
          { value: dirs.East, label: "East" },
          { value: dirs.South, label: "South" },
          { value: dirs.West, label: "West" },
        ], "direction") +
        kpiTileCard([
          { value: photos, label: "Photos" },
          { value: videos, label: "Videos" },
          { value: mediaPct + "%", label: "Either" },
          { value: totals.notes || 0, label: "Notes" },
        ], "media") +
        kpiTileCard([
          { value: (log.symbols || []).length, label: "Symbols" },
          { value: totals.unique_types || 0, label: "Types" },
          { value: totals.unique_leads || 0, label: "Leads" },
          { value: totals.unique_consists || 0, label: "Consists" },
        ], "symbols") +
        kpiTileCard(topRailroadTiles(log), "mix") +
        kpiTileCard([
          { value: special.heritage, label: "Heritage" },
          { value: special.steam, label: "Steam" },
          { value: special.a250, label: "A250" },
          { value: meetsTotal, label: "Meets" },
        ], "special");
    }
    if (!trains) {
      if (logRoadsEl) logRoadsEl.innerHTML = "";
      if (logTypesEl) logTypesEl.innerHTML = "";
      if (logListsEl) logListsEl.innerHTML = "";
      return;
    }
    fillTypeRrFilter(log);
    const roads = sortBy(
      (log.railroads || []).filter(function (row) {
        return row.trains > 0;
      }),
      "railroad",
      logRrSort
    );
    logRoadsEl.innerHTML = roads
      .map(function (row) {
        return roadCardHtml(row, true, true);
      })
      .join("");
    logRoadsEl.setAttribute("data-drill-source", "railroads");
    const roadsCaption = document.getElementById("dash-log-roads-caption");
    if (roadsCaption) {
      roadsCaption.textContent = roads.length + (roads.length === 1 ? " railroad" : " railroads") + ", top " + RR_TYPE_TOP + " types each";
    }
    const roadsCard = document.getElementById("dash-log-mid");
    if (roadsCard) roadsCard.classList.toggle("is-few", roads.length <= 3);
    const chartSet = boardSpec(log, "types");
    if (logListTopEl) logListTopEl.value = String(listTop);
    logTypesEl.innerHTML =
      '<section class="dash-panel dash-types-panel dash-board-card' +
      (chartSet.cards ? " is-cards" : "") +
      '" data-slot="types" data-card="types" data-group="Trains"><div class="dash-types-head"><div class="dash-card-title"><h3>' +
      escapeText(chartSet.title) +
      '</h3><span class="dash-card-actions">' +
      gripHtml("types", chartSet.title) +
      '</span></div><div class="dash-types-tools">' +
      sourceSelect("types") +
      (chartSet.cards ? "" : chartModeSelect(chartSet.title, "types", logTypeChart)) +
      "</div></div><div class=\"dash-types-body\">" +
      (chartSet.rows.length
        ? chartSet.cards
          ? roadCardsHtml(chartSet.rows, true)
          : typeChart(chartSet.rows, chartSet.key, logTypeChart, {
              keepOrder: chartSet.keepOrder,
              total: chartSet.total || undefined,
              drill: DRILLABLE.has(chartSet.id),
            })
        : '<p class="muted">' + escapeText(chartSet.empty) + "</p>") +
      "</div></section>";
    logListsEl.innerHTML = listSlots().map(function (kind) {
      return listTile(log, kind);
    }).join("");
    fillSplits();
    applyLayout();
    if (window.trainLog && window.trainLog.fillAcroKey) {
      window.trainLog.fillAcroKey(
        (catalog && catalog.meanings) || {},
        (catalog && catalog.groups) || [],
        (catalog && catalog.types) || []
      );
    }
  }

  function moreStatsSpecs(log) {
    const trains = (log.totals && log.totals.trains) || 0;
    const roads = (log.railroads || [])
      .filter(function (row) {
        return row.trains > 0;
      })
      .sort(function (a, b) {
        return b.trains - a.trains || String(a.railroad).localeCompare(String(b.railroad));
      });
    return [
      { kind: "milestones", group: "Progress", title: "Streaks and Milestones", render: milestonesBody, hint: "Days in a row trackside, and your 1st, 100th, 1,000th train and more." },
      { kind: "collection", group: "Progress", title: "Collection Progress", render: collectionBody, hint: "How much of each list you have seen, and the stations you have logged on each subdivision." },
      { kind: "huntlist", group: "Progress", title: "Hunt List", render: huntBody, hint: "What is still unseen from the heritage, America 250, steam, and railroad lists." },
      { kind: "runningtotals", group: "Progress", title: "Running Totals", render: runningTotalsBody, hint: "Month by month: how many different lead locos, railroads, and locations you have seen so far." },
      { kind: "firsts", group: "Progress", title: "Firsts by Month", render: firstsBody, tool: firstsTool, hint: "The railroads, heritage units, states, and train types you saw for the first time ever, month by month." },
      { kind: "hours", group: "When", title: "Hour of Day", rows: log.hours, key: "hour", keepOrder: true },
      { kind: "dayparts", group: "When", title: "Time of Day", rows: log.day_parts, key: "part", keepOrder: true, hint: "Night is midnight–6 AM, Morning 6 AM–noon, Afternoon noon–6 PM, Evening 6 PM–midnight." },
      { kind: "ampm", group: "When", title: "AM / PM", rows: log.ampm, key: "period", keepOrder: true },
      { kind: "weekdays", group: "When", title: "Day of Week", rows: log.weekdays, key: "day", keepOrder: true },
      { kind: "months", group: "When", title: "Month", rows: log.months, key: "month", keepOrder: true },
      { kind: "seasons", group: "When", title: "Season", rows: log.seasons, key: "season", keepOrder: true },
      { kind: "years", group: "When", title: "Year", rows: log.years, key: "year", keepOrder: true },
      { kind: "busiest", group: "When", title: "Busiest Days", rows: log.busiest_days, key: "day", total: trains },
      { kind: "calendar", group: "When", title: "Calendar", render: calendarBody, hint: "Every day you logged, year by year, shaded by how many trains. Click a day to see its trains." },
      { kind: "states", group: "Where", title: "States", rows: log.states, key: "state" },
      { kind: "rrregion", group: "Where", title: "Railroad Region", rows: log.railroad_regions, key: "region", keepOrder: true, hint: "The library region of the railroad. Each train counts once." },
      { kind: "rroperation", group: "Trains", title: "Operation", rows: log.railroad_operations, key: "operation", hint: "The library's one operation line. A train is never counted under two kinds of operation." },
      { kind: "contrade", group: "Trains", title: "Container Trade", rows: log.con_trade, key: "trade", keepOrder: true, hint: "Container trains only. Overseas and domestic on the same train is one row." },
      { kind: "trainstatus", group: "Trains", title: "Stopped, Siding, Crew", rows: log.train_status, key: "status", hint: "Stopped, in siding, crew change, and no crew. A train with more than one of these stays one row." },
      { kind: "leadstatus", group: "Power", title: "Lead Loco Status", rows: log.lead_conditions, key: "status", hint: "Missed, Hidden, Too Dark, Too Far, and Weather, kept as one row when a train has more than one." },
      { kind: "zones", group: "Where", title: "Time Zones", rows: log.time_zones, key: "zone" },
      { kind: "trips", group: "Where", title: "Trips", rows: log.trips, key: "trip" },
      { kind: "tripreport", group: "Where", title: "Trip Report", render: tripBody, tool: tripTool, hint: "One trip at a glance: trains, time trackside, fuel, top railroads and places, and what you saw for the first time." },
      { kind: "morelocations", group: "Where", title: "Locations", rows: log.locations, key: "location", top: true },
      { kind: "gaps", group: "Trackside", title: "Gaps Between Trains", rows: log.gaps, key: "gap", keepOrder: true, hint: "Minutes between trains at the same spot on the same day. A wait over four hours counts as leaving and coming back." },
      { kind: "perhour", group: "Trackside", title: "Trains per Hour by Location", render: perHourBody, hint: "Trains per hour at each spot, counted from the first to the last train of each visit." },
      { kind: "besttime", group: "Trackside", title: "Best Time to Go", render: bestTimeBody, hint: "For each spot, the hour with the most trains per visit and the best day of the week. The strip runs midnight to midnight; darker means busier." },
      { kind: "meets", group: "Trackside", title: "Meets and Passes", render: meetsBody, hint: "Two trains going opposite ways at the same spot within 3 minutes of each other." },
      { kind: "alongline", group: "Trackside", title: "Along the Line", render: alongLineBody, tool: alongLineTool, hint: "Every station on a subdivision by milepost, with the trains you logged at each." },
      { kind: "averages", group: "Trains", title: "Averages by Group", render: averagesBody, tool: averagesTool, hint: "Average train length and head-end units, and how often helpers / DP and photos happen." },
      { kind: "flow", group: "Trains", title: "Traffic Flow", render: flowBody, tool: flowTool, hint: "Loads and empties by direction, so you can see which way the loaded trains run." },
      { kind: "moresubdivisions", group: "Where", title: "Subdivisions", rows: log.subdivisions, key: "subdivision", top: true },
      { kind: "morerailroads", group: "Trains", title: "Railroads", rows: roads, key: "railroad", top: true },
      { kind: "moretypes", group: "Trains", title: "Train Types", rows: log.types, key: "type", top: true },
      { kind: "directions", group: "Trains", title: "Direction", rows: log.directions_more, key: "direction", keepOrder: true },
      { kind: "cars", group: "Trains", title: "Train Length", rows: log.car_lengths, key: "cars", keepOrder: true },
      { kind: "symbols", group: "Symbols", title: "Train Symbols", rows: log.symbols, key: "symbol", top: true, hint: "Counted without the date on the end, so Q-LACCHI1-23 and Q-LACCHI1-24 are one symbol." },
      { kind: "timetable", group: "Symbols", title: "Symbol Timetable", render: timetableBody, hint: "Symbols you logged at the same spot on two or more days, with the usual time they come by and how much it varies." },
      { kind: "symbolseries", group: "Symbols", title: "Symbol Series", rows: log.symbol_series, key: "series", top: true, hint: "The series letter at the front of the symbol, read from that railroad's list." },
      { kind: "symbollanes", group: "Symbols", title: "Symbol Lanes", rows: log.symbol_lanes, key: "lane", top: true, hint: "Origin to destination, from the symbol list or the station codes inside the symbol." },
      { kind: "symbolorigins", group: "Symbols", title: "Symbol Origins", rows: log.symbol_origins, key: "origin", top: true },
      { kind: "symboldests", group: "Symbols", title: "Symbol Destinations", rows: log.symbol_destinations, key: "destination", top: true },
      { kind: "symbolroads", group: "Symbols", title: "Symbols by Railroad", rows: log.symbol_roads, key: "railroad" },
      { kind: "symbolcheck", group: "Symbols", title: "Symbols in the Reference", rows: log.symbol_check, key: "name", hint: "Whether each logged symbol matched a train in the reference list." },
      { kind: "heritageunits", group: "Special Power", title: "Heritage Units", rows: log.heritage_units, key: "unit", top: true, hint: "Each heritage unit counts once per train it was on." },
      { kind: "heritageschemes", group: "Special Power", title: "Heritage Schemes", rows: log.heritage_schemes, key: "scheme", top: true },
      { kind: "heritagepositions", group: "Special Power", title: "Heritage Unit Position", rows: log.heritage_positions, key: "position", keepOrder: true },
      { kind: "heritageroads", group: "Special Power", title: "Heritage Units by Railroad", rows: log.heritage_roads, key: "railroad" },
      { kind: "steamengines", group: "Special Power", title: "Steam Engines", rows: log.steam_engines, key: "engine", top: true },
      { kind: "steamwheels", group: "Special Power", title: "Wheel Arrangements", rows: log.steam_wheels, key: "wheels" },
      { kind: "steamstates", group: "Special Power", title: "Steam Sightings by State", rows: log.steam_states, key: "state" },
      { kind: "steamruns", group: "Special Power", title: "Steam Doubleheaders and Assists", rows: log.steam_runs, key: "name", keepOrder: true, hint: "How each steam engine ran: alone or as a doubleheader, with or without diesels helping. A doubleheader counts once." },
      { kind: "assistdiesels", group: "Special Power", title: "Steam Assist Diesels", rows: log.assist_diesels, key: "unit", top: true, hint: "Diesels you noted helping a steam engine, once per train." },
      { kind: "passenger", group: "Trains", title: "Passenger Trains by Number", rows: log.passenger_trains, key: "train", top: true },
      { kind: "loads", group: "Trains", title: "Loads / Empties", rows: log.loads, key: "status" },
      { kind: "moreleads", group: "Power", title: "Lead Locos", rows: log.leads, key: "lead", top: true },
      { kind: "moreconsists", group: "Power", title: "Consist", rows: log.consists, key: "consist", top: true },
      { kind: "units", group: "Power", title: "Units on the Head End", rows: log.units, key: "units", keepOrder: true },
      { kind: "dp", group: "Power", title: "Helpers / DP", rows: log.dp, key: "name" },
      { kind: "consistunits", group: "Power", title: "Trailing and DP Units", rows: log.consist_units, key: "unit", top: true, hint: "Units you noted behind the lead with Unit Numbers, once per train. The lead loco isn't counted here." },
      { kind: "leadpower", group: "Power", title: "Home vs Foreign Power", rows: log.lead_power, key: "name" },
      { kind: "leadmarks", group: "Power", title: "Lead Loco Railroads", rows: log.lead_marks, key: "mark", top: true },
      { kind: "leadrepeats", group: "Power", title: "Repeat Lead Locos", rows: log.lead_repeats, key: "lead", top: true, hint: "Numbered lead locos you have seen leading more than once." },
      { kind: "travels", group: "Power", title: "Loco Travels", render: travelsBody, tool: travelsTool, hint: "Numbered lead locos seen on two or more days: where each one turned up and how many days apart." },
      { kind: "media", group: "Media", title: "Photo / Video / Notes", rows: log.media, key: "name", total: trains },
      { kind: "mediarate", group: "Media", title: "Media Capture Rate", render: mediaRateBody, hint: "Month by month, what share of trains got a photo, video, or notes." },
      { kind: "nightflag", group: "When", title: "Night Flag", rows: log.night_flag, key: "name", keepOrder: true, hint: "The Night checkbox on the pad, separate from hour-of-day night hours." },
      { kind: "coalmarks", group: "Trains", title: "Coal Marks", rows: log.coal_marks, key: "mark", top: true, hint: "Coal / unit marks logged on trains." },
    ].map(function (spec) {
      spec.rows = spec.rows || [];
      spec.log = log;
      if (spec.top) spec.rows = spec.rows.slice(0, listTop);
      spec.mode = moreCharts[spec.kind] || "bars";
      return spec;
    });
  }

  function progressRow(name, have, total) {
    const pct = total ? Math.round((100 * have) / total) : 0;
    return (
      '<div class="progress-row"><div class="progress-label"><span>' +
      escapeText(name) +
      '</span><span class="muted">' +
      have +
      " of " +
      total +
      " · " +
      pct +
      '%</span></div><div class="progress-bar" role="img" aria-label="' +
      escapeText(name + ": " + have + " of " + total) +
      '"><i style="width:' +
      Math.max(pct, have ? 1 : 0) +
      '%"></i></div></div>'
    );
  }

  function milestonesBody(log) {
    const streak = log.streaks || {};
    const longest = streak.longest || {};
    const current = streak.current || {};
    const rows = (log.milestones || []).slice().reverse();
    function streakBox(value, label, detail) {
      return (
        '<div class="streak-box"><b>' +
        (value || 0) +
        "</b><span>" +
        escapeText(label) +
        "</span>" +
        (detail ? '<span class="muted">' + escapeText(detail) + "</span>" : "") +
        "</div>"
      );
    }
    return (
      '<div class="streak-row">' +
      streakBox(longest.days, "Longest streak, days in a row", longest.days > 1 ? longest.from + " to " + longest.to : "") +
      streakBox(current.days, "Current streak", current.days ? "since " + current.from : "Log a train today or tomorrow to start one") +
      "</div>" +
      (rows.length
        ? '<table class="sightings-table"><thead><tr><th>Milestone</th><th>Date</th><th>Train</th><th>Where</th></tr></thead><tbody>' +
          rows
            .map(function (row) {
              return (
                "<tr><td><strong>" +
                escapeText(row.label) +
                "</strong></td><td>" +
                escapeText([row.date, row.time].filter(Boolean).join(" ")) +
                "</td><td>" +
                escapeText([row.railroad, row.lead].filter(Boolean).join(" ")) +
                "</td><td>" +
                escapeText(row.location || "") +
                "</td></tr>"
              );
            })
            .join("") +
          "</tbody></table>"
        : '<p class="muted">None yet.</p>')
    );
  }

  function collectionBody(log) {
    const data = log.collection || {};
    const lists = data.lists || [];
    const subs = (data.subdivisions || []).slice(0, Math.max(listTop, 6));
    const hunt = data.hunt || {};
    const left = ["heritage", "a250", "steam", "railroads"].reduce(function (n, key) {
      return n + ((hunt[key] || []).length);
    }, 0);
    return (
      lists
        .map(function (row) {
          return progressRow(row.name, row.have, row.total);
        })
        .join("") +
      (left
        ? '<p class="muted">Hunt list: ' + left + " still unseen — open the Hunt List chart for the checklist.</p>"
        : "") +
      '<h4 class="progress-head">Stations Logged by Subdivision</h4>' +
      (subs.length
        ? subs
            .map(function (row) {
              return progressRow(row.name, row.have, row.total);
            })
            .join("")
        : '<p class="muted">Pick a subdivision and a listed station on the pad to start.</p>')
    );
  }

  function runningTotalsBody(log) {
    const rows = log.running_totals || [];
    if (!rows.length) return '<p class="muted">None yet.</p>';
    const series = [
      ["locos", "Different lead locos"],
      ["railroads", "Railroads"],
      ["locations", "Locations"],
      ["trains", "Trains"],
    ];
    return (
      '<div class="running-totals">' +
      series
        .map(function (item) {
          const values = rows.map(function (row) {
            return row[item[0]] || 0;
          });
          const top = Math.max.apply(null, values.concat([1]));
          const step = values.length > 1 ? 100 / (values.length - 1) : 100;
          const points = (values.length > 1 ? values : [values[0], values[0]])
            .map(function (value, i) {
              return (values.length > 1 ? i * step : i * 100).toFixed(1) + "," + (22 - (value / top) * 20).toFixed(1);
            })
            .join(" ");
          return (
            '<div class="running-row"><span class="running-label">' +
            escapeText(item[1]) +
            '</span><svg class="running-spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"><polyline points="' +
            points +
            '" /></svg><b class="running-value">' +
            values[values.length - 1] +
            "</b></div>"
          );
        })
        .join("") +
      '<p class="muted running-span">' +
      escapeText(rows[0].month + " to " + rows[rows.length - 1].month) +
      "</p></div>"
    );
  }

  function perHourBody(log) {
    const rows = (log.per_hour_locations || []).slice(0, Math.max(listTop, 6));
    if (!rows.length) return '<p class="muted">Log two or more trains at one spot on the same day to see this.</p>';
    return (
      '<table class="sightings-table"><thead><tr><th>Location</th><th>Trains per hour</th><th>Hours watched</th></tr></thead><tbody>' +
      rows
        .map(function (row) {
          return (
            "<tr><td>" +
            escapeText(row.location) +
            "</td><td><strong>" +
            row.per_hour +
            "</strong></td><td>" +
            row.hours +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table>"
    );
  }

  let alongLineSub = "";

  function alongLineTool(log) {
    const lines = log.along_line || [];
    if (!lines.length) return "";
    return (
      '<label class="dash-list-chart"><select data-along-sub aria-label="Subdivision">' +
      lines
        .map(function (line) {
          return (
            '<option value="' +
            escapeText(line.subdivision) +
            '"' +
            (line.subdivision === alongLineSub ? " selected" : "") +
            ">" +
            escapeText(line.subdivision) +
            "</option>"
          );
        })
        .join("") +
      "</select></label>"
    );
  }

  function alongLineBody(log) {
    const lines = log.along_line || [];
    if (!lines.length) return '<p class="muted">Pick a subdivision and a listed station on the pad to see trains along the line.</p>';
    const line =
      lines.filter(function (item) {
        return item.subdivision === alongLineSub;
      })[0] || lines[0];
    alongLineSub = line.subdivision;
    const stops = line.stations;
    const low = stops[0].mp;
    const high = stops[stops.length - 1].mp;
    const most = Math.max.apply(null, stops.map(function (s) { return s.trains; }).concat([1]));
    const W = 640;
    const H = 170;
    const base = 120;
    function x(mp) {
      return 16 + ((mp - low) / (high - low || 1)) * (W - 32);
    }
    let svg =
      '<svg class="along-line" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Trains along ' + escapeText(line.subdivision) + '">' +
      '<line class="along-track" x1="16" y1="' + base + '" x2="' + (W - 16) + '" y2="' + base + '" />';
    stops.forEach(function (stop) {
      const px = x(stop.mp).toFixed(1);
      svg += '<line class="along-tick" x1="' + px + '" y1="' + (base - 3) + '" x2="' + px + '" y2="' + (base + 3) + '"><title>' + escapeText(stop.name + " · MP " + stop.mp) + "</title></line>";
      if (stop.trains) {
        const h = Math.max(4, (stop.trains / most) * 80);
        svg +=
          '<rect class="along-bar" x="' + (x(stop.mp) - 3).toFixed(1) + '" y="' + (base - h).toFixed(1) + '" width="6" height="' + h.toFixed(1) + '"><title>' +
          escapeText(stop.name + " · MP " + stop.mp + " · " + stop.trains + " train" + (stop.trains === 1 ? "" : "s")) +
          "</title></rect>" +
          '<text class="along-count" x="' + px + '" y="' + (base - h - 4).toFixed(1) + '">' + stop.trains + "</text>";
      }
    });
    svg +=
      '<text class="along-mp" x="16" y="' + (base + 18) + '">MP ' + low + "</text>" +
      '<text class="along-mp is-end" x="' + (W - 16) + '" y="' + (base + 18) + '">MP ' + high + "</text></svg>";
    const logged = stops.filter(function (stop) {
      return stop.trains;
    });
    return (
      svg +
      '<table class="sightings-table"><thead><tr><th>Station</th><th>MP</th><th>Trains</th></tr></thead><tbody>' +
      logged
        .map(function (stop) {
          return "<tr><td>" + escapeText(stop.name) + "</td><td>" + stop.mp + "</td><td><strong>" + stop.trains + "</strong></td></tr>";
        })
        .join("") +
      "</tbody></table>" +
      '<p class="muted">' + stops.length + " stations on this line, " + logged.length + " with trains logged.</p>"
    );
  }

  let averagesGroup = "railroad";

  function averagesTool() {
    return (
      '<label class="dash-list-chart"><select data-avg-group aria-label="Group by">' +
      '<option value="railroad"' + (averagesGroup === "railroad" ? " selected" : "") + ">By Railroad</option>" +
      '<option value="type"' + (averagesGroup === "type" ? " selected" : "") + ">By Train Type</option>" +
      "</select></label>"
    );
  }

  function averagesBody(log) {
    const rows = ((log.averages || {})[averagesGroup] || []).slice(0, 25);
    if (!rows.length) return '<p class="muted">None yet.</p>';
    function cell(value, suffix) {
      return value === null || value === undefined ? "—" : value + (suffix || "");
    }
    return (
      '<table class="sightings-table"><thead><tr><th>' +
      (averagesGroup === "type" ? "Train type" : "Railroad") +
      "</th><th>Trains</th><th>Avg cars</th><th>Avg units</th><th>Helpers / DP</th><th>Photos</th></tr></thead><tbody>" +
      rows
        .map(function (row) {
          return (
            "<tr><td><strong>" +
            escapeText(row.name) +
            "</strong></td><td>" +
            row.trains +
            "</td><td>" +
            cell(row.avg_cars) +
            "</td><td>" +
            cell(row.avg_units) +
            "</td><td>" +
            cell(row.dp_pct, "%") +
            "</td><td>" +
            cell(row.photo_pct, "%") +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table>"
    );
  }

  const morePicks = { firsts: "", calendar: "", tripreport: "", flow: "", travels: "" };

  function pickTool(kind, label, options) {
    if (!options.length) return "";
    const current = morePicks[kind];
    if (current && !options.some(function (o) { return o.value === current; })) morePicks[kind] = "";
    return (
      '<label class="dash-list-chart"><select data-more-pick="' +
      kind +
      '" aria-label="' +
      escapeText(label) +
      '">' +
      options
        .map(function (o) {
          return '<option value="' + escapeText(o.value) + '"' + (o.value === morePicks[kind] ? " selected" : "") + ">" + escapeText(o.label) + "</option>";
        })
        .join("") +
      "</select></label>"
    );
  }

  function drillCell(value, text, trains) {
    return (
      '<td data-drill="' +
      escapeText(value) +
      '" tabindex="0" role="button" title="See the ' +
      (trains ? trains + " train" + (trains === 1 ? "" : "s") : "trains") +
      " for " +
      escapeText(value) +
      '"><strong>' +
      escapeText(text) +
      "</strong></td>"
    );
  }

  function statBoxes(items) {
    return (
      '<div class="streak-row stat-boxes">' +
      items
        .map(function (item) {
          return '<div class="streak-box"><b>' + escapeText(String(item[0])) + "</b><span>" + escapeText(item[1]) + "</span></div>";
        })
        .join("") +
      "</div>"
    );
  }

  function minutesText(n) {
    if (n < 60) return n + " min";
    return Math.floor(n / 60) + " hr" + (n % 60 ? " " + (n % 60) + " min" : "");
  }

  function meetsBody(log) {
    const data = log.meets || {};
    if (!data.total) {
      return '<p class="muted">A meet is two trains going opposite ways at the same spot within ' + (data.window || 3) + " minutes. Log a direction and time on each train to see them.</p>";
    }
    return (
      statBoxes([
        [data.total, data.total === 1 ? "meet or pass" : "meets and passes"],
        [data.days, data.days === 1 ? "day with a meet" : "days with a meet"],
      ]) +
      '<table class="sightings-table" data-drill-source="meets"><thead><tr><th>Location</th><th>Meets</th><th>Days</th></tr></thead><tbody>' +
      data.locations
        .slice(0, Math.max(listTop, 6))
        .map(function (row) {
          return "<tr>" + drillCell(row.location, row.location) + "<td>" + row.meets + "</td><td>" + row.days + "</td></tr>";
        })
        .join("") +
      '</tbody></table><h4 class="progress-head">Latest Meets</h4><table class="sightings-table"><thead><tr><th>Date</th><th>Where</th><th>Trains</th><th>Apart</th></tr></thead><tbody>' +
      data.recent
        .slice(0, 10)
        .map(function (row) {
          return (
            "<tr><td>" +
            escapeText(row.date + " " + row.time) +
            "</td><td>" +
            escapeText(row.location) +
            "</td><td>" +
            escapeText(row.first) +
            "<br>" +
            escapeText(row.second) +
            "</td><td>" +
            (row.apart ? row.apart + " min" : "Same minute") +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table>"
    );
  }

  function timetableBody(log) {
    const rows = (log.symbol_timetable || []).slice(0, Math.max(listTop, 10));
    if (!rows.length) return '<p class="muted">Log the same symbol at the same spot on two or more days to see when it usually comes by.</p>';
    return (
      '<table class="sightings-table"><thead><tr><th>Symbol</th><th>Where</th><th>Usually</th><th>Range</th><th>Days</th></tr></thead><tbody>' +
      rows
        .map(function (row) {
          return (
            "<tr><td><strong>" +
            escapeText(row.symbol) +
            '</strong> <span class="muted">' +
            escapeText([row.railroad, row.direction].filter(Boolean).join(" ")) +
            "</span></td><td>" +
            escapeText(row.location) +
            "</td><td><strong>" +
            escapeText(row.usual) +
            "</strong></td><td>" +
            escapeText(row.earliest === row.latest ? row.usual : row.earliest + "–" + row.latest + " (" + minutesText(row.spread) + ")") +
            "</td><td>" +
            row.days +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table>"
    );
  }

  function travelsTool(log) {
    const rows = log.loco_travels || [];
    return pickTool(
      "travels",
      "Follow one loco",
      rows.length ? [{ value: "", label: "All Locos" }].concat(rows.map(function (r) { return { value: r.lead, label: r.lead }; })) : []
    );
  }

  function travelsBody(log) {
    const rows = log.loco_travels || [];
    if (!rows.length) return '<p class="muted">Log the same numbered lead loco on two or more days to follow where it went.</p>';
    const one = rows.filter(function (r) { return r.lead === morePicks.travels; })[0];
    if (one) {
      return (
        '<table class="sightings-table"><thead><tr><th>Date</th><th>Where</th><th>Train</th><th>Days later</th></tr></thead><tbody>' +
        one.stops
          .map(function (stop) {
            return (
              "<tr><td>" +
              escapeText([stop.date, stop.time].filter(Boolean).join(" ")) +
              "</td><td>" +
              escapeText([stop.location, stop.state].filter(Boolean).join(", ") || "—") +
              "</td><td>" +
              escapeText([stop.railroad, stop.symbol].filter(Boolean).join(" ") || "—") +
              "</td><td>" +
              (stop.after === null ? "First seen" : stop.after === 0 ? "Same day" : stop.after.toLocaleString()) +
              "</td></tr>"
            );
          })
          .join("") +
        '</tbody></table><p class="muted">' +
        one.days + " days, " + one.places + (one.places === 1 ? " place" : " places") + ", " + one.span.toLocaleString() + " days from first to last.</p>"
      );
    }
    return (
      '<table class="sightings-table" data-drill-source="leadrepeats"><thead><tr><th>Lead loco</th><th>Days</th><th>Places</th><th>First – Last</th><th>Longest gap</th></tr></thead><tbody>' +
      rows
        .slice(0, Math.max(listTop, 10))
        .map(function (row) {
          return (
            "<tr>" +
            drillCell(row.lead, row.lead) +
            "<td>" +
            row.days +
            "</td><td>" +
            row.places +
            "</td><td>" +
            escapeText(row.first + " – " + row.last) +
            "</td><td>" +
            (row.longest_gap ? row.longest_gap.toLocaleString() + (row.longest_gap === 1 ? " day" : " days") : "—") +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table>"
    );
  }

  function hourStrip(hours) {
    const top = Math.max.apply(null, hours.map(function (h) { return h.rate; }).concat([0.01]));
    const by = {};
    hours.forEach(function (h) {
      by[h.hour] = h.rate;
    });
    let cells = "";
    for (let h = 0; h < 24; h += 1) {
      const rate = by[h];
      cells +=
        '<rect x="' + h * 5 + '" y="0" width="4" height="14" class="' + (rate === undefined ? "hour-off" : "hour-on") + '"' +
        (rate ? ' style="opacity:' + (0.2 + 0.8 * (rate / top)).toFixed(2) + '"' : "") +
        "><title>" + (h % 12 || 12) + (h < 12 ? " AM" : " PM") + (rate === undefined ? ": not watched" : ": " + rate + " trains per visit") + "</title></rect>";
    }
    return '<svg class="hour-strip" viewBox="0 0 119 14" aria-hidden="true">' + cells + "</svg>";
  }

  function bestTimeBody(log) {
    const rows = (log.best_times || []).slice(0, Math.max(listTop, 10));
    if (!rows.length) return '<p class="muted">Log three or more trains with a time at one spot to see its best hour.</p>';
    return (
      '<table class="sightings-table best-time-table" data-drill-source="locations"><thead><tr><th>Location</th><th>Best hour</th><th>Best day</th><th>Midnight to midnight</th><th>Visits</th></tr></thead><tbody>' +
      rows
        .map(function (row) {
          return (
            "<tr>" +
            drillCell(row.location, row.location, row.trains) +
            '<td data-label="Best hour"><strong>' +
            escapeText(row.best_hour) +
            '</strong><br><span class="muted">' +
            row.hour_rate +
            ' per visit</span></td><td data-label="Best day">' +
            (row.best_day ? "<strong>" + escapeText(row.best_day) + '</strong><br><span class="muted">' + row.day_rate + " per day</span>" : "—") +
            '</td><td class="best-time-strip">' +
            hourStrip(row.hours) +
            '</td><td data-label="Visits">' +
            row.visits +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table>"
    );
  }

  const FIRST_KINDS = [
    ["railroads", "Railroads"],
    ["heritage", "Heritage units"],
    ["a250", "America 250"],
    ["steam", "Steam engines"],
    ["states", "States"],
    ["types", "Train types"],
    ["symbols", "Train symbols"],
    ["subdivisions", "Subdivisions"],
  ];

  function firstsTool(log) {
    if (!(log.firsts || []).length) return "";
    return pickTool("firsts", "Show", [{ value: "", label: "All Firsts" }].concat(FIRST_KINDS.map(function (k) { return { value: k[0], label: k[1] }; })));
  }

  function firstsBody(log) {
    const kinds = FIRST_KINDS.filter(function (k) { return !morePicks.firsts || k[0] === morePicks.firsts; });
    const rows = (log.firsts || []).filter(function (row) {
      return kinds.some(function (k) { return (row[k[0]] || []).length; });
    });
    if (!rows.length) return '<p class="muted">None yet.</p>';
    const total = rows.reduce(function (n, row) {
      return n + kinds.reduce(function (m, k) { return m + (row[k[0]] || []).length; }, 0);
    }, 0);
    return (
      '<table class="sightings-table"><thead><tr><th>Month</th><th>New</th><th>First seen</th></tr></thead><tbody>' +
      rows
        .slice(0, 24)
        .map(function (row) {
          const found = kinds.filter(function (k) { return (row[k[0]] || []).length; });
          return (
            '<tr><td class="firsts-month"><strong>' +
            escapeText(row.month) +
            "</strong></td><td>" +
            found.reduce(function (n, k) { return n + row[k[0]].length; }, 0) +
            "</td><td>" +
            found
              .map(function (k) {
                return (kinds.length > 1 ? '<span class="muted">' + escapeText(k[1]) + ":</span> " : "") + escapeText(row[k[0]].join(", "));
              })
              .join("<br>") +
            "</td></tr>"
          );
        })
        .join("") +
      '</tbody></table><p class="muted">' +
      total + (total === 1 ? " first" : " firsts") + " in " + rows.length + (rows.length === 1 ? " month" : " months") +
      (rows.length > 24 ? ", newest 24 shown" : "") +
      ". First ever, counted across your whole log.</p>"
    );
  }

  function flowTool(log) {
    const spots = (log.traffic_flow || {}).locations || [];
    if (!spots.length) return "";
    return pickTool("flow", "Location", [{ value: "", label: "All Locations" }].concat(spots.map(function (s) { return { value: s.location, label: s.location }; })));
  }

  function flowBody(log) {
    const data = log.traffic_flow || {};
    const spot = (data.locations || []).filter(function (s) { return s.location === morePicks.flow; })[0];
    const rows = spot ? spot.rows : data.all || [];
    if (!rows.length) return '<p class="muted">Log a direction and Loads or Empties on your trains to see which way the loads run.</p>';
    return (
      '<table class="sightings-table"><thead><tr><th>Direction</th><th>Loads</th><th>Empties</th><th>Mixed</th><th>Loaded</th></tr></thead><tbody>' +
      rows
        .map(function (row) {
          const pct = row.loaded_pct;
          return (
            "<tr><td><strong>" +
            escapeText(row.direction) +
            "</strong></td><td>" +
            row.loads +
            "</td><td>" +
            row.empties +
            "</td><td>" +
            row.mixed +
            "</td><td>" +
            (pct === null
              ? "—"
              : '<div class="progress-bar flow-bar" role="img" aria-label="' + pct + '% loaded"><i style="width:' + Math.max(pct, row.loads ? 1 : 0) + '%"></i></div><span class="muted">' + pct + "%</span>") +
            "</td></tr>"
          );
        })
        .join("") +
      '</tbody></table><p class="muted">Loaded is loads out of loads plus empties. Mixed trains carry both.</p>'
    );
  }

  function tripTool(log) {
    const trips = log.trip_reports || [];
    return pickTool("tripreport", "Trip", trips.map(function (t) { return { value: t.trip, label: t.trip }; }));
  }

  function tripBody(log) {
    const trips = log.trip_reports || [];
    if (!trips.length) return '<p class="muted">Name a trip on the pad to get a report for it.</p>';
    const trip = trips.filter(function (t) { return t.trip === morePicks.tripreport; })[0] || trips[0];
    function list(items) {
      return items.map(function (i) { return i.name + " (" + i.trains + ")"; }).join(", ");
    }
    const details = trip.details || {};
    const start = String(details.start_miles || "");
    const end = String(details.end_miles || "");
    const driven = start && end && Number(end) >= Number(start) ? Math.round((Number(end) - Number(start)) * 10) / 10 : null;
    const fills = Array.isArray(details.fuel_log) ? details.fuel_log : [];
    function outsideNums(rows) {
      const nums = [];
      rows.forEach(function (item) {
        const raw = String((item && item.temperature) || "").replace(/°/g, "").replace(/\s*f$/i, "").trim();
        if (raw && !isNaN(Number(raw))) nums.push(Number(raw));
      });
      return nums;
    }
    function outsideLabel(rows) {
      const nums = outsideNums(rows);
      if (!nums.length) return "";
      const lo = Math.min.apply(null, nums);
      const hi = Math.max.apply(null, nums);
      const label = function (n) { return (Math.round(n * 10) / 10).toLocaleString(); };
      return lo === hi ? label(lo) + "°F" : label(lo) + "–" + label(hi) + "°F";
    }
    function outsideShort(rows) {
      const nums = outsideNums(rows);
      if (nums.length !== 1 && !(nums.length && Math.min.apply(null, nums) === Math.max.apply(null, nums))) return "";
      return (Math.round(nums[0] * 10) / 10).toLocaleString() + "°";
    }
    let fuelGallons = 0;
    let fuelCost = 0;
    let haveGallons = false;
    let haveCost = false;
    fills.forEach(function (item) {
      if (item.gallons !== "" && item.gallons != null && !isNaN(item.gallons) && Number(item.gallons) > 0) {
        fuelGallons += Number(item.gallons);
        haveGallons = true;
      }
      if (item.cost !== "" && item.cost != null && !isNaN(item.cost)) {
        fuelCost += Number(item.cost);
        haveCost = true;
      }
    });
    const money = function (n) {
      return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
    };
    const fuelLine = fills
      .map(function (item) {
        const bits = [];
        if (item.date) bits.push(item.date);
        if (item.gallons) bits.push(Number(item.gallons).toLocaleString() + " gal");
        if (item.gallons && item.cost !== "" && item.cost != null && Number(item.gallons) > 0) {
          bits.push("$" + (Math.round((Number(item.cost) / Number(item.gallons)) * 1000) / 1000).toFixed(3) + "/gal");
        }
        if (item.cost !== "" && item.cost != null) bits.push(money(Number(item.cost)));
        if (item.place) bits.push(item.place);
        if (item.temperature) bits.push(String(item.temperature).replace(/°?\s*f?$/i, "") + "°F");
        return bits.join(", ");
      })
      .filter(Boolean)
      .join("; ");
    const facts = [
      ["Dates", trip.first === trip.last ? trip.first : trip.first + " to " + trip.last],
      ["Miles driven", driven === null ? "" : driven.toLocaleString() + " (" + Number(start).toLocaleString() + " to " + Number(end).toLocaleString() + ")"],
      ["Fuel", fuelLine],
      ["Price per gallon", haveGallons && haveCost && fuelGallons ? money(fuelCost / fuelGallons) : ""],
      ["Miles per gallon", haveGallons && driven && fuelGallons ? (Math.round((driven / fuelGallons) * 10) / 10).toLocaleString() : ""],
      ["Fuel cost per mile", haveCost && driven ? money(fuelCost / driven) : ""],
      ["Trains per mile", trip.trains && driven ? (Math.round((trip.trains / driven) * 1000) / 1000).toLocaleString() : ""],
      ["Trains per gallon", trip.trains && haveGallons && fuelGallons ? (Math.round((trip.trains / fuelGallons) * 1000) / 1000).toLocaleString() : ""],
      ["Fuel cost per train", trip.trains && haveCost ? money(fuelCost / trip.trains) : ""],
      ["Outside temperature", outsideLabel(fills)],
      ["Mileage", driven === null && (start || end) ? [start ? "start " + start : "", end ? "end " + end : ""].filter(Boolean).join(", ") : ""],
      ["Vehicle", details.vehicle || ""],
      ["Attendees", details.attendees || ""],
      ["Top railroads", list(trip.railroads)],
      ["Top locations", list(trip.locations)],
      ["States", trip.states.join(", ")],
      ["Busiest day", trip.busiest ? trip.busiest.trains + " trains on " + trip.busiest.date : ""],
      ["Longest train", trip.longest ? trip.longest + " cars" : ""],
      ["Heritage units", trip.heritage.join(", ")],
      ["Steam sightings", trip.steam ? String(trip.steam) : ""],
      ["New railroads", trip.new_railroads.join(", ")],
      ["New states", trip.new_states.join(", ")],
      ["New heritage units", trip.new_heritage.join(", ")],
      ["New lead locos", trip.new_leads ? String(trip.new_leads) : ""],
      ["Trip notes", details.notes || ""],
    ].filter(function (f) { return f[1]; });
    return (
      statBoxes(
        [
          [trip.trains, trip.trains === 1 ? "train" : "trains"],
          [trip.days, trip.days === 1 ? "day" : "days"],
          [trip.hours, "hours trackside"],
          [trip.per_hour === null ? "—" : trip.per_hour, "trains per hour"],
        ].concat(
          haveGallons || haveCost
            ? [
                [haveGallons ? (Math.round(fuelGallons * 10) / 10).toLocaleString() : "—", "gallons"],
                [haveCost ? money(fuelCost) : "—", "fuel cost"],
                [haveGallons && driven && fuelGallons ? (Math.round((driven / fuelGallons) * 10) / 10).toLocaleString() : "—", "miles per gallon"],
                [haveGallons && haveCost && fuelGallons ? money(fuelCost / fuelGallons) : "—", "per gallon"],
              ]
            : []
        ).concat(trip.trains && driven ? [[(Math.round((trip.trains / driven) * 1000) / 1000).toLocaleString(), "trains per mile"]] : [])
        .concat(trip.trains && haveGallons && fuelGallons ? [[(Math.round((trip.trains / fuelGallons) * 1000) / 1000).toLocaleString(), "trains per gallon"]] : [])
        .concat(trip.trains && haveCost ? [[money(fuelCost / trip.trains), "per train"]] : [])
        .concat(outsideShort(fills) ? [[outsideShort(fills), "outside"]] : [])
      ) +
      '<dl class="dash-facts trip-facts">' +
      facts.map(function (f) { return "<div><dt>" + escapeText(f[0]) + "</dt><dd>" + escapeText(f[1]) + "</dd></div>"; }).join("") +
      '</dl>' +
      '<div class="trip-report-actions">' +
      '<button type="button" class="btn tiny ghost" data-trip-report-copy="' + escapeText(trip.trip) + '">Copy summary</button> ' +
      '<button type="button" class="btn tiny ghost" data-trip-report-print="' + escapeText(trip.trip) + '">Print / PDF</button>' +
      '</div>' +
      '<p class="muted trip-drill" data-drill-source="trips"><span data-drill="' + escapeText(trip.trip) + '" tabindex="0" role="button">See the ' + trip.trains + (trip.trains === 1 ? " train" : " trains") + " on this trip</span></p>"
    );
  }

  function tripReportPlainText(trip) {
    if (!trip) return "";
    const details = trip.details || {};
    const start = String(details.start_miles || "");
    const end = String(details.end_miles || "");
    const driven = start && end && Number(end) >= Number(start) ? Math.round((Number(end) - Number(start)) * 10) / 10 : null;
    const fills = Array.isArray(details.fuel_log) ? details.fuel_log : [];
    let fuelGallons = 0;
    let fuelCost = 0;
    let haveGallons = false;
    let haveCost = false;
    const temps = [];
    fills.forEach(function (item) {
      if (item.gallons !== "" && item.gallons != null && !isNaN(item.gallons) && Number(item.gallons) > 0) {
        fuelGallons += Number(item.gallons);
        haveGallons = true;
      }
      if (item.cost !== "" && item.cost != null && !isNaN(item.cost)) {
        fuelCost += Number(item.cost);
        haveCost = true;
      }
      const raw = String((item && item.temperature) || "").replace(/°/g, "").replace(/\s*f$/i, "").trim();
      if (raw && !isNaN(Number(raw))) temps.push(Number(raw));
    });
    const money = function (n) {
      return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
    };
    const lines = [
      "TRAIN LOG · Trip Report",
      trip.trip || "",
      "",
      trip.trains + (trip.trains === 1 ? " train" : " trains") +
        " · " + trip.days + (trip.days === 1 ? " day" : " days") +
        (trip.hours != null ? " · " + trip.hours + " hours trackside" : "") +
        (trip.per_hour != null ? " · " + trip.per_hour + " trains/hour" : ""),
    ];
    if (trip.first) lines.push("Dates: " + (trip.first === trip.last ? trip.first : trip.first + " to " + trip.last));
    if (driven !== null) lines.push("Miles driven: " + driven.toLocaleString() + " (" + Number(start).toLocaleString() + " to " + Number(end).toLocaleString() + ")");
    if (haveGallons) lines.push("Fuel: " + (Math.round(fuelGallons * 10) / 10).toLocaleString() + " gal" + (haveCost ? " · " + money(fuelCost) : ""));
    if (haveGallons && haveCost && fuelGallons) lines.push("Price per gallon: " + money(fuelCost / fuelGallons));
    if (haveGallons && driven && fuelGallons) lines.push("Miles per gallon: " + (Math.round((driven / fuelGallons) * 10) / 10).toLocaleString());
    if (temps.length) {
      const lo = Math.min.apply(null, temps);
      const hi = Math.max.apply(null, temps);
      lines.push("Outside: " + (lo === hi ? lo : lo + "–" + hi) + "°F");
    }
    if (details.vehicle) lines.push("Vehicle: " + details.vehicle);
    if (details.attendees) lines.push("Attendees: " + details.attendees);
    if (details.notes) lines.push("Notes: " + details.notes);
    if ((details.packing || []).length) {
      const pack = details.packing;
      const done = pack.filter(function (row) { return row && row.done; }).length;
      lines.push("Packing: " + done + "/" + pack.length + " packed");
    }
    (trip.railroads || []).slice(0, 8).forEach(function (r, i) {
      if (i === 0) lines.push("Top railroads: " + r.name + " (" + r.trains + ")");
      else lines.push("  " + r.name + " (" + r.trains + ")");
    });
    (trip.locations || []).slice(0, 8).forEach(function (r, i) {
      if (i === 0) lines.push("Top locations: " + r.name + " (" + r.trains + ")");
      else lines.push("  " + r.name + " (" + r.trains + ")");
    });
    if (trip.states && trip.states.length) lines.push("States: " + trip.states.join(", "));
    if (trip.busiest) lines.push("Busiest day: " + trip.busiest.trains + " trains on " + trip.busiest.date);
    if (trip.heritage && trip.heritage.length) lines.push("Heritage: " + trip.heritage.join(", "));
    if (trip.steam) lines.push("Steam sightings: " + trip.steam);
    return lines.filter(function (line, idx, arr) {
      return line !== "" || (idx && arr[idx - 1] !== "");
    }).join("\n");
  }

  function calendarYears(log) {
    const years = [];
    (log.trains_by_date || []).forEach(function (row) {
      const y = String(row.day || "").slice(0, 4);
      if (/^\d{4}$/.test(y) && years.indexOf(y) === -1) years.push(y);
    });
    return years.sort().reverse();
  }

  function calendarYearSvg(year, counts, top) {
    const start = new Date(Date.UTC(Number(year), 0, 1));
    const lead = (start.getUTCDay() + 6) % 7;
    const C = 12;
    const X = 30;
    const Y = 16;
    let cells = "";
    let labels = "";
    const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (let d = new Date(start); d.getUTCFullYear() === Number(year); d.setUTCDate(d.getUTCDate() + 1)) {
      const index = Math.round((d - start) / 86400000) + lead;
      const week = Math.floor(index / 7);
      const dow = index % 7;
      const key = d.toISOString().slice(0, 10);
      const n = counts[key] || 0;
      const level = n ? Math.min(4, Math.ceil((n / top) * 4)) : 0;
      if (d.getUTCDate() === 1) labels += '<text class="cal-month" x="' + (X + week * C) + '" y="10">' + MONTH[d.getUTCMonth()] + "</text>";
      cells +=
        '<rect class="cal-day cal-l' + level + '" x="' + (X + week * C) + '" y="' + (Y + dow * C) + '" width="10" height="10" rx="2"' +
        (n ? ' data-drill="' + key + '" tabindex="0" role="button"' : "") +
        "><title>" + key + ": " + (n ? n + (n === 1 ? " train" : " trains") : "no trains") + "</title></rect>";
    }
    const dayNames = [[0, "Mon"], [2, "Wed"], [4, "Fri"]]
      .map(function (p) { return '<text class="cal-month" x="0" y="' + (Y + p[0] * C + 9) + '">' + p[1] + "</text>"; })
      .join("");
    return (
      '<svg class="cal-grid" viewBox="0 0 ' + (X + 54 * C) + " " + (Y + 7 * C) + '" role="img" aria-label="Trains by day in ' + year + '">' +
      labels + dayNames + cells +
      "</svg>"
    );
  }

  function calendarBody(log) {
    const years = calendarYears(log);
    if (!years.length) return '<p class="muted">None yet.</p>';
    const counts = {};
    const perYear = {};
    let top = 1;
    let days = 0;
    let trains = 0;
    (log.trains_by_date || []).forEach(function (row) {
      const year = String(row.day).slice(0, 4);
      counts[row.day] = row.trains;
      top = Math.max(top, row.trains);
      perYear[year] = perYear[year] || { days: 0, trains: 0 };
      perYear[year].days += 1;
      perYear[year].trains += row.trains;
      days += 1;
      trains += row.trains;
    });
    const grids = years
      .map(function (year) {
        const sum = perYear[year] || { days: 0, trains: 0 };
        return (
          '<div class="cal-year"><h4>' + year + ' <span class="muted">' +
          sum.days + (sum.days === 1 ? " day, " : " days, ") + sum.trains + (sum.trains === 1 ? " train" : " trains") +
          "</span></h4>" + calendarYearSvg(year, counts, top) + "</div>"
        );
      })
      .join("");
    return (
      '<div class="cal-wrap" data-drill-source="dates">' + grids +
      '</div><div class="cal-key muted"><span>' + days + (days === 1 ? " day" : " days") + " trackside, " + trains + (trains === 1 ? " train" : " trains") +
      (years.length > 1 ? " in " + years.length + " years" : " in " + years[0]) +
      '</span><span class="cal-scale">Fewer <i class="cal-l0"></i><i class="cal-l1"></i><i class="cal-l2"></i><i class="cal-l3"></i><i class="cal-l4"></i> More</span></div>'
    );
  }

  function refreshCustomTile(kind) {
    if (!logMoreStatsBody) return;
    const tile = logMoreStatsBody.querySelector('[data-more-kind="' + kind + '"]');
    const spec = moreStatsSpecs((catalog && catalog.log) || {}).filter(function (item) {
      return item.kind === kind;
    })[0];
    if (!tile || !spec || !spec.render) return;
    tile.querySelector(".dash-list-body").innerHTML = spec.render(spec.log);
  }

  function moreTitleButton(kind, title, hint) {
    return (
      '<h3><button type="button" class="more-solo" data-more-solo="' +
      escapeText(kind) +
      '" title="' +
      escapeText((hint ? hint + " " : "") + "Click to show only this chart; click again for all.") +
      '">' +
      escapeText(title) +
      "</button></h3>"
    );
  }

  function moreStatsTile(spec) {
    if (spec.render) {
      return (
        '<section class="dash-panel dash-list-tile dash-custom-tile" data-more-kind="' +
        escapeText(spec.kind) +
        '" data-group="' +
        escapeText(spec.group || "") +
        '"><div class="dash-list-head">' +
        moreTitleButton(spec.kind, spec.title, spec.hint) +
        (spec.tool ? spec.tool(spec.log) : "") +
        '</div><div class="dash-list-body">' +
        spec.render(spec.log) +
        "</div></section>"
      );
    }
    return (
      '<section class="dash-panel dash-list-tile" data-more-kind="' +
      escapeText(spec.kind) +
      '" data-group="' +
      escapeText(spec.group || "") +
      '"><div class="dash-list-head">' +
      moreTitleButton(spec.kind, spec.title, spec.hint) +
      chartModeSelect(spec.title, spec.kind, spec.mode) +
      '</div><div class="dash-list-body">' +
      (spec.rows.length
        ? typeChart(spec.rows, spec.key, spec.mode, { keepOrder: spec.keepOrder, total: spec.total, drill: DRILLABLE.has(drillKind(spec.kind)) })
        : '<p class="muted">None yet.</p>') +
      "</div></section>"
    );
  }

  function moreStatsFacts(facts) {
    return (
      '<section class="dash-panel dash-list-tile dash-facts-tile" data-more-kind="glance" data-group="Progress"><div class="dash-list-head">' +
      moreTitleButton("glance", "At a Glance") +
      "</div>" +
      '<div class="dash-list-body"><dl class="dash-facts">' +
      (facts || [])
        .map(function (row) {
          return "<div><dt>" + escapeText(row.name) + "</dt><dd>" + escapeText(row.value) + "</dd></div>";
        })
        .join("") +
      "</dl></div></section>"
    );
  }

  let sightingsUnit = "";

  function sightingsBodyHtml(rows) {
    const shown = rows.filter(function (row) {
      return !sightingsUnit || row.unit === sightingsUnit;
    });
    if (!shown.length) return '<p class="muted">None yet.</p>';
    return (
      '<table class="sightings-table"><thead><tr><th>Date</th><th>Unit</th><th>Detail</th><th>Train</th><th>Where</th></tr></thead><tbody>' +
      shown
        .map(function (row) {
          return (
            "<tr><td>" +
            escapeText([row.date, row.time].filter(Boolean).join(" ")) +
            "</td><td><strong>" +
            escapeText(row.unit || "—") +
            '</strong> <span class="muted">' +
            escapeText(row.kind) +
            "</span></td><td>" +
            escapeText(row.detail || "") +
            "</td><td>" +
            escapeText(row.railroad || "") +
            "</td><td>" +
            escapeText([row.location, row.state].filter(Boolean).join(", ")) +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table>"
    );
  }

  function sightingsTile(rows) {
    const units = [];
    rows.forEach(function (row) {
      if (row.unit && units.indexOf(row.unit) === -1) units.push(row.unit);
    });
    units.sort();
    if (sightingsUnit && units.indexOf(sightingsUnit) === -1) sightingsUnit = "";
    return (
      '<section class="dash-panel dash-list-tile dash-sightings-tile" data-more-kind="specialsightings" data-group="Special Power"><div class="dash-list-head">' +
      moreTitleButton("specialsightings", "Special Power Sightings", "Every heritage unit and steam engine you logged, newest first.") +
      (units.length
        ? '<label class="dash-list-chart"><select data-sightings-unit aria-label="Follow one unit"><option value="">All Units</option>' +
          units
            .map(function (unit) {
              return '<option value="' + escapeText(unit) + '"' + (unit === sightingsUnit ? " selected" : "") + ">" + escapeText(unit) + "</option>";
            })
            .join("") +
          "</select></label>"
        : "") +
      '</div><div class="dash-list-body">' +
      sightingsBodyHtml(rows) +
      "</div></section>"
    );
  }

  document.addEventListener("change", function (event) {
    const pick = event.target.closest && event.target.closest("[data-sightings-unit]");
    if (!pick) return;
    sightingsUnit = pick.value;
    const body = pick.closest(".dash-sightings-tile").querySelector(".dash-list-body");
    body.innerHTML = sightingsBodyHtml(((catalog && catalog.log) || {}).special_sightings || []);
  });

  let moreShown = null;
  try {
    const saved = JSON.parse(localStorage.getItem("rr-more-shown") || "null");
    if (Array.isArray(saved) && saved.length) moreShown = saved;
  } catch (e) {}

  function saveMoreShown() {
    try {
      if (moreShown) localStorage.setItem("rr-more-shown", JSON.stringify(moreShown));
      else localStorage.removeItem("rr-more-shown");
    } catch (e) {}
  }

  function moreGroups(specs) {
    const groups = [{ label: "Summary", items: [{ kind: "glance", title: "At a Glance" }] }];
    specs.forEach(function (spec) {
      let group = groups.find(function (g) {
        return g.label === spec.group;
      });
      if (!group) {
        group = { label: spec.group, items: [] };
        groups.push(group);
      }
      group.items.push({ kind: spec.kind, title: spec.title });
      if (spec.kind === "heritageunits") group.items.push({ kind: "specialsightings", title: "Special Power Sightings" });
    });
    return groups;
  }

  function morePickHtml(groups) {
    const all = !moreShown;
    return (
      '<div class="more-pick-row"><button type="button" class="more-chip more-all' +
      (all ? " is-on" : "") +
      '" data-more-all aria-pressed="' +
      all +
      '">All Charts</button><span class="more-pick-hint muted">' +
      (all
        ? "Click a chart or a group to show only that. Click more to add them."
        : "Showing " + moreShown.length + " of " + groups.reduce(function (n, g) { return n + g.items.length; }, 0) + ". Click a lit chip to hide it.") +
      "</span></div>" +
      groups
        .map(function (group) {
          const kinds = group.items.map(function (item) { return item.kind; });
          const groupOn = !all && kinds.every(function (k) { return moreShown.indexOf(k) !== -1; });
          return (
            '<div class="more-pick-row"><button type="button" class="more-group' +
            (groupOn ? " is-on" : "") +
            '" data-more-group="' +
            escapeText(kinds.join(",")) +
            '" title="Show only ' +
            escapeText(group.label) +
            ' charts">' +
            escapeText(group.label) +
            "</button>" +
            group.items
              .map(function (item) {
                const on = !all && moreShown.indexOf(item.kind) !== -1;
                return (
                  '<button type="button" class="more-chip' +
                  (on ? " is-on" : "") +
                  '" data-more-chip="' +
                  escapeText(item.kind) +
                  '" aria-pressed="' +
                  on +
                  '">' +
                  escapeText(item.title) +
                  "</button>"
                );
              })
              .join("") +
            "</div>"
          );
        })
        .join("")
    );
  }

  function applyMoreShown() {
    if (!logMoreStatsBody) return;
    let count = 0;
    logMoreStatsBody.querySelectorAll("[data-more-kind]").forEach(function (tile) {
      const show = !moreShown || moreShown.indexOf(tile.getAttribute("data-more-kind")) !== -1;
      tile.hidden = !show;
      if (show) count += 1;
    });
    logMoreStatsBody.setAttribute("data-count", String(moreShown ? Math.min(count, 4) : "all"));
  }

  function setMoreShown(next) {
    moreShown = next && next.length ? next : null;
    saveMoreShown();
    fillMoreStats();
  }

  function fillMoreStats() {
    if (!logMoreStatsBody) return;
    const log = (catalog && catalog.log) || {};
    const specs = moreStatsSpecs(log);
    const groups = moreGroups(specs);
    const known = ["glance", "specialsightings"].concat(specs.map(function (s) { return s.kind; }));
    if (moreShown) {
      moreShown = moreShown.filter(function (k) { return known.indexOf(k) !== -1; });
      if (!moreShown.length) moreShown = null;
    }
    if (logMoreStatsPick) logMoreStatsPick.innerHTML = morePickHtml(groups);
    logMoreStatsBody.innerHTML =
      moreStatsFacts(log.facts) +
      specs
        .map(function (spec) {
          return moreStatsTile(spec) + (spec.kind === "heritageunits" ? sightingsTile(log.special_sightings || []) : "");
        })
        .join("");
    applyMoreShown();
  }

  function renderAll() {
    renderLog();
    renderKpis();
    renderRoads();
    fillFilter();
    renderSubs();
    renderRailroads();
    renderTypes();
  }

  window.__tlRenderSubs = renderSubs;
  window.__tlFillFilter = fillFilter;

  function showPane(pane) {
    cardPop.close();
    if (pane === "import" || pane === "datacheck") pane = "review";
    if (pane !== "stations" && pane !== "review" && pane !== "activity") pane = "log";
    if (window.trainLogField && pane === "review") pane = "log";
    document.querySelectorAll("#view-dashboard .dash-pane").forEach(function (el) {
      el.classList.toggle("is-active", el.id === "dash-pane-" + pane);
    });
    document.querySelectorAll(".dash-tabs .tab").forEach(function (tab) {
      tab.classList.toggle("is-active", tab.getAttribute("data-dash-pane") === pane);
    });
    if (pane === "activity") loadActivity();
    if (pane === "review") loadDataCheck();
    if (pane === "stations") { settingsBoard.layout(); settingsExtras.bind(); }
  }

  async function loadActivity() {
    const emptyEl = document.getElementById("activity-empty");
    const body = document.getElementById("activity-body");
    if (!body) return;
    const result = await api("/api/activity");
    if (!result.ok) {
      banner((result.data && result.data.error) || "Could not load activity.", "error");
      return;
    }
    const items = (result.data && result.data.activity) || [];
    if (emptyEl) emptyEl.hidden = items.length > 0;
    const clearBtn = document.getElementById("btn-activity-clear");
    if (clearBtn) clearBtn.disabled = !items.length;
    const labels = {
      "entry.create": "Logged train",
      "entry.update": "Edited train",
      "entry.delete": "Deleted train",
      "entry.clear": "Deleted all trains",
      "entry.delete_selected": "Deleted selected trains",
      "library.save": "Railroad library",
      "library.remove": "Removed from railroad library",
      "library.restore": "Restored railroad library",
      "library.import": "Imported to railroad library",
      "library.menu": "Library railroad put on the menu",
      "subdivision.create": "Added subdivision",
      "subdivision.update": "Edited subdivision",
      "subdivision.delete": "Removed subdivision",
      "subdivision.hide": "Hid subdivision",
      "subdivision.unhide": "Unhid subdivision",
      "subdivision.import": "Imported subdivision CSV",
      "subdivision.inbound": "Imported from watch folder",
      "subdivision.inbound_failed": "Watch folder CSV failed",
      "catalog.reload": "Reloaded CSVs",
      "catalog.restore_shipped": "Restored shipped subdivisions",
      "railroad.save": "Updated railroads",
      "railroad.reset": "Restored railroad defaults",
      "type.add": "Added train type",
      "type.delete": "Removed train type",
      "type.reset": "Restored train type defaults",
      "type.filter.add": "Added import filter",
      "type.filter.delete": "Removed import filter",
      "type.filter.reset": "Restored import filters",
      "acronym.save": "Updated stands-for",
      "import.file": "Imported log file",
      "import.accept": "Accepted held import",
      "import.prefer_incoming": "Preferred incoming over Mac copy",
      "import.discard": "Discarded held import",
      "database.open": "Opened database",
      "entry.bulk": "Changed selected sightings",
      "entry.replace": "Find and Replace",
      "entry.fix": "Data Check fix",
      "trip.rename": "Renamed a trip",
      "entry.place": "Changed subdivision or state",
      "entry.time_zone": "Set time zone",
      "import.review": "Checked imported sightings",
      "type.order": "Reordered train types",
      "special_power.save": "Updated heritage list",
      "special_power.remove": "Removed heritage unit",
      "special_power.restore": "Restored heritage list",
      "phone_sync.remove": "Unpaired a phone",
      "data.update": "Updated station data",
      "data.built_in": "Went back to built-in station data",
      "backup.upgrade": "Backed up before upgrade",
      "app.update": "Updated TRAIN LOG",
      "updates.key": "Saved update key",
    };
    body.innerHTML = items
      .map(function (item) {
        const action = labels[item.action] || item.action || "";
        const payload = item.payload == null ? "" : activityDetailHtml(item);
        const entryId = activityEntryId(item);
        if (window.trainLogField) {
          return (
            '<tr class="act-card" data-activity-card="' + item.id + '"><td>' +
            '<button type="button" class="act-card-head" data-activity-open="' + item.id + '" aria-expanded="false">' +
            '<span class="act-card-action">' + escapeText(action) + "</span>" +
            '<span class="act-card-when">' + escapeText(item.created_at || "") + "</span>" +
            '<span class="act-card-summary">' + escapeText(item.summary || "") + "</span>" +
            "</button>" +
            '<div class="act-card-body" data-activity-detail="' + item.id + '" hidden>' +
            payload +
            (entryId
              ? '<button type="button" class="btn ghost act-card-edit" data-activity-edit="' + entryId + '">Edit This Sighting</button>'
              : "") +
            "</div></td></tr>"
          );
        }
        return (
          "<tr><td>" +
          escapeText(item.created_at || "") +
          "</td><td>" +
          escapeText(action) +
          "</td><td>" +
          escapeText(item.summary || "") +
          '</td><td class="activity-actions">' +
          (payload
            ? '<button type="button" class="btn tiny ghost" data-activity-toggle="' +
              item.id +
              '">Details</button>'
            : "") +
          (entryId
            ? '<button type="button" class="btn tiny ghost" data-activity-edit="' +
              entryId +
              '">Edit</button>'
            : "") +
          '</td></tr><tr class="activity-detail" data-activity-detail="' +
          item.id +
          '" hidden><td colspan="4">' +
          payload +
          "</td></tr>"
        );
      })
      .join("");
  }

  const ACT_FIELDS = [
    ["date", "Date"],
    ["time", "Time"],
    ["time_zone", "Zone"],
    ["railroad", "Railroad"],
    ["lead_locomotive", "Lead"],
    ["train_symbol", "Symbol"],
    ["direction", "Direction"],
    ["power_consist", "Consist"],
    ["train_types", "Type"],
    ["load_status", "Loads/Empties"],
    ["car_counts", "Cars"],
    ["location_spot", "Location"],
    ["location_subdivision", "Subdivision"],
    ["location_state", "State"],
    ["location_region", "Region"],
    ["location_coordinates", "Coordinates"],
    ["trip_name", "Trip"],
    ["trip_date_from", "Trip from"],
    ["trip_date_to", "Trip to"],
    ["train_info", "Train info"],
    ["notes", "Notes"],
    ["photographed", "Photo"],
    ["videoed", "Video"],
    ["night", "Night"],
    ["stopped", "Stopped"],
    ["in_siding", "In siding"],
    ["crew_change", "Crew change"],
    ["no_crew", "No crew onboard"],
    ["lead_status", "Lead loco"],
    ["coal_mark", "Coal car mark"],
    ["con_overseas", "Overseas"],
    ["con_domestic", "Domestic"],
    ["special_power", "Special power"],
  ];

  function actValue(key, value) {
    if (value === null || value === undefined || value === "") return "";
    if (Array.isArray(value)) return value.join("/");
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (key === "special_power" && typeof value === "object") {
      const units = value.units || {};
      const unitText = ["head", "mid", "rear"]
        .map(function (slot) { return (units[slot] || []).filter(Boolean).join(", "); })
        .filter(Boolean)
        .join(" · ");
      const shown = window.trainLog && window.trainLog.specialText ? window.trainLog.specialText({ special_power: value }) : "";
      return [shown, unitText ? "Units " + unitText : ""].filter(Boolean).join(" · ");
    }
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  function actEntryText(entry) {
    return [
      entry.date,
      entry.time,
      entry.railroad,
      entry.lead_locomotive,
      entry.direction,
      entry.train_types_label || actValue("train_types", entry.train_types),
      [entry.location_spot, entry.location_subdivision].filter(Boolean).join(" · "),
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function actEntryLine(entry) {
    if (!entry) return "";
    return (
      '<li><span class="entry-id" title="' + ENTRY_ID_TITLE + '">#' + escapeText(String(entry.id || "?")) + "</span> " +
      escapeText(actEntryText(entry)) + "</li>"
    );
  }

  function actEntryCard(entry) {
    if (!entry || typeof entry !== "object") return "";
    const rows = ACT_FIELDS.filter(function (pair) {
      if (["photographed", "videoed", "night", "stopped", "in_siding", "crew_change", "no_crew"].indexOf(pair[0]) >= 0) return entry[pair[0]] === true;
      return actValue(pair[0], entry[pair[0]]) !== "";
    })
      .map(function (pair) {
        return "<dt>" + pair[1] + "</dt><dd>" + escapeText(actValue(pair[0], entry[pair[0]])) + "</dd>";
      })
      .join("");
    return (
      '<div class="act-entry">' +
      (entry.id ? '<p class="act-entry-head">Sighting <span class="entry-id" title="' + ENTRY_ID_TITLE + '">#' + escapeText(String(entry.id)) + "</span></p>" : "") +
      '<dl class="act-fields">' + rows + "</dl></div>"
    );
  }

  function actChanges(before, after) {
    const rows = ACT_FIELDS.filter(function (pair) {
      return actValue(pair[0], before[pair[0]]) !== actValue(pair[0], after[pair[0]]);
    })
      .map(function (pair) {
        return (
          "<tr><th>" + pair[1] + '</th><td class="act-before">' +
          (escapeText(actValue(pair[0], before[pair[0]])) || "—") +
          '</td><td class="act-arrow">→</td><td class="act-after">' +
          (escapeText(actValue(pair[0], after[pair[0]])) || "—") +
          "</td></tr>"
        );
      })
      .join("");
    return rows
      ? '<table class="act-changes"><thead><tr><th>Field</th><th>Before</th><th></th><th>After</th></tr></thead><tbody>' +
          rows + "</tbody></table>"
      : '<p class="muted">No field changed.</p>';
  }

  const LIB_FIELDS = [
    ["name", "Name"], ["mark", "Mark"], ["aliases", "Aliases"], ["group", "Group"], ["rr_class", "Class"],
    ["operation", "Operation"], ["region", "Region"], ["states", "States"], ["time_zone", "Time zone"],
    ["miles", "Track miles"], ["mark_status", "Mark status"], ["notes", "Notes"],
  ];

  function libChanges(before, after) {
    const rows = LIB_FIELDS.filter(function (pair) {
      return String(before[pair[0]] == null ? "" : before[pair[0]]) !== String(after[pair[0]] == null ? "" : after[pair[0]]);
    })
      .map(function (pair) {
        return (
          "<tr><th>" + pair[1] + '</th><td class="act-before">' +
          (escapeText(String(before[pair[0]] == null ? "" : before[pair[0]])) || "—") +
          '</td><td class="act-arrow">→</td><td class="act-after">' +
          (escapeText(String(after[pair[0]] == null ? "" : after[pair[0]])) || "—") +
          "</td></tr>"
        );
      })
      .join("");
    return rows
      ? '<table class="act-changes"><thead><tr><th>Field</th><th>Before</th><th></th><th>After</th></tr></thead><tbody>' +
          rows + "</tbody></table>"
      : '<p class="muted">No field changed.</p>';
  }

  function actList(entries, total) {
    if (!entries || !entries.length) return "";
    const more = total > entries.length ? '<li class="muted">and ' + (total - entries.length) + " more</li>" : "";
    return '<ul class="act-list">' + entries.map(actEntryLine).join("") + more + "</ul>";
  }

  function actPairs(obj) {
    const keys = Object.keys(obj || {}).filter(function (key) {
      const v = obj[key];
      return v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length);
    });
    if (!keys.length) return "";
    return (
      '<dl class="act-fields">' +
      keys
        .map(function (key) {
          const label = key.replace(/_/g, " ").replace(/^\w/, function (c) {
            return c.toUpperCase();
          });
          const v = obj[key];
          const text = Array.isArray(v) && v.length > 12 ? v.slice(0, 12).join(", ") + "… (" + v.length + ")" : actValue(key, v);
          return "<dt>" + escapeText(label) + "</dt><dd>" + escapeText(text) + "</dd>";
        })
        .join("") +
      "</dl>"
    );
  }

  function activityDetailHtml(item) {
    const p = item.payload;
    let html = "";
    if (p && typeof p === "object") {
      if (item.action === "entry.update" && p.before && p.after) {
        html = '<p class="act-entry-head">Sighting <span class="entry-id" title="' + ENTRY_ID_TITLE + '">#' + escapeText(String(p.after.id || "")) +
          "</span> " + escapeText(actEntryText(p.after)) + "</p>" +
          actChanges(p.before, p.after);
      } else if (item.action === "entry.create" || item.action === "entry.delete") {
        html = actEntryCard(p);
      } else if (item.action === "import.accept") {
        html = actEntryCard(p.entry);
      } else if (item.action === "import.discard") {
        html = actEntryCard(p.payload) || actPairs(p);
      } else if (["entry.bulk", "entry.replace", "entry.fix", "trip.rename"].indexOf(item.action) !== -1 && Array.isArray(p.changes)) {
        const shown = p.changes.slice(0, 25);
        const picked = Array.isArray(p.ids) ? p.ids.map(String) : [];
        let othersShown = false;
        html =
          (p.changes.length
            ? "<p>" + escapeText(String(p.changes.length)) + " sighting" + (p.changes.length === 1 ? "" : "s") + " changed.</p>"
            : '<p class="muted">Nothing needed changing.</p>') +
          shown
            .map(function (pair) {
              const id = String((pair.after && pair.after.id) || "");
              let lead = "";
              if (!othersShown && picked.length && picked.indexOf(id) < 0) {
                othersShown = true;
                lead = '<p class="muted">Other trains in the trip, whose trip dates moved to match:</p>';
              }
              return (
                lead +
                '<p class="act-entry-head">Sighting <span class="entry-id" title="' + ENTRY_ID_TITLE + '">#' +
                escapeText(String((pair.after && pair.after.id) || "")) + "</span> " +
                escapeText(actEntryText(pair.after || {})) + "</p>" +
                actChanges(pair.before || {}, pair.after || {})
              );
            })
            .join("") +
          (p.changes.length > shown.length
            ? '<p class="muted">and ' + (p.changes.length - shown.length) + " more (all of them are in Raw Data).</p>"
            : "");
      } else if (item.action === "library.save" && p.after) {
        html = p.before ? libChanges(p.before, p.after) : actPairs(p.after);
      } else if (item.action === "library.remove" && p.before) {
        html = actPairs(p.before);
      } else if (item.action === "entry.clear" || item.action === "entry.delete_selected") {
        const list = Array.isArray(p.entries) ? p.entries : [];
        html = "<p>" + escapeText(String(p.count || list.length)) + " sightings were deleted.</p>" + actList(list.slice(0, 25), list.length);
      } else if (Array.isArray(p.ids)) {
        const parts = [];
        if ("time_zone" in p && p.time_zone !== null) parts.push("Time zone: " + (p.time_zone || "none"));
        if ("subdivision" in p && p.subdivision !== null) parts.push("Subdivision: " + (p.subdivision || "none"));
        if (p.keep) parts.push("Kept as they were");
        html = (parts.length ? "<p>" + escapeText(parts.join(" · ")) + "</p>" : "") +
          (actList(item.entries, p.ids.length) || "<p class=\"muted\">Sightings " + escapeText(p.ids.slice(0, 30).map(function (i) { return "#" + i; }).join(", ")) + " are no longer in the log.</p>");
      } else {
        html = actPairs(p);
      }
    }
    const raw = escapeText(JSON.stringify(p, null, 2));
    return (
      '<div class="act-detail">' + (html || '<p class="muted">No details.</p>') +
      '<details class="act-raw"><summary>Raw Data</summary><pre>' + raw + "</pre></details></div>"
    );
  }

  document.addEventListener("trainlog:entry-saved", function () {
    const pane = document.getElementById("dash-pane-activity");
    if (pane && pane.classList.contains("is-active")) loadActivity();
  });

  function activityEntryId(item) {
    const payload = item && item.payload;
    if (!payload || typeof payload !== "object") return "";
    if (item.action === "entry.create" && payload.id) return String(payload.id);
    if (item.action === "entry.update" && payload.after && payload.after.id) {
      return String(payload.after.id);
    }
    if (item.action === "import.accept" && payload.entry && payload.entry.id) {
      return String(payload.entry.id);
    }
    return "";
  }

  const activityBody = document.getElementById("activity-body");
  if (activityBody) {
    activityBody.addEventListener("click", function (event) {
      const editId = event.target.getAttribute("data-activity-edit");
      if (editId) {
        if (window.trainLog && window.trainLog.editEntry) {
          window.trainLog.editEntry(editId);
        }
        return;
      }
      const opener = event.target.closest("[data-activity-open]");
      if (opener) {
        const card = opener.closest(".act-card");
        const open = !card.classList.contains("is-open");
        card.classList.toggle("is-open", open);
        opener.setAttribute("aria-expanded", String(open));
        card.querySelector("[data-activity-detail]").hidden = !open;
        return;
      }
      const id = event.target.getAttribute("data-activity-toggle");
      if (!id) return;
      const detail = activityBody.querySelector('[data-activity-detail="' + id + '"]');
      if (detail) detail.hidden = !detail.hidden;
    });
  }
  const activityClearBtn = document.getElementById("btn-activity-clear");
  const activityWipeDialog = document.getElementById("activity-wipe-dialog");
  if (activityClearBtn && activityWipeDialog) {
    activityClearBtn.addEventListener("click", function () {
      if (activityClearBtn.disabled) return;
      activityWipeDialog.returnValue = "cancel";
      activityWipeDialog.showModal();
    });
    activityWipeDialog.addEventListener("close", async function () {
      if (activityWipeDialog.returnValue !== "wipe") return;
      const result = await api("/api/activity/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      if (!result.ok) {
        banner((result.data && result.data.error) || "Could not clear activity.", "error");
        return;
      }
      banner((result.data && result.data.message) || "Activity cleared.", "ok");
      await loadActivity();
    });
  }

  let catalogRequest = 0;

  async function loadCatalog(opts) {
    opts = opts || {};
    const ticket = ++catalogRequest;
    const result = await api("/api/catalog" + catalogQuery(), opts.quiet
      ? { quiet: true }
      : { work: { title: "Loading dashboard…" } });
    if (ticket !== catalogRequest) return;
    if (!result.ok) {
      banner((result.data && result.data.error) || "Could not load the dashboard.", "error");
      return;
    }
    catalog = result.data;
    renderAll();
    document.dispatchEvent(new CustomEvent("trainlog:catalog-loaded"));
  }

  document.addEventListener("trainlog:catalog-reload", function () {
    notifyLists();
    loadCatalog({ quiet: true });
  });

  function groupsPayload() {
    return JSON.parse(JSON.stringify((catalog && catalog.groups) || []));
  }

  async function saveMeaning(kind, name, meaning) {
    const payload = {};
    payload[kind] = {};
    payload[kind][name] = meaning;
    const result = await api("/api/catalog/acronyms", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!result.ok) {
      banner((result.data && result.data.error) || "Could not save that meaning.", "error");
      return;
    }
    if (catalog) catalog.meanings = result.data.meanings;
    notifyLists();
  }

  async function saveGroups(groups) {
    const result = await api("/api/catalog/railroads", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groups: groups }),
    });
    if (!result.ok) {
      banner((result.data && result.data.error) || "Could not save railroads.", "error");
      return;
    }
    banner("Railroad list updated.", "ok");
    notifyLists();
    await loadCatalog();
  }

  let editorFavoriteKeys = {};

  function spotKeyOf(spot) {
    if (window.trainLogQuickSpots && typeof window.trainLogQuickSpots.key === "function") {
      return window.trainLogQuickSpots.key(spot);
    }
    return [
      String((spot && spot.railroad) || "").toLowerCase(),
      String((spot && spot.subdivision) || "").toLowerCase(),
      String((spot && spot.location) || "").toLowerCase(),
      String((spot && spot.state) || "").toLowerCase(),
    ].join("|");
  }

  function syncEditorFavoriteKeys(list) {
    editorFavoriteKeys = {};
    (list || []).forEach(function (spot) {
      editorFavoriteKeys[spotKeyOf(spot)] = true;
    });
  }

  async function ensureEditorFavorites() {
    if (window.trainLogQuickSpots && typeof window.trainLogQuickSpots.load === "function") {
      const list = await window.trainLogQuickSpots.load();
      syncEditorFavoriteKeys(list);
      return;
    }
    const result = await api("/api/quick-spots", { quiet: true });
    if (result.ok) syncEditorFavoriteKeys((result.data && result.data.favorites) || []);
  }

  function editorRailroadPick() {
    const checked = Array.prototype.map.call(
      document.querySelectorAll("#sub-editor-rrs input:checked"),
      function (box) { return box.value; }
    );
    const filterRr = (filterEl && filterEl.value) || "";
    if (filterRr && checked.indexOf(filterRr) !== -1) return filterRr;
    return checked[0] || "";
  }

  function spotFromEditorRow(row) {
    if (!row) return null;
    const name = ((row.querySelector(".sub-loc-spot") || {}).value || "").trim();
    const mp = ((row.querySelector(".sub-loc-mp") || {}).value || "").trim();
    const state = ((row.querySelector(".sub-loc-state") || {}).value || "").trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
    const subdivision = (document.getElementById("sub-editor-name").value || "").trim();
    if (!name && !subdivision) return null;
    const location = name ? (mp ? name + " (MP " + mp + ")" : name) : "";
    const spot = {
      railroad: editorRailroadPick(),
      subdivision: subdivision,
      location: location,
      state: state,
    };
    if (name) spot.label = name;
    return spot;
  }

  function paintEditorFavButton(row) {
    const btn = row && row.querySelector(".sub-loc-fav");
    if (!btn) return;
    const spot = spotFromEditorRow(row);
    const ready = Boolean(spot && (spot.location || spot.subdivision));
    btn.disabled = !ready;
    if (!ready) {
      btn.classList.remove("is-on");
      btn.textContent = "☆";
      btn.title = "Enter a location name to favorite it";
      btn.setAttribute("aria-label", "Favorite location");
      return;
    }
    const on = Boolean(editorFavoriteKeys[spotKeyOf(spot)]);
    btn.classList.toggle("is-on", on);
    btn.textContent = on ? "★" : "☆";
    btn.title = on ? "Remove from Quick Spots favorites" : "Save to Quick Spots favorites";
    btn.setAttribute("aria-label", btn.title);
  }

  function paintEditorFavButtons() {
    Array.prototype.forEach.call(document.querySelectorAll("#sub-editor-locs tr"), paintEditorFavButton);
  }

  function locRow(spot, mp, state) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td><input class="sub-loc-spot" type="text" /></td><td><input class="sub-loc-mp" type="text" /></td>' +
      '<td><input class="sub-loc-state" type="text" maxlength="2" autocapitalize="characters" aria-label="State" /></td>' +
      '<td class="sub-loc-actions"><div class="sub-loc-actions-inner">' +
      '<button type="button" class="btn tiny ghost sub-loc-fav" title="Save to Quick Spots favorites" aria-label="Favorite location">☆</button>' +
      '<button type="button" class="btn tiny ghost sub-loc-del">Remove</button></div></td>';
    tr.querySelector(".sub-loc-spot").value = spot || "";
    tr.querySelector(".sub-loc-mp").value = mp || "";
    tr.querySelector(".sub-loc-state").value = state || "";
    paintEditorFavButton(tr);
    return tr;
  }

  function mpValue(text) {
    const match = String(text || "").match(/-?\d+(?:\.\d+)?/);
    return match ? parseFloat(match[0]) : null;
  }

  function milepostSortDescending(values) {
    // Prefer majority of consecutive steps over endpoints so one bad MP
    // at either end cannot reverse the whole editor list.
    const numbered = values.filter(function (value) {
      return value != null;
    });
    if (numbered.length < 2) return false;
    let ups = 0;
    let downs = 0;
    let prev = null;
    values.forEach(function (value) {
      if (value == null) return;
      if (prev != null) {
        if (value > prev) ups += 1;
        else if (value < prev) downs += 1;
      }
      prev = value;
    });
    if (ups === downs) return numbered[0] > numbered[numbered.length - 1];
    return downs > ups;
  }

  function sortEditorLocs() {
    const body = document.getElementById("sub-editor-locs");
    if (!body) return;
    const rows = Array.prototype.slice.call(body.querySelectorAll("tr"));
    if (rows.length < 2) return;
    const values = rows.map(function (tr) {
      return mpValue(tr.querySelector(".sub-loc-mp") && tr.querySelector(".sub-loc-mp").value);
    });
    const descending = milepostSortDescending(values);
    rows.sort(function (a, b) {
      const av = mpValue(a.querySelector(".sub-loc-mp") && a.querySelector(".sub-loc-mp").value);
      const bv = mpValue(b.querySelector(".sub-loc-mp") && b.querySelector(".sub-loc-mp").value);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av === bv) return 0;
      return descending ? bv - av : av - bv;
    });
    rows.forEach(function (row) {
      body.appendChild(row);
    });
  }

  function fillEditorChecks(selected) {
    const wrap = document.getElementById("sub-editor-rrs");
    selected = selected || [];
    wrap.innerHTML = ((catalog && catalog.groups) || [])
      .map(function (group) {
        return (group.railroads || [])
          .map(function (name) {
            const on = selected.indexOf(name) !== -1 ? " checked" : "";
            return (
              '<label><input type="checkbox" value="' +
              escapeText(name) +
              '"' +
              on +
              " /> " +
              escapeText(name) +
              "</label>"
            );
          })
          .join("");
      })
      .join("");
  }

  async function openEditor(filename) {
    document.getElementById("sub-editor-file").value = filename || "";
    document.getElementById("sub-editor-title").textContent = filename ? "Edit Subdivision" : "Add Subdivision";
    const csvWrap = document.getElementById("sub-editor-csv");
    if (csvWrap) csvWrap.hidden = !!filename;
    const body = document.getElementById("sub-editor-locs");
    body.innerHTML = "";
    if (filename) {
      const result = await api("/api/catalog/subdivisions/" + encodeURIComponent(filename));
      if (!result.ok) {
        banner((result.data && result.data.error) || "Could not open that subdivision.", "error");
        return;
      }
      const data = result.data;
      document.getElementById("sub-editor-name").value = data.subdivision || "";
      fillEditorChecks(data.railroads || []);
      (data.locations || []).forEach(function (row) {
        body.appendChild(locRow(row.spot, row.mp, row.state));
      });
      if (!(data.locations || []).length) body.appendChild(locRow("", ""));
      sortEditorLocs();
    } else {
      document.getElementById("sub-editor-name").value = "";
      fillEditorChecks([]);
      body.appendChild(locRow("", ""));
    }
    await ensureEditorFavorites();
    paintEditorFavButtons();
    editor.showModal();
  }

  async function saveEditor() {
    sortEditorLocs();
    const filename = document.getElementById("sub-editor-file").value;
    const railroads = Array.prototype.map
      .call(document.querySelectorAll("#sub-editor-rrs input:checked"), function (box) {
        return box.value;
      });
    const locations = Array.prototype.map
      .call(document.querySelectorAll("#sub-editor-locs tr"), function (row) {
        return {
          spot: row.querySelector(".sub-loc-spot").value,
          mp: row.querySelector(".sub-loc-mp").value,
          state: row.querySelector(".sub-loc-state").value.trim().toUpperCase(),
        };
      })
      .filter(function (row) {
        return (row.spot || "").trim();
      });
    const payload = {
      railroads: railroads,
      subdivision: document.getElementById("sub-editor-name").value,
      locations: locations,
    };
    const result = filename
      ? await api("/api/catalog/subdivisions/" + encodeURIComponent(filename), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await api("/api/catalog/subdivisions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
    if (!result.ok) {
      banner((result.data && result.data.error) || "Could not save that subdivision.", "error");
      return;
    }
    editor.close();
    banner((result.data && result.data.message) || "Subdivision saved.", "ok");
    if (!filename) {
      const added = result.data || {};
      const q = (searchEl.value || "").trim().toLowerCase();
      if (q && String(added.subdivision || "").toLowerCase().indexOf(q) === -1) searchEl.value = "";
      if (filterEl.value && (added.railroads || []).indexOf(filterEl.value) === -1) filterEl.value = "";
    }
    notifyLists();
    await loadCatalog();
  }

  document.getElementById("dash-sub-search").addEventListener("input", renderSubs);
  document.getElementById("dash-sub-rr").addEventListener("change", renderSubs);
  document.getElementById("dash-sub-add").addEventListener("click", function () {
    openEditor("");
  });
  document.getElementById("dash-sub-refresh").addEventListener("click", async function () {
    notifyLists();
    await loadCatalog({ quiet: true });
    banner("Subdivision list refreshed.", "ok");
  });
  const stationStats = document.getElementById("dash-station-stats");
  const stationStatsDialog = document.getElementById("station-stats");
  if (stationStats && stationStatsDialog) {
    stationStats.addEventListener("click", function () {
      stationStatsDialog.showModal();
    });
  }
  const TRAIN_REF_COLUMNS = {
    passenger: ["Train #", "Route", "From", "To"],
    freight: ["Symbol", "Series", "From", "To", "Runs", "Notes"],
    series: ["Letter", "Meaning"],
    codes: ["Code", "Station"],
  };
  const trainRefBtn = document.getElementById("dash-train-ref");
  const trainRefDialog = document.getElementById("train-ref");
  const trainRefKind = document.getElementById("train-ref-kind");
  const trainRefRr = document.getElementById("train-ref-rr");
  const trainRefQ = document.getElementById("train-ref-q");
  const trainRefMeta = document.getElementById("train-ref-meta");
  const trainRefHead = document.getElementById("train-ref-head");
  const trainRefBody = document.getElementById("train-ref-body");
  let trainRefRun = 0;
  let trainRefTimer = null;
  async function loadTrainRef() {
    if (!trainRefDialog) return;
    const run = ++trainRefRun;
    const kind = trainRefKind.value || "passenger";
    const params = new URLSearchParams({ kind: kind, railroad: trainRefRr.value || "", q: trainRefQ.value || "" });
    const result = await api("/api/reference/list?" + params.toString(), { quiet: true });
    if (run !== trainRefRun) return;
    if (!result.ok) {
      trainRefMeta.textContent = (result.data && result.data.error) || "Could not load that list.";
      trainRefBody.innerHTML = "";
      return;
    }
    const data = result.data || {};
    trainRefRr.innerHTML = (data.railroads || [])
      .map(function (row) {
        const meaning = meaningOf("railroads", row.railroad);
        return (
          '<option value="' +
          escapeText(row.railroad) +
          '"' +
          (row.railroad === data.railroad ? " selected" : "") +
          ">" +
          escapeText(row.railroad + (meaning ? " · " + meaning : "") + " (" + row.count + ")") +
          "</option>"
        );
      })
      .join("");
    const cols = TRAIN_REF_COLUMNS[data.kind] || TRAIN_REF_COLUMNS.passenger;
    trainRefBody.closest("table").dataset.cols = String(cols.length);
    trainRefHead.innerHTML =
      "<tr>" +
      cols
        .map(function (name) {
          return "<th>" + escapeText(name) + "</th>";
        })
        .join("") +
      "</tr>";
    const rows = data.rows || [];
    trainRefBody.innerHTML = rows.length
      ? rows
          .map(function (row) {
            return (
              "<tr>" +
              row
                .map(function (cell, index) {
                  return '<td data-label="' + escapeText(cols[index] || "") + '">' + escapeText(cell) + "</td>";
                })
                .join("") +
              "</tr>"
            );
          })
          .join("")
      : '<tr><td colspan="' + cols.length + '" class="muted">Nothing matches that search.</td></tr>';
    const shown = rows.length < data.total ? "Showing " + rows.length + " of " + data.total : data.total + (data.total === 1 ? " row" : " rows");
    trainRefMeta.textContent = shown + " · " + (data.source || "") + (data.built ? ", built " + data.built : "");
  }
  const GUIDE_FOLDS_KEY = "rr-guide-folds";
  function guideFolds() {
    try {
      const saved = JSON.parse(localStorage.getItem(GUIDE_FOLDS_KEY) || "null");
      if (saved && typeof saved === "object") return saved;
    } catch (err) {}
    return window.trainLogField ? { key: true } : {};
  }
  function applyGuideFolds() {
    if (!trainRefDialog) return;
    const folds = guideFolds();
    trainRefDialog.querySelectorAll("[data-guide-section]").forEach(function (section) {
      const closed = Boolean(folds[section.dataset.guideSection]);
      section.classList.toggle("is-collapsed", closed);
      const button = section.querySelector(".guide-fold");
      if (button) button.setAttribute("aria-expanded", closed ? "false" : "true");
    });
  }
  if (trainRefDialog) {
    applyGuideFolds();
    trainRefDialog.addEventListener("click", function (event) {
      const button = event.target.closest(".guide-fold");
      if (!button) return;
      const section = button.closest("[data-guide-section]");
      const folds = guideFolds();
      folds[section.dataset.guideSection] = !section.classList.contains("is-collapsed");
      localStorage.setItem(GUIDE_FOLDS_KEY, JSON.stringify(folds));
      applyGuideFolds();
    });
  }

  async function openTrainRef(railroad) {
    if (!trainRefDialog) return;
    if (railroad) {
      const pass = await api("/api/reference/list?kind=passenger&q=__none__", { quiet: true });
      const passRoads = ((pass.ok && pass.data && pass.data.railroads) || []).map(function (row) {
        return row.railroad;
      });
      trainRefKind.value = passRoads.indexOf(railroad) !== -1 ? "passenger" : "freight";
      trainRefRr.innerHTML = '<option value="' + escapeText(railroad) + '" selected>' + escapeText(railroad) + "</option>";
    }
    if (!trainRefDialog.open) trainRefDialog.showModal();
    loadTrainRef();
  }
  document.addEventListener("click", function (event) {
    const btn = event.target.closest && event.target.closest("[data-train-ref]");
    if (!btn) return;
    const row = btn.closest(".train-row") || document.querySelector("#rows .train-row");
    const rr = row && row.querySelector(".f-rr");
    openTrainRef(rr && rr.value && rr.value !== "Other" ? rr.value : "");
  });
  if (trainRefBtn && trainRefDialog) {
    trainRefBtn.addEventListener("click", function () {
      openTrainRef("");
    });
    trainRefKind.addEventListener("change", loadTrainRef);
    trainRefRr.addEventListener("change", loadTrainRef);
    trainRefQ.addEventListener("input", function () {
      clearTimeout(trainRefTimer);
      trainRefTimer = setTimeout(loadTrainRef, 200);
    });
  }
  const editorCsvBtn = document.getElementById("sub-editor-add-csv");
  if (editorCsvBtn) {
    editorCsvBtn.addEventListener("click", function (event) {
      event.preventDefault();
      const input = document.getElementById("add-csv-file");
      if (input) input.click();
    });
  }
  const reloadSubs = document.getElementById("dash-sub-reload");
  if (reloadSubs) {
    reloadSubs.addEventListener("click", async function () {
      const result = await api("/api/catalog/reload", {
        method: "POST",
        work: { title: "Reloading station book…", poll: true },
      });
      if (!result.ok) {
        banner((result.data && result.data.error) || "Could not reload subdivision files.", "error");
        return;
      }
      catalog = result.data;
      renderAll();
      notifyLists();
      banner((result.data && result.data.message) || "Subdivision files reloaded.", "ok");
    });
  }
  const restoreSubs = document.getElementById("dash-sub-restore");
  if (restoreSubs) {
    restoreSubs.addEventListener("click", async function () {
      const ok = await window.askConfirm({
        title: "Restore the Shipped Subdivision List?",
        message:
          "Edits you made to shipped subdivisions are undone (a backup copy is kept in Application Support), and hidden subdivisions show again. Subdivisions you added stay.",
        ok: "Restore Shipped",
      });
      if (!ok) return;
      const result = await api("/api/catalog/restore-shipped", {
        method: "POST",
        work: { title: "Restoring shipped subdivisions…", poll: true },
      });
      if (!result.ok) {
        banner((result.data && result.data.error) || "Could not restore the shipped list.", "error");
        return;
      }
      catalog = result.data;
      renderAll();
      notifyLists();
      banner((result.data && result.data.message) || "Shipped subdivision list restored.", "ok");
    });
  }
  let inboundStamp = "";
  async function applyInbound(result, announce) {
    const data = result && result.data ? result.data : result || {};
    const imported = data.imported || [];
    const failed = data.failed || [];
    const stamp = data.last_imported_at || "";
    if (!inboundStamp) {
      inboundStamp = stamp || "0";
      return data;
    }
    if (stamp && stamp !== inboundStamp && (imported.length || failed.length)) {
      inboundStamp = stamp;
      if (announce) {
        if (imported.length) {
          banner(
            imported.length === 1
              ? imported[0].message || "Imported a subdivision CSV from the watch folder."
              : "Imported " + imported.length + " subdivision CSVs from the watch folder.",
            "ok"
          );
        }
        if (failed.length) {
          banner(failed[0].error || "Could not import a CSV from the watch folder.", "error");
        }
      }
      notifyLists();
      await loadCatalog({ quiet: true });
    } else if (stamp) {
      inboundStamp = stamp;
    }
    return data;
  }
  const inboundBtn = document.getElementById("dash-sub-inbound");
  const watchDialog = document.getElementById("watch-dialog");
  const watchPathEl = document.getElementById("watch-path");
  const watchStatusEl = document.getElementById("watch-status");
  function showWatchStatus(data) {
    const pending = (data.pending || []).length;
    const imported = (data.imported || []).length;
    const failed = (data.failed || []).length;
    const parts = [];
    if (pending) parts.push(pending + " waiting");
    if (imported) parts.push("last check imported " + imported);
    if (failed) parts.push(failed + " failed");
    watchStatusEl.textContent = parts.length ? parts.join(" · ") : "No CSVs waiting.";
  }
  async function checkWatchFolder() {
    const ingested = await api("/api/subdivisions/inbound", { method: "POST" });
    inboundStamp = inboundStamp || "0";
    const data = await applyInbound(ingested, true);
    showWatchStatus(data || {});
  }
  if (inboundBtn && watchDialog) {
    inboundBtn.addEventListener("click", async function () {
      const info = await api("/api/subdivisions/inbound");
      const data = (info && info.data) || {};
      watchPathEl.textContent = data.path || "";
      showWatchStatus(data);
      watchDialog.showModal();
    });
    document.getElementById("watch-check").addEventListener("click", checkWatchFolder);
    document.getElementById("watch-open").addEventListener("click", async function () {
      const result = await api("/api/subdivisions/inbound/open", { method: "POST" });
      if (!result.ok) {
        banner((result.data && result.data.error) || "Could not open the watch folder.", "error");
      }
    });
  }
  const dataDialog = document.getElementById("data-dialog");
  function dataDate(text) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text || "");
    if (!match) return "";
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString([], { dateStyle: "long" });
  }
  function showDataState(state) {
    const when = dataDate(state.created);
    document.getElementById("data-current").textContent =
      state.source === "update"
        ? "Using a data update" + (when ? " from " + when : "") + "."
        : "Using the station data built into TRAIN LOG" + (when ? " (" + when + ")" : "") + ".";
    document.getElementById("data-built-in").hidden = state.source !== "update";
  }
  function dataResult(text, notes) {
    document.getElementById("data-result").textContent = text || "";
    const notesEl = document.getElementById("data-notes");
    notesEl.textContent = notes || "";
    notesEl.hidden = !notes;
  }
  async function dataChanged(result) {
    showDataState(result.data);
    notifyLists();
    await loadCatalog({ quiet: true });
    banner(result.data.message, "ok");
  }
  function appResult(text, notes) {
    document.getElementById("update-app-result").textContent = text || "";
    const notesEl = document.getElementById("update-app-notes");
    notesEl.textContent = notes || "";
    notesEl.hidden = !notes;
  }
  function fromDate(text) {
    const when = dataDate(text);
    return when ? "From " + when + ". " : "";
  }
  if (dataDialog && !window.trainLogField) {
    const checkBtn = document.getElementById("data-check");
    const installBtn = document.getElementById("data-install");
    const appBtn = document.getElementById("update-app-install");
    const keyBox = document.getElementById("update-key-box");
    const keyInput = document.getElementById("update-key");
    const keyLine = document.getElementById("update-key-line");
    const keyResult = document.getElementById("update-key-result");
    const badge = document.getElementById("updates-badge");
    const note = document.getElementById("app-update-note");
    let lastFound = null;

    function showKey(has) {
      keyBox.hidden = has;
      keyLine.hidden = !has;
      checkBtn.hidden = !has;
    }
    function showFound(found, checkedNow) {
      const app = found.app || {};
      const data = found.data || {};
      if (app.available && app.latest) {
        appResult("TRAIN LOG " + app.latest.version + " is ready.", fromDate(app.latest.created) + (app.latest.notes || ""));
        appBtn.textContent = "Update to " + app.latest.version;
      } else {
        appResult(checkedNow ? "You have the newest TRAIN LOG." : "");
      }
      if (data.available && data.latest) {
        dataResult("New station data is ready.", fromDate(data.latest.created) + (data.latest.notes || ""));
      } else {
        dataResult(checkedNow ? "You have the latest station book and symbol lists." : "");
      }
      appBtn.hidden = !app.available;
      installBtn.hidden = !data.available;
      checkBtn.hidden = Boolean(app.available || data.available);
      badge.hidden = !(app.available || data.available);
    }
    async function openUpdates() {
      const info = await api("/api/updates");
      if (!info.ok) return;
      document.getElementById("update-app-current").textContent = "You have TRAIN LOG " + info.data.app_version + ".";
      showDataState(info.data.data);
      keyResult.textContent = "";
      appResult("");
      dataResult("");
      appBtn.hidden = true;
      installBtn.hidden = true;
      showKey(info.data.key);
      if (info.data.key && lastFound) showFound(lastFound, false);
      note.hidden = true;
      if (!dataDialog.open) dataDialog.showModal();
      if (!info.data.key) keyInput.focus();
    }
    async function checkNow() {
      checkBtn.disabled = true;
      appResult("Checking…");
      dataResult("");
      const result = await api("/api/updates/check", { method: "POST", quiet: true });
      checkBtn.disabled = false;
      if (!result.ok) return appResult((result.data && result.data.error) || "Couldn't check for updates.");
      lastFound = result.data;
      showDataState(result.data.data);
      showFound(result.data, true);
    }
    async function saveKey() {
      keyResult.textContent = "Checking the key code…";
      const result = await api("/api/updates/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: keyInput.value }),
        quiet: true,
      });
      if (!result.ok) {
        keyResult.textContent = (result.data && result.data.error) || "Couldn't save the key code.";
        return;
      }
      keyInput.value = "";
      keyResult.textContent = "";
      showKey(true);
      await checkNow();
    }
    window.trainLogUpdates = { open: openUpdates };
    document.getElementById("btn-updates").addEventListener("click", openUpdates);
    document.getElementById("app-update-open").addEventListener("click", openUpdates);
    document.getElementById("app-update-later").addEventListener("click", function () {
      note.hidden = true;
      localStorage.setItem("rr-update-later", new Date().toDateString() + "|" + note.dataset.message);
    });
    document.getElementById("update-key-save").addEventListener("click", saveKey);
    keyInput.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") return;
      event.preventDefault();
      saveKey();
    });
    document.getElementById("update-key-change").addEventListener("click", function () {
      keyBox.hidden = false;
      keyLine.hidden = true;
      keyInput.focus();
    });
    checkBtn.addEventListener("click", checkNow);
    appBtn.addEventListener("click", async function () {
      const latest = (lastFound && lastFound.app && lastFound.app.latest) || {};
      const info = await api("/api/updates");
      if (!info.ok) return;
      if (info.data.self_update) return appResult(info.data.self_update);
      const ok = await window.askConfirm({
        title: "Update to TRAIN LOG " + latest.version + "?",
        message:
          "TRAIN LOG downloads the new version, closes, and opens again by itself. Your log is copied to a backup before the new version opens it. This can take a few minutes.",
        ok: "Update",
      });
      if (!ok) return;
      appBtn.disabled = true;
      appResult("Downloading TRAIN LOG " + latest.version + "…");
      const result = await api("/api/updates/app/install", {
        method: "POST",
        work: { title: "Downloading the new TRAIN LOG…", poll: true },
      });
      appBtn.disabled = false;
      if (!result.ok) return appResult((result.data && result.data.error) || "Couldn't download the update.");
      appResult("TRAIN LOG is restarting…");
      window.location.href = "/__native__/finish-update";
    });
    window.setTimeout(async function () {
      const result = await api("/api/updates/auto", { quiet: true });
      if (!result.ok || !result.data.available) return;
      lastFound = result.data;
      badge.hidden = false;
      const later = localStorage.getItem("rr-update-later");
      if (later === new Date().toDateString() + "|" + result.data.message || dataDialog.open) return;
      note.dataset.message = result.data.message;
      document.getElementById("app-update-note-text").textContent = result.data.message;
      note.hidden = false;
    }, 8000);
    installBtn.addEventListener("click", async function () {
      installBtn.disabled = true;
      dataResult("Downloading and checking the update…");
      const result = await api("/api/data-updates/install", {
        method: "POST",
        work: { title: "Installing the data update…", poll: true },
      });
      installBtn.disabled = false;
      if (!result.ok) return dataResult((result.data && result.data.error) || "Couldn't install the data update.");
      installBtn.hidden = true;
      if (lastFound && lastFound.data) lastFound.data.available = false;
      checkBtn.hidden = !appBtn.hidden;
      badge.hidden = appBtn.hidden;
      dataResult("Installed. The station book and symbol lists are up to date.");
      await dataChanged(result);
    });
    document.getElementById("data-built-in").addEventListener("click", async function () {
      const ok = await window.askConfirm({
        title: "Use the Built-in Station Data?",
        message:
          "TRAIN LOG goes back to the subdivisions and symbol lists that came with this version. Your log and your own subdivision edits stay. You can install the update again later.",
        ok: "Use Built-in Data",
      });
      if (!ok) return;
      const result = await api("/api/data-updates/built-in", { method: "POST" });
      if (!result.ok) return;
      dataResult("");
      await dataChanged(result);
    });
  }
  if (!window.trainLogField) window.setInterval(async function () {
    const info = await api("/api/subdivisions/inbound", { quiet: true });
    if (!info.ok) return;
    const pending = ((info.data && info.data.pending) || []).length;
    let data;
    if (pending) {
      const ingested = await api("/api/subdivisions/inbound", { method: "POST", quiet: true });
      data = await applyInbound(ingested, true);
    } else {
      data = await applyInbound(info, true);
    }
    if (watchDialog && watchDialog.open) showWatchStatus(data || {});
  }, 5000);
  const subMenu = document.getElementById("dash-sub-menu");
  function closeSubMenu() {
    if (!subMenu || subMenu.hidden) return;
    subMenu.hidden = true;
    subMenu.innerHTML = "";
  }
  function openSubMenu(btn) {
    const file = escapeText(btn.getAttribute("data-sub-menu"));
    const hidden = btn.getAttribute("data-sub-hidden") === "1";
    // Modal card-pop is top-layer; a body-level menu sits behind it and looks dead.
    const host = btn.closest("dialog[open]") || document.body;
    if (subMenu.parentElement !== host) host.appendChild(subMenu);
    subMenu.innerHTML =
      '<button type="button" role="menuitem" data-edit-sub="' + file + '">Edit</button>' +
      (hidden
        ? '<button type="button" role="menuitem" data-unhide-sub="' + file + '">Unhide</button>'
        : '<button type="button" role="menuitem" data-hide-sub="' + file + '">Hide</button>') +
      '<button type="button" role="menuitem" class="is-danger" data-del-sub="' + file + '">Delete</button>';
    subMenu.hidden = false;
    const box = btn.getBoundingClientRect();
    const w = subMenu.offsetWidth;
    const h = subMenu.offsetHeight;
    const left = Math.max(8, Math.min(box.right - w, window.innerWidth - w - 8));
    const below = box.bottom + 4;
    const top = below + h > window.innerHeight - 8 ? Math.max(8, box.top - h - 4) : below;
    subMenu.style.left = left + "px";
    subMenu.style.top = top + "px";
    subMenu._for = btn;
  }
  document.addEventListener("click", function (event) {
    if (!subMenu || subMenu.hidden) return;
    if (subMenu.contains(event.target) || event.target === subMenu._for) return;
    closeSubMenu();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeSubMenu();
  });
  window.addEventListener("resize", closeSubMenu);
  document.addEventListener("scroll", closeSubMenu, true);
  subBody.addEventListener("click", function (event) {
    const btn = event.target.closest("[data-sub-menu]");
    if (!btn) return;
    if (!subMenu.hidden && subMenu._for === btn) {
      closeSubMenu();
      return;
    }
    openSubMenu(btn);
  });
  subMenu.addEventListener("click", async function (event) {
    const edit = event.target.getAttribute("data-edit-sub");
    const del = event.target.getAttribute("data-del-sub");
    const hide = event.target.getAttribute("data-hide-sub");
    const unhide = event.target.getAttribute("data-unhide-sub");
    if (!edit && !del && !hide && !unhide) return;
    closeSubMenu();
    if (edit) openEditor(edit);
    if (hide) {
      const sureHide = await window.askConfirm({
        title: "Hide This Subdivision?",
        message: "It comes off the pad. The CSV stays on this Mac, and Unhide puts it back.",
        details: [["File", hide]],
        ok: "Hide",
      });
      if (!sureHide) return;
      const result = await api("/api/catalog/subdivisions/" + encodeURIComponent(hide) + "/hide", {
        method: "POST",
      });
      if (!result.ok) {
        banner((result.data && result.data.error) || "Could not hide that file.", "error");
        return;
      }
      banner((result.data && result.data.message) || "Hidden.", "ok");
      notifyLists();
      await loadCatalog();
    }
    if (unhide) {
      const result = await api("/api/catalog/subdivisions/" + encodeURIComponent(unhide) + "/unhide", {
        method: "POST",
      });
      if (!result.ok) {
        banner((result.data && result.data.error) || "Could not unhide that file.", "error");
        return;
      }
      banner((result.data && result.data.message) || "Showing again.", "ok");
      notifyLists();
      await loadCatalog();
    }
    if (del) {
      const sureDel = await window.askConfirm({
        title: "Delete This Subdivision?",
        message: "It comes off the subdivision list. Sightings already logged keep their subdivision name.",
        details: [["File", del]],
        ok: "Delete Subdivision",
      });
      if (!sureDel) return;
      const result = await api("/api/catalog/subdivisions/" + encodeURIComponent(del), { method: "DELETE" });
      if (!result.ok) {
        banner((result.data && result.data.error) || "Could not delete that file.", "error");
        return;
      }
      banner((result.data && result.data.message) || "Removed.", "ok");
      notifyLists();
      await loadCatalog();
    }
  });

  document.getElementById("dash-rr-add").addEventListener("click", async function () {
    const nameEl = document.getElementById("dash-rr-name");
    const meaningEl = document.getElementById("dash-rr-meaning");
    const name = (nameEl.value || "").trim().toUpperCase();
    const label = document.getElementById("dash-rr-group").value;
    const classEl = document.getElementById("dash-rr-class");
    const rrClass = classEl && classChoices(label).length ? classEl.value : "";
    const meaning = (meaningEl.value || "").trim();
    if (!name) {
      banner("Enter a railroad mark.", "error");
      nameEl.focus();
      return;
    }
    const result = await api("/api/catalog/railroads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name, group: label, meaning: meaning, rr_class: rrClass }),
    });
    if (!result.ok) {
      banner((result.data && result.data.error) || "Could not add that railroad.", "error");
      return;
    }
    nameEl.value = "";
    meaningEl.value = "";
    if (classEl) classEl.value = "";
    const rrDialog = document.getElementById("rr-add-dialog");
    if (rrDialog && rrDialog.open) rrDialog.close();
    banner("Railroad list updated.", "ok");
    notifyLists();
    await loadCatalog();
  });
  rrGroupsEl.addEventListener("change", async function (event) {
    const name = event.target.getAttribute("data-acro-rr");
    if (!name) return;
    await saveMeaning("railroads", name, event.target.value);
  });
  rrGroupsEl.addEventListener("click", async function (event) {
    const classBtn = event.target.closest("[data-rr-class]");
    if (classBtn) {
      openRrClassPop(classBtn);
      return;
    }
    const name = event.target.getAttribute("data-del-rr");
    if (!name) return;
    const sure = await window.askConfirm({
      title: "Remove " + name + "?",
      message: "It comes off the Railroad menu on the pad. Sightings already logged keep it.",
      ok: "Remove Railroad",
    });
    if (!sure) return;
    const groups = groupsPayload().map(function (group) {
      group.railroads = (group.railroads || []).filter(function (item) {
        return item !== name;
      });
      return group;
    });
    await saveGroups(groups);
  });
  document.getElementById("dash-rr-reset").addEventListener("click", async function () {
    const sure = await window.askConfirm({
      title: "Restore the Shipped Railroad Lists?",
      message: "Freight and passenger railroads go back to the lists as issued.",
      ok: "Restore Shipped",
    });
    if (!sure) return;
    const result = await api("/api/catalog/railroads/reset", { method: "POST" });
    if (!result.ok) return;
    banner("Railroad list restored.", "ok");
    notifyLists();
    await loadCatalog();
  });

  document.getElementById("dash-type-add").addEventListener("click", async function () {
    const nameEl = document.getElementById("dash-type-name");
    const name = (nameEl.value || "").trim();
    const meaning = (document.getElementById("dash-type-meaning").value || "").trim();
    if (!name) {
      banner("Enter a train type.", "error");
      nameEl.focus();
      return;
    }
    const result = await api("/api/catalog/types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name, meaning: meaning }),
    });
    if (!result.ok) {
      banner((result.data && result.data.error) || "Could not add that type.", "error");
      return;
    }
    document.getElementById("dash-type-name").value = "";
    document.getElementById("dash-type-meaning").value = "";
    const typeDialog = document.getElementById("type-add-dialog");
    if (typeDialog && typeDialog.open) typeDialog.close();
    banner("Train type added.", "ok");
    notifyLists();
    await loadCatalog();
  });
  typesEl.addEventListener("change", async function (event) {
    const name = event.target.getAttribute("data-acro-type");
    if (!name) return;
    await saveMeaning("types", name, event.target.value);
  });
  typesEl.addEventListener("click", async function (event) {
    const name = event.target.getAttribute("data-del-type");
    if (!name) return;
    const sure = await window.askConfirm({
      title: "Remove " + name + "?",
      message: "The chip comes off the pad. Sightings already logged keep this type.",
      ok: "Remove Type",
    });
    if (!sure) return;
    const result = await api("/api/catalog/types/" + encodeURIComponent(name), { method: "DELETE" });
    if (!result.ok) return;
    banner("Train type removed from the pad.", "ok");
    notifyLists();
    await loadCatalog();
  });
  if (stationStatsDialog) {
    stationStatsDialog.addEventListener("change", function (event) {
      if (!event.target.hasAttribute || !event.target.hasAttribute("data-station-chart")) return;
      stationChart = event.target.value || "cards";
      try {
        localStorage.setItem("rr-station-chart", stationChart);
      } catch (e) {}
      renderRoads();
    });
  }

  function wireReorder(root, commit) {
    let dragging = null;
    let startOrder = "";

    function orderKey() {
      return Array.prototype.map
        .call(root.querySelectorAll("[data-order-row]"), function (row) {
          return row.getAttribute("data-order-row");
        })
        .join("\n");
    }

    function sameList(a, b) {
      return a && b && a.closest("[data-order-list]") === b.closest("[data-order-list]");
    }

    function stepTarget(row, dir) {
      let next = dir < 0 ? row.previousElementSibling : row.nextElementSibling;
      while (next && !next.hasAttribute("data-order-row")) {
        next = dir < 0 ? next.previousElementSibling : next.nextElementSibling;
      }
      if (!next || next.hasAttribute("data-pinned")) return null;
      return next;
    }

    root.addEventListener("mousedown", function (event) {
      const handle = event.target.closest("[data-drag-handle]");
      if (!handle) return;
      const row = handle.closest("[data-order-row]");
      if (row) row.draggable = true;
    });
    root.addEventListener("mouseup", function (event) {
      const row = event.target.closest("[data-order-row]");
      if (row && row !== dragging) row.draggable = false;
    });
    root.addEventListener("dragstart", function (event) {
      const row = event.target.closest && event.target.closest("[data-order-row]");
      if (!row || !row.draggable) return;
      dragging = row;
      startOrder = orderKey();
      row.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      try {
        event.dataTransfer.setData("text/plain", row.getAttribute("data-order-row"));
      } catch (e) {}
    });
    root.addEventListener("dragover", function (event) {
      if (!dragging) return;
      const target = event.target.closest && event.target.closest("[data-order-row]");
      event.preventDefault();
      if (!target || target === dragging || !sameList(target, dragging)) return;
      const rect = target.getBoundingClientRect();
      const after = event.clientY > rect.top + rect.height / 2;
      if (!after && target.hasAttribute("data-pinned")) return;
      target.parentNode.insertBefore(dragging, after ? target.nextSibling : target);
    });
    root.addEventListener("drop", function (event) {
      if (dragging) event.preventDefault();
    });
    root.addEventListener("dragend", function () {
      if (!dragging) return;
      const row = dragging;
      dragging = null;
      row.draggable = false;
      row.classList.remove("is-dragging");
      if (orderKey() !== startOrder) commit(row.getAttribute("data-order-row"));
    });
    root.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      const handle = event.target.closest("[data-drag-handle]");
      if (!handle) return;
      const row = handle.closest("[data-order-row]");
      const target = row && stepTarget(row, event.key === "ArrowUp" ? -1 : 1);
      event.preventDefault();
      if (!target) return;
      target.parentNode.insertBefore(row, event.key === "ArrowUp" ? target : target.nextSibling);
      handle.focus();
      commit(row.getAttribute("data-order-row"));
    });
  }

  wireReorder(typesEl, async function () {
    const names = Array.prototype.map.call(typesEl.querySelectorAll("[data-order-row]"), function (row) {
      return row.getAttribute("data-order-row");
    });
    const result = await api("/api/catalog/types", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ types: names }),
      quiet: true,
    });
    if (!result.ok) {
      banner((result.data && result.data.error) || "Could not save the new order.", "error");
      await loadCatalog();
      return;
    }
    if (catalog) catalog.types = result.data.types;
    notifyLists();
  });

  wireReorder(rrGroupsEl, async function () {
    const groups = Array.prototype.map.call(rrGroupsEl.querySelectorAll("[data-group-label]"), function (group) {
      return {
        label: group.getAttribute("data-group-label"),
        railroads: Array.prototype.map.call(group.querySelectorAll("[data-order-row]"), function (row) {
          return row.getAttribute("data-order-row");
        }),
      };
    });
    const result = await api("/api/catalog/railroads", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groups: groups }),
      quiet: true,
    });
    if (!result.ok) {
      banner((result.data && result.data.error) || "Could not save the new order.", "error");
      await loadCatalog();
      return;
    }
    if (catalog) catalog.groups = result.data.groups;
    notifyLists();
  });

  document.getElementById("dash-type-reset").addEventListener("click", async function () {
    const sure = await window.askConfirm({
      title: "Restore the Shipped Train Types?",
      message: "Train type chips go back to the list as issued.",
      ok: "Restore Shipped",
    });
    if (!sure) return;
    await api("/api/catalog/types/reset", { method: "POST" });
    banner("Train types restored.", "ok");
    notifyLists();
    await loadCatalog();
  });

  const tripPicksEl = document.getElementById("dash-trip-picks");
  const TRIP_PICK_KINDS = [
    ["attendees", "Attendees", "attendee"],
    ["vehicles", "Vehicles", "vehicle"],
  ];
  let tripPicks = { attendees: [], vehicles: [] };

  function renderTripPicks() {
    if (!tripPicksEl) return;
    tripPicksEl.innerHTML = TRIP_PICK_KINDS.map(function (kind) {
      const names = tripPicks[kind[0]] || [];
      return (
        '<div class="dash-pick-group"><h4>' +
        kind[1] +
        '</h4><div class="dash-acro-list" data-order-list data-pick-kind="' +
        kind[0] +
        '">' +
        (names.length
          ? names
              .map(function (name) {
                return (
                  '<div class="dash-acro-row dash-pick-row" data-order-row="' +
                  escapeText(name) +
                  '">' +
                  dragHandle(name) +
                  "<b>" +
                  escapeText(name) +
                  '</b><button type="button" data-del-pick="' +
                  kind[0] +
                  '" aria-label="Remove ' +
                  escapeText(name) +
                  '">×</button></div>'
                );
              })
              .join("")
          : '<p class="muted">None yet.</p>') +
        '</div><div class="dash-tools dash-pick-add"><input type="text" maxlength="100" autocomplete="off" data-pick-new="' +
        kind[0] +
        '" aria-label="New ' +
        kind[2] +
        '" /><button type="button" class="btn primary" data-pick-add="' +
        kind[0] +
        '">Add</button></div></div>'
      );
    }).join("");




    settingsBoard.layout();
  }

  function pickNames(kind) {
    return Array.prototype.map.call(
      tripPicksEl.querySelectorAll('[data-pick-kind="' + kind + '"] [data-order-row]'),
      function (row) {
        return row.getAttribute("data-order-row");
      }
    );
  }

  async function loadTripPicks() {
    if (!tripPicksEl) return;
    const result = await api("/api/trip-picks", { quiet: true });
    if (result.ok && result.data && result.data.picks) tripPicks = result.data.picks;
    renderTripPicks();
  }

  async function saveTripPicks(changes, message) {
    const result = await api("/api/trip-picks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
      quiet: true,
    });
    if (!result.ok) {
      banner((result.data && result.data.error) || "Could not save the Trip Details picks.", "error");
      await loadTripPicks();
      return false;
    }
    tripPicks = result.data.picks;
    renderTripPicks();
    if (message) banner(message, "ok");
    if (window.trainLog && window.trainLog.refreshTrips) window.trainLog.refreshTrips();
    return true;
  }

  async function addTripPick(kind) {
    const input = tripPicksEl.querySelector('[data-pick-new="' + kind + '"]');
    const name = ((input && input.value) || "").replace(/\s+/g, " ").trim();
    if (!name) {
      banner("Type a name first.", "error");
      if (input) input.focus();
      return;
    }
    const names = pickNames(kind);
    if (
      names.some(function (item) {
        return item.toLowerCase() === name.toLowerCase();
      })
    ) {
      banner(name + " is already on the list.", "error");
      input.focus();
      return;
    }
    const changes = {};
    changes[kind] = names.concat([name]);
    if (await saveTripPicks(changes, name + " added.")) {
      const again = tripPicksEl.querySelector('[data-pick-new="' + kind + '"]');
      if (again) again.focus();
    }
  }

  if (tripPicksEl) {
    tripPicksEl.addEventListener("click", async function (event) {
      const add = event.target.closest("[data-pick-add]");
      if (add) {
        await addTripPick(add.getAttribute("data-pick-add"));
        return;
      }
      const del = event.target.closest("[data-del-pick]");
      if (!del) return;
      const kind = del.getAttribute("data-del-pick");
      const name = del.closest("[data-order-row]").getAttribute("data-order-row");
      const sure = await window.askConfirm({
        title: "Remove " + name + "?",
        message: "It comes off the Trip Details dropdown. Trips that already list " + name + " keep it.",
        ok: "Remove",
      });
      if (!sure) return;
      const changes = {};
      changes[kind] = pickNames(kind).filter(function (item) {
        return item !== name;
      });
      await saveTripPicks(changes, name + " removed.");
    });
    tripPicksEl.addEventListener("keydown", function (event) {
      const input = event.target.closest && event.target.closest("[data-pick-new]");
      if (!input || event.key !== "Enter") return;
      event.preventDefault();
      addTripPick(input.getAttribute("data-pick-new"));
    });
    wireReorder(tripPicksEl, function () {
      saveTripPicks({ attendees: pickNames("attendees"), vehicles: pickNames("vehicles") });
    });
    document.getElementById("dash-picks-reset").addEventListener("click", async function () {
      const sure = await window.askConfirm({
        title: "Restore the Default Trip Details Picks?",
        message: "The attendee and vehicle dropdowns go back to the list as issued.",
        ok: "Restore Defaults",
      });
      if (!sure) return;
      const result = await api("/api/trip-picks/reset", { method: "POST", quiet: true });
      if (!result.ok) return;
      tripPicks = result.data.picks;
      renderTripPicks();
      banner("Trip Details picks restored.", "ok");
      if (window.trainLog && window.trainLog.refreshTrips) window.trainLog.refreshTrips();
    });
    loadTripPicks();
  }

  document.querySelectorAll(".type-filters-panel").forEach(function (panel) {
    const addBtn = panel.querySelector(".type-filter-add");
    const resetBtn = panel.querySelector(".type-filter-reset");
    const listEl = panel.querySelector(".type-filters-list");
    const toEl = panel.querySelector(".type-filter-to");
    if (addBtn) {
      addBtn.addEventListener("click", async function () {
        const fromEl = panel.querySelector(".type-filter-from");
        const stored = ((toEl && toEl.value) || "").trim();
        const incoming = ((fromEl && fromEl.value) || "").trim();
        if (!incoming) {
          banner("Enter an incoming label.", "error");
          if (fromEl) fromEl.focus();
          return;
        }
        if (!stored) {
          banner("Choose a stored type.", "error");
          if (toEl) toEl.focus();
          return;
        }
        const result = await api("/api/catalog/type-filters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ incoming: incoming, stored: stored }),
        });
        if (!result.ok) {
          banner((result.data && result.data.error) || "Could not add that filter.", "error");
          return;
        }
        if (fromEl) fromEl.value = "";
        banner("Import filter added.", "ok");
        await loadCatalog();
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener("click", async function () {
        const sure = await window.askConfirm({
          title: "Remove Extra Import Filters?",
          message: "Built-in matching for case, order, and Stands for names stays.",
          ok: "Remove Filters",
        });
        if (!sure) return;
        const result = await api("/api/catalog/type-filters/reset", { method: "POST" });
        if (!result.ok) {
          banner((result.data && result.data.error) || "Could not restore import filters.", "error");
          return;
        }
        banner("Import filters restored.", "ok");
        await loadCatalog();
      });
    }
    if (listEl) {
      listEl.addEventListener("click", async function (event) {
        const incoming = event.target.getAttribute("data-del-type-filter");
        if (!incoming) return;
        const sure = await window.askConfirm({
          title: "Remove This Import Filter?",
          details: [["Incoming", incoming]],
          ok: "Remove Filter",
        });
        if (!sure) return;
        const result = await api("/api/catalog/type-filters/" + encodeURIComponent(incoming), {
          method: "DELETE",
        });
        if (!result.ok) {
          banner((result.data && result.data.error) || "Could not remove that filter.", "error");
          return;
        }
        banner("Import filter removed.", "ok");
        await loadCatalog();
      });
    }
  });

  const typeFiltersDialog = document.getElementById("type-filters-dialog");
  const logFiltersBtn = document.getElementById("btn-log-type-filters");
  if (logFiltersBtn && typeFiltersDialog) {
    logFiltersBtn.addEventListener("click", async function () {
      if (!catalog) await loadCatalog({ quiet: true });
      else renderTypeFilters();
      typeFiltersDialog.showModal();
    });
  }
  document.querySelectorAll(".type-filters-dialog-close").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (typeFiltersDialog) typeFiltersDialog.close();
    });
  });
  if (typeFiltersDialog) {
    typeFiltersDialog.addEventListener("click", function (event) {
      if (event.target === typeFiltersDialog) typeFiltersDialog.close();
    });
  }
  const importFiltersBtn = document.getElementById("btn-import-filters");
  const importFiltersStage = document.getElementById("import-filters-stage");
  if (importFiltersBtn && importFiltersStage) {
    importFiltersBtn.addEventListener("click", async function () {
      const open = importFiltersStage.hidden;
      if (open && !catalog) await loadCatalog({ quiet: true });
      importFiltersStage.hidden = !open;
      importFiltersBtn.classList.toggle("is-active", open);
      importFiltersBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  document.getElementById("sub-editor-add-loc").addEventListener("click", function () {
    const body = document.getElementById("sub-editor-locs");
    const last = body.querySelector("tr:last-child .sub-loc-state");
    const row = locRow("", "", last ? last.value : "");
    body.appendChild(row);
    const wrap = body.closest(".table-wrap");
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
    const spot = row.querySelector(".sub-loc-spot");
    if (spot) spot.focus();
  });
  document.getElementById("sub-editor-locs").addEventListener("click", async function (event) {
    const favBtn = event.target.closest(".sub-loc-fav");
    if (favBtn) {
      event.preventDefault();
      const row = favBtn.closest("tr");
      const spot = spotFromEditorRow(row);
      if (!spot || !spot.location) {
        banner("Enter a location name before starring it.", "error");
        return;
      }
      if (!spot.subdivision) {
        banner("Enter the subdivision name before starring a location.", "error");
        return;
      }
      if (window.trainLogQuickSpots && typeof window.trainLogQuickSpots.toggle === "function") {
        await window.trainLogQuickSpots.toggle(spot);
        syncEditorFavoriteKeys(window.trainLogQuickSpots.list());
      } else {
        const removing = Boolean(editorFavoriteKeys[spotKeyOf(spot)]);
        const result = await api(removing ? "/api/quick-spots/remove" : "/api/quick-spots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spot: spot }),
        });
        if (!result.ok) {
          banner((result.data && result.data.error) || "Could not update favorites.", "error");
          return;
        }
        syncEditorFavoriteKeys((result.data && result.data.favorites) || []);
        banner(removing ? "Removed from Quick Spots." : "Saved to Quick Spots favorites.", "ok");
      }
      paintEditorFavButtons();
      return;
    }
    if (!event.target.classList.contains("sub-loc-del")) return;
    const row = event.target.closest("tr");
    if (!row) return;
    const spot = row.querySelector(".sub-loc-spot");
    const mp = row.querySelector(".sub-loc-mp");
    if (spot && spot.value.trim()) {
      const sure = await window.askConfirm({
        title: "Remove This Location?",
        message: "It comes off this subdivision when you save. Cancel in the editor keeps it.",
        details: [
          ["Location", spot.value.trim()],
          ["Milepost", mp ? mp.value.trim() : ""],
        ],
        ok: "Remove Location",
      });
      if (!sure) return;
    }
    row.remove();
  });
  document.getElementById("sub-editor-locs").addEventListener("input", function (event) {
    if (!event.target.closest("tr")) return;
    if (
      event.target.classList.contains("sub-loc-spot") ||
      event.target.classList.contains("sub-loc-mp") ||
      event.target.classList.contains("sub-loc-state")
    ) {
      paintEditorFavButton(event.target.closest("tr"));
    }
  });
  document.getElementById("sub-editor-locs").addEventListener("change", function (event) {
    if (event.target.classList.contains("sub-loc-mp")) sortEditorLocs();
    if (event.target.closest("tr")) paintEditorFavButton(event.target.closest("tr"));
  });
  const subEditorName = document.getElementById("sub-editor-name");
  if (subEditorName) {
    subEditorName.addEventListener("input", paintEditorFavButtons);
  }
  const subEditorRrs = document.getElementById("sub-editor-rrs");
  if (subEditorRrs) {
    subEditorRrs.addEventListener("change", paintEditorFavButtons);
  }
  const rrAddOpen = document.getElementById("dash-rr-add-open");
  [
    ["rr-add-dialog", "dash-rr-add"],
    ["type-add-dialog", "dash-type-add"],
  ].forEach(function (pair) {
    const dialog = document.getElementById(pair[0]);
    const addBtn = document.getElementById(pair[1]);
    if (!dialog || !addBtn) return;
    dialog.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" || event.target.tagName !== "INPUT") return;
      event.preventDefault();
      addBtn.click();
    });
  });
  const rrAddDialog = document.getElementById("rr-add-dialog");
  const rrGroupPick = document.getElementById("dash-rr-group");
  const rrClassField = document.getElementById("dash-rr-class-field");
  function syncRrClassField() {
    if (!rrGroupPick || !rrClassField) return;
    const choices = classChoices(rrGroupPick.value);
    const classEl = document.getElementById("dash-rr-class");
    rrClassField.hidden = !choices.length;
    if (classEl) {
      classEl.innerHTML =
        '<option value="">Not Set</option>' +
        choices
          .map(function (label) {
            return '<option value="' + escapeText(label) + '">' + escapeText(label) + "</option>";
          })
          .join("");
    }
  }
  if (rrGroupPick) rrGroupPick.addEventListener("change", syncRrClassField);
  if (rrAddOpen && rrAddDialog) {
    rrAddOpen.addEventListener("click", function () {
      syncRrClassField();
      rrAddDialog.showModal();
      const nameEl = document.getElementById("dash-rr-name");
      if (nameEl) nameEl.focus();
    });
  }
  const typeAddOpen = document.getElementById("dash-type-add-open");
  const typeAddDialog = document.getElementById("type-add-dialog");
  if (typeAddOpen && typeAddDialog) {
    typeAddOpen.addEventListener("click", function () {
      typeAddDialog.showModal();
      const nameEl = document.getElementById("dash-type-name");
      if (nameEl) nameEl.focus();
    });
  }
  document.getElementById("sub-editor-save").addEventListener("click", saveEditor);
  const editorCancel = document.getElementById("sub-editor-cancel");
  if (editorCancel) {
    editorCancel.addEventListener("click", function () {
      if (editor) editor.close();
    });
  }
  if (editor) {
    editor.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && event.target && event.target.tagName !== "BUTTON") {
        event.preventDefault();
      }
    });
  }

  if (logRrSortEl) {
    logRrSortEl.addEventListener("change", function () {
      logRrSort = logRrSortEl.value || "count";
      renderLog();
    });
  }
  if (logTypeRrEl) {
    logTypeRrEl.addEventListener("change", function () {
      logTypeRr = logTypeRrEl.value || "";
      renderLog();
    });
  }
  if (logListSortEl) {
    logListSortEl.addEventListener("change", function () {
      logListSort = logListSortEl.value || "count";
      renderLog();
    });
  }
  if (logListTopEl) {
    logListTopEl.value = String(listTop);
    logListTopEl.addEventListener("change", function () {
      listTop = clampListTop(logListTopEl.value);
      try {
        localStorage.setItem("rr-log-list-top", String(listTop));
      } catch (e) {}
      renderLog();
    });
  }
  const logLegendBtn = document.getElementById("dash-log-legend");
  const logLegendDialog = document.getElementById("dash-log-legend-dialog");
  if (logLegendBtn && logLegendDialog) {
    logLegendBtn.addEventListener("click", function () {
      logLegendDialog.showModal();
    });
  }
  if (logChartExportEl) {
    logChartExportEl.addEventListener("click", exportLogStats);
  }
  const subFilesBtn = document.getElementById("dash-sub-files");
  const subFilesMenu = document.getElementById("dash-sub-files-menu");
  function closeSubFilesMenu() {
    if (!subFilesMenu || subFilesMenu.hidden) return;
    subFilesMenu.hidden = true;
    subFilesBtn.setAttribute("aria-expanded", "false");
  }
  if (subFilesBtn && subFilesMenu) {
    subFilesBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      const open = subFilesMenu.hidden;
      subFilesMenu.hidden = !open;
      subFilesBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    subFilesMenu.addEventListener("click", function (event) {
      if (event.target.closest("button")) closeSubFilesMenu();
    });
    document.addEventListener("click", function (event) {
      if (!subFilesMenu.contains(event.target) && event.target !== subFilesBtn) closeSubFilesMenu();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeSubFilesMenu();
    });
  }
  const logAddBtn = document.getElementById("dash-log-add");
  const logAddMenu = document.getElementById("dash-log-add-menu");
  function renderAddMenu() {
    if (!logAddMenu) return;
    const shown = shownSources();
    const missing = SOURCE_META.filter(function (meta) {
      return shown.indexOf(meta.id) === -1;
    });
    const groups = [];
    SOURCE_META.forEach(function (meta) {
      if (groups.indexOf(meta.group) === -1) groups.push(meta.group);
    });
    logAddMenu.innerHTML =
      '<button type="button" data-add-all' +
      (missing.length ? "" : " disabled") +
      ">" +
      (missing.length
        ? "Add every chart not on the board (" + missing.length + ")"
        : "Every chart is on the board") +
      "</button>" +
      (extraSlots.length
        ? '<button type="button" data-add-clear>Remove Added Charts (' + extraSlots.length + ")</button>"
        : "") +
      (boardOrder.join() !== cleanBoardOrder(DEFAULT_BOARD_ORDER).join()
        ? '<button type="button" data-add-reset>Reset Card Order</button>'
        : "") +
      groups
        .map(function (group) {
          return (
            '<p class="dash-add-group">' +
            escapeText(group) +
            "</p>" +
            SOURCE_META.filter(function (meta) {
              return meta.group === group;
            })
              .map(function (meta) {
                const on = shown.indexOf(meta.id) !== -1;
                return (
                  '<button type="button" data-add-source="' +
                  meta.id +
                  '"' +
                  (on ? ' class="is-on" title="Already on the board; adds another copy"' : "") +
                  ">" +
                  escapeText(meta.title) +
                  (on ? " ✓" : "") +
                  "</button>"
                );
              })
              .join("")
          );
        })
        .join("");
  }
  function closeAddMenu() {
    if (!logAddMenu || logAddMenu.hidden) return;
    logAddMenu.hidden = true;
    if (logAddBtn) logAddBtn.setAttribute("aria-expanded", "false");
  }
  function boardChanged(focusSlot) {
    saveExtraSlots();
    saveExportPicks();
    boardOrder = cleanBoardOrder(boardOrder);
    try {
      localStorage.setItem("rr-log-board-order", JSON.stringify(boardOrder));
    } catch (e) {}
    renderLog();
    if (focusSlot) {
      const card = document.querySelector('.dash-board-card[data-card="' + focusSlot + '"]');
      if (card && card.scrollIntoView) card.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }
  if (logAddBtn && logAddMenu) {
    logAddBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      const open = logAddMenu.hidden;
      closeLogMoreMenu();
      if (open) renderAddMenu();
      logAddMenu.hidden = !open;
      logAddBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    logAddMenu.addEventListener("click", function (event) {
      event.stopPropagation();
      const btn = event.target.closest && event.target.closest("button");
      if (!btn || btn.disabled) return;
      let focus = "";
      if (btn.hasAttribute("data-add-all")) {
        const shown = shownSources();
        SOURCE_META.forEach(function (meta) {
          if (shown.indexOf(meta.id) !== -1) return;
          const slot = addChartCard(meta.id);
          if (!focus) focus = slot;
        });
      } else if (btn.hasAttribute("data-add-clear")) {
        extraSlots.slice().forEach(dropChartCard);
      } else if (btn.hasAttribute("data-add-reset")) {
        boardOrder = DEFAULT_BOARD_ORDER.slice();
      } else {
        focus = addChartCard(btn.getAttribute("data-add-source"));
      }
      closeAddMenu();
      boardChanged(focus);
    });
    document.addEventListener("click", closeAddMenu);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeAddMenu();
    });
  }
  const logPaneEl = document.getElementById("dash-pane-log");
  if (logPaneEl) {
    logPaneEl.addEventListener("click", function (event) {
      const btn = event.target.closest && event.target.closest("[data-remove-slot]");
      if (!btn) return;
      dropChartCard(btn.getAttribute("data-remove-slot"));
      boardChanged("");
    });
  }
  const logMoreBtn = document.getElementById("dash-log-more");
  const logMoreMenu = document.getElementById("dash-log-more-menu");
  function closeLogMoreMenu() {
    if (!logMoreMenu || logMoreMenu.hidden) return;
    logMoreMenu.hidden = true;
    if (logMoreBtn) logMoreBtn.setAttribute("aria-expanded", "false");
  }
  if (logMoreBtn && logMoreMenu) {
    logMoreBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      closeAddMenu();
      const open = logMoreMenu.hidden;
      logMoreMenu.hidden = !open;
      logMoreBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    logMoreMenu.addEventListener("click", function (event) {
      event.stopPropagation();
      closeLogMoreMenu();
    });
    document.addEventListener("click", closeLogMoreMenu);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeLogMoreMenu();
    });
  }
  if (logExportSvgBtn) {
    logExportSvgBtn.addEventListener("click", function () {
      if (!pendingExport.svg) return;
      downloadBlob(pendingExport.svg, pendingExport.stem + ".svg");
      logNote("Saving " + pendingExport.stem + ".svg.", "ok");
    });
  }
  if (logExportPdfBtn) {
    logExportPdfBtn.addEventListener("click", function () {
      if (!pendingExport.pdf) return;
      downloadBlob(pendingExport.pdf, pendingExport.stem + ".pdf");
      logNote("Saving " + pendingExport.stem + ".pdf.", "ok");
    });
  }
  if (logExportPicksEl) {
    
  const YEAR_EXPORT_KEYS = [
    "totals", "types", "railroads", "locations", "subdivisions", "states",
    "hours", "weekdays", "months", "leads", "symbols", "heritageunits",
    "steamengines", "media", "mediarate", "nightflag", "coalmarks", "firsts", "huntlist", "glance"
  ];
  function applyYearInTrainsPreset() {
    const allowed = {};
    exportSections().forEach(function (section) {
      section.items.forEach(function (item) { allowed[item[0]] = true; });
    });
    exportPicks = {};
    YEAR_EXPORT_KEYS.forEach(function (key) {
      if (allowed[key]) exportPicks[key] = true;
    });
    // Always keep core boards even if named differently in export list
    ["totals", "types", "railroads"].forEach(function (key) {
      if (allowed[key]) exportPicks[key] = true;
    });
    saveExportPicks();
    renderExportPicks();
    if (logExportStatus) logExportStatus.textContent = "Year in Trains preset selected — export when ready.";
  }
  const yearExportBtn = document.getElementById("dash-export-year");
  if (yearExportBtn && !yearExportBtn._bound) {
    yearExportBtn._bound = true;
    yearExportBtn.addEventListener("click", applyYearInTrainsPreset);
  }

logExportPicksEl.addEventListener("change", function (event) {
      const key = event.target.getAttribute("data-export-pick");
      if (!key) return;
      exportPicks[key] = event.target.checked;
      clearTimeout(exportTimer);
      exportTimer = setTimeout(assembleExport, 250);
    });
  }
  const logExportThemeSel = document.getElementById("dash-export-theme");
  if (logExportThemeSel) {
    logExportThemeSel.addEventListener("change", function () {
      exportThemeId = logExportThemeSel.value;
      try {
        if (exportThemeId) localStorage.setItem("rr-export-theme", exportThemeId);
        else localStorage.removeItem("rr-export-theme");
      } catch (e) {}
      renderExportThemePick();
      clearTimeout(exportTimer);
      assembleExport();
    });
  }
  if (logExportDialog) {
    logExportDialog.addEventListener("click", function (event) {
      const which = event.target.getAttribute && event.target.getAttribute("data-export-set");
      if (!which) return;
      exportPicks = {};
      const keys =
        which === "all"
          ? exportSections().reduce(function (acc, section) {
              return acc.concat(
                section.items.map(function (item) {
                  return item[0];
                })
              );
            }, [])
          : which === "stats"
          ? EXPORT_DEFAULT
          : [];
      keys.forEach(function (key) {
        exportPicks[key] = true;
      });
      renderExportPicks();
      clearTimeout(exportTimer);
      assembleExport();
    });
    logExportDialog.addEventListener("close", function () {
      exportRun++;
      clearTimeout(exportTimer);
      pendingExport.svg = null;
      pendingExport.pdf = null;
      showExportPreview(null);
      if (logExportSvgBtn) logExportSvgBtn.disabled = true;
      if (logExportPdfBtn) logExportPdfBtn.disabled = true;
    });
    new MutationObserver(function () {
      if (logExportDialog.open) assembleExport();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }
  const compareBtn = document.getElementById("dash-log-compare");
  const compareDialog = document.getElementById("dash-compare");
  const compareRowsEl = document.getElementById("compare-rows");
  const compareColsEl = document.getElementById("compare-cols");
  const compareShowEl = document.getElementById("compare-show");
  const compareLimitEl = document.getElementById("compare-limit");
  const compareGridEl = document.getElementById("compare-grid");
  const compareNoteEl = document.getElementById("compare-note");
  const compareTrainsEl = document.getElementById("compare-trains");
  let compareDims = null;
  let compareData = null;
  let compareRun = 0;
  const comparePick = { rows: "hour", cols: "railroad", show: "count", limit: "12" };
  try {
    Object.assign(comparePick, JSON.parse(localStorage.getItem("rr-compare") || "{}"));
  } catch (e) {}

  function saveComparePick() {
    try {
      localStorage.setItem("rr-compare", JSON.stringify(comparePick));
    } catch (e) {}
  }

  function fillCompareSelects() {
    const groups = [];
    (compareDims || []).forEach(function (dim) {
      let group = groups.find(function (g) { return g.label === dim.group; });
      if (!group) groups.push((group = { label: dim.group, items: [] }));
      group.items.push(dim);
    });
    const html = groups
      .map(function (g) {
        return (
          '<optgroup label="' + escapeText(g.label) + '">' +
          g.items.map(function (d) { return '<option value="' + escapeText(d.key) + '">' + escapeText(d.label) + "</option>"; }).join("") +
          "</optgroup>"
        );
      })
      .join("");
    compareRowsEl.innerHTML = html;
    compareColsEl.innerHTML = html;
    compareRowsEl.value = comparePick.rows;
    compareColsEl.value = comparePick.cols;
    compareShowEl.value = comparePick.show;
    compareLimitEl.value = comparePick.limit;
    if (!compareRowsEl.value) compareRowsEl.value = "hour";
    if (!compareColsEl.value) compareColsEl.value = "railroad";
  }

  function compareParams(extra) {
    const base = catalogQuery();
    const parts = [
      "rows=" + encodeURIComponent(comparePick.rows),
      "cols=" + encodeURIComponent(comparePick.cols),
      "limit=" + encodeURIComponent(comparePick.limit),
    ].concat(extra || []);
    return "/api/catalog/compare" + (base ? base + "&" : "?") + parts.join("&");
  }

  function comparePct(value, total) {
    if (!total) return "";
    const pct = (value / total) * 100;
    return (pct >= 10 || pct === 0 ? Math.round(pct) : pct.toFixed(1)) + "%";
  }

  function renderCompare() {
    const data = compareData;
    if (!data) return;
    compareTrainsEl.hidden = true;
    compareTrainsEl.innerHTML = "";
    if (!data.rows.names.length || !data.cols.names.length) {
      compareGridEl.innerHTML = '<p class="muted">No trains have both a ' + escapeText(data.rows.label.toLowerCase()) + " and a " + escapeText(data.cols.label.toLowerCase()) + " for these dates.</p>";
      compareNoteEl.textContent = "";
      return;
    }
    const show = comparePick.show;
    let html = '<table class="compare-table"><thead><tr><th scope="col" class="compare-corner">' +
      escapeText(data.rows.label) + " ↓ · " + escapeText(data.cols.label) + " →</th>";
    data.cols.names.forEach(function (name) {
      html += '<th scope="col">' + escapeText(name) + "</th>";
    });
    html += '<th scope="col" class="compare-total">Total</th></tr></thead><tbody>';
    data.rows.names.forEach(function (rname, ri) {
      const rowTotal = data.rows.totals[ri];
      html += '<tr><th scope="row">' + escapeText(rname) + "</th>";
      data.cols.names.forEach(function (cname, ci) {
        const n = data.cells[ri][ci];
        if (!n) {
          html += '<td class="is-zero">·</td>';
          return;
        }
        const shade = Math.round(12 + 70 * (n / (data.max || 1)));
        const label = show === "row" ? comparePct(n, rowTotal) : show === "col" ? comparePct(n, data.cols.totals[ci]) : String(n);
        html += '<td class="' + (n < 3 ? "is-small" : "") + '" style="--shade:' + shade + '%">' +
          '<button type="button" data-ri="' + ri + '" data-ci="' + ci + '" title="' +
          escapeText(rname + " · " + cname + ": " + n + " train" + (n === 1 ? "" : "s")) + '">' + label + "</button></td>";
      });
      html += '<td class="compare-total">' + rowTotal + "</td></tr>";
    });
    html += '<tr class="compare-total"><th scope="row">Total</th>';
    data.cols.totals.forEach(function (n) {
      html += "<td>" + n + "</td>";
    });
    html += "<td>" + data.counted + "</td></tr></tbody></table>";
    compareGridEl.innerHTML = html;
    const notes = [data.counted + " train" + (data.counted === 1 ? "" : "s") + " counted."];
    if (data.skipped) notes.push(data.skipped + " left out because they have no " + data.rows.label.toLowerCase() + " or " + data.cols.label.toLowerCase() + ".");
    if (data.rows.more) notes.push("Top " + data.rows.names.length + " " + data.rows.label.toLowerCase() + " shown; " + data.rows.more + " more.");
    if (data.cols.more) notes.push("Top " + data.cols.names.length + " " + data.cols.label.toLowerCase() + " shown; " + data.cols.more + " more.");
    if (data.rows.multi || data.cols.multi) notes.push("A train with more than one " + (data.rows.multi ? data.rows.label : data.cols.label).toLowerCase() + " counts once in each, so totals can be smaller than the sum.");
    notes.push("Faded numbers are under 3 trains, too few to read much into.");
    compareNoteEl.textContent = notes.join(" ");
  }

  async function loadCompare() {
    const run = ++compareRun;
    compareGridEl.innerHTML = '<p class="muted">Counting…</p>';
    const result = (await api(compareParams(), { quiet: true })).data;
    if (run !== compareRun) return;
    if (!compareDims && result && result.dimensions) {
      compareDims = result.dimensions;
      fillCompareSelects();
    }
    if (!result || !result.success) {
      compareData = null;
      compareGridEl.innerHTML = '<p class="muted">' + escapeText((result && result.error) || "Couldn't count these trains.") + "</p>";
      compareNoteEl.textContent = "";
      return;
    }
    compareData = result;
    renderCompare();
  }

  function compareTime(text) {
    const m = /^(\d{1,2}):(\d{2})/.exec(text || "");
    if (!m) return text || "";
    const h = Number(m[1]);
    return (h % 12 || 12) + ":" + m[2] + " " + (h < 12 ? "AM" : "PM");
  }

  async function showCompareTrains(ri, ci) {
    const data = compareData;
    if (!data) return;
    const rname = data.rows.names[ri];
    const cname = data.cols.names[ci];
    compareTrainsEl.hidden = false;
    compareTrainsEl.innerHTML = '<p class="muted">Loading…</p>';
    const result = (await api(compareParams(["row_value=" + encodeURIComponent(rname), "col_value=" + encodeURIComponent(cname)]), { quiet: true })).data;
    if (!result || !result.success) {
      compareTrainsEl.innerHTML = '<p class="muted">' + escapeText((result && result.error) || "Couldn't load those trains.") + "</p>";
      return;
    }
    let html = "<h3>" + escapeText(rname + " · " + cname) + ' <span class="muted">' + result.count + " train" + (result.count === 1 ? "" : "s") +
      (result.count > result.entries.length ? ", newest " + result.entries.length + " shown" : "") + "</span></h3>";
    html += '<div class="table-wrap"><table class="log-table compare-train-table"><thead><tr><th>Date</th><th>Time</th><th>RR</th><th>Lead</th><th>Dir</th><th>Type</th><th>Location</th></tr></thead><tbody>';
    result.entries.forEach(function (e) {
      html += "<tr><td>" + escapeText(e.date) + "</td><td>" + escapeText(compareTime(e.time)) + "</td><td>" + escapeText(e.railroad) +
        "</td><td>" + escapeText(e.lead_locomotive) + "</td><td>" + escapeText(e.direction) + "</td><td>" +
        escapeText((e.train_types || []).join("/")) + "</td><td>" + escapeText(e.location_spot) + "</td></tr>";
    });
    html += "</tbody></table></div>";
    compareTrainsEl.innerHTML = html;
    compareTrainsEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  const periodsBtn = document.getElementById("dash-log-periods");
  const periodsDialog = document.getElementById("dash-periods");
  const periodsAEl = document.getElementById("periods-a");
  const periodsBEl = document.getElementById("periods-b");
  const periodsBodyEl = document.getElementById("periods-body");
  const periodsPick = { a: "", b: "" };

  function periodOptions(choices, current) {
    let html = "";
    let group = "";
    choices.forEach(function (choice) {
      if (choice.group !== group) {
        if (group) html += "</optgroup>";
        group = choice.group;
        html += '<optgroup label="' + escapeText(group) + '">';
      }
      html +=
        '<option value="' + escapeText(choice.value) + '"' + (choice.value === current ? " selected" : "") + ">" +
        escapeText(choice.label) + "</option>";
    });
    return html + (group ? "</optgroup>" : "");
  }

  function periodDefaults(choices) {
    const values = choices.map(function (c) { return c.value; });
    if (values.indexOf(periodsPick.a) !== -1 && values.indexOf(periodsPick.b) !== -1) return;
    const trips = values.filter(function (v) { return v.indexOf("trip:") === 0; });
    const years = values.filter(function (v) { return v.indexOf("year:") === 0; });
    const months = values.filter(function (v) { return v.indexOf("month:") === 0; });
    const pool = trips.length > 1 ? trips : years.length > 1 ? years : months.length > 1 ? months : trips.concat(years);
    periodsPick.a = pool[0] || "all";
    periodsPick.b = pool[1] || "all";
  }

  function periodLabel(choices, value) {
    const hit = choices.filter(function (c) { return c.value === value; })[0];
    return hit ? hit.label : value;
  }

  function periodTops(side, key) {
    const rows = side[key] || [];
    return rows.length
      ? "<ol>" + rows.map(function (row) {
          return "<li>" + escapeText(row.name) + ' <span class="muted">' + row.trains + "</span></li>";
        }).join("") + "</ol>"
      : '<span class="muted">—</span>';
  }

  function renderPeriods(data) {
    const choices = data.choices || [];
    periodsAEl.innerHTML = periodOptions(choices, periodsPick.a);
    periodsBEl.innerHTML = periodOptions(choices, periodsPick.b);
    const sides = data.sides || [];
    if (sides.length < 2) {
      periodsBodyEl.innerHTML = '<p class="muted">Log some trains first.</p>';
      return;
    }
    const a = sides[0];
    const b = sides[1];
    let html =
      '<table class="periods-table"><thead><tr><th></th><th>' + escapeText(periodLabel(choices, a.pick)) +
      "</th><th>" + escapeText(periodLabel(choices, b.pick)) + "</th></tr></thead><tbody>";
    a.rows.forEach(function (row, i) {
      html += "<tr><th>" + escapeText(row.name) + "</th><td>" + escapeText(String(row.value)) + "</td><td>" +
        escapeText(String((b.rows[i] || {}).value)) + "</td></tr>";
    });
    [["railroads", "Top railroads"], ["types", "Top train types"], ["locations", "Top locations"]].forEach(function (item) {
      html += "<tr><th>" + item[1] + "</th><td>" + periodTops(a, item[0]) + "</td><td>" + periodTops(b, item[0]) + "</td></tr>";
    });
    periodsBodyEl.innerHTML = html + "</tbody></table>";
  }

  async function loadPeriods() {
    let result = await api("/api/catalog/periods?a=" + encodeURIComponent(periodsPick.a || "all") + "&b=" + encodeURIComponent(periodsPick.b || "all"), { quiet: true });
    const choices = (result.data && result.data.choices) || [];
    const before = periodsPick.a + "|" + periodsPick.b;
    periodDefaults(choices);
    if (!result.ok || before !== periodsPick.a + "|" + periodsPick.b) {
      result = await api("/api/catalog/periods?a=" + encodeURIComponent(periodsPick.a) + "&b=" + encodeURIComponent(periodsPick.b), { quiet: true });
    }
    if (!result.ok) {
      periodsBodyEl.innerHTML = '<p class="muted">' + escapeText((result.data && result.data.error) || "Could not load these.") + "</p>";
      return;
    }
    renderPeriods(result.data);
  }

  if (periodsBtn && periodsDialog) {
    periodsBtn.addEventListener("click", function () {
      periodsDialog.showModal();
      loadPeriods();
    });
    [periodsAEl, periodsBEl].forEach(function (el) {
      el.addEventListener("change", function () {
        periodsPick[el === periodsAEl ? "a" : "b"] = el.value;
        loadPeriods();
      });
    });
    document.getElementById("periods-swap").addEventListener("click", function () {
      const a = periodsPick.a;
      periodsPick.a = periodsPick.b;
      periodsPick.b = a;
      loadPeriods();
    });
  }

  if (compareBtn && compareDialog) {
    compareBtn.addEventListener("click", function () {
      compareDialog.showModal();
      loadCompare();
    });
    [compareRowsEl, compareColsEl, compareLimitEl].forEach(function (el) {
      el.addEventListener("change", function () {
        const key = el === compareRowsEl ? "rows" : el === compareColsEl ? "cols" : "limit";
        if (key === "rows" && el.value === comparePick.cols) comparePick.cols = comparePick.rows;
        if (key === "cols" && el.value === comparePick.rows) comparePick.rows = comparePick.cols;
        comparePick[key] = el.value;
        compareRowsEl.value = comparePick.rows;
        compareColsEl.value = comparePick.cols;
        saveComparePick();
        loadCompare();
      });
    });
    compareShowEl.addEventListener("change", function () {
      comparePick.show = compareShowEl.value;
      saveComparePick();
      renderCompare();
    });
    document.getElementById("compare-swap").addEventListener("click", function () {
      const rows = comparePick.rows;
      comparePick.rows = comparePick.cols;
      comparePick.cols = rows;
      compareRowsEl.value = comparePick.rows;
      compareColsEl.value = comparePick.cols;
      saveComparePick();
      loadCompare();
    });
    compareGridEl.addEventListener("click", function (event) {
      const cell = event.target.closest("button[data-ri]");
      if (!cell) return;
      showCompareTrains(Number(cell.getAttribute("data-ri")), Number(cell.getAttribute("data-ci")));
    });
  }

  if (logMoreStatsEl && logMoreStatsDialog) {
    logMoreStatsEl.addEventListener("click", function () {
      fillMoreStats();
      logMoreStatsDialog.showModal();
    });
  }
  if (logMoreStatsPick) {
    logMoreStatsPick.addEventListener("click", function (event) {
      if (event.target.closest("[data-more-all]")) {
        setMoreShown(null);
        return;
      }
      const group = event.target.closest("[data-more-group]");
      if (group) {
        const kinds = group.getAttribute("data-more-group").split(",");
        if (!moreShown) {
          setMoreShown(kinds);
        } else if (kinds.every(function (k) { return moreShown.indexOf(k) !== -1; })) {
          setMoreShown(moreShown.filter(function (k) { return kinds.indexOf(k) === -1; }));
        } else {
          setMoreShown(moreShown.concat(kinds.filter(function (k) { return moreShown.indexOf(k) === -1; })));
        }
        return;
      }
      const chip = event.target.closest("[data-more-chip]");
      if (!chip) return;
      const kind = chip.getAttribute("data-more-chip");
      if (!moreShown) setMoreShown([kind]);
      else if (moreShown.indexOf(kind) !== -1) setMoreShown(moreShown.filter(function (k) { return k !== kind; }));
      else setMoreShown(moreShown.concat([kind]));
    });
  }
  if (logMoreStatsBody) {
    logMoreStatsBody.addEventListener("click", function (event) {
      const copyBtn = event.target.closest("[data-trip-report-copy]");
      if (copyBtn) {
        event.preventDefault();
        const name = copyBtn.getAttribute("data-trip-report-copy") || "";
        const trips = ((catalog && catalog.log && catalog.log.trip_reports) || []);
        const trip = trips.filter(function (item) { return item.trip === name; })[0] || trips[0];
        const text = tripReportPlainText(trip);
        if (!text) return;
        function ok() {
          if (window.trainLog && window.trainLog.banner) window.trainLog.banner("Trip report copied.", "ok");
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(ok).catch(function () {
            window.prompt("Copy this trip report:", text);
          });
        } else {
          window.prompt("Copy this trip report:", text);
        }
        return;
      }
      const printBtn = event.target.closest("[data-trip-report-print]");
      if (printBtn) {
        event.preventDefault();
        const name = printBtn.getAttribute("data-trip-report-print") || "";
        const trips = ((catalog && catalog.log && catalog.log.trip_reports) || []);
        const trip = trips.filter(function (item) { return item.trip === name; })[0] || trips[0];
        const text = tripReportPlainText(trip);
        if (!text) return;
        const win = window.open("", "_blank");
        if (!win) {
          if (window.trainLog && window.trainLog.banner) window.trainLog.banner("Allow pop-ups to print the trip report.", "error");
          return;
        }
        const safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        win.document.write(
          "<!doctype html><html><head><meta charset='utf-8'><title>Trip Report</title>" +
          "<style>body{font:13px/1.45 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;margin:24px;white-space:pre-wrap}" +
          "button{margin:0 0 12px;padding:6px 12px}@media print{button{display:none}}</style></head><body>" +
          "<button onclick='window.print()'>Print / Save PDF</button><pre>" + safe + "</pre></body></html>"
        );
        win.document.close();
        return;
      }
      const solo = event.target.closest("[data-more-solo]");
      if (!solo) return;
      const kind = solo.getAttribute("data-more-solo");
      setMoreShown(moreShown && moreShown.length === 1 && moreShown[0] === kind ? null : [kind]);
    });
    logMoreStatsBody.addEventListener("change", function (event) {
      if (event.target.hasAttribute("data-along-sub")) {
        alongLineSub = event.target.value;
        refreshCustomTile("alongline");
        return;
      }
      if (event.target.hasAttribute("data-avg-group")) {
        averagesGroup = event.target.value === "type" ? "type" : "railroad";
        refreshCustomTile("averages");
        return;
      }
      const pickKind = event.target.getAttribute("data-more-pick");
      if (pickKind && Object.prototype.hasOwnProperty.call(morePicks, pickKind)) {
        morePicks[pickKind] = event.target.value;
        refreshCustomTile(pickKind);
        return;
      }
      const kind = event.target.getAttribute("data-list-chart");
      if (!kind || MORE_CHART_KEYS.indexOf(kind) === -1) return;
      const mode = event.target.value || "bars";
      moreCharts[kind] = mode;
      try {
        localStorage.setItem("rr-more-chart-" + kind, mode);
      } catch (e) {}
      const scrollers = [logMoreStatsDialog, logMoreStatsBody.closest("form")].filter(Boolean);
      const keep = scrollers.map(function (el) {
        return el.scrollTop;
      });
      fillMoreStats();
      scrollers.forEach(function (el, i) {
        el.scrollTop = keep[i];
      });
    });
  }
  if (logPaneEl) {
    logPaneEl.addEventListener("change", function (event) {
      if (!event.target.closest || !event.target.closest('.dash-board-card[data-card="types"]')) return;
      if (pickSource(event)) return;
      if (event.target.getAttribute("data-list-chart") !== "types") return;
      logTypeChart = event.target.value || "bars";
      try {
        localStorage.setItem("rr-log-type-chart", logTypeChart);
      } catch (e) {}
      renderLog();
    });
  }
  function pickSource(event) {
    const slot = event.target.getAttribute("data-source");
    if (!slot || boardSlots().indexOf(slot) === -1) return false;
    if (!sourceMeta(event.target.value)) return true;
    slotSource[slot] = event.target.value;
    try {
      localStorage.setItem("rr-log-source-" + slot, slotSource[slot]);
    } catch (e) {}
    renderLog();
    return true;
  }
  if (logPaneEl) {
    logPaneEl.addEventListener("change", function (event) {
      const tile = event.target.closest && event.target.closest(".dash-list-tile[data-card]");
      if (!tile) return;
      if (pickSource(event)) return;
      const splitKind = event.target.getAttribute("data-list-split");
      if (splitKind) {
        listSplits[splitKind] = event.target.value || "";
        try {
          localStorage.setItem("rr-log-split-" + splitKind, listSplits[splitKind]);
        } catch (e) {}
        renderLog();
        return;
      }
      const kind = event.target.getAttribute("data-list-chart");
      if (!kind || listSlots().indexOf(kind) === -1) return;
      const mode = event.target.value || "bars";
      listCharts[kind] = mode;
      try {
        localStorage.setItem("rr-log-list-chart-" + kind, mode);
      } catch (e) {}
      renderLog();
    });
  }
  function applyLogDates() {
    logDateFrom = logFromEl && logFromEl.value ? logFromEl.value : "";
    logDateTo = logToEl && logToEl.value ? logToEl.value : "";
    loadCatalog();
  }
  if (logFromEl) logFromEl.addEventListener("change", applyLogDates);
  if (logToEl) logToEl.addEventListener("change", applyLogDates);
  if (logDatesResetEl) {
    logDatesResetEl.addEventListener("click", function () {
      logDateFrom = "";
      logDateTo = "";
      if (logFromEl) logFromEl.value = "";
      if (logToEl) logToEl.value = "";
      loadCatalog();
    });
  }
  function applyLogTrip() {
    logTrip = logTripEl && logTripEl.value ? logTripEl.value : "";
    try {
      if (logTrip) localStorage.setItem("rr-log-trip", logTrip);
      else localStorage.removeItem("rr-log-trip");
    } catch (e) {}
    loadCatalog();
  }
  if (logTripEl) logTripEl.addEventListener("change", applyLogTrip);
  if (logTripSortEl) {
    logTripSortEl.addEventListener("change", function () {
      logTripSort = logTripSortEl.value === "date" ? "date" : "name";
      try {
        localStorage.setItem("rr-log-trip-sort", logTripSort);
      } catch (e) {}
      fillTripFilter();
    });
  }

  applyLayout();

  const drillDialog = document.getElementById("drill-dialog");
  const drillBody = document.getElementById("drill-body");
  const DRILL_FIELD = {
    leads: "lead_locomotive",
    consists: "power_consist",
    locations: "location_spot",
    subdivisions: "location_subdivision",
    states: "location_state",
    railroads: "railroad",
    roadcards: "railroad",
  };
  let drillNow = null;
  let drillPlaces = [];

  function drillTime(value) {
    return compareTime(value || "");
  }

  function drillRows(entries, pick) {
    const fixable = pick && pick.rowFix ? pick.fixable || [] : [];
    return entries
      .map(function (e) {
        const fix = fixable.indexOf(e.id) !== -1
          ? '<button type="button" class="btn ghost drill-edit" data-drill-fix="' + e.id + '" title="' + escapeText(pick.fix) + '">Fix</button> '
          : "";
        return (
          '<tr data-id="' + e.id + '"><td>' + escapeText(e.date || "") + "</td><td>" + escapeText(drillTime(e.time)) +
          "</td><td>" + escapeText(e.railroad || "") + "</td><td>" + escapeText(e.lead_locomotive || "") +
          "</td><td>" + escapeText(e.power_consist || "") + "</td><td>" + escapeText(e.car_counts || "") +
          "</td><td>" + escapeText(e.direction || "") + "</td><td>" + escapeText((e.train_types || []).join("/")) +
          "</td><td>" + escapeText(e.location_spot || "") +
          '</td><td class="drill-acts">' + fix + '<button type="button" class="btn ghost drill-edit" data-drill-edit="' + e.id + '">Edit</button></td></tr>'
        );
      })
      .join("");
  }

  async function fillDrill() {
    const pick = drillNow;
    if (!pick) return;
    const opts = pick.body
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pick.body), quiet: true }
      : { quiet: true };
    const result = (await api(pick.url, opts)).data;
    if (pick !== drillNow) return;
    if (!result || !result.success) {
      document.getElementById("drill-sub").textContent = (result && result.error) || "Couldn't load those trains.";
      drillBody.innerHTML = "";
      return;
    }
    pick.ids = result.ids || [];
    const n = result.count || 0;
    const shown = (result.entries || []).length;
    document.getElementById("drill-sub").textContent =
      (n ? n + " train" + (n === 1 ? "" : "s") + (n > shown ? ", newest " + shown + " shown" : "") : "No trains match this anymore.") +
      (pick.note ? " " + pick.note : "");
    pick.fix = result.fix || "";
    pick.fixable = result.fixable || [];
    pick.rowFix = Boolean(pick.check && pick.fix && result.row_fix !== false);
    drillBody.innerHTML = drillRows(result.entries || [], pick);
    renderDrillFix(pick, result);
    document.getElementById("drill-log").disabled = !n;
    const replaceBtn = document.getElementById("drill-replace");
    replaceBtn.hidden = !pick.field || !n || Boolean(window.trainLogField);
  }

  function openDrill(pick) {
    drillNow = pick;
    document.getElementById("drill-title").textContent = pick.title;
    document.getElementById("drill-sub").textContent = "Loading…";
    drillBody.innerHTML = "";
    document.getElementById("drill-replace").hidden = true;
    document.getElementById("drill-fix").hidden = true;
    if (!drillDialog.open) drillDialog.showModal();
    fillDrill();
  }

  function renderDrillFix(pick, result) {
    const box = document.getElementById("drill-fix");
    const values = result.values || [];
    const fixable = (result.fixable || []).length;
    if (!pick.check || window.trainLogField || !result.count || (!pick.fix && !values.length)) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    let html = "";
    if (pick.fix) {
      html +=
        '<div class="drill-fix-all"><span>' +
        (fixable
          ? escapeText(pick.fix) + " on " + fixable + " train" + (fixable === 1 ? "" : "s") + "." +
            (fixable < (result.count || 0) ? " " + escapeText(result.fix_left || "") : "")
          : "None of these can be fixed automatically. Edit them one at a time.") +
        "</span>" +
        (fixable ? '<button type="button" class="btn primary" data-fix-all="' + escapeText(pick.check) + '">Fix All</button>' : "") +
        "</div>";
    }
    if (values.length) {
      const field = result.value_field;
      html +=
        '<ul class="drill-fix-values">' +
        values
          .map(function (v) {
            return (
              "<li><span><b>" + escapeText(v.value) + "</b> on " + v.trains + " train" + (v.trains === 1 ? "" : "s") + "</span>" +
              '<button type="button" class="btn ghost" data-fix-replace="' + escapeText(field) + '" data-fix-val="' + escapeText(v.value) + '">Replace…</button>' +
              (field === "train_types"
                ? '<button type="button" class="btn ghost" data-fix-addtype="' + escapeText(v.value) + '">Add to List</button>'
                : "") +
              "</li>"
            );
          })
          .join("") +
        "</ul>";
    }
    drillPlaces = result.places || [];
    if (drillPlaces.length) {
      const codes = result.state_codes || [];
      html +=
        '<div class="drill-fix-places"><div class="drill-fix-all"><span>Set a state for each place. The menu starts on the best guess when there is one; check it before you press Set, or Set All for every place with a state picked.</span>' +
        '<button type="button" class="btn primary" data-place-all>Set All</button></div>' +
        '<table><thead><tr><th>Location</th><th>Subdivision</th><th>Trains</th><th>Now</th><th>State</th><th></th></tr></thead><tbody>' +
        drillPlaces
          .map(function (p, i) {
            return (
              "<tr><td>" + (escapeText(p.spot) || "—") + "</td><td>" + (escapeText(p.subdivision) || "—") + "</td><td>" + p.count +
              "</td><td>" + (escapeText(p.now) || "—") + "</td><td>" +
              '<select data-place-state="' + i + '" aria-label="State for ' + escapeText(p.spot) + '"' +
              (p.why ? ' title="' + escapeText(p.why) + '"' : "") + '><option value="">—</option>' +
              codes
                .map(function (c) {
                  return '<option value="' + c + '"' + (c === p.guess ? " selected" : "") + ">" + c + "</option>";
                })
                .join("") +
              "</select>" + (p.why ? '<small class="muted">' + escapeText(p.why) + "</small>" : "") +
              '</td><td><button type="button" class="btn ghost" data-place-set="' + i + '"' + (p.guess ? "" : " disabled") + ">Set</button></td></tr>"
            );
          })
          .join("") +
        "</tbody></table></div>";
    }
    box.innerHTML = html;
    box.hidden = false;
  }

  async function runFix(check, ids, title, state) {
    const one = Array.isArray(ids);
    const deleting = check === "same_entry";
    if (state && typeof state === "object") {
      const n = Object.keys(state).length;
      const sure = await window.askConfirm({
        title: "Set All?",
        message: "Set the state you picked on " + n + " train" + (n === 1 ? "" : "s") + ". Places left on — stay as they are. Notes are never touched, and Activity keeps every train's old state.",
        ok: "Set All",
        danger: false,
      });
      if (!sure) return;
    } else if ((!one || deleting) && !state) {
      const n = one ? ids.length : null;
      const sure = await window.askConfirm({
        title: deleting ? "Delete the extra copies?" : "Fix All?",
        message:
          (title ? title + ". " : "") +
          (deleting
            ? (one ? "This copy is deleted; the first one saved stays." : "Every extra copy is deleted; the first one saved stays.") +
              " Activity keeps what was deleted."
            : "Every train this check can fix is changed. Notes are never touched, and Activity keeps every train's old values."),
        ok: deleting ? "Delete" + (n === 1 ? " Copy" : "") : "Fix All",
        danger: deleting,
      });
      if (!sure) return;
    }
    const body = { check: check };
    if (one) body.ids = ids;
    if (state && typeof state === "object") body.states = state;
    else if (state) body.state = state;
    const result = await api("/api/fix/checks/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!result.ok) {
      banner((result.data && result.data.error) || "Couldn't fix those trains.", "error");
      return;
    }
    banner(result.data.message, "ok");
    afterFix();
    if (window.trainLog && window.trainLog.refreshLists) window.trainLog.refreshLists();
  }

  function drillFromRow(el) {
    const value = el.getAttribute("data-drill");
    let source = "";
    let typeRr = "";
    const fixed = el.closest("[data-drill-source]");
    const slot = el.closest("[data-slot]");
    const more = el.closest("[data-more-kind]");
    if (fixed) source = fixed.getAttribute("data-drill-source");
    else if (slot) {
      const id = slot.getAttribute("data-slot");
      source = slotSource[id] || id;
      if (source === "types") typeRr = logTypeRr;
    } else if (more) source = drillKind(more.getAttribute("data-more-kind"));
    if (!DRILLABLE.has(source)) return;
    const card = el.closest("section");
    const head = card && card.querySelector("h3");
    const cardTitle = head ? head.textContent.trim() : "";
    const base = catalogQuery();
    const parts = ["source=" + encodeURIComponent(source), "value=" + encodeURIComponent(value)];
    if (typeRr) parts.push("type_rr=" + encodeURIComponent(typeRr));
    const range = [logDateFrom && logDateTo ? logDateFrom + " to " + logDateTo : logDateFrom ? "from " + logDateFrom : logDateTo ? "to " + logDateTo : "", logTrip ? "trip " + logTrip : ""]
      .filter(Boolean)
      .join(", ");
    openDrill({
      title: (cardTitle ? cardTitle + ": " : "") + value,
      label: (cardTitle ? cardTitle + " " : "") + value,
      url: "/api/fix/drill" + (base ? base + "&" : "?") + parts.join("&"),
      note: range ? "Only trains in the Dashboard range (" + range + ")." : "",
      field: DRILL_FIELD[source] && value !== "Unknown" ? DRILL_FIELD[source] : "",
      value: value,
    });
  }

  [document.getElementById("dash-pane-log"), logMoreStatsDialog].forEach(function (area) {
    if (!area) return;
    area.addEventListener("click", function (event) {
      const row = event.target.closest("[data-drill]");
      if (row && !event.target.closest("select, input, a")) drillFromRow(row);
    });
    area.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      const row = event.target.closest("[data-drill]");
      if (!row || row !== event.target) return;
      event.preventDefault();
      drillFromRow(row);
    });
  });

  if (drillDialog) {
    drillBody.addEventListener("click", function (event) {
      const fix = event.target.closest("[data-drill-fix]");
      if (fix && drillNow && drillNow.check) {
        runFix(drillNow.check, [Number(fix.getAttribute("data-drill-fix"))], drillNow.fix);
        return;
      }
      const btn = event.target.closest("[data-drill-edit]");
      if (btn && window.trainLog && window.trainLog.editEntry) window.trainLog.editEntry(btn.getAttribute("data-drill-edit"));
    });
    document.getElementById("drill-fix").addEventListener("change", function (event) {
      const pickState = event.target.closest("[data-place-state]");
      if (!pickState) return;
      const set = this.querySelector('[data-place-set="' + pickState.getAttribute("data-place-state") + '"]');
      if (set) set.disabled = !pickState.value;
    });
    document.getElementById("drill-fix").addEventListener("click", async function (event) {
      const all = event.target.closest("[data-fix-all]");
      if (all && drillNow) {
        runFix(all.getAttribute("data-fix-all"), null, drillNow.fix);
        return;
      }
      if (event.target.closest("[data-place-all]") && drillNow) {
        const states = {};
        const box = this;
        drillPlaces.forEach(function (place, i) {
          const pickState = box.querySelector('[data-place-state="' + i + '"]');
          if (!pickState || !pickState.value) return;
          place.ids.forEach(function (id) {
            states[id] = pickState.value;
          });
        });
        if (!Object.keys(states).length) {
          banner("Pick a state for at least one place first.", "error");
          return;
        }
        runFix(drillNow.check, null, drillNow.fix, states);
        return;
      }
      const set = event.target.closest("[data-place-set]");
      if (set && drillNow) {
        const i = set.getAttribute("data-place-set");
        const place = drillPlaces[Number(i)];
        const pickState = this.querySelector('[data-place-state="' + i + '"]');
        if (place && pickState && pickState.value) runFix(drillNow.check, place.ids, drillNow.fix, pickState.value);
        return;
      }
      const swap = event.target.closest("[data-fix-replace]");
      if (swap) {
        drillDialog.close();
        startReplace(swap.getAttribute("data-fix-replace"), swap.getAttribute("data-fix-val"));
        return;
      }
      const add = event.target.closest("[data-fix-addtype]");
      if (!add) return;
      const name = add.getAttribute("data-fix-addtype");
      const sure = await window.askConfirm({
        title: "Add " + name + " to Train Types?",
        message: name + " becomes a chip on New Entry and shows in the Train Types list in Settings.",
        ok: "Add to List",
        danger: false,
      });
      if (!sure) return;
      const result = await api("/api/catalog/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name }),
      });
      if (!result.ok) {
        banner((result.data && result.data.error) || "Could not add that type.", "error");
        return;
      }
      banner(name + " is on the Train Types list.", "ok");
      notifyLists();
      afterFix();
    });
    document.getElementById("drill-log").addEventListener("click", function () {
      if (!drillNow || !drillNow.ids || !drillNow.ids.length || !window.trainLog) return;
      const pick = drillNow;
      drillDialog.close();
      if (logMoreStatsDialog && logMoreStatsDialog.open) logMoreStatsDialog.close();
      window.trainLog.showLogIds(pick.ids, pick.label);
    });
    document.getElementById("drill-replace").addEventListener("click", function () {
      if (!drillNow || !drillNow.field) return;
      const pick = drillNow;
      drillDialog.close();
      startReplace(pick.field, pick.value);
    });
    drillDialog.addEventListener("close", function () {
      if (!drillDialog.open) drillNow = null;
    });
  }

  function afterFix() {
    if (drillNow) fillDrill();
    const pane = document.getElementById("dash-pane-review");
    if (pane && pane.classList.contains("is-active")) loadDataCheck();
    loadCatalog({ quiet: true });
  }
  document.addEventListener("trainlog:entry-saved", afterFix);
  document.addEventListener("trainlog:entries-changed", afterFix);

  const checkList = document.getElementById("fix-check-list");
  const fixFieldEl = document.getElementById("fix-field");
  const fixSearchEl = document.getElementById("fix-search");
  const fixValuesEl = document.getElementById("fix-values");
  const fixToEl = document.getElementById("fix-to");
  const fixPickEl = document.getElementById("fix-pick");
  const fixShowBtn = document.getElementById("fix-show");
  const fixApplyBtn = document.getElementById("fix-apply");
  const fixState = { field: "lead_locomotive", values: [], from: null, fields: [] };

  async function loadDataCheck() {
    if (!checkList) return;
    const result = (await api("/api/fix/checks", { quiet: true })).data;
    if (!result || !result.success) {
      checkList.innerHTML = '<li class="muted">' + escapeText((result && result.error) || "Couldn't run the checks.") + "</li>";
      return;
    }
    const checks = result.checks || [];
    const found = checks.filter(function (c) {
      return c.count;
    });
    document.getElementById("fix-check-sum").textContent = result.trains
      ? found.length
        ? found.length + " of " + checks.length + " checks found something in " + result.trains + " trains."
        : "All " + checks.length + " checks are clear across " + result.trains + " trains."
      : "No trains logged yet.";
    const clear = checks.filter(function (c) {
      return !c.count;
    });
    checkList.innerHTML =
      found
        .map(function (c) {
          return (
            '<li class="fix-check-row"><button type="button" class="fix-check" data-check="' + escapeText(c.id) + '"><b>' + c.count +
            "</b><span><strong>" + escapeText(c.title) + "</strong><small>" + escapeText(c.hint) + "</small></span></button>" +
            (c.fixable
              ? '<button type="button" class="btn ghost fix-all" data-fix-all="' + escapeText(c.id) + '" data-fix-label="' +
                escapeText(c.fix) + '" title="' + escapeText(c.fix) + '">Fix ' + c.fixable + "</button>"
              : "") +
            "</li>"
          );
        })
        .join("") +
      (clear.length && result.trains
        ? '<li class="fix-clear"><b>All clear</b> ' +
          clear
            .map(function (c) {
              return "<span>" + escapeText(c.title) + "</span>";
            })
            .join("") +
          "</li>"
        : "");
    loadFixTrips();
    if (!fixState.fields.length) await loadFixValues();
  }

  const fixTripEl = document.getElementById("fix-trip");
  const fixTripToEl = document.getElementById("fix-trip-to");
  const fixTripNote = document.getElementById("fix-trip-note");
  const fixTripShow = document.getElementById("fix-trip-show");
  const fixTripRename = document.getElementById("fix-trip-rename");
  let fixTrips = [];

  function fixTripPicked() {
    const name = fixTripEl ? fixTripEl.value : "";
    return fixTrips.filter(function (t) {
      return t.name === name;
    })[0] || null;
  }

  function syncFixTrip() {
    const trip = fixTripPicked();
    const to = (fixTripToEl.value || "").replace(/\s+/g, " ").trim();
    const other = to && trip
      ? fixTrips.filter(function (t) {
          return t.name !== trip.name && t.name.toLowerCase() === to.toLowerCase();
        })[0]
      : null;
    fixTripNote.textContent = !trip
      ? fixTrips.length ? "Pick a trip above." : "No trips yet."
      : !to || to === trip.name
      ? trip.name + " has " + trip.trains + " train" + (trip.trains === 1 ? "" : "s") + ". Type the new name."
      : other
      ? other.name + " is already a trip, so " + trip.name + " joins it. Both trips' details are kept."
      : "Rename " + trip.name + " to " + to + " on " + trip.trains + " train" + (trip.trains === 1 ? "" : "s") + ".";
    fixTripShow.disabled = !trip || !trip.trains;
    fixTripRename.disabled = !trip || !to || to === trip.name;
  }

  async function loadFixTrips() {
    if (!fixTripEl) return;
    const result = (await api("/api/trips", { quiet: true })).data;
    fixTrips = ((result && result.trips) || []).map(function (t) {
      return { name: t.name, trains: t.trains || 0 };
    });
    const keep = fixTripEl.value;
    fixTripEl.innerHTML =
      '<option value="">' + (fixTrips.length ? "Select" : "No trips yet") + "</option>" +
      fixTrips
        .map(function (t) {
          return '<option value="' + escapeText(t.name) + '">' + escapeText(t.name) + " (" + t.trains + ")</option>";
        })
        .join("");
    if (keep && fixTrips.some(function (t) { return t.name === keep; })) fixTripEl.value = keep;
    syncFixTrip();
  }

  if (fixTripEl) {
    fixTripEl.addEventListener("change", function () {
      const trip = fixTripPicked();
      fixTripToEl.value = trip ? trip.name : "";
      syncFixTrip();
      if (trip) fixTripToEl.focus();
    });
    fixTripToEl.addEventListener("input", syncFixTrip);
    fixTripShow.addEventListener("click", function () {
      const trip = fixTripPicked();
      if (!trip) return;
      openDrill({
        title: "Trip: " + trip.name,
        label: "Trip " + trip.name,
        url: "/api/fix/drill?source=trips&value=" + encodeURIComponent(trip.name),
        field: "",
      });
    });
    fixTripRename.addEventListener("click", async function () {
      const trip = fixTripPicked();
      const to = (fixTripToEl.value || "").replace(/\s+/g, " ").trim();
      if (!trip || !to) return;
      const sure = await window.askConfirm({
        title: "Rename " + trip.name + "?",
        message: fixTripNote.textContent + " Activity keeps every train's old trip.",
        ok: "Rename",
        danger: false,
      });
      if (!sure) return;
      const result = await api("/api/trips/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: trip.name, to: to }),
      });
      if (!result.ok) {
        banner((result.data && result.data.error) || "Couldn't rename that trip.", "error");
        return;
      }
      banner(result.data.message, "ok");
      fixTripEl.value = result.data.name;
      afterFix();
      notifyLists();
      if (window.trainLog && window.trainLog.refreshLists) window.trainLog.refreshLists();
    });
  }

  if (checkList) {
    checkList.addEventListener("click", function (event) {
      const all = event.target.closest("[data-fix-all]");
      if (all) {
        runFix(all.getAttribute("data-fix-all"), null, all.getAttribute("data-fix-label"));
        return;
      }
      const btn = event.target.closest("[data-check]");
      if (!btn || btn.disabled) return;
      const title = btn.querySelector("strong").textContent;
      const check = btn.getAttribute("data-check");
      openDrill({
        title: title,
        label: "Data Check: " + title,
        url: "/api/fix/checks?check=" + encodeURIComponent(check),
        note: btn.querySelector("small").textContent,
        field: "",
        check: check,
      });
    });
    document.getElementById("btn-check-again").addEventListener("click", function () {
      loadDataCheck();
      loadFixValues();
    });
  }

  async function loadFixValues() {
    if (!fixFieldEl) return;
    const result = (await api("/api/fix/values?field=" + encodeURIComponent(fixState.field), { quiet: true })).data;
    if (!result || !result.success) return;
    fixState.fields = result.fields || [];
    fixState.values = result.values || [];
    fixFieldEl.innerHTML = fixState.fields
      .map(function (f) {
        return '<option value="' + escapeText(f.key) + '"' + (f.key === fixState.field ? " selected" : "") + ">" + escapeText(f.label) + "</option>";
      })
      .join("");
    if (fixState.from !== null && !fixState.values.some(function (v) { return v.value === fixState.from; })) fixState.from = null;
    renderFixValues();
  }

  function fixValueLabel(value) {
    return value === "" ? "(blank)" : value;
  }

  function renderFixValues() {
    const q = (fixSearchEl.value || "").trim().toLowerCase();
    const matches = fixState.values.filter(function (v) {
      return !q || fixValueLabel(v.value).toLowerCase().indexOf(q) !== -1;
    });
    const shown = matches.slice(0, 200);
    fixValuesEl.innerHTML =
      shown
        .map(function (v) {
          const on = v.value === fixState.from;
          return (
            '<button type="button" role="option" aria-selected="' + on + '" class="fix-value' + (on ? " is-on" : "") +
            (v.value === "" ? " is-blank" : "") + '" data-fix-value="' + escapeText(v.value) + '"><span>' +
            escapeText(fixValueLabel(v.value)) + "</span><b>" + v.trains + "</b></button>"
          );
        })
        .join("") +
      (matches.length > shown.length
        ? '<p class="muted">' + (matches.length - shown.length) + " more. Type to narrow the list.</p>"
        : matches.length
        ? ""
        : '<p class="muted">No values match.</p>');
    syncFixPick();
  }

  function fixFieldLabel() {
    const f = fixState.fields.filter(function (item) {
      return item.key === fixState.field;
    })[0];
    return f ? f.label : "";
  }

  function syncFixPick() {
    const picked = fixState.from !== null;
    const row = picked
      ? fixState.values.filter(function (v) {
          return v.value === fixState.from;
        })[0]
      : null;
    const n = row ? row.trains : 0;
    const to = (fixToEl.value || "").trim();
    fixPickEl.textContent = picked
      ? fixFieldLabel() + " " + fixValueLabel(fixState.from) + " is on " + n + " train" + (n === 1 ? "" : "s") + ". " +
        (to === fixState.from
          ? "Type the new value in Replace with, or empty it to clear the value."
          : to
          ? "Replace with " + to + "."
          : "Replace with is empty, so this clears the value.")
      : "Pick a value above.";
    fixShowBtn.disabled = !picked || !n;
    fixApplyBtn.disabled = !picked || !n || to === fixState.from;
  }

  function startReplace(field, value) {
    fixState.field = field;
    fixState.from = value;
    if (fixSearchEl) fixSearchEl.value = value;
    if (fixToEl) fixToEl.value = value;
    location.hash = "review";
    showPane("review");
    loadFixValues().then(function () {
      if (fixToEl) {
        fixToEl.focus();
        fixToEl.select();
      }
    });
  }

  if (fixFieldEl) {
    fixFieldEl.addEventListener("change", function () {
      fixState.field = fixFieldEl.value;
      fixState.from = null;
      fixSearchEl.value = "";
      fixToEl.value = "";
      loadFixValues();
    });
    fixSearchEl.addEventListener("input", renderFixValues);
    fixToEl.addEventListener("input", syncFixPick);
    fixValuesEl.addEventListener("click", function (event) {
      const btn = event.target.closest("[data-fix-value]");
      if (!btn) return;
      fixState.from = btn.getAttribute("data-fix-value");
      if (!fixToEl.value) fixToEl.value = fixState.from;
      renderFixValues();
    });
    fixShowBtn.addEventListener("click", function () {
      if (fixState.from === null) return;
      openDrill({
        title: fixFieldLabel() + ": " + fixValueLabel(fixState.from),
        label: fixFieldLabel() + " " + fixValueLabel(fixState.from),
        url: "/api/fix/replace",
        body: { field: fixState.field, from: fixState.from, preview: true },
        field: "",
      });
    });
    fixApplyBtn.addEventListener("click", async function () {
      if (fixState.from === null) return;
      const to = (fixToEl.value || "").trim();
      const row = fixState.values.filter(function (v) {
        return v.value === fixState.from;
      })[0];
      const n = row ? row.trains : 0;
      const sure = await window.askConfirm({
        title: "Replace " + fixFieldLabel() + "?",
        message:
          "Change " + fixFieldLabel() + " " + fixValueLabel(fixState.from) + " to " + (to ? to : "(blank)") + " on " + n +
          " train" + (n === 1 ? "" : "s") + ". Activity keeps every train's old value.",
        ok: "Replace",
      });
      if (!sure) return;
      const result = await api("/api/fix/replace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: fixState.field, from: fixState.from, to: to }),
      });
      if (!result.ok) {
        banner((result.data && result.data.error) || "Couldn't replace that value.", "error");
        return;
      }
      banner(result.data.message, "ok");
      fixState.from = null;
      fixSearchEl.value = "";
      fixToEl.value = "";
      await loadFixValues();
      loadDataCheck();
      loadCatalog({ quiet: true });
      if (window.trainLog && window.trainLog.refreshLists) window.trainLog.refreshLists();
    });
  }

  window.trainLogDashboard = {
    load: loadCatalog,
    showPane: showPane,
    loadActivity: loadActivity,
  };
  window.trainLogStations = window.trainLogDashboard;
  window.trainLogControlPanel = window.trainLogDashboard;
  window.trainLogGazetteer = window.trainLogDashboard;

  const startView = (location.hash || "").replace("#", "");
  if (
    startView === "dashboard" ||
    startView === "settings" ||
    startView === "stations" ||
    startView === "station-book" ||
    startView === "control" ||
    startView === "gazetteer" ||
    startView === "control-panel" ||
    startView === "import" ||
    startView === "review" ||
    startView === "datacheck" ||
    startView === "activity"
  ) {
    loadCatalog();
    var bootPane = "log";
    if (startView === "activity") bootPane = "activity";
    else if (startView === "import" || startView === "datacheck" || startView === "review") bootPane = "review";
    else if (startView === "dashboard" || !startView) bootPane = "log";
    else bootPane = "stations";
    showPane(bootPane);
  }
})();
