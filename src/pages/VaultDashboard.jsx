import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { StellarWalletsKit } from "@creit-tech/stellar-wallets-kit/sdk";
import { KitEventType } from "@creit-tech/stellar-wallets-kit/types";
import useDocumentTitle from "../lib/useDocumentTitle";
import {
  getAegisCampaignBalance,
  getAegisPayoutAmount,
  getAegisIsClaimed,
  claimAid,
  fundZone,
  sanitizeWalletAddress,
  buildLocationProofZone,
} from "../lib/contract";
import {
  generateLocationProof,
  buildHumanityPublicInputsBytes,
} from "../lib/zk";

function sanitizeAddress(raw) {
  if (typeof raw !== "string") return "";
  const addr = raw.trim();
  if (!/^G[A-Z2-7]{55}$/.test(addr)) return "";
  return addr;
}

function CampaignCard({
  campaignId,
  balance,
  payoutAmount,
  isClaimed,
  onContribute,
  contributing,
}) {
  const [contributeAmount, setContributeAmount] = useState("");
  const balanceFormatted =
    balance != null ? (balance / 10_000_000).toFixed(2) : "—";
  const payoutFormatted =
    payoutAmount != null ? (payoutAmount / 10_000_000).toFixed(2) : "—";
  const remainingClaims =
    payoutAmount > 0 && balance != null
      ? Math.floor(balance / payoutAmount)
      : 0;

  return (
    <div
      style={{
        background: "#1c2c24",
        borderRadius: "16px",
        border: "1px solid rgba(255,255,255,0.08)",
        padding: "20px",
        marginBottom: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "14px",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "10px",
              letterSpacing: "1.2px",
              color: "#7fb8ba",
              fontWeight: 900,
              marginBottom: "4px",
            }}
          >
            CAMPAIGN
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "#F4ECDC",
              fontFamily: "'Courier New', monospace",
              wordBreak: "break-all",
            }}
          >
            {campaignId.length > 20
              ? `${campaignId.slice(0, 10)}...${campaignId.slice(-8)}`
              : campaignId}
          </div>
        </div>
        <div
          style={{
            padding: "4px 10px",
            borderRadius: "999px",
            background: isClaimed
              ? "rgba(255,122,107,0.15)"
              : remainingClaims > 0
                ? "rgba(63,132,135,0.15)"
                : "rgba(162,165,134,0.15)",
            border: `1px solid ${
              isClaimed
                ? "rgba(255,122,107,0.3)"
                : remainingClaims > 0
                  ? "rgba(63,132,135,0.3)"
                  : "rgba(162,165,134,0.3)"
            }`,
            fontSize: "10px",
            fontWeight: 700,
            color: isClaimed
              ? "#FF7A6B"
              : remainingClaims > 0
                ? "#3F8487"
                : "#a2a586",
          }}
        >
          {isClaimed ? "CLAIMED" : remainingClaims > 0 ? "ACTIVE" : "EMPTY"}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "8px",
          marginBottom: "14px",
        }}
      >
        <div
          style={{
            padding: "10px",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              fontSize: "9px",
              letterSpacing: "1px",
              color: "rgba(242,236,220,0.35)",
              marginBottom: "4px",
            }}
          >
            BALANCE
          </div>
          <div style={{ fontSize: "13px", color: "#F4ECDC", fontWeight: 700 }}>
            {balanceFormatted} USDC
          </div>
        </div>
        <div
          style={{
            padding: "10px",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              fontSize: "9px",
              letterSpacing: "1px",
              color: "rgba(242,236,220,0.35)",
              marginBottom: "4px",
            }}
          >
            PER CLAIM
          </div>
          <div style={{ fontSize: "13px", color: "#FF7A6B", fontWeight: 700 }}>
            {payoutFormatted} USDC
          </div>
        </div>
        <div
          style={{
            padding: "10px",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              fontSize: "9px",
              letterSpacing: "1px",
              color: "rgba(242,236,220,0.35)",
              marginBottom: "4px",
            }}
          >
            CLAIMS LEFT
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "#7357FF",
              fontWeight: 700,
            }}
          >
            {remainingClaims}
          </div>
        </div>
      </div>

      {/* Contribute funds */}
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          type="number"
          value={contributeAmount}
          onChange={(e) => setContributeAmount(e.target.value)}
          placeholder="Amount (USDC)"
          min="0"
          step="1"
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.05)",
            color: "#F4ECDC",
            fontSize: "13px",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={() => {
            const amt = Number(contributeAmount);
            if (amt > 0) {
              onContribute(campaignId, amt);
              setContributeAmount("");
            }
          }}
          disabled={
            contributing || !contributeAmount || Number(contributeAmount) <= 0
          }
          style={{
            padding: "10px 16px",
            borderRadius: "8px",
            border: "none",
            background:
              contributing || !contributeAmount || Number(contributeAmount) <= 0
                ? "rgba(115,87,255,0.3)"
                : "#7357FF",
            color: "#fff",
            fontSize: "12px",
            fontWeight: 700,
            cursor:
              contributing || !contributeAmount || Number(contributeAmount) <= 0
                ? "not-allowed"
                : "pointer",
          }}
        >
          {contributing ? "..." : "Fund"}
        </button>
      </div>
    </div>
  );
}

