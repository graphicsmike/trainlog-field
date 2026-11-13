(function () {
  document.addEventListener("click", function (event) {
    const link = event.target.closest('a[href="/#entry"]');
    if (!link || !(navigator.serviceWorker && navigator.serviceWorker.controller)) return;
    event.preventDefault();
    location.assign("/index.html#entry");
  });

  const sections = Array.prototype.slice.call(document.querySelectorAll("main > section.train-row[id]"));
  if (!sections.length) return;

  function setOpen(section, open) {
    section.classList.toggle("is-collapsed", !open);
    const button = section.querySelector(".doc-fold");
    if (button) button.setAttribute("aria-expanded", open ? "true" : "false");
  }

  sections.forEach(function (section) {
    const heading = section.querySelector("h2");
    if (!heading) return;
    const body = document.createElement("div");
    body.className = "doc-fold-body";
    body.id = section.id + "-body";
    while (heading.nextSibling) body.appendChild(heading.nextSibling);
    section.appendChild(body);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "doc-fold";
    button.setAttribute("aria-controls", body.id);
    button.innerHTML = '<span class="doc-fold-caret" aria-hidden="true">▸</span>' + heading.innerHTML;
    heading.innerHTML = "";
    heading.appendChild(button);
    button.addEventListener("click", function () {
      setOpen(section, section.classList.contains("is-collapsed"));
    });
    setOpen(section, false);
  });

  function openForHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!id || id === "top") return;
    const target = document.getElementById(id);
    const section = target && target.closest("main > section.train-row[id]");
    if (!section) return;
    setOpen(section, true);
    target.scrollIntoView();
  }
  openForHash();
  window.addEventListener("hashchange", openForHash);

  const toc = document.querySelector(".doc-toc");
  if (toc) {
    const tools = document.createElement("p");
    tools.className = "doc-fold-tools";
    tools.innerHTML =
      '<button type="button" class="btn ghost" data-fold="open">Expand All</button>' +
      '<button type="button" class="btn ghost" data-fold="close">Collapse All</button>';
    toc.parentNode.insertBefore(tools, toc.nextSibling);
    tools.addEventListener("click", function (event) {
      const button = event.target.closest("[data-fold]");
      if (!button) return;
      const open = button.getAttribute("data-fold") === "open";
      sections.forEach(function (section) {
        setOpen(section, open);
      });
    });
  }

  document.addEventListener("click", function (event) {
    const link = event.target.closest('a[href^="#"]');
    if (link && link.getAttribute("href") === location.hash) openForHash();
  });
})();
