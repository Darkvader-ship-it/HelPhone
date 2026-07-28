import { describe, it, expect } from "vitest";
import { distance } from "../src/pages/Help.jsx";

// ---------------------------------------------------------------------------
// distance() tests
//
// Verifies the haversine helper (incl. the sinLng term) returns a correct
// km distance for valid coordinates, and null — never NaN — for malformed
// or missing coordinates, so callers can't silently render "NaN km away".
// ---------------------------------------------------------------------------

describe("distance — valid coordinates", () => {
  it("returns 0 for identical points", () => {
    expect(distance([10, 20], [10, 20])).toBe(0);
  });

  it("computes a known distance (roughly London to Paris, ~344km)", () => {
    const london = [51.5074, -0.1278];
    const paris = [48.8566, 2.3522];
    const km = distance(london, paris);
    expect(km).toBeGreaterThan(330);
    expect(km).toBeLessThan(360);
  });

  it("is symmetric", () => {
    const a = [10, 20];
    const b = [30, 40];
    expect(distance(a, b)).toBeCloseTo(distance(b, a), 10);
  });
});

describe("distance — invalid coordinates", () => {
  it("returns null when a coordinate is NaN", () => {
    expect(distance([NaN, 20], [10, 20])).toBeNull();
  });

  it("returns null when a coordinate is undefined", () => {
    expect(distance([undefined, 20], [10, 20])).toBeNull();
  });

  it("returns null when a coordinate is null", () => {
    expect(distance([10, 20], [null, 20])).toBeNull();
  });

  it("returns null when a point is entirely missing", () => {
    expect(distance(null, [10, 20])).toBeNull();
    expect(distance([10, 20], undefined)).toBeNull();
  });

  it("returns null for Infinity", () => {
    expect(distance([Infinity, 20], [10, 20])).toBeNull();
  });
});
