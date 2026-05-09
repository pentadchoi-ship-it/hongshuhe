import {
  AckPayload,
  Bytes,
  ChallengePayload,
  FRAME_MAGIC,
  KeyCommand,
  PROTOCOL_VERSION,
  ProtocolFrame
} from "./types.js";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function encodeFrame(frame: ProtocolFrame): Bytes {
  const payloadLength = frame.payload.length;
  const bytes = new Uint8Array(8 + payloadLength);
  bytes[0] = FRAME_MAGIC;
  bytes[1] = frame.version;
  bytes[2] = frame.command;
  bytes[3] = frame.sequence & 0xff;
  bytes[4] = payloadLength & 0xff;
  bytes[5] = (payloadLength >> 8) & 0xff;
  bytes.set(frame.payload, 6);
  const crc = crc16(bytes.subarray(0, 6 + payloadLength));
  bytes[6 + payloadLength] = crc & 0xff;
  bytes[7 + payloadLength] = (crc >> 8) & 0xff;
  return bytes;
}

export function decodeFrame(bytes: Bytes): ProtocolFrame {
  if (bytes.length < 8) {
    throw new Error("Frame too short");
  }

  if (bytes[0] !== FRAME_MAGIC) {
    throw new Error("Invalid frame magic");
  }

  const payloadLength = bytes[4] | (bytes[5] << 8);
  const expectedLength = 8 + payloadLength;
  if (bytes.length !== expectedLength) {
    throw new Error(`Invalid frame length: expected ${expectedLength}, got ${bytes.length}`);
  }

  const expectedCrc = bytes[6 + payloadLength] | (bytes[7 + payloadLength] << 8);
  const actualCrc = crc16(bytes.subarray(0, 6 + payloadLength));
  if (expectedCrc !== actualCrc) {
    throw new Error("CRC check failed");
  }

  return {
    version: bytes[1],
    command: bytes[2] as KeyCommand,
    sequence: bytes[3],
    payload: bytes.subarray(6, 6 + payloadLength)
  };
}

export function createFrame(command: KeyCommand, sequence: number, payload: Bytes = new Uint8Array()): Bytes {
  return encodeFrame({
    version: PROTOCOL_VERSION,
    command,
    sequence,
    payload
  });
}

export function encodeStringPayload(value: string): Bytes {
  return textEncoder.encode(value);
}

export function decodeStringPayload(value: Bytes): string {
  return textDecoder.decode(value);
}

export function encodeChallengePayload(sessionId: number, nonce: Bytes): Bytes {
  if (nonce.length !== 16) {
    throw new Error("Challenge nonce must be 16 bytes");
  }

  const payload = new Uint8Array(20);
  payload[0] = sessionId & 0xff;
  payload[1] = (sessionId >> 8) & 0xff;
  payload[2] = (sessionId >> 16) & 0xff;
  payload[3] = (sessionId >> 24) & 0xff;
  payload.set(nonce, 4);
  return payload;
}

export function decodeChallengePayload(payload: Bytes): ChallengePayload {
  if (payload.length !== 20) {
    throw new Error("Challenge payload must be 20 bytes");
  }

  const sessionId =
    payload[0] |
    (payload[1] << 8) |
    (payload[2] << 16) |
    (payload[3] << 24);

  return {
    sessionId,
    nonce: payload.subarray(4, 20)
  };
}

export function encodeAckPayload(command: KeyCommand, ok: boolean, message: string): Bytes {
  const messageBytes = encodeStringPayload(message);
  const payload = new Uint8Array(2 + messageBytes.length);
  payload[0] = command;
  payload[1] = ok ? 1 : 0;
  payload.set(messageBytes, 2);
  return payload;
}

export function decodeAckPayload(payload: Bytes): AckPayload {
  if (payload.length < 2) {
    throw new Error("Ack payload too short");
  }

  return {
    command: payload[0] as KeyCommand,
    ok: payload[1] === 1,
    message: decodeStringPayload(payload.subarray(2))
  };
}

export function crc16(bytes: Bytes): number {
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      const odd = crc & 0x0001;
      crc >>= 1;
      if (odd) {
        crc ^= 0xa001;
      }
    }
  }
  return crc & 0xffff;
}
