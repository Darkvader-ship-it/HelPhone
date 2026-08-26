import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getRanking } from "../lib/contract";
import useDocumentTitle from "../lib/useDocumentTitle";

const PERIODS = Object.freeze(["This Week", "This Month", "All Time"]);

const MEDALS = Object.freeze(["🥇", "🥈", "🥉"]);

const SKELETON_KEYFRAMES = `
@keyframes hp-shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
}
`;

function SkeletonRow() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "48px 1fr 100px",
        padding: "16px 20px",
        borderBottom: "1px solid #f0e8d8",
        alignItems: "center",
        background: "#fff",
      }}
    >
      <div
        style={{
          width: "24px",
          height: "18px",
          borderRadius: "4px",
          background:
            "linear-gradient(90deg, #eee 0px, #e0e0e0 40px, #eee 80px)",
          backgroundSize: "200px 100%",
          animation: "hp-shimmer 1.6s ease-in-out infinite",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background:
              "linear-gradient(90deg, #eee 0px, #e0e0e0 40px, #eee 80px)",
            backgroundSize: "200px 100%",
            animation: "hp-shimmer 1.6s ease-in-out infinite",
            flexShrink: 0,
          }}
        />
        <div
          style={{
            width: "100px",
            height: "14px",
            borderRadius: "4px",
            background:
              "linear-gradient(90deg, #eee 0px, #e0e0e0 40px, #eee 80px)",
            backgroundSize: "200px 100%",
            animation: "hp-shimmer 1.6s ease-in-out infinite",
          }}
        />
      </div>
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            display: "inline-block",
            width: "40px",
            height: "24px",
            borderRadius: "12px",
            background:
              "linear-gradient(90deg, #eee 0px, #e0e0e0 40px, #eee 80px)",
            backgroundSize: "200px 100%",
            animation: "hp-shimmer 1.6s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}

