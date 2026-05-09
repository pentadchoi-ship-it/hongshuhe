import { describe, expect, it } from "vitest";

import {
  HonorWatch5BleAdapter,
  HonorWatchBlePlatform
} from "../src/adapters/honorWatch5BleAdapter.js";

describe("HonorWatch5BleAdapter", () => {
  it("queues notifications and exposes them through read", async () => {
    let notificationHandler: ((value: Uint8Array<ArrayBufferLike>) => void) | undefined;

    const platform: HonorWatchBlePlatform = {
      async scan() {
        return [
          {
            deviceId: "watch-key-01",
            name: "HongShuhe Bear Key",
            rssi: -48
          }
        ];
      },
      async connect() {
        return {
          async write() {},
          async subscribe(_serviceUuid, _characteristicUuid, onValue) {
            notificationHandler = onValue;
            return async () => {};
          },
          async disconnect() {}
        };
      }
    };

    const adapter = new HonorWatch5BleAdapter(platform, {
      serviceUuid: "service-uuid",
      writeCharacteristicUuid: "write-uuid",
      notifyCharacteristicUuid: "notify-uuid"
    });

    const [device] = await adapter.scan();
    await adapter.connect(device);

    notificationHandler?.(new Uint8Array([0xa7, 1, 0x7e, 1, 0, 0, 0x90, 0x11]));

    const frame = await adapter.read();
    expect(Array.from(frame)).toEqual([0xa7, 1, 0x7e, 1, 0, 0, 0x90, 0x11]);
  });
});
