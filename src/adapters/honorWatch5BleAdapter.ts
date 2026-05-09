import { BleAdapter, Bytes, DeviceIdentity } from "../core/types.js";

export interface CarKeyGattProfile {
  serviceUuid: string;
  writeCharacteristicUuid: string;
  notifyCharacteristicUuid: string;
}

export interface HonorBlePeripheral {
  deviceId: string;
  name: string;
  rssi?: number;
}

export interface HonorScanOptions {
  timeoutMs: number;
  nameHint?: string;
}

export interface HonorGattConnection {
  write(serviceUuid: string, characteristicUuid: string, value: Bytes): Promise<void>;
  subscribe(
    serviceUuid: string,
    characteristicUuid: string,
    onValue: (value: Bytes) => void
  ): Promise<() => Promise<void> | void>;
  disconnect(): Promise<void>;
}

export interface HonorWatchBlePlatform {
  scan(options: HonorScanOptions): Promise<HonorBlePeripheral[]>;
  connect(deviceId: string): Promise<HonorGattConnection>;
}

export class HonorWatch5BleAdapter implements BleAdapter {
  private connection?: HonorGattConnection;
  private unsubscribe?: () => Promise<void> | void;
  private pendingFrames: Bytes[] = [];
  private readResolvers: Array<(value: Bytes) => void> = [];

  constructor(
    private readonly platform: HonorWatchBlePlatform,
    private readonly profile: CarKeyGattProfile,
    private readonly scanNameHint = "HongShuhe Bear Key"
  ) {}

  async scan(timeoutMs = 5_000): Promise<DeviceIdentity[]> {
    const peripherals = await this.platform.scan({
      timeoutMs,
      nameHint: this.scanNameHint
    });

    return peripherals.map((peripheral) => ({
      name: peripheral.name,
      address: peripheral.deviceId,
      rssi: peripheral.rssi
    }));
  }

  async connect(device: DeviceIdentity): Promise<void> {
    this.connection = await this.platform.connect(device.address);
    this.unsubscribe = await this.connection.subscribe(
      this.profile.serviceUuid,
      this.profile.notifyCharacteristicUuid,
      (value) => this.pushFrame(value)
    );
  }

  async disconnect(): Promise<void> {
    const unsubscribe = this.unsubscribe;
    const connection = this.connection;
    this.unsubscribe = undefined;
    this.connection = undefined;
    this.pendingFrames = [];
    this.readResolvers = [];

    if (unsubscribe) {
      await unsubscribe();
    }

    if (connection) {
      await connection.disconnect();
    }
  }

  async write(frame: Bytes): Promise<void> {
    if (!this.connection) {
      throw new Error("Honor Watch 5 BLE adapter is not connected");
    }

    await this.connection.write(
      this.profile.serviceUuid,
      this.profile.writeCharacteristicUuid,
      frame
    );
  }

  async read(): Promise<Bytes> {
    const pending = this.pendingFrames.shift();
    if (pending) {
      return pending;
    }

    return new Promise<Bytes>((resolve) => {
      this.readResolvers.push(resolve);
    });
  }

  private pushFrame(value: Bytes): void {
    const resolver = this.readResolvers.shift();
    if (resolver) {
      resolver(value);
      return;
    }

    this.pendingFrames.push(value);
  }
}
