import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

declare global {
  interface Window {
    QuizzesHubAccessReady?: Promise<unknown>
  }
}

async function renderApp() {
  try {
    if (!window.QuizzesHubAccessReady) {
      throw new Error('Missing Quizzes Hub access guard.')
    }

    await window.QuizzesHubAccessReady
  } catch {
    document.documentElement.dataset.quizAccess = 'denied'
    document.getElementById('root')!.textContent = 'Please open this quiz from Quizzes Hub.'
    return
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void renderApp()
