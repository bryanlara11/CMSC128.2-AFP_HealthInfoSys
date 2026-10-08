import express from "express";
import multer from "multer";
import { fileURLToPath } from "url";
import path from "path";
import { parseExcel } from "./parseExcel.js";

const app = express();
const PORT = 3000;

// --- Multer configuration ---
// Memory storage: file bytes stay in RAM as a Buffer (no temp files on disk)
// This is fine for a PoC with small files; avoids temp-file cleanup
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Check file extension (client-supplied, so not fully trusted — see Step 8 byte check)
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".xlsx") {
      const err = new Error(
        "Invalid file type. Only .xlsx files are accepted."
      );
      err.status = 400;
      return cb(err, false);
    }
    cb(null, true);
  },
});

// --- Upload endpoint ---
app.post("/api/upload", upload.single("file"), (req, res) => {
  // Check if a file was actually sent
  if (!req.file) {
    return res.status(400).json({
      error: "No file uploaded. Please select a .xlsx file.",
    });
  }

  const buffer = req.file.buffer;

  // Step 8: Strengthen validation beyond extension
  // An .xlsx file is a ZIP archive, so its first bytes are PK (0x50 0x4B)
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    return res.status(400).json({
      error:
        "File does not appear to be a valid .xlsx file. " +
        "The file signature (magic bytes) does not match a ZIP/XLSX archive. " +
        "An .xls (legacy Excel) file is not supported — please save as .xlsx.",
    });
  }

  // Parse the workbook — wrap in try/catch for corrupt/unparseable files
  try {
    const result = parseExcel(buffer);

    // API response contract (Step 6)
    return res.json({
      filename: req.file.originalname,
      sheets: result.sheets,
    });
  } catch (err) {
    console.error("Parse error:", err.message);
    return res.status(422).json({
      error: `Failed to parse Excel file: ${err.message}`,
    });
  }
});

// --- Error-handling middleware for multer and other errors ---
// This catches multer errors (e.g. file too large) that happen BEFORE the route handler
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: "File is too large. Maximum allowed size is 5 MB.",
      });
    }
    return res.status(400).json({
      error: `Upload error: ${err.message}`,
    });
  }

  // Custom errors from fileFilter or other middleware
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  // Unexpected errors
  console.error("Unexpected error:", err);
  return res.status(500).json({
    error: "An unexpected server error occurred.",
  });
});

// --- Start the server ---
app.listen(PORT, () => {
  console.log(`Excel Import PoC running at http://localhost:${PORT}`);
});
