import { describe, expect, it } from "vitest";
import {
  dialogueEditorFromPayload,
  dialoguePayloadFromEditor,
  emptyTurn,
  emptyVocabItem,
  moveItem,
  nextSpeaker,
  validateDialogueEditor,
  validateVocabEditor,
  vocabEditorFromPayload,
  vocabPayloadFromEditor,
} from "@/lib/langBlockEditor";

/**
 * LANG G2 / G2.1.6 + G2.2.1 — chuyển đổi giữa state của form soạn bài và payload
 * gửi lên server. Quan trọng nhất: id của dòng/lượt không đổi qua các lần sửa.
 */

const ID1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("vocab: payload ⇄ state form", () => {
  it("mở khối đã lưu vào form rồi lưu lại không đổi gì: giữ id, thứ tự và nội dung", () => {
    const payload = {
      title: "Từ mới",
      readingLabel: "Pinyin",
      items: [
        { id: ID1, term: "朋友", reading: "péngyou", meaning: "bạn bè", example: "他是我的朋友。", audioUrl: "/a.mp3" },
        { id: ID2, term: "你好", meaning: "xin chào" },
      ],
    };
    const back = vocabPayloadFromEditor(vocabEditorFromPayload(payload));
    expect(back).toEqual(payload);
  });

  it("trường để trống không được gửi lên (payload gọn, không có chuỗi rỗng)", () => {
    const v = vocabEditorFromPayload({ items: [{ id: ID1, term: "a", meaning: "b" }] });
    const out = vocabPayloadFromEditor(v);
    expect(out.items[0]).toEqual({ id: ID1, term: "a", meaning: "b" });
    expect("title" in out).toBe(false);
    expect("readingLabel" in out).toBe(false);
  });

  it("dòng mới thêm trong form có id riêng, khác nhau", () => {
    const a = emptyVocabItem();
    const b = emptyVocabItem();
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(a.id).not.toBe(b.id);
  });

  it("dòng trống hoàn toàn (người dùng bấm Thêm dòng nhưng chưa điền) bị bỏ khi lưu", () => {
    const v = vocabEditorFromPayload({ items: [{ id: ID1, term: "a", meaning: "b" }] });
    v.items.push(emptyVocabItem());
    expect(vocabPayloadFromEditor(v).items).toHaveLength(1);
  });

  it("payload hỏng hoặc rỗng mở ra form với một dòng trống để điền", () => {
    expect(vocabEditorFromPayload(null).items).toHaveLength(1);
    expect(vocabEditorFromPayload({ items: "sai" }).items).toHaveLength(1);
  });

  it("validateVocabEditor: cần ít nhất 1 dòng đủ từ + nghĩa; dòng thiếu một nửa được chỉ ra theo số thứ tự", () => {
    const ok = vocabEditorFromPayload({ items: [{ id: ID1, term: "a", meaning: "b" }] });
    expect(validateVocabEditor(ok)).toEqual([]);

    const empty = vocabEditorFromPayload(null);
    expect(validateVocabEditor(empty)[0]).toMatch(/ít nhất/);

    const half = vocabEditorFromPayload({ items: [{ id: ID1, term: "a", meaning: "b" }] });
    half.items.push({ ...emptyVocabItem(), term: "chỉ có từ" });
    half.items.push({ ...emptyVocabItem(), meaning: "chỉ có nghĩa" });
    const errs = validateVocabEditor(half);
    expect(errs.join(" ")).toContain("Dòng 2");
    expect(errs.join(" ")).toContain("nghĩa");
    expect(errs.join(" ")).toContain("Dòng 3");
    expect(errs.join(" ")).toContain("từ");
  });
});

