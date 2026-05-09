export const PROTOCOL_VERSION = 1;
export const FRAME_MAGIC = 0xa7;

export type Bytes = Uint8Array<ArrayBufferLike>;

export enum KeyCommand {
  Handshake = 0x01,
  Challenge = 0x02,
  ChallengeResponse = 0x03,
  Heartbeat = 0x04,
  Lock = 0x10,
  Unlock = 0x11,
  Trunk = 0x12,
  Locate = 0x13,
  Panic = 0x14,
  Ack = 0x7e,
  Error = 0x7f
}

export type ReadyAction = "lock" | "unlock" | "trunk" | "locate" | "panic";

export type SessionStatus =
  | "idle"
  | "scanning"
  | "connecting"
  | "connected"
  | "authenticating"
  | "ready"
  | "error";

export interface DeviceIdentity {
  name: string;
  address: string;
  rssi?: number;
}

export interface ProtocolFrame {
  version: number;
  command: KeyCommand;
  sequence: number;
  payload: Bytes;
}

export interface AckPayload {
  ok: boolean;
  command: KeyCommand;
  message: string;
}

export interface ChallengePayload {
  nonce: Bytes;
  sessionId: number;
}

export interface SessionSnapshot {
  status: SessionStatus;
  device?: DeviceIdentity;
  lastMessage?: string;
  sessionId?: number;
  lastSequence: number;
}

export interface SecurityProvider {
  createClientHello(device: DeviceIdentity): Bytes;
  solveChallenge(challenge: ChallengePayload): Promise<Bytes> | Bytes;
}

export interface BleAdapter {
  scan(timeoutMs?: number): Promise<DeviceIdentity[]>;
  connect(device: DeviceIdentity): Promise<void>;
  disconnect(): Promise<void>;
  write(frame: Bytes): Promise<void>;
  read(): Promise<Bytes>;
}
