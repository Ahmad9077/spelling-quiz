import { ArrowRight, Volume2 } from 'lucide-react'
import type { MutableRefObject } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { type SpellingEntry, spellingBank } from './quizBank'

declare global {
  interface Window {
    QuizzesHubProgress?: {
      record: (result: {
        quizId: string
        score: number
        total: number
        level?: string
        details?: Record<string, unknown>
      }) => Promise<{ ok: boolean; reason?: string }>
    }
    QuizzesHubAdaptive?: {
      recordAttempt: (answers: Array<{ question: { key: string }, correct: boolean }>) => Promise<{ ok: boolean; reason?: string }>
    }
    QuizzesHubAdaptiveReady?: Promise<{ question_keys?: string[] }>
    QuizzesHubChallenge?: {
      active: boolean
      currentUserId: string | null
      canAnswer: () => boolean
      onChange: (listener: (state: ChallengeState) => void) => () => void
      openHub: () => void
      submitAnswer: (answer: { answerText: string; isCorrect: boolean }) => Promise<{ ok: boolean; reason?: string }>
    }
    QuizzesHubChallengeReady?: Promise<ChallengeState>
  }
}

type ChallengePlayer = {
  display_name: string
  user_id: string
  wrong_count: number
}

type ChallengeState = {
  current_answering_user_id: string | null
  current_question_key: string | null
  current_turn_index: number
  players: ChallengePlayer[]
  status: 'waiting' | 'active' | 'finished' | 'abandoned'
  winner_id: string | null
}

type QuizItem = {
  answer: string
  before: string
  clue: string
  description: string
  options: string[]
  word: string
  after: string
}

type AnswerResult = 'correct' | 'wrong'
type Difficulty = 'easy' | 'medium' | 'hard'

type TrackedAnswer = {
  correct: boolean
  expected: string
  prompt: string
  selected: string
  word: string
}

const harderWordMinimumLength = 7

const difficultySettings: Record<Difficulty, {
  answerOptionsPerQuestion: number
  label: string
  questionsPerRound: number
  useHarderWords: boolean
}> = {
  easy: { answerOptionsPerQuestion: 4, label: 'Easy', questionsPerRound: 12, useHarderWords: false },
  medium: { answerOptionsPerQuestion: 5, label: 'Medium', questionsPerRound: 20, useHarderWords: true },
  hard: { answerOptionsPerQuestion: 5, label: 'Hard', questionsPerRound: 25, useHarderWords: true },
}

const oneLetterChoices = [
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
]

const vowelChoices = ['a', 'e', 'i', 'o', 'u', 'y']

const consonantChoices = oneLetterChoices.filter((choice) => !vowelChoices.includes(choice))

const twoLetterChoices = [
  'ai',
  'ay',
  'ea',
  'ee',
  'ei',
  'ie',
  'oa',
  'oe',
  'oi',
  'oo',
  'ou',
  'ow',
  'ar',
  'er',
  'ir',
  'or',
  'ur',
  'al',
  'el',
  'le',
  'ch',
  'sh',
  'th',
  'wh',
  'ck',
  'ng',
  'ph',
  'qu',
  'wr',
  'bb',
  'dd',
  'ff',
  'll',
  'mm',
  'nn',
  'pp',
  'ss',
  'tt',
  'zz',
]

const teachingChunks = [
  'ai',
  'ay',
  'ea',
  'ee',
  'ei',
  'ie',
  'oa',
  'oi',
  'oo',
  'ou',
  'ow',
  'ar',
  'er',
  'ir',
  'or',
  'ur',
  'ch',
  'sh',
  'th',
  'wh',
  'ck',
  'ng',
  'ph',
  'qu',
  'wr',
  'bb',
  'dd',
  'ff',
  'll',
  'mm',
  'nn',
  'pp',
  'ss',
  'tt',
  'zz',
]

function shuffle<T>(items: T[]) {
  const shuffled = [...items]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  return shuffled
}

