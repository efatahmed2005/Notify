import { configuration } from "./config.js";
import { openDatabase } from "./db.js";
import { createApp } from "./app.js";
const config = configuration();
const db = openDatabase(config.databasePath);
const app = await createApp({ ...config, db });
const server = app.listen(
  Number(process.env.PORT || 8080),
  process.env.HOST || "127.0.0.1",
  () => console.log("Notify server listening."),
);
function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
