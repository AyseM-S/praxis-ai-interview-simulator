import { useState, useEffect, useRef } from 'react'
import { QuestionGenerationEngine } from './services/llmService'
import type { QuestionDTO, ChartQuestion, AbstractQuestion } from './types'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

type AppState = 'setup' | 'generating' | 'interview' | 'feedback'
type CameraMode = 'video' | 'audio'

function App() {
  const [appState, setAppState] = useState<AppState>('setup')
  const [cameraMode, setCameraMode] = useState<CameraMode>('video')
  
  // AI Settings
  const [apiKey, setApiKey] = useState('')
  const [numQuestions, setNumQuestions] = useState(12)
  const [timeLimit, setTimeLimit] = useState(10) // minutes
  const [language, setLanguage] = useState('English')

  // Interview State
  const [questions, setQuestions] = useState<QuestionDTO[]>([])
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [timeLeft, setTimeLeft] = useState(60)
  const [score, setScore] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({})

  // Media
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>
    if (appState === 'interview' && questions.length > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            nextQuestion()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [appState, currentQuestion, questions])

  useEffect(() => {
    if (appState === 'interview' && cameraMode === 'video') {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then((mediaStream) => {
          setStream(mediaStream)
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream
          }
        })
        .catch((err) => console.error("Camera error:", err))
    }

    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop())
    }
  }, [appState, cameraMode])

  const startGeneration = async () => {
    if (!apiKey) {
      alert("Please enter a Gemini API Key.")
      return
    }
    setAppState('generating')
    try {
      const engine = new QuestionGenerationEngine(apiKey)
      const generated = await engine.generateTestAsync(numQuestions, timeLimit, language)
      if (generated.length === 0) {
        alert("Failed to generate questions. Please check your API Key.")
        setAppState('setup')
        return
      }
      setQuestions(generated)
      setScore(0)
      setSelectedAnswers({})
      setCurrentQuestion(0)
      setTimeLeft(generated[0]?.estimatedTimeSeconds || 60)
      setAppState('interview')
    } catch (err) {
      alert("An error occurred.")
      setAppState('setup')
    }
  }

  const handleAnswer = (answer: string) => {
    setSelectedAnswers(prev => ({ ...prev, [currentQuestion]: answer }))
  }

  const nextQuestion = () => {
    // Check answer
    const current = questions[currentQuestion]
    if (selectedAnswers[currentQuestion] === current.correctAnswer) {
      setScore(s => s + 1)
    }

    if (currentQuestion < questions.length - 1) {
      const nextQ = questions[currentQuestion + 1]
      setCurrentQuestion(currentQuestion + 1)
      setTimeLeft(nextQ.estimatedTimeSeconds || 60)
    } else {
      setAppState('feedback')
    }
  }

  const renderChart = (q: ChartQuestion) => {
    const data = q.dataset
    if (q.chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <XAxis dataKey="name" stroke="#cbd5e1" />
            <YAxis stroke="#cbd5e1" />
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
            <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      )
    }
    if (q.chartType === 'pie') {
      const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6']
      return (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
          </PieChart>
        </ResponsiveContainer>
      )
    }
    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <XAxis dataKey="name" stroke="#cbd5e1" />
          <YAxis stroke="#cbd5e1" />
          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
          <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <div className="h-10 bg-slate-900 border-b border-slate-800 flex items-center px-4 drag-area">
        <div className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
          Praxis AI
        </div>
        <div className="ml-auto text-xs text-red-500/80 font-bold tracking-widest animate-pulse">
          DYNAMIC INTERVIEW ENGINE
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-8 flex flex-col">
        {appState === 'setup' && (
          <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col justify-center">
            <div className="text-center mb-10">
              <h1 className="text-4xl font-extrabold mb-2 text-white">AI-Powered Assessment</h1>
              <p className="text-slate-400 text-lg">Prepare for interviews and assessments with dynamic questions.</p>
            </div>

            <div className="bg-slate-900/80 p-8 rounded-2xl border border-slate-800 shadow-2xl">
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-300 mb-2">Gemini API Key</label>
                  <input type="password" placeholder="AI-..." value={apiKey} onChange={e => setApiKey(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Number of Questions</label>
                  <input type="number" value={numQuestions} onChange={e => setNumQuestions(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-200" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Duration (Minutes)</label>
                  <input type="number" value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-200" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Language</label>
                  <select value={language} onChange={e => setLanguage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-200">
                    <option value="Turkish">Turkish</option>
                    <option value="English">English</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Camera Mode</label>
                  <select value={cameraMode} onChange={e => setCameraMode(e.target.value as CameraMode)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-200">
                    <option value="video">Open Camera (High Stress)</option>
                    <option value="audio">Audio Only</option>
                  </select>
                </div>
              </div>
              <button onClick={startGeneration} className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all">
                START ASSESSMENT (GENERATE WITH AI)
              </button>
            </div>
          </div>
        )}

        {appState === 'generating' && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-8"></div>
            <h2 className="text-2xl font-bold text-white mb-2">Generating Questions...</h2>
            <p className="text-slate-400">Numerical, Verbal, Chart, and Abstract reasoning questions are being fetched in parallel. This may take 10-15 seconds.</p>
          </div>
        )}

        {appState === 'interview' && questions.length > 0 && (
          <div className="flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-4 bg-red-950/50 border border-red-900/50 px-4 py-2 rounded-lg">
                <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,1)]"></div>
                <span className="font-bold text-red-400 text-sm">TIME LEFT:</span>
                <div className={`font-mono text-xl font-bold ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-slate-300'}`}>
                  00:{timeLeft.toString().padStart(2, '0')}
                </div>
              </div>
              <div className="text-sm font-bold text-slate-400 uppercase tracking-widest bg-slate-900 px-4 py-2 rounded-lg border border-slate-800">
                Category: {questions[currentQuestion].category}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 mb-6">
              {/* Question Frame */}
              <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl flex flex-col p-6">
                <div className="text-xs text-slate-500 font-bold mb-4 tracking-widest uppercase">
                  Question {currentQuestion + 1} / {questions.length}
                </div>
                <p className="text-lg font-medium text-white mb-6 leading-relaxed">
                  {questions[currentQuestion].text}
                </p>

                {/* Media Content */}
                <div className="mb-6 flex-1 flex items-center justify-center">
                  {questions[currentQuestion].category === 'chart' && renderChart(questions[currentQuestion] as ChartQuestion)}
                  {questions[currentQuestion].category === 'abstract' && (
                    <div className="w-full max-w-xs text-slate-200" dangerouslySetInnerHTML={{ __html: (questions[currentQuestion] as AbstractQuestion).svgContent }} />
                  )}
                </div>

                <div className="space-y-3">
                  {questions[currentQuestion].options.map((opt, i) => (
                    <button 
                      key={i} 
                      onClick={() => handleAnswer(opt)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                        selectedAnswers[currentQuestion] === opt 
                          ? 'bg-red-900/40 border-red-500 text-white' 
                          : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {String.fromCharCode(65 + i)}) {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* User Frame */}
              <div className="bg-black rounded-2xl border-2 border-slate-800 overflow-hidden relative shadow-2xl flex items-center justify-center">
                <div className="absolute top-4 left-4 bg-red-600/90 px-3 py-1 rounded-sm text-xs font-bold text-white z-10 animate-pulse">YOU</div>
                {cameraMode === 'video' ? (
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" style={{ transform: 'scaleX(-1)' }} />
                ) : (
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-slate-900 border border-slate-800 mx-auto flex items-center justify-center mb-4">🎤</div>
                    <p className="text-slate-400 font-bold">Audio Active</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end bg-slate-900 p-4 rounded-xl border border-slate-800">
              <button onClick={nextQuestion} disabled={!selectedAnswers[currentQuestion]}
                className="px-8 py-3 rounded-lg font-bold bg-white text-black hover:bg-slate-200 disabled:opacity-50 transition-all flex items-center space-x-2">
                <span>{currentQuestion < questions.length - 1 ? 'SUBMIT & NEXT' : 'FINISH ASSESSMENT'}</span>
              </button>
            </div>
          </div>
        )}

        {appState === 'feedback' && (
          <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col justify-center text-center">
            <h2 className="text-4xl font-black mb-4 tracking-tight">ASSESSMENT COMPLETE</h2>
            <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 mb-8">
              {score} / {questions.length}
            </div>
            <button onClick={() => setAppState('setup')} className="px-10 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all w-full">
              START AGAIN
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
