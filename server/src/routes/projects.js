import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import {
  PROJECTS_DIR,
  ensureProjectDirs,
  readJsonFile,
  writeJsonFile,
  deleteDirectory,
  listDirectories,
  getProjectDir,
} from '../utils/storage.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';

const router = express.Router();

// Default values for new projects
const defaultBusinessInfo = {
  description: '',
  services: [],
  tone: 'professional',
};

const defaultContactInfo = {
  socialHandles: {},
};

const defaultBrandKit = {
  primaryColor: '#3b82f6',
  secondaryColor: '#f59e0b',
  accentColor: '#10b981',
  fonts: {
    heading: 'Inter',
    body: 'Inter',
  },
};

const defaultSettings = {
  defaultPlatforms: ['instagram', 'threads', 'twitter'],
  watermarkEnabled: false,
};

// GET /api/projects - List all projects
router.get('/', async (req, res, next) => {
  try {
    const projectIds = await listDirectories(PROJECTS_DIR);
    const projects = [];

    for (const id of projectIds) {
      const projectDir = await getProjectDir(id);
      const projectFile = path.join(projectDir, 'project.json');
      const project = await readJsonFile(projectFile);
      if (project) {
        projects.push(project);
      }
    }

    // Sort by updatedAt descending
    projects.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    res.json(projects);
  } catch (error) {
    next(error);
  }
});

// POST /api/projects - Create a new project
router.post('/', async (req, res, next) => {
  try {
    const { name, businessInfo, contactInfo, brandKit } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('Project name is required');
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const project = {
      id,
      name: name.trim(),
      createdAt: now,
      updatedAt: now,
      businessInfo: { ...defaultBusinessInfo, ...businessInfo },
      contactInfo: { ...defaultContactInfo, ...contactInfo },
      brandKit: { ...defaultBrandKit, ...brandKit },
      settings: { ...defaultSettings },
    };

    // Create project directories
    const projectDir = await ensureProjectDirs(id);

    // Save project file
    await writeJsonFile(path.join(projectDir, 'project.json'), project);

    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:id - Get a project by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const projectDir = await getProjectDir(id);
    const projectFile = path.join(projectDir, 'project.json');
    const project = await readJsonFile(projectFile);

    if (!project) {
      throw new NotFoundError(`Project not found: ${id}`);
    }

    res.json(project);
  } catch (error) {
    next(error);
  }
});

// PUT /api/projects/:id - Update a project
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const projectDir = await getProjectDir(id);
    const projectFile = path.join(projectDir, 'project.json');
    const existingProject = await readJsonFile(projectFile);

    if (!existingProject) {
      throw new NotFoundError(`Project not found: ${id}`);
    }

    const { name, businessInfo, contactInfo, brandKit, settings } = req.body;

    const updatedProject = {
      ...existingProject,
      ...(name && { name: name.trim() }),
      ...(businessInfo && {
        businessInfo: { ...existingProject.businessInfo, ...businessInfo },
      }),
      ...(contactInfo && {
        contactInfo: { ...existingProject.contactInfo, ...contactInfo },
      }),
      ...(brandKit && {
        brandKit: { ...existingProject.brandKit, ...brandKit },
      }),
      ...(settings && {
        settings: { ...existingProject.settings, ...settings },
      }),
      updatedAt: new Date().toISOString(),
    };

    await writeJsonFile(projectFile, updatedProject);

    res.json(updatedProject);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/projects/:id - Delete a project
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const projectDir = await getProjectDir(id);
    const projectFile = path.join(projectDir, 'project.json');
    const project = await readJsonFile(projectFile);

    if (!project) {
      throw new NotFoundError(`Project not found: ${id}`);
    }

    await deleteDirectory(projectDir);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
