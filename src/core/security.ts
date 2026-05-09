import { createHash } from "node:crypto";

import { Bytes, ChallengePayload, DeviceIdentity, SecurityProvider } from "./types.js";

export class SharedSecretSecurityProvider implements SecurityProvider {
  constructor(private readonly sharedSecret: string) {}

  createClientHello(device: DeviceIdentity): Bytes {
    const input = `${device.address}|${device.name}|${this.sharedSecret}`;
    return this.digest(input).subarray(0, 16);
  }

  solveChallenge(challenge: ChallengePayload): Bytes {
    const digest = this.digest(
      `${challenge.sessionId}:${Buffer.from(challenge.nonce).toString("hex")}:${this.sharedSecret}`
    );
    return digest.subarray(0, 16);
  }

  private digest(value: string): Bytes {
    return new Uint8Array(createHash("sha256").update(value).digest());
  }
}
