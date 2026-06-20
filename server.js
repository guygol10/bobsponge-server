const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI;
let isConnected = false;

async function connectDB() {
  if (isConnected) return;
  await mongoose.connect(MONGO_URI);
  isConnected = true;
  console.log("✅ MongoDB connected");
}

// ─── Schemas ───────────────────────────────────────────────────────────────
const AppDataSchema = new mongoose.Schema({
  key:       { type: String, required: true, unique: true },
  data:      mongoose.Schema.Types.Mixed,
  updatedAt: { type: Date, default: Date.now },
});
const AppData = mongoose.models.AppData || mongoose.model("AppData", AppDataSchema);

const SeizureSchema = new mongoose.Schema({
  timestamp: Date,
  duration:  String,
  triggers:  String,
  postState: String,
  notes:     String,
  createdAt: { type: Date, default: Date.now },
});
const Seizure = mongoose.models.Seizure || mongoose.model("Seizure", SeizureSchema);

const MedLogSchema = new mongoose.Schema({
  slotId:  String,
  label:   String,
  time:    String,
  takenAt: Date,
  date:    String,
});
const MedLog = mongoose.models.MedLog || mongoose.model("MedLog", MedLogSchema);

// ─── Middleware לחיבור DB בכל בקשה ────────────────────────────────────────
app.use(async (req, res, next) => {
  try { await connectDB(); next(); }
  catch(e) { res.status(500).json({ error: "DB connection failed" }); }
});

// ─── Routes ────────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.json({ status: "בובספוג שרת פעיל! 🧽", time: new Date() }));

app.post("/api/settings", async (req, res) => {
  try {
    const { key, data } = req.body;
    await AppData.findOneAndUpdate({ key }, { data, updatedAt: new Date() }, { upsert: true, new: true });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/settings/:key", async (req, res) => {
  try {
    const doc = await AppData.findOne({ key: req.params.key });
    res.json({ ok: true, data: doc?.data || null });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

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

app.get("/api/today", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const doc = await AppData.findOne({ key: `today_${today}` });
    res.json({ ok: true, data: doc?.data || null });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/seizures", async (req, res) => {
  try {
    const s = await Seizure.create(req.body);
    res.json({ ok: true, id: s._id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/seizures", async (req, res) => {
  try {
    const data = await Seizure.find().sort({ createdAt: -1 }).limit(100);
    res.json({ ok: true, data });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/medlog", async (req, res) => {
  try {
    const log = await MedLog.create({ ...req.body, date: new Date().toISOString().split("T")[0] });
    res.json({ ok: true, id: log._id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/medlog", async (req, res) => {
  try {
    const data = await MedLog.find().sort({ takenAt: -1 }).limit(200);
    res.json({ ok: true, data });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = app;

// הפעלה מקומית
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`🧽 שרת פועל על פורט ${PORT}`));
}
