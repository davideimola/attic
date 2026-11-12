"use strict";

const $ = (id) => document.getElementById(id);

function ensureOption(select, value, label) {
  const v = String(value);
  if (![...select.options].some((o) => o.value === v)) select.add(new Option(label, v));
  select.value = v;
}

function fill(settings) {
  $("enabled").checked = settings.enabled;
  ensureOption($("thresholdHours"), settings.thresholdHours, `${settings.thresholdHours} hours`);
  ensureOption($("retentionDays"), settings.retentionDays, `${settings.retentionDays} days`);
  $("keepDomains").value = settings.keepDomains.join("\n");
  $("form").classList.toggle("off", !settings.enabled);
}

let savedTimer;
async function save() {
  const settings = await AtticStore.updateSettings({
    enabled: $("enabled").checked,
    thresholdHours: Number($("thresholdHours").value),
    retentionDays: Number($("retentionDays").value),
    keepDomains: $("keepDomains").value.split(/[\s,]+/),
  });
  // Apply a shorter retention right away.
  await AtticStore.updateArchive((archive) => Attic.pruneArchive(archive, settings, Date.now()));
  $("form").classList.toggle("off", !settings.enabled);

  $("saved").textContent = "Saved";
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => ($("saved").textContent = ""), 1500);
}

async function init() {
  fill(await AtticStore.getSettings());

  for (const id of ["enabled", "thresholdHours", "retentionDays"]) {
    $(id).addEventListener("change", save);
  }
  $("keepDomains").addEventListener("change", async () => {
    await save();
    fill(await AtticStore.getSettings()); // show the cleaned-up domain list
  });

  $("clear").addEventListener("click", async () => {
    const count = (await AtticStore.getArchive()).length;
    if (count === 0) return;
    if (!confirm(`Delete all ${count} archived tabs? This can't be undone.`)) return;
    await AtticStore.updateArchive(() => []);
    $("saved").textContent = "Archive cleared";
  });
}

init();
