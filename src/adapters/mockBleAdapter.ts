import { randomBytes } from "node:crypto";

import {
  BleAdapter,
  DeviceIdentity,
  KeyCommand
} from "../core/types.js";
import {
  createFrame,
  decodeFrame,
  decodeStringPayload,
  encodeAckPayload,
  encodeChallengePayload
} from "../core/protocol.js";
import { SharedSecretSecurityProvider } from "../core/security.js";

class MockBleVehicleKeyDevice {
  private readonly device: DeviceIdentity = {
    name: "HongShuhe Bear Key",
    address: "HSH-KEY-01",
    rssi: -42
  };

  private sessionId = 0;
  private challengeNonce = new Uint8Array();
  private authenticated = false;
  private pendingFrames: Uint8Array[] = [];
  private readonly security = new SharedSecretSecurityProvider("hongshuhe-watch5-demo");

  discover(): DeviceIdentity[] {
    return [this.device];
  }

  async receive(frameBytes: Uint8Array): Promise<void> {
    const frame = decodeFrame(frameBytes);

    switch (frame.command) {
      case KeyCommand.Handshake: {
        this.sessionId += 1;
        this.challengeNonce = new Uint8Array(randomBytes(16));
        this.authenticated = false;
        this.pendingFrames.push(
          createFrame(
            KeyCommand.Challenge,
            frame.sequence,
            encodeChallengePayload(this.sessionId, this.challengeNonce)
          )
        );
        return;
      }

      case KeyCommand.ChallengeResponse: {
        const expected = this.security.solveChallenge({
          sessionId: this.sessionId,
          nonce: this.challengeNonce
        });
        const ok = Buffer.from(expected).equals(Buffer.from(frame.payload));
        this.authenticated = ok;
        this.pendingFrames.push(
          createFrame(
            KeyCommand.Ack,
            frame.sequence,
            encodeAckPayload(
              KeyCommand.ChallengeResponse,
              ok,
              ok ? "认证成功，车钥匙已就绪" : "认证失败，签名不匹配"
            )
          )
        );
        return;
      }

      case KeyCommand.Lock:
      case KeyCommand.Unlock:
      case KeyCommand.Trunk:
      case KeyCommand.Locate:
      case KeyCommand.Panic: {
        if (!this.authenticated) {
          this.pendingFrames.push(
            createFrame(
              KeyCommand.Ack,
              frame.sequence,
              encodeAckPayload(frame.command, false, "尚未认证，拒绝执行控制指令")
            )
          );
          return;
        }

        this.pendingFrames.push(
          createFrame(
            KeyCommand.Ack,
            frame.sequence,
            encodeAckPayload(frame.command, true, this.actionMessage(frame.command))
          )
        );
        return;
      }

      default: {
        this.pendingFrames.push(
          createFrame(
            KeyCommand.Error,
            frame.sequence,
            new TextEncoder().encode(`Unsupported command: ${frame.command}`)
          )
        );
      }
    }
  }

  async nextResponse(): Promise<Uint8Array> {
    const next = this.pendingFrames.shift();
    if (!next) {
      throw new Error("Mock device has no pending response");
    }
    return next;
  }

  private actionMessage(command: KeyCommand): string {
    switch (command) {
      case KeyCommand.Lock:
        return "车辆已落锁";
      case KeyCommand.Unlock:
        return "车辆已解锁";
      case KeyCommand.Trunk:
        return "后备箱已打开";
      case KeyCommand.Locate:
        return "正在鸣笛闪灯，帮助寻车";
      case KeyCommand.Panic:
        return "已触发警报模式";
      default:
        return decodeStringPayload(new Uint8Array());
    }
  }
}

export class MockBleAdapter implements BleAdapter {
  private readonly device = new MockBleVehicleKeyDevice();
  private connected = false;

  async scan(): Promise<DeviceIdentity[]> {
    return this.device.discover();
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async write(frame: Uint8Array): Promise<void> {
    this.ensureConnected();
    await this.device.receive(frame);
  }

  async read(): Promise<Uint8Array> {
    this.ensureConnected();
    return this.device.nextResponse();
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error("BLE adapter is not connected");
    }
  }
}
