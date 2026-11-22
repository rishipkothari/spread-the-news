import { describe, expect, it } from "vitest";
import { isAllowed, parseRobots } from "@/stages/fetch/robots";

const txt = `
User-agent: GPTBot
Disallow: /

User-agent: *
Disallow: /private/
Allow: /private/ok
Disallow: /*.pdf$
`;

describe("robots", () => {
  it("applies the * group to our bot", () => {
    const rules = parseRobots(txt, "SpreadTheNewsBot");
    expect(isAllowed(rules, "/feed/")).toBe(true);
    expect(isAllowed(rules, "/private/x")).toBe(false);
    expect(isAllowed(rules, "/private/ok")).toBe(true);
    expect(isAllowed(rules, "/a/b.pdf")).toBe(false);
  });
  it("prefers a specific group", () => {
    const rules = parseRobots("User-agent: SpreadTheNewsBot\nDisallow: /feed\n\nUser-agent: *\nDisallow:", "SpreadTheNewsBot");
    expect(isAllowed(rules, "/feed/")).toBe(false);
  });
});
