import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getRanking } from "../lib/contract";
import type { RankingEntry } from "../types/index";

const PERIODS = Object.freeze(["This Week", "This Month", "All Time"]);

const MEDALS = Object.freeze(["🥇", "🥈", "🥉"]);

export default function Ranking() {
  const [rows, setRows] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("All Time");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const entries = await getRanking();
        const sorted = entries
          .sort((a, b) => b.total_arrivals - a.total_arrivals)
          .slice(0, 20);
        setRows(sorted);
      } catch {
        setRows([]);
      }
      setLoading(false);
    }
    load();
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
      <div
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
          <p style={{ color: "#a2a586", fontSize: "15px" }}>Loading…</p>
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
      </div>
    </div>
  );
}
