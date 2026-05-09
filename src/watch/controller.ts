import { CarKeySession } from "../core/session.js";
import { ReadyAction, SessionSnapshot } from "../core/types.js";

export interface WatchActionCard {
  id: ReadyAction;
  title: string;
  confirmText: string;
  danger?: boolean;
}

export const DEFAULT_ACTIONS: WatchActionCard[] = [
  { id: "lock", title: "锁车", confirmText: "确认落锁车辆？" },
  { id: "unlock", title: "解锁", confirmText: "确认解锁车辆？" },
  { id: "trunk", title: "开后备箱", confirmText: "确认打开后备箱？" },
  { id: "locate", title: "寻车", confirmText: "确认闪灯鸣笛寻找车辆？" },
  { id: "panic", title: "警报", confirmText: "确认触发警报模式？", danger: true }
];

export class WatchKeyController {
  constructor(private readonly session: CarKeySession) {}

  async bootstrap(): Promise<SessionSnapshot> {
    return this.session.connect();
  }

  async trigger(action: ReadyAction): Promise<{ state: SessionSnapshot; toast: string }> {
    const toast = await this.session.perform(action);
    return {
      state: this.session.getState(),
      toast
    };
  }

  getState(): SessionSnapshot {
    return this.session.getState();
  }

  getActions(): WatchActionCard[] {
    return DEFAULT_ACTIONS;
  }
}
