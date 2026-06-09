import { Routes, Route, Navigate } from 'react-router-dom'
import SubmitPage   from './pages/SubmitPage'
import LoadingPage  from './pages/LoadingPage'
import ResultsPage  from './pages/ResultsPage'
import ArchivePage  from './pages/ArchivePage'

export default function App() {
  return (
    <Routes>
      <Route path="/"        element={<SubmitPage />} />
      <Route path="/loading" element={<LoadingPage />} />
      <Route path="/results" element={<ResultsPage />} />
      <Route path="/archive" element={<ArchivePage />} />
      <Route path="*"        element={<Navigate to="/" replace />} />
    </Routes>
  )
}
