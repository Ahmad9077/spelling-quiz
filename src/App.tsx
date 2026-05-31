import { ArrowRight, RotateCcw, Volume2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { spellingWords } from './quizBank'

type QuizItem = {
  answer: string
  before: string
  clue: string
  emoji: string
  options: string[]
  word: string
  after: string
}

const questionsPerRound = 20

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
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'y',
  'z',
]

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
  'br',
  'cl',
  'cr',
  'dr',
  'fl',
  'fr',
  'gl',
  'gr',
  'pl',
  'pr',
  'sc',
  'sk',
  'sl',
  'sm',
  'sn',
  'sp',
  'st',
  'sw',
  'tr',
]

const preferredChunks = [
  ...twoLetterChoices,
  'a',
  'e',
  'i',
  'o',
  'u',
]

const questionEmojis = ['🌈', '🧀', '✏️', '💡', '🏫', '🌷', '🤝', '🪐', '🍊', '📏']

function shuffle<T>(items: T[]) {
  const shuffled = [...items]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  return shuffled
}

function chooseMissingPart(word: string) {
  for (const chunk of preferredChunks) {
    const start = word.indexOf(chunk)

    if (start > 0 && start + chunk.length < word.length) {
      return {
        answer: chunk,
        after: word.slice(start + chunk.length),
        before: word.slice(0, start),
      }
    }
  }

  const answerLength = word.length > 4 ? 2 : 1
  const start = Math.max(
    1,
    Math.min(word.length - answerLength - 1, Math.floor(word.length / 2) - 1),
  )

  return {
    answer: word.slice(start, start + answerLength),
    after: word.slice(start + answerLength),
    before: word.slice(0, start),
  }
}

function buildOptions(answer: string) {
  const pool = answer.length === 1 ? oneLetterChoices : twoLetterChoices
  const distractors = shuffle(pool.filter((choice) => choice !== answer)).slice(0, 3)
  const answerIndex = Math.floor(Math.random() * 4)
  const options = [...distractors]

  options.splice(answerIndex, 0, answer)

  return options
}

function createQuestion(word: string, index: number): QuizItem {
  const cleanWord = word.toLowerCase()
  const missingPart = chooseMissingPart(cleanWord)

  return {
    ...missingPart,
    clue: 'Listen, then choose the missing letters',
    emoji: questionEmojis[index % questionEmojis.length],
    options: buildOptions(missingPart.answer),
    word: cleanWord,
  }
}

function buildRound() {
  const round = shuffle([...spellingWords]).slice(0, questionsPerRound).map(createQuestion)
  const firstQuestion = round[0]

  if (firstQuestion?.options[0] === firstQuestion.answer) {
    const swapIndex = 1 + Math.floor(Math.random() * 3)
    ;[firstQuestion.options[0], firstQuestion.options[swapIndex]] = [
      firstQuestion.options[swapIndex],
      firstQuestion.options[0],
    ]
  }

  return round
}

function sayWord(word: string) {
  if (!('speechSynthesis' in window)) return

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(word)
  utterance.lang = 'en-US'
  utterance.rate = 0.78
  window.speechSynthesis.speak(utterance)
}

