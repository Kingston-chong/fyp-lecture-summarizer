"use client";

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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #0a0a0f;
          --bg2: #0f0f18;
          --bg3: #14141f;
          --border: rgba(255,255,255,.07);
          --border2: rgba(255,255,255,.12);
          --text: #e8e8f0;
          --muted: rgba(232,232,240,.42);
          --amber: #f5a623;
          --amber-dim: rgba(245,166,35,.18);
          --indigo: #6366f1;
          --indigo-dim: rgba(99,102,241,.15);
          --teal: #2dd4bf;
          --serif: 'Instrument Serif', Georgia, serif;
          --sans: 'DM Sans', sans-serif;
          --mono: 'DM Mono', monospace;
        }
        html { scroll-behavior: smooth; }
        body {
          background: var(--bg);
          color: var(--text);
          font-family: var(--sans);
          font-weight: 300;
          line-height: 1.6;
          overflow-x: hidden;
        }
        a { color: inherit; text-decoration: none; }
        img { display: block; max-width: 100%; }

        body::before {
          content: '';
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
          opacity: .4;
        }

        .atm { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
        .atm-1 { position: absolute; top: -20%; right: -10%; width: 700px; height: 700px; background: radial-gradient(circle, rgba(99,102,241,.12) 0%, transparent 65%); animation: drift1 18s ease-in-out infinite alternate; }
        .atm-2 { position: absolute; bottom: 5%; left: -8%; width: 500px; height: 500px; background: radial-gradient(circle, rgba(245,166,35,.07) 0%, transparent 65%); animation: drift2 22s ease-in-out infinite alternate; }
        .atm-3 { position: absolute; top: 40%; left: 30%; width: 400px; height: 400px; background: radial-gradient(circle, rgba(45,212,191,.05) 0%, transparent 65%); animation: drift3 26s ease-in-out infinite alternate; }
        @keyframes drift1 { from { transform: translate(0,0) scale(1); } to { transform: translate(-40px,30px) scale(1.08); } }
        @keyframes drift2 { from { transform: translate(0,0) scale(1); } to { transform: translate(30px,-40px) scale(1.06); } }
        @keyframes drift3 { from { transform: translate(0,0) scale(1); } to { transform: translate(-20px,20px) scale(1.04); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: none; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes lineGrow { from { width: 0; } to { width: 100%; } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes pulseRing { 0% { transform: scale(1); opacity: .6; } 100% { transform: scale(1.6); opacity: 0; } }
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes gradShift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }

        .container { max-width: 1140px; margin: 0 auto; padding: 0 32px; position: relative; z-index: 2; }
        nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          height: 62px; display: flex; align-items: center;
          background: rgba(10,10,15,.82); backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
          animation: fadeIn .6s ease both;
        }
        .nav-inner { display: flex; align-items: center; justify-content: space-between; width: 100%; }
        .nav-logo { display: flex; align-items: center; gap: 10px; }
        .nav-logo-mark {
          width: 34px; height: 34px; border-radius: 9px;
          background: transparent;
          display: flex; align-items: center; justify-content: center;
          box-shadow: none;
          overflow: hidden;
        }
        .nav-logo-mark img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: inherit;
        }
        .nav-logo-name {
          font-family: Georgia, serif;
          font-size: 18px;
          font-style: normal;
          font-weight: 700;
          letter-spacing: -0.01em;
          background: linear-gradient(100deg, #e7e8f5, #c3cafc 55%, #a8b1f8);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          line-height: 1;
          text-shadow: 0 0 8px rgba(155, 166, 255, 0.18);
        }
        .nav-links { display: flex; align-items: center; gap: 28px; }
        .nav-links a { font-size: 13.5px; color: var(--muted); font-weight: 400; transition: color .2s; }
        .nav-links a:hover { color: var(--text); }
        .nav-cta { display: flex; align-items: center; gap: 8px; }
        .btn-ghost, .btn-primary, .btn-hero, .btn-hero-outline {
          font-family: var(--sans);
          cursor: pointer;
          box-sizing: border-box;
          appearance: none;
          -webkit-appearance: none;
          margin: 0;
          vertical-align: middle;
        }
        .btn-ghost {
          height: 36px; padding: 0 18px; border-radius: 9px;
          border: 1px solid rgba(99,102,241,.55);
          background: linear-gradient(135deg, rgba(99,102,241,.22), rgba(139,92,246,.18));
          font-size: 13px; font-weight: 600; color: #e8ebff; transition: all .2s;
          box-shadow: 0 4px 16px rgba(99,102,241,.28), inset 0 0 0 1px rgba(255,255,255,.06);
          white-space: nowrap;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          vertical-align: middle;
        }
        .btn-ghost:hover {
          border-color: rgba(129,140,248,.82);
          color: #ffffff;
          background: linear-gradient(135deg, rgba(99,102,241,.36), rgba(139,92,246,.3));
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(99,102,241,.45);
        }
        .btn-primary {
          height: 36px; padding: 0 20px; border-radius: 9px; border: none;
          border: 1px solid transparent;
          background: linear-gradient(135deg, #5258ee, #8b5cf6);
          font-size: 13px; font-weight: 500; color: white;
          box-shadow: 0 4px 16px rgba(99,102,241,.35); transition: all .2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          vertical-align: middle;
          line-height: 1;
        }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 7px 22px rgba(99,102,241,.5); }

        .hero {
          min-height: 100vh; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 100px 32px 80px; text-align: center; position: relative; overflow: hidden;
        }
        .hero::after {
          content: ''; position: absolute; inset: 0; z-index: 1; pointer-events: none;
          background-image: linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 40%, black 0%, transparent 80%);
        }
        .hero-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 5px 14px; border-radius: 20px;
          border: 1px solid rgba(245,166,35,.28); background: rgba(245,166,35,.07);
          font-size: 12px; font-weight: 500; color: var(--amber);
          letter-spacing: .06em; text-transform: uppercase; margin-bottom: 28px;
          animation: fadeUp .7s .1s ease both;
        }
        .hero-eyebrow-dot {
          width: 6px; height: 6px; border-radius: 50%; background: var(--amber); position: relative;
        }
        .hero-eyebrow-dot::after {
          content: ''; position: absolute; inset: -3px; border-radius: 50%;
          border: 1.5px solid var(--amber); animation: pulseRing 1.8s ease-out infinite;
        }
        .hero-h1 {
          font-family: var(--serif); font-size: clamp(48px, 7vw, 88px);
          font-weight: 400; line-height: 1.06; letter-spacing: -.02em;
          color: var(--text); margin-bottom: 14px; animation: fadeUp .8s .2s ease both;
        }
        .hero-h1 em { font-style: italic; color: var(--amber); }
        .hero-h1 .under { position: relative; display: inline-block; }
        .hero-h1 .under::after {
          content: ''; position: absolute; bottom: -4px; left: 0; right: 0;
          height: 3px; border-radius: 2px; background: linear-gradient(90deg, var(--indigo), var(--teal));
          animation: lineGrow 1s .9s ease both;
        }
        .hero-sub {
          max-width: 560px; font-size: 17px; line-height: 1.7;
          color: var(--muted); margin: 0 auto 40px; animation: fadeUp .8s .35s ease both;
        }
        .hero-actions {
          display: flex; align-items: center; justify-content: center; gap: 12px;
          flex-wrap: wrap; margin-bottom: 64px; animation: fadeUp .8s .48s ease both;
        }
        .btn-hero {
          height: 50px; padding: 0 32px; border-radius: 12px; border: 1px solid transparent;
          background: linear-gradient(135deg, #5258ee, #8b5cf6, #6366f1); background-size: 200% 200%;
          font-size: 15px; font-weight: 500; color: white; letter-spacing: .01em;
          box-shadow: 0 6px 24px rgba(99,102,241,.42), 0 0 0 1px rgba(99,102,241,.3);
          transition: all .22s; animation: gradShift 4s ease infinite;
          display: flex; align-items: center; gap: 8px;
        }
        .btn-hero:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(99,102,241,.6); }
        .btn-hero-outline {
          height: 50px; padding: 0 28px; border-radius: 12px;
          border: 1px solid rgba(99,102,241,.55);
          background: linear-gradient(135deg, rgba(99,102,241,.24), rgba(139,92,246,.2));
          font-size: 15px; font-weight: 500; color: #e8ebff; transition: all .22s;
          box-shadow: 0 6px 20px rgba(99,102,241,.25);
          display: flex; align-items: center; gap: 8px;
        }
        .btn-hero-outline:hover {
          border-color: rgba(129,140,248,.82);
          color: #ffffff;
          background: linear-gradient(135deg, rgba(99,102,241,.38), rgba(139,92,246,.32));
          transform: translateY(-1.5px);
          box-shadow: 0 10px 28px rgba(99,102,241,.42);
        }
        .hero-mock { width: 100%; max-width: 820px; margin: 0 auto; position: relative; animation: fadeUp .9s .6s ease both; }
        .hero-mock-glow { position: absolute; inset: -40px; z-index: 0; background: radial-gradient(ellipse at 50% 60%, rgba(99,102,241,.18) 0%, transparent 65%); }
        .hero-mock-card {
          position: relative; z-index: 1; background: rgba(18,18,30,.9); border: 1px solid var(--border2);
          border-radius: 20px; overflow: hidden; box-shadow: 0 40px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(99,102,241,.08);
        }
        .mock-topbar {
          height: 44px; background: rgba(255,255,255,.03); border-bottom: 1px solid var(--border);
          display: flex; align-items: center; padding: 0 16px; gap: 7px;
        }
        .mock-dot { width: 11px; height: 11px; border-radius: 50%; }
        .mock-title { flex: 1; text-align: center; font-size: 12px; color: var(--muted); font-family: var(--mono); }
        .mock-body { display: grid; grid-template-columns: 200px 1fr; height: 320px; }
        .mock-sidebar {
          border-right: 1px solid var(--border); padding: 16px 0;
          display: flex; flex-direction: column; gap: 4px;
        }
        .mock-sb-label {
          font-size: 9px; font-weight: 500; letter-spacing: .1em; text-transform: uppercase;
          color: rgba(255,255,255,.2); padding: 0 14px 6px;
        }
        .mock-sb-item {
          padding: 7px 14px; font-size: 11.5px; color: rgba(255,255,255,.35);
          display: flex; align-items: center; gap: 7px;
        }
        .mock-sb-item.active { background: rgba(99,102,241,.1); color: #a5b4fc; border-left: 2px solid var(--indigo); }
        .mock-sb-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .mock-main { padding: 20px; display: flex; flex-direction: column; gap: 12px; overflow: hidden; }
        .mock-line { height: 8px; border-radius: 4px; background: rgba(255,255,255,.07); }
        .mock-line.short { width: 55%; }
        .mock-line.med { width: 80%; }
        .mock-line.long { width: 95%; }
        .mock-line.amber { background: rgba(245,166,35,.2); width: 40%; height: 10px; }
        .mock-chip-row { display: flex; gap: 6px; flex-wrap: wrap; }
        .mock-chip {
          height: 22px; padding: 0 10px; border-radius: 5px; font-size: 10px; display: flex; align-items: center;
          background: rgba(99,102,241,.15); color: #a5b4fc; border: 1px solid rgba(99,102,241,.2);
        }
        .mock-chip.green { background: rgba(45,212,191,.1); color: #2dd4bf; border-color: rgba(45,212,191,.2); }
        .mock-chip.amber { background: rgba(245,166,35,.1); color: var(--amber); border-color: rgba(245,166,35,.2); }
        .mock-chat-row {
          margin-top: auto; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px;
          display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,.03);
        }
        .mock-placeholder { font-size: 11px; color: rgba(255,255,255,.2); font-style: italic; }
        .mock-send {
          width: 26px; height: 26px; border-radius: 7px;
          background: linear-gradient(135deg, var(--indigo), #8b5cf6);
          display: flex; align-items: center; justify-content: center;
        }

        .marquee-wrap {
          overflow: hidden; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
          background: rgba(255,255,255,.02); padding: 14px 0; position: relative; z-index: 2;
        }
        .marquee-track { display: flex; animation: marquee 28s linear infinite; white-space: nowrap; }
        .marquee-item {
          display: inline-flex; align-items: center; gap: 10px;
          padding: 0 28px; font-size: 12.5px; font-weight: 400; color: rgba(255,255,255,.3); letter-spacing: .03em;
        }
        .marquee-item span { color: var(--muted); }
        .marquee-sep { color: var(--amber); font-size: 16px; opacity: .5; }

        section { position: relative; z-index: 2; }
        .section-label {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 11px; font-weight: 500; letter-spacing: .12em; text-transform: uppercase;
          color: var(--indigo); margin-bottom: 16px;
        }
        .section-label::before { content: ''; width: 24px; height: 1.5px; background: var(--indigo); border-radius: 2px; }
        .section-h2 {
          font-family: var(--serif); font-size: clamp(32px, 4vw, 54px);
          font-weight: 400; line-height: 1.1; letter-spacing: -.02em; color: var(--text); margin-bottom: 16px;
        }
        .section-h2 em { font-style: italic; color: var(--amber); }
        .section-p { font-size: 16px; color: var(--muted); line-height: 1.7; max-width: 520px; }

        .how { padding: 120px 0; }
        .how-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
        .how-steps { display: flex; flex-direction: column; margin-top: 40px; }
        .how-step {
          display: flex; gap: 20px; padding: 20px 0;
          border-bottom: 1px solid var(--border); cursor: pointer; position: relative;
        }
        .how-step:first-child { border-top: 1px solid var(--border); }
        .how-step-num { font-family: var(--mono); font-size: 11px; color: rgba(255,255,255,.2); padding-top: 3px; width: 24px; flex-shrink: 0; transition: color .2s; }
        .how-step.active .how-step-num { color: var(--amber); }
        .how-step-title { font-size: 15px; font-weight: 500; color: rgba(255,255,255,.5); margin-bottom: 6px; transition: color .2s; }
        .how-step.active .how-step-title { color: var(--text); }
        .how-step-desc {
          font-size: 13.5px; color: var(--muted); line-height: 1.65;
          max-height: 0; overflow: hidden; transition: max-height .3s ease, opacity .3s; opacity: 0;
        }
        .how-step.active .how-step-desc { max-height: 100px; opacity: 1; }
        .how-step-bar {
          position: absolute; left: 0; top: 0; bottom: 0; width: 2px;
          background: var(--amber); border-radius: 2px; transform: scaleY(0); transform-origin: top; transition: transform .3s ease;
        }
        .how-step.active .how-step-bar { transform: scaleY(1); }
        .how-visual { position: relative; animation: float 6s ease-in-out infinite; }
        .how-vis-card {
          background: var(--bg3); border: 1px solid var(--border2);
          border-radius: 16px; padding: 24px; box-shadow: 0 20px 60px rgba(0,0,0,.4);
        }
        .how-vis-title { font-family: var(--serif); font-size: 15px; color: var(--text); margin-bottom: 14px; font-style: italic; }
        .how-vis-lines { display: flex; flex-direction: column; gap: 8px; }
        .how-vis-line { height: 7px; border-radius: 4px; background: rgba(255,255,255,.08); }
        .how-vis-line.accent { background: linear-gradient(90deg, var(--indigo), var(--teal)); }
        .how-vis-line.amber { background: linear-gradient(90deg, var(--amber), rgba(245,166,35,.3)); }
        .how-vis-tags { display: flex; gap: 6px; margin-top: 14px; flex-wrap: wrap; }
        .how-vis-tag {
          font-size: 11px; padding: 3px 10px; border-radius: 5px;
          background: var(--indigo-dim); color: #a5b4fc; border: 1px solid rgba(99,102,241,.2);
        }
        .how-vis-tag.a { background: var(--amber-dim); color: var(--amber); border-color: rgba(245,166,35,.25); }
        .how-vis-badge {
          position: absolute; top: -14px; right: -14px;
          background: var(--bg3); border: 1px solid var(--border2);
          border-radius: 12px; padding: 10px 14px; font-size: 12px; font-weight: 500; color: var(--teal);
          box-shadow: 0 8px 24px rgba(0,0,0,.3); display: flex; align-items: center; gap: 7px;
        }

        .features { padding: 100px 0; background: linear-gradient(180deg, transparent, rgba(99,102,241,.04) 40%, transparent); }
        .features-head { text-align: center; margin-bottom: 64px; }
        .features-head .section-label { justify-content: center; }
        .features-head .section-h2 { max-width: 520px; margin: 0 auto 16px; }
        .features-head .section-p { margin: 0 auto; text-align: center; }
        .features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .feat-card {
          background: var(--bg2); border: 1px solid var(--border); border-radius: 16px; padding: 28px;
          transition: border-color .2s, transform .2s, box-shadow .2s; position: relative; overflow: hidden;
        }
        .feat-card::before {
          content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(99,102,241,.04) 0%, transparent 60%);
          opacity: 0; transition: opacity .2s;
        }
        .feat-card:hover { border-color: rgba(99,102,241,.28); transform: translateY(-4px); box-shadow: 0 16px 40px rgba(0,0,0,.3); }
        .feat-card:hover::before { opacity: 1; }
        .feat-card.amber-card:hover { border-color: rgba(245,166,35,.28); }
        .feat-card.amber-card::before { background: linear-gradient(135deg, rgba(245,166,35,.04) 0%, transparent 60%); }
        .feat-card.teal-card:hover { border-color: rgba(45,212,191,.25); }
        .feat-card.teal-card::before { background: linear-gradient(135deg, rgba(45,212,191,.04) 0%, transparent 60%); }
        .feat-icon {
          width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 18px; position: relative; z-index: 1;
        }
        .feat-icon.ind { background: var(--indigo-dim); border: 1px solid rgba(99,102,241,.2); color: var(--indigo); }
        .feat-icon.amb { background: var(--amber-dim); border: 1px solid rgba(245,166,35,.2); color: var(--amber); }
        .feat-icon.tel { background: rgba(45,212,191,.12); border: 1px solid rgba(45,212,191,.2); color: var(--teal); }
        .feat-title, .feat-desc { position: relative; z-index: 1; }
        .feat-title { font-size: 15px; font-weight: 500; color: var(--text); margin-bottom: 8px; }
        .feat-desc { font-size: 13.5px; color: var(--muted); line-height: 1.65; }

        .formats { padding: 80px 0; }
        .formats-inner {
          background: var(--bg2); border: 1px solid var(--border);
          border-radius: 24px; padding: 56px 64px;
          display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center;
        }
        .formats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 28px; }
        .fmt-pill {
          padding: 9px 0; border-radius: 8px; text-align: center; font-size: 12px; font-weight: 500; letter-spacing: .04em;
          border: 1px solid var(--border); color: var(--muted); transition: all .2s;
        }
        .fmt-pill:hover { background: rgba(99,102,241,.1); border-color: rgba(99,102,241,.3); color: #a5b4fc; }
        .fmt-pill.hi { background: var(--indigo-dim); border-color: rgba(99,102,241,.3); color: #a5b4fc; }
        .formats-right { display: flex; flex-direction: column; gap: 16px; }
        .fmt-stat { display: flex; flex-direction: column; gap: 4px; }
        .fmt-stat-num { font-family: var(--serif); font-size: 44px; font-weight: 400; color: var(--text); line-height: 1; }
        .fmt-stat-num em { font-style: italic; color: var(--amber); }
        .fmt-stat-label { font-size: 13.5px; color: var(--muted); }
        .fmt-divider { width: 40px; height: 1.5px; background: var(--border2); border-radius: 2px; }

        .models { padding: 100px 0; }
        .models-head { text-align: center; margin-bottom: 52px; }
        .models-head .section-label { justify-content: center; }
        .models-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .model-card {
          background: var(--bg2); border: 1px solid var(--border);
          border-radius: 16px; padding: 28px 24px;
          display: flex; flex-direction: column; gap: 14px; transition: all .2s;
        }
        .model-card:hover { border-color: var(--border2); transform: translateY(-3px); box-shadow: 0 12px 36px rgba(0,0,0,.25); }
        .model-head-row { display: flex; align-items: center; gap: 10px; }
        .model-logo {
          width: 38px; height: 38px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-family: var(--mono); font-size: 13px; font-weight: 500; flex-shrink: 0;
        }
        .model-logo.gpt { background: rgba(16,163,127,.15); color: #10a37f; border: 1px solid rgba(16,163,127,.25); }
        .model-logo.ds { background: rgba(99,102,241,.15); color: #a5b4fc; border: 1px solid rgba(99,102,241,.25); }
        .model-logo.gem { background: rgba(66,133,244,.15); color: #60a5fa; border: 1px solid rgba(66,133,244,.25); }
        .model-name { font-size: 15px; font-weight: 500; color: var(--text); }
        .model-ver { font-size: 11px; font-family: var(--mono); color: var(--muted); margin-top: 2px; }
        .model-desc { font-size: 13px; color: var(--muted); line-height: 1.6; }
        .model-tags { display: flex; gap: 5px; flex-wrap: wrap; }
        .model-tag {
          font-size: 10.5px; padding: 2px 8px; border-radius: 5px;
          background: rgba(255,255,255,.05); border: 1px solid var(--border); color: rgba(255,255,255,.35);
        }

        .cta { padding: 120px 0; }
        .cta-box {
          background: var(--bg2); border: 1px solid var(--border2);
          border-radius: 28px; padding: 80px 64px; text-align: center; position: relative; overflow: hidden;
        }
        .cta-box::before {
          content: ''; position: absolute; top: -50%; left: 50%; transform: translateX(-50%);
          width: 600px; height: 600px; background: radial-gradient(circle, rgba(99,102,241,.14) 0%, transparent 65%);
          pointer-events: none;
        }
        .cta-box::after {
          content: ''; position: absolute; inset: 0; border-radius: 28px;
          background: linear-gradient(135deg, rgba(99,102,241,.04) 0%, transparent 50%, rgba(245,166,35,.03) 100%);
          pointer-events: none;
        }
        .cta-h2 {
          font-family: var(--serif); font-size: clamp(32px, 4vw, 56px);
          font-weight: 400; line-height: 1.1; color: var(--text); margin-bottom: 18px;
          position: relative; z-index: 1; letter-spacing: -.02em;
        }
        .cta-h2 em { font-style: italic; color: var(--amber); }
        .cta-p {
          font-size: 16px; color: var(--muted); line-height: 1.65;
          max-width: 480px; margin: 0 auto 40px; position: relative; z-index: 1;
        }
        .cta-actions { display: flex; align-items: center; justify-content: center; gap: 12px; position: relative; z-index: 1; flex-wrap: wrap; }
        .cta-note { margin-top: 20px; font-size: 12.5px; color: rgba(255,255,255,.25); position: relative; z-index: 1; }

        footer { border-top: 1px solid var(--border); padding: 48px 0 36px; position: relative; z-index: 2; }
        .footer-inner { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px; }
        .footer-brand { display: flex; align-items: center; gap: 9px; }
        .footer-copy { font-size: 12.5px; color: rgba(255,255,255,.25); }
        .footer-links { display: flex; gap: 22px; }
        .footer-links a { font-size: 12.5px; color: rgba(255,255,255,.28); transition: color .2s; }
        .footer-links a:hover { color: var(--muted); }
        .reveal { opacity: 0; transform: translateY(24px); transition: opacity .6s ease, transform .6s ease; }
        .reveal.visible { opacity: 1; transform: none; }
        .reveal-delay-1 { transition-delay: .1s; }
        .reveal-delay-2 { transition-delay: .2s; }
        .reveal-delay-3 { transition-delay: .3s; }

        @media (max-width: 900px) {
          .nav-links { display: none; }
          .how-grid { grid-template-columns: 1fr; }
          .how-visual { display: none; }
          .features-grid { grid-template-columns: 1fr 1fr; }
          .formats-inner { grid-template-columns: 1fr; gap: 36px; padding: 36px; }
          .models-row { grid-template-columns: 1fr; }
          .cta-box { padding: 52px 28px; }
        }
        @media (max-width: 600px) {
          .features-grid { grid-template-columns: 1fr; }
          .formats-grid { grid-template-columns: repeat(3, 1fr); }
          .mock-body { grid-template-columns: 1fr; }
          .mock-sidebar { display: none; }
        }
      `}</style>

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
