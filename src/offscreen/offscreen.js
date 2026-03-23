/**
 * offscreen.js — Offscreen document entry point.
 * Handles tasks that require a DOM context but cannot run in the service worker
 * (e.g. Firebase Authentication sign-in flows via signInWithPopup).
 */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'offscreen') return false;
  // Future: handle auth flows here
  sendResponse({ ok: true });
  return false;
});
