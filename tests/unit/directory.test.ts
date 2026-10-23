import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  GROUP_MEMBER_SCOPE,
  accessToken,
  groupMemberEmails,
  isGroupMember,
  serviceAccountFromEnv,
  signedAssertion,
} from "@/lib/google/directory";

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const sa = { email: "sync@project.iam.gserviceaccount.com", privateKey: pem };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** A fetch mock answering with `responses` in turn. */
function fetchReturning(...responses: Response[]) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- typed so the calls can be inspected
  const fn = vi.fn(async (..._args: unknown[]) => responses.shift()!);
  return { fn, fetch: fn as unknown as typeof fetch };
}

describe("serviceAccountFromEnv", () => {
  it("is null without email and key", () => {
    expect(serviceAccountFromEnv({})).toBeNull();
    expect(serviceAccountFromEnv({ GOOGLE_SERVICE_ACCOUNT_EMAIL: "x" })).toBeNull();
  });

  it("restores line breaks stored as \\n and reads the optional subject", () => {
    const one = serviceAccountFromEnv({
      GOOGLE_SERVICE_ACCOUNT_EMAIL: sa.email,
      GOOGLE_SERVICE_ACCOUNT_KEY: pem.replace(/\n/g, "\\n"),
      GOOGLE_ADMIN_SUBJECT: "admin@esnmesa.org",
    });
    expect(one).toEqual({ ...sa, subject: "admin@esnmesa.org" });
  });
});

describe("signedAssertion", () => {
  it("is an RS256 JWT for the group-member scope, verifiable with the public key", () => {
    const now = Date.UTC(2026, 9, 23);
    const jwt = signedAssertion({ ...sa, subject: "admin@esnmesa.org" }, now);
    const [header, claims, signature] = jwt.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toEqual({
      iss: sa.email,
      sub: "admin@esnmesa.org",
      scope: GROUP_MEMBER_SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: now / 1000,
      exp: now / 1000 + 3600,
    });
    const ok = crypto
      .createVerify("RSA-SHA256")
      .update(`${header}.${claims}`)
      .verify(publicKey, Buffer.from(signature, "base64url"));
    expect(ok).toBe(true);
  });

  it("has no subject without domain-wide delegation", () => {
    const claims = JSON.parse(Buffer.from(signedAssertion(sa).split(".")[1], "base64url").toString());
    expect(claims).not.toHaveProperty("sub");
  });
});

describe("accessToken", () => {
  it("trades the assertion for a token", async () => {
    const { fn, fetch } = fetchReturning(json({ access_token: "ya29.token" }));
    expect(await accessToken(sa, fetch)).toBe("ya29.token");
    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    expect(body.get("assertion")!.split(".")).toHaveLength(3);
  });

  it("fails loudly when Google refuses", async () => {
    const { fetch } = fetchReturning(json({ error: "unauthorized_client" }, 401));
    await expect(accessToken(sa, fetch)).rejects.toThrow("401");
  });
});

describe("groupMemberEmails", () => {
  it("follows the pages and keeps active users, lower-cased", async () => {
    const { fn, fetch } = fetchReturning(
      json({
        members: [
          { email: "Chair@esnmesa.org", type: "USER", status: "ACTIVE" },
          { email: "sub-group@esnmesa.org", type: "GROUP", status: "ACTIVE" },
          { email: "gone@esnmesa.org", type: "USER", status: "SUSPENDED" },
        ],
        nextPageToken: "p2",
      }),
      json({ members: [{ email: "treasurer@esnmesa.org", type: "USER", status: "ACTIVE" }] })
    );
    expect(await groupMemberEmails("board@esnmesa.org", "token", fetch)).toEqual([
      "chair@esnmesa.org",
      "treasurer@esnmesa.org",
    ]);

    const urls = fn.mock.calls.map((c) => new URL(String(c[0])));
    expect(urls[0].pathname).toBe("/admin/directory/v1/groups/board%40esnmesa.org/members");
    expect(urls[0].searchParams.get("includeDerivedMembership")).toBe("true");
    expect(urls[1].searchParams.get("pageToken")).toBe("p2");
  });

  it("fails on an error instead of returning an empty group", async () => {
    const { fetch } = fetchReturning(json({ error: { message: "Not Authorized" } }, 403));
    await expect(groupMemberEmails("board@esnmesa.org", "token", fetch)).rejects.toThrow("403");
  });
});

describe("isGroupMember", () => {
  it("asks hasMember", async () => {
    const { fn, fetch } = fetchReturning(json({ isMember: true }));
    expect(await isGroupMember("board@esnmesa.org", "chair@esnmesa.org", "t", fetch)).toBe(true);
    expect(String(fn.mock.calls[0][0])).toBe(
      "https://admin.googleapis.com/admin/directory/v1/groups/board%40esnmesa.org/hasMember/chair%40esnmesa.org"
    );
  });

  it("is false for non-members and throws on errors", async () => {
    expect(await isGroupMember("g@esnmesa.org", "x@esnmesa.org", "t", fetchReturning(json({ isMember: false })).fetch)).toBe(false);
    await expect(isGroupMember("g@esnmesa.org", "x@esnmesa.org", "t", fetchReturning(json({}, 500)).fetch)).rejects.toThrow("500");
  });
});
