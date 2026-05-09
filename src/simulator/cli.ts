import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { MockBleAdapter } from "../adapters/mockBleAdapter.js";
import { SharedSecretSecurityProvider } from "../core/security.js";
import { CarKeySession } from "../core/session.js";
import { ReadyAction } from "../core/types.js";
import { WatchKeyController } from "../watch/controller.js";

const controller = new WatchKeyController(
  new CarKeySession(
    new MockBleAdapter(),
    new SharedSecretSecurityProvider("hongshuhe-watch5-demo")
  )
);

const actionMap: Record<string, ReadyAction> = {
  "1": "lock",
  "2": "unlock",
  "3": "trunk",
  "4": "locate",
  "5": "panic"
};

async function main(): Promise<void> {
  console.log("红树河熊荣耀手表 5 蓝牙车钥匙原型");
  console.log("正在建立模拟会话...");
  const initialState = await controller.bootstrap();
  console.log(`连接状态: ${initialState.status} | ${initialState.lastMessage}`);

  const rl = readline.createInterface({ input, output });
  try {
    let keepRunning = true;
    while (keepRunning) {
      console.log("");
      console.log("请选择操作:");
      console.log("1. 锁车");
      console.log("2. 解锁");
      console.log("3. 开后备箱");
      console.log("4. 寻车");
      console.log("5. 警报");
      console.log("0. 退出");

      const answer = (await rl.question("> ")).trim();
      if (answer === "0") {
        keepRunning = false;
        continue;
      }

      const action = actionMap[answer];
      if (!action) {
        console.log("无效输入，请重新选择。");
        continue;
      }

      const result = await controller.trigger(action);
      console.log(`结果: ${result.toast}`);
      console.log(`当前状态: ${result.state.status}`);
    }
  } finally {
    await rl.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`程序异常: ${message}`);
  process.exitCode = 1;
});
