# FYP Lecture Summarizer

An intelligent web application that uses AI to summarize lecture content and generate presentation slides. Built as a Final Year Project (FYP).

## Project overview

FYP Lecture Summarizer helps students and educators process lecture materials. The application supports multiple document formats (PDF, DOCX, PPTX, XLSX) and uses AI to:

- **Summarize** lecture content from various document types
- **Extract** key information and concepts
- **Generate** AI-powered presentation slides with customizable templates
- **Export** summaries and presentations in multiple formats

**Live demo:** [https://fyp-lecture-summarizer.vercel.app](https://fyp-lecture-summarizer.vercel.app)

## Key features

- **Multi-format support:** PDFs, Word, PowerPoint, and Excel
- **AI-powered summarization:** Google Gemini, OpenAI, DeepSeek (via server configuration)
- **Smart slide generation:** Alai API integration for deck generation and previews
- **Improve existing PPTX:** Parse, plan, preview, and rebuild slides (including optional stock imagery)
- **Customizable templates:** Slide templates and styling options in the UI
- **Multiple export formats:** Summaries and PPTX downloads
- **User authentication:** Email/password and OAuth (see env)
- **Email notifications:** Password reset and related flows via Nodemailer
- **Cloud storage:** Vercel Blob for uploads
- **Responsive UI:** Tailwind CSS

## Tech stack

### Frontend

- **Next.js 16** — App Router, API routes
- **React 19**
- **Tailwind CSS 4**
- **React Markdown** — GFM support

### Backend

- **Next.js API routes**
- **Prisma 6** — ORM
- **MariaDB / MySQL** — via `mysql2` and Prisma adapter

### AI and documents

- **@google/generative-ai** — Gemini
- **OpenAI** — Chat completions
- **unpdf** — PDF text extraction
- **Mammoth** — Word (DOCX/DOC) text extraction
- **JSZip** — PPTX/PPT as OOXML (slide text for summarize/chat; structured parsing and theme extraction for improve-PPT)
- **xlsx** — spreadsheet text extraction (XLSX/XLS)

### Presentations

- **Alai API** — slide deck generation (server-side)

### Auth and tooling

- **NextAuth.js**
- **bcryptjs**, **Nodemailer**
- **TypeScript** (types), **ESLint**, **Swagger UI** (`/api-docs`)

## Prerequisites

- **Node.js** 18 or higher
- **npm** (or **yarn** / **pnpm**)
- **Git**
- **MariaDB or MySQL** — connection string for Prisma
- API keys as needed (see environment variables below), for example:
  - **Gemini** — [Google AI Studio](https://aistudio.google.com/)
  - **OpenAI** — [OpenAI Platform](https://platform.openai.com/) (optional)
  - **Alai** — [Alai](https://www.getalai.com/)
  - **Vercel Blob** — for file uploads in production

## Getting started

### 1. Clone the repository

```bash
git clone https://github.com/Kingston-chong/fyp-lecture-summarizer.git
cd fyp-lecture-summarizer
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root (do not commit secrets). Example:

```env
# Database
DATABASE_URL="mysql://username:password@localhost:3306/lecture_summarizer"

# AI (use what you enable in your deployment)
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key_optional
DEEPSEEK_API_KEY=your_deepseek_key_optional

# Slide generation
ALAI_API_KEY=your_alai_api_key

# Auth
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# Email (password reset, etc.)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# File storage (e.g. Vercel Blob)
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

Optional keys used by some features (see codebase / deployment):

```env
TAVILY_API_KEY=...
UNSPLASH_ACCESS_KEY=...
TWOSLIDES_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### 4. Set up the database

```bash
npm run postinstall   # generates Prisma Client
npx prisma migrate dev
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available scripts

| Command               | Description                             |
| --------------------- | --------------------------------------- |
| `npm run dev`         | Dev server with hot reload              |
| `npm run build`       | Production build (runs Prisma generate) |
| `npm start`           | Start production server                 |
| `npm run lint`        | ESLint                                  |
| `npm run postinstall` | `prisma generate`                       |

## API overview

Examples of first-party routes:

| Method | Path                        | Purpose                                           |
| ------ | --------------------------- | ------------------------------------------------- |
| `POST` | `/api/generate-slides`      | Start Alai slide generation from summary/settings |
| `GET`  | `/api/generate-slides/[id]` | Poll status and obtain preview/download URLs      |
| `POST` | `/api/improve-ppt/parse`    | Parse uploaded PPTX to slide JSON                 |
| `POST` | `/api/improve-ppt/plan`     | LLM plan of adjustments                           |
| `POST` | `/api/improve-ppt/generate` | Build improved PPTX                               |

More detail: [walkthrough.md](./walkthrough.md).

## Project structure

```text
fyp-lecture-summarizer/
├── app/                    # Next.js App Router (pages, layouts, components)
│   ├── api/                # Route handlers
│   ├── components/         # Shared React components
│   ├── dashboard/          # Dashboard routes
│   ├── summary/            # Summary viewer and related UI
│   ├── layout.tsx          # Root layout
│   ├── page.jsx            # Home
│   └── globals.css
├── components/             # Additional root-level components (if any)
├── lib/                    # Shared server/client utilities
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── public/                 # Static assets
├── next.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
├── tsconfig.json
├── package.json
├── walkthrough.md
└── README.md
```

## Security

- Keep secrets in `.env.local` (or host env) and out of Git.
- Rotate keys if they are ever exposed.
- Use HTTPS in production; set `NEXTAUTH_URL` to your public URL.
- Validate and sanitize user input on API routes.

## Troubleshooting

### `ALAI_API_KEY is not configured`

- Set `ALAI_API_KEY` in `.env.local` and restart `npm run dev`.

### Database connection errors

- Check `DATABASE_URL` format and that MySQL/MariaDB is reachable.
- Confirm SSL options if your host requires them (e.g. Aiven, Railway).

### Upload / blob errors

- Ensure `BLOB_READ_WRITE_TOKEN` is set for environments that use Vercel Blob.

## Documentation links

- [Next.js](https://nextjs.org/docs)
- [Prisma](https://www.prisma.io/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [NextAuth.js](https://next-auth.js.org/)

## Deployment

**Vercel (typical for Next.js):** push to GitHub (or GitLab/Bitbucket), import the repo in Vercel, add the same environment variables as in `.env.local`, then deploy.

See also [Next.js deployment](https://nextjs.org/docs/app/building-your-application/deploying).

## Contributing

Contributions are welcome via pull requests.

## License

This project is open source under the [MIT License](https://opensource.org/licenses/MIT).
