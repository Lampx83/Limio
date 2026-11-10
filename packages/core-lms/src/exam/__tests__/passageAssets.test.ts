import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../../auth/register";
import { createCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { createContentItem } from "../../courses/contents";
import { getOwnedPracticeExamId } from "../../courses/practiceBlock";
import {
  assetFilenamesInDoc,
  audioFilenamesInDoc,
  createAudioAsset,
  createExam,
  createImageAsset,
  createPassage,
  deletePassage,
  examAssetFilename,
  getAudioTranscriptForEditor,
  getAudioTranscriptsForPassages,
  getVideoTranscriptForEditor,
  setVideoTranscript,
  videoAssetKey,
  videoKeysInDoc,
  listAudioTranscriptFlags,
  setAudioTranscript,
  updatePassage,
} from "../";

// docs/tieu-chi/bai-doc-anh-audio-xoa-transcript.md — AC1 (dọn tệp khi gỡ khỏi đoạn), AC3 (transcript), AC4 (chỉ trả khi được phép).

const BASE = "http://localhost:3000";
const doc = (...nodes: unknown[]) => ({ type: "doc", content: nodes });
const img = (f: string) => ({ type: "image", attrs: { src: `/api/exam-assets/${f}`, alt: "a" } });
const aud = (f: string) => ({ type: "audio", attrs: { src: `/api/exam-assets/${f}`, alt: "b" } });

async function setup(tag: string) {
  const owner = (await registerUser({ email: `pa-o-${tag}@e.com`, password: "password1234", displayName: "O" }, BASE)).userId;
  const c = await createCourse(owner, { title: `C ${tag}`, description: "x", slug: `pa-${tag}` });
  const m = await createModule(owner, c.courseId, { title: "U1", orderIndex: 0 });
  const l = await createLesson(owner, m.moduleId, { title: "Bài 1", orderIndex: 0 });
  const { contentItemId } = await createContentItem(owner, l.lessonId, { type: "exam_practice", payload: {}, orderIndex: 0 });
  const examId = (await getOwnedPracticeExamId(contentItemId))!;
  return { owner, courseId: c.courseId, examId };
}
const mkImage = (o: string, e: string, f: string) => createImageAsset(o, e, { s3Key: f, mimeType: "image/png", sizeBytes: 100, altText: "Ảnh" });
const mkAudio = (o: string, e: string, f: string, transcript?: string) =>
  createAudioAsset(o, e, { s3Key: f, mimeType: "audio/mpeg", sizeBytes: 100, altText: "Nghe", ...(transcript ? { transcript } : {}) });

describe("tên tệp trong tài liệu đoạn văn", () => {
  it("lấy tên tệp từ đường dẫn của kho đề, kể cả có tiền tố hoặc tham số; đường dẫn khác thì bỏ", () => {
    expect(examAssetFilename("/api/exam-assets/a-1.png")).toBe("a-1.png");
    expect(examAssetFilename("/lms/api/exam-assets/a-1.png?v=2")).toBe("a-1.png");
    expect(examAssetFilename("https://x.com/a.png")).toBeNull();
    expect(examAssetFilename("/api/exam-assets/../x")).toBeNull();
    expect(examAssetFilename(undefined)).toBeNull();
  });
  it("liệt kê ảnh + audio, hoặc chỉ audio, kể cả khối lồng nhau; video không tính", () => {
    const d = doc(img("i1.png"), { type: "paragraph", content: [{ type: "text", text: "x" }] }, aud("a1.mp3"), { type: "video", attrs: { src: "/api/exam-assets/v.mp4" } });
    expect(assetFilenamesInDoc(d).sort()).toEqual(["a1.mp3", "i1.png"]);
    expect(audioFilenamesInDoc(d)).toEqual(["a1.mp3"]);
  });
});

describe("dọn tệp khi gỡ khỏi đoạn", () => {
  it("lưu đoạn không còn ảnh/audio thì dòng ExamAsset bị xoá và tên tệp được trả để xoá khỏi kho", async () => {
    const s = await setup("prune1");
    await mkImage(s.owner, s.examId, "p1-i.png");
    await mkAudio(s.owner, s.examId, "p1-a.mp3", "lời thoại");
    const { passageId } = await createPassage(s.owner, s.examId, { title: "Đoạn", contentJson: doc(img("p1-i.png"), aud("p1-a.mp3")) });
    // gỡ ảnh, giữ audio
    const r1 = await updatePassage(s.owner, passageId, { contentJson: doc(aud("p1-a.mp3")) });
    expect(r1.removedFiles).toEqual(["p1-i.png"]);
    expect(await prisma.examAsset.count({ where: { examId: s.examId, s3Key: "p1-i.png" } })).toBe(0);
    expect(await prisma.examAsset.count({ where: { examId: s.examId, s3Key: "p1-a.mp3" } })).toBe(1);
    // gỡ nốt audio
    const r2 = await updatePassage(s.owner, passageId, { contentJson: doc() });
    expect(r2.removedFiles).toEqual(["p1-a.mp3"]);
    expect(await prisma.examAsset.count({ where: { examId: s.examId } })).toBe(0);
  });

  it("tệp vừa tải lên mà chưa nằm trong đoạn nào đã lưu thì KHÔNG bị đụng", async () => {
    const s = await setup("prune2");
    await mkImage(s.owner, s.examId, "p2-new.png"); // đang soạn dở ở đoạn khác
    const { passageId } = await createPassage(s.owner, s.examId, { title: "Đoạn", contentJson: doc() });
    const r = await updatePassage(s.owner, passageId, { title: "Đổi tên", contentJson: doc() });
    expect(r.removedFiles).toEqual([]);
    expect(await prisma.examAsset.count({ where: { examId: s.examId, s3Key: "p2-new.png" } })).toBe(1);
  });

  it("tệp còn được đoạn khác dùng thì giữ nguyên", async () => {
    const s = await setup("prune3");
    await mkImage(s.owner, s.examId, "p3-i.png");
    const a = await createPassage(s.owner, s.examId, { title: "A", contentJson: doc(img("p3-i.png")) });
    await createPassage(s.owner, s.examId, { title: "B", contentJson: doc(img("p3-i.png")) });
    const r = await updatePassage(s.owner, a.passageId, { contentJson: doc() });
    expect(r.removedFiles).toEqual([]);
    expect(await prisma.examAsset.count({ where: { examId: s.examId, s3Key: "p3-i.png" } })).toBe(1);
  });

  it("tệp dùng chung với đề khác (nhân bản) bị xoá dòng ở đề này nhưng KHÔNG được xoá khỏi kho", async () => {
    const s = await setup("prune4");
    const other = await setup("prune4b");
    await mkImage(s.owner, s.examId, "p4-shared.png");
    await mkImage(other.owner, other.examId, "p4-shared.png");
    const { passageId } = await createPassage(s.owner, s.examId, { title: "Đoạn", contentJson: doc(img("p4-shared.png")) });
    const r = await updatePassage(s.owner, passageId, { contentJson: doc() });
    expect(r.removedFiles).toEqual([]);
    expect(await prisma.examAsset.count({ where: { examId: s.examId, s3Key: "p4-shared.png" } })).toBe(0);
    expect(await prisma.examAsset.count({ where: { examId: other.examId, s3Key: "p4-shared.png" } })).toBe(1);
  });

  it("xoá cả đoạn cũng dọn tệp của đoạn đó", async () => {
    const s = await setup("prune5");
    await mkAudio(s.owner, s.examId, "p5-a.mp3");
    const { passageId } = await createPassage(s.owner, s.examId, { title: "Đoạn", contentJson: doc(aud("p5-a.mp3")) });
    const r = await deletePassage(s.owner, passageId);
    expect(r.removedFiles).toEqual(["p5-a.mp3"]);
  });

  it("đề thường đã xuất bản: không dọn (có thể đang có người làm)", async () => {
    const s = await setup("prune6");
    const { examId } = await createExam(s.owner, s.courseId, { title: "Đề thường", durationMin: 10 });
    await mkImage(s.owner, examId, "p6-i.png");
    const { passageId } = await createPassage(s.owner, examId, { title: "Đoạn", contentJson: doc(img("p6-i.png")) });
    await prisma.exam.update({ where: { id: examId }, data: { status: "published" } });
    const r = await updatePassage(s.owner, passageId, { contentJson: doc() });
    expect(r.removedFiles).toEqual([]);
    expect(await prisma.examAsset.count({ where: { examId, s3Key: "p6-i.png" } })).toBe(1);
  });
});

describe("transcript của audio", () => {
  it("giảng viên đọc/sửa/xoá trắng; vượt 20.000 ký tự bị từ chối; người lạ bị từ chối", async () => {
    const s = await setup("tr1");
    await mkAudio(s.owner, s.examId, "t1.mp3", "Cũ");
    expect(await getAudioTranscriptForEditor(s.owner, s.examId, "t1.mp3")).toMatchObject({ transcript: "Cũ" });
    await setAudioTranscript(s.owner, s.examId, "t1.mp3", "  Đoạn 1\n\nĐoạn 2  ");
    expect((await getAudioTranscriptForEditor(s.owner, s.examId, "t1.mp3")).transcript).toBe("Đoạn 1\n\nĐoạn 2");
    await expect(setAudioTranscript(s.owner, s.examId, "t1.mp3", "x".repeat(20_001))).rejects.toMatchObject({ code: "validation_failed" });
    await setAudioTranscript(s.owner, s.examId, "t1.mp3", "   ");
    expect((await prisma.examAsset.findFirstOrThrow({ where: { examId: s.examId, s3Key: "t1.mp3" } })).transcript).toBeNull();
    const stranger = (await registerUser({ email: "pa-x-tr1@e.com", password: "password1234", displayName: "X" }, BASE)).userId;
    await expect(getAudioTranscriptForEditor(stranger, s.examId, "t1.mp3")).rejects.toBeTruthy();
    await expect(setAudioTranscript(stranger, s.examId, "t1.mp3", "lậu")).rejects.toBeTruthy();
  });

  it("audio không có dòng ExamAsset (tệp ngoài) thì không có ô transcript", async () => {
    const s = await setup("tr2");
    await expect(getAudioTranscriptForEditor(s.owner, s.examId, "khong-co.mp3")).rejects.toMatchObject({ code: "asset_not_found" });
  });

  it("nhãn có/chưa có transcript theo từng audio của đề", async () => {
    const s = await setup("tr3");
    await mkAudio(s.owner, s.examId, "t3a.mp3", "Có");
    await mkAudio(s.owner, s.examId, "t3b.mp3");
    expect(await listAudioTranscriptFlags(s.owner, s.examId)).toEqual({ "t3a.mp3": true, "t3b.mp3": false });
  });

  it("lấy transcript theo đoạn: chỉ audio trong đoạn và có chữ; tên tệp là khoá", async () => {
    const s = await setup("tr4");
    await mkAudio(s.owner, s.examId, "t4a.mp3", "Lời A");
    await mkAudio(s.owner, s.examId, "t4b.mp3"); // không transcript
    await mkAudio(s.owner, s.examId, "t4c.mp3", "Lời C"); // không nằm trong đoạn
    const r = await getAudioTranscriptsForPassages(s.examId, [{ contentJson: doc(aud("t4a.mp3"), aud("t4b.mp3")) }]);
    expect(r).toEqual({ "t4a.mp3": "Lời A" });
  });
});

describe("transcript của video", () => {
  const up = "/api/lesson-media/videos/u1-123-abc.mp4";
  const link = "https://www.youtube.com/watch?v=abcdefghijk";
  const vid = (src: string) => ({ type: "video", attrs: { src, alt: "v" } });

  it("khoá video: tệp tải lên → tên tệp; link → link:<đường dẫn>", () => {
    expect(videoAssetKey(up)).toBe("u1-123-abc.mp4");
    expect(videoAssetKey(`/lms${up}?x=1`)).toBe("u1-123-abc.mp4");
    expect(videoAssetKey(` ${link} `)).toBe(`link:${link}`);
    expect(videoAssetKey("")).toBeNull();
    expect(videoKeysInDoc(doc(vid(up), vid(link), img("a.png")))).toEqual(["u1-123-abc.mp4", `link:${link}`]);
  });

  it("đặt, đọc, sửa, xoá trắng; người lạ bị từ chối; vượt 20.000 ký tự bị từ chối", async () => {
    const s = await setup("vt1");
    expect((await getVideoTranscriptForEditor(s.owner, s.examId, link)).transcript).toBe("");
    await setVideoTranscript(s.owner, s.examId, link, "  Lời video  ", "Mô tả");
    expect((await getVideoTranscriptForEditor(s.owner, s.examId, link)).transcript).toBe("Lời video");
    const row = await prisma.examAsset.findFirstOrThrow({ where: { examId: s.examId, type: "video" } });
    expect(row).toMatchObject({ s3Key: `link:${link}`, sizeBytes: 0, altText: "Mô tả" });
    await setVideoTranscript(s.owner, s.examId, link, "Sửa", "Mô tả");
    expect(await prisma.examAsset.count({ where: { examId: s.examId, type: "video" } })).toBe(1);
    await expect(setVideoTranscript(s.owner, s.examId, link, "x".repeat(20_001), "")).rejects.toMatchObject({ code: "validation_failed" });
    const stranger = (await registerUser({ email: "pa-x-vt1@e.com", password: "password1234", displayName: "X" }, BASE)).userId;
    await expect(setVideoTranscript(stranger, s.examId, link, "lậu", "")).rejects.toBeTruthy();
    await expect(getVideoTranscriptForEditor(stranger, s.examId, link)).rejects.toBeTruthy();
    await setVideoTranscript(s.owner, s.examId, link, "  ", "");
    expect(await prisma.examAsset.count({ where: { examId: s.examId, type: "video" } })).toBe(0);
  });

  it("nhãn có/chưa có và lấy theo đoạn gồm cả video", async () => {
    const s = await setup("vt2");
    await setVideoTranscript(s.owner, s.examId, up, "Lời tệp", "a");
    await mkAudio(s.owner, s.examId, "vt2.mp3", "Lời audio");
    expect(await listAudioTranscriptFlags(s.owner, s.examId)).toEqual({ "u1-123-abc.mp4": true, "vt2.mp3": true });
    const r = await getAudioTranscriptsForPassages(s.examId, [{ contentJson: doc(vid(up), aud("vt2.mp3"), vid(link)) }]);
    expect(r).toEqual({ "u1-123-abc.mp4": "Lời tệp", "vt2.mp3": "Lời audio" });
  });

  it("gỡ video khỏi đoạn thì dòng transcript bị dọn, KHÔNG có tệp nào bị yêu cầu xoá khỏi kho; video còn dùng ở đoạn khác thì giữ", async () => {
    const s = await setup("vt3");
    await setVideoTranscript(s.owner, s.examId, link, "Lời", "a");
    const a = await createPassage(s.owner, s.examId, { title: "A", contentJson: doc(vid(link)) });
    const b = await createPassage(s.owner, s.examId, { title: "B", contentJson: doc(vid(link)) });
    const r1 = await updatePassage(s.owner, a.passageId, { contentJson: doc() });
    expect(r1.removedFiles).toEqual([]);
    expect(await prisma.examAsset.count({ where: { examId: s.examId, type: "video" } })).toBe(1); // B vẫn dùng
    const r2 = await updatePassage(s.owner, b.passageId, { contentJson: doc() });
    expect(r2.removedFiles).toEqual([]);
    expect(await prisma.examAsset.count({ where: { examId: s.examId, type: "video" } })).toBe(0);
  });
});
