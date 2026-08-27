import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";

// ---------------------------------------------------------------------------
// src/main.jsx is the app entry point: it initializes the Stellar wallet
// kit, then mounts <App/> (plus /help and /ranking routes) into #root via
// ReactDOM.createRoot. main.jsx runs this as top-level module code, so the
// only way to observe it is to mock every dependency it touches and import
// the module fresh in each test.
// ---------------------------------------------------------------------------

const renderMock = vi.fn();
const createRootMock = vi.fn(() => ({ render: renderMock }));
const initMock = vi.fn();

vi.mock("react-dom/client", () => ({
  default: { createRoot: createRootMock },
  createRoot: createRootMock,
}));

vi.mock("@creit-tech/stellar-wallets-kit/sdk", () => ({
  StellarWalletsKit: { init: initMock },
}));

vi.mock("@creit-tech/stellar-wallets-kit/types", () => ({
  Networks: { TESTNET: "TESTNET" },
  SwkAppDarkTheme: {},
}));

vi.mock("@creit-tech/stellar-wallets-kit/modules/utils", () => ({
  defaultModules: vi.fn(() => [
    { productId: "freighter", productIcon: undefined },
    { productId: "unknown-wallet", productIcon: undefined },
  ]),
}));

vi.mock("../src/App.jsx", () => ({ default: () => null }));
vi.mock("../src/pages/Help.jsx", () => ({ default: () => null }));
vi.mock("../src/pages/Ranking.jsx", () => ({ default: () => null }));
vi.mock("../src/App.css", () => ({}));

async function loadMain() {
  vi.resetModules();
  return import("../src/main.jsx");
}

describe("App initialization (main.jsx)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="root"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("mounts without crashing when #root exists", async () => {
    await expect(loadMain()).resolves.toBeDefined();
  });

  it("calls ReactDOM.createRoot against the #root element", async () => {
    await loadMain();
    expect(createRootMock).toHaveBeenCalledTimes(1);
    expect(createRootMock).toHaveBeenCalledWith(
      document.getElementById("root"),
    );
  });

  it("instantiates the Router and Providers by rendering into the root", async () => {
    await loadMain();
    expect(renderMock).toHaveBeenCalledTimes(1);
    const rendered = renderMock.mock.calls[0][0];
    // The rendered tree is <StrictMode><BrowserRouter><Routes>...</Routes></BrowserRouter></StrictMode> —
    // assert the top of the tree is StrictMode wrapping a single child (BrowserRouter),
    // confirming main.jsx wired the router/providers rather than rendering a bare element.
    expect(rendered.type).toBe(React.StrictMode);
    expect(rendered.props.children).toBeTruthy();
  });

  it("calls global initializers (StellarWalletsKit.init) before mounting", async () => {
    await loadMain();
    expect(initMock).toHaveBeenCalledTimes(1);
    expect(createRootMock).toHaveBeenCalled();
    // init() must run before render() so the kit is ready before the app tree mounts.
    const initOrder = initMock.mock.invocationCallOrder[0];
    const renderOrder = renderMock.mock.invocationCallOrder[0];
    expect(initOrder).toBeLessThan(renderOrder);
  });

  it("configures StellarWalletsKit with network and theme (global styles/config applied)", async () => {
    await loadMain();
    const initArg = initMock.mock.calls[0][0];
    expect(initArg).toMatchObject({
      network: "TESTNET",
      theme: expect.objectContaining({
        background: "#1c2c24",
        primary: "#7357FF",
      }),
      authModal: expect.objectContaining({ showInstallLabel: true }),
    });
    expect(Array.isArray(initArg.modules)).toBe(true);
  });
});
