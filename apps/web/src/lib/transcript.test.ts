import { describe, expect, it } from "vitest";
import { isSyncableTranscriptUrl, parseTranscriptCues } from "./transcript";

const VTT = `WEBVTT

00:00:01.000 --> 00:00:04.500
Xin chào, hôm nay chúng ta học về BKT.

00:00:04.500 --> 00:00:08.000
BKT là viết tắt của Bayesian Knowledge Tracing.
`;

const SRT = `1
00:00:01,000 --> 00:00:04,500
Xin chào, hôm nay chúng ta học về BKT.

2
00:00:04,500 --> 00:00:08,000
BKT là viết tắt của Bayesian Knowledge Tracing.
`;

describe("parseTranscriptCues", () => {
  it("parses WebVTT into ordered cues", () => {
    const cues = parseTranscriptCues(VTT);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({
      startSec: 1,
      endSec: 4.5,
      text: "Xin chào, hôm nay chúng ta học về BKT.",
    });
    expect(cues[1]!.startSec).toBe(4.5);
  });

  it("parses SRT (comma decimal + numeric cue index) the same as VTT", () => {
    const cues = parseTranscriptCues(SRT);
    expect(cues).toHaveLength(2);
    expect(cues[0]!.startSec).toBe(1);
    expect(cues[0]!.endSec).toBe(4.5);
  });

  it("joins multi-line cue text with a space", () => {
    const raw = `WEBVTT

00:00:00.000 --> 00:00:02.000
Dòng một
Dòng hai
`;
    expect(parseTranscriptCues(raw)[0]!.text).toBe("Dòng một Dòng hai");
  });

  it("strips inline VTT tags like <b> and timestamp tags", () => {
    const raw = `WEBVTT

00:00:00.000 --> 00:00:02.000
<b>Chào</b> <00:00:00.500>bạn
`;
    expect(parseTranscriptCues(raw)[0]!.text).toBe("Chào bạn");
  });

  it("handles hour-less MM:SS timestamps", () => {
    const raw = `WEBVTT

01:02.500 --> 01:05.000
xxx
`;
    expect(parseTranscriptCues(raw)[0]!.startSec).toBe(62.5);
  });

  it("drops cues with unparseable timing or empty text", () => {
    const raw = `WEBVTT

not-a-timestamp --> also-not
text

00:00:01.000 --> 00:00:02.000

`;
    expect(parseTranscriptCues(raw)).toEqual([]);
  });

  it("returns [] for garbage input", () => {
    expect(parseTranscriptCues("khong phai transcript gi ca")).toEqual([]);
  });

  it("sorts cues by start time even if the file is out of order", () => {
    const raw = `WEBVTT

00:00:05.000 --> 00:00:06.000
sau

00:00:01.000 --> 00:00:02.000
truoc
`;
    const cues = parseTranscriptCues(raw);
    expect(cues.map((c) => c.text)).toEqual(["truoc", "sau"]);
  });
});

describe("isSyncableTranscriptUrl", () => {
  it("accepts .vtt and .srt regardless of case", () => {
    expect(isSyncableTranscriptUrl("/api/lesson-media/transcripts/a.vtt")).toBe(true);
    expect(isSyncableTranscriptUrl("https://cdn.example.com/a.SRT")).toBe(true);
  });

  it("rejects other extensions, missing, or empty", () => {
    expect(isSyncableTranscriptUrl("https://example.com/doc.pdf")).toBe(false);
    expect(isSyncableTranscriptUrl(undefined)).toBe(false);
    expect(isSyncableTranscriptUrl(null)).toBe(false);
    expect(isSyncableTranscriptUrl("")).toBe(false);
  });
});
