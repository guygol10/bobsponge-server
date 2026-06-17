const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://guygol10_db_user:zxgs9uyALbozyfJI@bobsponge.heiz2lj.mongodb.net/bobsponge?appName=Bobsponge";
mongoose.connect(MONGO_URI).then(() => console.log("✅ MongoDB connected")).catch(e => console.error("MongoDB error:", e));

// ─── Schemas ───────────────────────────────────────────────────────────────
const AppDataSchema = new mongoose.Schema({
  key:       { type: String, required: true, unique: true },
  data:      mongoose.Schema.Types.Mixed,
  updatedAt: { type: Date, default: Date.now },
});
const AppData = mongoose.model("AppData", AppDataSchema);

const SeizureSchema = new mongoose.Schema({
  timestamp: Date,
  duration:  String,
  triggers:  String,
  postState: String,
  notes:     String,
  createdAt: { type: Date, default: Date.now },
});
const Seizure = mongoose.model("Seizure", SeizureSchema);

const MedLogSchema = new mongoose.Schema({
  slotId:   String,
  label:    String,
  time:     String,
  takenAt:  Date,
  date:     String, // YYYY-MM-DD
});
const MedLog = mongoose.model("MedLog", MedLogSchema);

// ─── Routes ────────────────────────────────────────────────────────────────

// שמירת הגדרות (תרופות, שעות, רופאים)
app.post("/api/settings", async (req, res) => {
  try {
    const { key, data } = req.body;
    await AppData.findOneAndUpdate({ key }, { data, updatedAt: new Date() }, { upsert: true, new: true });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// קבלת הגדרות
app.get("/api/settings/:key", async (req, res) => {
  try {
    const doc = await AppData.findOne({ key: req.params.key });
    res.json({ ok: true, data: doc?.data || null });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// שמירת לוח תרופות יומי (מתאפס כל יום)
app.post("/api/today", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    await AppData.findOneAndUpdate(
      { key: `today_${today}` },
      { data: req.body, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// קבלת לוח תרופות יומי
app.get("/api/today", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const doc = await AppData.findOne({ key: `today_${today}` });
    res.json({ ok: true, data: doc?.data || null });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// שמירת התקף
app.post("/api/seizures", async (req, res) => {
  try {
    const seizure = await Seizure.create(req.body);
    res.json({ ok: true, id: seizure._id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// קבלת כל ההתקפים
app.get("/api/seizures", async (req, res) => {
  try {
    const seizures = await Seizure.find().sort({ createdAt: -1 }).limit(100);
    res.json({ ok: true, data: seizures });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// רישום נטילת תרופה
app.post("/api/medlog", async (req, res) => {
  try {
    const log = await MedLog.create({ ...req.body, date: new Date().toISOString().split("T")[0] });
    res.json({ ok: true, id: log._id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// היסטוריית נטילת תרופות (30 יום אחרונים)
app.get("/api/medlog", async (req, res) => {
  try {
    const logs = await MedLog.find().sort({ takenAt: -1 }).limit(200);
    res.json({ ok: true, data: logs });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Health check
app.get("/", (req, res) => res.json({ status: "בובספוג שרת פעיל! 🧽", time: new Date() }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🧽 בובספוג שרת פועל על פורט ${PORT}`));
