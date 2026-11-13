(function () {
  "use strict";

  let pending = null;

  function settle(value) {
    if (!pending) return;
    const resolve = pending;
    pending = null;
    resolve(value);
  }

  window.askConfirm = function (opts) {
    const options = opts || {};
    const dialog = document.getElementById("ask-dialog");
    if (!dialog || typeof dialog.showModal !== "function") {
      return Promise.resolve(window.confirm(options.message || options.title || "Are you sure?"));
    }
    if (dialog.open) dialog.close("cancel");
    settle(false);
    document.getElementById("ask-title").textContent = options.title || "Are You Sure?";
    const message = document.getElementById("ask-message");
    message.textContent = options.message || "";
    message.hidden = !options.message;
    const details = document.getElementById("ask-details");
    const rows = (options.details || []).filter(function (pair) {
      return pair && pair[1];
    });
    details.innerHTML = "";
    rows.forEach(function (pair) {
      const line = document.createElement("div");
      const label = document.createElement("span");
      label.textContent = pair[0];
      const value = document.createElement("strong");
      value.textContent = pair[1];
      line.appendChild(label);
      line.appendChild(value);
      details.appendChild(line);
    });
    details.hidden = !rows.length;
    const ok = document.getElementById("ask-ok");
    ok.textContent = options.ok || "Delete";
    ok.className = "btn " + (options.danger === false ? "primary" : "danger");
    return new Promise(function (resolve) {
      pending = resolve;
      dialog.returnValue = "cancel";
      dialog.showModal();
      document.getElementById("ask-cancel").focus();
    });
  };

  document.addEventListener("DOMContentLoaded", function () {
    const dialog = document.getElementById("ask-dialog");
    if (!dialog) return;
    dialog.addEventListener("close", function () {
      settle(dialog.returnValue === "ok");
    });
  });
})();
