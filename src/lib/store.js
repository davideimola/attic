// Thin wrapper around browser.storage.local, shared by every extension page.
(function (root) {
  "use strict";

  const { Attic } = root;
  const KEEP_KEY = "attic.keep";

  const AtticStore = {
    async getSettings() {
      const { settings } = await browser.storage.local.get("settings");
      return Attic.normalizeSettings(settings);
    },

    async updateSettings(patch) {
      const next = Attic.normalizeSettings({ ...(await this.getSettings()), ...patch });
      await browser.storage.local.set({ settings: next });
      return next;
    },

    async getArchive() {
      const { archive } = await browser.storage.local.get("archive");
      return Array.isArray(archive) ? archive : [];
    },

    // Read-modify-write on the freshest copy, so the popup and the sweep don't clobber each other.
    async updateArchive(fn) {
      const next = fn(await this.getArchive());
      await browser.storage.local.set({ archive: next });
      return next;
    },

    // The per-tab "keep" flag lives in the session store, so it survives a browser restart.
    async isKept(tabId) {
      return Boolean(await browser.sessions.getTabValue(tabId, KEEP_KEY));
    },

    async setKept(tabId, kept) {
      if (kept) await browser.sessions.setTabValue(tabId, KEEP_KEY, true);
      else await browser.sessions.removeTabValue(tabId, KEEP_KEY);
    },

    async reopen(entry) {
      const props = { url: entry.url, active: true };
      if (entry.cookieStoreId && entry.cookieStoreId !== "firefox-default") {
        try {
          return await browser.tabs.create({ ...props, cookieStoreId: entry.cookieStoreId });
        } catch {
          // The container is gone: fall back to a normal tab.
        }
      }
      return browser.tabs.create(props);
    },
  };

  root.AtticStore = AtticStore;
})(globalThis);
