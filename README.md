# Attic

Arc-style auto-archive for [Zen](https://zen-browser.app) and Firefox.

Attic closes the tabs you haven't looked at in a while and keeps them in a searchable archive, so your sidebar stays clean without losing anything.

- **Auto-archive**: tabs idle for longer than a chosen time (1 hour, 12 hours, 1 day, 7 days or 30 days) are closed and archived. It checks every 15 minutes and at browser startup.
- **Searchable archive**: open the toolbar popup, type a few words from the title or URL, press Enter to reopen the tab. Tabs reopen in the container they came from.
- **Keep a tab**: tick "Keep this tab open" in the popup and that tab is never archived, even after a restart.
- **Never archive a site**: list domains in the settings; subdomains are included.
- **Safe defaults**: pinned tabs, the active tab of each window, tabs playing audio and tabs in private windows are never closed. Browser pages (`about:`, `file:`, extension pages) are left alone; old empty new-tab pages are closed without being archived.
- **Private by design**: everything stays in the extension's local storage. No network requests, no data collection.

## Development

```sh
npm install
npm test          # unit tests for the archive policy
npm run lint      # web-ext lint
npm run start:zen # launch Zen with the extension loaded (macOS path)
npm run build     # zip for addons.mozilla.org in dist/
```

You can also load it by hand: open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…** and pick `src/manifest.json`.

The archive policy lives in `src/lib/policy.js` and has no browser dependencies, so it is covered by plain Node tests. `src/background.js` runs the sweep, `src/popup/` is the archive, `src/options/` the settings.

## License

[MIT](LICENSE)
