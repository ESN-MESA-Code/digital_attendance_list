// Security: the old public signatures bucket is closed, only esnmesa.org
// Google accounts can get a Supabase user, and no internal function is
// callable through the API.
import { beforeAll, describe, expect, it } from "vitest";
import { ANON_KEY, SUPABASE_URL, admin, anonClient, clientAs, organiserSession } from "../helpers/local";

describe("signatures storage bucket", () => {
  const anon = anonClient();
  const path = `test/${crypto.randomUUID()}.png`;

  beforeAll(async () => {
    // A leftover file like the ones still in production's bucket
    const { error } = await admin.storage.from("signatures").upload(path, new Blob(["x"]), {
      contentType: "image/png",
    });
    expect(error).toBeNull();
    return async () => {
      await admin.storage.from("signatures").remove([path]);
    };
  });

  it("is not public", async () => {
    const { data } = await admin.storage.getBucket("signatures");
    expect(data?.public).toBe(false);
  });

  it("old public URLs no longer work", async () => {
    const { data } = anon.storage.from("signatures").getPublicUrl(path);
    const res = await fetch(data.publicUrl);
    expect(res.ok).toBe(false);
  });

  it("anonymous visitors can neither list, download nor upload", async () => {
    const list = await anon.storage.from("signatures").list("test");
    expect(list.data ?? []).toEqual([]);
    const download = await anon.storage.from("signatures").download(path);
    expect(download.error).not.toBeNull();
    const upload = await anon.storage.from("signatures").upload(`test/${crypto.randomUUID()}.png`, new Blob(["x"]));
    expect(upload.error).not.toBeNull();
  });

  it("organisers cannot use it either (nothing is stored there any more)", async () => {
    const organiser = await clientAs((await organiserSession()).access_token);
    const list = await organiser.storage.from("signatures").list("test");
    expect(list.data ?? []).toEqual([]);
    const upload = await organiser.storage.from("signatures").upload(`test/${crypto.randomUUID()}.png`, new Blob(["x"]));
    expect(upload.error).not.toBeNull();
  });
});

describe("sign-up trigger", () => {
  it.each(["someone@gmail.com", "someone@esnmesa.org"])(
    "rejects a password sign-up for %s",
    async (email) => {
      const { data, error } = await anonClient().auth.signUp({ email, password: "a-long-password-123" });
      expect(error).not.toBeNull();
      expect(data.user).toBeNull();
    }
  );

  it("rejects accounts created through the admin API without Google", async () => {
    const { error } = await admin.auth.admin.createUser({
      email: `admin-made-${crypto.randomUUID().slice(0, 8)}@esnmesa.org`,
      password: "a-long-password-123",
      email_confirm: true,
      user_metadata: { custom_claims: { hd: "esnmesa.org" } },
    });
    expect(error).not.toBeNull();
  });
});

describe("database functions exposed through the API", () => {
  async function rpc(name: string) {
    return fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" },
      body: "{}",
    });
  }

  it("the sign-up trigger function cannot be called", async () => {
    expect((await rpc("enforce_workspace_signup")).ok).toBe(false);
  });

  it("is_workspace_member says no to anonymous visitors", async () => {
    const res = await rpc("is_workspace_member");
    expect(await res.json()).toBe(false);
  });
});
