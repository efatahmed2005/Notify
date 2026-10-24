import { configuration } from "./config.js";
import { openDatabase, transaction } from "./db.js";
import { createApp } from "./app.js";
const config = configuration();
const db = openDatabase(config.databasePath);

const deptCount = db.prepare("SELECT count(*) as count FROM departments").get().count;
if (deptCount === 0) {
  const defaultDepts = [
    ["dept-cse", "CSE", "Computer Science & Engineering"],
    ["dept-eee", "EEE", "Electrical & Electronic Engineering"],
    ["dept-me", "ME", "Mechanical Engineering"],
    ["dept-ell", "ELL", "English Language & Literature"],
    ["dept-bba", "BBA", "Business Administration"],
    ["dept-ce", "CE", "Civil Engineering"],
    ["dept-law", "LAW", "Department of Law"],
  ];
  transaction(db, () => {
    const stmt = db.prepare("INSERT OR IGNORE INTO departments(id,code,name,active,created_at) VALUES(?,?,?,1,?)");
    for (const [id, code, name] of defaultDepts) {
      stmt.run(id, code, name, Date.now());
    }
  });
}
if (!config.production) {
  db.prepare("UPDATE users SET must_change_password=0 WHERE role='ADMIN' AND must_change_password=1").run();
}
import { startDocumentWorker } from "./documents.js";
const stopDocumentWorker = startDocumentWorker(db);
const app = await createApp({ ...config, db });
const server = app.listen(
  Number(process.env.PORT || 8080),
  process.env.HOST || "0.0.0.0",
  () =>
    console.log(
      `Notify is running at ${config.origin}. Open this address in your browser; Live Server does not provide the API.`,
    ),
);
function shutdown() {
  server.close(async () => {
    await stopDocumentWorker();
    db.close();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
