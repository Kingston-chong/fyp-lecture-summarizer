"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { getChatNavItems } from "@/lib/chatNavLabel";
import "./ChatThreadNavigator.css";

function offsetTopInScroll(el, scrollEl) {
  return (
    el.getBoundingClientRect().top -
    scrollEl.getBoundingClientRect().top +
    scrollEl.scrollTop
  );
}

const TICK_H = 3;
const TICK_GAP = 5;
const TICK_PAD = 8;
const HOVER_CLOSE_MS = 120;

/**
 * Fixed rail beside the scroll area (portaled). Popup overlaps the rail (ChatGPT-style).
 */
export default function ChatThreadNavigator({
  scrollRef,
  messageRefs,
  messages,
}) {
  const navItems = useMemo(() => getChatNavItems(messages), [messages]);
  const [mounted, setMounted] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [activeId, setActiveId] = useState(
    /** @type {string | number | null} */ (null),
  );
  const [hoveredId, setHoveredId] = useState(
    /** @type {string | number | null} */ (null),
  );
  const [anchor, setAnchor] = useState(
    /** @type {{ top: number; left: number; visible: boolean } | null} */ (
      null
    ),
  );
  const closeTimerRef = useRef(
    /** @type {ReturnType<typeof setTimeout> | null} */ (null),
  );

  useEffect(() => setMounted(true), []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openHover = useCallback(() => {
    clearCloseTimer();
    setHoverOpen(true);
  }, [clearCloseTimer]);

  const scheduleCloseHover = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setHoverOpen(false);
      setHoveredId(null);
    }, HOVER_CLOSE_MS);
  }, [clearCloseTimer]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  const updateAnchor = useCallback(() => {
    const scrollEl = scrollRef?.current;
    if (!scrollEl || navItems.length < 2) {
      setAnchor(null);
      return;
    }

    const r = scrollEl.getBoundingClientRect();
    const clusterH =
      navItems.length * TICK_H +
      (navItems.length - 1) * TICK_GAP +
      TICK_PAD * 2;
    const minTop = r.top + 48;
    const maxTop = r.bottom - clusterH - 24;
    const top =
      maxTop > minTop
        ? minTop + (maxTop - minTop) / 2
        : Math.max(minTop, r.top + (r.height - clusterH) / 2);

    const visible =
      r.bottom > 120 && r.top < window.innerHeight - 80 && r.width > 200;

    setAnchor({
      top,
      left: r.right - 6,
      visible,
    });
  }, [navItems.length, scrollRef]);

  useLayoutEffect(() => {
    updateAnchor();
    const scrollEl = scrollRef?.current;
    if (!scrollEl) return;

    const onScroll = () => updateAnchor();
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(onScroll);
    ro.observe(scrollEl);

    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [updateAnchor, scrollRef, messages]);

  useEffect(() => {
    const scrollEl = scrollRef?.current;
    if (!scrollEl || navItems.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const raw = visible[0].target.getAttribute("data-chat-nav-id");
          if (raw != null) setActiveId(raw);
        }
      },
      { root: scrollEl, rootMargin: "-20% 0px -55% 0px", threshold: 0 },
    );

    for (const item of navItems) {
      const el = messageRefs.current?.get(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [navItems, scrollRef, messageRefs, messages]);

  const scrollToMessage = useCallback(
    (id) => {
      const scrollEl = scrollRef?.current;
      const el = messageRefs.current?.get(id);
      if (!scrollEl || !el) return;
      const y = offsetTopInScroll(el, scrollEl) - 12;
      scrollEl.scrollTo({ top: y, behavior: "smooth" });
      setActiveId(id);
    },
    [scrollRef, messageRefs],
  );

  if (!mounted || navItems.length < 2 || !anchor?.visible) return null;

  const highlightId = hoveredId ?? activeId;

  const float = (
    <div
      className="chat-thread-nav-float"
      style={{
        top: anchor.top,
        left: anchor.left,
      }}
    >
      <div
        className="chat-thread-nav-cluster"
        onMouseEnter={openHover}
        onMouseLeave={scheduleCloseHover}
      >
        <div
          className={`chat-thread-nav-popup${hoverOpen ? " is-open" : ""}`}
          role="navigation"
          aria-label="Conversation prompts"
          aria-hidden={!hoverOpen}
        >
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`chat-thread-nav-popup-item${
                String(highlightId) === String(item.id) ? " active" : ""
              }`}
              tabIndex={hoverOpen ? 0 : -1}
              onMouseEnter={() => {
                openHover();
                setHoveredId(item.id);
              }}
              onClick={() => scrollToMessage(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div
          className="chat-thread-nav-rail"
          role="toolbar"
          aria-label="Jump to prompts"
        >
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`chat-thread-nav-tick${
                String(highlightId) === String(item.id) ? " active" : ""
              }`}
              title={item.label}
              aria-label={`Jump to: ${item.label}`}
              onMouseEnter={() => {
                openHover();
                setHoveredId(item.id);
              }}
              onFocus={() => {
                openHover();
                setHoveredId(item.id);
              }}
              onBlur={() => setHoveredId(null)}
              onClick={() => scrollToMessage(item.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(float, document.body);
}
