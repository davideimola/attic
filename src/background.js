"use strict";

const ALARM = "attic-sweep";
const SWEEP_EVERY_MINUTES = 15;

let sweeping = null;

async function setup() {
  // Creating an alarm with an existing name replaces it.
  await browser.alarms.create(ALARM, { periodInMinutes: SWEEP_EVERY_MINUTES });
}

async function runSweep() {
  const settings = await AtticStore.getSettings();
  if (!settings.enabled) return 0;

  const now = Date.now();
  const tabs = await browser.tabs.query({});
  const candidates = tabs.filter((tab) => Attic.shouldClose(tab, { now, settings }));

  const kept = new Set();
  await Promise.all(
    candidates.map(async (tab) => {
      if (await AtticStore.isKept(tab.id)) kept.add(tab.id);
    }),
  );
  const toClose = candidates.filter((tab) => !kept.has(tab.id));
  if (toClose.length === 0) return 0;

  const entries = toClose
    .filter((tab) => Attic.isArchivable(tab.url))
    .map((tab) => Attic.toEntry(tab, now));

  // Archive first: if closing fails halfway, nothing is lost.
  await AtticStore.updateArchive((archive) =>
    Attic.addToArchive(archive, entries, settings, now),
  );
  await browser.tabs.remove(toClose.map((tab) => tab.id));
  return toClose.length;
}

function sweep() {
  // One sweep at a time, whoever asks for it.
  sweeping ??= runSweep().finally(() => {
    sweeping = null;
  });
  return sweeping;
}

browser.runtime.onInstalled.addListener(setup);
browser.runtime.onStartup.addListener(async () => {
  await setup();
  await sweep();
});

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) sweep();
});

browser.runtime.onMessage.addListener((message) => {
  if (message?.type === "sweep") return sweep().then((closed) => ({ closed }));
  return undefined;
});
