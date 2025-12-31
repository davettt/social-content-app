import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "..", "..", "..", "local_data");
const PROJECTS_DIR = path.join(DATA_DIR, "projects");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

export async function initializeStorage() {
  // Create main directories
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(PROJECTS_DIR, { recursive: true });

  // Create default settings if not exists
  try {
    await fs.access(SETTINGS_FILE);
  } catch {
    await fs.writeFile(
      SETTINGS_FILE,
      JSON.stringify(
        {
          version: "1.0.0",
          createdAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  }

  console.log("Storage initialized at:", DATA_DIR);
}

export async function getProjectDir(projectId) {
  const projectDir = path.join(PROJECTS_DIR, projectId);
  return projectDir;
}

export async function ensureProjectDirs(projectId) {
  const projectDir = await getProjectDir(projectId);
  const dirs = [
    projectDir,
    path.join(projectDir, "media", "originals"),
    path.join(projectDir, "media", "thumbnails"),
    path.join(projectDir, "media", "processed"),
    path.join(projectDir, "posts"),
    path.join(projectDir, "exports"),
    path.join(projectDir, "brand"),
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  return projectDir;
}

export async function readJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writeJsonFile(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export async function deleteDirectory(dirPath) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    console.error("Error deleting directory:", error);
    throw error;
  }
}

export async function listDirectories(parentDir) {
  try {
    const entries = await fs.readdir(parentDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export { DATA_DIR, PROJECTS_DIR };
