import { afterEach, describe, expect, it, vi } from "vitest";
import { MIN_DOWNLOAD_MS, downloadBudget, ingestErrors, knownMediaSize, mediaVerdict, withTimeout, youngEnough } from "./media";

const MB = 1024 * 1024;

describe("knownMediaSize", () => {
  it("reads a document's size, whatever number type GramJS used", () => {
    expect(knownMediaSize({ className: "MessageMediaDocument", document: { size: 5 * MB } })).toBe(5 * MB);
    expect(knownMediaSize({ document: { size: { valueOf: () => 9 * MB } } })).toBe(9 * MB); // big-integer
    expect(knownMediaSize({ document: { size: 123n } })).toBe(123);
  });

  it("reads the largest size of a photo", () => {
    const photo = {
      sizes: [
        { className: "PhotoStrippedSize", bytes: { length: 600 } },
        { className: "PhotoSize", type: "m", size: 20_000 },
        { className: "PhotoSize", type: "x", size: 150_000 },
        { className: "PhotoSizeProgressive", type: "y", sizes: [30_000, 90_000, 9 * MB] },
      ],
    };
    expect(knownMediaSize({ className: "MessageMediaPhoto", photo })).toBe(9 * MB);
  });

  it("is null when Telegram does not say", () => {
    expect(knownMediaSize(null)).toBeNull();
    expect(knownMediaSize({ className: "MessageMediaGeo" })).toBeNull();
    expect(knownMediaSize({ photo: { sizes: [] } })).toBeNull();
    expect(knownMediaSize({ document: {} })).toBeNull();
  });
});

describe("mediaVerdict", () => {
  it("skips a known oversized file without downloading it", () => {
    expect(mediaVerdict({ document: { size: 20 * MB } }, 8 * MB)).toEqual({ download: false, reason: "too_large", size: 20 * MB });
    expect(mediaVerdict({ photo: { sizes: [{ size: 10 * MB }] } }, 8 * MB).download).toBe(false);
  });
  it("downloads what fits, and what has no knowable size", () => {
    expect(mediaVerdict({ document: { size: 8 * MB } }, 8 * MB)).toEqual({ download: true, size: 8 * MB });
    expect(mediaVerdict({ className: "MessageMediaGeo" }, 8 * MB)).toEqual({ download: true, size: null });
  });
});

describe("downloadBudget", () => {
  it("is the per-file limit while the deadline is far", () => {
    expect(downloadBudget(0, 60_000, 15_000)).toBe(15_000);
  });
  it("shrinks to what the run has left", () => {
    expect(downloadBudget(50_000, 60_000, 15_000)).toBe(10_000);
  });
  it("is 0 when too little is left to be worth starting", () => {
    expect(downloadBudget(58_500, 60_000, 15_000)).toBe(0);
    expect(downloadBudget(61_000, 60_000, 15_000)).toBe(0);
    expect(downloadBudget(60_000 - MIN_DOWNLOAD_MS, 60_000, 15_000)).toBe(MIN_DOWNLOAD_MS);
  });
});

describe("withTimeout", () => {
  afterEach(() => vi.useRealTimers());

  it("passes a result that arrives in time", async () => {
    await expect(withTimeout(Promise.resolve(42), 1000, "download")).resolves.toBe(42);
  });

  it("passes a failure that arrives in time", async () => {
    await expect(withTimeout(Promise.reject(new Error("boom")), 1000, "download")).rejects.toThrow("boom");
  });

  it("gives up on a download that never finishes — the 30.09 outage", async () => {
    vi.useFakeTimers();
    const hung = new Promise<never>(() => {});
    const result = withTimeout(hung, 15_000, "download of message 7");
    const assertion = expect(result).rejects.toThrow("download of message 7 timed out after 15000 ms");
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
  });

  it("swallows the late failure of the abandoned work", async () => {
    vi.useFakeTimers();
    let fail!: (e: Error) => void;
    const slow = new Promise<never>((_, reject) => {
      fail = reject;
    });
    const result = withTimeout(slow, 100, "download");
    const assertion = expect(result).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    fail(new Error("late")); // must not become an unhandled rejection
    await vi.advanceTimersByTimeAsync(10);
  });
});

describe("ingestErrors", () => {
  it("reads the errors telegram-ingest returns inside a 200", () => {
    expect(ingestErrors({ ok: true, received: 3, stored: 2, errors: ["message insert: boom"] })).toEqual(["message insert: boom"]);
  });
  it("is empty when everything went in, or the body is not what we expect", () => {
    expect(ingestErrors({ ok: true, received: 1, stored: 1, errors: [] })).toEqual([]);
    expect(ingestErrors({ ok: true })).toEqual([]);
    expect(ingestErrors(null)).toEqual([]);
  });
});

describe("youngEnough", () => {
  const now = 1_800_000_000;
  it("holds the position for a recent message", () => {
    expect(youngEnough(now - 30, now, 600)).toBe(true);
    expect(youngEnough(now - 600, now, 600)).toBe(true);
  });
  it("lets a poison message go once it is old", () => {
    expect(youngEnough(now - 601, now, 600)).toBe(false);
  });
  it("treats a message without a date as young", () => {
    expect(youngEnough(null, now, 600)).toBe(true);
    expect(youngEnough(undefined, now, 600)).toBe(true);
  });
});
