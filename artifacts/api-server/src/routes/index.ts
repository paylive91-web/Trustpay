import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import ordersRouter from "./orders.js";
import transactionsRouter from "./transactions.js";
import dashboardRouter from "./dashboard.js";
import settingsRouter from "./settings.js";
import adminRouter from "./admin.js";
import p2pRouter from "./p2p.js";
import disputesRouter from "./disputes.js";
import upiRouter from "./upi.js";
import notificationsRouter from "./notifications.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/orders", ordersRouter);
router.use("/transactions", transactionsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/settings", settingsRouter);
router.use("/admin", adminRouter);
router.use("/p2p", p2pRouter);
router.use("/disputes", disputesRouter);
router.use("/upi", upiRouter);
router.use("/notifications", notificationsRouter);

export default router;
