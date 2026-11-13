/* Trackside test: read a short head-end clip on this device and list the units.
   Nothing on this page is saved to the log. */
(function () {
  var MARKS = {
    BNSF: 1, UP: 1, NS: 1, CN: 1, CPKC: 1, CSX: 1, CSXT: 1, KCS: 1, CP: 1, CPR: 1,
    MRL: 1, GWR: 1, ARZC: 1, MNCW: 1, AMTK: 1, ACEX: 1, JPBX: 1, SCAX: 1, SDNX: 1,
    DSNG: 1, GCRX: 1, SRC: 1, CTSR: 1, NVRR: 1, NN: 1, BN: 1, SF: 1, SP: 1, ATSF: 1,
    CNW: 1, DRGW: 1, WP: 1, SOO: 1, IC: 1, MILW: 1, CR: 1, FEC: 1, BRC: 1, IHB: 1,
    METX: 1, NIRC: 1
  };
  var JUNK = {
    THE: 1, AND: 1, FOR: 1, MPH: 1, EST: 1, GPS: 1, ISO: 1, HDR: 1, MOV: 1, REC: 1,
    LTE: 1, WIFI: 1, VOL: 1, MIN: 1, SEC: 1, FPS: 1, HD: 1, AM: 1, PM: 1, RR: 1,
    NO: 1, OK: 1, TO: 1, OF: 1, IN: 1, ON: 1, AT: 1, OR: 1, MP: 1, DOT: 1, FRA: 1,
    STB: 1, AAR: 1, CAB: 1, END: 1, DPU: 1, DP: 1, ETA: 1, ETD: 1, HP: 1, KW: 1,
    RPM: 1, PSI: 1, MAX: 1, DATE: 1, TIME: 1, EAST: 1, WEST: 1, NORTH: 1, SOUTH: 1,
    STOP: 1, SLOW: 1, YARD: 1, MAIN: 1, TRACK: 1, SPEED: 1, LIMIT: 1, MILE: 1,
    POST: 1, FEET: 1, FOOT: 1, CLEAR: 1, HIGH: 1, WIDE: 1, TRAIN: 1, ENG: 1, ENGINE: 1
  };

  function cleanToken(text) {
    return String(text || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function digitsOf(token, fixLetters) {
    var raw = fixLetters ? token.replace(/O/g, "0").replace(/[IL]/g, "1") : token;
    if (!/^\d{2,5}$/.test(raw) || /^0+$/.test(raw)) return "";
    return raw;
  }

  function lineGroups(words) {
    var tokens = [];
    (words || []).forEach(function (word) {
      var text = cleanToken(word.text);
      if (text.length < 2 || !(word.confidence >= 30)) return;
      var box = word.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 };
      tokens.push({
        text: text,
        confidence: word.confidence,
        x: box.x0,
        y: (box.y0 + box.y1) / 2,
        h: Math.max(8, box.y1 - box.y0),
        bbox: box
      });
    });
    tokens.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    var lines = [];
    tokens.forEach(function (token) {
      var line = lines[lines.length - 1];
      if (!line || Math.abs(token.y - line.y) > Math.max(token.h, line.h) * 0.7) {
        lines.push({ y: token.y, h: token.h, tokens: [token] });
      } else {
        line.tokens.push(token);
        line.y = (line.y + token.y) / 2;
      }
    });
    lines.forEach(function (line) {
      line.tokens.sort(function (a, b) { return a.x - b.x; });
    });
    return lines;
  }

  function unionBox(a, b) {
    return {
      x0: Math.min(a.x0, b.x0),
      y0: Math.min(a.y0, b.y0),
      x1: Math.max(a.x1, b.x1),
      y1: Math.max(a.y1, b.y1)
    };
  }

  function acceptPair(mark, number) {
    if (!mark || !MARKS[mark]) return false;
    return number.length >= 2 && number.length <= 5;
  }

  function pushHit(hits, mark, number, tokens, frame) {
    var confidence = tokens[0].confidence;
    tokens.forEach(function (token) { confidence = Math.min(confidence, token.confidence); });
    var box = tokens[0].bbox;
    for (var i = 1; i < tokens.length; i++) box = unionBox(box, tokens[i].bbox);
    hits.push({
      mark: mark,
      number: number,
      known: !mark || !!MARKS[mark],
      confidence: confidence,
      frame: frame,
      x: box.x0,
      bbox: box
    });
  }

  function hitsFromWords(words, frame) {
    var hits = [];
    lineGroups(words).forEach(function (line) {
      var tokens = line.tokens;
      for (var i = 0; i < tokens.length; i++) {
        var token = tokens[i];
        var glued = /^([A-Z]{2,5})([0-9OIL]{2,5})$/.exec(token.text);
        if (glued) {
          var gluedNumber = digitsOf(glued[2], true);
          if (acceptPair(glued[1], gluedNumber)) pushHit(hits, glued[1], gluedNumber, [token], frame);
          else if (gluedNumber && gluedNumber.length >= 3) pushHit(hits, "", gluedNumber, [token], frame);
          continue;
        }
        var next = tokens[i + 1];
        if (next && /^[A-Z]{2,5}$/.test(token.text)) {
          var number = digitsOf(next.text, true);
          if (acceptPair(token.text, number)) {
            pushHit(hits, token.text, number, [token, next], frame);
            i += 1;
            continue;
          }
        }
        var bare = digitsOf(token.text, false);
        var prev = tokens[i - 1];
        if (bare.length >= 3 && !(prev && JUNK[prev.text])) pushHit(hits, "", bare, [token], frame);
      }
    });
    return hits;
  }

  function clusterHits(hits) {
    var rows = [];
    var byKey = {};
    hits.forEach(function (hit) {
      var key = (hit.mark || "") + " " + hit.number;
      var row = byKey[key];
      if (!row) {
        row = {
          key: key.trim(),
          mark: hit.mark,
          number: hit.number,
          known: hit.known,
          confidence: 0,
          frames: 0,
          first: hit.frame,
          x: hit.x,
          seen: {},
          thumb: "",
          place: "head"
        };
        byKey[key] = row;
        rows.push(row);
      }
      if (!row.seen[hit.frame]) {
        row.seen[hit.frame] = 1;
        row.frames += 1;
      }
      if (hit.frame < row.first || (hit.frame === row.first && hit.x < row.x)) {
        row.first = hit.frame;
        row.x = hit.x;
      }
      if (hit.confidence >= row.confidence && hit.thumb) {
        row.confidence = hit.confidence;
        row.thumb = hit.thumb;
      } else if (hit.confidence > row.confidence) {
        row.confidence = hit.confidence;
      }
    });
    rows.sort(function (a, b) { return a.first - b.first || a.x - b.x; });
    return rows;
  }

  function unitLine(unit, leadMark) {
    var text = String(unit.text || "").trim().toUpperCase();
    if (text) return text;
    var unitMark = String(unit.mark || "").trim().toUpperCase();
    var unitNumber = String(unit.number || "").trim();
    if (!unitNumber) return "";
    if (!unitMark || (leadMark && unitMark === leadMark)) return unitNumber;
    return (unitMark + " " + unitNumber).trim();
  }

  function consistText(head, mid, rear) {
    head = head || 0;
    mid = mid || 0;
    rear = rear || 0;
    if (mid && rear) return head + "x" + mid + "x" + rear;
    if (rear) return head + "x" + rear;
    if (mid) return head + "x" + mid;
    return head + "x";
  }

  function fieldsFromUnits(units, dp) {
    dp = dp || {};
    var headRows = units.filter(function (unit) {
      return unit.place !== "mid" && unit.place !== "rear" && !!(unit.number || String(unit.text || "").trim());
    });
    var lead = headRows[0] || {};
    var mark = String(lead.mark || "").trim().toUpperCase();
    var number = String(lead.number || "").trim();
    function lines(list, extra) {
      var out = list.map(function (unit) { return unitLine(unit, mark); }).filter(Boolean);
      (extra || []).forEach(function (text) {
        var line = unitLine({ text: text }, mark);
        if (line) out.push(line);
      });
      return out;
    }
    var midLines = lines(units.filter(function (unit) { return unit.place === "mid"; }), dp.midText);
    var rearLines = lines(units.filter(function (unit) { return unit.place === "rear"; }), dp.rearText);
    var midCount = Math.max(dp.mid || 0, midLines.length);
    var rearCount = Math.max(dp.rear || 0, rearLines.length);
    return {
      mark: mark,
      number: number,
      head: lines(headRows.slice(1)),
      mid: midLines,
      rear: rearLines,
      midCount: midCount,
      rearCount: rearCount,
      consist: consistText(headRows.length, midCount, rearCount)
    };
  }

  function frameTimes(duration) {
    var span = Math.min(duration || 0, 45);
    if (!span || !isFinite(span)) return [0];
    var count = Math.min(14, Math.max(4, Math.round(span * 2)));
    var times = [];
    for (var i = 0; i < count; i++) times.push(Math.max(0, Math.min(span - 0.05, ((i + 0.5) / count) * span)));
    return times;
  }

  var api = {
    MARKS: MARKS,
    hitsFromWords: hitsFromWords,
    clusterHits: clusterHits,
    frameTimes: frameTimes,
    fieldsFromUnits: fieldsFromUnits
  };
  if (typeof globalThis !== "undefined") globalThis.ReadUnits = api;

  function boot() {
    var status = document.getElementById("read-status");
    var copyBtn = document.getElementById("read-copy");
    var quickBtn = document.getElementById("read-quick");
    var consistLabel = document.getElementById("read-consist-label");
    var video = document.getElementById("read-video");
    var lists = {
      head: document.getElementById("read-list-head"),
      mid: document.getElementById("read-list-mid"),
      rear: document.getElementById("read-list-rear")
    };
    var placeName = { head: "head end", mid: "mid-train", rear: "rear DP" };
    var workerPromise = null;
    var cardSeq = 0;
    var sightSeq = 0;
    var cards = [];
    var card = null;
    var rows = [];
    var clipUrls = null;
    var clipFiles = null;
    var clipFrac = null;
    var viewState = null;
    var stripToken = { head: 0, mid: 0, rear: 0 };
    var ocrChain = Promise.resolve();
    var inflight = {};

    function makeCard() {
      return {
        id: ++cardSeq,
        seen: ++sightSeq,
        sent: false,
        place: "head",
        rows: [],
        urls: { head: "", mid: "", rear: "" },
        files: { head: null, mid: null, rear: null },
        frac: {
          head: { x: 0.12, y: 0.18, w: 0.76, h: 0.5 },
          mid: { x: 0.12, y: 0.18, w: 0.76, h: 0.5 },
          rear: { x: 0.12, y: 0.18, w: 0.76, h: 0.5 }
        },
        view: {
          head: { z: 1, x: 0, y: 0 },
          mid: { z: 1, x: 0, y: 0 },
          rear: { z: 1, x: 0, y: 0 }
        },
        road: ""
      };
    }

    function useCard(next) {
      card = next;
      rows = card.rows;
      clipUrls = card.urls;
      clipFiles = card.files;
      clipFrac = card.frac;
      viewState = card.view;
      syncRoadSelect();
    }

    var ROAD_GROUPS = [
      ["Freight", ["BNSF", "UP", "NS", "CN", "CPKC", "CSX"]],
      ["Passenger / Commuter", ["AMTK", "ACEX", "JPBX", "SCAX", "SDNX"]],
      ["Tourist", ["DSNG", "GCRX", "SRC", "CTSR", "NVRR", "NN"]]
    ];

    function fillRoadSelect(groups) {
      var select = document.getElementById("read-road");
      if (!select) return;
      var road = card && card.road || "";
      select.innerHTML = "";
      var blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "Select";
      select.appendChild(blank);
      (groups || []).forEach(function (group) {
        var names = group[1] || group.railroads || [];
        if (!names.length) return;
        var block = document.createElement("optgroup");
        block.label = group[0] || group.label || "";
        names.forEach(function (name) {
          var option = document.createElement("option");
          option.value = name;
          option.textContent = name;
          block.appendChild(option);
        });
        select.appendChild(block);
      });
      syncRoadSelect();
      if (road && select.value !== road) {
        var extra = document.createElement("option");
        extra.value = road;
        extra.textContent = road;
        select.appendChild(extra);
        select.value = road;
      }
    }

    function syncRoadSelect() {
      var select = document.getElementById("read-road");
      if (!select || !card) return;
      var road = card.road || "";
      var found = false;
      for (var i = 0; i < select.options.length; i++) {
        if (select.options[i].value === road) found = true;
      }
      select.value = found ? road : "";
    }

    function followsRoad(row, previous) {
      var mark = row.mark || "";
      if (row.markEdited && mark && mark !== previous) return false;
      if (!mark || mark === previous) return true;
      return !MARKS[mark];
    }

    function applyRoad(nextRoad) {
      var previous = card.road || "";
      card.road = nextRoad || "";
      rows.forEach(function (row) {
        if (!followsRoad(row, previous)) return;
        row.markEdited = false;
        row.mark = card.road;
        row.known = !card.road || !!MARKS[card.road];
      });
      paint();
      saveOpenCards();
    }

    function stampHits(hits, road) {
      if (!road) return hits;
      hits.forEach(function (hit) {
        if (hit.mark && MARKS[hit.mark]) return;
        hit.mark = road;
        hit.known = !!MARKS[road];
      });
      return hits;
    }

    function hasClip(item) {
      return !!(item.files.head || item.files.mid || item.files.rear);
    }

    function schedule(work) {
      var run = ocrChain.then(work, work);
      ocrChain = run.then(function () {}, function () {});
      return run;
    }

    useCard(makeCard());
    cards.push(card);

    function plainRow(row) {
      return {
        mark: row.mark || "",
        markEdited: !!row.markEdited,
        number: row.number || "",
        place: row.place || "head",
        known: !!row.known,
        confidence: row.confidence || 0,
        frames: row.frames || 0
      };
    }

    function saveOpenCards() {
      var open = cards.filter(function (item) { return !item.sent; });
      var keep = open.some(function (item) {
        return item.road || (item.rows || []).some(function (row) { return row.mark || row.number; });
      }) || open.length > 1;
      try {
        if (!keep) {
          sessionStorage.removeItem("rr-read-units-open");
          return;
        }
        sessionStorage.setItem("rr-read-units-open", JSON.stringify({
          cardSeq: cardSeq,
          sightSeq: sightSeq,
          active: card && !card.sent ? card.seen : open[0].seen,
          cards: open.map(function (item) {
            return {
              seen: item.seen,
              place: item.place,
              road: item.road || "",
              frac: item.frac,
              rows: (item.rows || []).map(plainRow)
            };
          })
        }));
      } catch (err) { /* private browsing */ }
    }

    function restoreOpenCards() {
      var raw = "";
      try { raw = sessionStorage.getItem("rr-read-units-open") || ""; } catch (err) { return false; }
      if (!raw) return false;
      var data = null;
      try { data = JSON.parse(raw); } catch (err) { return false; }
      if (!data || !Array.isArray(data.cards) || !data.cards.length) return false;
      cards = [];
      data.cards.forEach(function (item) {
        var next = makeCard();
        next.seen = Number(item.seen) || next.seen;
        next.place = item.place || "head";
        next.road = item.road || "";
        if (item.frac) next.frac = item.frac;
        next.rows = (item.rows || []).map(function (row) {
          return {
            mark: row.mark || "",
            markEdited: !!row.markEdited,
            number: row.number || "",
            place: row.place || "head",
            known: !!row.known,
            confidence: row.confidence || 0,
            frames: row.frames || 0,
            thumb: ""
          };
        });
        cards.push(next);
      });
      cardSeq = Math.max(cardSeq, Number(data.cardSeq) || 0);
      sightSeq = Math.max(sightSeq, Number(data.sightSeq) || 0);
      var active = cards[0];
      cards.forEach(function (item) {
        if (item.seen === data.active) active = item;
      });
      useCard(active);
      return true;
    }

    function entryHref() {
      var field = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
      var path = field ? "/index.html" : "/";
      var search = "";
      try {
        var ref = new URL(document.referrer);
        if (ref.origin === location.origin && ref.search.indexOf("readunits=1") !== -1) search = "?readunits=1";
      } catch (err) { /* opened directly */ }
      if (!search && location.search.indexOf("readunits=1") !== -1) search = "?readunits=1";
      return path + search + "#entry";
    }

    function cameFromLog() {
      try {
        var ref = new URL(document.referrer);
        return ref.origin === location.origin && (ref.pathname === "/" || /\/index\.html$/.test(ref.pathname));
      } catch (err) {
        return false;
      }
    }

    function returnToLog() {
      saveOpenCards();
      try { sessionStorage.setItem("rr-open-entry", "1"); } catch (err) { /* private browsing */ }
      if (cameFromLog() && history.length > 1) {
        history.back();
        return;
      }
      location.assign(entryHref());
    }

    function say(text) { status.textContent = text; }

    function reader() {
      if (!workerPromise) {
        say("Loading the reader. The first time takes a minute on Wi-Fi.");
        workerPromise = Tesseract.createWorker("eng", 1, {
          workerPath: new URL("ocr/worker.min.js", location.href).href,
          corePath: new URL("ocr/tesseract-core-simd-lstm.wasm.js", location.href).href,
          langPath: new URL("ocr", location.href).href,
          workerBlobURL: false
        }).catch(function (err) {
          workerPromise = null;
          throw err;
        });
      }
      return workerPromise;
    }

    function placeOf(row) {
      return row.place === "mid" || row.place === "rear" ? row.place : "head";
    }

    function whereText(place, ordinal) {
      if (place === "head") return ordinal === 1 ? "Lead locomotive" : "Head end, unit " + ordinal;
      if (place === "mid") return "Mid-train, unit " + ordinal;
      return "Rear DP, unit " + ordinal;
    }

    function listedRows() {
      return rows.filter(function (row) { return row.approved && row.number; });
    }

    function lineup() {
      var spots = { head: 0, mid: 0, rear: 0 };
      var lines = [];
      listedRows().forEach(function (row) {
        var place = placeOf(row);
        spots[place] += 1;
        lines.push({
          where: whereText(place, spots[place]),
          text: (row.mark ? row.mark + " " : "") + row.number
        });
      });
      return lines;
    }

    function showConsist() {
      var lines = lineup();
      var box = document.getElementById("read-lineup");
      var list = document.getElementById("read-lineup-list");
      list.innerHTML = "";
      lines.forEach(function (line) {
        var item = document.createElement("li");
        var where = document.createElement("span");
        where.className = "read-where";
        where.textContent = line.where;
        var unit = document.createElement("b");
        unit.textContent = line.text;
        item.appendChild(where);
        item.appendChild(unit);
        list.appendChild(item);
      });
      var fields = fieldsFromUnits(listedRows(), {});
      consistLabel.textContent = lines.length ? fields.consist : "";
      box.hidden = !lines.length;
    }

    function cleanMark(value) {
      return String(value || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
    }

    function cleanNumber(value) {
      return String(value || "").replace(/\D/g, "").slice(0, 5);
    }

    function whereFor(row) {
      if (!row.number) return "";
      var spots = { head: 0, mid: 0, rear: 0 };
      var found = "";
      listedRows().forEach(function (item) {
        var place = placeOf(item);
        spots[place] += 1;
        if (item === row) found = whereText(place, spots[place]);
      });
      return found;
    }

    function paint(focusRow) {
      ["head", "mid", "rear"].forEach(function (place) {
        lists[place].innerHTML = "";
      });
      rows.forEach(function (row, index) {
        var place = placeOf(row);
        var item = document.createElement("li");
        item.className = "read-row";
        if (row.thumb) {
          var img = document.createElement("img");
          img.src = row.thumb;
          img.alt = "";
          item.appendChild(img);
        }
        var body = document.createElement("div");
        var edit = document.createElement("div");
        edit.className = "read-edit";
        var markField = document.createElement("label");
        markField.className = "read-field read-mark";
        var markTag = document.createElement("span");
        markTag.textContent = "Mark";
        var markBox = document.createElement("input");
        markBox.type = "text";
        markBox.autocapitalize = "characters";
        markBox.autocomplete = "off";
        markBox.spellcheck = false;
        markBox.setAttribute("aria-label", "Reporting mark");
        markBox.value = row.mark || "";
        markField.appendChild(markTag);
        markField.appendChild(markBox);
        var numberField = document.createElement("label");
        numberField.className = "read-field read-number";
        var numberTag = document.createElement("span");
        numberTag.textContent = "Number";
        var numberBox = document.createElement("input");
        numberBox.type = "text";
        numberBox.inputMode = "numeric";
        numberBox.autocomplete = "off";
        numberBox.spellcheck = false;
        numberBox.setAttribute("aria-label", "Number");
        numberBox.value = row.number || "";
        numberField.appendChild(numberTag);
        numberField.appendChild(numberBox);
        var add = document.createElement("button");
        add.type = "button";
        add.className = "btn read-act read-act-add";
        edit.appendChild(markField);
        edit.appendChild(numberField);
        edit.appendChild(add);
        body.appendChild(edit);
        var note = document.createElement("p");
        note.className = "read-note";
        function refreshNote() {
          var onList = !!(row.approved && row.number);
          add.textContent = onList ? "Approved" : "Add to list";
          add.className = onList ? "btn read-act read-act-add is-on" : "btn read-act read-act-add";
          var bits = [];
          var where = whereFor(row);
          if (!row.number) bits.push("Type the number, then tap Add to list.");
          else if (!where) bits.push("Tap Add to list. It stays off the train until then.");
          else bits.push("Approved as " + where + ".");
          if (row.mark && !MARKS[row.mark]) bits.push("Not a mark this log usually uses.");
          if (row.frames) bits.push(row.frames === 1 ? "Seen in one frame." : "Seen in " + row.frames + " frames.");
          note.textContent = bits.join(" ");
        }
        refreshNote();
        body.appendChild(note);
        markBox.addEventListener("input", function () {
          var next = cleanMark(markBox.value);
          if (markBox.value !== next) markBox.value = next;
          row.mark = next;
          row.markEdited = !!(next && next !== (card.road || ""));
          row.known = !next || !!MARKS[next];
          refreshNote();
          showConsist();
        });
        markBox.addEventListener("change", function () {
          if (row.mark || !card.road) return;
          row.markEdited = false;
          row.mark = card.road;
          row.known = !!MARKS[card.road];
          markBox.value = card.road;
          refreshNote();
          showConsist();
          saveOpenCards();
        });
        numberBox.addEventListener("input", function () {
          var next = cleanNumber(numberBox.value);
          if (numberBox.value !== next) numberBox.value = next;
          row.number = next;
          if (!next) row.approved = false;
          refreshNote();
          showConsist();
        });
        numberBox.addEventListener("keydown", function (event) {
          if (event.key !== "Enter") return;
          event.preventDefault();
          add.click();
        });
        add.addEventListener("click", function () {
          if (!row.number) {
            say("Type the number, then tap Add to list.");
            numberBox.focus();
            return;
          }
          row.approved = !row.approved;
          refreshNote();
          showConsist();
        });
        var actions = document.createElement("div");
        actions.className = "read-actions";
        var earlier = -1;
        for (var i = index - 1; i >= 0; i -= 1) {
          var other = rows[i].place === "mid" || rows[i].place === "rear" ? rows[i].place : "head";
          if (other === place) { earlier = i; break; }
        }
        if (earlier >= 0) {
          var up = document.createElement("button");
          up.type = "button";
          up.className = "btn read-act read-act-up";
          up.textContent = "Move up";
          up.addEventListener("click", function () {
            var swap = rows[earlier];
            rows[earlier] = row;
            rows[index] = swap;
            paint();
          });
          actions.appendChild(up);
        }
        var drop = document.createElement("button");
        drop.type = "button";
        drop.className = "btn read-act read-act-drop";
        drop.textContent = "Remove";
        drop.addEventListener("click", function () {
          rows.splice(index, 1);
          paint();
        });
        actions.appendChild(drop);
        body.appendChild(actions);
        item.appendChild(body);
        lists[place].appendChild(item);
        if (focusRow === row) markBox.focus();
      });
      showConsist();
    }

    function crop(canvas, box) {
      var pad = 12;
      var x = Math.max(0, Math.floor(box.x0) - pad);
      var y = Math.max(0, Math.floor(box.y0) - pad);
      var w = Math.min(canvas.width - x, Math.ceil(box.x1 - box.x0) + pad * 2);
      var h = Math.min(canvas.height - y, Math.ceil(box.y1 - box.y0) + pad * 2);
      if (w < 8 || h < 8) return canvas.toDataURL("image/jpeg", 0.7);
      var out = document.createElement("canvas");
      out.width = w;
      out.height = h;
      out.getContext("2d").drawImage(canvas, x, y, w, h, 0, 0, w, h);
      return out.toDataURL("image/jpeg", 0.7);
    }

    function padFrac(frac) {
      if (!frac) return null;
      var padX = Math.max(0.03, frac.w * 0.2);
      var padY = Math.max(0.03, frac.h * 0.24);
      var x = Math.max(0, frac.x - padX);
      var y = Math.max(0, frac.y - padY);
      var right = Math.min(1, frac.x + frac.w + padX);
      var bottom = Math.min(1, frac.y + frac.h + padY);
      return { x: x, y: y, w: Math.max(0.04, right - x), h: Math.max(0.04, bottom - y) };
    }

    function prepare(source, frac, mode) {
      var fullW = source.width || source.videoWidth || 1280;
      var fullH = source.height || source.videoHeight || 720;
      var box = frac ? padFrac(frac) : { x: 0, y: 0, w: 1, h: 1 };
      var sx = Math.max(0, Math.round(box.x * fullW));
      var sy = Math.max(0, Math.round(box.y * fullH));
      var sw = Math.max(1, Math.round(box.w * fullW));
      var sh = Math.max(1, Math.round(box.h * fullH));
      if (sx + sw > fullW) sw = fullW - sx;
      if (sy + sh > fullH) sh = fullH - sy;
      var width = frac ? Math.min(1600, Math.max(sw, Math.round(sw * Math.min(4, 1200 / sw)))) : Math.min(1280, sw);
      var height = Math.max(1, Math.round(sh * (width / sw)));
      var canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      var ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);
      var img = ctx.getImageData(0, 0, width, height);
      var d = img.data;
      var gain = mode === "hard" ? 2.6 : 1.6;
      for (var i = 0; i < d.length; i += 4) {
        var y = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] - 128) * gain + 128;
        y = y < 0 ? 0 : y > 255 ? 255 : y;
        d[i] = d[i + 1] = d[i + 2] = y;
      }
      ctx.putImageData(img, 0, 0);
      return canvas;
    }

    function hitInside(hit, frac, canvas) {
      if (!frac || !hit.bbox || !canvas.width || !canvas.height) return true;
      var box = padFrac(frac);
      var x0 = hit.bbox.x0 / canvas.width;
      var y0 = hit.bbox.y0 / canvas.height;
      var x1 = hit.bbox.x1 / canvas.width;
      var y1 = hit.bbox.y1 / canvas.height;
      return x1 >= box.x && x0 <= box.x + box.w && y1 >= box.y && y0 <= box.y + box.h;
    }

    async function readSource(worker, source, frac, frame) {
      var full = prepare(source, null, "soft");
      var hits = await readCanvas(worker, full, frame);
      if (!frac) return hits;
      hits = hits.filter(function (hit) { return hitInside(hit, frac, full); });
      if (hits.length) return hits;
      return readCanvas(worker, prepare(source, frac, "hard"), frame);
    }

    function seekTo(time) {
      return new Promise(function (resolve) {
        if (Math.abs(video.currentTime - time) < 0.03 && video.readyState >= 2) {
          resolve();
          return;
        }
        var done = function () {
          video.removeEventListener("seeked", done);
          resolve();
        };
        video.addEventListener("seeked", done);
        video.currentTime = time;
      });
    }

    function isImage(file) {
      return (file.type && file.type.indexOf("image/") === 0) || /\.(png|jpe?g|heic|webp|gif)$/i.test(file.name || "");
    }

    async function readCanvas(worker, canvas, frame) {
      var result = await worker.recognize(canvas);
      var hits = hitsFromWords((result.data && result.data.words) || [], frame);
      hits.forEach(function (hit) { hit.thumb = crop(canvas, hit.bbox); });
      return hits;
    }

    function takeReads(list, place, hits) {
      clusterHits(hits).forEach(function (row) {
        row.place = place;
        var same = list.filter(function (item) {
          return item.place === place && item.mark === row.mark && item.number === row.number;
        })[0];
        if (!same) {
          list.push(row);
          return;
        }
        same.frames += row.frames;
        if (row.confidence >= same.confidence && row.thumb) {
          same.confidence = row.confidence;
          same.thumb = row.thumb;
        }
      });
    }

    async function run(file, place, frac, owner) {
      var target = owner || card;
      var list = target.rows;
      var worker = await reader();
      var hits = [];
      var clipped = false;
      if (frac) {
        list = target.rows = list.filter(function (row) {
          return placeOf(row) !== place || row.approved || !row.frames || row.snap;
        });
        if (target === card) rows = target.rows;
      }
      if (isImage(file)) {
        say("Reading the " + placeName[place] + " photo.");
        var image = await new Promise(function (resolve, reject) {
          var img = new Image();
          img.onload = function () { resolve(img); };
          img.onerror = function () { reject(new Error("This photo could not be opened.")); };
          img.src = URL.createObjectURL(file);
        });
        hits = await readSource(worker, image, frac, 0);
      } else {
        var url = URL.createObjectURL(file);
        video.src = url;
        video.muted = true;
        await new Promise(function (resolve, reject) {
          video.onloadedmetadata = function () { resolve(); };
          video.onerror = function () { reject(new Error("This video could not be opened.")); };
        });
        var times = frameTimes(video.duration);
        clipped = video.duration > 45;
        for (var i = 0; i < times.length; i++) {
          say("Reading the " + placeName[place] + ", frame " + (i + 1) + " of " + times.length + ".");
          await seekTo(times[i]);
          hits = hits.concat(await readSource(worker, video, frac, i));
        }
        URL.revokeObjectURL(url);
      }
      if (target.sent || cards.indexOf(target) < 0) return;
      var before = list.length;
      stampHits(hits, target.road || "");
      takeReads(list, place, hits);
      if (target === card) {
        rows = target.rows;
        paint();
      } else paintCards();
      var added = list.length - before;
      var any = list.some(function (row) { return placeOf(row) === place && row.number; });
      if (!added && !any) say("No new unit numbers stood out in the " + placeName[place] + ".");
      else if (clipped) say("Only the first 45 seconds were read. Fix the mark and number, then tap Add to list.");
      else say("Fix the mark and number, then tap Add to list.");
    }

    async function runFiles(files, place, owner) {
      owner = owner || card;
      for (var i = 0; i < files.length; i++) await run(files[i], place, null, owner);
    }

    var camera = document.getElementById("read-camera");
    var live = document.getElementById("read-live");
    var capture = document.getElementById("read-capture");
    var stream = null;
    var recorder = null;
    var recordPlace = "";
    var recordTimer = 0;
    var startBtn = document.getElementById("read-start");
    var stopBtn = document.getElementById("read-stop");
    var clock = document.getElementById("read-timer");
    var clockTick = 0;
    var recordStarted = 0;

    function formatClock(ms) {
      var total = Math.min(45, Math.floor(ms / 1000));
      var m = Math.floor(total / 60);
      var s = total % 60;
      return m + ":" + (s < 10 ? "0" : "") + s;
    }

    function paintClock() {
      var elapsed = recordStarted ? Date.now() - recordStarted : 0;
      clock.textContent = formatClock(elapsed) + " / 0:45";
    }

    function startClock() {
      recordStarted = Date.now();
      window.clearInterval(clockTick);
      paintClock();
      clock.classList.add("is-on");
      clockTick = window.setInterval(paintClock, 200);
    }

    function stopClock() {
      window.clearInterval(clockTick);
      clockTick = 0;
      recordStarted = 0;
      clock.classList.remove("is-on");
      paintClock();
    }

    function setRecordButtons(recording) {
      startBtn.disabled = !!recording;
      stopBtn.disabled = !recording;
    }

    function stopStream() {
      if (stream) stream.getTracks().forEach(function (track) { track.stop(); });
      stream = null;
      live.srcObject = null;
    }

    function finishRecording() {
      window.clearTimeout(recordTimer);
      stopClock();
      if (recorder && recorder.state === "recording") recorder.stop();
    }

    function cancelRecording() {
      window.clearTimeout(recordTimer);
      if (recorder && recorder.state === "recording") {
        recorder.onstop = function () {
          recorder = null;
          stopStream();
        };
        recorder.stop();
      } else {
        recorder = null;
        stopStream();
      }
      camera.hidden = true;
      stopClock();
      setRecordButtons(false);
      say("Recording cancelled.");
    }

    function beginRecording() {
      if (!stream || (recorder && recorder.state === "recording")) return;
      var chunks = [];
      var mime = "";
      if (MediaRecorder.isTypeSupported("video/mp4")) mime = "video/mp4";
      else if (MediaRecorder.isTypeSupported("video/webm")) mime = "video/webm";
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorder.ondataavailable = function (event) {
        if (event.data && event.data.size) chunks.push(event.data);
      };
      recorder.onstop = function () {
        var type = recorder.mimeType || mime || "video/mp4";
        var ext = type.indexOf("webm") === -1 ? "mp4" : "webm";
        var file = new File([new Blob(chunks, { type: type })], "units." + ext, { type: type });
        var savedPlace = recordPlace;
        recorder = null;
        stopStream();
        camera.hidden = true;
        stopClock();
        setRecordButtons(false);
        showClip(file, savedPlace);
      };
      recorder.start();
      recordTimer = window.setTimeout(finishRecording, 45000);
      startClock();
      setRecordButtons(true);
      say("Recording the " + placeName[recordPlace] + ". Tap Stop when the numbers are past. It stops after 45 seconds.");
    }

    function openCapture(place) {
      recordPlace = place;
      capture.value = "";
      capture.click();
    }

    function showCamera(place) {
      recordPlace = place;
      camera.hidden = false;
      setRecordButtons(false);
      camera.scrollIntoView({ block: "nearest" });
      say("Camera is on for the " + placeName[place] + ". Tap Start, then Stop. It stops after 45 seconds.");
    }

    function startCamera(place) {
      if (recorder && recorder.state === "recording") return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
        openCapture(place);
        return;
      }
      if (stream) {
        showCamera(place);
        return;
      }
      navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }
      }).then(function (next) {
        stream = next;
        live.srcObject = stream;
        showCamera(place);
      }).catch(function () {
        say("The camera didn't open. Allow the camera for this page, or choose a video instead.");
      });
    }

    var reading = false;

    function videoFrac(place) {
      var box = clipFrac[place];
      var st = viewState[place];
      var x = st.x + box.x / st.z;
      var y = st.y + box.y / st.z;
      var right = Math.min(1, x + box.w / st.z);
      var bottom = Math.min(1, y + box.h / st.z);
      x = Math.max(0, x);
      y = Math.max(0, y);
      return { x: x, y: y, w: Math.max(0.02, right - x), h: Math.max(0.02, bottom - y) };
    }

    function paintCrop(place) {
      var panel = document.querySelector('.read-clip[data-clip="' + place + '"]');
      var stage = panel.querySelector(".read-clip-stage");
      var box = stage.querySelector("[data-crop]");
      var frac = clipFrac[place];
      box.style.left = (frac.x * 100) + "%";
      box.style.top = (frac.y * 100) + "%";
      box.style.width = (frac.w * 100) + "%";
      box.style.height = (frac.h * 100) + "%";
      stage.querySelector(".read-dim-top").style.height = (frac.y * 100) + "%";
      stage.querySelector(".read-dim-bottom").style.height = ((1 - frac.y - frac.h) * 100) + "%";
      var left = stage.querySelector(".read-dim-left");
      var right = stage.querySelector(".read-dim-right");
      left.style.top = (frac.y * 100) + "%";
      left.style.height = (frac.h * 100) + "%";
      left.style.width = (frac.x * 100) + "%";
      right.style.top = (frac.y * 100) + "%";
      right.style.height = (frac.h * 100) + "%";
      right.style.width = ((1 - frac.x - frac.w) * 100) + "%";
    }

    function bindCrop(place) {
      var panel = document.querySelector('.read-clip[data-clip="' + place + '"]');
      var stage = panel.querySelector(".read-clip-stage");
      var box = stage.querySelector("[data-crop]");
      var drag = null;
      box.addEventListener("pointerdown", function (event) {
        event.stopPropagation();
        var handle = event.target.getAttribute("data-handle") || "move";
        var frac = clipFrac[place];
        drag = {
          handle: handle,
          px: event.clientX,
          py: event.clientY,
          frac: { x: frac.x, y: frac.y, w: frac.w, h: frac.h }
        };
        box.setPointerCapture(event.pointerId);
        event.preventDefault();
      });
      box.addEventListener("pointermove", function (event) {
        if (!drag) return;
        var rect = stage.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        var dx = (event.clientX - drag.px) / rect.width;
        var dy = (event.clientY - drag.py) / rect.height;
        var frac = drag.frac;
        var min = 0.08;
        var next = { x: frac.x, y: frac.y, w: frac.w, h: frac.h };
        if (drag.handle === "move") {
          next.x = Math.min(1 - next.w, Math.max(0, frac.x + dx));
          next.y = Math.min(1 - next.h, Math.max(0, frac.y + dy));
        } else {
          var leftEdge = frac.x;
          var topEdge = frac.y;
          var rightEdge = frac.x + frac.w;
          var bottomEdge = frac.y + frac.h;
          if (drag.handle.indexOf("w") !== -1) leftEdge = Math.min(rightEdge - min, Math.max(0, frac.x + dx));
          if (drag.handle.indexOf("e") !== -1) rightEdge = Math.max(leftEdge + min, Math.min(1, frac.x + frac.w + dx));
          if (drag.handle.indexOf("n") !== -1) topEdge = Math.min(bottomEdge - min, Math.max(0, frac.y + dy));
          if (drag.handle.indexOf("s") !== -1) bottomEdge = Math.max(topEdge + min, Math.min(1, frac.y + frac.h + dy));
          next = { x: leftEdge, y: topEdge, w: rightEdge - leftEdge, h: bottomEdge - topEdge };
        }
        clipFrac[place] = next;
        paintCrop(place);
      });
      function endDrag() { drag = null; }
      box.addEventListener("pointerup", endDrag);
      box.addEventListener("pointercancel", endDrag);
    }

    function showClip(file, place) {
      var panel = document.querySelector('.read-clip[data-clip="' + place + '"]');
      var clip = panel.querySelector("video");
      var playBtn = panel.querySelector("[data-play]");
      if (clipUrls[place]) URL.revokeObjectURL(clipUrls[place]);
      clipUrls[place] = URL.createObjectURL(file);
      clipFiles[place] = file;
      clip.dataset.blob = clipUrls[place];
      clip.src = clipUrls[place];
      clip.muted = true;
      clip.loop = true;
      panel.hidden = false;
      viewState[place] = { z: 1, x: 0, y: 0 };
      paintView(place);
      paintCrop(place);
      clip.play().then(function () {
        setPlayButton(playBtn, true);
      }).catch(function () {
        setPlayButton(playBtn, false);
      });
      panel.scrollIntoView({ block: "nearest" });
      paintCards();
      fillStrip(place);
      paintLanes();
      say("Clip held on this train. Drag the box onto the numbers, then Snapshot. N starts the next train.");
    }

    function paintView(place) {
      var st = viewState[place];
      if (st.z <= 1.01) { st.z = 1; st.x = 0; st.y = 0; }
      var limitX = Math.max(0, 1 - 1 / st.z);
      var limitY = Math.max(0, 1 - 1 / st.z);
      st.x = Math.min(limitX, Math.max(0, st.x));
      st.y = Math.min(limitY, Math.max(0, st.y));
      var view = document.querySelector('.read-clip[data-clip="' + place + '"] .read-view');
      view.style.transform = "translate(" + (-st.x * st.z * 100) + "%, " + (-st.y * st.z * 100) + "%) scale(" + st.z + ")";
    }

    function zoomAt(place, nextZoom, anchorX, anchorY, base) {
      nextZoom = Math.min(5, Math.max(1, nextZoom));
      var vx = base.x + anchorX / base.z;
      var vy = base.y + anchorY / base.z;
      viewState[place].z = nextZoom;
      viewState[place].x = vx - anchorX / nextZoom;
      viewState[place].y = vy - anchorY / nextZoom;
      paintView(place);
    }

    function fitStage(clip) {
      if (!clip.videoWidth || !clip.videoHeight) return;
      clip.closest(".read-clip-stage").style.aspectRatio = clip.videoWidth + " / " + clip.videoHeight;
    }

    function nearTimes(center, duration) {
      var span = Math.min(0.5, Math.max(0.2, (duration || 1) * 0.015));
      var times = [];
      [-span, 0, span].forEach(function (delta) {
        var at = Math.max(0, Math.min(Math.max(0, (duration || 0) - 0.05), center + delta));
        if (!times.some(function (have) { return Math.abs(have - at) < 0.08; })) times.push(at);
      });
      return times;
    }

    function bindView(place) {
      var stage = document.querySelector('.read-clip[data-clip="' + place + '"] .read-clip-stage');
      var pointers = {};
      var pan = null;
      var pinch = null;
      stage.addEventListener("pointerdown", function (event) {
        if (event.target.closest(".read-crop, .read-rec")) return;
        pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
        try { stage.setPointerCapture(event.pointerId); } catch (err) { /* already gone */ }
        var keys = Object.keys(pointers);
        var st = viewState[place];
        if (keys.length === 1) {
          pan = { x: event.clientX, y: event.clientY, vx: st.x, vy: st.y };
          pinch = null;
        } else {
          var a = pointers[keys[0]];
          var b = pointers[keys[1]];
          pan = null;
          pinch = {
            dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
            z: st.z,
            x: st.x,
            y: st.y
          };
        }
      });
      stage.addEventListener("pointermove", function (event) {
        if (!pointers[event.pointerId]) return;
        pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
        var rect = stage.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        var keys = Object.keys(pointers);
        if (keys.length >= 2 && pinch) {
          var a = pointers[keys[0]];
          var b = pointers[keys[1]];
          var dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
          var fx = (((a.x + b.x) / 2) - rect.left) / rect.width;
          var fy = (((a.y + b.y) / 2) - rect.top) / rect.height;
          zoomAt(place, pinch.z * (dist / pinch.dist), fx, fy, pinch);
          return;
        }
        if (!pan || viewState[place].z <= 1) return;
        viewState[place].x = pan.vx - (event.clientX - pan.x) / rect.width / viewState[place].z;
        viewState[place].y = pan.vy - (event.clientY - pan.y) / rect.height / viewState[place].z;
        paintView(place);
      });
      function endPointer(event) {
        delete pointers[event.pointerId];
        pan = null;
        pinch = null;
      }
      stage.addEventListener("pointerup", endPointer);
      stage.addEventListener("pointercancel", endPointer);
    }

    function clipSeconds(value) {
      var total = Math.max(0, Math.floor(value || 0));
      var m = Math.floor(total / 60);
      var s = total % 60;
      return m + ":" + (s < 10 ? "0" : "") + s;
    }

    function paintTime(clip) {
      var panel = clip.closest(".read-clip");
      var range = panel.querySelector(".read-scrub-range");
      var label = panel.querySelector("[data-time]");
      var duration = clip.duration;
      if (!duration || !isFinite(duration)) {
        label.textContent = "0:00 / 0:00";
        return;
      }
      if (!range.dataset.holding) range.value = String(Math.round((clip.currentTime / duration) * 1000));
      label.textContent = clipSeconds(clip.currentTime) + " / " + clipSeconds(duration);
      var burn = panel.querySelector("[data-burn]");
      if (burn) {
        var frames = Math.floor((clip.currentTime % 1) * 30);
        burn.textContent = clipSeconds(clip.currentTime) + ":" + (frames < 10 ? "0" : "") + frames;
      }
      var head = panel.querySelector(".read-film .read-playhead");
      if (head) head.style.left = ((clip.currentTime / duration) * 100) + "%";
      var frameset = panel.querySelectorAll(".read-frame");
      if (frameset.length) {
        var mid = Math.round((clip.currentTime / duration) * (frameset.length - 1));
        frameset.forEach(function (frame, index) { frame.classList.toggle("is-mid", index === mid); });
      }
      paintLanes();
    }

    async function openReader(file) {
      var url = URL.createObjectURL(file);
      video.src = url;
      video.muted = true;
      await new Promise(function (resolve, reject) {
        video.onloadedmetadata = function () { resolve(); };
        video.onerror = function () { reject(new Error("This video could not be opened.")); };
      });
      return url;
    }

    async function snapshot(place, owner, file, at, duration, frac) {
      var target = owner || card;
      var key = target.id + ":" + place;
      var url = "";
      try {
        var worker = await reader();
        url = await openReader(file);
        var times = nearTimes(at, video.duration || duration || 0);
        var hits = [];
        for (var i = 0; i < times.length; i++) {
          say("Reading " + (i + 1) + " of " + times.length + " frames around this moment.");
          await seekTo(times[i]);
          hits = hits.concat(await readSource(worker, video, frac, i));
        }
        if (target.sent || cards.indexOf(target) < 0) return;
        var list = target.rows;
        var before = list.length;
        stampHits(hits, target.road || "");
        takeReads(list, place, hits);
        for (var n = before; n < list.length; n++) list[n].snap = true;
        if (target === card) {
          rows = target.rows;
          paint();
        } else paintCards();
        var added = list.length - before;
        if (!hits.length) say("No unit number stood out there. Zoom in, move the box, and try the next moment.");
        else if (!added) say("That unit is already in the list. Move the bar to the next one.");
        else say("Snapshot added. Move the bar to the next unit and tap Snapshot again.");
      } finally {
        if (url) URL.revokeObjectURL(url);
        delete inflight[key];
        reading = Object.keys(inflight).length > 0;
      }
    }

    ["head", "mid", "rear"].forEach(function (place) {
      bindCrop(place);
      bindView(place);
      paintCrop(place);
      paintView(place);
    });
    document.querySelectorAll("[data-zoom]").forEach(function (button) {
      button.addEventListener("click", function () {
        var place = button.closest(".read-clip").getAttribute("data-clip");
        var st = viewState[place];
        var next = button.getAttribute("data-zoom") === "in" ? st.z * 1.4 : st.z / 1.4;
        zoomAt(place, next, 0.5, 0.5, { x: st.x, y: st.y, z: st.z });
      });
    });
    document.querySelectorAll("[data-step]").forEach(function (button) {
      button.addEventListener("click", function () {
        var clip = button.closest(".read-clip").querySelector("video");
        if (!clip || !clip.duration) return;
        clip.pause();
        var delta = Number(button.getAttribute("data-step")) / 30;
        clip.currentTime = Math.min(clip.duration, Math.max(0, (clip.currentTime || 0) + delta));
      });
    });
    function clipRate(panel) {
      var on = panel && panel.querySelector("[data-rate].is-on");
      var rate = on ? Number(on.getAttribute("data-rate")) : 1;
      return rate > 0 ? rate : 1;
    }
    document.querySelectorAll("[data-rate]").forEach(function (button) {
      button.addEventListener("click", function () {
        var panel = button.closest(".read-clip");
        var clip = panel && panel.querySelector("video");
        panel.querySelectorAll("[data-rate]").forEach(function (other) {
          var on = other === button;
          other.classList.toggle("is-on", on);
          other.setAttribute("aria-pressed", on ? "true" : "false");
        });
        if (clip) clip.playbackRate = clipRate(panel);
      });
    });
    document.querySelectorAll("[data-play]").forEach(function (button) {
      button.addEventListener("click", function () {
        var panel = document.querySelector('.read-clip[data-clip="' + button.getAttribute("data-play") + '"]');
        var clip = panel && panel.querySelector("video");
        if (!clip) return;
        clip.playbackRate = clipRate(panel);
        if (clip.paused) clip.play();
        else clip.pause();
      });
    });
    document.querySelectorAll(".read-clip").forEach(function (panel) {
      var clip = panel.querySelector("video");
      var range = panel.querySelector(".read-scrub-range");
      clip.addEventListener("timeupdate", function () { paintTime(clip); });
      clip.addEventListener("loadedmetadata", function () {
        fitStage(clip);
        paintTime(clip);
        clip.playbackRate = clipRate(panel);
      });
      range.addEventListener("pointerdown", function () { range.dataset.holding = "1"; });
      range.addEventListener("pointerup", function () { delete range.dataset.holding; });
      range.addEventListener("pointercancel", function () { delete range.dataset.holding; });
      range.addEventListener("input", function () {
        if (!clip.duration || !isFinite(clip.duration)) return;
        clip.pause();
        var at = (Number(range.value) / 1000) * clip.duration;
        clip.currentTime = at;
        panel.querySelector("[data-time]").textContent = clipSeconds(at) + " / " + clipSeconds(clip.duration);
      });
    });

    function saveCrop(place) {
      var names = { head: "Head end", mid: "Mid-train", rear: "Rear DP" };
      var target = card;
      var key = target.id + ":" + place;
      var panel = document.querySelector('.read-clip[data-clip="' + place + '"]');
      var clip = panel && panel.querySelector("video");
      var file = target.files[place];
      if (inflight[key]) {
        say("Still reading this clip. You can type, or start the next train.");
        return;
      }
      if (!file || !clip || !clip.videoWidth) {
        say("Wait for the clip, then save the crop.");
        return;
      }
      clip.pause();
      var full = document.createElement("canvas");
      full.width = clip.videoWidth;
      full.height = clip.videoHeight;
      full.getContext("2d").drawImage(clip, 0, 0, full.width, full.height);
      var frac = videoFrac(place);
      var still = crop(full, {
        x0: frac.x * full.width,
        y0: frac.y * full.height,
        x1: (frac.x + frac.w) * full.width,
        y1: (frac.y + frac.h) * full.height
      });
      var at = clip.currentTime || 0;
      var duration = clip.duration || 0;
      inflight[key] = 1;
      reading = true;
      say("Reading this crop. Keep typing, or press N for the next train.");
      schedule(function () {
        return readCrop(place, target, file, at, duration, frac, still, names[place]).catch(function (err) {
          say(err && err.message ? err.message : "The reader stopped.");
          delete inflight[key];
          reading = Object.keys(inflight).length > 0;
        });
      });
    }

    async function readCrop(place, owner, file, at, duration, frac, still, where) {
      var url = "";
      var key = owner.id + ":" + place;
      try {
        var worker = await reader();
        url = await openReader(file);
        var times = nearTimes(at, video.duration || duration || 0);
        var hits = [];
        for (var i = 0; i < times.length; i++) {
          say("Reading " + (i + 1) + " of " + times.length + " frames around this moment.");
          await seekTo(times[i]);
          hits = hits.concat(await readSource(worker, video, frac, i));
        }
        if (owner.sent || cards.indexOf(owner) < 0) return;
        stampHits(hits, owner.road || "");
        var best = null;
        clusterHits(hits).forEach(function (item) {
          if (!item.number) return;
          if (!best || item.confidence > best.confidence) best = item;
        });
        var row = {
          mark: (best && best.mark) || owner.road || "",
          number: best ? best.number : "",
          place: place,
          known: best ? !!best.known : (!owner.road || !!MARKS[owner.road]),
          confidence: best ? best.confidence : 0,
          frames: best ? best.frames : 0,
          thumb: still,
          snap: true
        };
        owner.rows.push(row);
        if (owner === card) {
          rows = owner.rows;
          paint(row);
        } else paintCards();
        if (!row.number) say("Saved under " + where + ". No unit number stood out. Type it, then tap Add to list.");
        else say("Saved " + (row.mark ? row.mark + " " : "") + row.number + " under " + where + ". Tap Add to list, or fix the number.");
      } finally {
        if (url) URL.revokeObjectURL(url);
        delete inflight[key];
        reading = Object.keys(inflight).length > 0;
      }
    }

    document.querySelectorAll("[data-snap]").forEach(function (button) {
      button.addEventListener("click", function () {
        var place = button.getAttribute("data-snap");
        var target = card;
        var key = target.id + ":" + place;
        var panel = document.querySelector('.read-clip[data-clip="' + place + '"]');
        var clip = panel.querySelector("video");
        var file = target.files[place];
        if (inflight[key]) {
          say("Still reading this clip. You can type, or start the next train.");
          return;
        }
        if (!file || !clip.videoWidth) {
          say("Wait for the clip, then tap Snapshot.");
          return;
        }
        var at = clip.currentTime || 0;
        var duration = clip.duration || 0;
        var frac = videoFrac(place);
        clip.pause();
        inflight[key] = 1;
        reading = true;
        say("Reading in the background. Keep typing, or press N for the next train.");
        schedule(function () {
          return snapshot(place, target, file, at, duration, frac).catch(function (err) {
            say(err && err.message ? err.message : "The reader stopped.");
            delete inflight[key];
            reading = Object.keys(inflight).length > 0;
          });
        });
      });
    });
    document.querySelectorAll(".read-clip video").forEach(function (clip) {
      clip.addEventListener("play", function () {
        setPlayButton(clip.closest(".read-clip").querySelector("[data-play]"), true);
      });
      clip.addEventListener("pause", function () {
        setPlayButton(clip.closest(".read-clip").querySelector("[data-play]"), false);
      });
    });
    document.querySelectorAll("[data-keep]").forEach(function (button) {
      button.addEventListener("click", function () {
        saveCrop(button.getAttribute("data-keep"));
      });
    });
    document.querySelectorAll("[data-read-crop]").forEach(function (button) {
      button.addEventListener("click", function () {
        var place = button.getAttribute("data-read-crop");
        var target = card;
        var file = target.files[place];
        var key = target.id + ":" + place;
        if (!file || inflight[key]) {
          if (inflight[key]) say("Still reading this clip. You can type, or start the next train.");
          return;
        }
        var frac = videoFrac(place);
        inflight[key] = 1;
        reading = true;
        say("Reading this area in the background. Keep typing, or press N for the next train.");
        schedule(function () {
          return run(file, place, frac, target).catch(function (err) {
            say(err && err.message ? err.message : "The reader stopped.");
          }).then(function () {
            delete inflight[key];
            reading = Object.keys(inflight).length > 0;
          });
        });
      });
    });

    function placeTimeline() {
      var timeline = document.getElementById("read-timeline");
      if (!timeline) return;
      var view = document.documentElement.getAttribute("data-read-view") || "board";
      if (view !== "tracks") {
        var anchor = document.querySelector(".read-places");
        if (anchor) anchor.before(timeline);
        return;
      }
      var shot = document.querySelector(".read-shot.is-on");
      var list = shot && shot.querySelector(".read-list");
      if (shot && list) shot.insertBefore(timeline, list);
    }


    function setPlayButton(button, playing) {
      if (!button) return;
      var word = playing ? "Pause" : "Play";
      var label = button.querySelector(".read-play-label");
      if (label) label.textContent = word;
      else button.textContent = word;
      button.setAttribute("aria-label", word);
      var playIco = button.querySelector(".read-ico-play");
      var pauseIco = button.querySelector(".read-ico-pause");
      if (playIco) playIco.hidden = !!playing;
      if (pauseIco) pauseIco.hidden = !playing;
    }

    function setView(view) {
      if (view !== "tracks" && view !== "board") view = "board";
      document.documentElement.setAttribute("data-read-view", view);
      try { localStorage.setItem("rr-read-view", view); } catch (err) { /* private browsing */ }
      document.querySelectorAll("[data-view]").forEach(function (btn) {
        var on = btn.getAttribute("data-view") === view;
        btn.classList.toggle("is-on", on);
        btn.setAttribute("aria-checked", on ? "true" : "false");
      });
      var current = document.getElementById("read-view-current");
      if (current) current.textContent = view === "tracks" ? "Tracks" : "Storyboard";
      var pop = document.getElementById("read-view-pop");
      var trigger = document.getElementById("read-view-btn");
      if (pop) pop.hidden = true;
      if (trigger) trigger.setAttribute("aria-expanded", "false");
      placeTimeline();
    }

    function paintLanes() {
      ["head", "mid", "rear"].forEach(function (place) {
        var lane = document.querySelector('.read-lane[data-lane="' + place + '"]');
        if (!lane) return;
        var panel = document.querySelector('.read-clip[data-clip="' + place + '"]');
        var clip = panel.querySelector("video");
        var bar = lane.querySelector(".read-clipbar");
        var head = lane.querySelector(".read-playhead");
        var names = { head: "Head end", mid: "Mid-train", rear: "Rear DP" };
        var has = !!(clip && !panel.hidden && clip.duration && isFinite(clip.duration));
        bar.classList.toggle("is-empty", !has);
        bar.textContent = has ? names[place] : "No clip";
        var active = card && (card.place || "head") === place;
        lane.classList.toggle("is-on", !!active);
        if (has && active) {
          head.hidden = false;
          head.style.left = ((clip.currentTime / clip.duration) * 100) + "%";
        } else head.hidden = true;
      });
    }

    function scrubClip(clip, ratio) {
      if (!clip || !clip.duration || !isFinite(clip.duration)) return;
      clip.pause();
      clip.currentTime = Math.min(clip.duration, Math.max(0, ratio * clip.duration));
    }

    function bindScrub(el, place) {
      function at(event) {
        var box = el.getBoundingClientRect();
        if (!box.width) return;
        var x = Math.min(Math.max(event.clientX - box.left, 0), box.width);
        var panel = document.querySelector('.read-clip[data-clip="' + place + '"]');
        scrubClip(panel.querySelector("video"), x / box.width);
      }
      el.addEventListener("pointerdown", function (event) {
        if (event.button != null && event.button !== 0) return;
        event.preventDefault();
        at(event);
        function move(e) { at(e); }
        function up() {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        }
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      });
    }

    function fillStrip(place) {
      var token = ++stripToken[place];
      var panel = document.querySelector('.read-clip[data-clip="' + place + '"]');
      var film = panel.querySelector("[data-film]");
      var url = clipUrls && clipUrls[place];
      if (!film || !url) return;
      film.innerHTML = "";
      var count = window.matchMedia("(max-width: 700px)").matches ? 8 : 12;
      var buttons = [];
      for (var i = 0; i < count; i++) {
        var frame = document.createElement("button");
        frame.type = "button";
        frame.className = "read-frame";
        frame.tabIndex = -1;
        frame.setAttribute("aria-hidden", "true");
        film.appendChild(frame);
        buttons.push(frame);
      }
      var head = document.createElement("div");
      head.className = "read-playhead";
      film.appendChild(head);
      var probe = document.createElement("video");
      probe.muted = true;
      probe.playsInline = true;
      probe.preload = "auto";
      probe.src = url;
      function stop() {
        probe.removeAttribute("src");
        probe.load();
      }
      probe.addEventListener("loadedmetadata", function () {
        var duration = probe.duration;
        if (!duration || !isFinite(duration) || !probe.videoWidth) { stop(); return; }
        var canvas = document.createElement("canvas");
        canvas.width = 96;
        canvas.height = 54;
        var ctx = canvas.getContext("2d");
        var index = 0;
        function drawOne() {
          if (token !== stripToken[place]) { stop(); return; }
          try {
            ctx.drawImage(probe, 0, 0, canvas.width, canvas.height);
            buttons[index].style.backgroundImage = 'url("' + canvas.toDataURL("image/jpeg", 0.62) + '")';
          } catch (err) { /* frame not ready */ }
          index += 1;
          step();
        }
        function step() {
          if (token !== stripToken[place]) { stop(); return; }
          if (index >= count) { stop(); return; }
          var at = Math.min(duration - 0.05, Math.max(0, ((index + 0.5) / count) * duration));
          if (probe.readyState >= 2 && Math.abs((probe.currentTime || 0) - at) < 0.04) { drawOne(); return; }
          function done() {
            probe.removeEventListener("seeked", done);
            drawOne();
          }
          probe.addEventListener("seeked", done);
          try { probe.currentTime = at; } catch (err) {
            probe.removeEventListener("seeked", done);
            index += 1;
            step();
          }
        }
        step();
      });
    }

    function dressClips() {
      document.querySelectorAll(".read-clip").forEach(function (panel) {
        var place = panel.getAttribute("data-clip");
        var stage = panel.querySelector(".read-clip-stage");
        if (!stage.querySelector("[data-burn]")) {
          var burn = document.createElement("p");
          burn.className = "read-burn";
          burn.setAttribute("data-burn", "");
          burn.textContent = "0:00:00";
          stage.appendChild(burn);
        }
        if (!stage.querySelector(".read-rec")) {
          var rec = document.createElement("button");
          rec.type = "button";
          rec.className = "read-rec";
          rec.setAttribute("data-record", place);
          rec.setAttribute("aria-label", "Record a video");
          rec.innerHTML = "<i></i>";
          stage.appendChild(rec);
        }
        var scrub = panel.querySelector(".read-scrub");
        if (!panel.querySelector("[data-film]")) {
          var film = document.createElement("div");
          film.className = "read-film";
          film.setAttribute("data-film", "");
          scrub.parentNode.insertBefore(film, scrub);
          bindScrub(film, place);
        }
      });
      document.querySelectorAll(".read-track").forEach(function (track) {
        var place = track.closest(".read-lane").getAttribute("data-lane");
        track.addEventListener("pointerdown", function (event) {
          var switching = card && card.place !== place;
          if (switching) setPlace(place);
          var panel = document.querySelector('.read-clip[data-clip="' + place + '"]');
          function at(e) {
            var box = track.getBoundingClientRect();
            if (!box.width) return;
            var x = Math.min(Math.max(e.clientX - box.left, 0), box.width);
            scrubClip(panel.querySelector("video"), x / box.width);
          }
          if (!switching) at(event);
          function move(e) { at(e); }
          function up() {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
          }
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        });
      });
    }

    dressClips();
    setView(document.documentElement.getAttribute("data-read-view") || "board");
    document.querySelectorAll("[data-view]").forEach(function (button) {
      button.addEventListener("click", function () { setView(button.getAttribute("data-view")); });
    });
    var viewBtn = document.getElementById("read-view-btn");
    var viewPop = document.getElementById("read-view-pop");
    if (viewBtn && viewPop) {
      viewBtn.addEventListener("click", function () {
        var open = viewPop.hidden;
        viewPop.hidden = !open;
        viewBtn.setAttribute("aria-expanded", open ? "true" : "false");
      });
      document.addEventListener("click", function (event) {
        if (viewBtn.contains(event.target) || viewPop.contains(event.target)) return;
        viewPop.hidden = true;
        viewBtn.setAttribute("aria-expanded", "false");
      });
    }

    document.querySelectorAll("[data-record]").forEach(function (button) {
      button.addEventListener("click", function () {
        startCamera(button.getAttribute("data-record"));
      });
    });
    startBtn.addEventListener("click", beginRecording);
    stopBtn.addEventListener("click", finishRecording);
    document.getElementById("read-cancel").addEventListener("click", cancelRecording);
    capture.addEventListener("change", function () {
      var file = capture.files && capture.files[0];
      capture.value = "";
      if (!file) return;
      if (isImage(file)) {
        var owner = card;
        var place = recordPlace;
        schedule(function () {
          return run(file, place, null, owner).catch(function (err) {
            say(err && err.message ? err.message : "The reader stopped.");
          });
        });
        return;
      }
      showClip(file, recordPlace);
    });
    document.querySelectorAll(".read-shot input[type='file']").forEach(function (input) {
      input.addEventListener("change", function () {
        var files = Array.prototype.slice.call(input.files || []);
        var place = input.closest(".read-shot").getAttribute("data-place");
        input.value = "";
        if (!files.length) return;
        var videos = files.filter(function (file) { return !isImage(file); });
        var photos = files.filter(isImage);
        var owner = card;
        if (videos.length) showClip(videos[videos.length - 1], place);
        if (!photos.length) return;
        schedule(function () {
          return runFiles(photos, place, owner).catch(function (err) {
            say(err && err.message ? err.message : "The reader stopped.");
          });
        });
      });
    });
    document.querySelectorAll("[data-add]").forEach(function (button) {
      button.addEventListener("click", function () {
        var row = { mark: card.road || "", number: "", place: button.getAttribute("data-add"), known: !card.road || !!MARKS[card.road], confidence: 0, frames: 0, thumb: "" };
        rows.push(row);
        paint(row);
      });
    });
    function approvedFields() {
      return fieldsFromUnits(listedRows(), {});
    }

    function hasFields(fields) {
      return !!(fields.number || fields.head.length || fields.mid.length || fields.rear.length);
    }

    function setPlace(place) {
      card.place = place;
      document.querySelectorAll(".read-shot").forEach(function (section) {
        section.classList.toggle("is-on", section.getAttribute("data-place") === place);
      });
      document.querySelectorAll("[data-show]").forEach(function (button) {
        var on = button.getAttribute("data-show") === place;
        button.classList.toggle("is-on", on);
        if (on) button.setAttribute("aria-selected", "true");
        else button.removeAttribute("aria-selected");
      });
      placeTimeline();
      paintLanes();
    }

    function clearPanel(place) {
      var panel = document.querySelector('.read-clip[data-clip="' + place + '"]');
      var clip = panel.querySelector("video");
      clip.pause();
      clip.removeAttribute("src");
      delete clip.dataset.blob;
      clip.load();
      panel.hidden = true;
      stripToken[place] += 1;
      var film = panel.querySelector("[data-film]");
      if (film) film.innerHTML = "";
      paintLanes();
    }

    function mountCard() {
      ["head", "mid", "rear"].forEach(function (place) {
        var panel = document.querySelector('.read-clip[data-clip="' + place + '"]');
        var clip = panel.querySelector("video");
        if (clipUrls[place]) {
          var changed = clip.dataset.blob !== clipUrls[place];
          if (changed) {
            clip.dataset.blob = clipUrls[place];
            clip.src = clipUrls[place];
          }
          panel.hidden = false;
          paintView(place);
          paintCrop(place);
          if (changed || !panel.querySelector(".read-frame")) fillStrip(place);
        } else clearPanel(place);
      });
      setPlace(card.place || "head");
      paint();
      paintCards();
    }

    function paintCards() {
      var bar = document.getElementById("read-cards");
      if (!bar) return;
      bar.innerHTML = "";
      cards.forEach(function (item, index) {
        var tab = document.createElement("div");
        tab.className = "read-card-tab";
        if (item === card) tab.classList.add("is-on");
        if (hasClip(item)) tab.classList.add("has-clip");
        if (item.sent) tab.classList.add("is-sent");
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-selected", item === card ? "true" : "false");
        var open = document.createElement("button");
        open.type = "button";
        open.className = "read-card-open";
        open.textContent = "Train " + (index + 1) + (item.sent ? " sent" : "");
        open.addEventListener("click", function () {
          if (item === card) return;
          useCard(item);
          mountCard();
        });
        tab.appendChild(open);
        if (!item.sent && cards.length > 1) {
          var drop = document.createElement("button");
          drop.type = "button";
          drop.className = "read-card-x";
          drop.setAttribute("aria-label", "Remove Train " + (index + 1));
          drop.textContent = "×";
          drop.addEventListener("click", function () { removeTrain(item, index + 1); });
          tab.appendChild(drop);
        }
        bar.appendChild(tab);
      });
    }

    function removeTrain(target, number) {
      if (recorder && recorder.state === "recording") {
        say("Stop this clip first, then remove the train.");
        return;
      }
      if (cards.length < 2 || target.sent) return;
      var kept = (target.rows || []).some(function (row) { return row.mark || row.number; });
      if ((hasClip(target) || kept) && !window.confirm("Remove Train " + number + "? Its clip and numbers go with it.")) return;
      var was = target === card;
      var index = cards.indexOf(target);
      if (index < 0) return;
      purgeCard(target);
      cards.splice(index, 1);
      if (was) {
        useCard(cards[Math.min(index, cards.length - 1)]);
        mountCard();
      } else paintCards();
      saveOpenCards();
      say("Removed Train " + number + ".");
    }

    function purgeCard(target) {
      ["head", "mid", "rear"].forEach(function (place) {
        if (target.urls[place]) URL.revokeObjectURL(target.urls[place]);
        target.urls[place] = "";
        target.files[place] = null;
        if (target === card) clearPanel(place);
      });
    }

    function nextTrain() {
      if (recorder && recorder.state === "recording") {
        say("Stop this clip first, then start the next train.");
        return;
      }
      var open = cards.filter(function (item) { return !item.sent; });
      if (open.length >= 6) {
        say("Six trains are still open. Send one before starting another.");
        return;
      }
      var fresh = makeCard();
      cards.push(fresh);
      useCard(fresh);
      mountCard();
      saveOpenCards();
      say("Next train. The previous clip stays on its card until you send that train.");
    }

    function savedTrains() {
      try {
        var list = JSON.parse(sessionStorage.getItem("rr-read-units-queue") || "[]");
        if (!Array.isArray(list)) return [];
        return list.slice().sort(function (a, b) { return (Number(a.seq) || 0) - (Number(b.seq) || 0); });
      } catch (err) {
        return [];
      }
    }

    function rememberTrain(kind, fields, seq) {
      var list = savedTrains().filter(function (item) { return item.seq !== seq; });
      list.push({ seq: seq, kind: kind, fields: fields });
      list.sort(function (a, b) { return a.seq - b.seq; });
      sessionStorage.setItem("rr-read-units-queue", JSON.stringify(list));
      return list;
    }

    function paintSaved(list) {
      var box = document.getElementById("read-saved");
      if (!box) return;
      list = list || savedTrains();
      box.innerHTML = "";
      box.hidden = !list.length;
      list.forEach(function (item, index) {
        var fields = item.fields || {};
        var who = ((fields.mark || "") + " " + (fields.number || "")).trim();
        var li = document.createElement("li");
        li.textContent = "Saved " + (index + 1) + (who ? " · " + who : "") + (fields.consist ? " · " + fields.consist : "");
        box.appendChild(li);
      });
    }

    function finalize(kind) {
      var fields = approvedFields();
      if (!hasFields(fields)) {
        say("Approve at least one number, then send this train.");
        return;
      }
      var list;
      try { list = rememberTrain(kind, fields, card.seen); } catch (err) {
        say("This browser blocked saving the numbers.");
        return;
      }
      purgeCard(card);
      card.sent = true;
      paintSaved(list);
      saveOpenCards();
      var open = cards.filter(function (item) { return !item.sent; });
      var place = list.filter(function (item) { return item.seq === card.seen; })[0];
      var at = list.indexOf(place) + 1;
      var note = "Train " + card.seen + " saved (" + (fields.consist || "units") + "). " + list.length + (list.length === 1 ? " train is" : " trains are") + " ready for the entry, in the order you saw them.";
      if (!open.length) {
        say(note);
        returnToLog();
        return;
      }
      useCard(open[0]);
      mountCard();
      say(note + " Saved " + at + " of " + list.length + ".");
    }

    document.querySelectorAll("[data-show]").forEach(function (button) {
      button.addEventListener("click", function () {
        setPlace(button.getAttribute("data-show"));
      });
    });
    document.addEventListener("keydown", function (event) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      var tag = event.target && event.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "1") setPlace("head");
      else if (event.key === "2") setPlace("mid");
      else if (event.key === "3") setPlace("rear");
      else if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        nextTrain();
      } else if (event.key === "s" || event.key === "S") {
        var snap = document.querySelector(".read-shot.is-on [data-snap]");
        if (snap && !document.querySelector('.read-shot.is-on .read-clip[hidden]')) snap.click();
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        var stepClip = document.querySelector(".read-shot.is-on .read-clip:not([hidden]) video");
        if (!stepClip || !stepClip.duration) return;
        event.preventDefault();
        stepClip.pause();
        var dir = event.key === "ArrowRight" ? 1 : -1;
        stepClip.currentTime = Math.min(stepClip.duration, Math.max(0, (stepClip.currentTime || 0) + dir / 30));
      } else if (event.key === "Escape") {
        var openPop = document.getElementById("read-view-pop");
        var openBtn = document.getElementById("read-view-btn");
        if (openPop && !openPop.hidden) {
          openPop.hidden = true;
          if (openBtn) openBtn.setAttribute("aria-expanded", "false");
        }
      }
    });
    document.getElementById("read-next").addEventListener("click", nextTrain);
    fillRoadSelect(ROAD_GROUPS);
    var roadSelect = document.getElementById("read-road");
    roadSelect.addEventListener("change", function () {
      applyRoad(roadSelect.value);
    });
    fetch("/api/railroads").then(function (res) {
      if (!res.ok) return null;
      return res.json();
    }).then(function (data) {
      if (!data || !data.groups) return;
      fillRoadSelect(data.groups.map(function (group) {
        return [group.label, group.railroads || []];
      }));
    }).catch(function () {});
    paintSaved();
    if (restoreOpenCards()) {
      mountCard();
      say("Numbers from the last visit are back. A clip stays only while this page is open.");
    } else {
      paintCards();
      setPlace("head");
    }
    if (card && card.road) applyRoad(card.road);
    var openTimer = 0;
    function queueOpenSave() {
      clearTimeout(openTimer);
      openTimer = setTimeout(saveOpenCards, 250);
    }
    document.addEventListener("input", queueOpenSave);
    document.addEventListener("change", queueOpenSave);
    window.addEventListener("pagehide", saveOpenCards);
    var back = document.getElementById("read-back");
    if (back) {
      back.addEventListener("click", function (event) {
        event.preventDefault();
        returnToLog();
      });
    }

    quickBtn.addEventListener("click", function () { finalize("quick"); });
    copyBtn.addEventListener("click", function () { finalize("fill"); });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})();
