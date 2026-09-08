/**
 * A2.7 — Interactive transcript. Tolerant WebVTT/SRT parser: instructors may
 * hand either format (YouTube's own caption export defaults to one or the
 * other depending on tool), so this accepts both rather than picking one.
 *
 * Only extracts timing + text — cue numbers/ids, the "WEBVTT" header, NOTE
 * blocks, and cue settings after the timing line are ignored.
 */

export interface TranscriptCue {
  startSec: number;
  endSec: number;
  text: string;
}

const CUE_TIME_RE = /^(\S+)\s*-->\s*(\S+)/;

function parseTimestamp(ts: string): number | null {
  const m = /^(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{1,3})$/.exec(ts.trim());
  if (!m) return null;
  const h = m[1] ? Number(m[1]) : 0;
  const min = Number(m[2]);
  const s = Number(m[3]);
  const ms = Number(m[4]!.padEnd(3, "0"));
  return h * 3600 + min * 60 + s + ms / 1000;
}

/** Strip inline tags (<b>, <i>, <00:00:01.000>, <c.className>) VTT allows in cue text. */
function cleanCueText(line: string): string {
  return line.replace(/<[^>]*>/g, "").trim();
}

export function parseTranscriptCues(raw: string): TranscriptCue[] {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const cues: TranscriptCue[] = [];
  let i = 0;
  while (i < lines.length) {
    const m = CUE_TIME_RE.exec(lines[i]!);
    if (!m) {
      i++;
      continue;
    }
    const startSec = parseTimestamp(m[1]!);
    const endSec = parseTimestamp(m[2]!);
    i++;
    const textLines: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== "") {
      textLines.push(cleanCueText(lines[i]!));
      i++;
    }
    const text = textLines.filter(Boolean).join(" ").trim();
    if (startSec !== null && endSec !== null && text) {
      cues.push({ startSec, endSec, text });
    }
  }
  return cues.sort((a, b) => a.startSec - b.startSec);
}

/** True if a transcript URL/path looks like a file this parser can handle. */
export function isSyncableTranscriptUrl(url: string | undefined | null): boolean {
  return !!url && /\.(vtt|srt)$/i.test(url);
}
