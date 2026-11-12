"use strict";

const $ = (id) => document.getElementById(id);

let archive = [];
let settings = Attic.DEFAULT_SETTINGS;

function describeThreshold(hours) {
  if (hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? "1 day" : `${days} days`;
  }
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

function dayLabel(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function timeLabel(timestamp) {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function faviconFor(entry) {
  const box = document.createElement("span");
  box.className = "favicon";
  const host = Attic.hostOf(entry.url).replace(/^www\./, "");
  const letter = () => {
    box.textContent = (host[0] || "?").toUpperCase();
  };
  if (entry.favIconUrl) {
    const img = document.createElement("img");
    img.src = entry.favIconUrl;
    img.alt = "";
    img.addEventListener("error", () => {
      img.remove();
      letter();
    });
    box.append(img);
  } else {
    letter();
  }
  return box;
}

function renderEntry(entry) {
  const li = document.createElement("li");
  li.className = "entry";
  li.tabIndex = 0;
  li.title = entry.url;

  const text = document.createElement("div");
  text.className = "text";
  const title = document.createElement("div");
  title.className = "title";
  title.textContent = entry.title;
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `${Attic.hostOf(entry.url).replace(/^www\./, "")} · ${timeLabel(entry.closedAt)}`;
  text.append(title, meta);

  const remove = document.createElement("button");
  remove.className = "remove";
  remove.type = "button";
  remove.title = "Remove from archive";
  remove.setAttribute("aria-label", "Remove from archive");
  remove.textContent = "×";
  remove.addEventListener("click", (event) => {
    event.stopPropagation();
    removeEntry(entry.id);
  });

  li.append(faviconFor(entry), text, remove);
  li.addEventListener("click", () => restore(entry));
  li.addEventListener("keydown", (event) => {
    if (event.key === "Enter") restore(entry);
  });
  return li;
}

function render() {
  const list = $("list");
  const query = $("search").value;
  const results = Attic.searchArchive(archive, query);

  list.replaceChildren();
  let lastDay = null;
  for (const entry of results) {
    const day = dayLabel(entry.closedAt);
    if (day !== lastDay) {
      const header = document.createElement("li");
      header.className = "day";
      header.textContent = day;
      list.append(header);
      lastDay = day;
    }
    list.append(renderEntry(entry));
  }

  const empty = $("empty");
  empty.hidden = results.length > 0;
  empty.textContent = query
    ? "Nothing in the archive matches your search."
    : settings.enabled
      ? `Tabs you haven't used for ${describeThreshold(settings.thresholdHours)} will show up here.`
      : "Auto-archive is turned off. Turn it on in Settings.";

  $("status").textContent = archive.length === 1 ? "1 tab archived" : `${archive.length} tabs archived`;
}

async function restore(entry) {
  await AtticStore.reopen(entry);
  await AtticStore.updateArchive((current) => current.filter((e) => e.id !== entry.id));
  window.close();
}

async function removeEntry(id) {
  archive = await AtticStore.updateArchive((current) => current.filter((e) => e.id !== id));
  render();
}

async function setupKeepToggle() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const toggle = $("keep-toggle");
  const label = $("keep-label");

  if (!tab || tab.incognito) {
    $("keep").hidden = true;
    return;
  }
  if (tab.pinned) {
    toggle.checked = true;
    toggle.disabled = true;
    $("keep").classList.add("disabled");
    label.textContent = "Pinned tabs are never archived";
    return;
  }
  toggle.checked = await AtticStore.isKept(tab.id);
  toggle.addEventListener("change", () => AtticStore.setKept(tab.id, toggle.checked));
}

async function init() {
  [settings, archive] = await Promise.all([AtticStore.getSettings(), AtticStore.getArchive()]);
  render();
  await setupKeepToggle();

  $("search").addEventListener("input", render);
  $("search").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const [first] = Attic.searchArchive(archive, $("search").value);
    if (first) restore(first);
  });

  $("settings").addEventListener("click", () => {
    browser.runtime.openOptionsPage();
    window.close();
  });

  $("sweep").addEventListener("click", async () => {
    const { closed } = await browser.runtime.sendMessage({ type: "sweep" });
    archive = await AtticStore.getArchive();
    render();
    $("status").textContent =
      closed === 0 ? "No idle tabs to archive" : `Archived ${closed} tab${closed === 1 ? "" : "s"}`;
  });
}

init();
