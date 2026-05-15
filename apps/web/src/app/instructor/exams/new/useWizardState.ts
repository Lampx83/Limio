"use client";

import { useReducer, useEffect } from "react";

export type BloomMix = { remember_understand: number; apply: number; analyze_plus: number };
export type DifficultyProfile = "basic" | "balanced" | "challenge" | "adaptive_to_class";
export type DistributionMode = "single" | "shuffled_per_student" | "multi_session";

export interface WizardState {
  step: 1 | 2 | 3;
  courseId: string;
  title: string;
  durationMin: number;
  openAt: string;   // ISO local datetime input value
  closeAt: string;
  // Step 1
  selectedLessonIds: string[];
  // Step 2
  questionCount: number;
  bloomMix: BloomMix;
  difficultyProfile: DifficultyProfile;
  // Step 3
  distributionMode: DistributionMode;
  sessionCount: number;
  autoEquating: boolean;
  showResultsAfterSubmit: boolean;
}

type Action =
  | { type: "SET_STEP"; step: 1 | 2 | 3 }
  | { type: "SET_COURSE"; courseId: string }
  | { type: "SET_TITLE"; title: string }
  | { type: "SET_DURATION"; durationMin: number }
  | { type: "SET_OPEN_AT"; openAt: string }
  | { type: "SET_CLOSE_AT"; closeAt: string }
  | { type: "TOGGLE_LESSON"; lessonId: string }
  | { type: "SET_ALL_LESSONS"; lessonIds: string[] }
  | { type: "SET_QUESTION_COUNT"; questionCount: number }
  | { type: "SET_BLOOM_MIX"; bloomMix: BloomMix }
  | { type: "SET_DIFFICULTY_PROFILE"; difficultyProfile: DifficultyProfile }
  | { type: "SET_DISTRIBUTION_MODE"; distributionMode: DistributionMode }
  | { type: "SET_SESSION_COUNT"; sessionCount: number }
  | { type: "SET_AUTO_EQUATING"; autoEquating: boolean }
  | { type: "SET_SHOW_RESULTS"; showResultsAfterSubmit: boolean }
  | { type: "RESET" };

function defaultState(courseId: string): WizardState {
  const now = new Date();
  const inWeek = new Date(now.getTime() + 7 * 24 * 60 * 60_000);
  return {
    step: 1,
    courseId,
    title: "",
    durationMin: 45,
    openAt: toLocalInput(now),
    closeAt: toLocalInput(inWeek),
    selectedLessonIds: [],
    questionCount: 25,
    bloomMix: { remember_understand: 60, apply: 30, analyze_plus: 10 },
    difficultyProfile: "balanced",
    distributionMode: "shuffled_per_student",
    sessionCount: 2,
    autoEquating: true,
    showResultsAfterSubmit: true,
  };
}

function toLocalInput(d: Date): string {
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case "SET_STEP":           return { ...state, step: action.step };
    case "SET_COURSE":         return { ...defaultState(action.courseId), courseId: action.courseId };
    case "SET_TITLE":          return { ...state, title: action.title };
    case "SET_DURATION":       return { ...state, durationMin: action.durationMin };
    case "SET_OPEN_AT":        return { ...state, openAt: action.openAt };
    case "SET_CLOSE_AT":       return { ...state, closeAt: action.closeAt };
    case "TOGGLE_LESSON": {
      const has = state.selectedLessonIds.includes(action.lessonId);
      return {
        ...state,
        selectedLessonIds: has
          ? state.selectedLessonIds.filter((id) => id !== action.lessonId)
          : [...state.selectedLessonIds, action.lessonId],
      };
    }
    case "SET_ALL_LESSONS":    return { ...state, selectedLessonIds: action.lessonIds };
    case "SET_QUESTION_COUNT": return { ...state, questionCount: action.questionCount };
    case "SET_BLOOM_MIX":      return { ...state, bloomMix: action.bloomMix };
    case "SET_DIFFICULTY_PROFILE": return { ...state, difficultyProfile: action.difficultyProfile };
    case "SET_DISTRIBUTION_MODE":  return { ...state, distributionMode: action.distributionMode };
    case "SET_SESSION_COUNT":  return { ...state, sessionCount: action.sessionCount };
    case "SET_AUTO_EQUATING":  return { ...state, autoEquating: action.autoEquating };
    case "SET_SHOW_RESULTS":   return { ...state, showResultsAfterSubmit: action.showResultsAfterSubmit };
    case "RESET":              return defaultState(state.courseId);
    default:                   return state;
  }
}

const SESSION_KEY = "examWizardState";

function loadFromSession(courseId: string): WizardState {
  if (typeof window === "undefined") return defaultState(courseId);
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return defaultState(courseId);
    const saved = JSON.parse(raw) as WizardState;
    // Stale if different course or step = 3 already submitted
    if (saved.courseId !== courseId) return defaultState(courseId);
    return saved;
  } catch {
    return defaultState(courseId);
  }
}

export function useWizardState(courseId: string) {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadFromSession(courseId));

  // Persist to sessionStorage on every change.
  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  }, [state]);

  return { state, dispatch };
}
