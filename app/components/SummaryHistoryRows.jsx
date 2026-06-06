"use client";

import { useMemo, useState } from "react";
import { DotsIcon, PinIcon } from "@/app/components/icons";
import HistoryTitleHoverPreview from "@/app/components/HistoryTitleHoverPreview";
import { formatSummarizeForLabel } from "@/app/dashboard/helpers";
import { prepareHistoryList, sortHistoryItems } from "@/lib/summaryHistoryList";
import { LoadingText } from "@/app/components/LoadingText";
import GuestSidebarPrompt from "@/app/components/GuestSidebarPrompt";

const VARIANT = {
  app: {
    item: "as-hi",
    active: "act",
    pinned: "pinned",
    menuOpen: "menu-open",
    row: "as-hrow",
    name: "as-hname",
    pin: "as-hpin",
    pinPinned: "is-pinned",
    dots: "as-hdots",
    loading: "as-loading",
    empty: "as-empty",
    spinner: "as-spin",
  },
  dashboard: {
    item: "history-item",
    active: "active",
    pinned: "pinned",
    menuOpen: "menu-open",
    row: "history-row",
    name: "history-name",
    pin: "history-pin",
    pinPinned: "is-pinned",
    dots: "history-dots",
    loading: "sidebar-loading",
    empty: "sidebar-empty",
    spinner: "mini-spinner",
  },
};

/**
 * Shared summary history list (search filtering, pin, hover preview).
 *
 * @param {{
 *   variant?: "app" | "dashboard";
 *   history: object[];
 *   historySearch?: string;
 *   historyLoading?: boolean;
 *   isGuest?: boolean;
 *   timeAgo: (date: string) => string;
 *   onNavigate: (id: number | string, sources?: string) => void;
 *   onRefresh?: () => void | Promise<void>;
 *   onHistoryUpdated?: (updater: (prev: object[]) => object[]) => void;
 *   onOpenMenu: (anchor: object | null) => void;
 *   historyMenuId?: number | string | null;
 *   activeSummaryId?: number | null;
 * }} props
 */
export default function SummaryHistoryRows({
  variant = "app",
  history,
  historySearch = "",
  historyLoading = false,
  isGuest = false,
  timeAgo,
  onNavigate,
  onRefresh,
  onHistoryUpdated,
  onOpenMenu,
  historyMenuId = null,
  activeSummaryId = null,
}) {
  const c = VARIANT[variant] || VARIANT.app;
  const [pinningId, setPinningId] = useState(null);
  const [toast, setToast] = useState(null);

  const { sorted, isEmpty, noMatches } = useMemo(
    () => prepareHistoryList(history, historySearch),
    [history, historySearch],
  );

  async function togglePinSummary(summary, e) {
    e?.stopPropagation?.();
    if (!summary?.id || pinningId === summary.id) return;
    const nextPinned = !summary.pinned;
    setPinningId(summary.id);
    try {
      const res = await fetch(`/api/summary/${summary.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: nextPinned }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not update pin");
      const patch = (prev) =>
        sortHistoryItems(
          prev.map((h) =>
            h.id === summary.id
              ? {
                  ...h,
                  pinned: nextPinned,
                  pinnedAt: nextPinned
                    ? data.pinnedAt || new Date().toISOString()
                    : null,
                }
              : h,
          ),
        );
      if (onHistoryUpdated) onHistoryUpdated(patch);
      await onRefresh?.();
    } catch (err) {
      setToast({
        message: err?.message || "Could not update pin.",
      });
      setTimeout(() => setToast(null), 3200);
    } finally {
      setPinningId(null);
    }
  }

  function openSummary(h, sources) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("s2n-cancel-highlighter"));
    }
    onNavigate(h.id, sources);
  }

  if (isGuest) {
    return <GuestSidebarPrompt />;
  }

  if (historyLoading) {
    return (
      <div className={c.loading}>
        <div className={c.spinner} /> <LoadingText active>Loading</LoadingText>
      </div>
    );
  }

  if (isEmpty) {
    return <div className={c.empty}>No summaries yet</div>;
  }

  if (noMatches) {
    return <div className={c.empty}>No matches</div>;
  }

  return (
    <>
      {sorted.map((h) => {
        const isActive =
          activeSummaryId != null && Number(h.id) === activeSummaryId;
        const itemClass = [
          c.item,
          isActive ? c.active : "",
          h.pinned ? c.pinned : "",
          historyMenuId === h.id ? c.menuOpen : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div key={h.id}>
            <HistoryTitleHoverPreview
              summary={h}
              summarizeForLabel={formatSummarizeForLabel(h.summarizeFor)}
              timeAgoLabel={timeAgo(h.createdAt)}
              forceClose={historyMenuId === h.id}
              className={itemClass}
              role="button"
              tabIndex={0}
              onClick={() => openSummary(h)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openSummary(h);
                }
              }}
            >
              <div className={c.row}>
                <div className={c.name}>{h.title}</div>
                <button
                  type="button"
                  className={`${c.pin}${h.pinned ? ` ${c.pinPinned}` : ""}`}
                  title={h.pinned ? "Unpin from top" : "Pin to top"}
                  aria-label={h.pinned ? "Unpin summary" : "Pin summary"}
                  aria-pressed={Boolean(h.pinned)}
                  onClick={(e) => void togglePinSummary(h, e)}
                >
                  {pinningId === h.id ? (
                    <span className={c.spinner} />
                  ) : (
                    <PinIcon size={13} filled={Boolean(h.pinned)} />
                  )}
                </button>
                <button
                  type="button"
                  className={c.dots}
                  title="Options"
                  onClick={(e) => {
                    e.stopPropagation();
                    const r = e.currentTarget.getBoundingClientRect();
                    onOpenMenu(
                      historyMenuId === h.id
                        ? null
                        : {
                            id: h.id,
                            top: r.top,
                            left: r.left,
                            right: r.right,
                            bottom: r.bottom,
                          },
                    );
                  }}
                >
                  <DotsIcon />
                </button>
              </div>
            </HistoryTitleHoverPreview>
          </div>
        );
      })}
      {toast ? (
        <div className="summary-history-toast" role="status">
          {toast.message}
        </div>
      ) : null}
    </>
  );
}
