import type { Template } from "../../types";

// Full template definitions with layouts, styles, and caption prompts
export const TEMPLATES: Template[] = [
  {
    id: "quote-minimal",
    name: "Minimal Quote",
    category: "quote",
    description:
      "Clean quote design with subtle background - perfect for inspirational or thought-provoking quotes",
    platforms: ["instagram", "linkedin"],
    layout: {
      type: "single",
      slides: [
        {
          aspectRatio: "1:1",
          elements: [
            {
              type: "shape",
              position: "full",
              style: { backgroundColor: "#1a1a2e" },
            },
            {
              type: "text",
              position: "center",
              content: '"{quote}"',
              style: {
                fontSize: 32,
                fontWeight: "normal",
                textAlign: "center",
              },
            },
            {
              type: "text",
              position: "bottom",
              content: "— {author}",
              style: { fontSize: 18, opacity: 0.7 },
            },
          ],
        },
      ],
    },
    style: {
      font: "Georgia",
      textColor: "#ffffff",
      backgroundColor: "#1a1a2e",
      textShadow: false,
      borderRadius: 0,
    },
    captionPrompts: [
      {
        placeholder: "Enter your quote",
        example: "The only way to do great work is to love what you do.",
      },
      { placeholder: "Quote author (optional)", example: "Steve Jobs" },
    ],
    suggestedHashtags: [
      "quotes",
      "motivation",
      "inspiration",
      "mindset",
      "wisdom",
    ],
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "quote-bold",
    name: "Bold Quote",
    category: "quote",
    description:
      "Eye-catching quote with strong typography and vibrant gradient background",
    platforms: ["instagram", "twitter"],
    layout: {
      type: "single",
      slides: [
        {
          aspectRatio: "1:1",
          elements: [
            {
              type: "shape",
              position: "full",
              style: {
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              },
            },
            {
              type: "text",
              position: "center",
              content: "{quote}",
              style: { fontSize: 42, fontWeight: "bold", textAlign: "center" },
            },
          ],
        },
      ],
    },
    style: {
      font: "Impact",
      textColor: "#ffffff",
      backgroundColor: "#667eea",
      textShadow: true,
      borderRadius: 0,
    },
    captionPrompts: [
      {
        placeholder: "Enter your bold statement",
        example: "Dream big. Start small. Act now.",
      },
    ],
    suggestedHashtags: [
      "motivation",
      "success",
      "entrepreneur",
      "hustle",
      "goals",
    ],
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "before-after",
    name: "Before & After",
    category: "story",
    description:
      "Side-by-side comparison showing transformation - ideal for results and progress",
    platforms: ["instagram", "twitter"],
    layout: {
      type: "single",
      slides: [
        {
          aspectRatio: "1:1",
          elements: [
            { type: "image", position: "left-half" },
            { type: "image", position: "right-half" },
            {
              type: "text",
              position: "top-left",
              content: "BEFORE",
              style: { fontSize: 18, fontWeight: "bold" },
            },
            {
              type: "text",
              position: "top-right",
              content: "AFTER",
              style: { fontSize: 18, fontWeight: "bold" },
            },
          ],
        },
      ],
    },
    style: {
      font: "Inter",
      textColor: "#ffffff",
      textShadow: true,
      borderRadius: 0,
    },
    captionPrompts: [
      {
        placeholder: "Describe the transformation",
        example:
          "6 months of consistent effort. Same person, different mindset.",
      },
    ],
    suggestedHashtags: [
      "beforeandafter",
      "transformation",
      "progress",
      "journey",
      "results",
    ],
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "product-showcase",
    name: "Product Showcase",
    category: "product",
    description: "Highlight product features elegantly with clean design",
    platforms: ["instagram", "linkedin"],
    layout: {
      type: "single",
      slides: [
        {
          aspectRatio: "1:1",
          elements: [
            {
              type: "shape",
              position: "full",
              style: { backgroundColor: "#fafafa" },
            },
            { type: "image", position: "center", style: { maxWidth: "70%" } },
            {
              type: "text",
              position: "bottom",
              content: "{productName}",
              style: { fontSize: 24, fontWeight: "bold" },
            },
          ],
        },
      ],
    },
    style: {
      font: "Inter",
      textColor: "#1f2937",
      backgroundColor: "#fafafa",
      textShadow: false,
      borderRadius: 0,
    },
    captionPrompts: [
      { placeholder: "Product name", example: "The Minimalist Wallet" },
      {
        placeholder: "Key benefit",
        example: "Slim design that fits in your front pocket",
      },
    ],
    suggestedHashtags: ["product", "launch", "newproduct", "shopnow", "design"],
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "testimonial",
    name: "Testimonial Card",
    category: "testimonial",
    description:
      "Customer review with photo and quote - builds trust and credibility",
    platforms: ["instagram", "linkedin"],
    layout: {
      type: "single",
      slides: [
        {
          aspectRatio: "1:1",
          elements: [
            {
              type: "shape",
              position: "full",
              style: {
                background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
              },
            },
            {
              type: "text",
              position: "top",
              content: "★★★★★",
              style: { fontSize: 24 },
            },
            {
              type: "text",
              position: "center",
              content: '"{review}"',
              style: { fontSize: 22 },
            },
            {
              type: "image",
              position: "bottom-left",
              style: { width: 60, height: 60, borderRadius: "50%" },
            },
            {
              type: "text",
              position: "bottom",
              content: "{customerName}",
              style: { fontSize: 16, fontWeight: "bold" },
            },
          ],
        },
      ],
    },
    style: {
      font: "Inter",
      textColor: "#1f2937",
      backgroundColor: "#fbbf24",
      textShadow: false,
      borderRadius: 16,
    },
    captionPrompts: [
      {
        placeholder: "Customer review",
        example: "This changed everything for my business. Highly recommend!",
      },
      {
        placeholder: "Customer name",
        example: "Sarah M., Small Business Owner",
      },
    ],
    suggestedHashtags: [
      "testimonial",
      "review",
      "customerreview",
      "happycustomer",
      "feedback",
    ],
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "bts-story",
    name: "Behind the Scenes",
    category: "behind-the-scenes",
    description:
      "Casual, authentic look at your process - builds connection with audience",
    platforms: ["instagram", "threads"],
    layout: {
      type: "single",
      slides: [
        {
          aspectRatio: "4:5",
          elements: [
            { type: "image", position: "full" },
            {
              type: "shape",
              position: "bottom",
              style: {
                background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                height: "40%",
              },
            },
            {
              type: "text",
              position: "bottom",
              content: "{caption}",
              style: { fontSize: 18, padding: 20 },
            },
          ],
        },
      ],
    },
    style: {
      font: "Inter",
      textColor: "#ffffff",
      textShadow: true,
      borderRadius: 0,
    },
    captionPrompts: [
      {
        placeholder: "What's happening behind the scenes?",
        example:
          "Real talk: this is what actually goes into making one post...",
      },
    ],
    suggestedHashtags: [
      "behindthescenes",
      "bts",
      "reallife",
      "authentic",
      "creatorlife",
    ],
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
  },
];
