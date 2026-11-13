// Pure logic shared by the background script, the popup, the options page and the tests.
// No `browser.*` calls in here, so it can be unit-tested in Node.
(function (root) {
  "use strict";

  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  const MAX_FAVICON_LENGTH = 4096;

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    thresholdHours: 24,
    retentionDays: 30, // 0 = keep forever
    archiveLimit: 1000,
    keepDomains: [],
  });

  const BLANK_URLS = new Set([
    "",
    "about:blank",
    "about:newtab",
    "about:home",
    "about:privatebrowsing",
  ]);

  function isBlank(url) {
    return BLANK_URLS.has(url || "");
  }

  // Only web pages go to the archive: they are the only ones a WebExtension can reopen.
  function isArchivable(url) {
    return /^https?:\/\//i.test(url || "");
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return "";
    }
  }

  function normalizeDomain(domain) {
    return String(domain || "")
      .trim()
      .toLowerCase()
      .replace(/^[a-z]+:\/\//, "")
      .replace(/^\*\./, "")
      .replace(/\/.*$/, "");
  }

  function matchesDomain(host, domain) {
    const d = normalizeDomain(domain);
    return d !== "" && (host === d || host.endsWith("." + d));
  }

  function toNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeSettings(raw) {
    const s = { ...DEFAULT_SETTINGS, ...(raw || {}) };
    return {
      enabled: Boolean(s.enabled),
      thresholdHours: Math.max(1 / 60, toNumber(s.thresholdHours, DEFAULT_SETTINGS.thresholdHours)),
      retentionDays: Math.max(0, toNumber(s.retentionDays, DEFAULT_SETTINGS.retentionDays)),
      archiveLimit: Math.max(1, Math.floor(toNumber(s.archiveLimit, DEFAULT_SETTINGS.archiveLimit))),
      keepDomains: (Array.isArray(s.keepDomains) ? s.keepDomains : [])
        .map(normalizeDomain)
        .filter(Boolean),
    };
  }

  // Should this tab be closed by the sweep? `kept` is the set of tab ids the user asked to keep.
  function shouldClose(tab, { now, settings, kept }) {
    if (!settings.enabled) return false;
    if (tab.pinned || tab.active || tab.audible || tab.incognito) return false;
    if (kept && kept.has(tab.id)) return false;
    if (typeof tab.lastAccessed !== "number") return false;
    if (now - tab.lastAccessed < settings.thresholdHours * HOUR) return false;
    if (!isBlank(tab.url) && !isArchivable(tab.url)) return false;
    const host = hostOf(tab.url);
    if (settings.keepDomains.some((d) => matchesDomain(host, d))) return false;
    return true;
  }

  function toEntry(tab, now) {
    const favicon = tab.favIconUrl || "";
    const keepFavicon =
      favicon.length <= MAX_FAVICON_LENGTH && /^(https?:|data:image\/)/i.test(favicon);
    return {
      id: `${now.toString(36)}-${tab.id}`,
      url: tab.url,
      title: tab.title || tab.url,
      favIconUrl: keepFavicon ? favicon : "",
      cookieStoreId: tab.cookieStoreId || "",
      closedAt: now,
    };
  }

  function pruneArchive(archive, settings, now) {
    const maxAge = settings.retentionDays * DAY;
    return archive
      .filter((e) => settings.retentionDays === 0 || now - e.closedAt < maxAge)
      .slice(0, settings.archiveLimit);
  }

  // Newest first; an URL archived again replaces its older entry.
  function addToArchive(archive, entries, settings, now) {
    const urls = new Set(entries.map((e) => e.url));
    const rest = archive.filter((e) => !urls.has(e.url));
    return pruneArchive([...entries, ...rest], settings, now);
  }

  function searchArchive(archive, query) {
    const terms = String(query || "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (terms.length === 0) return archive;
    return archive.filter((e) => {
      const haystack = `${e.title} ${e.url}`.toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }

  const Attic = {
    HOUR,
    DAY,
    DEFAULT_SETTINGS,
    isBlank,
    isArchivable,
    hostOf,
    normalizeDomain,
    matchesDomain,
    normalizeSettings,
    shouldClose,
    toEntry,
    pruneArchive,
    addToArchive,
    searchArchive,
  };

  if (typeof module === "object" && module.exports) module.exports = Attic;
  else root.Attic = Attic;
})(globalThis);
