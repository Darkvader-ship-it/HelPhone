import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import useDocumentTitle from "./lib/useDocumentTitle";

export default function App() {
  useDocumentTitle("Landing");
  const videoRef = useRef(null);
  const revealIdxRef = useRef(0);
  const [visibleElements, setVisibleElements] = useState(new Set());

  useEffect(() => {
    const elements = document.querySelectorAll("[data-reveal]");
    const vh = window.innerHeight || 800;

    // Initially show elements above the fold
    elements.forEach((el, idx) => {
      const rect = el.getBoundingClientRect();
      if (rect.top <= vh * 0.85) {
        setVisibleElements((prev) => new Set([...prev, idx]));
      }
    });

    // Intersection Observer for scroll reveals
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Array.from(elements).indexOf(entry.target);
            setVisibleElements((prev) => new Set([...prev, idx]));
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -7% 0px" },
    );

    elements.forEach((el) => observer.observe(el));

    // Fallback timeout
    const timeout = setTimeout(() => {
      setVisibleElements(
        (prev) => new Set(Array.from({ length: elements.length }, (_, i) => i)),
      );
    }, 4500);

    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, []);

  // Video looping logic
  useEffect(() => {
    if (!videoRef.current) return;

    const v = videoRef.current;
    let reversing = false;
    let last = 0;
    let rafId = null;

    const reverse = (t) => {
      if (!reversing) return;
      if (!last) last = t;
      const dt = (t - last) / 1000;
      last = t;
      const nt = v.currentTime - dt;
      if (nt <= 0) {
        try {
          v.currentTime = 0;
        } catch (e) {}
        reversing = false;
        last = 0;
        v.play().catch(() => {});
        return;
      }
      try {
        v.currentTime = nt;
      } catch (e) {}
      rafId = requestAnimationFrame(reverse);
    };

    const onEnded = () => {
      reversing = true;
      last = 0;
      v.pause();
      rafId = requestAnimationFrame(reverse);
    };

    v.addEventListener("ended", onEnded);

    const tryPlay = () => {
      v.play().catch(() => {});
    };
    if (v.readyState >= 2) tryPlay();
    else v.addEventListener("canplay", tryPlay, { once: true });

    return () => {
      v.removeEventListener("ended", onEnded);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Reset the reveal counter at the start of render
  revealIdxRef.current = 0;

  // Helper function to get next index
  const getNextRevealIdx = () => revealIdxRef.current++;

  const RevealDiv = ({ children, index, ...props }) => {
    const isVisible = visibleElements.has(index);
    return (
      <div
        data-reveal
        {...props}
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "none" : "translateY(30px)",
          transition:
            "opacity 1.05s cubic-bezier(0.22, 0.75, 0.2, 1), transform 1.05s cubic-bezier(0.22, 0.75, 0.2, 1)",
          ...props.style,
        }}
      >
        {children}
      </div>
    );
  };

  return (
    <div
      style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        color: "#2A2620",
        background: "#ECE0CC",
        overflowX: "hidden",
      }}
    >
      <a href="#main-content" className="skip-link">
        Skip to Content
      </a>
      {/* NAVBAR */}
      <nav
        style={{
          position: "fixed",
          top: "18px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 60,
          width: "min(1160px, calc(100% - 32px))",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px 10px 22px",
          borderRadius: "16px",
          background: "rgba(18, 28, 20, 0.68)",
          backdropFilter: "blur(28px) saturate(1.4)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
        }}
      >
        <a
          href="#top"
          style={{
            display: "flex",
            alignItems: "center",
            textDecoration: "none",
            gap: "1px",
          }}
        >
          <span
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontSize: "21px",
              letterSpacing: "0.2px",
              color: "#F4ECDC",
              fontStyle: "italic",
            }}
          >
            Hel
          </span>
          <span
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontSize: "21px",
              letterSpacing: "0.2px",
              color: "#a2a586",
            }}
          >
            Phone
          </span>
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {[
            { href: "#how", label: "How it works" },
            { href: "#trust", label: "Trust & Safety" },
            { href: "#coverage", label: "Coverage" },
            { to: "/ranking", label: "Ranking", internal: true },
          ].map((link) =>
            link.internal ? (
              <Link
                key={link.label}
                to={link.to}
                style={{
                  textDecoration: "none",
                  color: "rgba(242, 236, 220, 0.65)",
                  fontSize: "13.5px",
                  fontWeight: "500",
                  padding: "7px 12px",
                  borderRadius: "8px",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "rgba(255,255,255,0.06)";
                  e.target.style.color = "rgba(242,236,220,0.9)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "transparent";
                  e.target.style.color = "rgba(242,236,220,0.65)";
                }}
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.label}
                href={link.href}
                style={{
                  textDecoration: "none",
                  color: "rgba(242, 236, 220, 0.65)",
                  fontSize: "13.5px",
                  fontWeight: "500",
                  padding: "7px 12px",
                  borderRadius: "8px",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "rgba(255,255,255,0.06)";
                  e.target.style.color = "rgba(242,236,220,0.9)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "transparent";
                  e.target.style.color = "rgba(242,236,220,0.65)";
                }}
              >
                {link.label}
              </a>
            ),
          )}
          <Link
            to="/help"
            style={{
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              color: "#fff",
              fontWeight: "600",
              fontSize: "13.5px",
              padding: "8px 16px",
              borderRadius: "10px",
              background: "#FF7A6B",
              marginLeft: "6px",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "#ff6b5a";
              e.target.style.boxShadow = "0 4px 16px rgba(255,122,107,0.4)";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "#FF7A6B";
              e.target.style.boxShadow = "none";
            }}
          >
            Request Help
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <header
        id="top"
        style={{
          position: "relative",
          minHeight: "100vh",
          display: "flex",
          alignItems: "flex-end",
          overflow: "hidden",
          background: "#1c2c24",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          preload="auto"
          poster="/assets/hero-poster.png"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 58%",
            zIndex: 0,
            filter: "brightness(2.4) contrast(1.08) saturate(1.12)",
          }}
        >
          <source src="/assets/hero-nokia.mp4" type="video/mp4" />
        </video>
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            background:
              "linear-gradient(90deg, rgba(12, 18, 10, 0.72) 0%, rgba(12, 18, 10, 0.3) 50%, rgba(12, 18, 10, 0.18) 100%)",
          }}
        ></div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            background:
              "linear-gradient(0deg, rgba(12, 18, 10, 0.8) 0%, rgba(12, 18, 10, 0.06) 44%, rgba(12, 18, 10, 0.2) 100%)",
          }}
        >
          <div
            style={{
              position: "absolute",
              zIndex: 3,
              width: "min(1180px, calc(100% - 40px))",
              margin: "0 auto",
              padding: "0 0 88px",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: "40px",
              left: "62px",
              top: "230px",
            }}
          >
            <div style={{ maxWidth: "660px" }}>
              <h1
                style={{
                  fontFamily: "'Instrument Serif', serif",
                  fontWeight: 400,
                  color: "#F4ECDC",
                  fontSize: "clamp(54px, 9.5vw, 138px)",
                  lineHeight: 0.93,
                  letterSpacing: "-0.8px",
                  margin: "0 0 28px",
                  textShadow: "0 4px 40px rgba(0, 0, 0, 0.4)",
                }}
              >
                Help arrives
                <br />
                through people.
              </h1>
              <p
                style={{
                  fontSize: "clamp(16px, 1.8vw, 20px)",
                  lineHeight: 1.55,
                  color: "rgba(231, 220, 198, 0.85)",
                  maxWidth: "440px",
                  margin: "0 0 36px",
                }}
              >
                Send a request. Appear on the map. Let your community respond.
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  flexWrap: "wrap",
                }}
              >
                <Link
                  to="/help"
                  style={{
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "9px",
                    color: "#fff",
                    fontWeight: "600",
                    fontSize: "16px",
                    padding: "16px 30px",
                    borderRadius: "13px",
                    boxShadow: "0 16px 40px -16px rgba(255, 122, 107, 0.95)",
                    backgroundColor: "#FF7A6B",
                  }}
                >
                  Get Help{" "}
                  <span style={{ fontSize: "18px", lineHeight: 0 }}>→</span>
                </Link>
                <a
                  href="#community"
                  style={{
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "9px",
                    background: "rgba(20, 30, 24, 0.35)",
                    color: "#F4ECDC",
                    fontWeight: "600",
                    fontSize: "16px",
                    padding: "15px 26px",
                    borderRadius: "13px",
                    border: "1.5px solid rgba(236, 224, 204, 0.42)",
                    backdropFilter: "blur(6px)",
                    cursor: "pointer",
                  }}
                >
                  Join Community
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex="-1" style={{ outline: "none" }}>
        {/* SECTION 2 — PROBLEM */}
        <section
          style={{
            padding: "108px 0 96px",
            background: "#ECE0CC",
            position: "relative",
          }}
        >
          <div
            style={{
              width: "min(1180px, calc(100% - 40px))",
              margin: "0 auto",
            }}
          >
            <RevealDiv
              index={getNextRevealIdx()}
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: "40px",
                marginBottom: "54px",
                position: "relative",
              }}
            >
              <div style={{ maxWidth: "560px" }}>
                <div
                  style={{
                    fontSize: "12px",
                    letterSpacing: "3px",
                    fontWeight: "600",
                    color: "#3F8487",
                    marginBottom: "18px",
                  }}
                >
                  THE REALITY
                </div>
                <h2
                  style={{
                    fontFamily: "'Instrument Serif', serif",
                    fontWeight: 400,
                    color: "#234B4E",
                    fontSize: "clamp(34px, 5vw, 60px)",
                    lineHeight: 1.02,
                    letterSpacing: "-0.4px",
                    margin: "0 0 18px",
                  }}
                >
                  Many people face emergencies alone.
                </h2>
                <p
                  style={{
                    fontSize: "18px",
                    lineHeight: 1.6,
                    color: "#5a554c",
                    margin: 0,
                    maxWidth: "500px",
                  }}
                >
                  When something goes wrong, the help you need is often closer
                  than you think — just unreachable.
                </p>
              </div>
              <img
                className="char-image"
                src="/assets/chars/runner.png"
                alt=""
                style={{
                  height: "392px",
                  width: "404px",
                  opacity: 0.88,
                  left: "651px",
                  top: "-111px",
                }}
              />
            </RevealDiv>

            {/* Problem Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(232px, 1fr))",
                gap: "18px",
              }}
            >
              {[
                {
                  num: "01",
                  title: "Lost",
                  desc: "Disoriented in an unfamiliar place with no clear way to signal where you are.",
                },
                {
                  num: "02",
                  title: "Stranded",
                  desc: "A breakdown, a missed connection, no transport and nightfall closing in.",
                },
                {
                  num: "03",
                  title: "Unsafe",
                  desc: "A situation turns and you need eyes on you, fast, from people nearby.",
                },
                {
                  num: "04",
                  title: "Need Assistance",
                  desc: "Not an emergency for the line — but you still can't do this alone.",
                },
              ].map((card, i) => (
                <RevealDiv
                  key={i}
                  index={getNextRevealIdx()}
                  style={{
                    background: "#F2E8D6",
                    border: "1px solid #C9BCA4",
                    borderRadius: "16px",
                    padding: "24px 22px 26px",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Instrument Serif', serif",
                      fontSize: "34px",
                      color: "#FF7A6B",
                      lineHeight: 1,
                      marginBottom: "34px",
                    }}
                  >
                    {card.num}
                  </div>
                  <h3
                    style={{
                      fontSize: "19px",
                      fontWeight: "600",
                      color: "#234B4E",
                      margin: "0 0 8px",
                    }}
                  >
                    {card.title}
                  </h3>
                  <p
                    style={{
                      fontSize: "14.5px",
                      lineHeight: 1.55,
                      color: "#6b6457",
                      margin: 0,
                    }}
                  >
                    {card.desc}
                  </p>
                </RevealDiv>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3 — HOW IT WORKS */}
        <section
          id="how"
          style={{
            padding: "104px 0 110px",
            background: "#E4D6BD",
          }}
        >
          <div
            style={{
              width: "min(1180px, calc(100% - 40px))",
              margin: "0 auto",
              position: "relative",
            }}
          >
            <RevealDiv
              index={getNextRevealIdx()}
              style={{
                textAlign: "center",
                maxWidth: "620px",
                margin: "0 auto 64px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  letterSpacing: "3px",
                  fontWeight: "600",
                  color: "#3F8487",
                  marginBottom: "18px",
                }}
              >
                THREE STEPS
              </div>
              <h2
                style={{
                  fontFamily: "'Instrument Serif', serif",
                  fontWeight: 400,
                  color: "#234B4E",
                  fontSize: "clamp(34px, 5vw, 60px)",
                  lineHeight: 1.02,
                  letterSpacing: "-0.4px",
                  margin: 0,
                }}
              >
                Reaching help, made human.
              </h2>
            </RevealDiv>

            <div
              style={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "26px",
              }}
            >
              {[
                {
                  num: "1",
                  title: "Send Request",
                  desc: "Describe what you need in a sentence. No account required to ask.",
                  color: "#3F8487",
                },
                {
                  num: "2",
                  title: "Appear on Map",
                  desc: "Your request surfaces as a live dot for trusted neighbours nearby.",
                  color: "#7357FF",
                },
                {
                  num: "3",
                  title: "Receive Help",
                  desc: "A verified responder accepts, and you track them to you in real time.",
                  color: "#FF7A6B",
                },
              ].map((step, i) => (
                <RevealDiv
                  key={i}
                  index={getNextRevealIdx()}
                  style={{ textAlign: "center" }}
                >
                  <div
                    style={{
                      width: "70px",
                      height: "70px",
                      margin: "0 auto 22px",
                      borderRadius: "50%",
                      background: "#ECE0CC",
                      border: `1.5px solid ${step.color}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "'Instrument Serif', serif",
                      fontSize: "30px",
                      color: "#234B4E",
                    }}
                  >
                    {step.num}
                  </div>
                  <h3
                    style={{
                      fontSize: "21px",
                      fontWeight: "600",
                      color: "#234B4E",
                      margin: "0 0 10px",
                    }}
                  >
                    {step.title}
                  </h3>
                  <p
                    style={{
                      fontSize: "15px",
                      lineHeight: 1.6,
                      color: "#6b6457",
                      margin: "0 auto",
                      maxWidth: "280px",
                    }}
                  >
                    {step.desc}
                  </p>
                </RevealDiv>
              ))}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                pointerEvents: "none",
                paddingBottom: "0",
              }}
            ></div>
            <img
              className="char-image"
              src="/assets/chars/chilly.png"
              alt=""
              style={{
                height: "335px",
                width: "344px",
                opacity: 0.85,
                left: "949px",
                top: "-22px",
              }}
            />
          </div>
        </section>

        {/* SECTION 4 — LIVE COMMUNITY MAP */}
        <section
          id="community"
          style={{
            padding: "104px 0 110px",
            background: "#ECE0CC",
          }}
        >
          <div
            style={{
              width: "min(1180px, calc(100% - 40px))",
              margin: "0 auto",
            }}
          >
            <RevealDiv
              index={getNextRevealIdx()}
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: "30px",
                flexWrap: "wrap",
                marginBottom: "34px",
              }}
            >
              <div style={{ maxWidth: "560px" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "12px",
                    letterSpacing: "3px",
                    fontWeight: "600",
                    color: "#3F8487",
                    marginBottom: "16px",
                  }}
                >
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: "#FF7A6B",
                      animation: "mdblink 1.4s steps(1) infinite",
                    }}
                  ></span>
                  LIVE NOW
                </div>
                <h2
                  style={{
                    fontFamily: "'Instrument Serif', serif",
                    fontWeight: 400,
                    color: "#234B4E",
                    fontSize: "clamp(34px, 5vw, 60px)",
                    lineHeight: 1.02,
                    letterSpacing: "-0.4px",
                    margin: "0 0 14px",
                  }}
                >
                  A neighbourhood that answers.
                </h2>
                <p
                  style={{
                    fontSize: "17px",
                    lineHeight: 1.6,
                    color: "#5a554c",
                    margin: 0,
                  }}
                >
                  Every dot is a real person — someone asking, someone on their
                  way.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {[
                  { num: "128", label: "responders online" },
                  { num: "6 min", label: "avg. response" },
                  { num: "3", label: "active requests", color: "#FF7A6B" },
                ].map((stat, i) => (
                  <div
                    key={i}
                    style={{
                      background: "#F2E8D6",
                      border: "1px solid #C9BCA4",
                      borderRadius: "12px",
                      padding: "11px 15px",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "'Instrument Serif', serif",
                        fontSize: "26px",
                        color: stat.color || "#234B4E",
                        lineHeight: 1,
                      }}
                    >
                      {stat.num}
                    </div>
                    <div
                      style={{
                        fontSize: "11.5px",
                        color: "#7a7264",
                        marginTop: "3px",
                      }}
                    >
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </RevealDiv>

            {/* SVG Map */}
            <RevealDiv
              index={getNextRevealIdx()}
              style={{
                position: "relative",
                border: "1px solid #B9AE9C",
                borderRadius: "22px",
                overflow: "hidden",
                background: "#E7DAC2",
                boxShadow: "0 30px 70px -40px rgba(35, 75, 78, 0.6)",
              }}
            >
              <svg
                viewBox="0 0 1140 540"
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                }}
              >
                <defs>
                  <pattern
                    id="mdgrid"
                    width="48"
                    height="48"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M48 0H0V48"
                      fill="none"
                      stroke="#B9AE9C"
                      strokeWidth="1"
                      opacity="0.5"
                    ></path>
                  </pattern>
                </defs>
                <rect width="1140" height="540" fill="#E7DAC2"></rect>
                <rect width="1140" height="540" fill="url(#mdgrid)"></rect>

                {/* Organic blobs */}
                <path
                  d="M120 120 Q260 70 430 130 T720 150 Q620 280 700 360 Q500 430 360 380 Q200 410 150 300 Z"
                  fill="#3F8487"
                  opacity="0.07"
                ></path>
                <path
                  d="M760 90 Q940 110 1010 230 Q1060 360 920 430 Q820 470 770 360 Q820 240 740 190 Z"
                  fill="#7357FF"
                  opacity="0.06"
                ></path>

                {/* Roads */}
                <path
                  d="M0 200 Q300 160 560 240 T1140 210"
                  fill="none"
                  stroke="#B9AE9C"
                  strokeWidth="3"
                  opacity="0.7"
                ></path>
                <path
                  d="M180 0 Q230 220 360 320 T520 540"
                  fill="none"
                  stroke="#B9AE9C"
                  strokeWidth="3"
                  opacity="0.7"
                ></path>
                <path
                  d="M1140 380 Q860 350 700 400 T300 470"
                  fill="none"
                  stroke="#B9AE9C"
                  strokeWidth="2.5"
                  opacity="0.6"
                ></path>
                <path
                  d="M860 0 Q900 180 1000 280"
                  fill="none"
                  stroke="#B9AE9C"
                  strokeWidth="2.5"
                  opacity="0.6"
                ></path>

                {/* Active routes */}
                <path
                  d="M560 300 Q470 230 360 210"
                  fill="none"
                  stroke="#3F8487"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="9 11"
                  style={{ animation: "mddash 1.4s linear infinite" }}
                ></path>
                <path
                  d="M560 300 Q700 280 820 200"
                  fill="none"
                  stroke="#7357FF"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="9 11"
                  style={{ animation: "mddash 1.7s linear infinite" }}
                ></path>
                <path
                  d="M560 300 Q620 400 760 420"
                  fill="none"
                  stroke="#FF7A6B"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="9 11"
                  style={{ animation: "mddash 1.2s linear infinite" }}
                ></path>

                {/* Responder pins */}
                <g>
                  <circle cx="360" cy="210" r="9" fill="#3F8487" opacity="0.35">
                    <animate
                      attributeName="r"
                      values="9;26;9"
                      dur="3.2s"
                      repeatCount="indefinite"
                    ></animate>
                    <animate
                      attributeName="opacity"
                      values="0.4;0;0.4"
                      dur="3.2s"
                      repeatCount="indefinite"
                    ></animate>
                  </circle>
                  <circle
                    cx="360"
                    cy="210"
                    r="7"
                    fill="#3F8487"
                    stroke="#ECE0CC"
                    strokeWidth="2.5"
                  ></circle>
                </g>
                <g>
                  <circle cx="820" cy="200" r="9" fill="#7357FF" opacity="0.35">
                    <animate
                      attributeName="r"
                      values="9;24;9"
                      dur="3.6s"
                      repeatCount="indefinite"
                    ></animate>
                    <animate
                      attributeName="opacity"
                      values="0.4;0;0.4"
                      dur="3.6s"
                      repeatCount="indefinite"
                    ></animate>
                  </circle>
                  <circle
                    cx="820"
                    cy="200"
                    r="7"
                    fill="#7357FF"
                    stroke="#ECE0CC"
                    strokeWidth="2.5"
                  ></circle>
                </g>
                <g>
                  <circle cx="760" cy="420" r="9" fill="#FF7A6B" opacity="0.35">
                    <animate
                      attributeName="r"
                      values="9;24;9"
                      dur="2.8s"
                      repeatCount="indefinite"
                    ></animate>
                    <animate
                      attributeName="opacity"
                      values="0.4;0;0.4"
                      dur="2.8s"
                      repeatCount="indefinite"
                    ></animate>
                  </circle>
                  <circle
                    cx="760"
                    cy="420"
                    r="7"
                    fill="#FF7A6B"
                    stroke="#ECE0CC"
                    strokeWidth="2.5"
                  ></circle>
                </g>

                {/* Central request pin */}
                <g>
                  <circle cx="560" cy="300" r="14" fill="#FF7A6B" opacity="0.3">
                    <animate
                      attributeName="r"
                      values="14;40;14"
                      dur="2.4s"
                      repeatCount="indefinite"
                    ></animate>
                    <animate
                      attributeName="opacity"
                      values="0.5;0;0.5"
                      dur="2.4s"
                      repeatCount="indefinite"
                    ></animate>
                  </circle>
                  <circle
                    cx="560"
                    cy="300"
                    r="13"
                    fill="#234B4E"
                    stroke="#ECE0CC"
                    strokeWidth="3"
                  ></circle>
                  <circle cx="560" cy="300" r="4.5" fill="#FF7A6B"></circle>
                </g>
                <text
                  x="560"
                  y="268"
                  textAnchor="middle"
                  fontFamily="VT323, monospace"
                  fontSize="18"
                  fill="#234B4E"
                >
                  REQUEST 04:12
                </text>
              </svg>

              {/* Legend */}
              <div
                style={{
                  position: "absolute",
                  left: "16px",
                  bottom: "16px",
                  display: "flex",
                  gap: "16px",
                  background: "rgba(236, 224, 204, 0.85)",
                  backdropFilter: "blur(6px)",
                  border: "1px solid #C9BCA4",
                  borderRadius: "12px",
                  padding: "9px 14px",
                }}
              >
                {[
                  { color: "#234B4E", label: "Request" },
                  { color: "#3F8487", label: "Responder" },
                  { color: "#7357FF", label: "En route" },
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "7px",
                      fontSize: "12.5px",
                      color: "#3a4a40",
                    }}
                  >
                    <span
                      style={{
                        width: "9px",
                        height: "9px",
                        borderRadius: "50%",
                        background: item.color,
                      }}
                    ></span>
                    {item.label}
                  </div>
                ))}
              </div>
            </RevealDiv>
          </div>
        </section>

        {/* SECTION 5 — WHY PEOPLE RESPOND */}
        <section
          style={{
            padding: "104px 0 110px",
            background: "#234B4E",
          }}
        >
          <div
            style={{
              width: "min(1180px, calc(100% - 40px))",
              margin: "0 auto",
              position: "relative",
            }}
          >
            <RevealDiv
              index={getNextRevealIdx()}
              style={{
                maxWidth: "680px",
                marginBottom: "56px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  letterSpacing: "3px",
                  fontWeight: "600",
                  color: "#8FC3C2",
                  marginBottom: "18px",
                }}
              >
                THE HUMAN PART
              </div>
              <h2
                style={{
                  fontFamily: "'Instrument Serif', serif",
                  fontWeight: 400,
                  color: "#F4ECDC",
                  fontSize: "clamp(34px, 5vw, 60px)",
                  lineHeight: 1.02,
                  letterSpacing: "-0.4px",
                  margin: 0,
                }}
              >
                Why people show up.
              </h2>
            </RevealDiv>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "1px",
                background: "rgba(143, 195, 194, 0.22)",
                border: "1px solid rgba(143, 195, 194, 0.22)",
                borderRadius: "18px",
                overflow: "hidden",
              }}
            >
              {[
                {
                  title: "Trust",
                  desc: "Verified neighbours, not strangers from nowhere.",
                  color: "#FF7A6B",
                },
                {
                  title: "Local impact",
                  desc: "Help that stays in the streets you actually walk.",
                  color: "#8FC3C2",
                },
                {
                  title: "Shared responsibility",
                  desc: "Today you respond; tomorrow someone responds for you.",
                  color: "#A99BFF",
                },
                {
                  title: "Human connection",
                  desc: "A name, a face, a hand — not a hotline.",
                  color: "#F4ECDC",
                },
              ].map((item, i) => (
                <RevealDiv
                  key={i}
                  index={getNextRevealIdx()}
                  style={{
                    background: "#234B4E",
                    padding: "34px 28px",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Instrument Serif', serif",
                      fontSize: "26px",
                      color: item.color,
                      marginBottom: "18px",
                    }}
                  >
                    {item.title}
                  </div>
                  <p
                    style={{
                      fontSize: "15px",
                      lineHeight: 1.6,
                      color: "#cfdcd4",
                      margin: 0,
                    }}
                  >
                    {item.desc}
                  </p>
                </RevealDiv>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 6 — FEATURES */}
        <section
          id="coverage"
          style={{
            padding: "104px 0 110px",
            background: "#ECE0CC",
            position: "relative",
          }}
        >
          <div
            style={{
              width: "min(1180px, calc(100% - 40px))",
              margin: "0 auto",
              position: "relative",
            }}
          >
            <RevealDiv
              index={getNextRevealIdx()}
              style={{ maxWidth: "680px", marginBottom: "50px" }}
            >
              <div
                style={{
                  fontSize: "12px",
                  letterSpacing: "3px",
                  fontWeight: "600",
                  color: "#3F8487",
                  marginBottom: "18px",
                }}
              >
                WHAT'S INSIDE
              </div>
              <h2
                style={{
                  fontFamily: "'Instrument Serif', serif",
                  fontWeight: 400,
                  color: "#234B4E",
                  fontSize: "clamp(34px, 5vw, 60px)",
                  lineHeight: 1.02,
                  letterSpacing: "-0.4px",
                  margin: 0,
                }}
              >
                Built for the moment it matters.
              </h2>
            </RevealDiv>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "16px",
                position: "relative",
              }}
            >
              {[
                {
                  icon: "#7357FF",
                  title: "Community responders",
                  desc: "Real neighbours who opted in to help, vetted and close by.",
                },
                {
                  icon: "#FF7A6B",
                  title: "Anonymous requests",
                  desc: "Ask for help without an account, a name, or a payment.",
                },
                {
                  icon: "#3F8487",
                  title: "Status updates",
                  desc: "See exactly when a responder accepts, departs, and arrives.",
                },
                {
                  icon: "#3F8487",
                  title: "Real-time location",
                  desc: "Your pin updates live so responders always know where you actually are.",
                },
              ].map((feature, i) => (
                <RevealDiv
                  key={i}
                  index={getNextRevealIdx()}
                  style={{
                    background: "#F2E8D6",
                    border: "1px solid #C9BCA4",
                    borderRadius: "15px",
                    padding: "26px 24px",
                    display: "flex",
                    gap: "16px",
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      width: "10px",
                      height: "10px",
                      marginTop: "7px",
                      borderRadius: "50%",
                      background: feature.icon,
                      flexShrink: 0,
                    }}
                  ></span>
                  <div>
                    <h3
                      style={{
                        fontSize: "18px",
                        fontWeight: "600",
                        color: "#234B4E",
                        margin: "0 0 6px",
                      }}
                    >
                      {feature.title}
                    </h3>
                    <p
                      style={{
                        fontSize: "14px",
                        lineHeight: 1.55,
                        color: "#6b6457",
                        margin: 0,
                      }}
                    >
                      {feature.desc}
                    </p>
                  </div>
                </RevealDiv>
              ))}
            </div>
            {/* Characters: Waiting and Growth */}
            <img
              className="char-image"
              src="/assets/chars/waiting.png"
              alt=""
              style={{
                height: "300px",
                width: "auto",
                opacity: 0.82,
                left: "882px",
                top: "-105px",
              }}
            />
            <img
              className="char-image"
              src="/assets/chars/growth.png"
              alt=""
              style={{
                height: "261px",
                width: "258px",
                opacity: 0.88,
                left: "663px",
                top: "-92px",
              }}
            />
          </div>
        </section>

        {/* SECTION 7 — TRUST */}
        <section
          id="trust"
          style={{
            padding: "104px 0 110px",
            background: "#1d3f42",
          }}
        >
          <div
            style={{
              width: "min(1180px, calc(100% - 40px))",
              margin: "0 auto",
            }}
          >
            <RevealDiv
              index={getNextRevealIdx()}
              style={{
                textAlign: "center",
                maxWidth: "640px",
                margin: "0 auto 58px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  letterSpacing: "3px",
                  fontWeight: "600",
                  color: "#8FC3C2",
                  marginBottom: "18px",
                }}
              >
                SAFETY FIRST
              </div>
              <h2
                style={{
                  fontFamily: "'Instrument Serif', serif",
                  fontWeight: 400,
                  color: "#F4ECDC",
                  fontSize: "clamp(34px, 5vw, 60px)",
                  lineHeight: 1.02,
                  letterSpacing: "-0.4px",
                  margin: "0 0 16px",
                }}
              >
                Care, with guardrails.
              </h2>
              <p
                style={{
                  fontSize: "17px",
                  lineHeight: 1.6,
                  color: "#bcd0c9",
                  margin: 0,
                }}
              >
                Openness only works when it's safe. These are the systems that
                make trust possible.
              </p>
            </RevealDiv>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(248px, 1fr))",
                gap: "18px",
              }}
            >
              {[
                {
                  title: "Verification",
                  desc: "Responders are identity-checked before they can ever accept a request.",
                  icon: "circle",
                },
                {
                  title: "Moderation",
                  desc: "A live team and community flags keep the map honest, around the clock.",
                  icon: "square",
                },
                {
                  title: "Privacy",
                  desc: "Your exact location is shared only with the responder you accept — no one else.",
                  icon: "phone",
                },
                {
                  title: "Response tracking",
                  desc: "Every interaction is logged and traceable, so help stays accountable.",
                  icon: "loading",
                },
              ].map((item, i) => (
                <RevealDiv
                  key={i}
                  index={getNextRevealIdx()}
                  style={{
                    background: "rgba(63, 132, 135, 0.16)",
                    border: "1px solid rgba(143, 195, 194, 0.3)",
                    borderRadius: "16px",
                    padding: "28px 24px",
                  }}
                >
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "11px",
                      background: "#3F8487",
                      marginBottom: "20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {item.icon === "circle" && (
                      <span
                        style={{
                          width: "14px",
                          height: "14px",
                          border: "2.5px solid #ECE0CC",
                          borderRadius: "50%",
                        }}
                      ></span>
                    )}
                    {item.icon === "square" && (
                      <span
                        style={{
                          width: "14px",
                          height: "14px",
                          background: "#ECE0CC",
                          borderRadius: "3px",
                        }}
                      ></span>
                    )}
                    {item.icon === "phone" && (
                      <span
                        style={{
                          width: "11px",
                          height: "15px",
                          border: "2.5px solid #ECE0CC",
                          borderRadius: "7px 7px 3px 3px",
                        }}
                      ></span>
                    )}
                    {item.icon === "loading" && (
                      <span
                        style={{
                          width: "15px",
                          height: "15px",
                          border: "2.5px solid #ECE0CC",
                          borderTopColor: "transparent",
                          borderRadius: "50%",
                        }}
                      ></span>
                    )}
                  </div>
                  <h3
                    style={{
                      fontSize: "19px",
                      fontWeight: "600",
                      color: "#F4ECDC",
                      margin: "0 0 8px",
                    }}
                  >
                    {item.title}
                  </h3>
                  <p
                    style={{
                      fontSize: "14.5px",
                      lineHeight: 1.55,
                      color: "#bcd0c9",
                      margin: 0,
                    }}
                  >
                    {item.desc}
                  </p>
                </RevealDiv>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 8 — FINAL CTA */}
        <section
          id="cta"
          style={{
            padding: "140px 0 120px",
            background: "#E4D6BD",
            textAlign: "center",
          }}
        >
          <RevealDiv
            index={getNextRevealIdx()}
            style={{
              width: "min(900px, calc(100% - 40px))",
              margin: "0 auto",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "9px",
                marginBottom: "30px",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "#a2a586",
                }}
              ></span>
              <span
                style={{
                  fontSize: "12px",
                  letterSpacing: "3px",
                  fontWeight: "600",
                  color: "#3F8487",
                }}
              >
                JOIN <b>HELPHONE</b>
              </span>
            </div>
            <h2
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontWeight: 400,
                color: "#234B4E",
                fontSize: "clamp(42px, 7vw, 92px)",
                lineHeight: 1.0,
                letterSpacing: "-0.6px",
                margin: "0 0 38px",
                position: "relative",
              }}
            >
              Nobody should face
              <br />
              emergencies alone.
              <img
                src="/assets/chars/jumping-air.png"
                alt=""
                style={{
                  height: "472px",
                  width: "477px",
                  mixBlendMode: "multiply",
                  opacity: 0.88,
                  position: "absolute",
                  left: "-209px",
                  top: "-127px",
                  pointerEvents: "none",
                }}
              />
            </h2>
            <a
              href="#top"
              style={{
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "11px",
                color: "#fff",
                fontWeight: "600",
                fontSize: "18px",
                padding: "19px 38px",
                borderRadius: "15px",
                boxShadow: "0px 22px 50px -18px rgba(167, 195, 29, 0.95)",
                backgroundColor: "#a2a586",
                cursor: "pointer",
              }}
            >
              Join the Network{" "}
              <span style={{ fontSize: "20px", lineHeight: 0 }}>→</span>
            </a>
            <p
              style={{
                margin: "24px 0 0",
                fontSize: "14px",
                color: "#7a7264",
              }}
            >
              Free to join · Available wherever neighbours are
            </p>
          </RevealDiv>
        </section>
      </main>

      {/* FOOTER */}
      <footer
        style={{
          background: "#1c2c24",
          padding: "54px 0 40px",
          borderTop: "1px solid rgba(143, 195, 194, 0.18)",
        }}
      >
        <div
          style={{
            width: "min(1180px, calc(100% - 40px))",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "30px",
              flexWrap: "wrap",
              paddingBottom: "34px",
              borderBottom: "1px dashed rgba(143, 195, 194, 0.28)",
            }}
          >
            <div style={{ maxWidth: "300px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "14px",
                }}
              >
                <span
                  style={{
                    width: "9px",
                    height: "9px",
                    borderRadius: "50%",
                    backgroundColor: "#a2a586",
                  }}
                ></span>
                <span
                  style={{
                    fontFamily: "'Instrument Serif', serif",
                    fontSize: "22px",
                    color: "#F4ECDC",
                  }}
                >
                  HelPhone
                </span>
              </div>
              <p
                style={{
                  fontSize: "14px",
                  lineHeight: 1.6,
                  color: "#9fb4ab",
                  margin: 0,
                }}
              >
                A community help network where the nearest hand finds you on the
                map.
              </p>
            </div>
            <div style={{ display: "flex", gap: "54px", flexWrap: "wrap" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "11px",
                }}
              >
                <div
                  style={{
                    fontSize: "11.5px",
                    letterSpacing: "2px",
                    color: "#6f857c",
                    marginBottom: "3px",
                  }}
                >
                  PLATFORM
                </div>
                <a
                  href="#how"
                  style={{
                    textDecoration: "none",
                    color: "#cfdcd4",
                    fontSize: "14px",
                  }}
                >
                  How it works
                </a>
                <a
                  href="#community"
                  style={{
                    textDecoration: "none",
                    color: "#cfdcd4",
                    fontSize: "14px",
                  }}
                >
                  Live map
                </a>
                <a
                  href="#coverage"
                  style={{
                    textDecoration: "none",
                    color: "#cfdcd4",
                    fontSize: "14px",
                  }}
                >
                  Coverage
                </a>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "11px",
                }}
              >
                <div
                  style={{
                    fontSize: "11.5px",
                    letterSpacing: "2px",
                    color: "#6f857c",
                    marginBottom: "3px",
                  }}
                >
                  TRUST
                </div>
                <a
                  href="#trust"
                  style={{
                    textDecoration: "none",
                    color: "#cfdcd4",
                    fontSize: "14px",
                  }}
                >
                  Safety
                </a>
                <a
                  href="#trust"
                  style={{
                    textDecoration: "none",
                    color: "#cfdcd4",
                    fontSize: "14px",
                  }}
                >
                  Privacy
                </a>
                <a
                  href="#trust"
                  style={{
                    textDecoration: "none",
                    color: "#cfdcd4",
                    fontSize: "14px",
                  }}
                >
                  Verification
                </a>
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              flexWrap: "wrap",
              paddingTop: "22px",
            }}
          >
            <span
              style={{
                fontSize: "12.5px",
                color: "#6f857c",
              }}
            >
              © 2026 HelPhone · Built for neighbours
            </span>
            <span
              style={{
                fontFamily: "'VT323', monospace",
                fontSize: "15px",
                color: "#6f857c",
                letterSpacing: "1px",
              }}
            >
              ▤ help arrives through people
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
