import { releaseExpiredLocks, autoConfirmExpired } from "./matching.js";
import { logger } from "./logger.js";

let started = false;
let running = false;

export function startP2pSweeperJob() {
  if (started) return;
  started = true;

  const tick = async () => {
    // Skip overlap: if the previous tick is still working (e.g. DB slow),
    // don't start a second concurrent sweep — releaseExpiredLocks +
    // autoConfirmExpired both mutate the same orders table and could race.
    if (running) return;
    running = true;
    try {
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
    } finally {
      running = false;
    }
  };

  void tick();
  setInterval(() => { void tick(); }, 30_000);
}
