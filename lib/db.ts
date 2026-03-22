import sqlite3 from "sqlite3";

sqlite3.verbose();

export const db = new sqlite3.Database("ihaleler.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS ihaleler (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tender_id TEXT UNIQUE,
      metin TEXT,
      participants TEXT,
      material_list TEXT,
      announcement_text TEXT,
      tech_doc_url TEXT,
      admin_doc_url TEXT,
      tech_doc_filename TEXT,
      admin_doc_filename TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});