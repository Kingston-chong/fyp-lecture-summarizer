"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { CloseIcon, Spinner, ChevronDownIcon } from "@/app/components/icons";
import { useDraggablePosition } from "../hooks/useDraggablePosition";
import { NEW_SET_VALUE } from "../hooks/useFlashcardSets";
import "@/app/components/QuizSettingsModal.css";
import "../flashcard-manual.css";

/** Short label for dropdown trigger; full title stays in menu + title tooltip. */
function shortenFlashcardSetLabel(title, maxLen = 34) {
  const t = String(title ?? "").trim();
  if (!t) return "Flashcard set";
  if (t.length <= maxLen) return t;
  const prefix = "Flashcards for ";
  if (t.toLowerCase().startsWith(prefix.toLowerCase())) {
    const rest = t.slice(prefix.length).trim();
    const room = maxLen - prefix.length - 1;
    if (room < 2) return "Flashcards…";
    const shortRest =
      rest.length > room ? `${rest.slice(0, Math.max(room, 1))}…` : rest;
    return `${prefix}${shortRest}`;
  }
  return `${t.slice(0, maxLen - 1)}…`;
}

function OptionDropdown({
  value,
  onChange,
  options,
  disabled = false,
  title,
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? value;

  return (
    <div
      className={`qsm-dropdown fc-create-dropdown${open ? " fc-create-dropdown--open" : ""}`}
    >
      <button
        type="button"
        className="qsm-dropdown-btn"
        disabled={disabled}
        title={title ?? label}
        onClick={() => !disabled && setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      >
        <span className="fc-create-dropdown-label">{label}</span>
        <span className="fc-create-dropdown-chevron" aria-hidden>
          <ChevronDownIcon size={12} />
        </span>
      </button>
      {open && !disabled && (
        <div className="qsm-dropdown-menu">
          {options.map((o) => (
            <div
              key={o.value}
              role="option"
              title={o.fullLabel ?? o.label}
              className={`qsm-dropdown-item${value === o.value ? " qsm-dropdown-item--selected" : ""}`}
              onMouseDown={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.menuLabel ?? o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CreateFlashcardDialog({
  flashcardSets,
  defaultSetId = null,
  onClose,
  onSave,
  fetchSetDetails,
}) {
  const { position, onDragPointerDown } = useDraggablePosition({
    defaultRight: 24,
    defaultTop: 80,
    panelWidth: 420,
    panelHeight: 420,
  });

  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [saveIn, setSaveIn] = useState(
    defaultSetId != null ? String(defaultSetId) : NEW_SET_VALUE,
  );
  const [atPage, setAtPage] = useState("1");
  const [cardCount, setCardCount] = useState(0);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setOptions = useMemo(() => {
    const opts = flashcardSets.map((s, i) => {
      const full = s.title?.trim() || `Flashcard set #${i + 1}`;
      return {
        value: String(s.id),
        label: shortenFlashcardSetLabel(full),
        menuLabel: full,
        fullLabel: full,
      };
    });
    return [
      {
        value: NEW_SET_VALUE,
        label: "+ New flashcard set",
        menuLabel: "+ New flashcard set",
        fullLabel: "Create a new flashcard set",
      },
      ...opts,
    ];
  }, [flashcardSets]);

  const selectedSetFullTitle = useMemo(() => {
    const hit = setOptions.find((o) => o.value === saveIn);
    return hit?.fullLabel ?? hit?.label ?? "";
  }, [setOptions, saveIn]);

  const loadMeta = useCallback(
    async (setId) => {
      if (!setId || setId === NEW_SET_VALUE) {
        setCardCount(0);
        setAtPage("1");
        return;
      }
      setLoadingMeta(true);
      try {
        const set = await fetchSetDetails(Number(setId));
        const n = set?.cards?.length ?? 0;
        setCardCount(n);
        setAtPage(String(n + 1));
      } catch {
        setCardCount(0);
        setAtPage("1");
      } finally {
        setLoadingMeta(false);
      }
    },
    [fetchSetDetails],
  );

  useEffect(() => {
    void loadMeta(saveIn);
  }, [saveIn, loadMeta]);

  useEffect(() => {
    if (defaultSetId != null) setSaveIn(String(defaultSetId));
  }, [defaultSetId]);

  const pageOptions = useMemo(() => {
    const n = saveIn === NEW_SET_VALUE ? 0 : Math.max(0, cardCount);
    const max = n + 1;
    return Array.from({ length: max }, (_, i) => ({
      value: String(i + 1),
      label: String(i + 1),
    }));
  }, [saveIn, cardCount]);

  const handleSave = async () => {
    const q = front.trim();
    const a = back.trim();
    if (!q || !a) {
      setError("Question and answer are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const wasNewSet = saveIn === NEW_SET_VALUE;
      const result = await onSave({
        saveIn,
        atPosition: Number.parseInt(atPage, 10) || 1,
        front: q,
        back: a,
      });
      setFront("");
      setBack("");
      const targetSetId = wasNewSet && result?.id ? String(result.id) : saveIn;
      if (wasNewSet && result?.id) setSaveIn(String(result.id));
      await loadMeta(targetSetId);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!position) return null;

  return (
    <div className="fc-drag-layer" role="presentation">
      <div
        className="fc-drag-panel"
        style={{ left: position.left, top: position.top }}
        role="dialog"
        aria-labelledby="fc-create-title"
        aria-modal="false"
      >
        <div className="fc-drag-head" onPointerDown={onDragPointerDown}>
          <span id="fc-create-title" className="fc-drag-title">
            Create flashcard
          </span>
          <button
            type="button"
            className="fc-drag-close"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon size={14} />
          </button>
        </div>

        <div className="fc-drag-body">
          <label className="fc-field-label" htmlFor="fc-front">
            Flashcard question
          </label>
          <input
            id="fc-front"
            type="text"
            className="fc-field-input"
            value={front}
            onChange={(e) => setFront(e.target.value)}
            placeholder="Term or question"
          />

          <label className="fc-field-label" htmlFor="fc-back">
            Flashcard answer
          </label>
          <textarea
            id="fc-back"
            className="fc-field-input fc-field-input--area"
            value={back}
            onChange={(e) => setBack(e.target.value)}
            placeholder="Answer or definition"
          />

          <div className="fc-field-row">
            <div className="fc-field-cell fc-field-cell--grow">
              <label className="fc-field-label">Save in</label>
              <OptionDropdown
                value={saveIn}
                onChange={setSaveIn}
                options={setOptions}
                title={selectedSetFullTitle}
              />
            </div>
            <div className="fc-field-cell fc-field-cell--page">
              <label className="fc-field-label">
                At page{loadingMeta ? " …" : ""}
              </label>
              <OptionDropdown
                value={atPage}
                onChange={setAtPage}
                options={pageOptions}
                disabled={loadingMeta || pageOptions.length === 0}
              />
            </div>
          </div>

          {error && <div className="fc-drag-error">{error}</div>}

          <div className="fc-drag-foot">
            <button
              type="button"
              className="fc-save-btn"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? (
                <>
                  <Spinner size={12} /> Saving…
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
