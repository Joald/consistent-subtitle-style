import { execSync } from 'child_process';

/**
 * This script is used by Antigravity to signal that the extension should be reloaded.
 * Since we have a stable extension ID (fdhobonfeacceokemphmkngikeeakbok),
 * we can technically use chrome.runtime.reload() in a background script
 * if we have a way to trigger it.
 */

console.log('Signal-reload: Extension files have been updated.');
console.log('Tip: The browser agent can now refresh live pages to test the new build.');
