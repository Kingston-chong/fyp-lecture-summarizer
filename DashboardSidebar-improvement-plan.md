# DashboardSidebar UI Improvement Plan

## Overview

This document outlines targeted UI improvements for `DashboardSidebar.jsx`. Each issue is described with its current behavior, the problem it causes, and the recommended fix with implementation notes.

---

## 1. Replace character-based action icons with proper icon components

**Current behavior:** Action buttons use raw Unicode characters — `⧉` for preview, `+` for add, `×` for remove.

**Problem:** These characters render inconsistently across browsers and operating systems, have no semantic meaning for screen readers, and look unprofessional compared to the rest of the interface.

**Fix:** Replace all three with Tabler icon components (or equivalent icon library already in the project). Wrap each in a consistently-sized button (26×26px) with a visible border and hover state.

```jsx
// Before
<button className="prev-peek">⧉</button>
<button className="prev-remove">×</button>
<div className="prev-add">{isAdded ? "✓" : "+"}</div>

// After
<button className="prev-btn" aria-label="Preview file"><EyeIcon /></button>
<button className="prev-btn danger" aria-label="Remove file"><TrashIcon /></button>
<button className="prev-btn add" aria-label={isAdded ? "Added" : "Add to session"}>
  {isAdded ? <CheckIcon /> : <PlusIcon />}
</button>
```

---

## 2. Reflect "added" state on the entire file row, not just the button

**Current behavior:** When a file is added to the session, only the `+` button changes to `✓`. The rest of the row is visually identical to unadded files.

**Problem:** Users cannot quickly scan which files are active without inspecting each action button individually.

**Fix:** Apply an `added` class to the entire `prev-item` row when `isAdded` is true. Use a subtle success-tinted background, and change the filename color to match. This makes added files immediately distinguishable at a glance.

```jsx
<div className={`prev-item ${isAdded ? "added" : ""}`}>
```

```css
.prev-item.added {
  background: var(--color-background-success);
}
.prev-item.added .prev-name {
  color: var(--color-text-success);
}
.prev-item.added .prev-icon {
  color: var(--color-text-success);
}
```

---

## 3. Resolve the double-add affordance conflict

**Current behavior:** Clicking the `prev-item-main` area calls `addPrevFile(doc)`, and the `+` button also calls `addPrevFile(doc)`. Two separate click targets do the same thing.

**Problem:** This is confusing — users may not understand why clicking the row body adds a file. It also makes the `+` button feel redundant. The row click conflicts with the checkbox selection UX.

**Fix:** Remove the `onClick` from `prev-item-main`. Reserve the row body click for potential future use (e.g. expanding a file preview inline). The `+` button should be the sole add trigger.

```jsx
// Before
<div className="prev-item-main" onClick={() => addPrevFile(doc)}>

// After
<div className="prev-item-main">
```

---

## 4. Improve the bulk delete button

**Current behavior:** The button renders as `Delete selected (3)` — a string that changes width as selection count changes, causing layout shifts.

**Problem:** The variable-width label causes the button to resize on every checkbox toggle. The count is embedded in prose, which is harder to scan than a visual badge.

**Fix:** Use a stable label with a separate count badge. The badge can update without reflowing the button.

```jsx
// Before
<button className="prev-bulk-remove">
  {bulkRemoving ? "Deleting..." : `Delete selected (${selectedPrevDocIds.length})`}
</button>

// After
<button className="prev-bulk-remove" disabled={bulkRemoving || selectedPrevDocIds.length === 0}>
  <TrashIcon />
  {bulkRemoving ? "Deleting…" : "Delete"}
  {!bulkRemoving && selectedPrevDocIds.length > 0 && (
    <span className="bulk-badge">{selectedPrevDocIds.length}</span>
  )}
</button>
```

```css
.bulk-badge {
  background: var(--color-background-danger);
  color: var(--color-text-danger);
  border-radius: 99px;
  padding: 1px 6px;
  font-size: 11px;
  font-weight: 500;
}
```

---

## 5. Improve history item information hierarchy

**Current behavior:** `history-name`, `history-meta`, and `history-date` are stacked with no visual weight differentiation beyond what the existing CSS may provide.

