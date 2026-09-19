"use client";

import { useRef, useEffect, useLayoutEffect } from "react";
import { Type, List, Palette } from "lucide-react";

interface NotesEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  autoFit?: boolean;
}

const COLORS = [
  { name: "Vàng", value: "#fef08a" },
  { name: "Xanh lá", value: "#bbf7d0" },
  { name: "Xanh dương", value: "#bfdbfe" },
  { name: "Hồng", value: "#fbcfe8" },
  { name: "Cam", value: "#fed7aa" },
  { name: "Tím", value: "#e9d5ff" },
];

export default function NotesEditor({
  value,
  onChange,
  placeholder = "Nhập ghi chú...",
  className = "input w-full h-full resize font-mono text-sm",
  rows = 8,
  autoFit = false,
}: NotesEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    if (!autoFit || !outerRef.current || !editorRef.current) return;

    const fit = () => {
      const outer = outerRef.current!;
      const inner = editorRef.current!;
      inner.style.fontSize = "8px";

      let lo = 8, hi = 400;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        inner.style.fontSize = `${mid}px`;
        if (inner.scrollHeight <= outer.clientHeight && inner.scrollWidth <= outer.clientWidth) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
      inner.style.fontSize = `${lo}px`;
    };

    fitRef.current = fit;
    const ro = new ResizeObserver(fit);
    ro.observe(outerRef.current);
    fit();
    return () => { ro.disconnect(); fitRef.current = null; };
  }, [autoFit]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const next = value || "";
    if (el.innerHTML !== next) {
      el.innerHTML = next;
      fitRef.current?.();
    }
  }, [value]);

  const insertHeading = (level: 1 | 2 | 3) => {
    const tag = `h${level}`;
    document.execCommand("formatBlock", false, `<${tag}>`);
    editorRef.current?.focus();
  };

  const insertBulletList = () => {
    document.execCommand("insertUnorderedList", false);
    editorRef.current?.focus();
  };

  const applyColor = (color: string) => {
    document.execCommand("backColor", false, color);
    editorRef.current?.focus();
    closeColorPicker();
  };

  const closeColorPicker = () => {
    if (colorPickerRef.current) {
      colorPickerRef.current.style.display = "none";
    }
  };

  const toggleColorPicker = () => {
    const picker = colorPickerRef.current;
    if (picker) {
      picker.style.display = picker.style.display === "none" ? "flex" : "none";
    }
  };

  const changeFontSize = (size: number) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && selection.toString().length > 0) {
      // If text is selected, apply size to selection. Strip any font-size
      // already set on nested elements first — otherwise an inner span's
      // inline style keeps overriding the new outer size and re-applying a
      // different size silently does nothing.
      const range = selection.getRangeAt(0);
      const fragment = range.extractContents();
      const wrapper = document.createElement("div");
      wrapper.appendChild(fragment);
      wrapper.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
        el.style.fontSize = "";
        if (!el.getAttribute("style")) el.removeAttribute("style");
      });
      const span = document.createElement("span");
      span.style.fontSize = `${size}px`;
      while (wrapper.firstChild) span.appendChild(wrapper.firstChild);
      range.insertNode(span);

      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      selection.addRange(newRange);
    } else {
      // If no selection, apply to whole paragraph or line
      document.execCommand("insertHTML", false, `<span style="font-size: ${size}px;"></span>`);
    }
    editorRef.current?.focus();
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  return (
    <div className={`flex flex-col gap-2${autoFit ? " h-full" : ""}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Font Size Input */}
        <div className="flex items-center gap-1">
          <label className="text-xs font-medium">Size:</label>
          <input
            type="number"
            min="16"
            max="120"
            defaultValue="16"
            onChange={(e) => {
              const size = parseInt(e.target.value) || 16;
              changeFontSize(size);
            }}
            className="input text-xs w-16 px-2 py-1"
            title="Nhập kích thước chữ (px)"
          />
          <span className="text-xs text-gray-500">px</span>
        </div>

        {/* Quick Size Buttons */}
        <div className="flex gap-1">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => changeFontSize(32)}
            className="btn-secondary btn-sm px-2 py-1 text-xs"
            title="32px"
          >
            32px
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => changeFontSize(48)}
            className="btn-secondary btn-sm px-2 py-1 text-xs"
            title="48px"
          >
            48px
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => changeFontSize(64)}
            className="btn-secondary btn-sm px-2 py-1 text-xs"
            title="64px - Lớn cho máy chiếu"
          >
            64px
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => changeFontSize(80)}
            className="btn-secondary btn-sm px-2 py-1 text-xs font-bold"
            title="80px - Cực lớn"
          >
            80px
          </button>
        </div>

        {/* Heading Dropdown */}
        <div className="relative group">
          <button
            className="btn-secondary btn-sm inline-flex items-center gap-1 px-2 py-1.5"
            title="Heading"
          >
            <Type size={16} />
            <span className="text-xs">Heading</span>
            <span className="text-xs">▼</span>
          </button>
          <div className="absolute left-0 top-full mt-1 hidden group-hover:flex flex-col bg-white border border-gray-200 rounded shadow-lg z-10 dark:bg-gray-800 dark:border-gray-700">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertHeading(1)}
              className="px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap text-3xl font-bold"
            >
              H1
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertHeading(2)}
              className="px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap text-2xl font-bold"
            >
              H2
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertHeading(3)}
              className="px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap text-xl font-bold"
            >
              H3
            </button>
          </div>
        </div>

        {/* Bullet List Button */}
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertBulletList}
          className="btn-secondary btn-sm inline-flex items-center gap-1 px-2 py-1.5"
          title="Bullet list"
        >
          <List size={16} />
          <span className="text-xs">List</span>
        </button>

        {/* Color Picker Button */}
        <div className="relative">
          <button
            onClick={toggleColorPicker}
            className="btn-secondary btn-sm inline-flex items-center gap-1 px-2 py-1.5"
            title="Highlight color"
          >
            <Palette size={16} />
            <span className="text-xs">Màu</span>
          </button>
          <div
            ref={colorPickerRef}
            className="hidden absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg p-2 z-20 dark:bg-gray-800 dark:border-gray-700"
          >
            <div className="flex gap-1 flex-wrap w-40">
              {COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => applyColor(color.value)}
                  className="w-6 h-6 rounded border border-gray-300 hover:border-gray-600 transition-all"
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Editor */}
      {autoFit ? (
        <div ref={outerRef} style={{ flex: 1, overflow: "hidden", position: "relative", minHeight: 0 }}>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={() => {
              if (editorRef.current) {
                onChange(editorRef.current.innerHTML);
                fitRef.current?.();
              }
            }}
            onBlur={() => {
              closeColorPicker();
            }}
            style={{ outline: "none" }}
            className={className}
            data-placeholder={placeholder}
          />
        </div>
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => {
            if (editorRef.current) {
              onChange(editorRef.current.innerHTML);
            }
          }}
          onBlur={() => {
            closeColorPicker();
          }}
          style={{ outline: "none" }}
          className={className}
          data-placeholder={placeholder}
        />
      )}

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: rgb(107, 114, 128);
          pointer-events: none;
        }

        [contenteditable] h1 {
          font-size: 3.5rem;
          font-weight: 900;
          margin: 0.5em 0;
          line-height: 1.2;
        }

        [contenteditable] h2 {
          font-size: 2.5rem;
          font-weight: 800;
          margin: 0.5em 0;
          line-height: 1.2;
        }

        [contenteditable] h3 {
          font-size: 2rem;
          font-weight: 700;
          margin: 0.5em 0;
          line-height: 1.2;
        }

        [contenteditable] ul {
          list-style: disc;
          margin-left: 1.5em;
          margin: 0.5em 0;
          font-size: 1.25rem;
        }

        [contenteditable] li {
          margin: 0.25em 0;
        }
      `}</style>
    </div>
  );
}
