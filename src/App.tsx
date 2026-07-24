import { useState, useEffect, useRef } from 'react'
import { QuestionGenerationEngine } from './services/llmService'
import type { QuestionDTO, ChartQuestion, AbstractQuestion, AssessmentMode, InterviewQuestion } from './types'
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
  
  // Assessment Settings
  const [assessmentMode, setAssessmentMode] = useState<AssessmentMode>('talent_test')
  const [targetRole, setTargetRole] = useState('Software Engineer')

  // Interview States
  const [questions, setQuestions] = useState<QuestionDTO[]>([])
  const [interviewQuestions, setInterviewQuestions] = useState<InterviewQuestion[]>([])
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [timeLeft, setTimeLeft] = useState(60)
  const [score, setScore] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({})
  const [isSpeaking, setIsSpeaking] = useState(false)

  // Media
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  const speakQuestion = (text: string, lang: string, interviewer?: string) => {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    
    const selectVoice = () => {
      const voices = window.speechSynthesis.getVoices()
      let voiceLang = lang === 'Turkish' ? 'tr-TR' : 'en-US'
      const availableVoices = voices.filter(v => v.lang.startsWith(voiceLang))
      
      if (availableVoices.length > 0) {
        if (interviewer === 'fulya') {
          // Try to find a female voice for Fulya
          utterance.voice = availableVoices.find(v => v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('aylin') || v.name.toLowerCase().includes('emel')) || availableVoices[0]
          utterance.pitch = 1.2
          utterance.rate = 1.0
        } else if (interviewer === 'ayse') {
          // Try to find another female voice or use different pitch
          const fulyaVoice = availableVoices.find(v => v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('aylin') || v.name.toLowerCase().includes('emel'))
          utterance.voice = availableVoices.find(v => (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('aylin') || v.name.toLowerCase().includes('emel')) && v !== fulyaVoice) || availableVoices[0]
          utterance.pitch = 1.45
          utterance.rate = 1.05
        } else if (interviewer === 'gokturk') {
          // Try to find a male voice
          utterance.voice = availableVoices.find(v => v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('tolga')) || availableVoices[0]
          utterance.pitch = 0.7
          utterance.rate = 0.9
        } else {
          utterance.voice = availableVoices[0]
          utterance.pitch = 1.0
          utterance.rate = 1.0
        }
      }
    }
    
    selectVoice()
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = selectVoice
    }
    
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    
    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>
    const activeQuestions = assessmentMode === 'talent_test' ? questions : interviewQuestions
    if (appState === 'interview' && activeQuestions.length > 0) {
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
  }, [appState, currentQuestion, questions, interviewQuestions, assessmentMode])

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

  useEffect(() => {
    if (appState === 'interview' && assessmentMode === 'face_to_face' && interviewQuestions.length > 0) {
      const q = interviewQuestions[currentQuestion]
      if (q) {
        const timer = setTimeout(() => {
          speakQuestion(q.text, language, q.interviewer)
        }, 600)
        return () => clearTimeout(timer)
      }
    }
    return () => {
      window.speechSynthesis.cancel()
    }
  }, [currentQuestion, appState, assessmentMode, interviewQuestions, language])

  const startGeneration = async () => {
    if (!apiKey) {
      alert("Please enter a Gemini API Key.")
      return
    }
    setAppState('generating')
    try {
      const engine = new QuestionGenerationEngine(apiKey)
      if (assessmentMode === 'talent_test') {
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
      } else {
        const generated = await engine.generateInterviewQuestionsAsync(targetRole, numQuestions, language)
        if (generated.length === 0) {
          alert("Failed to generate questions. Please check your API Key.")
          setAppState('setup')
          return
        }
        setInterviewQuestions(generated)
        setCurrentQuestion(0)
        setTimeLeft(generated[0]?.estimatedTimeSeconds || 60)
        setAppState('interview')
      }
    } catch (err) {
      alert("An error occurred.")
      setAppState('setup')
    }
  }

  const handleAnswer = (answer: string) => {
    setSelectedAnswers(prev => ({ ...prev, [currentQuestion]: answer }))
  }

  const nextQuestion = () => {
    if (assessmentMode === 'talent_test') {
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
    } else {
      if (currentQuestion < interviewQuestions.length - 1) {
        const nextQ = interviewQuestions[currentQuestion + 1]
        setCurrentQuestion(currentQuestion + 1)
        setTimeLeft(nextQ.estimatedTimeSeconds || 60)
      } else {
        setAppState('feedback')
      }
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
              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-300 mb-2">Assessment Mode</label>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    type="button"
                    onClick={() => setAssessmentMode('talent_test')}
                    className={`py-3 px-4 rounded-xl border font-bold transition-all cursor-pointer ${
                      assessmentMode === 'talent_test' 
                        ? 'bg-red-950/40 border-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.15)]' 
                        : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    General Talent Test
                  </button>
                  <button 
                    type="button"
                    onClick={() => setAssessmentMode('face_to_face')}
                    className={`py-3 px-4 rounded-xl border font-bold transition-all cursor-pointer ${
                      assessmentMode === 'face_to_face' 
                        ? 'bg-red-950/40 border-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.15)]' 
                        : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    Face-to-Face Simulation
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-300 mb-2">Gemini API Key</label>
                  <input type="password" placeholder="AI-..." value={apiKey} onChange={e => setApiKey(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500" />
                </div>
                {assessmentMode === 'face_to_face' && (
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-slate-300 mb-2">Target Job Role</label>
                    <input type="text" placeholder="e.g. Frontend Developer, Product Manager" value={targetRole} onChange={e => setTargetRole(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Number of Questions</label>
                  <input type="number" value={numQuestions} onChange={e => setNumQuestions(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-200" />
                </div>
                {assessmentMode === 'talent_test' && (
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-2">Duration (Minutes)</label>
                    <input type="number" value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-200" />
                  </div>
                )}
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
              <button onClick={startGeneration} className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all cursor-pointer">
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

        {appState === 'interview' && (assessmentMode === 'talent_test' ? questions.length > 0 : interviewQuestions.length > 0) && (
          <div className="flex-1 flex flex-col">
            {/* Top Bar (Countdown + Info) */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-4 bg-red-950/50 border border-red-900/50 px-4 py-2 rounded-lg">
                <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,1)]"></div>
                <span className="font-bold text-red-400 text-sm">TIME LEFT:</span>
                <div className={`font-mono text-xl font-bold ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-slate-300'}`}>
                  00:{timeLeft.toString().padStart(2, '0')}
                </div>
              </div>
              <div className="text-sm font-bold text-slate-400 uppercase tracking-widest bg-slate-900 px-4 py-2 rounded-lg border border-slate-800">
                {assessmentMode === 'talent_test' 
                  ? `Category: ${questions[currentQuestion].category}`
                  : `Interviewer: ${interviewQuestions[currentQuestion].interviewer.toUpperCase()}`
                }
              </div>
            </div>

            {/* Assessment UI */}
            {assessmentMode === 'talent_test' ? (
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
            ) : (
              <div className="flex-1 flex flex-col">
                {/* 2x2 simulated Zoom grid */}
                <div className="grid grid-cols-2 gap-4 flex-1 mb-6">
                  {/* Panelist 1: Fulya */}
                  <div className={`bg-slate-900 border-2 rounded-xl overflow-hidden relative shadow-md flex flex-col items-center justify-center p-4 transition-all duration-300 ${
                    interviewQuestions[currentQuestion]?.interviewer === 'fulya' ? 'border-green-500 ring-2 ring-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.15)]' : 'border-slate-800'
                  }`}>
                    <video 
                      src={isSpeaking && interviewQuestions[currentQuestion]?.interviewer === 'fulya' ? './videos/fulya_speaking.mp4' : './videos/fulya_idle.mp4'} 
                      autoPlay loop muted playsInline
                      className="w-24 h-24 rounded-full border border-slate-700 object-cover shadow-lg" 
                    />
                    <span className="text-white font-bold mt-3">Fulya Süleymaniye</span>
                    <span className="text-xs text-slate-400">HR Lead</span>
                    
                    {/* Active speaker wave */}
                    {interviewQuestions[currentQuestion]?.interviewer === 'fulya' && isSpeaking && (
                      <div className="flex items-center space-x-1 mt-3">
                        <div className="w-1 h-3 bg-green-500 rounded animate-[pulse_0.4s_infinite_alternate]" />
                        <div className="w-1 h-5 bg-green-500 rounded animate-[pulse_0.3s_infinite_alternate]" style={{ animationDelay: '0.1s' }} />
                        <div className="w-1 h-2 bg-green-500 rounded animate-[pulse_0.5s_infinite_alternate]" style={{ animationDelay: '0.2s' }} />
                      </div>
                    )}
                  </div>

                  {/* Panelist 2: Göktürk */}
                  <div className={`bg-slate-900 border-2 rounded-xl overflow-hidden relative shadow-md flex flex-col items-center justify-center p-4 transition-all duration-300 ${
                    interviewQuestions[currentQuestion]?.interviewer === 'gokturk' ? 'border-green-500 ring-2 ring-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.15)]' : 'border-slate-800'
                  }`}>
                    <video 
                      src={isSpeaking && interviewQuestions[currentQuestion]?.interviewer === 'gokturk' ? './videos/gokturk_speaking.mp4' : './videos/gokturk_idle.mp4'} 
                      autoPlay loop muted playsInline
                      className="w-24 h-24 rounded-full border border-slate-700 object-cover shadow-lg" 
                    />
                    <span className="text-white font-bold mt-3">Göktürk Korkut</span>
                    <span className="text-xs text-slate-400">Tech Lead</span>
                    
                    {/* Active speaker wave */}
                    {interviewQuestions[currentQuestion]?.interviewer === 'gokturk' && isSpeaking && (
                      <div className="flex items-center space-x-1 mt-3">
                        <div className="w-1 h-3 bg-green-500 rounded animate-[pulse_0.4s_infinite_alternate]" />
                        <div className="w-1 h-5 bg-green-500 rounded animate-[pulse_0.3s_infinite_alternate]" style={{ animationDelay: '0.1s' }} />
                        <div className="w-1 h-2 bg-green-500 rounded animate-[pulse_0.5s_infinite_alternate]" style={{ animationDelay: '0.2s' }} />
                      </div>
                    )}
                  </div>

                  {/* Panelist 3: Ayşe */}
                  <div className={`bg-slate-900 border-2 rounded-xl overflow-hidden relative shadow-md flex flex-col items-center justify-center p-4 transition-all duration-300 ${
                    interviewQuestions[currentQuestion]?.interviewer === 'ayse' ? 'border-green-500 ring-2 ring-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.15)]' : 'border-slate-800'
                  }`}>
                    <video 
                      src={isSpeaking && interviewQuestions[currentQuestion]?.interviewer === 'ayse' ? './videos/ayse_speaking.mp4' : './videos/ayse_idle.mp4'} 
                      autoPlay loop muted playsInline
                      className="w-24 h-24 rounded-full border border-slate-700 object-cover shadow-lg" 
                    />
                    <span className="text-white font-bold mt-3">Ayşe Ayasofya</span>
                    <span className="text-xs text-slate-400">Product Manager</span>
                    
                    {/* Active speaker wave */}
                    {interviewQuestions[currentQuestion]?.interviewer === 'ayse' && isSpeaking && (
                      <div className="flex items-center space-x-1 mt-3">
                        <div className="w-1 h-3 bg-green-500 rounded animate-[pulse_0.4s_infinite_alternate]" />
                        <div className="w-1 h-5 bg-green-500 rounded animate-[pulse_0.3s_infinite_alternate]" style={{ animationDelay: '0.1s' }} />
                        <div className="w-1 h-2 bg-green-500 rounded animate-[pulse_0.5s_infinite_alternate]" style={{ animationDelay: '0.2s' }} />
                      </div>
                    )}
                  </div>

                  {/* Candidate (You) */}
                  <div className="bg-black border-2 border-slate-800 rounded-xl overflow-hidden relative shadow-md flex items-center justify-center">
                    <div className="absolute top-3 left-3 bg-red-600/90 px-2 py-0.5 rounded-sm text-[10px] font-bold text-white z-10 animate-pulse">YOU</div>
                    {cameraMode === 'video' ? (
                      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" style={{ transform: 'scaleX(-1)' }} />
                    ) : (
                      <div className="text-center p-4">
                        <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 mx-auto flex items-center justify-center mb-2">🎤</div>
                        <p className="text-slate-400 text-sm font-bold">Audio Active</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Question box */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4 relative shadow-inner">
                  <div className="text-xs text-red-500 font-bold mb-2 tracking-widest uppercase flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                    <span>
                      {interviewQuestions[currentQuestion]?.interviewer === 'fulya' && 'Fulya Süleymaniye (HR Lead)'}
                      {interviewQuestions[currentQuestion]?.interviewer === 'gokturk' && 'Göktürk Korkut (Tech Lead)'}
                      {interviewQuestions[currentQuestion]?.interviewer === 'ayse' && 'Ayşe Ayasofya (Product PM)'} is asking:
                    </span>
                  </div>
                  <p className="text-lg text-white font-medium italic leading-relaxed">
                    "{interviewQuestions[currentQuestion]?.text}"
                  </p>
                </div>
              </div>
            )}

            {/* Bottom buttons */}
            <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800">
              <div className="text-xs text-slate-500 font-bold tracking-widest uppercase">
                Question {currentQuestion + 1} / {assessmentMode === 'talent_test' ? questions.length : interviewQuestions.length}
              </div>
              <div className="flex space-x-3">
                {assessmentMode === 'face_to_face' && (
                  <button 
                    onClick={() => speakQuestion(interviewQuestions[currentQuestion]?.text, language)}
                    className="px-6 py-3 rounded-lg font-bold border border-slate-700 hover:border-slate-500 text-slate-300 transition-all flex items-center space-x-2 cursor-pointer"
                  >
                    <span>REPLAY QUESTION 🔊</span>
                  </button>
                )}
                <button 
                  onClick={nextQuestion} 
                  disabled={assessmentMode === 'talent_test' && !selectedAnswers[currentQuestion]}
                  className="px-8 py-3 rounded-lg font-bold bg-white text-black hover:bg-slate-200 disabled:opacity-50 transition-all flex items-center space-x-2 cursor-pointer"
                >
                  <span>
                    {assessmentMode === 'talent_test' 
                      ? (currentQuestion < questions.length - 1 ? 'SUBMIT & NEXT' : 'FINISH ASSESSMENT')
                      : (currentQuestion < interviewQuestions.length - 1 ? 'DONE ANSWERING & NEXT' : 'FINISH INTERVIEW')
                    }
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {appState === 'feedback' && (
          <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col justify-center text-center">
            {assessmentMode === 'talent_test' ? (
              <>
                <h2 className="text-4xl font-black mb-4 tracking-tight">ASSESSMENT COMPLETE</h2>
                <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 mb-8">
                  {score} / {questions.length}
                </div>
              </>
            ) : (
              <>
                <h2 className="text-4xl font-black mb-4 tracking-tight text-white uppercase">Interview Completed</h2>
                <p className="text-slate-400 text-lg mb-8 max-w-md mx-auto">
                  You have successfully completed the mock panel interview simulation for the <strong>{targetRole}</strong> role. Your camera and microphone recording has been stopped.
                </p>
              </>
            )}
            <button onClick={() => setAppState('setup')} className="px-10 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all w-full cursor-pointer">
              START AGAIN
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
