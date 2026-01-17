import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// Helper to strip markdown code blocks from AI responses and extract JSON
function parseJsonResponse(text) {
  let jsonText = text.trim();

  // Remove markdown code blocks
  if (jsonText.startsWith("```json")) {
    jsonText = jsonText.slice(7);
  } else if (jsonText.startsWith("```")) {
    jsonText = jsonText.slice(3);
  }
  if (jsonText.endsWith("```")) {
    jsonText = jsonText.slice(0, -3);
  }

  jsonText = jsonText.trim();

  // If there's still extra text, try to extract JSON object
  // Look for the first { and last }
  const firstBrace = jsonText.indexOf("{");
  const lastBrace = jsonText.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
    jsonText = jsonText.substring(firstBrace, lastBrace + 1);
  }

  return JSON.parse(jsonText.trim());
}

// Rate limiting (simple in-memory implementation)
const rateLimits = {
  caption: { count: 0, resetTime: Date.now() + 3600000, limit: 50 },
  hashtags: { count: 0, resetTime: Date.now() + 3600000, limit: 100 },
  virality: { count: 0, resetTime: Date.now() + 3600000, limit: 100 },
  graphics: { count: 0, resetTime: Date.now() + 3600000, limit: 100 },
};

function checkRateLimit(type) {
  const limit = rateLimits[type];
  if (Date.now() > limit.resetTime) {
    limit.count = 0;
    limit.resetTime = Date.now() + 3600000;
  }
  if (limit.count >= limit.limit) {
    throw new Error(`Rate limit exceeded for ${type}. Try again later.`);
  }
  limit.count++;
}

const CAPTION_STYLE_PROMPTS = {
  auto: "Choose the most appropriate style based on the image context",
  quote:
    "Create an inspirational or thought-provoking quote that relates to the image. Focus on wisdom, motivation, or reflection. The quote can be original or a well-known saying that fits.",
  personal:
    "Write as a genuine personal thought or reflection. Be authentic, conversational, and relatable. Share a feeling, observation, or moment of connection with the image.",
  story:
    "Tell a brief story or share behind-the-scenes context. Create intrigue, share a journey, or give the audience a peek into the moment captured.",
  question:
    "Craft an engaging question that invites the audience to respond. Make it thought-provoking or relatable to encourage comments and discussion.",
  announcement:
    "Write in an announcement or news style. Be clear, exciting, and informative. Great for launches, updates, or sharing news.",
};

const POST_TYPE_PROMPTS = {
  business:
    "This is a business/brand post. The caption should subtly reflect the brand's voice and values while focusing on the content.",
  travel:
    "This is a personal travel post. Focus on the experience, destination, adventure, and wanderlust. Write like sharing with friends about an amazing trip. Avoid business/brand messaging entirely.",
  food: "This is a food and dining post. Focus on the culinary experience, flavors, ambiance, or the joy of the meal. Write like sharing a delicious discovery with friends. Avoid business/brand messaging entirely.",
  lifestyle:
    "This is a personal lifestyle post. Focus on the moment, feeling, or personal experience. Write authentically like sharing with friends. Avoid business/brand messaging entirely.",
  event:
    "This is an event or occasion post. Focus on the celebration, gathering, or special moment. Capture the energy and significance of the event.",
};

