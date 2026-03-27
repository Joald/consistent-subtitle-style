/* eslint-disable */
/**
 * Background script for development and extension management.
 * In development, this script can facilitate auto-reloading.
 */

// Ensure content scripts are injected into cross-origin iframes (e.g. embed.vhx.tv
// on Dropout). Manifest-declared content_scripts with all_frames:true can miss
// dynamically-added cross-origin iframes in MV3; programmatic registration is
// more reliable for these cases.
chrome.scripting
  .registerContentScripts([
    {
      id: 'injection-cross-origin-frames',
      matches: ['*://embed.vhx.tv/*', '*://*.vhx.tv/*'],
      js: ['injection.js'],
      runAt: 'document_idle',
      allFrames: true,
    },
  ])
  .catch((err: unknown) => {
    // Script already registered (e.g. after service worker restart) — ignore.
    if (err instanceof Error && err.message.includes('already registered')) return;
    console.warn('[CSS-STYL] Failed to register cross-origin frame scripts:', err);
  });

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'reload_extension') {
    console.log('Reloading extension...');
    chrome.runtime.reload();
  }
  if (message.action === 'ping') {
    sendResponse({ status: 'ok' });
  }
  return true;
});
