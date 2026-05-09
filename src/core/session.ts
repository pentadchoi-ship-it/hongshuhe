import { BleAdapter, DeviceIdentity, KeyCommand, ReadyAction, SecurityProvider, SessionSnapshot } from "./types.js";
import {
  createFrame,
  decodeAckPayload,
  decodeChallengePayload,
  decodeFrame
} from "./protocol.js";

const ACTION_TO_COMMAND: Record<ReadyAction, KeyCommand> = {
  lock: KeyCommand.Lock,
  unlock: KeyCommand.Unlock,
  trunk: KeyCommand.Trunk,
  locate: KeyCommand.Locate,
  panic: KeyCommand.Panic
};

export class CarKeySession {
  private snapshot: SessionSnapshot = {
    status: "idle",
    lastSequence: 0
  };

  constructor(
    private readonly adapter: BleAdapter,
    private readonly securityProvider: SecurityProvider
  ) {}

  getState(): SessionSnapshot {
    return {
      ...this.snapshot
    };
  }

  async connect(preferredName = "HongShuhe Bear Key"): Promise<SessionSnapshot> {
    this.updateState({ status: "scanning", lastMessage: "正在搜索蓝牙车钥匙..." });
    const devices = await this.adapter.scan(5_000);
    const target = devices.find((device) => device.name.includes(preferredName)) ?? devices[0];

    if (!target) {
      throw this.fail("未发现蓝牙车钥匙设备");
    }

    this.updateState({
      status: "connecting",
      device: target,
      lastMessage: `正在连接 ${target.name}`
    });
    await this.adapter.connect(target);
    this.updateState({
      status: "connected",
      device: target,
      lastMessage: "蓝牙连接已建立"
    });

    await this.authenticate(target);
    return this.getState();
  }

  async disconnect(): Promise<void> {
    await this.adapter.disconnect();
    this.snapshot = {
      status: "idle",
      lastSequence: this.snapshot.lastSequence
    };
  }

  async perform(action: ReadyAction): Promise<string> {
    if (this.snapshot.status !== "ready") {
      throw this.fail("当前会话尚未就绪，不能发送车钥匙指令");
    }

    const command = ACTION_TO_COMMAND[action];
    await this.adapter.write(createFrame(command, this.nextSequence()));
    const response = decodeFrame(await this.adapter.read());

    if (response.command !== KeyCommand.Ack) {
      throw this.fail(`设备返回了意外命令: ${response.command}`);
    }

    const ack = decodeAckPayload(response.payload);
    if (!ack.ok) {
      throw this.fail(ack.message || "设备拒绝执行指令");
    }

    this.updateState({
      status: "ready",
      lastMessage: ack.message
    });
    return ack.message;
  }

  private async authenticate(device: DeviceIdentity): Promise<void> {
    this.updateState({
      status: "authenticating",
      lastMessage: "正在进行安全握手"
    });

    const hello = this.securityProvider.createClientHello(device);
    await this.adapter.write(createFrame(KeyCommand.Handshake, this.nextSequence(), hello));

    const challengeFrame = decodeFrame(await this.adapter.read());
    if (challengeFrame.command !== KeyCommand.Challenge) {
      throw this.fail("设备没有返回挑战码");
    }

    const challenge = decodeChallengePayload(challengeFrame.payload);
    const answer = await this.securityProvider.solveChallenge(challenge);
    await this.adapter.write(createFrame(KeyCommand.ChallengeResponse, this.nextSequence(), answer));

    const ackFrame = decodeFrame(await this.adapter.read());
    if (ackFrame.command !== KeyCommand.Ack) {
      throw this.fail("认证确认帧缺失");
    }

    const ack = decodeAckPayload(ackFrame.payload);
    if (!ack.ok) {
      throw this.fail(ack.message || "认证失败");
    }

    this.updateState({
      status: "ready",
      sessionId: challenge.sessionId,
      lastMessage: ack.message
    });
  }

  private nextSequence(): number {
    this.snapshot.lastSequence = (this.snapshot.lastSequence + 1) & 0xff;
    return this.snapshot.lastSequence;
  }

  private updateState(patch: Partial<SessionSnapshot>): void {
    this.snapshot = {
      ...this.snapshot,
      ...patch
    };
  }

  private fail(message: string): Error {
    this.updateState({
      status: "error",
      lastMessage: message
    });
    return new Error(message);
  }
}