export async function generateCaption({
  mediaDescription,
  businessContext,
  platform = "instagram",
  draftCaption,
  captionStyle = "auto",
  postType = "business",
  location,
}) {
  checkRateLimit("caption");

  const styleInstruction =
    CAPTION_STYLE_PROMPTS[captionStyle] || CAPTION_STYLE_PROMPTS.auto;

  const postTypeInstruction =
    POST_TYPE_PROMPTS[postType] || POST_TYPE_PROMPTS.business;

  // Build location context if available
  let locationContext = "";
  if (location && location.placeName) {
    locationContext = `\nLocation: ${location.placeName}`;
  } else if (location && location.latitude && location.longitude) {
    locationContext = `\nLocation: Coordinates ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
  }

  // Only include business context for business posts
  const shouldIncludeBusinessContext =
    postType === "business" && businessContext && businessContext.industry;

  const prompt = `You are a social media expert creating engaging captions for ${platform}.

POST TYPE: ${postTypeInstruction}

Image/Content Description: ${mediaDescription}${locationContext}

${captionStyle !== "auto" ? `IMPORTANT - Caption Style Required: ${styleInstruction}` : ""}

${
  shouldIncludeBusinessContext
    ? `Business Context (use subtly, focus on the image):
- Industry: ${businessContext.industry}
- Audience: ${businessContext.targetAudience || "General"}
- Tone: ${businessContext.tone || "authentic"}
`
    : ""
}

${draftCaption ? `User's Draft: ${draftCaption}` : ""}

Generate 3 caption variations that:
- Focus on the IMAGE/CONTENT described${locationContext ? " and naturally incorporate the location" : ""}
${postType !== "business" ? "- Do NOT include any business or brand messaging - this is a personal post" : ""}
- ${captionStyle === "quote" ? "Are inspirational quotes that resonate with the image" : ""}
- ${captionStyle === "personal" ? "Feel authentic and personal, like sharing with friends" : ""}
- ${captionStyle === "story" ? "Tell a compelling micro-story or share context" : ""}
- ${captionStyle === "question" ? "Ask engaging questions to spark conversation" : ""}
- ${captionStyle === "announcement" ? "Are clear and exciting announcements" : ""}
- ${captionStyle === "auto" ? "Are engaging and match the content naturally" : ""}
- Are optimized for ${platform}
${postType === "travel" ? "- Evoke wanderlust and the joy of exploration" : ""}
${postType === "food" ? "- Make readers hungry and curious about the dish/experience" : ""}
${postType === "lifestyle" ? "- Feel genuine and relatable, like a friend sharing a moment" : ""}
${postType === "event" ? "- Capture the excitement and significance of the occasion" : ""}

Return as JSON:
{
  "captions": [
    { "text": "short punchy caption", "length": "short", "style": "concise" },
    { "text": "medium caption with more depth", "length": "medium", "style": "balanced" },
    { "text": "longer caption that tells more of the story", "length": "long", "style": "detailed" }
  ]
}

Return ONLY the JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    return parseJsonResponse(content.text);
  } catch (error) {
    console.error("Error generating caption:", error);
    throw new Error("Failed to generate caption suggestions");
  }
}

export async function suggestHashtags({
  caption,
  industry,
  platform = "instagram",
}) {
  checkRateLimit("hashtags");

  const prompt = `You are a social media hashtag expert for ${platform}.

Caption: "${caption}"
Industry: ${industry || "General"}

Suggest 10-15 relevant hashtags that:
- Mix popular and niche tags for optimal reach
- Are relevant to the content and industry
- Follow ${platform} best practices
- Include a mix of broad and specific tags

Return as JSON:
{
  "hashtags": ["tag1", "tag2", ...],
  "categories": {
    "popular": ["high-volume tags"],
    "niche": ["specific tags"],
    "branded": ["if applicable"]
  }
}

Return ONLY the JSON, no # symbols in the tags.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    return parseJsonResponse(content.text);
  } catch (error) {
    console.error("Error suggesting hashtags:", error);
    throw new Error("Failed to suggest hashtags");
  }
}

export async function calculateViralityScore({
  caption,
  hashtags = [],
  mediaType = "image",
  platform = "instagram",
  businessContext,
}) {
  checkRateLimit("virality");

  const prompt = `You are a social media analytics expert. Analyze this post for viral potential on ${platform}.

Caption: "${caption}"
Hashtags: ${hashtags.length > 0 ? hashtags.map((h) => `#${h}`).join(" ") : "None"}
Media Type: ${mediaType}
${businessContext ? `Industry: ${businessContext.industry || "General"}` : ""}

Evaluate based on:
1. Hook strength (first line grabs attention)
2. Engagement triggers (questions, CTAs, emotion)
3. Hashtag strategy (reach vs relevance)
4. Content format optimization for ${platform}
5. Shareability factor

Return as JSON:
{
  "score": 0-100,
  "breakdown": {
    "hook": 0-20,
    "engagement": 0-20,
    "hashtags": 0-20,
    "format": 0-20,
    "shareability": 0-20
  },
  "reasoning": "2-3 sentence explanation of score",
  "tips": [
    "Specific actionable tip 1",
    "Specific actionable tip 2",
    "Specific actionable tip 3"
  ]
}

Return ONLY the JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    return parseJsonResponse(content.text);
  } catch (error) {
    console.error("Error calculating virality score:", error);
    throw new Error("Failed to calculate virality score");
  }
}

