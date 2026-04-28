import Database from "better-sqlite3";

const db = new Database("./server/ad-hub.db");

db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'Viewer',
    access TEXT DEFAULT 'Limited Access',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`).run();

const userColumns = db.pragma("table_info(users)");
const hasPasswordHashColumn = userColumns.some(
  (column) => column.name === "password_hash"
);

if (!hasPasswordHashColumn) {
  db.prepare("ALTER TABLE users ADD COLUMN password_hash TEXT").run();
}

const ownerEmail = "ronald.thebossroland@gmail.com";

const insertOwnerUser = db.prepare(`
  INSERT OR IGNORE INTO users (name, email, role, access, is_active)
  VALUES (@name, @email, @role, @access, @isActive)
`);

const ownerUser = {
  name: "Ronald Roland",
  email: ownerEmail,
  role: "Super Admin",
  access: "Full Access",
  isActive: 1,
};

insertOwnerUser.run(ownerUser);

export default db;
