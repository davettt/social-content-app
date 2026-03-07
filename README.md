# Social Content App

A local-first web application for creating viral-optimized social media content.

## Features

- **Multi-project support** - Manage multiple brands/businesses
- **AI-powered business analysis** - Extract brand info from website or questionnaire
- **Media library** - Upload photos/videos with metadata extraction
- **AI image generation** - Generate images from text prompts using FLUX or Gemini models
- **Image editor** - Crop, filters, adjustments, text overlay, decorative graphics (star ratings, icons, shapes, frames)
- **Video editor** - Trim, speed adjust, audio controls, draggable text overlay
- **Video stitcher** - Combine multiple clips with automatic aspect ratio normalization
- **Collage builder** - Multi-image layouts
- **Post composer** - AI captions, hashtags, virality scoring
- **Platform export** - Instagram, Threads, Twitter/X, LinkedIn
- **Phone transfer** - ZIP download for easy AirDrop to phone

## Requirements

- Node.js 18+
- FFmpeg (for video processing)
- Anthropic API key (required)
- Hugging Face token or Gemini API key (optional, for AI image generation)

## Setup

1. Clone the repository:
```bash
git clone <repo-url>
cd social-content-app
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Add your Anthropic API key to `.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

5. Start development server:
```bash
npm run dev
```

The app will be available at http://localhost:5173

## Production

Build and run with PM2:

```bash
npm run build
npm run start:pm2
```

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Zustand
- **Backend:** Node.js, Express
- **AI:** Anthropic Claude (Haiku 4.5)
- **Image Processing:** Sharp, Fabric.js
- **Video Processing:** FFmpeg
- **Storage:** Local JSON files

## Project Structure

```
social-content-app/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # React Query hooks
│   ├── services/           # API client
│   ├── stores/             # Zustand stores
│   └── types/              # TypeScript types
├── server/                 # Express backend
│   └── src/
│       ├── routes/         # API routes
│       ├── services/       # Business logic
│       └── utils/          # Utilities
├── local_data/             # User data (gitignored)
└── public/                 # Static assets
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key — captions, hashtags, virality scoring |
| `HF_TOKEN` | Optional | Hugging Face token — free AI image generation (FLUX models) |
| `GEMINI_API_KEY` | Optional | Google Gemini key — AI image generation (requires billing enabled) |
| `PORT` | No | Server port (default: 3003) |
| `NODE_ENV` | No | Environment (development/production) |

### Getting a free Hugging Face token

1. Create a free account at [huggingface.co](https://huggingface.co)
2. Go to **Settings → Access Tokens → New token** (Read access is sufficient)
3. Add `HF_TOKEN=hf_...` to your `.env`

## AI Image Generation

Images can be generated from text prompts via the **Generate Image** button in the Media Library. Generated images are saved to the project media library and can be used in posts identically to uploaded photos.

### Usage rights and platform disclosure

> **Important:** AI-generated image licensing and platform disclosure rules are evolving. The guidance below reflects current understanding but you should verify directly with the relevant providers and platforms before commercial use.

**Hugging Face / FLUX models:**
- **FLUX.1 Schnell & FLUX.1 Dev** are licensed for personal use only under the FLUX Non-Commercial License. Commercial use (including producing content for paying clients) requires a commercial license from [Black Forest Labs](https://blackforestlabs.ai).
- **Stable Diffusion XL** (CreativeML Open RAIL+M) permits commercial use with no attribution required.

**Google Gemini image models:**
- Google's terms permit commercial use of AI-generated outputs. No attribution required.

**Platform disclosure:**
- **Instagram/Meta:** Has a voluntary AI content disclosure toggle; not currently mandatory for all content.
- **LinkedIn, Twitter/X, Threads:** No mandatory disclosure at time of writing, but policies are actively evolving.
- It is good practice — and increasingly expected — to disclose AI-generated imagery, particularly for commercial or sponsored content.

**Recommendation:** If you are producing content for paying clients, confirm licensing terms with your image generation provider and disclosure requirements with each target platform before publishing.

## Known Limitations

- **Media persistence**: Edited images are stored in-memory during the session but not saved as separate files.
- **Reels/Stories safe zone**: The 5% safe zone margin may not account for Instagram's UI overlays on Reels and Stories (song name at top, captions/buttons at bottom). Top-aligned text may need manual adjustment for these formats.

## Personal Project Notice

This is a personal project maintained for my own use. You're welcome to:
- Fork and customize for your own needs
- Report bugs via GitHub Issues
- Reference the code for learning

I'm not actively reviewing pull requests or feature requests, as this keeps the project focused on my personal workflow.

## License

MIT License with Commons Clause

You are free to use, modify, and distribute this software for personal and non-commercial purposes. However, you may not sell, sublicense, or provide commercial hosting or services based on this software without explicit written permission from the copyright holder.

See [LICENSE](LICENSE) for full terms.
