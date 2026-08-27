import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { StellarWalletsKit } from '@creit-tech/stellar-wallets-kit/sdk'
import { Networks, SwkAppDarkTheme } from '@creit-tech/stellar-wallets-kit/types'
import { defaultModules } from '@creit-tech/stellar-wallets-kit/modules/utils'
import App from './App.jsx'
import Help from './pages/Help.jsx'
import Ranking from './pages/Ranking.jsx'
import Breadcrumb from './components/Breadcrumb.jsx'
import './App.css'

const WALLET_ICON_PATHS = {
  albedo: "/assets/wallets/albedo.png",
  freighter: "/assets/wallets/freighter.png",
  fordefi: "/assets/wallets/fordefi.png",
  rabet: "/assets/wallets/rabet.png",
  xbull: "/assets/wallets/xbull.png",
  lobstr: "/assets/wallets/lobstr.png",
  hana: "/assets/wallets/hana.png",
  klever: "/assets/wallets/klever.png",
  onekey: "/assets/wallets/onekey.png",
  BitgetWallet: "/assets/wallets/bitget.png",
  cactuslink: "/assets/wallets/cactuslink.png",
};

function helphoneWalletModules() {
  return defaultModules().map((module) => {
    const iconPath = WALLET_ICON_PATHS[module.productId];
    if (iconPath) module.productIcon = iconPath;
    return module;
  });
}

// Issue #102 — move focus to the main heading after route transitions
function RouteChangeTracker() {
  const { pathname } = useLocation();
  useEffect(() => {
    const heading = document.querySelector("h1");
    if (heading) {
      if (!heading.hasAttribute("tabindex")) {
        heading.setAttribute("tabindex", "-1");
      }
      heading.focus({ preventScroll: true });
    }
  }, [pathname]);
  return null;
}

StellarWalletsKit.init({
  modules: helphoneWalletModules(),
  network: Networks.TESTNET,
  theme: {
    ...SwkAppDarkTheme,
    background: "#1c2c24",
    "background-secondary": "#234B4E",
    "foreground-strong": "#F4ECDC",
    foreground: "rgba(242,236,220,0.9)",
    "foreground-secondary": "rgba(242,236,220,0.62)",
    primary: "#7357FF",
    "primary-foreground": "#ffffff",
    border: "rgba(255,255,255,0.12)",
    shadow: "0 24px 72px rgba(0,0,0,0.58)",
    "border-radius": "0.875rem",
    "font-family": "Inter, Helvetica Neue, sans-serif",
  },
  authModal: {
    showInstallLabel: true,
    hideUnsupportedWallets: false,
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Breadcrumb />
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/help" element={<Help />} />
        <Route path="/ranking" element={<Ranking />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/vault" element={<VaultDashboard />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
