import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { StellarWalletsKit } from "@creit-tech/stellar-wallets-kit/sdk";
import { KitEventType } from "@creit-tech/stellar-wallets-kit/types";
import useDocumentTitle from "../lib/useDocumentTitle";
import {
  getAegisAdmin,
  getAegisPayoutAmount,
  setAegisPayoutAmount,
  upgradeAegisVault,
  sanitizeWalletAddress,
} from "../lib/contract";

function sanitizeAddress(raw) {
  if (typeof raw !== "string") return "";
  const addr = raw.trim();
  if (!/^G[A-Z2-7]{55}$/.test(addr)) return "";
  return addr;
}

export default function Admin() {
  useDocumentTitle("Admin");

  const [walletAddress, setWalletAddress] = useState("");
  const [contractAdmin, setContractAdmin] = useState(null);
  const [payoutAmount, setPayoutAmount] = useState(null);
  const [newPayout, setNewPayout] = useState("");
  const [wasmHash, setWasmHash] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");

  const isOwner =
    walletAddress &&
    contractAdmin &&
    walletAddress.trim() === contractAdmin.trim();

  useEffect(() => {
    let cancelled = false;
    async function sync() {
      try {
        const result = await StellarWalletsKit.getAddress();
        if (cancelled) return;
        if (result?.address) setWalletAddress(sanitizeAddress(result.address));
      } catch {}
    }
    sync();
    const off = StellarWalletsKit.on(KitEventType.STATE_UPDATED, (e) => {
      if (!cancelled) setWalletAddress(sanitizeAddress(e?.payload?.address));
    });
    const offDisc = StellarWalletsKit.on(KitEventType.DISCONNECT, () => {
      if (!cancelled) setWalletAddress("");
    });
    return () => {
      cancelled = true;
      off();
      offDisc();
    };
  }, []);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [admin, payout] = await Promise.all([
        getAegisAdmin(),
        getAegisPayoutAmount(),
      ]);
      setContractAdmin(admin);
      setPayoutAmount(payout);
    } catch (err) {
      setMessage("Failed to load admin data: " + err.message);
      setMessageType("error");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  async function handleConnectWallet() {
    try {
      const { address } = await StellarWalletsKit.authModal();
      const sanitized = sanitizeAddress(address);
      if (sanitized) setWalletAddress(sanitized);
    } catch {}
  }

  async function handleSetPayout() {
    const amt = Number(newPayout);
    if (!Number.isFinite(amt) || amt <= 0) {
      setMessage("Enter a valid positive amount.");
      setMessageType("error");
      return;
    }
    setActionLoading(true);
    setMessage("");
    try {
      const result = await setAegisPayoutAmount(
        walletAddress,
        amt,
        StellarWalletsKit,
      );
      setMessage(`Payout updated to ${amt}. TX: ${result.hash || "submitted"}`);
      setMessageType("success");
      setNewPayout("");
      const updated = await getAegisPayoutAmount();
      setPayoutAmount(updated);
    } catch (err) {
      setMessage("Failed to set payout: " + err.message);
      setMessageType("error");
    }
    setActionLoading(false);
  }

  async function handleUpgrade() {
    if (!wasmHash.trim()) {
      setMessage("Enter a valid WASM hash.");
      setMessageType("error");
      return;
    }
    setActionLoading(true);
    setMessage("");
    try {
      const result = await upgradeAegisVault(
        wasmHash.trim(),
        StellarWalletsKit,
      );
      setMessage(`Contract upgraded. TX: ${result.hash || "submitted"}`);
      setMessageType("success");
      setWasmHash("");
    } catch (err) {
      setMessage("Failed to upgrade: " + err.message);
      setMessageType("error");
    }
    setActionLoading(false);
  }

  const cardStyle = {
    background: "#1c2c24",
    borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.08)",
    padding: "24px",
    marginBottom: "16px",
  };

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "#F4ECDC",
    fontSize: "14px",
    fontFamily: "'Courier New', monospace",
    outline: "none",
  };

  const btnPrimary = {
    padding: "12px 20px",
    borderRadius: "10px",
    border: "none",
    background: actionLoading ? "rgba(115,87,255,0.4)" : "#7357FF",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 700,
    cursor: actionLoading ? "not-allowed" : "pointer",
    minHeight: "44px",
  };

  const btnDanger = {
    ...btnPrimary,
    background: actionLoading ? "rgba(255,122,107,0.4)" : "#FF7A6B",
  };

  if (!walletAddress) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0f1a16",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          fontFamily: "Inter, Helvetica Neue, sans-serif",
        }}
      >
        <Link
          to="/help"
          style={{
            position: "absolute",
            top: "20px",
            left: "20px",
            color: "#7fb8ba",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          ← Back to HelPhone
        </Link>
        <div style={{ textAlign: "center" }}>
          <h1
            style={{
              color: "#F4ECDC",
              fontFamily: "'Instrument Serif',serif",
              fontSize: "32px",
              fontWeight: 400,
              margin: "0 0 12px",
            }}
          >
            Admin Access
          </h1>
          <p
            style={{
              color: "rgba(242,236,220,0.5)",
              fontSize: "14px",
              marginBottom: "24px",
              maxWidth: "360px",
            }}
          >
            Connect your Stellar wallet to access the admin dashboard.
          </p>
          <button
            type="button"
            onClick={handleConnectWallet}
            style={{
              ...btnPrimary,
              fontSize: "15px",
              padding: "14px 32px",
            }}
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  if (!isOwner && !loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0f1a16",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          fontFamily: "Inter, Helvetica Neue, sans-serif",
        }}
      >
        <Link
          to="/help"
          style={{
            position: "absolute",
            top: "20px",
            left: "20px",
            color: "#7fb8ba",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          ← Back to HelPhone
        </Link>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "rgba(255,122,107,0.12)",
              border: "1px solid rgba(255,122,107,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              color: "#FF7A6B",
              fontSize: "28px",
            }}
          >
            🔒
          </div>
          <h1
            style={{
              color: "#F4ECDC",
              fontFamily: "'Instrument Serif',serif",
              fontSize: "28px",
              fontWeight: 400,
              margin: "0 0 8px",
            }}
          >
            Access Denied
          </h1>
          <p
            style={{
              color: "rgba(242,236,220,0.45)",
              fontSize: "13px",
              marginBottom: "8px",
            }}
          >
            Connected wallet:
          </p>
          <p
            style={{
              color: "#7fb8ba",
              fontSize: "12px",
              fontFamily: "'Courier New', monospace",
              marginBottom: "20px",
              wordBreak: "break-all",
            }}
          >
            {walletAddress}
          </p>
          {contractAdmin && (
            <>
              <p
                style={{
                  color: "rgba(242,236,220,0.45)",
                  fontSize: "13px",
                  marginBottom: "8px",
                }}
              >
                Contract owner:
              </p>
              <p
                style={{
                  color: "#FF7A6B",
                  fontSize: "12px",
                  fontFamily: "'Courier New', monospace",
                  marginBottom: "24px",
                  wordBreak: "break-all",
                }}
              >
                {contractAdmin}
              </p>
            </>
          )}
          <p
            style={{
              color: "rgba(242,236,220,0.35)",
              fontSize: "12px",
              maxWidth: "380px",
              lineHeight: 1.6,
            }}
          >
            Only the contract owner can access the admin dashboard. Connect the
            wallet that deployed the Aegis Vault contract.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f1a16",
        padding: "20px",
        fontFamily: "Inter, Helvetica Neue, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "680px",
          margin: "0 auto",
          paddingTop: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <Link
              to="/help"
              style={{
                color: "#7fb8ba",
                textDecoration: "none",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              ← HelPhone
            </Link>
            <h1
              style={{
                color: "#F4ECDC",
                fontFamily: "'Instrument Serif',serif",
                fontSize: "28px",
                fontWeight: 400,
                margin: "6px 0 0",
              }}
            >
              Admin Dashboard
            </h1>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#3F8487",
              }}
            />
            <span
              style={{
                fontSize: "11px",
                color: "#3F8487",
                fontWeight: 700,
                letterSpacing: "1px",
              }}
            >
              OWNER
            </span>
          </div>
        </div>

        {message && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "10px",
              marginBottom: "16px",
              fontSize: "13px",
              fontWeight: 600,
              background:
                messageType === "success"
                  ? "rgba(63,132,135,0.15)"
                  : messageType === "error"
                    ? "rgba(255,122,107,0.15)"
                    : "rgba(127,184,186,0.15)",
              color:
                messageType === "success"
                  ? "#3F8487"
                  : messageType === "error"
                    ? "#FF7A6B"
                    : "#7fb8ba",
              border: `1px solid ${
                messageType === "success"
                  ? "rgba(63,132,135,0.3)"
                  : messageType === "error"
                    ? "rgba(255,122,107,0.3)"
                    : "rgba(127,184,186,0.3)"
              }`,
            }}
          >
            {message}
          </div>
        )}

        {/* Contract Overview */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: "10px",
              letterSpacing: "1.5px",
              color: "#7fb8ba",
              fontWeight: 900,
              marginBottom: "16px",
            }}
          >
            CONTRACT OVERVIEW
          </div>
          {loading ? (
            <p style={{ color: "rgba(242,236,220,0.4)", fontSize: "13px" }}>
              Loading contract state...
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              <div
                style={{
                  padding: "12px",
                  borderRadius: "10px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  style={{
                    fontSize: "9px",
                    letterSpacing: "1px",
                    color: "rgba(242,236,220,0.35)",
                    marginBottom: "6px",
                  }}
                >
                  CONTRACT ADMIN
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#F4ECDC",
                    fontFamily: "'Courier New', monospace",
                    wordBreak: "break-all",
                  }}
                >
                  {contractAdmin
                    ? `${contractAdmin.slice(0, 12)}...${contractAdmin.slice(-6)}`
                    : "Not set"}
                </div>
              </div>
              <div
                style={{
                  padding: "12px",
                  borderRadius: "10px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  style={{
                    fontSize: "9px",
                    letterSpacing: "1px",
                    color: "rgba(242,236,220,0.35)",
                    marginBottom: "6px",
                  }}
                >
                  CURRENT PAYOUT
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#FF7A6B",
                    fontWeight: 700,
                  }}
                >
                  {payoutAmount != null
                    ? `${(payoutAmount / 10_000_000).toFixed(2)} USDC`
                    : "—"}
                </div>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={loadAdminData}
            style={{
              marginTop: "12px",
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(242,236,220,0.6)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>

        {/* Update Payout Amount */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: "10px",
              letterSpacing: "1.5px",
              color: "#7fb8ba",
              fontWeight: 900,
              marginBottom: "16px",
            }}
          >
            UPDATE PAYOUT AMOUNT
          </div>
          <p
            style={{
              color: "rgba(242,236,220,0.45)",
              fontSize: "12px",
              lineHeight: 1.6,
              marginBottom: "14px",
            }}
          >
            Set the USDC amount each verified claimant receives per campaign.
            Current:{" "}
            <span style={{ color: "#FF7A6B", fontWeight: 700 }}>
              {payoutAmount != null
                ? `${(payoutAmount / 10_000_000).toFixed(2)}`
                : "—"}
            </span>{" "}
            USDC (base units: {payoutAmount ?? "—"}).
          </p>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="number"
              value={newPayout}
              onChange={(e) => setNewPayout(e.target.value)}
              placeholder="New payout (USDC)"
              min="0"
              step="0.01"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              type="button"
              onClick={handleSetPayout}
              disabled={actionLoading || !newPayout}
              style={btnPrimary}
            >
              {actionLoading ? "Updating..." : "Update"}
            </button>
          </div>
        </div>

        {/* Upgrade Contract WASM */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: "10px",
              letterSpacing: "1.5px",
              color: "#7fb8ba",
              fontWeight: 900,
              marginBottom: "16px",
            }}
          >
            UPGRADE CONTRACT VERIFICATION KEY
          </div>
          <p
            style={{
              color: "rgba(242,236,220,0.45)",
              fontSize: "12px",
              lineHeight: 1.6,
              marginBottom: "14px",
            }}
          >
            Replace the contract's WASM bytecode with a new version. The new
            WASM hash must be deployed on Stellar first. Existing storage
            (campaign balances, spent nullifiers) is preserved across upgrades.
          </p>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="text"
              value={wasmHash}
              onChange={(e) => setWasmHash(e.target.value)}
              placeholder="New WASM hash (hex)"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              type="button"
              onClick={handleUpgrade}
              disabled={actionLoading || !wasmHash.trim()}
              style={btnDanger}
            >
              {actionLoading ? "Upgrading..." : "Upgrade"}
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: "10px",
              letterSpacing: "1.5px",
              color: "#7fb8ba",
              fontWeight: 900,
              marginBottom: "16px",
            }}
          >
            QUICK ACTIONS
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
            }}
          >
            <Link
              to="/help"
              style={{
                padding: "14px",
                borderRadius: "10px",
                background: "rgba(115,87,255,0.1)",
                border: "1px solid rgba(115,87,255,0.25)",
                color: "#B3A6FF",
                fontSize: "13px",
                fontWeight: 700,
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              Open App
            </Link>
            <button
              type="button"
              onClick={handleConnectWallet}
              style={{
                padding: "14px",
                borderRadius: "10px",
                background: "rgba(63,132,135,0.1)",
                border: "1px solid rgba(63,132,135,0.25)",
                color: "#7fb8ba",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Reconnect Wallet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
