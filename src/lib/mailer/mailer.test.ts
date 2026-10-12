// @vitest-environment node
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileMailer } from "./file";
import { MemoryMailer } from "./memory";

const message = { to: "a@example.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi" };

describe("MemoryMailer", () => {
  it("records sent messages and can be cleared", async () => {
    const mailer = new MemoryMailer();
    await mailer.send(message);
    expect(mailer.sent).toEqual([message]);
    mailer.clear();
    expect(mailer.sent).toEqual([]);
  });
});

describe("FileMailer", () => {
  let dir = "";
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("writes one JSON file per message, creating the folder if needed", async () => {
    dir = path.join(await mkdtemp(path.join(os.tmpdir(), "mail-")), "nested");
    const mailer = new FileMailer(dir);
    await mailer.send(message);
    await mailer.send({ ...message, subject: "Second" });
    const files = await readdir(dir);
    expect(files).toHaveLength(2);
    const parsed = JSON.parse(await readFile(path.join(dir, files.sort()[0]), "utf8"));
    expect(parsed).toMatchObject(message);
    expect(typeof parsed.sentAt).toBe("string");
  });
});
