---
description: How to reload the extension and test the popup using the browser agent
---

This workflow allows Antigravity to iterate on the extension without manual intervention.

1. **Rebuild the project**
   // turbo

```bash
npm run build
```

2. **Open the Popup in the Browser Agent**
   Navigate to `file:///c:/Users/joald/chrome_exts/playground/dist/index.html`.
   The popup is now "Mock-Aware" and will automatically inject Chrome API mocks if it detects it's not running as a real extension.

3. **Verify Changes**
   Use the browser agent's `click`, `type`, and `capture_browser_screenshot` tools to verify the UI.

4. **(Optional) Reload Actual Extension**
   If the extension is loaded in the user's browser, Antigravity can signal a reload by running:
   // turbo

```bash
node scripts/signal-reload.js
```

_(Requires `scripts/signal-reload.js` and a background script listener)_

5. **Test on Live Sites**
   - Open a live site (e.g., `https://www.youtube.com/`).
   - Use the browser agent to **refresh the page**.
   - Since the extension is already loaded (manually once), the refresh will trigger the new content scripts from the `dist/` folder if the user has enabled "Developer mode" and loaded the unpacked extension.

6. **End-to-End Simulation Testing (Zero-Install)**
   - If the extension is not installed, the agent can perform an E2E test by simulating the extension pipeline directly on the page:
     1. Open the target page (e.g., Dropout or YouTube) via `open_browser_url`.
     2. Inject the necessary scripts using `execute_browser_javascript` by reading and running the contents of `dist/platforms.js`, `dist/storage.js`, and `dist/main.js`.
     3. Setup a mock `get` responder to return preliminary settings when the scripts ask via `postMessage`.
     4. Simulate a setting change by executing:
        ```javascript
        window.postMessage(
          {
            type: 'subtitleStylerChanged',
            data: { fontColor: { newValue: 'red' } }, // Target setting to change
          },
          '*',
        );
        ```
     5. Use `browser_get_dom` to verify the CSS injection (e.g., check for injected `<style>` tags) or capture screenshots to verify the visual result.