export default function Ranking() {
  useDocumentTitle("Ranking");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("All Time");

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        const entries = await getRanking(50, period);
        if (ignore) return;
        const valid = Array.isArray(entries)
          ? entries.filter(
              (e) =>
                e &&
                typeof e.responder === "string" &&
                Number.isFinite(e.total_arrivals),
            )
          : [];
        const sorted = valid
          .sort((a, b) => b.total_arrivals - a.total_arrivals)
          .slice(0, 20);
        setRows(sorted);
      } catch {
        if (!ignore) setRows([]);
      }
      if (!ignore) setLoading(false);
    }
    load();
    return () => {
      ignore = true;
    };
  }, [period]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#ECE0CC",
        fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      }}
    >
      {/* Nav */}
      <nav
        role="navigation"
        aria-label="Primary"
        style={{
          background: "#234B4E",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          gap: "24px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
        }}
      >
        <Link
          to="/"
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: "20px",
            textDecoration: "none",
            display: "flex",
          }}
        >
          <span style={{ color: "#F4ECDC", fontStyle: "italic" }}>Hel</span>
          <span style={{ color: "#a2a586" }}>Phone</span>
        </Link>
        <Link
          to="/"
          style={{
            fontSize: "13px",
            color: "rgba(242,236,220,0.6)",
            textDecoration: "none",
          }}
        >
          ← Back to home
        </Link>
      </nav>

      {/* Content */}
      <main
        style={{
          maxWidth: "860px",
          margin: "0 auto",
          padding: "60px 24px 80px",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "40px" }}>
          <div
            style={{
              fontSize: "11px",
              letterSpacing: "3px",
              fontWeight: "600",
              color: "#3F8487",
              marginBottom: "12px",
            }}
          >
            HELPHONE NETWORK
          </div>
          <h1
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontWeight: 400,
              color: "#234B4E",
              fontSize: "clamp(36px, 6vw, 64px)",
              lineHeight: 1.05,
              margin: "0 0 8px",
            }}
          >
            Community Responders
          </h1>
          <p style={{ fontSize: "16px", color: "#7a7264", margin: 0 }}>
            The people who show up when it matters.
          </p>
        </div>

        {/* Period tabs */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "32px" }}>
          {Array.isArray(PERIODS) &&
            PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: "8px 18px",
                  borderRadius: "20px",
                  border: `1.5px solid ${period === p ? "#3F8487" : "rgba(35,75,78,0.2)"}`,
                  background: period === p ? "#3F8487" : "transparent",
                  color: period === p ? "#fff" : "#234B4E",
                  fontSize: "13px",
                  fontWeight: "500",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {p}
              </button>
            ))}
        </div>

        {/* Table */}
        {loading ? (
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow: "0 4px 24px rgba(35,75,78,0.08)",
            }}
          >
            <style>{SKELETON_KEYFRAMES}</style>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "48px 1fr 100px",
                padding: "14px 20px",
                borderBottom: "1px solid #e8e0d0",
                fontSize: "11px",
                letterSpacing: "1.5px",
                fontWeight: "600",
                color: "#a2a586",
              }}
            >
              <span>#</span>
              <span>RESPONDER</span>
              <span style={{ textAlign: "center" }}>ARRIVALS</span>
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              padding: "48px 24px",
              textAlign: "center",
              boxShadow: "0 4px 24px rgba(35,75,78,0.08)",
            }}
          >
            <svg
              width="64"
              height="64"
              viewBox="0 0 64 64"
              fill="none"
              style={{ margin: "0 auto 16px" }}
            >
              <circle cx="32" cy="32" r="30" stroke="#ECE0CC" strokeWidth="2" />
              <circle cx="22" cy="26" r="5" fill="#3F8487" opacity="0.3" />
              <circle cx="42" cy="26" r="5" fill="#3F8487" opacity="0.3" />
              <circle cx="32" cy="40" r="5" fill="#3F8487" opacity="0.3" />
              <path
                d="M22 26L32 40L42 26"
                stroke="#3F8487"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                opacity="0.4"
              />
            </svg>
            <p
              style={{
                fontSize: "15px",
                fontWeight: "600",
                color: "#234B4E",
                margin: "0 0 6px",
              }}
            >
              No responders yet
            </p>
            <p style={{ fontSize: "13px", color: "#a2a586", margin: 0 }}>
              When someone responds to an emergency, they'll appear here.
            </p>
          </div>
        ) : (
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow: "0 4px 24px rgba(35,75,78,0.08)",
            }}
          >
            {/* Header row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "48px 1fr 100px",
                padding: "14px 20px",
                borderBottom: "1px solid #e8e0d0",
                fontSize: "11px",
                letterSpacing: "1.5px",
                fontWeight: "600",
                color: "#a2a586",
              }}
            >
              <span>#</span>
              <span>RESPONDER</span>
              <span style={{ textAlign: "center" }}>ARRIVALS</span>
            </div>

            {rows.map((row, i) => (
              <div
                key={row.responder}
                style={{
                  display: "grid",
                  gridTemplateColumns: "48px 1fr 100px",
                  padding: "16px 20px",
                  borderBottom:
                    i < rows.length - 1 ? "1px solid #f0e8d8" : "none",
                  alignItems: "center",
                  background: i % 2 === 0 ? "#fff" : "#fdfaf5",
                }}
              >
                {/* Rank */}
                <span
                  style={{
                    fontWeight: "700",
                    fontSize: "18px",
                    color: i < MEDALS.length ? "#3F8487" : "#a2a586",
                  }}
                >
                  {i < MEDALS.length ? MEDALS[i] : `${i + 1}`}
                </span>

                {/* Address */}
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: i < 3 ? "#3F8487" : "#ECE0CC",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      fontWeight: "700",
                      color: i < 3 ? "#fff" : "#234B4E",
                      flexShrink: 0,
                      fontFamily: "'Courier New', monospace",
                    }}
                  >
                    {row.responder[7]?.toUpperCase() || "?"}
                  </div>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: "500",
                      color: "#234B4E",
                      fontFamily: "'Courier New', monospace",
                      letterSpacing: "-0.3px",
                    }}
                  >
                    {row.responder.slice(0, 8)}…{row.responder.slice(-4)}
                  </span>
                </div>

                {/* Arrivals */}
                <div style={{ textAlign: "center" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "4px 10px",
                      borderRadius: "12px",
                      background: "#FF7A6B22",
                      color: "#FF7A6B",
                      fontSize: "13px",
                      fontWeight: "600",
                    }}
                  >
                    {row.total_arrivals}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <p
          style={{
            fontSize: "12px",
            color: "#a2a586",
            marginTop: "24px",
            textAlign: "center",
          }}
        >
          On-chain leaderboard · {rows.length} responders
        </p>
      </main>
    </div>
  );
}
