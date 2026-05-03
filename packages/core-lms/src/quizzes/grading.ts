import type { QuestionOption, QuizQuestion } from "@feedbackme/db";

export interface AnswerEval {
  isCorrect: boolean;
  /** Misconception code attached to a wrong option that was selected, if any. */
  misconceptionCode?: string;
  /** True for question types that require manual grading (essay). Caller must
   *  store the response and skip auto-isCorrect = false logic where appropriate. */
  needsGrading?: boolean;
}

interface OptionWithMisconception extends QuestionOption {
  misconception?: { code: string } | null;
}

interface QuestionWithOptions extends QuizQuestion {
  options: OptionWithMisconception[];
}

function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function gradeAnswer(
  question: QuestionWithOptions,
  response: unknown,
): AnswerEval {
  switch (question.type) {
    case "mcq":
    case "true_false": {
      const selectedIds = Array.isArray(response)
        ? (response as unknown[]).filter((x): x is string => typeof x === "string").sort()
        : [];
      const correctIds = question.options
        .filter((o) => o.isCorrect)
        .map((o) => o.id)
        .sort();
      const isCorrect =
        selectedIds.length === correctIds.length &&
        selectedIds.every((id, i) => id === correctIds[i]);

      let misconceptionCode: string | undefined;
      if (!isCorrect) {
        const wrongPicked = question.options.find(
          (o) => selectedIds.includes(o.id) && !o.isCorrect && o.misconception?.code,
        );
        if (wrongPicked?.misconception?.code) {
          misconceptionCode = wrongPicked.misconception.code;
        }
      }
      return { isCorrect, misconceptionCode };
    }

    case "fill_in": {
      const text = typeof response === "string" ? normalizeText(response) : "";
      const acceptable = question.options
        .filter((o) => o.isCorrect)
        .map((o) => normalizeText(o.label));
      return { isCorrect: text.length > 0 && acceptable.includes(text) };
    }

    case "ordering": {
      // Response is array of option IDs in user's chosen order. Correct order
      // is canonical orderIndex ascending across all options.
      if (!Array.isArray(response)) return { isCorrect: false };
      const userOrder = (response as unknown[]).filter(
        (x): x is string => typeof x === "string",
      );
      const canonical = [...question.options]
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((o) => o.id);
      if (userOrder.length !== canonical.length) return { isCorrect: false };
      const isCorrect = userOrder.every((id, i) => id === canonical[i]);
      return { isCorrect };
    }

    case "matching": {
      // Response: Array<{ leftId, rightId }>. Correct pairing: two options with
      // same `extra.pairKey` and opposite `extra.side` form a pair.
      if (!Array.isArray(response)) return { isCorrect: false };
      const userPairs = (response as unknown[])
        .filter(
          (x): x is { leftId: string; rightId: string } =>
            typeof x === "object" &&
            x !== null &&
            typeof (x as Record<string, unknown>).leftId === "string" &&
            typeof (x as Record<string, unknown>).rightId === "string",
        )
        .map((p) => `${p.leftId}::${p.rightId}`)
        .sort();

      const optById = new Map(question.options.map((o) => [o.id, o]));
      // Build canonical pairs from option metadata.
      const correctSet = new Set<string>();
      const lefts = question.options.filter(
        (o) => (o.extra as { side?: string } | null)?.side === "left",
      );
      for (const left of lefts) {
        const lk = (left.extra as { pairKey?: string } | null)?.pairKey;
        if (!lk) continue;
        const right = question.options.find(
          (o) =>
            (o.extra as { side?: string } | null)?.side === "right" &&
            (o.extra as { pairKey?: string } | null)?.pairKey === lk,
        );
        if (right) correctSet.add(`${left.id}::${right.id}`);
      }
      // Reject responses referencing unknown options.
      for (const p of userPairs) {
        const [l, r] = p.split("::");
        if (!l || !r || !optById.has(l) || !optById.has(r)) {
          return { isCorrect: false };
        }
      }
      const isCorrect =
        userPairs.length === correctSet.size &&
        userPairs.every((p) => correctSet.has(p));
      return { isCorrect };
    }

    case "numerical": {
      const num = typeof response === "number"
        ? response
        : typeof response === "string"
          ? Number(response.trim())
          : NaN;
      if (!Number.isFinite(num)) return { isCorrect: false };
      const meta = (question.extra ?? {}) as { expected?: number; tolerance?: number };
      const expected = typeof meta.expected === "number" ? meta.expected : NaN;
      const tolerance =
        typeof meta.tolerance === "number" && meta.tolerance >= 0
          ? meta.tolerance
          : 0;
      if (!Number.isFinite(expected)) return { isCorrect: false };
      return { isCorrect: Math.abs(num - expected) <= tolerance };
    }

    case "short_answer": {
      // Accept if normalized text matches any acceptable string OR matches any
      // regex in question.extra.acceptedRegexes (case-insensitive).
      const text = typeof response === "string" ? normalizeText(response) : "";
      if (!text) return { isCorrect: false };
      const acceptable = question.options
        .filter((o) => o.isCorrect)
        .map((o) => normalizeText(o.label));
      if (acceptable.includes(text)) return { isCorrect: true };

      const meta = (question.extra ?? {}) as { acceptedRegexes?: string[] };
      if (Array.isArray(meta.acceptedRegexes)) {
        for (const pattern of meta.acceptedRegexes) {
          try {
            if (new RegExp(pattern, "i").test(text)) return { isCorrect: true };
          } catch {
            // Invalid regex — ignore, instructor's mistake.
          }
        }
      }
      return { isCorrect: false };
    }

    case "essay": {
      // Manual grading required. Caller stores response with needsGrading=true.
      return { isCorrect: false, needsGrading: true };
    }

    default:
      return { isCorrect: false };
  }
}
