import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Datenbankdatei im Projektstamm
const dbPath = path.join(process.cwd(), 'ihaleler.db');

// Stelle sicher, dass das Verzeichnis existiert
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Tabelle anlegen (falls nicht vorhanden)
db.exec(`
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

export const getDb = () => db;