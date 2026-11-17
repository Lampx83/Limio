"use client";

import { hskT } from "./hskT";
import type { UiLang } from "@/lib/i18n/core";
import type { HskSection } from "@/lib/hskLesson";
import type { MessageKey } from "@/lib/i18n/dict";

const KEYS: Record<string, MessageKey> = {
  "对话": "learn.hsk.sec.dialogue",
  "生词": "learn.hsk.sec.vocab",
  "小语讲堂": "learn.hsk.sec.grammar",
  "课堂活动": "learn.hsk.sec.activity",
  "目标": "learn.hsk.sec.goals",
  "双人对话": "learn.hsk.sec.pair",
  "练习": "learn.hsk.sec.practice",
};

/** Tiêu đề mục của bài HSK: ô số (01–04), tên chữ Hán và tên theo ngôn ngữ giao diện. Luyện tập dùng ô hồng (thao tác), các mục còn lại ô xanh. */
export default function HskSectionHead({ no, section, tone, lang = "vi", children }: { no: number; section: HskSection; tone?: "pink"; lang?: UiLang; children?: React.ReactNode }) {
  const key = KEYS[section.zh];
  return (
    <div className="hsk-sh">
      <span className="hsk-sn" data-tone={tone} aria-hidden>
        {String(no).padStart(2, "0")}
      </span>
      <h2>
        <span className="zh" lang="zh-Hans">
          {section.zh}
        </span>
        {key ? hskT(lang, key) : section.vi}
      </h2>
      {children}
    </div>
  );
}
