"use client";


import "./page.module.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

const HOMEPAGE_MODEL_PROVIDERS = [
  {
    name: "ChatGPT",
    logo: "GPT",
    logoClass: "gpt",
    versions: ["gpt-4o", "gpt-4o-mini", "gpt-4"],
    description: "Flagship OpenAI models known for nuanced reasoning, strong writing, and reliable performance across a wide range of academic tasks.",
    tags: ["Highest quality", "Strong writing"],
  },
  {
    name: "DeepSeek",
    logo: "DS",
    logoClass: "ds",
    versions: ["deepseek-chat"],
    description: "Highly efficient open-source models that excel at technical and STEM content — ideal for math, code, and data-heavy subjects.",
    tags: ["Most affordable", "STEM-focused"],
  },
  {
    name: "Gemini",
    logo: "G",
    logoClass: "gem",
    versions: [
      "gemini-3-flash-preview",
      "gemini-3.1-flash-lite-preview",
      "gemini-2.5-flash",
      "gemini-2.5-pro",
    ],
    description: "Google's latest model family offering a massive context window, fast response variants, and deep analytical capability for long or complex documents.",
    tags: ["Large context", "Fast variants"],
  },
];

export default function HomePage() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const reveals = document.querySelectorAll(".reveal");
    const nav = document.querySelector("nav");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    reveals.forEach((el) => observer.observe(el));

    const onScroll = () => {
      if (!nav) return;
      nav.style.background =
        window.scrollY > 40 ? "rgba(10,10,15,.96)" : "rgba(10,10,15,.82)";
    };

    window.addEventListener("scroll", onScroll);

    return () => {
      reveals.forEach((el) => observer.unobserve(el));
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <>
      

      <div className="atm">
        <div className="atm-1" />
        <div className="atm-2" />
        <div className="atm-3" />
      </div>

      <nav>
        <div className="container">
          <div className="nav-inner">
            <Link href="/" className="nav-logo">
              <div className="nav-logo-mark">
                <Image src="/icon.png" alt="Slide2Notes icon" width={34} height={34} priority />
              </div>
              <span className="nav-logo-name">Slide2Notes</span>
            </Link>
            <div className="nav-links">
              <a href="#how">How it works</a>
              <a href="#features">Features</a>
              <a href="#models">AI Models</a>
            </div>
            <div className="nav-cta">
              <button className="btn-ghost" onClick={() => (window.location.href = "/login")}>Sign in</button>
              <button className="btn-primary" onClick={() => (window.location.href = "/register")}>Get started</button>
            </div>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="container" style={{ position: "relative", zIndex: 2 }}>
          <div className="hero-eyebrow">
            <div className="hero-eyebrow-dot" />
            AI-Powered Document Summarizer
          </div>

          <h1 className="hero-h1">
            Turn any document
            <br />
            into <em>instant</em> <span className="under">understanding</span>
          </h1>

          <p className="hero-sub">
            Upload PDFs, slides, Word docs or spreadsheets - Slide2Notes distils them into sharp summaries, interactive notes, quiz questions and presentation slides.
          </p>

          <div className="hero-actions">
            <button className="btn-hero" onClick={() => (window.location.href = "/register")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                <polyline points="13 2 13 9 20 9" />
              </svg>
              Start for free
            </button>
          </div>

          <div className="hero-mock">
            <div className="hero-mock-glow" />
            <div className="hero-mock-card">
              <div className="mock-topbar">
                <div className="mock-dot" style={{ background: "#ff5f57" }} />
                <div className="mock-dot" style={{ background: "#febc2e" }} />
                <div className="mock-dot" style={{ background: "#28c840" }} />
                <div className="mock-title">slide2notes.vercel.app/summary/3</div>
              </div>
              <div className="mock-body">
                <div className="mock-sidebar">
                  <div className="mock-sb-label">History</div>
                  <div className="mock-sb-item active">
                    <div className="mock-sb-dot" style={{ background: "#a5b4fc" }} />
                    DB Normalization
                  </div>
                  <div className="mock-sb-item">
                    <div className="mock-sb-dot" style={{ background: "rgba(255,255,255,.2)" }} />
                    React Hooks
                  </div>
                  <div className="mock-sb-item">
                    <div className="mock-sb-dot" style={{ background: "rgba(255,255,255,.2)" }} />
                    Network Protocols
                  </div>
                  <div className="mock-sb-label" style={{ marginTop: "12px" }}>Uploads</div>
                  <div className="mock-sb-item">
                    <div className="mock-sb-dot" style={{ background: "rgba(245,166,35,.5)" }} />
                    DB_Notes.pdf
                  </div>
                  <div className="mock-sb-item">
                    <div className="mock-sb-dot" style={{ background: "rgba(251,146,60,.5)" }} />
                    Schema.pptx
                  </div>
                </div>
                <div className="mock-main">
                  <div className="mock-chip-row">
                    <div className="mock-chip">ChatGPT</div>
                    <div className="mock-chip green">Student</div>
                    <div className="mock-chip amber">DB Normalization</div>
                  </div>
                  <div className="mock-line amber" />
                  <div className="mock-line long" />
                  <div className="mock-line med" />
                  <div className="mock-line short" />
                  <div className="mock-line long" />
                  <div className="mock-line med" />
                  <div className="mock-line" style={{ width: "70%" }} />
                  <div className="mock-line short" />
                  <div className="mock-chat-row">
                    <span className="mock-placeholder">Ask anything about this summary...</span>
                    <div className="mock-send">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="marquee-wrap">
        <div className="marquee-track">
          {[
            "PDF",
            "PowerPoint",
            "Word Documents",
            "Excel Sheets",
            "Markdown",
            "Plain Text",
            "ChatGPT",
            "DeepSeek",
            "Gemini 1.5 Pro",
            "Quiz Generation",
            "Slide Export",
            "PDF Download",
          ]
            .concat([
              "PDF",
              "PowerPoint",
              "Word Documents",
              "Excel Sheets",
              "Markdown",
              "Plain Text",
              "ChatGPT",
              "DeepSeek",
              "Gemini 1.5 Pro",
              "Quiz Generation",
              "Slide Export",
              "PDF Download",
            ])
            .map((item, idx) => (
              <span className="marquee-item" key={`${item}-${idx}`}>
                <span>{item}</span>
                <span className="marquee-sep">·</span>
              </span>
            ))}
        </div>
      </div>

      <section className="how" id="how">
        <div className="container">
          <div className="how-grid">
            <div>
              <div className="section-label reveal">How it works</div>
              <h2 className="section-h2 reveal reveal-delay-1">Four steps from <em>upload</em> to insight</h2>
              <div className="how-steps reveal reveal-delay-2">
                {[
                  {
                    title: "Upload your documents",
                    desc: "Drag and drop PDF, PPTX, DOCX, XLSX, TXT or CSV files. Multiple files at once - Slide2Notes processes them all together.",
                  },
                  {
                    title: "Choose your AI model",
                    desc: "Select ChatGPT, DeepSeek or Gemini. Pick whether you want a student-friendly or lecturer-level summary.",
                  },
                  {
                    title: "Get your summary instantly",
                    desc: "Your content is extracted, injected into a smart prompt, and returned as a clean, structured summary in seconds.",
                  },
                  {
                    title: "Export, quiz or chat",
                    desc: "Save as PDF, generate presentation slides, create a quiz, or chat with the AI to dive deeper into any topic.",
                  },
                ].map((step, idx) => (
                  <div
                    key={step.title}
                    className={`how-step ${activeStep === idx ? "active" : ""}`}
                    onClick={() => setActiveStep(idx)}
                  >
                    <div className="how-step-bar" />
                    <div className="how-step-num">{`0${idx + 1}`}</div>
                    <div className="how-step-content">
                      <div className="how-step-title">{step.title}</div>
                      <div className="how-step-desc">{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="how-visual reveal reveal-delay-2">
              <div className="how-vis-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Summary ready in 4s
              </div>
              <div className="how-vis-card">
                <div className="how-vis-title">Database Normalization - Student Mode</div>
                <div className="how-vis-lines">
                  <div className="how-vis-line accent" style={{ width: "90%" }} />
                  <div className="how-vis-line" style={{ width: "100%" }} />
                  <div className="how-vis-line" style={{ width: "82%" }} />
                  <div className="how-vis-line amber" style={{ width: "65%", marginTop: "6px" }} />
                  <div className="how-vis-line" style={{ width: "100%" }} />
                  <div className="how-vis-line" style={{ width: "88%" }} />
                  <div className="how-vis-line" style={{ width: "74%" }} />
                  <div className="how-vis-line accent" style={{ width: "55%", marginTop: "6px" }} />
                  <div className="how-vis-line" style={{ width: "100%" }} />
                  <div className="how-vis-line" style={{ width: "70%" }} />
                </div>
                <div className="how-vis-tags">
                  <div className="how-vis-tag">1NF</div>
                  <div className="how-vis-tag">2NF</div>
                  <div className="how-vis-tag">3NF</div>
                  <div className="how-vis-tag">BCNF</div>
                  <div className="how-vis-tag a">Denormalization</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features" id="features">
        <div className="container">
          <div className="features-head">
            <div className="section-label reveal">Features</div>
            <h2 className="section-h2 reveal reveal-delay-1">Everything a student <em>needs</em></h2>
            <p className="section-p reveal reveal-delay-2">From raw lecture slides to exam-ready notes - Slide2Notes covers the full study workflow in one place.</p>
          </div>

          <div className="features-grid">
            {[
              ["ind", "Multi-format support", "PDF, PPTX, DOCX, XLSX, TXT, CSV and Markdown - upload any mix of files and process them together in a single summary."],
              ["amb", "AI chat on summaries", "Ask follow-up questions directly against your summarized content. The AI has full context - no copy-pasting required.", "amber-card"],
              ["tel", "Slide generation", "Turn any summary into a structured PPTX presentation with custom templates, font sizes and text density settings.", "teal-card"],
              ["ind", "Quiz creation", "Auto-generate multiple-choice quiz questions from your summary to test comprehension or prepare for exams."],
              ["amb", "PDF export", "Download your summary and chat history as a clean, well-formatted PDF - ready to share with classmates or save for revision.", "amber-card"],
              ["tel", "Full history", "Every summary is saved to your account. Revisit past sessions, re-use previously uploaded files, or continue an old chat.", "teal-card"],
            ].map(([variant, title, desc, cardClass], idx) => (
              <div
                className={`feat-card ${cardClass ?? ""} reveal ${idx % 3 === 1 ? "reveal-delay-1" : idx % 3 === 2 ? "reveal-delay-2" : ""}`}
                key={title}
              >
                <div className={`feat-icon ${variant}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <path d="M8 21h8M12 17v4" />
                  </svg>
                </div>
                <div className="feat-title">{title}</div>
                <div className="feat-desc">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="formats">
        <div className="container">
          <div className="formats-inner reveal">
            <div>
              <div className="section-label">Supported formats</div>
              <h2 className="section-h2" style={{ fontSize: "clamp(26px,3vw,40px)" }}>
                Whatever format your
                <br />
                <em>lecturer uses</em>
              </h2>
              <p className="section-p" style={{ fontSize: "14.5px", marginTop: "12px" }}>
                No converting, no reformatting. Upload the file exactly as you received it.
              </p>
              <div className="formats-grid">
                <div className="fmt-pill hi">PDF</div>
                <div className="fmt-pill hi">PPTX</div>
                <div className="fmt-pill hi">DOCX</div>
                <div className="fmt-pill">PPT</div>
                <div className="fmt-pill">DOC</div>
                <div className="fmt-pill">XLSX</div>
                <div className="fmt-pill">CSV</div>
                <div className="fmt-pill">TXT</div>
                <div className="fmt-pill">MD</div>
                <div className="fmt-pill">XLS</div>
                <div className="fmt-pill" style={{ gridColumn: "span 2", opacity: ".5", fontSize: "11px", color: "rgba(255,255,255,.25)" }}>
                  more coming soon
                </div>
              </div>
            </div>
            <div className="formats-right reveal reveal-delay-1">
              <div className="fmt-stat">
                <div className="fmt-stat-num"><em>3</em></div>
                <div className="fmt-stat-label">AI providers to choose from - ChatGPT, DeepSeek and Gemini</div>
              </div>
              <div className="fmt-divider" />
              <div className="fmt-stat">
                <div className="fmt-stat-num"><em>2</em></div>
                <div className="fmt-stat-label">Summary modes - Student (simplified) and Lecturer (detailed)</div>
              </div>
              <div className="fmt-divider" />
              <div className="fmt-stat">
                <div className="fmt-stat-num"><em>infinity</em></div>
                <div className="fmt-stat-label">Documents you can upload and store in your personal library</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="models" id="models">
        <div className="container">
          <div className="models-head">
            <div className="section-label reveal">AI Models</div>
            <h2 className="section-h2 reveal reveal-delay-1">Models currently <em>offered</em></h2>
          </div>
          <div className="models-row">
            {HOMEPAGE_MODEL_PROVIDERS.map((provider, idx) => (
              <div
                key={provider.name}
                className={`model-card reveal ${idx === 1 ? "reveal-delay-1" : idx === 2 ? "reveal-delay-2" : ""}`}
              >
                <div className="model-head-row">
                  <div className={`model-logo ${provider.logoClass}`}>{provider.logo}</div>
                  <div>
                    <div className="model-name">{provider.name}</div>
                    <div className="model-ver">{provider.versions.join(" · ")}</div>
                  </div>
                </div>
                <div className="model-desc">{provider.description}</div>
                <div className="model-tags">
                  {provider.tags.map((tag) => (
                    <div key={tag} className="model-tag">{tag}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="container">
          <div className="cta-box reveal">
            <h2 className="cta-h2">
              Ready to study
              <br />
              <em>smarter?</em>
            </h2>
            <p className="cta-p">Join students and lecturers who already use Slide2Notes to cut through dense material and get to the knowledge that matters.</p>
            <div className="cta-actions">
              <button className="btn-hero" onClick={() => (window.location.href = "/register")}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                  <polyline points="13 2 13 9 20 9" />
                </svg>
                Create free account
              </button>
              <button className="btn-hero-outline" onClick={() => (window.location.href = "/login")}>Sign in</button>
            </div>
            <div className="cta-note">No credit card required - Free to start - Your data stays yours</div>
          </div>
        </div>
      </section>

      <footer>
        <div className="container">
          <div className="footer-inner">
            <div className="footer-brand nav-logo">
              <div className="nav-logo-mark" style={{ width: "28px", height: "28px", borderRadius: "7px" }}>
                <Image src="/icon.png" alt="Slide2Notes icon" width={28} height={28} />
              </div>
              <span className="nav-logo-name">Slide2Notes</span>
              <span className="footer-copy" style={{ marginLeft: "8px" }}>© 2025</span>
            </div>
            <div className="footer-links">
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
              <a href="https://github.com/Kingston-chong/fyp-lecture-summarizer" target="_blank" rel="noreferrer">GitHub</a>
              <a href="mailto:slide2notes.outlook.com">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
