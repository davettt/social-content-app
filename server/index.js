import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import net from "net";
import { fileURLToPath } from "url";
import { initializeStorage } from "./src/utils/storage.js";
import projectsRouter from "./src/routes/projects.js";
import mediaRouter from "./src/routes/media.js";
import aiRouter from "./src/routes/ai.js";
import exportRouter from "./src/routes/export.js";
import { errorHandler } from "./src/middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const DEFAULT_PORT = parseInt(process.env.PORT || "3001", 10);
const MAX_PORT_ATTEMPTS = 10;

// Check if a port is available
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

// Find an available port starting from the default
async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + MAX_PORT_ATTEMPTS; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
    console.log(`Port ${port} is in use, trying ${port + 1}...`);
  }
  throw new Error(
    `No available ports found between ${startPort} and ${startPort + MAX_PORT_ATTEMPTS - 1}`,
  );
}

// Initialize storage directories
await initializeStorage();

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Serve static files from local_data for media access
app.use(
  "/media",
  express.static(path.join(__dirname, "..", "local_data", "projects")),
);

// API Routes
app.use("/api/projects", projectsRouter);
app.use("/api/media", mediaRouter);
app.use("/api/ai", aiRouter);
app.use("/api/export", exportRouter);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Start server with port fallback
const PORT = await findAvailablePort(DEFAULT_PORT);

// Store port in app.locals so routes can access it
app.locals.serverPort = PORT;

// Write port to file for vite proxy to read
const portFilePath = path.join(__dirname, "..", ".server-port");
fs.writeFileSync(portFilePath, PORT.toString());

// Listen on all interfaces (0.0.0.0) to allow access from other devices on the network
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Network access: http://0.0.0.0:${PORT}`);
  if (PORT !== DEFAULT_PORT) {
    console.log(
      `Note: Default port ${DEFAULT_PORT} was in use, using ${PORT} instead`,
    );
  }
});