**Problem:** On a quick scan, all three lines compete for attention. The title should dominate, with meta and date receding clearly.

**Fix:** Establish a strict three-level type scale:

| Element | Size | Weight | Color |
|---|---|---|---|
| `.history-name` | 13px | 500 | `--color-text-primary` |
| `.history-meta` | 11px | 400 | `--color-text-secondary` |
| `.history-date` | 11px | 400 | `--color-text-tertiary` |

Add `2px` bottom margin to `.history-name` to create breathing room between the title and supporting info.

---

## 6. Style history file chips as pills

**Current behavior:** Expanded history file chips (`history-file-chip`) are plain `div` elements with an icon and a name.

**Problem:** They blend into the surrounding content and don't visually read as discrete, bounded objects.

**Fix:** Give chips a pill shape with a subtle border and muted background. Constrain their width and use `text-overflow: ellipsis` (already present) so they don't overflow the sidebar.

```css
.history-file-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--color-text-secondary);
  padding: 3px 10px;
  border-radius: 99px;
  border: 0.5px solid var(--color-border-tertiary);
  background: var(--color-background-secondary);
  max-width: 100%;
  overflow: hidden;
}
```

---

## 7. Add a search icon inset to the search input

**Current behavior:** The search input renders as a plain text field with a placeholder.

**Problem:** Without a search icon, the input does not visually communicate its purpose at a glance, especially when the sidebar is narrow.

**Fix:** Use a relative-positioned wrapper with an absolutely-positioned search icon, and add left padding to the input so text does not overlap the icon.

```jsx
<div className="sidebar-search-wrap">
  <SearchIcon className="sidebar-search-icon" aria-hidden />
  <input
    type="search"
    className="sidebar-search"
    placeholder="Search summaries…"
    ...
  />
</div>
```

```css
.sidebar-search-wrap {
  position: relative;
  padding: 0 10px 6px;
}
.sidebar-search-icon {
  position: absolute;
  left: 18px;
  top: 50%;
  transform: translateY(-60%);
  font-size: 13px;
  color: var(--color-text-tertiary);
  pointer-events: none;
}
.sidebar-search {
  padding-left: 30px;
}
```

---

## 8. Make section headers uppercase and use consistent label styling

**Current behavior:** Section headers use sentence-case text with inline icons: `History`, `Previous Uploaded`.

**Problem:** The label style does not visually differentiate section headers from content items, making the sidebar's structure harder to parse at a glance.

**Fix:** Use uppercase 12px labels with `letter-spacing: 0.04em` and `--color-text-secondary`. This is a common pattern for sidebar section groupings and creates clear visual hierarchy without adding extra chrome.

```css
.sidebar-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  display: flex;
  align-items: center;
  gap: 8px;
}
```

---

## 9. Add `aria-label` to all icon-only buttons

**Current behavior:** Preview, remove, and add buttons have `title` attributes but no `aria-label`.

**Problem:** `title` attributes are not reliably announced by screen readers and do not appear on touch devices. Icon-only buttons without `aria-label` are inaccessible.

**Fix:** Add `aria-label` to every icon-only button. Include the file name in the label for remove/preview to provide enough context.

```jsx
<button aria-label={`Preview ${doc.name}`}>...</button>
<button aria-label={`Remove ${doc.name}`}>...</button>
<button aria-label={isAdded ? `${doc.name} added` : `Add ${doc.name}`}>...</button>
```

---

## Summary of changes

| # | Issue | Impact | Effort |
|---|---|---|---|
| 1 | Replace character icons | Visual consistency, accessibility | Low |
| 2 | Row-level added state | Scannability | Low |
| 3 | Remove double-add on row click | Interaction clarity | Low |
| 4 | Bulk delete badge | Layout stability | Low |
| 5 | History type hierarchy | Readability | Low |
| 6 | History chip pill style | Visual polish | Low |
| 7 | Search input icon | Discoverability | Low |
| 8 | Uppercase section labels | Structure clarity | Low |
| 9 | `aria-label` on icon buttons | Accessibility | Low |

All changes are CSS/JSX-level and do not require changes to props, state, or parent components.