export default function VaultDashboard() {
  useDocumentTitle("Aegis Vault");

  const [walletAddress, setWalletAddress] = useState("");
  const [searchId, setSearchId] = useState("");
  const [campaigns, setCampaigns] = useState({});
  const [payoutAmount, setPayoutAmount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [contributing, setContributing] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");

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

  const loadPayout = useCallback(async () => {
    try {
      const payout = await getAegisPayoutAmount();
      setPayoutAmount(payout);
    } catch {}
  }, []);

  useEffect(() => {
    loadPayout();
    setLoading(false);
  }, [loadPayout]);

  async function handleConnectWallet() {
    try {
      const { address } = await StellarWalletsKit.authModal();
      const sanitized = sanitizeAddress(address);
      if (sanitized) setWalletAddress(sanitized);
    } catch {}
  }

  async function lookupCampaign() {
    const id = searchId.trim();
    if (!id) return;
    setLoading(true);
    setMessage("");
    try {
      const balance = await getAegisCampaignBalance(id);
      setCampaigns((prev) => ({
        ...prev,
        [id]: { balance, loaded: true },
      }));
    } catch (err) {
      setMessage("Campaign lookup failed: " + err.message);
      setMessageType("error");
    }
    setLoading(false);
  }

  async function handleContribute(campaignId, amountUSDC) {
    if (!walletAddress) {
      setMessage("Connect your wallet first.");
      setMessageType("error");
      return;
    }
    setContributing(true);
    setMessage("");
    try {
      // Build a minimal public_inputs_prefix for the campaign
      // Format: box_x_min(32) | box_x_max(32) | box_y_min(32) | box_y_max(32) | campaign_id(32) = 160 bytes
      const campaignIdBytes = new Uint8Array(32);
      const idNum = BigInt(
        campaignId.length <= 19 ? campaignId : campaignId.slice(0, 19),
      );
      const idHex = idNum.toString(16).padStart(64, "0");
      for (let i = 0; i < 32; i++) {
        campaignIdBytes[i] = parseInt(idHex.slice(i * 2, i * 2 + 2), 16);
      }

      // Use zero zone bounds (will be validated on-chain against stored zone)
      const prefix = new Uint8Array(160);
      prefix.set(campaignIdBytes, 128);

      const stroops = BigInt(Math.round(amountUSDC * 10_000_000));
      await fundZone(prefix, stroops, StellarWalletsKit);

      setMessage(
        `Funded campaign ${campaignId.slice(0, 12)}... with ${amountUSDC} USDC`,
      );
      setMessageType("success");

      // Refresh balance
      const newBalance = await getAegisCampaignBalance(campaignId);
      setCampaigns((prev) => ({
        ...prev,
        [campaignId]: { balance: newBalance, loaded: true },
      }));
    } catch (err) {
      setMessage("Contribution failed: " + err.message);
      setMessageType("error");
    }
    setContributing(false);
  }

  const cardStyle = {
    background: "#1c2c24",
    borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.08)",
    padding: "24px",
    marginBottom: "16px",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f1a16",
        padding: "20px",
        fontFamily: "Inter, Helvetica Neue, sans-serif",
      }}
    >
      <div style={{ maxWidth: "680px", margin: "0 auto", paddingTop: "20px" }}>
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
              Aegis Vault
            </h1>
            <p
              style={{
                color: "rgba(242,236,220,0.4)",
                fontSize: "13px",
                margin: "4px 0 0",
              }}
            >
              Fund emergency aid campaigns and track claim progress
            </p>
          </div>
          <div>
            {walletAddress ? (
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
                    fontFamily: "'Courier New', monospace",
                  }}
                >
                  {walletAddress.slice(0, 8)}...
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnectWallet}
                style={{
                  padding: "10px 18px",
                  borderRadius: "10px",
                  border: "1px solid rgba(115,87,255,0.3)",
                  background: "rgba(115,87,255,0.1)",
                  color: "#B3A6FF",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Connect Wallet
              </button>
            )}
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
                  : "rgba(255,122,107,0.15)",
              color: messageType === "success" ? "#3F8487" : "#FF7A6B",
              border: `1px solid ${
                messageType === "success"
                  ? "rgba(63,132,135,0.3)"
                  : "rgba(255,122,107,0.3)"
              }`,
            }}
          >
            {message}
          </div>
        )}

        {/* Payout Info */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: "10px",
              letterSpacing: "1.5px",
              color: "#7fb8ba",
              fontWeight: 900,
              marginBottom: "12px",
            }}
          >
            VAULT STATUS
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
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
                  marginBottom: "4px",
                }}
              >
                PAYOUT PER CLAIM
              </div>
              <div
                style={{
                  fontSize: "15px",
                  color: "#FF7A6B",
                  fontWeight: 700,
                }}
              >
                {payoutAmount != null
                  ? `${(payoutAmount / 10_000_000).toFixed(2)} USDC`
                  : "—"}
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
                  marginBottom: "4px",
                }}
              >
                CAMPAIGNS TRACKED
              </div>
              <div
                style={{
                  fontSize: "15px",
                  color: "#7357FF",
                  fontWeight: 700,
                }}
              >
                {Object.keys(campaigns).length}
              </div>
            </div>
          </div>
        </div>

        {/* Campaign Lookup */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: "10px",
              letterSpacing: "1.5px",
              color: "#7fb8ba",
              fontWeight: 900,
              marginBottom: "12px",
            }}
          >
            LOOKUP CAMPAIGN
          </div>
          <p
            style={{
              color: "rgba(242,236,220,0.4)",
              fontSize: "12px",
              lineHeight: 1.6,
              marginBottom: "12px",
            }}
          >
            Enter a campaign ID to check its balance and claim status.
          </p>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") lookupCampaign();
              }}
              placeholder="Campaign ID"
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)",
                color: "#F4ECDC",
                fontSize: "13px",
                fontFamily: "'Courier New', monospace",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={lookupCampaign}
              disabled={loading || !searchId.trim()}
              style={{
                padding: "10px 18px",
                borderRadius: "8px",
                border: "none",
                background:
                  loading || !searchId.trim()
                    ? "rgba(115,87,255,0.3)"
                    : "#7357FF",
                color: "#fff",
                fontSize: "13px",
                fontWeight: 700,
                cursor: loading || !searchId.trim() ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "..." : "Look Up"}
            </button>
          </div>
        </div>

        {/* Campaign List */}
        {Object.keys(campaigns).length > 0 && (
          <div>
            <div
              style={{
                fontSize: "10px",
                letterSpacing: "1.5px",
                color: "#7fb8ba",
                fontWeight: 900,
                marginBottom: "12px",
              }}
            >
              CAMPAIGNS ({Object.keys(campaigns).length})
            </div>
            {Object.entries(campaigns).map(([id, data]) => (
              <CampaignCard
                key={id}
                campaignId={id}
                balance={data.balance}
                payoutAmount={payoutAmount}
                isClaimed={false}
                onContribute={handleContribute}
                contributing={contributing}
              />
            ))}
          </div>
        )}

        {Object.keys(campaigns).length === 0 && !loading && (
          <div
            style={{
              ...cardStyle,
              textAlign: "center",
              padding: "40px 24px",
            }}
          >
            <div
              style={{
                fontSize: "40px",
                marginBottom: "12px",
                opacity: 0.3,
              }}
            >
              🛡️
            </div>
            <p
              style={{
                color: "rgba(242,236,220,0.4)",
                fontSize: "13px",
                lineHeight: 1.6,
              }}
            >
              No campaigns loaded yet. Use the lookup above to find a campaign
              by its ID, or check the Help page to fund a zone.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
