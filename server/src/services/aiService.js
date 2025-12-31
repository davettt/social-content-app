import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

// Helper to strip markdown code blocks from AI responses
function parseJsonResponse(text) {
  let jsonText = text.trim();
  if (jsonText.startsWith("```json")) {
    jsonText = jsonText.slice(7);
  } else if (jsonText.startsWith("```")) {
    jsonText = jsonText.slice(3);
  }
  if (jsonText.endsWith("```")) {
    jsonText = jsonText.slice(0, -3);
  }
  return JSON.parse(jsonText.trim());
}

// Rate limiting (simple in-memory implementation)
const rateLimits = {
  caption: { count: 0, resetTime: Date.now() + 3600000, limit: 50 },
  hashtags: { count: 0, resetTime: Date.now() + 3600000, limit: 100 },
  virality: { count: 0, resetTime: Date.now() + 3600000, limit: 100 },
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

export async function generateCaption({
  mediaDescription,
  businessContext,
  platform = "instagram",
  draftCaption,
  captionStyle = "auto",
}) {
  checkRateLimit("caption");

  const styleInstruction =
    CAPTION_STYLE_PROMPTS[captionStyle] || CAPTION_STYLE_PROMPTS.auto;

  const prompt = `You are a social media expert creating engaging captions for ${platform}.

Image/Content Description: ${mediaDescription}

${captionStyle !== "auto" ? `IMPORTANT - Caption Style Required: ${styleInstruction}` : ""}

${
  businessContext && businessContext.industry
    ? `Context (use lightly, focus on the image):
- Industry: ${businessContext.industry}
- Audience: ${businessContext.targetAudience || "General"}
- Tone: ${businessContext.tone || "authentic"}
`
    : ""
}

${draftCaption ? `User's Draft: ${draftCaption}` : ""}

Generate 3 caption variations that:
- Focus on the IMAGE/CONTENT described, not generic business messaging
- ${captionStyle === "quote" ? "Are inspirational quotes that resonate with the image" : ""}
- ${captionStyle === "personal" ? "Feel authentic and personal, like sharing with friends" : ""}
- ${captionStyle === "story" ? "Tell a compelling micro-story or share context" : ""}
- ${captionStyle === "question" ? "Ask engaging questions to spark conversation" : ""}
- ${captionStyle === "announcement" ? "Are clear and exciting announcements" : ""}
- ${captionStyle === "auto" ? "Are engaging and match the content naturally" : ""}
- Are optimized for ${platform}

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
