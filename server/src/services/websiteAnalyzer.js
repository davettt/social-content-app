import * as cheerio from "cheerio";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function analyzeWebsite(baseUrl, additionalPages = []) {
  const pages = [
    baseUrl,
    ...additionalPages.map((p) => new URL(p, baseUrl).href),
  ];
  const pageContents = [];

  // Fetch each page
  for (const pageUrl of pages) {
    try {
      const response = await fetch(pageUrl);
      if (!response.ok) continue;

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract colors and fonts BEFORE removing style elements
      const colors = await extractColors($, pageUrl);
      const fonts = await extractFonts($, pageUrl);

      // Extract theme-color meta tag
      const themeColor = $('meta[name="theme-color"]').attr("content");
      if (themeColor) colors.unshift(themeColor);

      // Extract text content
      const title = $("title").text().trim();
      const metaDescription =
        $('meta[name="description"]').attr("content") || "";
      const h1 = $("h1").first().text().trim();

      // Remove scripts, styles, and other non-content elements for text extraction
      $(
        "script, style, nav, footer, header, aside, .cookie-banner, .popup",
      ).remove();

      const bodyText = $("main, article, .content, body")
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 5000);

      pageContents.push({
        url: pageUrl,
        title,
        metaDescription,
        h1,
        bodyText,
        colors: [...new Set(colors)].slice(0, 10),
        fonts,
      });
    } catch (error) {
      console.warn(`Could not fetch ${pageUrl}:`, error.message);
    }
  }

  if (pageContents.length === 0) {
    return {
      success: false,
      error: "Could not fetch any pages from the website",
    };
  }

  // Use Claude to analyze the content
  const analysisPrompt = `Analyze this website content and extract business information.

Website Pages:
${pageContents
  .map(
    (p) => `
URL: ${p.url}
Title: ${p.title}
Description: ${p.metaDescription}
Main Heading: ${p.h1}
Content Preview: ${p.bodyText.slice(0, 2000)}
Colors Found: ${p.colors.join(", ") || "none"}
Fonts Found - Headings: ${p.fonts.headingFonts.join(", ") || "none"}
Fonts Found - Body: ${p.fonts.bodyFonts.join(", ") || "none"}
`,
  )
  .join("\n---\n")}

Extract and return as JSON:
{
  "businessName": "extracted business name",
  "description": "2-3 sentence description of what the business does",
  "industry": "industry category",
  "services": ["list", "of", "services"],
  "targetAudience": "description of target audience",
  "tone": "professional|casual|fun|inspirational|educational",
  "suggestedColors": {
    "primary": "pick the most prominent brand color from Colors Found, or suggest one",
    "secondary": "pick a complementary color from Colors Found, or suggest one",
    "accent": "pick an accent/highlight color from Colors Found, or suggest one"
  },
  "extractedColorPalette": ["list all unique colors found on website as hex values"],
  "suggestedFonts": {
    "heading": "use the heading font from Fonts Found - Headings if available, otherwise from Body fonts, or suggest one",
    "body": "use the body font from Fonts Found - Body if available, or suggest one"
  },
  "contactInfo": {
    "email": "if found",
    "phone": "if found",
    "address": "if found"
  },
  "socialHandles": {
    "instagram": "@handle if found",
    "twitter": "@handle if found",
    "linkedin": "url or handle if found"
  }
}

Return ONLY the JSON, no additional text.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: analysisPrompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    // Strip markdown code blocks if present
    let jsonText = content.text.trim();
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith("```")) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const analysis = JSON.parse(jsonText);

    return {
      success: true,
      analysis,
      pagesAnalyzed: pageContents.length,
    };
  } catch (error) {
    console.error("Error analyzing website:", error.message);
    console.error("Full error:", error);
    return {
      success: false,
      error: `Failed to analyze website content: ${error.message}`,
    };
  }
}

