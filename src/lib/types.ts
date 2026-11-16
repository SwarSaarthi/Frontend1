export type Difficulty = "basic" | "intermediate" | "advanced";
export type ItemType = "word" | "sentence";
export type FeedbackLanguage = "en" | "hi";

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  created_at: string;
}

// FastAPI returns a token only. Fetch /auth/me to resolve the account.
export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface WordItem {
  id: string;
  text_hi: string;
  transliteration: string;
  meaning_en: string;
  meaning_hi: string;
  category: string;
  difficulty: Difficulty;
  audio_url?: string | null;
  item_type: ItemType;
}

export interface PracticeSubmitPayload {
  word_id: string;
  recognized_text: string;
}

export interface PracticeSubmitResult {
  session_id: string;
  word_id: string;
  target_text: string;
  recognized_text: string;
  accuracy_score: number;
  is_correct: boolean;
  details: Record<string, number>;
  needs_focus: boolean;
  streak: number;
}

export interface AsrPredictResult {
  session_id: string;
  word_id: string;
  target_text: string;
  prediction_text: string;
  accuracy_score: number;
  cer: number;
  is_correct: boolean;
  feedback_tier?: "excellent" | "almost_there" | "needs_improvement";
  feedback: string;
  details: Record<string, number>;
  needs_focus: boolean;
  streak: number;
  gemini_suggestion?: string | null;
  feedback_language?: FeedbackLanguage;
  feedback_audio?: string | null;
}

export interface ProfileSummary {
  user: User;
  streak: { current_streak: number; longest_streak: number; total_practice_days: number };
  stats: {
    unique_words_practiced: number;
    total_attempts: number;
    overall_accuracy: number;
    focus_words_count: number;
    total_words_available: number;
  };
}

export interface FocusWordItem {
  item_type?: ItemType;
  word_id: string;
  text_hi: string;
  transliteration: string;
  meaning_en: string;
  category: string;
  difficulty: Difficulty;
  total_attempts: number;
  correct_attempts: number;
  avg_accuracy: number;
  best_score: number;
  last_practiced_at: string | null;
}

export interface StreakDay { date: string; count: number }

export interface DifficultyProgress {
  breakdown: Record<Difficulty, {
    total_words: number;
    attempted_words: number;
    mastered_words: number;
    avg_accuracy: number;
    completion_percentage: number;
  }>;
}

export interface PracticeHistoryItem {
  id: string;
  word_id: string;
  text_hi: string;
  transliteration: string;
  meaning_en: string;
  difficulty: Difficulty;
  recognized_text: string;
  accuracy_score: number;
  is_correct: boolean;
  created_at: string | null;
}

export interface WordCounts {
  basic?: number;
  intermediate?: number;
  advanced?: number;
  total: number;
}
