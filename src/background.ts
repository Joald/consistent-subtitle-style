/* eslint-disable */
/**
 * Background script for development and extension management.
 * In development, this script can facilitate auto-reloading.
 */

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

// For development: listen for a signal from a local server if needed
// This part is optional but useful for agentic workflows
// (Future: Add WebSocket listener here)