async function extractColors($, baseUrl) {
  const colors = [];
  const colorRegex =
    /#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b|rgb\([^)]+\)|rgba\([^)]+\)/g;
  // Match CSS variables that contain color-related terms anywhere in the name
  const cssVarRegex =
    /--([\w-]*(?:color|bg|background|primary|secondary|accent|brand|theme)[\w-]*|(?:color|bg|background|primary|secondary|accent|brand|theme)[\w-]*):\s*([^;]+)/gi;

  // Check inline styles
  $("[style]").each((_, el) => {
    const style = $(el).attr("style") || "";
    const matches = style.match(colorRegex);
    if (matches) {
      matches.forEach((c) => colors.push(c));
    }
  });

  // Check style tags for colors and CSS custom properties
  $("style").each((_, el) => {
    const css = $(el).html() || "";

    // Extract hex/rgb colors
    const colorMatches = css.match(colorRegex);
    if (colorMatches) {
      colorMatches.slice(0, 20).forEach((c) => colors.push(c));
    }

    // Extract CSS custom properties (variables) related to colors
    let varMatch;
    while ((varMatch = cssVarRegex.exec(css)) !== null) {
      const value = varMatch[2].trim();
      if (value.match(colorRegex)) {
        colors.push(value.match(colorRegex)[0]);
      }
    }
  });

  // Fetch external stylesheets (limit to first 3 to avoid too many requests)
  const stylesheetLinks = [];
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href && stylesheetLinks.length < 3) {
      stylesheetLinks.push(href);
    }
  });

  for (const href of stylesheetLinks) {
    try {
      const cssUrl = href.startsWith("http")
        ? href
        : new URL(href, baseUrl).href;
      const response = await fetch(cssUrl, { timeout: 5000 });
      if (response.ok) {
        const css = await response.text();

        // Extract hex/rgb colors (limit to prevent overwhelming)
        const colorMatches = css.match(colorRegex);
        if (colorMatches) {
          colorMatches.slice(0, 30).forEach((c) => colors.push(c));
        }

        // Extract CSS custom properties
        let varMatch;
        const cssVarRegexLocal =
          /--[\w-]*(color|bg|background|primary|secondary|accent|brand)[\w-]*:\s*([^;]+)/gi;
        while ((varMatch = cssVarRegexLocal.exec(css)) !== null) {
          const value = varMatch[2].trim();
          const colorMatch = value.match(colorRegex);
          if (colorMatch) {
            colors.push(colorMatch[0]);
          }
        }
      }
    } catch (error) {
      // Ignore stylesheet fetch errors
    }
  }

  // Filter out common non-brand colors (pure black, white, transparent)
  const filteredColors = colors.filter((c) => {
    const lower = c.toLowerCase();
    return ![
      "#000",
      "#000000",
      "#fff",
      "#ffffff",
      "rgb(0,0,0)",
      "rgb(255,255,255)",
      "rgba(0,0,0,0)",
    ].includes(lower.replace(/\s/g, ""));
  });

  return filteredColors;
}

