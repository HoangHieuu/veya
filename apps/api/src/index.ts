import cors from "cors";
import express from "express";
import { registerRecommendRoutes } from "./routes/recommend.js";

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "veya-api", status: "stub" });
});

registerRecommendRoutes(app);

app.listen(port, () => {
  console.log(`Veya API listening on http://localhost:${port}`);
});
