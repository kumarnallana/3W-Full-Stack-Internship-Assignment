import { createServer } from "node:http";
import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { env } from "./config/env.js";

let server;

async function start() {
  await connectDatabase();
  server = createServer(createApp());
  server.listen(env.port, () => {
    console.log(`Mini Social API listening on http://localhost:${env.port}`);
  });
}

async function shutdown(signal) {
  console.log(`${signal} received. Closing Mini Social API.`);
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDatabase();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start().catch((error) => {
  console.error("Mini Social API could not start:", error.message);
  process.exit(1);
});