async function extractFonts($, baseUrl) {
  const headingFonts = new Set();
  const bodyFonts = new Set();

  // Helper to clean font family string
  const cleanFontFamily = (fontStr) => {
    return fontStr
      .split(",")[0] // Take first font in stack
      .trim()
      .replace(/["']/g, "") // Remove quotes
      .replace(/\s+/g, " "); // Normalize spaces
  };

  // Helper to check if it's a generic font
  const isGenericFont = (font) => {
    const generics = [
      "serif",
      "sans-serif",
      "monospace",
      "cursive",
      "fantasy",
      "system-ui",
      "ui-serif",
      "ui-sans-serif",
      "ui-monospace",
      "inherit",
      "initial",
    ];
    return generics.includes(font.toLowerCase());
  };

  // Extract from style tags
  $("style").each((_, el) => {
    const css = $(el).html() || "";

    // Look for heading selectors
    const headingMatches = css.match(
      /h[1-6][^{]*\{[^}]*font-family:\s*([^;}]+)/gi,
    );
    if (headingMatches) {
      headingMatches.forEach((match) => {
        const fontMatch = match.match(/font-family:\s*([^;}]+)/i);
        if (fontMatch) {
          const font = cleanFontFamily(fontMatch[1]);
          if (font && !isGenericFont(font)) headingFonts.add(font);
        }
      });
    }

    // Look for body selectors
    const bodyMatches = css.match(/body[^{]*\{[^}]*font-family:\s*([^;}]+)/gi);
    if (bodyMatches) {
      bodyMatches.forEach((match) => {
        const fontMatch = match.match(/font-family:\s*([^;}]+)/i);
        if (fontMatch) {
          const font = cleanFontFamily(fontMatch[1]);
          if (font && !isGenericFont(font)) bodyFonts.add(font);
        }
      });
    }

    // Look for CSS custom properties with font
    const fontVarRegex = /--[\w-]*font[\w-]*:\s*([^;]+)/gi;
    let varMatch;
    while ((varMatch = fontVarRegex.exec(css)) !== null) {
      const font = cleanFontFamily(varMatch[1]);
      if (font && !isGenericFont(font)) {
        // Add to both as we can't determine which it's for
        bodyFonts.add(font);
      }
    }

    // Look for @font-face declarations (add to available fonts, not heading fonts)
    const fontFaceRegex =
      /@font-face\s*\{[^}]*font-family:\s*["']?([^"';}\n]+)["']?/gi;
    let fontFaceMatch;
    while ((fontFaceMatch = fontFaceRegex.exec(css)) !== null) {
      const font = fontFaceMatch[1].trim();
      if (font && !isGenericFont(font)) {
        // Don't assume @font-face fonts are heading fonts - just note they're available
        bodyFonts.add(font);
      }
    }

    // Look for actual heading usage with specific selectors
    const headingUsageRegex =
      /(?:^|\}|,)\s*(h[1-3]|\.heading|\.title|\.hero-title|#title)[^{]*\{[^}]*font-family:\s*([^;}]+)/gi;
    let headingUsageMatch;
    while ((headingUsageMatch = headingUsageRegex.exec(css)) !== null) {
      const font = cleanFontFamily(headingUsageMatch[2]);
      if (font && !isGenericFont(font)) {
        headingFonts.add(font);
      }
    }
  });

  // Check Google Fonts links (both old and new API formats)
  $('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]').each(
    (_, el) => {
      const href = $(el).attr("href") || "";

      // Old format: ?family=Roboto|Open+Sans
      const familyMatch = href.match(/family=([^&]+)/);
      if (familyMatch) {
        const fonts = familyMatch[1]
          .split("|")
          .map((f) => f.replace(/\+/g, " ").split(":")[0]);
        fonts.forEach((font) => {
          if (!isGenericFont(font)) bodyFonts.add(font);
        });
      }

      // New format: family=Montserrat:wght@400;700
      const newFormatMatch = href.match(/family=([^:&]+)/g);
      if (newFormatMatch) {
        newFormatMatch.forEach((match) => {
          const font = match.replace("family=", "").replace(/\+/g, " ");
          if (!isGenericFont(font)) bodyFonts.add(font);
        });
      }
    },
  );

  // Check for preload/preconnect font hints (add to available fonts)
  $(
    'link[rel="preload"][as="font"], link[rel="preconnect"][href*="font"]',
  ).each((_, el) => {
    const href = $(el).attr("href") || "";
    // Try to extract font name from URL if it's a direct font file
    const fontFileMatch = href.match(/\/([^/]+)\.(woff2?|ttf|otf)/i);
    if (fontFileMatch) {
      const font = fontFileMatch[1]
        .replace(/[-_]/g, " ")
        .replace(/\d+$/, "")
        .trim();
      if (font && !isGenericFont(font) && font.length > 2) {
        bodyFonts.add(font); // Just note it's available, don't assume it's for headings
      }
    }
  });

  // Fetch external stylesheets (limit to first 2)
  const stylesheetLinks = [];
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr("href");
    if (
      href &&
      !href.includes("fonts.googleapis.com") &&
      stylesheetLinks.length < 2
    ) {
      stylesheetLinks.push(href);
    }
  });

  for (const href of stylesheetLinks) {
    try {
      const cssUrl = href.startsWith("http")
        ? href
        : new URL(href, baseUrl).href;
      const response = await fetch(cssUrl, { timeout: 5000 });
      if (response.ok) {
        const css = await response.text();

        // Look for heading fonts
        const headingMatches = css.match(
          /h[1-6][^{]*\{[^}]*font-family:\s*([^;}]+)/gi,
        );
        if (headingMatches) {
          headingMatches.forEach((match) => {
            const fontMatch = match.match(/font-family:\s*([^;}]+)/i);
            if (fontMatch) {
              const font = cleanFontFamily(fontMatch[1]);
              if (font && !isGenericFont(font)) headingFonts.add(font);
            }
          });
        }

        // Look for body fonts
        const bodyMatches = css.match(
          /body[^{]*\{[^}]*font-family:\s*([^;}]+)/gi,
        );
        if (bodyMatches) {
          bodyMatches.forEach((match) => {
            const fontMatch = match.match(/font-family:\s*([^;}]+)/i);
            if (fontMatch) {
              const font = cleanFontFamily(fontMatch[1]);
              if (font && !isGenericFont(font)) bodyFonts.add(font);
            }
          });
        }

        // Look for CSS custom properties with font
        const fontVarRegex = /--[\w-]*font[\w-]*:\s*([^;]+)/gi;
        let varMatch;
        while ((varMatch = fontVarRegex.exec(css)) !== null) {
          const font = cleanFontFamily(varMatch[1]);
          if (font && !isGenericFont(font)) {
            bodyFonts.add(font);
          }
        }

        // Look for @font-face declarations (available fonts, not heading fonts)
        const fontFaceRegex =
          /@font-face\s*\{[^}]*font-family:\s*["']?([^"';}\n]+)["']?/gi;
        let fontFaceMatch;
        while ((fontFaceMatch = fontFaceRegex.exec(css)) !== null) {
          const font = fontFaceMatch[1].trim();
          if (font && !isGenericFont(font)) {
            bodyFonts.add(font);
          }
        }

        // Look for actual heading usage
        const headingUsageRegex =
          /(?:^|\}|,)\s*(h[1-3]|\.heading|\.title|\.hero-title|#title)[^{]*\{[^}]*font-family:\s*([^;}]+)/gi;
        let headingUsageMatch;
        while ((headingUsageMatch = headingUsageRegex.exec(css)) !== null) {
          const font = cleanFontFamily(headingUsageMatch[2]);
          if (font && !isGenericFont(font)) {
            headingFonts.add(font);
          }
        }
      }
    } catch (error) {
      // Ignore stylesheet fetch errors
    }
  }

  return {
    headingFonts: Array.from(headingFonts).slice(0, 5),
    bodyFonts: Array.from(bodyFonts).slice(0, 5),
  };
}
