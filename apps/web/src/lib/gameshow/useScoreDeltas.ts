import { useEffect, useRef, useState } from "react";

export type ScoreDelta = { delta: number; nonce: number };

/**
 * So điểm hiện tại với lần trước để phát hiện thay đổi -> trả về Map id ->
 * {delta, nonce} trong ~1.4s rồi tự xoá. Dùng để bắn badge nổi "+150"/"-50"
 * cạnh điểm mỗi khi server báo điểm mới, không cần biết TẠI SAO điểm đổi
 * (đúng/sai/power-up) — chỉ diff số.
 */
export function useScoreDeltas(entries: { id: string; score: number }[]): Map<string, ScoreDelta> {
  const [deltas, setDeltas] = useState<Map<string, ScoreDelta>>(new Map());
  const prevScores = useRef<Map<string, number>>(new Map());
  const nonceRef = useRef(0);

  useEffect(() => {
    const changed = new Map<string, ScoreDelta>();
    for (const e of entries) {
      const prev = prevScores.current.get(e.id);
      if (prev !== undefined && prev !== e.score) {
        nonceRef.current += 1;
        changed.set(e.id, { delta: e.score - prev, nonce: nonceRef.current });
      }
      prevScores.current.set(e.id, e.score);
    }
    if (changed.size === 0) return;
    setDeltas((prev) => new Map([...prev, ...changed]));
    const timers = [...changed.keys()].map((id) =>
      setTimeout(() => {
        setDeltas((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      }, 1400),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.map((e) => `${e.id}:${e.score}`).join("|")]);

  return deltas;
}