function chooseMissingPart(word: string) {
  const chunkCandidates = teachingChunks.flatMap((chunk) => {
    const starts: number[] = []
    let start = word.indexOf(chunk)

    while (start !== -1) {
      if (start > 0 && start + chunk.length < word.length) {
        starts.push(start)
      }

      start = word.indexOf(chunk, start + 1)
    }

    return starts.map((startIndex) => ({
      answer: chunk.slice(0, 2),
      start: startIndex,
    }))
  })

  const harderChunkCandidates = chunkCandidates.filter(
    (candidate) => candidate.start > 1 && candidate.start + candidate.answer.length < word.length - 1,
  )
  const preferredChunkCandidates = harderChunkCandidates.length > 0 ? harderChunkCandidates : chunkCandidates

  if (preferredChunkCandidates.length > 0 && Math.random() < 0.72) {
    const candidate = shuffle(preferredChunkCandidates)[0]

    return {
      answer: candidate.answer,
      after: word.slice(candidate.start + candidate.answer.length),
      before: word.slice(0, candidate.start),
    }
  }

  const letterCandidates = word
    .split('')
    .map((letter, index) => ({ index, letter }))
    .filter(
      ({ index, letter }) =>
        index > 0 &&
        index < word.length - 1 &&
        oneLetterChoices.includes(letter),
    )

  const deepLetterCandidates = letterCandidates.filter(
    ({ index }) => index > 1 && index < word.length - 2,
  )
  const preferredLetterCandidates = deepLetterCandidates.length > 0 ? deepLetterCandidates : letterCandidates
  const consonantLetterCandidates = preferredLetterCandidates.filter(
    ({ letter }) => consonantChoices.includes(letter),
  )
  const candidatePool =
    consonantLetterCandidates.length > 0 && Math.random() < 0.65
      ? consonantLetterCandidates
      : preferredLetterCandidates

  if (candidatePool.length > 0) {
    const candidate = shuffle(candidatePool)[0]

    return {
      answer: candidate.letter,
      after: word.slice(candidate.index + 1),
      before: word.slice(0, candidate.index),
    }
  }

  for (const chunk of teachingChunks) {
    const start = word.indexOf(chunk)

    if (start > 0 && start + chunk.length < word.length) {
      const answer = chunk.slice(0, 2)

      return {
        answer,
        after: word.slice(start + answer.length),
        before: word.slice(0, start),
      }
    }
  }

  const vowelIndex = word
    .split('')
    .findIndex((letter, index) => index > 0 && index < word.length - 1 && vowelChoices.includes(letter))
  const start = vowelIndex === -1 ? Math.max(1, Math.floor(word.length / 2)) : vowelIndex

  return {
    answer: word[start],
    after: word.slice(start + 1),
    before: word.slice(0, start),
  }
}

function buildOptions(answer: string, answerOptionsPerQuestion: number) {
  const pool =
    answer.length === 1
      ? vowelChoices.includes(answer)
        ? vowelChoices
        : consonantChoices
      : twoLetterChoices
  const distractors = shuffle(pool.filter((choice) => choice !== answer)).slice(0, answerOptionsPerQuestion - 1)
  const answerIndex = Math.floor(Math.random() * answerOptionsPerQuestion)
  const options = [...distractors]

  options.splice(answerIndex, 0, answer)

  return options
}

function createQuestion(entry: SpellingEntry, index: number, answerOptionsPerQuestion: number): QuizItem {
  const cleanWord = entry.word.toLowerCase()
  const missingPart = chooseMissingPart(cleanWord)

  return {
    ...missingPart,
    clue: `Question ${index + 1}: ${entry.description}`,
    description: entry.description,
    options: buildOptions(missingPart.answer, answerOptionsPerQuestion),
    word: cleanWord,
  }
}