function App() {
  const [quizItems, setQuizItems] = useState<QuizItem[]>(() => buildRound())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [completedQuestions, setCompletedQuestions] = useState(0)
  const [isFinished, setIsFinished] = useState(false)
  const nextButtonRef = useRef<HTMLButtonElement>(null)
  const restartButtonRef = useRef<HTMLButtonElement>(null)

  const currentItem = quizItems[currentIndex]
  const totalQuestions = quizItems.length
  const hasAnswered = selectedAnswer !== null
  const isCorrect = selectedAnswer === currentItem.answer

  const message = useMemo(() => {
    if (isFinished) {
      if (score === totalQuestions) return 'Perfect spelling!'
      if (score >= Math.ceil(totalQuestions * 0.7)) return 'Great work!'
      return 'Good practice!'
    }

    if (!hasAnswered) return currentItem.clue
    return isCorrect ? 'Correct!' : `It is ${currentItem.word}.`
  }, [currentItem.clue, currentItem.word, hasAnswered, isCorrect, isFinished, score, totalQuestions])

  useEffect(() => {
    if (hasAnswered) nextButtonRef.current?.focus()
  }, [hasAnswered])

  useEffect(() => {
    if (isFinished) restartButtonRef.current?.focus()
  }, [isFinished])

  function handleAnswer(answer: string) {
    if (hasAnswered || isFinished) return

    setSelectedAnswer(answer)

    if (answer === currentItem.answer) {
      setScore((count) => count + 1)
    }
  }

  function goNext() {
    if (!hasAnswered) return

    if (currentIndex === totalQuestions - 1) {
      setCompletedQuestions(totalQuestions)
      setIsFinished(true)
      return
    }

    setCompletedQuestions((count) => count + 1)
    setSelectedAnswer(null)
    setCurrentIndex((index) => index + 1)
  }

  function restartQuiz() {
    setQuizItems(buildRound())
    setCompletedQuestions(0)
    setCurrentIndex(0)
    setIsFinished(false)
    setScore(0)
    setSelectedAnswer(null)
  }

  const missingLetters = (selectedAnswer ?? currentItem.answer).split('')
  const progress = Math.round((completedQuestions / totalQuestions) * 100)

  return (
    <main className="quiz-shell">
      <section className="hero-panel" aria-labelledby="page-title">
        <div className="hero-copy">
          <p className="eyebrow">Spelling practice</p>
          <h1 id="page-title">Tiny Letter Quiz</h1>
        </div>
        <div className="score-panel" aria-label="Quiz score">
          <span>{score}</span>
          <small>score</small>
        </div>
      </section>

      <section className="quiz-board">
        <div className="quiz-topline">
          <span>
            {isFinished ? totalQuestions : currentIndex + 1} / {totalQuestions}
          </span>
          <div
            aria-label="Quiz progress"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progress}
            className="progress-track"
            role="progressbar"
          >
            <div style={{ width: `${progress}%` }} />
          </div>
        </div>

        {isFinished ? (
          <div className="finish-state">
            <div className="finish-badge">{score}/{totalQuestions}</div>
            <h2>{message}</h2>
            <p>
              {score >= Math.ceil(totalQuestions * 0.7)
                ? 'You are ready for the next round.'
                : 'Try again and build the words slowly.'}
            </p>
            <button
              className="action-button"
              ref={restartButtonRef}
              type="button"
              onClick={restartQuiz}
            >
              <RotateCcw aria-hidden="true" size={18} />
              Play again
            </button>
          </div>
        ) : (
          <>
            <div className="word-card">
              <div className="picture-mark" aria-hidden="true">
                {currentItem.emoji}
              </div>
              <button
                className="sound-button"
                type="button"
                aria-label={`Hear ${currentItem.word}`}
                onClick={() => sayWord(currentItem.word)}
              >
                <Volume2 aria-hidden="true" size={20} />
              </button>
              <p className="clue" aria-live="polite">
                {message}
              </p>
              <div className="spelling-line" aria-label={`Spell ${currentItem.word}`}>
                <span>{currentItem.before}</span>
                <span className="missing-group" aria-hidden={!hasAnswered}>
                  {missingLetters.map((letter, index) => (
                    <span
                      className={`letter-box ${hasAnswered ? 'filled' : ''}`}
                      key={`${letter}-${index}`}
                    >
                      {hasAnswered ? letter : ''}
                    </span>
                  ))}
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
                    disabled={hasAnswered}
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
                className="action-button ghost"
                type="button"
                onClick={restartQuiz}
              >
                <RotateCcw aria-hidden="true" size={18} />
                Reset
              </button>
              <button
                className="action-button"
                disabled={!hasAnswered}
                ref={nextButtonRef}
                type="button"
                onClick={goNext}
              >
                Next
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
