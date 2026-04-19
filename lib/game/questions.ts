import { englishVocabTopic } from './topics/english-vocab'

export interface Question {
  id: string
  englishWord: string
  emoji: string
  hebrewHint: string           // Hebrew translation of the English word
  options: [string, string, string, string]  // A/B/C/D — all in Hebrew
  correctIndex: 0 | 1 | 2 | 3
  grade: 3 | 4 | 5 | 6
  difficulty: 1 | 2 | 3
}

export interface QuestionTopic {
  id: string
  displayName: string  // e.g. "English Vocabulary" — shown in the topic dropdown
  questions: Question[]
}

// Registry — add new topic files here to extend the system
export const TOPICS: QuestionTopic[] = [englishVocabTopic]

/**
 * Pick a random question appropriate for the given grade and wave.
 * - grade clamped to 3–6 (grades 1–2 never call this)
 * - difficulty: wave ≤ 4 → 1, wave ≤ 8 → 2, wave 9+ → 3
 * - uses Math.random() (intentionally not seeded — questions are independent of Daily seed)
 */
export function getQuestion(grade: number, waveNumber: number, topicId = 'english-vocab'): Question {
  const clampedGrade = Math.max(3, Math.min(6, grade)) as 3 | 4 | 5 | 6
  const difficulty: 1 | 2 | 3 = waveNumber <= 4 ? 1 : waveNumber <= 8 ? 2 : 3

  const topic = TOPICS.find(t => t.id === topicId) ?? TOPICS[0]
  const pool = topic.questions.filter(
    q => q.grade === clampedGrade && q.difficulty === difficulty
  )

  // Fallback: same grade any difficulty, then any grade at difficulty, then entire topic
  const fallback =
    pool.length > 0
      ? pool
      : topic.questions.filter(q => q.grade === clampedGrade).length > 0
        ? topic.questions.filter(q => q.grade === clampedGrade)
        : topic.questions.filter(q => q.difficulty === difficulty).length > 0
          ? topic.questions.filter(q => q.difficulty === difficulty)
          : topic.questions

  return fallback[Math.floor(Math.random() * fallback.length)]
}