function buildRound(difficulty: Difficulty, preferredKeys: string[] = []) {
  const settings = difficultySettings[difficulty]
  const harderEntries = spellingBank.filter((entry) => entry.word.length >= harderWordMinimumLength)
  const sourceBank = settings.useHarderWords && harderEntries.length >= settings.questionsPerRound ? harderEntries : spellingBank
  const preferredEntries = preferredKeys
    .map((key) => sourceBank.find((entry) => entry.word === key))
    .filter((entry): entry is SpellingEntry => Boolean(entry))
  const preferredWords = new Set(preferredEntries.map((entry) => entry.word))
  const round = [...preferredEntries, ...shuffle(sourceBank.filter((entry) => !preferredWords.has(entry.word)))]
    .slice(0, settings.questionsPerRound)
    .map((entry, index) => createQuestion(entry, index, settings.answerOptionsPerQuestion))
  const firstQuestion = round[0]

  if (firstQuestion?.options[0] === firstQuestion.answer) {
    const swapIndex = 1 + Math.floor(Math.random() * (settings.answerOptionsPerQuestion - 1))
    ;[firstQuestion.options[0], firstQuestion.options[swapIndex]] = [
      firstQuestion.options[swapIndex],
      firstQuestion.options[0],
    ]
  }

  return round
}

function getEnglishVoice() {
  const voices = window.speechSynthesis.getVoices()

  return (
    voices.find((voice) => voice.lang === 'en-US') ??
    voices.find((voice) => voice.lang.startsWith('en')) ??
    null
  )
}

function sayWord(word: string, utteranceRef: MutableRefObject<SpeechSynthesisUtterance | null>) {
  if (!('speechSynthesis' in window)) return

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(word)
  const voice = getEnglishVoice()

  if (voice) utterance.voice = voice

  utterance.lang = 'en-US'
  utterance.rate = 0.78
  utterance.pitch = 1
  utterance.volume = 1
  utterance.onend = () => {
    utteranceRef.current = null
  }
  utterance.onerror = () => {
    utteranceRef.current = null
  }

  utteranceRef.current = utterance
  window.speechSynthesis.resume()
  window.speechSynthesis.speak(utterance)
}

type AppProps = {
  difficulty: Difficulty
}

type SavedSpellingSession = {
  answerResults: AnswerResult[]
  currentIndex: number
  difficulty: Difficulty
  quizItems: QuizItem[]
  score: number
  selectedAnswer: string | null
  trackedAnswers: TrackedAnswer[]
  version: 1
}

const storageKeyFor = (difficulty: Difficulty) => `spelling:active-session:${difficulty}:v1`

