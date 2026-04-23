import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Calendar from './pages/Calendar'
import Materias from './pages/Materias'
import BrainDrain from './pages/BrainDrain'
import Flashcards from './pages/Flashcards'
import Chat from './pages/Chat'
import Layout from './components/Layout'

const queryClient = new QueryClient()

function ProtectedRoute({ children }) {
  const { token } = useAuth()
  return token ? children : <Navigate to="/login" />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="materias" element={<Materias />} />
                <Route path="calendar" element={<Calendar />} />
                <Route path="brain-drain" element={<BrainDrain />} />
                <Route path="flashcards" element={<Flashcards />} />
                <Route path="chat" element={<Chat />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
