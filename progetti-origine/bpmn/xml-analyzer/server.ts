import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

// Middleware for parsing JSON bodies (increased limit to handle larger XML schemas)
app.use(express.json({ limit: "50mb" }));

const OUTPUT_DIR = path.join(process.cwd(), "output");

// Ensure output directory exists
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Sanitize a file name for safe use in a folder path
function sanitizeName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_").replace(/^_+|_+$/g, "");
  return cleaned || "file";
}

// ---------------------- API ROUTES ----------------------

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Persist an analysis result for a single XML file to disk.
// Body: { fileName, reportMd, schemaJson }
app.post("/api/output/save", (req, res) => {
  try {
    const { fileName, reportMd, schemaJson } = req.body;

    if (!fileName) {
      return res.status(400).json({ error: "Missing fileName." });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const safeName = sanitizeName(path.basename(fileName));
    const runDir = path.join(OUTPUT_DIR, `${timestamp}_${safeName}`);
    fs.mkdirSync(runDir, { recursive: true });

    fs.writeFileSync(path.join(runDir, "report.md"), reportMd || "", "utf-8");
    fs.writeFileSync(
      path.join(runDir, "schema.json"),
      JSON.stringify(schemaJson || {}, null, 2),
      "utf-8"
    );

    res.json({ ok: true, dir: path.basename(runDir), path: runDir });
  } catch (error: any) {
    console.error("Error saving output:", error);
    res.status(500).json({ error: error.message || "Failed to save output." });
  }
});

// List previously saved runs (output/<timestamp>_<fileName>/ folders)
app.get("/api/outputs", (req, res) => {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      return res.json({ runs: [] });
    }
    const runs = fs
      .readdirSync(OUTPUT_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => {
        const dir = path.join(OUTPUT_DIR, d.name);
        const files = fs.readdirSync(dir).map((f) => f);
        return { name: d.name, path: dir, files };
      })
      .sort((a, b) => b.name.localeCompare(a.name));

    res.json({ runs });
  } catch (error: any) {
    console.error("Error listing outputs:", error);
    res.status(500).json({ error: error.message || "Failed to list outputs." });
  }
});

// Read a file from a saved run: /api/output/:runName/:fileName
app.get("/api/output/:runName/:fileName", (req, res) => {
  try {
    const runName = sanitizeName(req.params.runName);
    const fileName = sanitizeName(req.params.fileName);
    const filePath = path.join(OUTPUT_DIR, runName, fileName);

    if (!filePath.startsWith(OUTPUT_DIR) || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found." });
    }

    const content = fs.readFileSync(filePath, "utf-8");
    if (fileName.endsWith(".json")) {
      res.json(JSON.parse(content));
    } else {
      res.type("text/markdown").send(content);
    }
  } catch (error: any) {
    console.error("Error reading output file:", error);
    res.status(500).json({ error: error.message || "Failed to read output file." });
  }
});

// ---------------------- VITE / STATIC SETUP ----------------------

async function initializeApp() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static production files from dist.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`XML Analyzer Server running on http://0.0.0.0:${PORT}`);
  });
}

initializeApp().catch((err) => {
  console.error("Failed to start server:", err);
});
