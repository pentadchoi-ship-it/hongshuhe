import { describe, expect, it } from "vitest";

import {
  createFrame,
  decodeAckPayload,
  decodeChallengePayload,
  decodeFrame,
  encodeAckPayload,
  encodeChallengePayload
} from "../src/core/protocol.js";
import { KeyCommand } from "../src/core/types.js";

describe("protocol", () => {
  it("encodes and decodes frames", () => {
    const frame = createFrame(KeyCommand.Lock, 7, new Uint8Array([1, 2, 3]));
    const decoded = decodeFrame(frame);

    expect(decoded.command).toBe(KeyCommand.Lock);
    expect(decoded.sequence).toBe(7);
    expect(Array.from(decoded.payload)).toEqual([1, 2, 3]);
  });

  it("encodes and decodes challenge payloads", () => {
    const nonce = Uint8Array.from({ length: 16 }, (_, index) => index);
    const payload = encodeChallengePayload(42, nonce);
    const decoded = decodeChallengePayload(payload);

    expect(decoded.sessionId).toBe(42);
    expect(Array.from(decoded.nonce)).toEqual(Array.from(nonce));
  });

  it("encodes and decodes ack payloads", () => {
    const payload = encodeAckPayload(KeyCommand.Unlock, true, "车辆已解锁");
    const decoded = decodeAckPayload(payload);

    expect(decoded.ok).toBe(true);
    expect(decoded.command).toBe(KeyCommand.Unlock);
    expect(decoded.message).toBe("车辆已解锁");
  });
});
