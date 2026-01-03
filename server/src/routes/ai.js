import express from "express";
import { analyzeWebsite } from "../services/websiteAnalyzer.js";
import {
  generateCaption,
  suggestHashtags,
  calculateViralityScore,
} from "../services/aiService.js";
import { ValidationError } from "../middleware/errorHandler.js";

const router = express.Router();

// POST /api/ai/analyze-website - Analyze website pages
router.post("/analyze-website", async (req, res, next) => {
  try {
    const { url, pages } = req.body;

    if (!url || typeof url !== "string") {
      throw new ValidationError("Website URL is required");
    }

    const result = await analyzeWebsite(url, pages || []);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/ai/generate-caption - Generate caption suggestions
router.post("/generate-caption", async (req, res, next) => {
  try {
    const {
      mediaDescription,
      businessContext,
      platform,
      draftCaption,
      captionStyle,
      postType,
      location,
    } = req.body;

    if (!mediaDescription) {
      throw new ValidationError("Media description is required");
    }

    const result = await generateCaption({
      mediaDescription,
      businessContext,
      platform,
      draftCaption,
      captionStyle,
      postType,
      location,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/ai/suggest-hashtags - Get hashtag suggestions
router.post("/suggest-hashtags", async (req, res, next) => {
  try {
    const { caption, industry, platform } = req.body;

    if (!caption) {
      throw new ValidationError("Caption is required");
    }

    const result = await suggestHashtags({ caption, industry, platform });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/ai/virality-score - Calculate virality score
router.post("/virality-score", async (req, res, next) => {
  try {
    const { caption, hashtags, mediaType, platform, businessContext } =
      req.body;

    if (!caption) {
      throw new ValidationError("Caption is required");
    }

    const result = await calculateViralityScore({
      caption,
      hashtags,
      mediaType,
      platform,
      businessContext,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
