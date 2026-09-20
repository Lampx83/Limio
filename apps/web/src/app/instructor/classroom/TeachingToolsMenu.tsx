"use client";

import { useState, useEffect } from "react";
import TeachingToolsDrawer from "./TeachingToolsDrawer";

interface TeachingToolsMenuProps {
  lessonId: string;
}

export default function TeachingToolsMenu({
  lessonId,
}: TeachingToolsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Close drawer on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      return () => document.removeEventListener("keydown", handleEsc);
    }
  }, [isOpen]);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2"
        aria-label="Mở menu hoạt động nhanh"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 000 4m0-2v2m0-6V4m6 6a2 2 0 11-4 0 2 2 0 014 0m0 0V6m0 6v4m0 0a2 2 0 11-4 0 2 2 0 014 0m0 0V4"
          />
        </svg>
      </button>

      {/* Drawer */}
      <TeachingToolsDrawer
        lessonId={lessonId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
