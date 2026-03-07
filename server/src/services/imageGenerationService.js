const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const IMAGE_PROVIDERS = {
  huggingface: {
    id: "huggingface",
    name: "Hugging Face (Free)",
    requiresKey: "HF_TOKEN",
    models: [
      {
        id: "black-forest-labs/FLUX.1-schnell",
        name: "FLUX.1 Schnell",
        description: "Fast, high quality — free tier available",
      },
      {
        id: "black-forest-labs/FLUX.1-dev",
        name: "FLUX.1 Dev",
        description: "Higher quality, slower — free tier available",
      },
      {
        id: "stabilityai/stable-diffusion-xl-base-1.0",
        name: "Stable Diffusion XL",
        description: "Classic SDXL model — free tier available",
      },
    ],
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    requiresKey: "GEMINI_API_KEY",
    models: [
      {
        id: "gemini-2.5-flash-image",
        name: "Nano Banana (Fast)",
        description: "Fast & efficient — requires billing enabled",
      },
      {
        id: "gemini-3.1-flash-image-preview",
        name: "Nano Banana 2 (Latest)",
        description: "Newest model with Search grounding — requires billing",
      },
      {
        id: "gemini-3-pro-image-preview",
        name: "Nano Banana Pro (Quality)",
        description: "Highest quality, up to 4K — requires billing",
      },
    ],
  },
};

export const ASPECT_RATIOS = [
  { id: "1:1", label: "Square (1:1)", width: 1024, height: 1024 },
  { id: "4:5", label: "Portrait (4:5)", width: 819, height: 1024 },
  { id: "9:16", label: "Stories (9:16)", width: 576, height: 1024 },
  { id: "16:9", label: "Landscape (16:9)", width: 1024, height: 576 },
];

// Simple in-memory rate limit: 20 generations per hour
const imageGenRateLimit = { count: 0, resetTime: Date.now() + 3600000 };

function checkImageGenRateLimit() {
  if (Date.now() > imageGenRateLimit.resetTime) {
    imageGenRateLimit.count = 0;
    imageGenRateLimit.resetTime = Date.now() + 3600000;
  }
  if (imageGenRateLimit.count >= 20) {
    throw new Error(
      "Image generation rate limit reached (20/hour). Try again later.",
    );
  }
  imageGenRateLimit.count++;
}

async function generateWithHuggingFace({ prompt, modelId, aspectRatio }) {
  const token = process.env.HF_TOKEN;
  if (!token) throw new Error("HF_TOKEN not configured in .env");

  const ratio =
    ASPECT_RATIOS.find((r) => r.id === aspectRatio) || ASPECT_RATIOS[0];

  const response = await fetch(
    `https://router.huggingface.co/hf-inference/models/${modelId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { width: ratio.width, height: ratio.height },
      }),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Hugging Face error: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  return {
    data: Buffer.from(buffer).toString("base64"),
    mimeType: response.headers.get("content-type") || "image/jpeg",
  };
}

async function generateWithGemini({ prompt, modelId, aspectRatio }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured in .env");

  const aspectRatioHint =
    aspectRatio && aspectRatio !== "1:1"
      ? ` Aspect ratio: ${aspectRatio}.`
      : "";

  const response = await fetch(
    `${GEMINI_API_BASE}/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: prompt + aspectRatioHint }] },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      }),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error?.message || `Gemini API error: ${response.status}`,
    );
  }

  const data = await response.json();
  const imagePart = data.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData,
  );

  if (!imagePart?.inlineData) {
    throw new Error(
      "No image returned from Gemini. Try a different prompt or model.",
    );
  }

  return {
    data: imagePart.inlineData.data, // base64
    mimeType: imagePart.inlineData.mimeType || "image/png",
  };
}

export async function generateImage({
  provider,
  modelId,
  prompt,
  aspectRatio,
}) {
  checkImageGenRateLimit();

  switch (provider) {
    case "huggingface":
      return generateWithHuggingFace({ prompt, modelId, aspectRatio });
    case "gemini":
      return generateWithGemini({ prompt, modelId, aspectRatio });
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export function getAvailableProviders() {
  const available = [];
  for (const [key, config] of Object.entries(IMAGE_PROVIDERS)) {
    // Include if no key required, or if the key is configured
    if (!config.requiresKey || process.env[config.requiresKey]) {
      available.push({ ...config, id: key });
    }
  }
  return available;
}