const PLATFORM_GRAPHICS_CONTEXT = {
  instagram: {
    emoji:
      "Instagram audiences love emoji. Use liberally to add personality and break up text. Popular: ✨🎉❤️🔥💪🚀🌟📸✨",
    graphics:
      "Use arrows (→➡️⬇️), stars (⭐✨), and decorative elements freely. Heart-eye emojis and celebration emojis perform well.",
    formats: ["Carousel", "Reel", "Stories", "Feed Post"],
  },
  linkedin: {
    emoji:
      "LinkedIn audiences prefer minimal, professional emoji use. Stick to: 📈📊💼🎯✅💡🚀📝. Avoid excessive emoji.",
    graphics:
      "Use checkmarks (✓✅), arrows (→➡️), and bullet points (•). Keep design minimal and professional.",
    formats: ["Document", "Poll", "Article", "Text Post"],
  },
  twitter: {
    emoji:
      "Twitter/X audiences use moderate emoji. Popular: 🔥💯👀😂✨💪🎯. Avoid overdoing it.",
    graphics:
      "Use arrows (→➡️), bullets (•), and text emphasis. Works well for threads and discussions.",
    formats: ["Thread", "Tweet", "Quote Tweet"],
  },
  tiktok: {
    emoji:
      "TikTok audiences love emoji heavily. Use liberally to add energy and personality. All types perform well.",
    graphics:
      "Use arrows, stars, and decorative elements freely. Bold and energetic graphics work best.",
    formats: ["Duet", "Stitch", "Trending Audio"],
  },
};

export async function suggestGraphicsAndEmoji({
  caption,
  hashtags = [],
  platform = "instagram",
  industry,
  postType = "business",
}) {
  checkRateLimit("graphics");

  const platformContext =
    PLATFORM_GRAPHICS_CONTEXT[platform] || PLATFORM_GRAPHICS_CONTEXT.instagram;

  const prompt = `You are a social media content strategist for ${platform}. Analyze this caption and provide concise recommendations in the exact format below. Use plain text, no JSON or code blocks.

CAPTION: "${caption}"

PLATFORM CONTEXT:
${platformContext.emoji}
${platformContext.graphics}

Provide recommendations in EXACTLY this format (use these section headers):

EMOJI: [phrases from caption] → [emoji suggestions separated by spaces]
GRAPHICS: [type] → [symbol suggestions separated by spaces]
TRENDING: #Hashtag1 #Hashtag2 #Hashtag3 (3-5 relevant, trending hashtags)
VERSION A: [alternative caption v1 - different tone/emoji]
VERSION B: [alternative caption v2 - different approach/emoji]

Rules:
- EMOJI section: List 2-3 key phrases from the caption, arrow, then emoji suggestions
- GRAPHICS section: Suggest visual elements (arrows, bullets, etc) relevant to caption
- TRENDING: Only hashtags relevant to this caption's specific topic
- VERSION A & B: Two distinct caption variations with different approaches
- Keep it concise and practical
- All suggestions must directly relate to the caption content`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    const text = content.text.trim();
    console.log("Graphics/emoji suggestions generated successfully");
    return text;
  } catch (error) {
    console.error("Error suggesting graphics and emoji:", {
      message: error.message,
      status: error.status,
      type: error.type,
      error: error.error,
    });
    throw new Error(
      `Failed to suggest graphics and emoji: ${error.message || "Unknown error"}`,
    );
  }
}
