import { describe, expect, it } from "vitest";
import type { User } from "@supabase/supabase-js";
import { isWorkspaceUser, safeNext } from "@/lib/auth";

const user = (email: string | undefined, hd?: string) =>
  ({ email, user_metadata: hd === undefined ? {} : { custom_claims: { hd } } }) as unknown as User;

describe("security: isWorkspaceUser", () => {
  it("accepts esnmesa.org Workspace accounts", () => {
    expect(isWorkspaceUser(user("someone@esnmesa.org", "esnmesa.org"))).toBe(true);
    expect(isWorkspaceUser(user("Someone@ESNmesa.org", "ESNMESA.org"))).toBe(true);
  });

  it("rejects no user", () => {
    expect(isWorkspaceUser(null)).toBe(false);
  });

  it("rejects other domains, even with a matching hd claim", () => {
    expect(isWorkspaceUser(user("someone@gmail.com", "esnmesa.org"))).toBe(false);
    expect(isWorkspaceUser(user("someone@esnmesa.org.evil.com", "esnmesa.org"))).toBe(false);
    expect(isWorkspaceUser(user("someone@sub.esnmesa.org", "esnmesa.org"))).toBe(false);
    expect(isWorkspaceUser(user("esnmesa.org@evil.com", "esnmesa.org"))).toBe(false);
  });

  it("rejects personal Google accounts without the Workspace hd claim", () => {
    expect(isWorkspaceUser(user("someone@esnmesa.org"))).toBe(false);
    expect(isWorkspaceUser(user("someone@esnmesa.org", ""))).toBe(false);
    expect(isWorkspaceUser(user("someone@esnmesa.org", "other.org"))).toBe(false);
  });

  it("rejects users without an email", () => {
    expect(isWorkspaceUser(user(undefined, "esnmesa.org"))).toBe(false);
  });
});

describe("security: safeNext (redirect after sign-in)", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/dashboard/events/123")).toBe("/dashboard/events/123");
    expect(safeNext("/kiosk/abc?x=1")).toBe("/kiosk/abc?x=1");
  });

  it.each([
    null,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "@evil.example",
    "evil.example",
  ])("falls back to the dashboard for %j", (next) => {
    expect(safeNext(next)).toBe("/dashboard/events");
  });
});
