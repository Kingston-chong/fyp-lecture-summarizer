# FYP Lecture Summarizer

An intelligent web application that leverages AI to summarize lecture content and generate professional presentation slides. Built as a Final Year Project (FYP).

## 🎯 Project Overview

FYP Lecture Summarizer is a comprehensive solution designed to help students and educators efficiently process lecture materials. The application supports multiple document formats (PDF, DOCX, PPTX, XLSX) and uses advanced AI models to:

- **Summarize** lecture content from various document types
- **Extract** key information and concepts
- **Generate** AI-powered presentation slides with customizable templates
- **Export** summaries and presentations in multiple formats

Live Demo: [https://fyp-lecture-summarizer.vercel.app](https://fyp-lecture-summarizer.vercel.app)

## ✨ Key Features

- 📄 **Multi-Format Support**: Upload PDFs, Word documents, PowerPoint presentations, and Excel spreadsheets
- 🤖 **AI-Powered Summarization**: Leverages Google Generative AI and OpenAI models for intelligent content analysis
- 📊 **Smart Slide Generation**: Automatically creates professional presentations using the Alai API
- 🎨 **Customizable Templates**: Choose from various slide templates and styling options
- 💾 **Multiple Export Formats**: Download summaries as PDF or presentations in PPTX format
- 🔐 **User Authentication**: Secure login system with email and password authentication
- 📧 **Email Notifications**: Receive updates via email for important actions
- 🌐 **Cloud Storage**: File uploads backed by Vercel Blob for reliable storage
- 📱 **Responsive Design**: Mobile-friendly interface built with TailwindCSS

## 🛠️ Tech Stack

### Frontend
- **Next.js 16.1** - React framework with built-in optimization
- **React 19** - Latest React version for UI components
- **TailwindCSS 4** - Utility-first CSS framework
- **React Markdown** - Markdown rendering with GitHub Flavored Markdown support

### Backend
- **Next.js API Routes** - Serverless backend functions
- **Prisma 6.19** - ORM for database operations
- **MariaDB** - Relational database via Prisma adapter

### AI & Document Processing
- **Google Generative AI** - Advanced AI model for content summarization
- **OpenAI** - Alternative AI model for text generation
- **pdf-parse** - PDF document parsing
- **Mammoth** - DOCX (Word) document parsing
- **pptx2json** - PowerPoint presentation parsing
- **xlsx** - Excel spreadsheet parsing
- **UnPDF** - Advanced PDF handling

### Presentation Generation
- **Alai API** - AI-powered presentation generation
- **pptxgenjs** - PPTX file creation and manipulation
- **jsPDF** - PDF generation
- **jszip** - ZIP file handling

### Authentication & Security
- **NextAuth.js 4.24** - Authentication middleware
- **bcryptjs** - Password hashing and encryption
- **Nodemailer** - Email sending functionality

### Developer Tools
- **TypeScript** - Type-safe JavaScript
- **ESLint** - Code quality and linting
- **Swagger UI** - API documentation

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** 18.0 or higher
- **npm** or **yarn** package manager
- **Git** for version control
- API keys for:
  - Google Generative AI (get from [Google AI Studio](https://makersuite.google.com/))
  - OpenAI (optional, get from [OpenAI Platform](https://platform.openai.com/))
  - Alai Presentation API (get from [Alai Developer Portal](https://www.getalai.com/))
- MariaDB or compatible MySQL database

## 🚀 Getting Started

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Kingston-chong/fyp-lecture-summarizer.git
   cd fyp-lecture-summarizer
Install dependencies

bash
npm install
Configure environment variables

Create a .env.local file in the root directory with the following variables:

env
# Database Configuration
DATABASE_URL="mysql://username:password@localhost:3306/lecture_summarizer"

# AI API Keys
GOOGLE_GENERATIVE_AI_KEY=your_google_ai_key_here
OPENAI_API_KEY=your_openai_key_here
ALAI_API_KEY=your_alai_api_key_here

# Authentication
NEXTAUTH_SECRET=your_nextauth_secret_here
NEXTAUTH_URL=http://localhost:3000

# Email Configuration
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password_here

# File Storage
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
Set up the database

bash
npm run postinstall  # Generates Prisma client
npx prisma migrate dev  # Run migrations
Start the development server

bash
npm run dev
Open http://localhost:3000 in your browser to see the application.

📚 Available Scripts
bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run ESLint checks
npm run lint

# Generate Prisma client
npm run postinstall
🔌 API Integration
Alai Presentation API Integration
The application integrates with Alai's Presentation Generation API for creating professional slides.

Key Endpoints:

POST /api/generate-slides - Initiates slide generation
Accepts user settings and summary text
Returns generation ID for polling
GET /api/generate-slides/[id] - Retrieves generation status and download link
Polls Alai API for completion
Returns secure download URL once ready
For detailed integration information, see walkthrough.md.

📁 Project Structure
Code
fyp-lecture-summarizer/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
├── lib/                   # Utility functions
├── prisma/                # Database schema
│   └── schema.prisma      # Data model
├── public/                # Static assets
├── .env.local             # Environment variables (create this)
├── package.json           # Project dependencies
├── tsconfig.json          # TypeScript config
├── next.config.ts         # Next.js config
├── tailwind.config.ts     # TailwindCSS config
└── README.md              # This file
🔐 Security Considerations
Store all API keys in .env.local - never commit to version control
Use environment variables for sensitive configuration
Implement rate limiting on API endpoints
Validate and sanitize all user inputs
Use HTTPS in production
Enable CORS only for trusted domains
🐛 Troubleshooting
Common Issues
Issue: "ALAI_API_KEY is not configured on the server"

Solution: Ensure your .env.local file contains the ALAI_API_KEY variable
Restart the development server after updating .env.local
Issue: Database connection errors

Solution: Verify DATABASE_URL is correct in .env.local
Ensure MariaDB/MySQL server is running
Check database credentials and permissions
Issue: File upload failures

Solution: Verify BLOB_READ_WRITE_TOKEN is valid
Check file size limits in your Vercel Blob configuration
📖 Documentation
Next.js Documentation
Prisma Documentation
TailwindCSS Documentation
NextAuth.js Documentation
Google Generative AI Documentation
OpenAI API Documentation
🚀 Deployment
Deploy to Vercel (Recommended)
The easiest way to deploy is using Vercel, the platform created by the Next.js team:

Push your code to a Git repository (GitHub, GitLab, or Bitbucket)
Visit vercel.com and sign in with your Git provider
Import your repository
Add environment variables in the Vercel dashboard
Click "Deploy"
For detailed deployment instructions, see Next.js Deployment Documentation.

Other Deployment Options
Docker: Create a Dockerfile for containerized deployment
AWS: Use AWS Amplify or Elastic Beanstalk
Google Cloud: Deploy using Cloud Run or App Engine
Self-hosted: Deploy using any Node.js hosting provider
🤝 Contributing
We welcome contributions! Please feel free to submit a Pull Request.

📝 License
This project is open source and available under the MIT License.