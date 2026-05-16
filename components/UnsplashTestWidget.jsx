"use client";

import { useState } from "react";

export default function UnsplashTestWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setImage("");

    try {
      const res = await fetch(
        `/api/dev/unsplash?query=${encodeURIComponent(query)}`,
      );
      if (!res.ok) {
        throw new Error("Failed to fetch image");
      }
      const data = await res.json();
      if (data.url) {
        setImage(data.url);
      } else {
        setError("No image found for this query");
      }
    } catch (err) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] font-sans">
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-72 bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-xl border border-gray-200 dark:border-zinc-700 flex flex-col gap-3 transition-all duration-300">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200">
              Test Unsplash API
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-gray-200"
              placeholder="Search keyword..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {loading ? "..." : "Find"}
            </button>
          </div>
          {error && (
            <p className="text-red-500 text-xs text-center font-medium">
              {error}
            </p>
          )}
          {image && (
            <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 aspect-video flex-shrink-0 relative">
              <img
                src={image}
                alt={query}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform active:scale-95"
        title="Test Unsplash Feature"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      </button>
    </div>
  );
}