function loadSavedSession(difficulty: Difficulty): SavedSpellingSession | null {
  try {
    const raw = window.localStorage.getItem(storageKeyFor(difficulty))
    if (!raw) return null

    const parsed = JSON.parse(raw) as SavedSpellingSession
    if (
      parsed?.version !== 1 ||
      parsed.difficulty !== difficulty ||
      !Array.isArray(parsed.quizItems) ||
      parsed.quizItems.length === 0 ||
      !Number.isInteger(parsed.currentIndex) ||
      parsed.currentIndex < 0 ||
      parsed.currentIndex >= parsed.quizItems.length ||
      !Array.isArray(parsed.answerResults) ||
      !Array.isArray(parsed.trackedAnswers)
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

function clearSavedSession(difficulty: Difficulty) {
  try {
    window.localStorage.removeItem(storageKeyFor(difficulty))
  } catch {
    // Ignore storage failures; the quiz can still run in memory.
  }
}

function getChallengeWinnerText(state: ChallengeState | null) {
  const winner = state?.players.find((player) => player.user_id === state.winner_id)
  return winner ? `${winner.display_name} wins` : 'Challenge finished'
}

function App({ difficulty }: AppProps) {
  const isChallengeMode = Boolean(window.QuizzesHubChallenge?.active)
  const settings = difficultySettings[difficulty]
  const [savedSession] = useState<SavedSpellingSession | null>(() => isChallengeMode ? null : loadSavedSession(difficulty))
  const [quizItems, setQuizItems] = useState<QuizItem[]>(() => savedSession?.quizItems ?? (isChallengeMode ? [] : buildRound(difficulty)))
  const [currentIndex, setCurrentIndex] = useState(() => savedSession?.currentIndex ?? 0)
  const [score, setScore] = useState(() => savedSession?.score ?? 0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(() => savedSession?.selectedAnswer ?? null)
  const [isFinished, setIsFinished] = useState(false)
  const [answerResults, setAnswerResults] = useState<AnswerResult[]>(() => savedSession?.answerResults ?? [])
  const [trackedAnswers, setTrackedAnswers] = useState<TrackedAnswer[]>(() => savedSession?.trackedAnswers ?? [])
  const [challengeState, setChallengeState] = useState<ChallengeState | null>(null)
  const [challengeError, setChallengeError] = useState<string | null>(null)
  const nextButtonRef = useRef<HTMLButtonElement>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const currentItem = quizItems[currentIndex]
  const totalQuestions = quizItems.length
  const hasAnswered = selectedAnswer !== null
  const isCorrect = currentItem ? selectedAnswer === currentItem.answer : false
  const wrongCount = answerResults.filter((result) => result === 'wrong').length

  const message = useMemo(() => {
    if (isChallengeMode && challengeError) return challengeError
    if (isChallengeMode && !currentItem) {
      if (challengeState?.status === 'finished') return getChallengeWinnerText(challengeState)
      return 'Waiting for the challenge session.'
    }
    if (isFinished) {
      if (score === totalQuestions) return 'Perfect spelling!'
      if (score >= Math.ceil(totalQuestions * 0.7)) return 'Great work!'
      return 'Good practice!'
    }

    if (!currentItem) return 'Loading.'
    if (!hasAnswered) return currentItem.clue
    return isCorrect ? 'Correct!' : `It is ${currentItem.word}.`
  }, [challengeError, challengeState, currentItem, hasAnswered, isChallengeMode, isCorrect, isFinished, score, totalQuestions])

  useEffect(() => {
    if (hasAnswered) nextButtonRef.current?.focus()
  }, [hasAnswered])

  useEffect(() => {
    if (isChallengeMode) return
    if (!isFinished) return

    const progressPayload = {
      quizId: 'spelling',
      score,
      total: totalQuestions,
      level: score === totalQuestions ? 'A+' : score >= Math.ceil(totalQuestions * 0.7) ? 'A' : 'Practice',
      details: { difficulty, wrongCount, answers: trackedAnswers }
    }

    void (async () => {
      await window.QuizzesHubAdaptiveReady?.catch(() => null)
      const adaptiveResult = await window.QuizzesHubAdaptive?.recordAttempt(
        trackedAnswers.map((answer) => ({
          question: { key: answer.word },
          correct: answer.correct,
        })),
      )

      if (!adaptiveResult?.ok) {
        await window.QuizzesHubProgress?.record(progressPayload)
      }
    })()
  }, [difficulty, isChallengeMode, isFinished, score, totalQuestions, trackedAnswers, wrongCount])

  useEffect(() => {
    if (isChallengeMode) return
    if (isFinished) {
      clearSavedSession(difficulty)
      return
    }

    try {
      window.localStorage.setItem(
        storageKeyFor(difficulty),
        JSON.stringify({
          answerResults,
          currentIndex,
          difficulty,
          quizItems,
          score,
          selectedAnswer,
          trackedAnswers,
          version: 1,
        } satisfies SavedSpellingSession),
      )
    } catch {
      // Ignore storage failures; the current in-memory session remains valid.
    }
  }, [answerResults, currentIndex, difficulty, isChallengeMode, isFinished, quizItems, score, selectedAnswer, trackedAnswers])

  useEffect(() => {
    if (isChallengeMode) return
    if (savedSession || currentIndex !== 0 || selectedAnswer || trackedAnswers.length > 0) return

    let cancelled = false

    void window.QuizzesHubAdaptiveReady?.then((plan) => {
      const preferredKeys = Array.isArray(plan?.question_keys) ? plan.question_keys : []
      if (cancelled || preferredKeys.length === 0) return

      setQuizItems(buildRound(difficulty, preferredKeys))
    }).catch(() => null)

    return () => {
      cancelled = true
    }
  }, [currentIndex, difficulty, isChallengeMode, savedSession, selectedAnswer, trackedAnswers.length])

  useEffect(() => {
    if (!isChallengeMode) return

    let unsubscribe: (() => void) | undefined
    let cancelled = false

    const applyChallengeState = (state: ChallengeState) => {
      if (cancelled) return
      setChallengeState(state)
      setChallengeError(null)
      setSelectedAnswer(null)
      setAnswerResults([])
      setTrackedAnswers([])
      setScore(0)
      setCurrentIndex(0)
      setIsFinished(state.status === 'finished')

      if (state.status !== 'active' || !state.current_question_key) {
        setQuizItems([])
        return
      }

      const entry = spellingBank.find((item) => item.word === state.current_question_key)
      if (!entry) {
        setQuizItems([])
        setChallengeError('This challenge question is not available in this quiz version.')
        return
      }

      setQuizItems([createQuestion(entry, state.current_turn_index, difficultySettings.medium.answerOptionsPerQuestion)])
    }

    void window.QuizzesHubChallengeReady?.then((state) => {
      applyChallengeState(state)
      unsubscribe = window.QuizzesHubChallenge?.onChange(applyChallengeState)
    }).catch(() => {
      setChallengeError('Could not open this challenge. Please return to Quizzes Hub.')
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [isChallengeMode])

  useEffect(() => {
    if (!('speechSynthesis' in window)) return

    window.speechSynthesis.getVoices()
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices()
    }

    return () => {
      window.speechSynthesis.cancel()
      window.speechSynthesis.onvoiceschanged = null
      utteranceRef.current = null
    }
  }, [])

  function handleAnswer(answer: string) {
    if (hasAnswered || isFinished || !currentItem) return
    if (isChallengeMode && !window.QuizzesHubChallenge?.canAnswer()) return

    const answerIsCorrect = answer === currentItem.answer

    setSelectedAnswer(answer)
    setAnswerResults((results) => [...results, answerIsCorrect ? 'correct' : 'wrong'])
    setTrackedAnswers((results) => [
      ...results,
      {
        correct: answerIsCorrect,
        expected: currentItem.answer,
        prompt: currentItem.clue,
        selected: answer,
        word: currentItem.word,
      },
    ])

    if (answerIsCorrect) {
      setScore((count) => count + 1)
    }

    if (isChallengeMode) {
      void window.QuizzesHubChallenge?.submitAnswer({
        answerText: answer,
        isCorrect: answerIsCorrect,
      }).then((result) => {
        if (!result?.ok) {
          setChallengeError(result?.reason || 'Could not submit answer.')
        }
      })
    }
  }

  function goNext() {
    if (isChallengeMode) {
      window.QuizzesHubChallenge?.openHub()
      return
    }

    if (!hasAnswered) return

    if (currentIndex === totalQuestions - 1) {
      setIsFinished(true)
      return
    }

    setSelectedAnswer(null)
    setCurrentIndex((index) => index + 1)
  }

  function startNextRound() {
    if (isChallengeMode) {
      window.QuizzesHubChallenge?.openHub()
      return
    }

    clearSavedSession(difficulty)
    setQuizItems(buildRound(difficulty))
    setCurrentIndex(0)
    setIsFinished(false)
    setScore(0)
    setSelectedAnswer(null)
    setAnswerResults([])
    setTrackedAnswers([])
  }

  if (!currentItem) {
    return (
      <main className="quiz-shell">
        <section className="quiz-board">
          <div className="finish-state">
            <div className="finish-badge">Challenge</div>
            <h2>{message}</h2>
            <button
              className="action-button"
              type="button"
              onClick={() => window.QuizzesHubChallenge?.openHub()}
            >
              Back to Hub
              <ArrowRight aria-hidden="true" size={18} />
            </button>
          </div>
        </section>
      </main>
    )
  }

  const missingLetters = (selectedAnswer ?? currentItem.answer).split('')

  return (
    <main className="quiz-shell">
      <section className="hero-panel" aria-labelledby="page-title">
        <div className="hero-copy">
          <p className="eyebrow">{isChallengeMode ? 'Challenge Mode' : `${settings.label} · Spelling practice`}</p>
          <h1 id="page-title">Tiny Letter Quiz</h1>
        </div>
        <div className="score-panel" aria-label="Quiz results so far">
          <div className="score-metric is-correct">
            <span>{score}</span>
            <small>correct</small>
          </div>
          <div className="score-metric is-wrong">
            <span>{wrongCount}</span>
            <small>wrong</small>
          </div>
        </div>
      </section>

      <section className="quiz-board">
        <div className="quiz-topline">
          <span>
            {isChallengeMode ? `Challenge ${challengeState?.current_turn_index ?? 1}` : `${isFinished ? totalQuestions : currentIndex + 1} / ${totalQuestions}`}
          </span>
          <div
            aria-label={`${score} correct, ${wrongCount} wrong`}
            className="answer-dots"
          >
            {quizItems.map((item, index) => {
              const result = answerResults[index]
              const state =
                result === 'correct'
                  ? 'is-correct'
                  : result === 'wrong'
                    ? 'is-wrong'
                    : index === currentIndex && !isFinished
                      ? 'is-current'
                      : 'is-upcoming'

              return <span className={state} key={`${item.word}-${index}`} />
            })}
          </div>
        </div>

        {isFinished ? (
          <div className="finish-state">
            <div className="finish-badge">{score}/{totalQuestions}</div>
            <div className="finish-counts" aria-label="Final answer counts">
              <span className="is-correct">{score} correct</span>
              <span className="is-wrong">{wrongCount} wrong</span>
            </div>
            <h2>{message}</h2>
            <p>
              {isChallengeMode
                ? 'Return to Quizzes Hub when you are done.'
                : score >= Math.ceil(totalQuestions * 0.7)
                ? 'You are ready for the next round.'
                : 'Try again and build the words slowly.'}
            </p>
            <button
              className="action-button"
              type="button"
              onClick={startNextRound}
            >
              {isChallengeMode ? 'Back to Hub' : 'Next round'}
              <ArrowRight aria-hidden="true" size={18} />
            </button>
          </div>
        ) : (
          <>
            <div className="word-card">
              <button
                className="picture-mark"
                type="button"
                aria-label={`Hear ${currentItem.word}`}
                onClick={() => sayWord(currentItem.word, utteranceRef)}
              >
                <Volume2 size={42} strokeWidth={2.6} />
              </button>
              <p className="clue" aria-live="polite">
                {message}
              </p>
              <div className="spelling-line" aria-label={`Spell ${currentItem.word}`}>
                <span>{currentItem.before}</span>
                <span className="missing-group" aria-hidden={!hasAnswered}>
                  <span className={`letter-box ${hasAnswered ? 'filled' : ''}`}>
                    {hasAnswered ? missingLetters.join('') : ''}
                  </span>
                </span>
                <span>{currentItem.after}</span>
              </div>
            </div>

            <div className="answer-grid" aria-label="Answer choices">
              {currentItem.options.map((option) => {
                const stateClass =
                  hasAnswered && option === currentItem.answer
                    ? 'correct'
                    : hasAnswered && option === selectedAnswer
                      ? 'wrong'
                      : ''

                return (
                  <button
                    className={`answer-tile ${stateClass}`}
                    disabled={hasAnswered || (isChallengeMode && !window.QuizzesHubChallenge?.canAnswer())}
                    key={option}
                    onClick={() => handleAnswer(option)}
                    type="button"
                    aria-label={
                      hasAnswered && option === currentItem.answer
                        ? `${option}, correct answer`
                        : hasAnswered && option === selectedAnswer
                          ? `${option}, your answer`
                          : option
                    }
                  >
                    {option}
                  </button>
                )
              })}
            </div>

            <div className="quiz-actions">
              <button
                className="action-button"
                disabled={!hasAnswered}
                ref={nextButtonRef}
                type="button"
                onClick={goNext}
              >
                {isChallengeMode ? 'Back to Hub' : 'Continue'}
                <ArrowRight aria-hidden="true" size={18} />
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  )
}

export default App
