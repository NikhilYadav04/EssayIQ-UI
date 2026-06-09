import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar  from '../components/TopBar'
import SideNav from '../components/SideNav'
import AutoScoreLoadingPage from './AutoScoreLoadingPage'

const BACKEND = 'http://localhost:8000'

// The 5 evaluation dimensions (match backend agent_index 0–4)
const AGENT_DIMS = [
  { id: 'task',      label: 'Task Response',    desc: 'Evaluation of how completely and accurately the prompt is addressed.' },
  { id: 'argument',  label: 'Argument Quality', desc: 'Argumentative flow, premise coherence, and evidential support mapping.' },
  { id: 'style',     label: 'Organisation',     desc: 'Paragraph structure, coherence, transitions, and structural integrity.' },
  { id: 'vocab',     label: 'Language & Style', desc: 'Lexical richness, tone appropriateness, and syntactic variety.' },
  { id: 'grammar',   label: 'Grammar',          desc: 'Syntactic structure, morphological accuracy, and punctuation precision.' },
]

export default function LoadingPage() {
  // Route to the AutoScore 2-agent flow when that pipeline was chosen
  if (typeof window !== 'undefined' && window.__essayiq_payload?.pipeline === 'autoscore') {
    return <AutoScoreLoadingPage />
  }
  return <MagicLoadingPage />
}

