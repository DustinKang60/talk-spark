import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// 새 버전을 배포하면 사용자가 아무것도 하지 않아도 갱신되게 한다.
// 기본 주입 스크립트는 등록만 하고 갱신 확인·교체를 하지 않아, 한번 설치한 기기가
// 옛 코드에 갇히는 문제가 있었다(앱을 지웠다 다시 깔아야만 고쳐짐).
registerSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    if (!registration) return
    const checkForUpdate = () => {
      if (navigator.onLine) registration.update()
    }
    // 앱을 오래 켜둔 경우(1시간마다)와 다시 열었을 때 모두 새 버전을 확인한다.
    setInterval(checkForUpdate, 60 * 60 * 1000)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkForUpdate()
    })
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
