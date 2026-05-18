[![2Slides Logo](https://2slides.com/images/2slides-dark-full.svg)](https://2slides.com/)

[Home](https://2slides.com/) [Slides Builder](https://2slides.com/workspace) [Fast PPT](https://2slides.com/fast-ppt) [My Slides](https://2slides.com/slides) [API](https://2slides.com/api) [Agent Skills](https://2slides.com/skills)

Resources

[PPT Templates](https://2slides.com/templates) [Slides Prompts](https://2slides.com/prompts)

Gallery

Tools

[GPT Image 2](https://2slides.com/products/gpt-image-2-prompts)

[Feedback](https://2slides.com/api#) [Invite & Earn Credits](https://2slides.com/api#)

English [U\\
\\
User](https://2slides.com/account)

[![2Slides Logo](https://2slides.com/images/2slides-dark-full.svg)](https://2slides.com/)

[Home](https://2slides.com/) [Slides Builder](https://2slides.com/workspace) [Fast PPT](https://2slides.com/fast-ppt) [My Slides](https://2slides.com/slides) [API](https://2slides.com/api) [Agent Skills](https://2slides.com/skills)

Resources

[PPT Templates](https://2slides.com/templates) [Slides Prompts](https://2slides.com/prompts)

Gallery

Tools

[GPT Image 2](https://2slides.com/products/gpt-image-2-prompts)

[Feedback](https://2slides.com/api#) [Invite & Earn Credits](https://2slides.com/api#)

English [U\\
\\
User](https://2slides.com/account)

[![2Slides Logo](https://2slides.com/images/2slides-dark-full.svg)](https://2slides.com/)

[Home](https://2slides.com/) [Slides Builder](https://2slides.com/workspace) [Fast PPT](https://2slides.com/fast-ppt) [My Slides](https://2slides.com/slides) [API](https://2slides.com/api) [Agent Skills](https://2slides.com/skills)

Resources

[PPT Templates](https://2slides.com/templates) [Slides Prompts](https://2slides.com/prompts)

Gallery

[Curated](https://2slides.com/gallery) [Shared](https://2slides.com/share)

Tools

[GPT Image 2](https://2slides.com/products/gpt-image-2-prompts)

FeedbackInvite & Earn Credits

EnglishEN

[U\\
\\
User](https://2slides.com/account)

# API

Manage your API keys and explore slides API integrations.

API Endpoints![MCP](https://2slides.com/_next/image?url=%2Fimages%2Fmcp.avif&w=32&q=75)MCP ServerAPI KeysAPI Playground

## API Reference

Complete API documentation for generating AI-powered presentations with 2Slides.

[View as Markdown](https://2slides.com/api.md)

Base URL

`https://2slides.com`

Copy

For a complete guide with examples, see our [API Complete Guide](https://2slides.com/blog/api-complete-guide-to-ai-presentation-generation)

### Authentication

All API requests require authentication using an API key. Include your API key in the request header:

`Authorization: Bearer YOUR_API_KEY`

**Security:** Never expose your API key in client-side code. All API calls should be made from your backend server.

### Endpoints Overview

Quick reference to all available API endpoints

| Method | Endpoint                                      | Description                                                 |
| ------ | --------------------------------------------- | ----------------------------------------------------------- |
| POST   | `/api/v1/slides/generate`                     | Generate slides using Fast PPT with pre-built themes        |
| POST   | `/api/v1/slides/create-like-this`             | Create custom Nano Banana Pro slides from reference image   |
| POST   | `/api/v1/slides/create-pdf-slides`            | Generate custom-designed Nano Banana slides from text input |
| POST   | `/api/v1/slides/generate-narration`           | Add AI-generated voice narration to existing slides         |
| POST   | `/api/v1/slides/download-slides-pages-voices` | Export all pages and voices as a ZIP file                   |
| GET    | `/api/v1/jobs/{jobId}`                        | Check status and get download URL for any job               |
| GET    | `/api/v1/themes/search`                       | Search and filter available slide themes                    |

### Best Practices & Common Workflows

Typical usage patterns and recommended flows for different scenarios

#### 1Generate PowerPoint (PPT) Slides

Fast PPT generation using pre-built themes

→

**Option A - Synchronous (recommended for < 10 pages):**`mode: "sync"`

Wait for completion, get download URL immediately in response

→

**Option B - Asynchronous (for > 10 pages):**`mode: "async"`

Get jobId immediately → Poll `/api/v1/jobs/{jobId}` until status is "success" → Download file from downloadUrl

#### 2Search Theme Template + Generate PPT

Find the perfect theme before generating slides

①

**Search themes:**`GET /api/v1/themes/search?query=business`

Browse available themes by keyword, get themeId

②

**Generate with selected theme:**`POST /api/v1/slides/generate`

Use themeId from search results

#### 3Create Custom Design Slides (PDF)

Generate slides with custom or default design from text input

①

**Create slides (sync or async):**`POST /api/v1/slides/create-pdf-slides`

Use `mode: "async"` to get jobId immediately, or `mode: "sync"` to wait for completion.

②

**Poll job status:**`GET /api/v1/jobs/{jobId}`

Check every 20-30 seconds until status is "success"

③

**Download file:**

Use downloadUrl from job status response (valid for 1 hour)

#### 4Create Slides Like Reference Image

Generate slides matching a reference image style

①

**Create slides (sync or async):**`POST /api/v1/slides/create-like-this`

Provide referenceImageUrl and content. Use `mode: "async"` for jobId polling, or `mode: "sync"` for direct completion.

②

**Poll job status:**`GET /api/v1/jobs/{jobId}`

Check every 20-30 seconds until status is "success"

③

**Download file:**

Use downloadUrl from job status response (valid for 1 hour)

#### 5Add Voice Narration + Export Pages & Voices

Add AI voice narration to existing slides and export all assets

①

**Prerequisites:**

Must have a completed job from `create-pdf-slides` or `create-like-this`

②

**Generate voice narration (async only):**`POST /api/v1/slides/generate-narration`

Provide jobId from step ①, configure voice settings

③

**Poll job status:**`GET /api/v1/jobs/{jobId}`

Check until status is "success", message will show "Voice narration generation in progress" during processing

④

**Export all assets (free):**`POST /api/v1/slides/download-slides-pages-voices`

Get ZIP file with pages/, voices/, and transcript.txt (no credits consumed)

⑤

**Download ZIP:**

Use downloadUrl from response (valid for 1 hour)

##### 💡 Pro Tips

- • Use synchronous mode for quick generation (< 10 pages), asynchronous for larger presentations
- • Poll job status every 20-30 seconds to avoid overwhelming the server (generation can take 1-3 minutes)
- • Download URLs expire after 1 hour - download files promptly or request new URLs
- • Voice narration requires 210 credits per page (10 for text + 200 for audio)
- • Export pages & voices is completely free - no credits consumed
- • Check job status message to distinguish between "Slides generation in progress" and "Voice narration generation in progress"

### Endpoint Details

Detailed documentation for each API endpoint

POST`/api/v1/slides/generate`

Generate slides using Fast PPT with pre-built themes. Quick generation with template-based styling.

#### Parameters

| Name               | Type   | Required | Description                         |
| ------------------ | ------ | -------- | ----------------------------------- |
| `themeId`          | string | Yes      | Theme ID from /api/v1/themes/search |
| `userInput`        | string | Yes      | Presentation content                |
| `responseLanguage` | string | No       | Output language (default: Auto)     |
| `mode`             | string | No       | sync or async (default: sync)       |

#### Supported Languages

Auto (Default)

Auto detect

English

English

Spanish

Español

Arabic

العربية

Portuguese

Português

Indonesian

Bahasa Indonesia

Japanese

日本語

Russian

Русский

Hindi

हिंदी

French

Français

German

Deutsch

Greek

Ελληνικά

Vietnamese

Tiếng Việt

Turkish

Türkçe

Thai

ไทย

Polish

Polski

Italian

Italiano

Korean

한국어

Simplified Chinese

简体中文

Traditional Chinese

繁體中文

#### Response

```
{
  "success": true,
  "data": {
    "jobId": "abc123",
    "status": "success",
    "downloadUrl": "https://...",
    "slidePageCount": 10
  }
}
```

**Note:** The `downloadUrl` is a presigned URL valid for **1 hour (3600 seconds)**. Download the file before expiration.

**Credits:** 10 per slide

POST`/api/v1/slides/create-like-this`

Generate slides (Nano Banana Pro) matching a reference image's style. AI-powered with custom styling.

#### Parameters

| Name                | Type   | Required | Description                                                                                                                           |
| ------------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `userInput`         | string | Yes      | Presentation content                                                                                                                  |
| `referenceImageUrl` | string | Yes      | URL or base64 of reference image                                                                                                      |
| `responseLanguage`  | string | No       | Output language (default: Auto)                                                                                                       |
| `imageModel`        | string | No       | `gemini-3-pro-image-preview` (default) or `gemini-3.1-flash-image-preview`. Flash unlocks `512px` resolution and extra aspect ratios. |
| `aspectRatio`       | string | No       | All models: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9 (default: 16:9). Flash only: 1:4, 4:1, 1:8, 8:1.                      |
| `resolution`        | string | No       | All models: 1K, 2K, 4K (default: 2K). Flash only: 512px.                                                                              |
| `page`              | number | No       | Page count (0=auto, 1-100, default: 1)                                                                                                |
| `contentDetail`     | string | No       | concise or standard (default: concise)                                                                                                |
| `mode`              | string | No       | sync or async (default: async)                                                                                                        |

#### Supported Aspect Ratios

| Ratio  | Orientation | Common Use Cases                                     |
| ------ | ----------- | ---------------------------------------------------- |
| `1:1`  | Square      | Social media posts, Instagram feed                   |
| `2:3`  | Portrait    | Mobile wallpapers, vertical posters                  |
| `3:2`  | Landscape   | Traditional photography, prints                      |
| `3:4`  | Portrait    | Traditional TV vertical, documents                   |
| `4:3`  | Landscape   | Traditional TV, older projectors                     |
| `4:5`  | Portrait    | Instagram vertical posts                             |
| `5:4`  | Landscape   | Classic computer monitors                            |
| `9:16` | Portrait    | Mobile screens, Stories, TikTok                      |
| `16:9` | Landscape   | Default \- Modern widescreen, YouTube, presentations |
| `21:9` | Ultra-wide  | Cinematic displays, ultra-wide monitors              |
| `1:4`  | Portrait    | Tall banners, skyscraper ads · Flash only            |
| `4:1`  | Landscape   | Wide banners, panoramic headers · Flash only         |
| `1:8`  | Portrait    | Extreme vertical strips · Flash only                 |
| `8:1`  | Landscape   | Extreme horizontal strips · Flash only               |

#### Supported Languages

Pass the language code in the `responseLanguage` parameter. **Auto** (default) automatically detects the language from input.

Auto

English

Spanish

Arabic

Portuguese

Indonesian

Japanese

Russian

Hindi

French

German

Greek

Vietnamese

Turkish

Thai

Polish

Italian

Korean

Simplified Chinese

Traditional Chinese

#### Response (Async)

```
{
  "success": true,
  "data": {
    "jobId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "processing",
    "jobUrl": "https://2slides.com/workspace?jobId=..."
  }
}
```

**Note:** Poll `/api/v1/jobs/{jobId}` to check status. When completed, the `downloadUrl` will be available and valid for **1 hour**.

**Credits:** Planning 10 per request + generation 100 (512px/1K/2K) or 200 (4K) per slide

POST`/api/v1/slides/create-pdf-slides`

Generate custom-designed Nano Banana Pro slides from text input. Supports custom design style prompts or uses default design.

#### Parameters

| Name               | Type   | Required | Description                                                                                                                           |
| ------------------ | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `userInput`        | string | Yes      | Presentation content                                                                                                                  |
| `designStyle`      | string | No       | Custom design prompt (uses default if not provided)                                                                                   |
| `responseLanguage` | string | No       | Output language (default: Auto)                                                                                                       |
| `imageModel`       | string | No       | `gemini-3-pro-image-preview` (default) or `gemini-3.1-flash-image-preview`. Flash unlocks `512px` resolution and extra aspect ratios. |
| `aspectRatio`      | string | No       | All models: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9 (default: 16:9). Flash only: 1:4, 4:1, 1:8, 8:1.                      |
| `resolution`       | string | No       | All models: 1K, 2K, 4K (default: 2K). Flash only: 512px.                                                                              |
| `page`             | number | No       | Page count (0=auto, 1-100, default: 1)                                                                                                |
| `contentDetail`    | string | No       | concise or standard (default: concise)                                                                                                |
| `mode`             | string | No       | sync or async (default: async)                                                                                                        |

#### Supported Aspect Ratios

| Ratio  | Orientation | Common Use Cases                                     |
| ------ | ----------- | ---------------------------------------------------- |
| `1:1`  | Square      | Social media posts, Instagram feed                   |
| `2:3`  | Portrait    | Mobile wallpapers, vertical posters                  |
| `3:2`  | Landscape   | Traditional photography, prints                      |
| `3:4`  | Portrait    | Traditional TV vertical, documents                   |
| `4:3`  | Landscape   | Traditional TV, older projectors                     |
| `4:5`  | Portrait    | Instagram vertical posts                             |
| `5:4`  | Landscape   | Classic computer monitors                            |
| `9:16` | Portrait    | Mobile screens, Stories, TikTok                      |
| `16:9` | Landscape   | Default \- Modern widescreen, YouTube, presentations |
| `21:9` | Ultra-wide  | Cinematic displays, ultra-wide monitors              |
| `1:4`  | Portrait    | Tall banners, skyscraper ads · Flash only            |
| `4:1`  | Landscape   | Wide banners, panoramic headers · Flash only         |
| `1:8`  | Portrait    | Extreme vertical strips · Flash only                 |
| `8:1`  | Landscape   | Extreme horizontal strips · Flash only               |

#### Supported Languages

Pass the language code in the `responseLanguage` parameter. **Auto** (default) automatically detects the language from input.

Auto

English

Spanish

Arabic

Portuguese

Indonesian

Japanese

Russian

Hindi

French

German

Greek

Vietnamese

Turkish

Thai

Polish

Italian

Korean

Simplified Chinese

Traditional Chinese

#### Response (Async)

```
{
  "success": true,
  "data": {
    "jobId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "processing",
    "jobUrl": "https://2slides.com/workspace?jobId=..."
  }
}
```

**Note:** Poll `/api/v1/jobs/{jobId}` to check status. When completed, the `downloadUrl` will be available and valid for **1 hour**.

**Credits:** Planning 10 per request + generation 100 (512px/1K/2K) or 200 (4K) per slide

POST`/api/v1/slides/generate-narration`

Add AI-generated voice narration to existing Nano Banana slides. Supports single or multi-speaker modes.

#### Parameters

| Name            | Type    | Required    | Description                                     |
| --------------- | ------- | ----------- | ----------------------------------------------- |
| `jobId`         | string  | Yes         | UUID from create-like-this or create-pdf-slides |
| `mode`          | string  | No          | single or multi (default: single)               |
| `speakerName`   | string  | No          | Speaker name for single mode                    |
| `speaker1Name`  | string  | Conditional | Required when mode=multi                        |
| `speaker2Name`  | string  | Conditional | Required when mode=multi                        |
| `voice`         | string  | No          | Voice for single mode (default: Puck)           |
| `speaker1Voice` | string  | No          | Voice for speaker 1 (default: Puck)             |
| `speaker2Voice` | string  | No          | Voice for speaker 2 (default: Aoede)            |
| `contentMode`   | string  | No          | concise or standard (default: standard)         |
| `includeIntro`  | boolean | No          | Include speaker intro (default: true)           |

#### Supported Voices (30 total)

Puck, Aoede, Charon, Kore, Fenrir, Zephyr, Leda, Orus, Callirrhoe, Autonoe, Enceladus, Iapetus, Umbriel, Algieba, Despina, Erinome, Algenib, Rasalgethi, Laomedeia, Achernar, Alnilam, Schedar, Gacrux, Pulcherrima, Achird, Zubenelgenubi, Vindemiatrix, Sadachbia, Sadaltager, Sulafat

#### Response

```
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Voice narration generation started..."
}
```

**Credits:** 210 per page (10 text + 200 audio)

**Note:** This endpoint only supports async mode. Job must be completed and from Nano Banana (not Fast PPT).

POST`/api/v1/slides/download-slides-pages-voices`

Export all pages (images) and voices (audio + transcript) from a completed Nano Banana job as a ZIP file.

#### Parameters

| Name    | Type   | Required | Description                                                         |
| ------- | ------ | -------- | ------------------------------------------------------------------- |
| `jobId` | string | Yes      | UUID from create-like-this or create-pdf-slides (must be completed) |

#### Response

```
{
  "success": true,
  "data": {
    "downloadUrl": "https://...",
    "fileName": "My_Slides_pages_voices_2025-01-15T10-30-45.zip",
    "expiresIn": 3600
  }
}
```

**Note:** The `downloadUrl` is a presigned URL valid for **1 hour (3600 seconds)** from the time of the request.

#### ZIP Contents

- • `pages/` \- All slide page images (page_01.png, page_02.png, ...)
- • `voices/` \- Voice audio files (page_01.wav, page_02.wav, ...) if narration was generated
- • `transcript.txt` \- Full text transcript of all voice narrations (if available)

**Credits:** Free (no credits required)

**Note:** Job must be completed with all pages having generated images. Only works with Nano Banana jobs (create-like-this or create-pdf-slides).

GET`/api/v1/jobs/{jobId}`

Check status of any job (Fast PPT or Nano Banana) and get download URL when complete.

#### Path Parameters

| Name    | Type   | Required | Description                         |
| ------- | ------ | -------- | ----------------------------------- |
| `jobId` | string | Yes      | Job ID from any generation endpoint |

#### Response

```
{
  "success": true,
  "data": {
    "jobId": "abc123",
    "status": "success",
    "downloadUrl": "https://...",
    "jobUrl": "https://2slides.com/workspace?jobId=...",
    "slidePageCount": 10,
    "createdAt": 1234567890,
    "updatedAt": 1234567890
  }
}
```

**Note:** The `downloadUrl` is a presigned URL valid for **1 hour (3600 seconds)** from the time of the request.

#### Status Values

`pending`

`processing`

`success`

`failed`

GET`/api/v1/themes/search`

Search available Fast PPT themes by keyword. Use theme IDs with /api/v1/slides/generate.

#### Query Parameters

| Name    | Type   | Required | Description                         |
| ------- | ------ | -------- | ----------------------------------- |
| `query` | string | Yes      | Search keyword                      |
| `limit` | number | No       | Max results (default: 20, max: 100) |

#### Response

```
{
  "success": true,
  "data": {
    "themes": [\
      {\
        "id": "theme-123",\
        "name": "Modern Business",\
        "description": "Professional business theme",\
        "tags": ["business", "modern"],\
        "themeURL": "https://..."\
      }\
    ],
    "total": 15
  }
}
```

**Free:** No credits required

### Credit Costs

Credit consumption for each API operation

| Endpoint                     | Operation                          | Credits      |
| ---------------------------- | ---------------------------------- | ------------ |
| `/slides/generate`           | Fast PPT generation                | 10 / slide   |
| `/slides/create-like-this`   | Planning before generation         | 10 / request |
| `/slides/create-like-this`   | Nano Banana Pro (1K/2K resolution) | 100 / slide  |
| `/slides/create-like-this`   | Nano Banana Pro (4K resolution)    | 200 / slide  |
| `/slides/create-pdf-slides`  | Planning before generation         | 10 / request |
| `/slides/create-pdf-slides`  | Nano Banana Pro (1K/2K resolution) | 100 / slide  |
| `/slides/create-pdf-slides`  | Nano Banana Pro (4K resolution)    | 200 / slide  |
| `/slides/generate-narration` | Voice text generation              | 10 / page    |
| `/slides/generate-narration` | Voice audio generation             | 200 / page   |
| `/slides/generate-narration` | Total per page (text + audio)      | 210 / page   |
| `/themes/search`             | Theme search                       | Free         |

**Example:** A 5-page Nano Banana presentation (1K/2K) with voice narration costs:

10 + (100 × 5) + (210 × 5) = 1,560 credits

### Error Handling

Common error codes and how to handle them

| Code  | Description           | Solution                                         |
| ----- | --------------------- | ------------------------------------------------ |
| `400` | Bad Request           | Check required parameters and valid values       |
| `401` | Unauthorized          | Verify API key in Authorization header           |
| `402` | Insufficient Credits  | Purchase more credits to continue                |
| `403` | Forbidden             | Access denied to this resource                   |
| `404` | Not Found             | Resource does not exist or you don't have access |
| `429` | Too Many Requests     | Rate limit exceeded, wait before retrying        |
| `500` | Internal Server Error | Server error, retry after a delay                |

#### Error Response Format

```
{
  "error": "Error message description",
  "code": "ERROR_CODE",
  "details": {
    "currentCredits": 50,
    "requiredCredits": 200,
    "action": "generate_slides"
  }
}
```

#### Best Practices

- • Implement exponential backoff for 429 and 500 errors
- • Check credits before making expensive operations
- • Store and reuse job IDs for status polling
- • Use async mode for bulk operations
- • Handle partial failures gracefully

### Rate Limiting

API request limits and best practices

| Endpoint                               | Window   | Max Requests |
| -------------------------------------- | -------- | ------------ |
| `/slides/generate`                     | 1 minute | 6            |
| `/slides/create-like-this`             | 1 minute | 30           |
| `/slides/create-pdf-slides`            | 1 minute | 30           |
| `/slides/generate-narration`           | 1 minute | 30           |
| `/slides/download-slides-pages-voices` | 1 minute | 30           |
| `/jobs/:id`                            | 1 minute | 10           |
| `/themes/search`                       | 1 minute | 30           |
| `/echo`                                | 1 minute | 30           |

**Rate limit exceeded?** Contact us at [service@2slides.com](mailto:service@2slides.com) to discuss higher limits for your use case.