function MagicLoadingPage() {
  const navigate = useNavigate()

  const [elapsed,    setElapsed]    = useState(0)
  const [statusMsg,  setStatusMsg]  = useState('Connecting to evaluation engine...')
  const [errMsg,     setErrMsg]     = useState('')

  // OCR card state
  const [ocrStatus,      setOcrStatus]      = useState('waiting')  // waiting | active | done | skipped
  const [ocrWords,       setOcrWords]       = useState(0)
  const ocrWordsRef = useRef(0)
  const [ocrPageProgress,setOcrPageProgress]= useState(null)  // null | {page, of}

  // Agent card states: array of 'waiting' | 'active' | 'done'
  const [agentState, setAgentState] = useState(Array(5).fill('waiting'))
  const [agentScore, setAgentScore] = useState(Array(5).fill(null))

  const [done, setDone] = useState(false)

  // Elapsed timer
  useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // SSE stream
  useEffect(() => {
    const payload = window.__essayiq_payload
    if (!payload) { navigate('/'); return }

    let cancelled = false

    // ── Demo mode: replays fake events with delays (no backend needed) ──────
    function mockStream() {
      const delay = (ms) => new Promise(r => setTimeout(r, ms))
      const MOCK_SCORES = {
        'Task Response':    4,
        'Argument Quality': 3,
        'Organisation':     4,
        'Language & Style': 3,
        'Grammar':          4,
      }
      const MOCK_COMMENTS = {
        'Task Response':    'The essay addresses the prompt clearly. The writer establishes a position on the importance of friendship and maintains it throughout. However, the argument could be more nuanced by acknowledging counterpoints.',
        'Argument Quality': 'The essay presents relevant reasons but relies largely on general assertions without specific evidence or examples. Development of the central argument would benefit from concrete anecdotes or data.',
        'Organisation':     'The essay follows a clear introduction–body–conclusion structure. Transitions between paragraphs are functional but could be more sophisticated to improve the flow of ideas.',
        'Language & Style': 'Vocabulary is appropriate for the topic but largely elementary. Greater lexical variety and use of domain-specific terms would strengthen the stylistic quality of the writing.',
        'Grammar':          'Grammar is generally correct with occasional minor errors in punctuation and subject-verb agreement. These do not significantly impede comprehension.',
      }
      const events = [
        { ms: 400,   ev: { stage:'ocr', status:'processing' }},
        { ms: 1400,  ev: { stage:'ocr', status:'page',    page:1, of:2, words:173 }},
        { ms: 2800,  ev: { stage:'ocr', status:'page',    page:2, of:2, words:139 }},
        { ms: 4000,  ev: { stage:'ocr', status:'done',    word_count:312, pages:2 }},
        { ms: 4600,  ev: { stage:'magic', status:'processing' }},
        { ms: 6500,  ev: { stage:'agent', status:'done', agent_index:0, aspect_name:'Task Response',    score:4, feedback: MOCK_COMMENTS['Task Response'] }},
        { ms: 9000,  ev: { stage:'agent', status:'done', agent_index:1, aspect_name:'Argument Quality', score:3, feedback: MOCK_COMMENTS['Argument Quality'] }},
        { ms: 11500, ev: { stage:'agent', status:'done', agent_index:2, aspect_name:'Organisation',     score:4, feedback: MOCK_COMMENTS['Organisation'] }},
        { ms: 14000, ev: { stage:'agent', status:'done', agent_index:3, aspect_name:'Language & Style', score:3, feedback: MOCK_COMMENTS['Language & Style'] }},
        { ms: 16500, ev: { stage:'agent', status:'done', agent_index:4, aspect_name:'Grammar',          score:4, feedback: MOCK_COMMENTS['Grammar'] }},
        { ms: 17500, ev: { stage:'orchestrator', status:'processing' }},
        { ms: 21000, ev: { stage:'final', status:'done',
            score: 3.6,
            feedback: 'This essay presents a clear and sincere perspective on the importance of friendship in student life. The writer maintains a consistent position and organises their thoughts in a logical progression. To reach a higher band, the essay would benefit from deeper argumentation, richer vocabulary, and more precise grammar. Overall, this is a competent response that demonstrates foundational writing skills with room for significant development.',
            aspect_scores: MOCK_SCORES,
            agent_comments: MOCK_COMMENTS,
        }},
      ]

      async function run() {
        const start = Date.now()
        for (const { ms, ev } of events) {
          if (cancelled) break
          const wait = ms - (Date.now() - start)
          if (wait > 0) await delay(wait)
          if (!cancelled) handleEvent(ev)
        }
      }
      run()
    }

    async function startStream() {
      try {
        let res
        if (payload.mode === 'text') {
          setStatusMsg('Sending essay to MAGIC pipeline...')
          const fd = new FormData()
          fd.append('essay',  payload.essay)
          fd.append('prompt', payload.prompt)
          res = await fetch(`${BACKEND}/evaluate-text`, { method: 'POST', body: fd })
        } else {
          setStatusMsg('Uploading pages to OCR engine...')
          const fd = new FormData()
          // Send every page as pages[] — backend accepts List[UploadFile]
          for (const f of payload.pages) fd.append('pages', f)
          fd.append('prompt', payload.prompt)
          res = await fetch(`${BACKEND}/evaluate`, { method: 'POST', body: fd })
        }


        if (!res.ok) throw new Error(`Server error ${res.status}`)

        const reader  = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer    = ''

        while (!cancelled) {
          const { done: streamDone, value } = await reader.read()
          if (streamDone) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop()
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const ev = JSON.parse(line.slice(6))
              if (!cancelled) handleEvent(ev)
            } catch { /* skip malformed */ }
          }
        }
      } catch (e) {
        if (!cancelled) {
          setErrMsg(`Connection error: ${e.message}`)
          setStatusMsg('Error — returning to submit page...')
          setTimeout(() => navigate('/'), 3000)
        }
      }
    }

    function handleEvent(ev) {
      // ── OCR stage ──────────────────────────────────────────────────────
      if (ev.stage === 'ocr') {
        if (ev.status === 'processing') {
          setOcrStatus('active')
          setStatusMsg('Starting OCR — denoising, deskewing, extracting text...')
        }
        // Per-page progress
        if (ev.status === 'page') {
          setOcrPageProgress({ page: ev.page, of: ev.of })
          setStatusMsg(`OCR page ${ev.page}/${ev.of} — ${ev.words} words extracted`)
        }
        if (ev.status === 'page_fail') {
          setOcrPageProgress({ page: ev.page, of: ev.of })
          setStatusMsg(`Page ${ev.page}/${ev.of} OCR failed — skipping`)
        }
        if (ev.status === 'done') {
          setOcrStatus('done')
          setOcrWords(ev.word_count)
          ocrWordsRef.current = ev.word_count
          setOcrPageProgress(null)
          const pagesLabel = ev.pages > 1 ? ` across ${ev.pages} pages` : ''
          setStatusMsg(`OCR complete — ${ev.word_count} words extracted${pagesLabel}`)
        }
        if (ev.status === 'skipped') {
          setOcrStatus('skipped')
          setOcrWords(ev.word_count)
          ocrWordsRef.current = ev.word_count
          setStatusMsg(`Essay received — ${ev.word_count} words`)
        }
      }


      // ── MAGIC stage: all 5 agents start in parallel → activate all cards ──
      if (ev.stage === 'magic' && ev.status === 'processing') {
        setStatusMsg('Running 5 evaluation agents in parallel...')
        setAgentState(Array(5).fill('active'))   // all cards scanning immediately
      }

      // ── Per-agent result: flip only that card to done as its SSE arrives ─
      if (ev.stage === 'agent' && ev.status === 'done') {
        const idx = ev.agent_index
        setStatusMsg(`Agent ${idx + 1}/5 complete — ${ev.aspect_name}: ${ev.score}/6`)
        setAgentScore(prev => { const s = [...prev]; s[idx] = ev.score; return s })
        setAgentState(prev => { const s = [...prev]; s[idx] = 'done'; return s })
      }

      // ── Orchestrator now running (all 5 agents done) ────────────────────
      if (ev.stage === 'orchestrator' && ev.status === 'processing') {
        setAgentState(Array(5).fill('done'))
        setStatusMsg('All agents done — synthesizing holistic assessment...')
      }

      // ── Final result ───────────────────────────────────────────────────
      if (ev.stage === 'final' && ev.status === 'done') {
        // Mark all remaining as done
        setAgentState(Array(5).fill('done'))
        setDone(true)
        setStatusMsg('Evaluation complete — loading results...')

        sessionStorage.setItem('essayiq_result', JSON.stringify({
          score:          ev.score,
          feedback:       ev.feedback,
          aspect_scores:  ev.aspect_scores  || {},
          agent_comments: ev.agent_comments || {},
          word_count:     ocrWordsRef.current,
        }))
        setTimeout(() => navigate('/results'), 1200)
      }


      // ── Error ──────────────────────────────────────────────────────────
      if (ev.stage === 'error') {
        setErrMsg(ev.message)
        setStatusMsg('Error — returning to submit page...')
        setTimeout(() => navigate('/'), 3000)
      }
    }


    if (payload.mode === 'demo') {
      mockStream()
    } else {
      startStream()
    }
    return () => { cancelled = true }

  }, [navigate])

  const ocrLabel = ocrStatus === 'skipped' ? 'Text Input' : 'Image Preprocessing'

  return (
    <div className="bg-app min-h-screen flex">
      <SideNav />

      <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden">
        <TopBar showTimer showProgress elapsed={elapsed} title="Evaluation in Progress" />

      <main className="flex-1 overflow-y-auto px-8 pb-8 pt-10 flex flex-col items-center relative z-10">

        {/* Header */}
        <div className="text-center mb-10 animate-fadein">
          <h1 className="font-display font-extrabold text-[40px] leading-tight tracking-tight mb-2" style={{ color: '#1A2340' }}>
            Evaluating Your Essay
          </h1>
          <p className="font-sans text-[12px] uppercase tracking-wider font-medium" style={{ color: '#64748B' }}>
            {ocrStatus !== 'skipped' ? 'OCR preprocessing → 5 evaluation agents' : 'Running 5 evaluation agents'}
          </p>
          {errMsg && (
            <p className="mt-4 font-sans text-[13px] flex items-center justify-center gap-2" style={{ color: '#E11D48' }}>
              <span className="material-symbols-outlined text-[16px]">error</span> {errMsg}
            </p>
          )}
        </div>

        {/* Pipeline row */}
        <div className="w-full max-w-7xl flex flex-col gap-4">

          {/* ── OCR / Input card (only shown for scan mode or until skipped) ── */}
          {ocrStatus !== 'skipped' && (
            <div
              className="flex items-center gap-5 p-5 rounded-2xl transition-all duration-500 relative overflow-hidden shadow-card"
              style={{
                background:  ocrStatus === 'active' ? '#EFF6FF' : ocrStatus === 'done' ? '#ECFDF5' : '#ffffff',
                border:      `1px solid ${ocrStatus === 'active' ? '#bfdbfe' : ocrStatus === 'done' ? '#A7F3D0' : '#e2e8f0'}`,
              }}
            >
              {/* Icon */}
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                   style={{ background: ocrStatus === 'done' ? '#D1FAE5' : '#DBEAFE' }}>
                <span className="material-symbols-outlined text-[22px]"
                      style={{ color: ocrStatus === 'done' ? '#059669' : '#2563EB' }}>
                  {ocrStatus === 'done' ? 'check_circle' : 'document_scanner'}
                </span>
              </div>

              {/* Labels */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-display text-[13px] font-semibold uppercase tracking-wide"
                        style={{ color: ocrStatus === 'active' ? '#2563EB' : ocrStatus === 'done' ? '#059669' : '#475569' }}>
                    {ocrLabel}
                  </span>
                  {ocrStatus === 'active' && (
                    <span className="material-symbols-outlined text-[15px] animate-spin-slow" style={{ color: '#2563EB' }}>sync</span>
                  )}
                  {ocrStatus === 'active' && ocrPageProgress && (
                    <span className="font-sans text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                          style={{ background: '#DBEAFE', color: '#2563EB' }}>
                      PAGE {ocrPageProgress.page}/{ocrPageProgress.of}
                    </span>
                  )}
                  {ocrStatus === 'done' && (
                    <span className="font-sans text-[11px] font-medium" style={{ color: '#059669' }}>✓ {ocrWords} words</span>
                  )}
                </div>
                <p className="font-sans text-[13.5px]" style={{ color: '#64748B' }}>
                  {ocrStatus === 'waiting' && 'Waiting to start image preprocessing...'}
                  {ocrStatus === 'active' && !ocrPageProgress && 'Denoising · Deskewing · Binarizing · Upscaling · Gemini Vision OCR'}
                  {ocrStatus === 'active' && ocrPageProgress && `Processing page ${ocrPageProgress.page} of ${ocrPageProgress.of} — Denoising · Deskewing · Gemini Vision OCR`}
                  {ocrStatus === 'done' && `Text extracted successfully — ${ocrWords} words ready for evaluation`}
                </p>
              </div>

              {/* Stage badge */}
              <div className="font-sans text-[10px] px-2.5 py-1 rounded-full shrink-0"
                   style={{ background: '#F1F5FB', color: '#8A96AA' }}>
                STAGE 1
              </div>
            </div>
          )}

          {/* ── 5 Agent cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {AGENT_DIMS.map((dim, i) => {
              const state = agentState[i]   // 'waiting' | 'active' | 'done'
              const score = agentScore[i]

              return (
                <div
                  key={dim.id}
                  className="flex flex-col h-64 p-5 relative rounded-2xl transition-all duration-500 overflow-hidden"
                  style={{
                    background:  state === 'active' ? '#EFF6FF' : '#ffffff',
                    border:      `1px solid ${state === 'active' ? '#bfdbfe' : state === 'done' ? '#A7F3D0' : '#eef2f8'}`,
                    boxShadow:   state === 'active' ? '0 8px 24px rgba(37,99,235,0.12)' : '0 1px 3px rgba(16,24,40,0.05)',
                  }}
                >
                  <div className="flex justify-between items-start mb-3 relative z-10">
                    <span className="font-display text-[11px] font-semibold uppercase tracking-wide"
                          style={{ color: state === 'active' ? '#2563EB' : state === 'done' ? '#059669' : '#475569' }}>
                      {dim.label}
                    </span>
                    {state === 'done'   && <span className="material-symbols-outlined text-[19px]" style={{ color: '#10B981' }}>check_circle</span>}
                    {state === 'active' && <span className="material-symbols-outlined text-[19px] animate-spin-slow" style={{ color: '#2563EB' }}>sync</span>}
                  </div>

                  <p className="font-sans text-[13px] leading-relaxed flex-grow relative z-10"
                     style={{ color: '#64748B', opacity: state === 'waiting' ? 0.55 : 1 }}>
                    {dim.desc}
                  </p>

                  <div className="mt-auto pt-3 relative z-10 flex items-center justify-between"
                       style={{ borderTop: '1px solid #f1f5fb' }}>
                    {state === 'active' && (
                      <span className="font-sans text-[12px] font-medium animate-pulse" style={{ color: '#2563EB' }}>Reviewing...</span>
                    )}
                    <span className="font-display font-bold text-[30px] leading-none ml-auto"
                          style={{ color: state === 'done' ? '#10B981' : '#cbd5e1' }}>
                      {score != null ? score : '–'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Overall card ── */}
          <div className="flex flex-col p-5 rounded-2xl relative justify-center items-center text-center shadow-card"
               style={{ background: '#FFFBEB', border: '1px solid #FDE68A', minHeight: '84px' }}>
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center relative"
                   style={{ background: done ? '#D1FAE5' : '#FEF3C7' }}>
                {!done && <div className="absolute inset-0 rounded-full animate-ring" />}
                <span className="material-symbols-outlined text-[24px]" style={{ color: done ? '#059669' : '#D97706' }}>
                  {done ? 'task_alt' : 'analytics'}
                </span>
              </div>
              <div className="text-left">
                <span className="font-display text-[12px] font-semibold uppercase tracking-wide block mb-0.5" style={{ color: done ? '#059669' : '#D97706' }}>
                  Overall Score
                </span>
                <span className="font-sans text-[14px]" style={{ color: '#1A2340' }}>
                  {done ? '✓ Score Ready — loading results' : 'Waiting for all agents to complete...'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="mt-10 text-center">
          <p className="font-sans text-[12px] uppercase tracking-wider font-medium animate-pulse" style={{ color: '#64748B' }}>
            {statusMsg}
          </p>
          <p className="font-sans text-[11px] mt-2" style={{ color: '#b0bbc8' }}>
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} elapsed
          </p>
        </div>

      </main>
      </div>
    </div>
  )
}
