import { describe, expect, it } from "vitest";

import { MockBleAdapter } from "../src/adapters/mockBleAdapter.js";
import { SharedSecretSecurityProvider } from "../src/core/security.js";
import { CarKeySession } from "../src/core/session.js";

describe("CarKeySession", () => {
  it("connects and unlocks through the mock adapter", async () => {
    const session = new CarKeySession(
      new MockBleAdapter(),
      new SharedSecretSecurityProvider("hongshuhe-watch5-demo")
    );

    const state = await session.connect();
    expect(state.status).toBe("ready");

    const result = await session.perform("unlock");
    expect(result).toBe("车辆已解锁");
  });
});
