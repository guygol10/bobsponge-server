const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// MySQL connection pool
const pool = mysql.createPool({
  host:     process.env.MYSQL_HOST     || "mysql-bobsponge-bobsponge.b.aivencloud.com",
  port:     process.env.MYSQL_PORT     || 26255,
  user:     process.env.MYSQL_USER     || "avnadmin",
  password: process.env.MYSQL_PASSWORD || "AVNS_n_dDXTqoQjDMm9WKLBK",
  database: process.env.MYSQL_DB       || "defaultdb",
  ssl:      { rejectUnauthorized: false },
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});

// יצירת טבלאות אם לא קיימות
async function initDB() {
  const conn = await pool.getConnection();
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS appdata (
        \`key\` VARCHAR(255) PRIMARY KEY,
        data LONGTEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS seizures (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp DATETIME,
        duration VARCHAR(100),
        triggers TEXT,
        post_state TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS medlog (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slot_id VARCHAR(50),
        label VARCHAR(100),
        time VARCHAR(10),
        taken_at DATETIME,
        log_date VARCHAR(20),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ טבלאות נוצרו בהצלחה");
  } finally {
    conn.release();
  }
}

// ─── Routes ────────────────────────────────────────────────────────────────
app.get("/", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "בובספוג שרת פעיל! 🧽", db: "MySQL ✅", time: new Date() });
  } catch(e) {
    res.json({ status: "שרת פעיל אבל DB בעיה ⚠️", error: e.message });
  }
});

// שמירת הגדרות
app.post("/api/settings", async (req, res) => {
  try {
    const { key, data } = req.body;
    const json = JSON.stringify(data);
    await pool.execute(
      "INSERT INTO appdata (`key`, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = ?, updated_at = NOW()",
      [key, json, json]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// קבלת הגדרות
app.get("/api/settings/:key", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT data FROM appdata WHERE `key` = ?", [req.params.key]);
    const data = rows[0] ? JSON.parse(rows[0].data) : null;
    res.json({ ok: true, data });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// שמירת לוח היום
app.post("/api/today", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const key = `today_${today}`;
    const json = JSON.stringify(req.body);
    await pool.execute(
      "INSERT INTO appdata (`key`, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = ?, updated_at = NOW()",
      [key, json, json]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// קבלת לוח היום
app.get("/api/today", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const [rows] = await pool.execute("SELECT data FROM appdata WHERE `key` = ?", [`today_${today}`]);
    const data = rows[0] ? JSON.parse(rows[0].data) : null;
    res.json({ ok: true, data });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// שמירת התקף
app.post("/api/seizures", async (req, res) => {
  try {
    const { timestamp, duration, triggers, postState, notes } = req.body;
    const [result] = await pool.execute(
      "INSERT INTO seizures (timestamp, duration, triggers, post_state, notes) VALUES (?, ?, ?, ?, ?)",
      [timestamp || new Date(), duration || "", triggers || "", postState || "", notes || ""]
    );
    res.json({ ok: true, id: result.insertId });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// קבלת התקפים
app.get("/api/seizures", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM seizures ORDER BY created_at DESC LIMIT 100");
    const data = rows.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      duration: r.duration,
      triggers: r.triggers,
      postState: r.post_state,
      notes: r.notes,
    }));
    res.json({ ok: true, data });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// רישום נטילת תרופה
app.post("/api/medlog", async (req, res) => {
  try {
    const { slotId, label, time, takenAt } = req.body;
    const today = new Date().toISOString().split("T")[0];
    // המר תאריך ISO ל-MySQL datetime
    const takenAtDate = takenAt ? new Date(takenAt) : new Date();
    await pool.execute(
      "INSERT INTO medlog (slot_id, label, time, taken_at, log_date) VALUES (?, ?, ?, ?, ?)",
      [slotId||"", label||"", time||"", takenAtDate, today]
    );
    res.json({ ok: true });
  } catch(e) { 
    console.error("medlog error:", e.message);
    res.status(500).json({ error: e.message }); 
  }
});

// היסטוריית נטילה
app.get("/api/medlog", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM medlog ORDER BY taken_at DESC LIMIT 200");
    res.json({ ok: true, data: rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// אתחול DB והפעלת שרת
const PORT = process.env.PORT || 3001;
initDB().then(() => {
  app.listen(PORT, () => console.log(`🧽 בובספוג שרת MySQL פועל על פורט ${PORT}`));
}).catch(e => {
  console.error("❌ שגיאת אתחול DB:", e.message);
  process.exit(1);
});

module.exports = app;
