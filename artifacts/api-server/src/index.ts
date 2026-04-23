// Must be set before any TLS/SSL connection is made (including pg Pool connect).
// This bypasses self-signed certificate errors from Supabase pooler on Render.
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

import app from "./app";
import { logger } from "./lib/logger";
import { ensureSchema } from "./lib/migrate";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

ensureSchema().finally(() => {
  const server = app.listen(port, () => {
    logger.info({ port }, "Server listening");
  });

  server.on("error", (err: any) => {
    if (err?.code === "EADDRINUSE") {
      logger.error({ err, port }, "Port already in use");
      return;
    }
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  });
});
