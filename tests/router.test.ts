import { describe, expect, it } from "vitest";
import { parseHash } from "../src/router";

describe("parseHash", () => {
  it("matches a route with an id", () => {
    expect(parseHash("#/history/abc")).toEqual({ path: "/history/:id", params: { id: "abc" } });
  });
  it("decodes names", () => {
    expect(parseHash("#/trends/back%20squat")).toEqual({ path: "/trends/:name", params: { name: "back squat" } });
  });
  it("falls back to start", () => {
    expect(parseHash("").path).toBe("/");
    expect(parseHash("#/nope").path).toBe("/");
  });
  it("matches static routes", () => {
    expect(parseHash("#/settings")).toEqual({ path: "/settings", params: {} });
  });
});