describe("dialogue: payload ⇄ state form", () => {
  it("giữ nguyên id, thứ tự, audio từng lượt và audio cả bài", () => {
    const payload = {
      title: "Hội thoại",
      caption: "Nghe hai lần.",
      audioUrl: "/all.mp3",
      turns: [
        { id: ID1, speaker: "A", text: "你好！", reading: "Nǐ hǎo!", translation: "Xin chào!", audioUrl: "/t1.mp3" },
        { id: ID2, speaker: "B", text: "再见" },
      ],
    };
    expect(dialoguePayloadFromEditor(dialogueEditorFromPayload(payload))).toEqual(payload);
  });

  it("lượt trống bị bỏ; trường trống không gửi lên", () => {
    const v = dialogueEditorFromPayload({ turns: [{ id: ID1, speaker: "A", text: "x" }] });
    v.turns.push(emptyTurn());
    const out = dialoguePayloadFromEditor(v);
    expect(out.turns).toEqual([{ id: ID1, speaker: "A", text: "x" }]);
    expect("audioUrl" in out).toBe(false);
  });

  it("validateDialogueEditor: cần ít nhất 1 lượt đủ người nói + lời; lượt thiếu một nửa chỉ ra số thứ tự", () => {
    expect(validateDialogueEditor(dialogueEditorFromPayload(null))[0]).toMatch(/ít nhất/);
    const v = dialogueEditorFromPayload({ turns: [{ id: ID1, speaker: "A", text: "x" }] });
    expect(validateDialogueEditor(v)).toEqual([]);
    v.turns.push({ ...emptyTurn(), speaker: "B" });
    expect(validateDialogueEditor(v).join(" ")).toContain("Lượt 2");
  });
});

describe("moveItem — đổi thứ tự dòng", () => {
  it("lên/xuống trả mảng mới; chạm biên thì không đổi", () => {
    const a = [1, 2, 3];
    expect(moveItem(a, 1, -1)).toEqual([2, 1, 3]);
    expect(moveItem(a, 1, 1)).toEqual([1, 3, 2]);
    expect(moveItem(a, 0, -1)).toEqual([1, 2, 3]);
    expect(moveItem(a, 2, 1)).toEqual([1, 2, 3]);
    expect(a).toEqual([1, 2, 3]);
  });
});

describe("nextSpeaker — gợi ý người nói cho lượt kế tiếp", () => {
  const t = (speaker: string, text = "x") => ({ speaker, text });

  it("chưa có lượt nào hoặc toàn lượt trống → không gợi ý", () => {
    expect(nextSpeaker([])).toBe("");
    expect(nextSpeaker([t("", ""), t("  ", "")])).toBe("");
  });

  it("chỉ có một người nói: nếu là một chữ cái thì gợi ý chữ kế tiếp, còn tên khác thì để trống", () => {
    expect(nextSpeaker([t("A")])).toBe("B");
    expect(nextSpeaker([t("B")])).toBe("C");
    expect(nextSpeaker([t("Cô giáo")])).toBe("");
    expect(nextSpeaker([t("Z")])).toBe("");
  });

  it("từ hai người trở lên: người kế tiếp theo vòng tròn sau lượt cuối", () => {
    expect(nextSpeaker([t("A"), t("B")])).toBe("A");
    expect(nextSpeaker([t("A"), t("B"), t("A")])).toBe("B");
    expect(nextSpeaker([t("A"), t("B"), t("C")])).toBe("A");
    expect(nextSpeaker([t("Cô giáo"), t("Học sinh")])).toBe("Cô giáo");
  });

  it("bỏ qua lượt trống ở cuối; so tên không phân biệt khoảng trắng thừa", () => {
    expect(nextSpeaker([t("A"), t("B"), t("", "")])).toBe("A");
    expect(nextSpeaker([t("A "), t(" B")])).toBe("A");
  });
});

describe("hội thoại: mốc thời gian startSec (K2)", () => {
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";
  const payload = {
    audioUrl: "/api/lesson-media/audio/a.mp3",
    turns: [
      { id: A, speaker: "A", text: "x", startSec: 1.5 },
      { id: B, speaker: "B", text: "y" },
    ],
  };
  it("khứ hồi giữ nguyên startSec; lượt không mốc không có trường", () => {
    const v = dialogueEditorFromPayload(payload);
    expect(v.turns.map((t) => t.startSec)).toEqual([1.5, undefined]);
    expect(dialoguePayloadFromEditor(v)).toEqual(payload);
  });
  it("lượt mới trống chưa có mốc", () => {
    expect(dialogueEditorFromPayload(null).turns[0]!.startSec).toBeUndefined();
  });
  it("validateDialogueEditor báo mốc không tăng dần (đổi thứ tự lượt) — chỉ tính lượt có đủ nội dung", () => {
    const v = dialogueEditorFromPayload({
      turns: [
        { id: A, speaker: "A", text: "x", startSec: 5 },
        { id: B, speaker: "B", text: "y", startSec: 2 },
      ],
    });
    expect(validateDialogueEditor(v).some((e) => /lượt 2/i.test(e))).toBe(true);
  });
});
