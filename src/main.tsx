import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletProvider } from "./contexts/WalletContext";
import { i18nReady } from "./i18n";
import App from "./App";
import Help from "./pages/Help";
import Ranking from "./pages/Ranking";
import "./App.css";

function render() {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      {/*
        WalletProvider wraps the entire app so that any page can access
        wallet state via useWallet() without prop-drilling.
        StellarWalletsKit.init() is called inside WalletProvider's useEffect,
        replacing the previous global side-effect at module load time.
      */}
      <WalletProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/help" element={<Help />} />
            <Route path="/ranking" element={<Ranking />} />
          </Routes>
        </BrowserRouter>
      </WalletProvider>
    </React.StrictMode>,
  );
}

// Wait for translation bundles to load before first render so the page
// never flashes untranslated keys.
i18nReady.then(render).catch(() => {
  // Translation load failed (e.g. offline) — render anyway with fallback keys.
  render();
});
