// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  TOPIC TEMPLATE — copy this file, rename it, and fill in your questions.   ║
// ║  Steps:                                                                      ║
// ║   1. Copy  →  lib/game/topics/my-topic.ts                                   ║
// ║   2. Replace every placeholder (XX, 'word', emoji, Hebrew text)             ║
// ║   3. Export a const named after your topic (e.g. myTopicTopic)             ║
// ║   4. In lib/game/questions.ts:                                              ║
// ║        import { myTopicTopic } from './topics/my-topic'                     ║
// ║        export const TOPICS = [englishVocabTopic, myTopicTopic]              ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { Question, QuestionTopic } from '../questions'

// ── Field reference ───────────────────────────────────────────────────────────
//
//  id           Unique string.  Convention: <prefix>-g<grade>-<nn>
//               Pick a 2-3 letter prefix unique to your topic (e.g. "mv" for math).
//               Example: mv-g3-01, mv-g4-08
//
//  englishWord  The English term / concept being tested (shown to the player).
//
//  emoji        One emoji that visually hints at the answer  (shown alongside the word).
//
//  hebrewHint   The Hebrew translation of englishWord — rendered as the quiz question.
//
//  options      Exactly 4 Hebrew strings  [A, B, C, D].
//               Only one should be correct; the rest are plausible distractors.
//
//  correctIndex Which option is correct: 0 = A, 1 = B, 2 = C, 3 = D.
//
//  grade        3 | 4 | 5 | 6
//               Grades 1–2 skip the quiz entirely (mutator is applied immediately).
//               Use higher grades for harder or more abstract questions.
//
//  difficulty   1 | 2 | 3
//               getQuestion() maps wave number → difficulty:
//                 wave ≤ 4  → 1  (easy / concrete)
//                 wave 5–8  → 2  (medium)
//                 wave 9+   → 3  (hard / abstract)
//
// ── Pool size advice ─────────────────────────────────────────────────────────
//  Aim for ≥ 5 questions per (grade × difficulty) cell.
//  If a cell is empty, getQuestion() falls back in this order:
//    same grade  →  same difficulty  →  whole topic.
//  Minimum viable topic: at least 4 questions total so the quiz never repeats
//  immediately.

// ────────────────────────────────────────────────────────────────────────────
//  Rename this export to match your file, e.g. mathTopic, scienceTopic, etc.
// ────────────────────────────────────────────────────────────────────────────
export const myTopicTopic: QuestionTopic = {
  id: 'my-topic',           // must match topicId used in getQuestion() / localStorage key
  displayName: 'My Topic',  // shown in the Classroom Mode topic dropdown

  questions: [

    // ── Grade 3 — difficulty 1 (easy, concrete) ───────────────────────────
    {
      id: 'XX-g3-01',
      englishWord: 'word',
      emoji: '❓',
      hebrewHint: 'מילה',
      options: ['אפשרות א', 'אפשרות ב', 'אפשרות ג', 'תשובה נכונה'],
      correctIndex: 3,
      grade: 3,
      difficulty: 1,
    },
    // TODO: add at least 4 more grade-3 / difficulty-1 questions

    // ── Grade 3 — difficulty 2 (medium) ───────────────────────────────────
    {
      id: 'XX-g3-16',
      englishWord: 'word',
      emoji: '❓',
      hebrewHint: 'מילה',
      options: ['אפשרות א', 'תשובה נכונה', 'אפשרות ג', 'אפשרות ד'],
      correctIndex: 1,
      grade: 3,
      difficulty: 2,
    },
    // TODO: add at least 4 more grade-3 / difficulty-2 questions

    // ── Grade 3 — difficulty 3 (harder) ───────────────────────────────────
    {
      id: 'XX-g3-28',
      englishWord: 'word',
      emoji: '❓',
      hebrewHint: 'מילה',
      options: ['תשובה נכונה', 'אפשרות ב', 'אפשרות ג', 'אפשרות ד'],
      correctIndex: 0,
      grade: 3,
      difficulty: 3,
    },
    // TODO: add at least 4 more grade-3 / difficulty-3 questions

    // ── Grade 4 — difficulty 1 ────────────────────────────────────────────
    {
      id: 'XX-g4-01',
      englishWord: 'word',
      emoji: '❓',
      hebrewHint: 'מילה',
      options: ['אפשרות א', 'אפשרות ב', 'תשובה נכונה', 'אפשרות ד'],
      correctIndex: 2,
      grade: 4,
      difficulty: 1,
    },
    // TODO: add more grade-4 questions (difficulties 1, 2, 3)

    // ── Grade 5 — difficulty 2 ────────────────────────────────────────────
    {
      id: 'XX-g5-01',
      englishWord: 'word',
      emoji: '❓',
      hebrewHint: 'מילה',
      options: ['אפשרות א', 'אפשרות ב', 'אפשרות ג', 'תשובה נכונה'],
      correctIndex: 3,
      grade: 5,
      difficulty: 2,
    },
    // TODO: add more grade-5 questions (difficulties 1, 2, 3)

    // ── Grade 6 — difficulty 3 ────────────────────────────────────────────
    {
      id: 'XX-g6-01',
      englishWord: 'word',
      emoji: '❓',
      hebrewHint: 'מילה',
      options: ['תשובה נכונה', 'אפשרות ב', 'אפשרות ג', 'אפשרות ד'],
      correctIndex: 0,
      grade: 6,
      difficulty: 3,
    },
    // TODO: add more grade-6 questions (difficulties 1, 2, 3)

  ],
}

// ── How to register this topic ───────────────────────────────────────────────
//
//  In lib/game/questions.ts, add two lines:
//
//    import { myTopicTopic } from './topics/my-topic'
//
//    export const TOPICS: QuestionTopic[] = [englishVocabTopic, myTopicTopic]
//
//  The new topic will automatically appear in the Classroom Mode dropdown.
