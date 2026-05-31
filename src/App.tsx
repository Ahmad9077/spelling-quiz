import { ArrowRight, RotateCcw, Volume2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type QuizItem = {
  answer: string
  before: string
  clue: string
  emoji: string
  options: string[]
  word: string
  after: string
}

const quizItems: QuizItem[] = [
  {
    word: 'rainbow',
    before: 'r',
    answer: 'ai',
    after: 'nbow',
    clue: 'Colors after the rain',
    emoji: '🌈',
    options: ['ai', 'ay', 'oa', 'ee'],
  },
  {
    word: 'cheese',
    before: 'ch',
    answer: 'ee',
    after: 'se',
    clue: 'A yellow food in a sandwich',
    emoji: '🧀',
    options: ['ee', 'ea', 'oo', 'ie'],
  },
  {
    word: 'pencil',
    before: 'pen',
    answer: 'c',
    after: 'il',
    clue: 'You write with it',
    emoji: '✏️',
    options: ['c', 's', 'k', 't'],
  },
  {
    word: 'bright',
    before: 'br',
    answer: 'ig',
    after: 'ht',
    clue: 'Full of light',
    emoji: '💡',
    options: ['ig', 'ie', 'ai', 'ee'],
  },
  {
    word: 'school',
    before: 's',
    answer: 'ch',
    after: 'ool',
    clue: 'A place for learning',
    emoji: '🏫',
    options: ['ch', 'sh', 'th', 'ck'],
  },
  {
    word: 'garden',
    before: 'gar',
    answer: 'd',
    after: 'en',
    clue: 'Flowers grow there',
    emoji: '🌷',
    options: ['d', 'b', 'p', 't'],
  },
  {
    word: 'friend',
    before: 'fr',
    answer: 'ie',
    after: 'nd',
    clue: 'Someone kind to play with',
    emoji: '🤝',
    options: ['ie', 'ei', 'ee', 'ea'],
  },
  {
    word: 'planet',
    before: 'pla',
    answer: 'n',
    after: 'et',
    clue: 'Earth is one',
    emoji: '🪐',
    options: ['n', 'm', 'r', 'l'],
  },
  {
    word: 'orange',
    before: 'or',
    answer: 'a',
    after: 'nge',
    clue: 'A fruit and a color',
    emoji: '🍊',
    options: ['a', 'e', 'o', 'u'],
  },
  {
    word: 'little',
    before: 'li',
    answer: 'tt',
    after: 'le',
    clue: 'Small in size',
    emoji: '📏',
    options: ['tt', 'dd', 'll', 'pp'],
  },
]

const totalQuestions = quizItems.length

function sayWord(word: string) {
  if (!('speechSynthesis' in window)) return

  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(word)
  utterance.lang = 'en-US'
  utterance.rate = 0.78
  window.speechSynthesis.speak(utterance)
}

function App() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [completedQuestions, setCompletedQuestions] = useState(0)
  const [isFinished, setIsFinished] = useState(false)
  const nextButtonRef = useRef<HTMLButtonElement>(null)
  const restartButtonRef = useRef<HTMLButtonElement>(null)

  const currentItem = quizItems[currentIndex]
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
  }, [currentItem.clue, currentItem.word, hasAnswered, isCorrect, isFinished, score])

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

      <section className="quiz-board" aria-live="polite">
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
