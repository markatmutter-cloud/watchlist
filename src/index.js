import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Service worker — handles fresh-bundle delivery so iOS PWA users
// don't get stuck on old JS for hours/days after a deploy. See
// public/service-worker.js for the caching strategy. Auto-reloads
// the page when a new SW takes over so new code lands without the
// user having to remove + re-add the home-screen shortcut.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(err => {
      // Soft-fail: SW is an enhancement, not a requirement.
      // eslint-disable-next-line no-console
      console.warn("SW register failed", err);
    });
    let firstControllerSet = !navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // First load gets a "controllerchange" too because there was no
      // controller to begin with — skip that one. Subsequent changes
      // (new SW activated mid-session) trigger a one-shot reload so the
      // new bundle is in effect immediately.
      if (firstControllerSet) { firstControllerSet = false; return; }
      window.location.reload();
    });
  });
}
