import { releaseExpiredLocks, autoConfirmExpired } from "./matching.js";
import { logger } from "./logger.js";

let started = false;

export function startP2pSweeperJob() {
  if (started) return;
  started = true;

  const tick = async () => {
    try {
      await releaseExpiredLocks();
    } catch (err) {
      logger.warn({ err }, "p2pSweeper: releaseExpiredLocks failed");
    }
    try {
      await autoConfirmExpired();
    } catch (err) {
      logger.warn({ err }, "p2pSweeper: autoConfirmExpired failed");
    }
  };

  void tick();
  setInterval(() => { void tick(); }, 30_000);
}
