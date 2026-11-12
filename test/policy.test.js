"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Attic = require("../src/lib/policy.js");

const { HOUR, DAY } = Attic;
const NOW = Date.UTC(2026, 10, 12, 12, 0, 0);
const settings = Attic.normalizeSettings({});

function tab(overrides = {}) {
  return {
    id: 1,
    url: "https://example.com/page",
    title: "Example",
    pinned: false,
    active: false,
    audible: false,
    incognito: false,
    lastAccessed: NOW - 2 * DAY,
    ...overrides,
  };
}

const closes = (t, opts = {}) =>
  Attic.shouldClose(t, { now: NOW, settings, ...opts });

test("closes a tab idle for longer than the threshold", () => {
  assert.equal(closes(tab()), true);
});

test("keeps a tab used more recently than the threshold", () => {
  assert.equal(closes(tab({ lastAccessed: NOW - 23 * HOUR })), false);
});

test("never closes pinned, active, audible or private tabs", () => {
  for (const flag of ["pinned", "active", "audible", "incognito"]) {
    assert.equal(closes(tab({ [flag]: true })), false, flag);
  }
});

test("never closes a tab the user asked to keep", () => {
  assert.equal(closes(tab({ id: 7 }), { kept: new Set([7]) }), false);
});

test("does nothing when auto-archive is off", () => {
  const off = Attic.normalizeSettings({ enabled: false });
  assert.equal(closes(tab(), { settings: off }), false);
});

test("leaves internal pages alone but clears old blank tabs", () => {
  assert.equal(closes(tab({ url: "about:preferences" })), false);
  assert.equal(closes(tab({ url: "file:///tmp/a.pdf" })), false);
  assert.equal(closes(tab({ url: "about:newtab" })), true);
});

test("never closes sites on the keep list, subdomains included", () => {
  const s = Attic.normalizeSettings({ keepDomains: ["https://Example.com/whatever", "*.slack.com"] });
  assert.equal(closes(tab({ url: "https://mail.example.com/" }), { settings: s }), false);
  assert.equal(closes(tab({ url: "https://app.slack.com/" }), { settings: s }), false);
  assert.equal(closes(tab({ url: "https://notexample.com/" }), { settings: s }), true);
});

test("normalizeSettings clamps bad input", () => {
  const s = Attic.normalizeSettings({ thresholdHours: "nope", retentionDays: -3, keepDomains: ["", " A.com "] });
  assert.equal(s.thresholdHours, 24);
  assert.equal(s.retentionDays, 0);
  assert.deepEqual(s.keepDomains, ["a.com"]);
});

test("toEntry drops oversized or non-web favicons", () => {
  assert.equal(Attic.toEntry(tab({ favIconUrl: "https://example.com/f.ico" }), NOW).favIconUrl, "https://example.com/f.ico");
  assert.equal(Attic.toEntry(tab({ favIconUrl: "chrome://branding/icon.png" }), NOW).favIconUrl, "");
  assert.equal(Attic.toEntry(tab({ favIconUrl: "data:image/png;base64," + "a".repeat(5000) }), NOW).favIconUrl, "");
});

test("addToArchive puts new entries first and replaces duplicates", () => {
  const old = [
    { id: "a", url: "https://a.com/", closedAt: NOW - HOUR },
    { id: "b", url: "https://b.com/", closedAt: NOW - HOUR },
  ];
  const fresh = [{ id: "c", url: "https://a.com/", closedAt: NOW }];
  const result = Attic.addToArchive(old, fresh, settings, NOW);
  assert.deepEqual(result.map((e) => e.id), ["c", "b"]);
});

test("pruneArchive enforces retention and limit", () => {
  const archive = [
    { id: "new", url: "https://a.com/", closedAt: NOW - DAY },
    { id: "old", url: "https://b.com/", closedAt: NOW - 40 * DAY },
  ];
  assert.deepEqual(Attic.pruneArchive(archive, settings, NOW).map((e) => e.id), ["new"]);

  const forever = Attic.normalizeSettings({ retentionDays: 0, archiveLimit: 1 });
  assert.deepEqual(Attic.pruneArchive(archive, forever, NOW).map((e) => e.id), ["new"]);
});

test("searchArchive matches every term against title and URL", () => {
  const archive = [
    { id: "1", title: "Pull request #42", url: "https://github.com/x/y/pull/42" },
    { id: "2", title: "Docs", url: "https://developer.mozilla.org/tabs" },
  ];
  assert.deepEqual(Attic.searchArchive(archive, "github 42").map((e) => e.id), ["1"]);
  assert.deepEqual(Attic.searchArchive(archive, "MOZILLA").map((e) => e.id), ["2"]);
  assert.equal(Attic.searchArchive(archive, "  ").length, 2);
});
