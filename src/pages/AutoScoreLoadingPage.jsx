import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar  from '../components/TopBar'
import SideNav from '../components/SideNav'

const BACKEND = 'http://localhost:8000'

export default function AutoScoreLoadingPage() {
  const navigate = useNavigate()

  const [elapsed,   setElapsed]   = useState(0)
  const [statusMsg, setStatusMsg] = useState('Connecting to evaluation engine...')
  const [errMsg,    setErrMsg]    = useState('')

  // OCR (scan mode only)
  const [ocrStatus, setOcrStatus] = useState('waiting')  // waiting|active|done|skipped
  const [ocrWords,  setOcrWords]  = useState(0)
  const ocrWordsRef = useRef(0)

  // Stage state for the 2 sequential agents
  const [srceState,    setSrceState]    = useState('waiting')  // waiting|active|done
  const [scoringState, setScoringState] = useState('waiting')
  const [evidence,     setEvidence]     = useState(null)       // evidence_dict snapshot
  const [done,         setDone]         = useState(false)

  // Elapsed timer
  useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const payload = window.__essayiq_payload
    if (!payload) { navigate('/'); return }

    let cancelled = false

    // ── Demo mode: replays fake events for AutoScore ─────────────────────────
    function mockStream() {
      const delay = (ms) => new Promise(r => setTimeout(r, ms))
      const mockEvidence = {
        thesis_statement: "Friendship is essential for a student's personal growth, emotional support, and social development.",
        paragraph_count: 4,
        grammar_errors: 3,
        spelling_errors: 2,
        lexical_diversity: 0.54,
        transitions_detected: ["furthermore", "however", "consequently", "in addition"]
      }
      const events = [
        { ms: 400,   ev: { stage:'ocr', status:'processing' }},
        { ms: 1500,  ev: { stage:'ocr', status:'done', word_count:312, pages:2 }},
        { ms: 2500,  ev: { stage:'srce', status:'processing' }},
        { ms: 5500,  ev: { stage:'srce', status:'done', evidence: mockEvidence }},
        { ms: 6500,  ev: { stage:'scoring', status:'processing' }},
        { ms: 9500,  ev: { stage:'final', status:'done',
            score: 4.0,
            feedback: 'The essay displays a strong thesis statement and logical structure. Relevant evidence supports the core premises. A few grammatical slips are noted. Vocabulary is standard but clear.',
            holistic_reasoning: 'The essay states a clear position, maintains it with logical paragraph structure (4 paragraphs), and provides adequate examples. The language is simple but functional. Minor errors do not obscure meaning, resulting in a score of 4.0.',
            aspect_scores: {
              'Task Response': 4,
              'Argument Quality': 4,
              'Organisation': 4,
              'Language & Style': 3,
              'Grammar': 4
            },
            agent_comments: {
              'Task Response': 'Good task alignment.',
              'Argument Quality': 'Sufficient reasoning provided.',
              'Organisation': 'Clear 4-paragraph essay layout.',
              'Language & Style': 'Basic vocabulary, could be elevated.',
              'Grammar': 'Minor spelling and punctuation issues.'
            },
            trait_details: {
              structure: 'Standard intro-body-conclusion flow.',
              mechanics: '2 spelling errors, 3 grammar errors flagged.'
            },
            evidence: mockEvidence
        }}
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
          setStatusMsg('Sending essay to AutoScore pipeline...')
          const fd = new FormData()
          fd.append('essay',  payload.essay)
          fd.append('prompt', payload.prompt)
          res = await fetch(`${BACKEND}/evaluate-autoscore-text`, { method: 'POST', body: fd })
        } else {
          setStatusMsg('Uploading pages to OCR engine...')
          const fd = new FormData()
          for (const f of payload.pages) fd.append('pages', f)
          fd.append('prompt', payload.prompt)
          res = await fetch(`${BACKEND}/evaluate-autoscore`, { method: 'POST', body: fd })
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
      // ── OCR ──
      if (ev.stage === 'ocr') {
        if (ev.status === 'processing') { setOcrStatus('active'); setStatusMsg('Running OCR on scanned pages...') }
        if (ev.status === 'page')       setStatusMsg(`OCR page ${ev.page}/${ev.of} — ${ev.words} words`)
        if (ev.status === 'done')       { 
          setOcrStatus('done'); 
          setOcrWords(ev.word_count); 
          ocrWordsRef.current = ev.word_count;
          setStatusMsg(`OCR complete — ${ev.word_count} words`) 
        }
        if (ev.status === 'skipped')    { 
          setOcrStatus('skipped'); 
          setOcrWords(ev.word_count);
          ocrWordsRef.current = ev.word_count;
        }
      }

      // ── Agent 1: SRCE evidence extraction ──
      if (ev.stage === 'srce') {
        if (ev.status === 'processing') {
          setSrceState('active')
          setStatusMsg('Agent 1 — extracting structured evidence from the essay...')
        }
        if (ev.status === 'done') {
          setSrceState('done')
          setEvidence(ev.evidence || {})
          setStatusMsg('Evidence record built — handing off to scoring agent...')
        }
      }

      // ── Agent 2: Scoring ──
      if (ev.stage === 'scoring' && ev.status === 'processing') {
        setScoringState('active')
        setStatusMsg('Agent 2 — applying rubric to the evidence record...')
      }

      // ── Final ──
      if (ev.stage === 'final' && ev.status === 'done') {
        setSrceState('done')
        setScoringState('done')
        setDone(true)
        setStatusMsg('Evaluation complete — loading results...')
        sessionStorage.setItem('essayiq_result', JSON.stringify({
          pipeline:         'autoscore',
          score:            ev.score,
          feedback:         ev.feedback,
          holistic_reasoning: ev.holistic_reasoning || '',
          aspect_scores:    ev.aspect_scores  || {},
          agent_comments:   ev.agent_comments || {},
          trait_details:    ev.trait_details  || {},
          evidence:         ev.evidence       || {},
          word_count:       ocrWordsRef.current,
        }))
        setTimeout(() => navigate('/results'), 1200)
      }

      // ── Error ──
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


  // Count how many evidence traits were extracted (for the JSON receipt badge)
  const evidenceTraitCount = evidence
    ? Object.keys(evidence).filter(k => k !== 'essay_metadata').length
    : 0

  function StageCard({ state, step, title, desc, icon }) {
    const c = state === 'active' ? '#2563EB' : state === 'done' ? '#10B981' : '#94A3B8'
    const bg = state === 'active' ? '#EFF6FF' : state === 'done' ? '#ECFDF5' : '#ffffff'
    const border = state === 'active' ? '#bfdbfe' : state === 'done' ? '#A7F3D0' : '#eef2f8'
    return (
      <div className="flex-1 flex flex-col p-6 rounded-2xl transition-all duration-500 shadow-card"
           style={{ background: bg, border: `1px solid ${border}`, minHeight: '200px' }}>
        <div className="flex items-center justify-between mb-4">
          <span className="font-sans text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ background: '#fff', color: c, border: `1px solid ${border}` }}>
            {step}
          </span>
          {state === 'done'   && <span className="material-symbols-outlined text-[22px]" style={{ color: '#10B981' }}>check_circle</span>}
          {state === 'active' && <span className="material-symbols-outlined text-[22px] animate-spin-slow" style={{ color: '#2563EB' }}>sync</span>}
        </div>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
             style={{ background: c + '1A', color: c }}>
          <span className="material-symbols-outlined text-[26px]">{icon}</span>
        </div>
        <h3 className="font-display text-[17px] font-bold mb-1" style={{ color: '#1A2340' }}>{title}</h3>
        <p className="font-sans text-[13px] leading-relaxed" style={{ color: '#64748B' }}>{desc}</p>
        {state === 'active' && (
          <span className="font-sans text-[12px] font-medium mt-auto animate-pulse" style={{ color: '#2563EB' }}>Working...</span>
        )}
      </div>
    )
  }

  return (
    <div className="bg-app min-h-screen flex">
      <SideNav />

      <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden">
        <TopBar showTimer showProgress elapsed={elapsed} title="AutoScore — In Progress" />

        <main className="flex-1 overflow-y-auto px-8 pb-8 pt-10 flex flex-col items-center relative z-10">

          {/* Header */}
          <div className="text-center mb-10 animate-fadein">
            <h1 className="font-display font-extrabold text-[40px] leading-tight tracking-tight mb-2" style={{ color: '#1A2340' }}>
              Evaluating Your Essay
            </h1>
            <p className="font-sans text-[12px] uppercase tracking-wider font-medium" style={{ color: '#64748B' }}>
              AutoScore · evidence extraction → rubric scoring
            </p>
            {errMsg && (
              <p className="mt-4 font-sans text-[13px] flex items-center justify-center gap-2" style={{ color: '#E11D48' }}>
                <span className="material-symbols-outlined text-[16px]">error</span> {errMsg}
              </p>
            )}
          </div>

          {/* OCR card (scan mode only) */}
          {ocrStatus !== 'skipped' && (
            <div className="w-full max-w-5xl mb-4 flex items-center gap-4 p-4 rounded-2xl shadow-card"
                 style={{ background: ocrStatus === 'done' ? '#ECFDF5' : '#EFF6FF',
                          border: `1px solid ${ocrStatus === 'done' ? '#A7F3D0' : '#bfdbfe'}` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                   style={{ background: ocrStatus === 'done' ? '#D1FAE5' : '#DBEAFE' }}>
                <span className="material-symbols-outlined text-[20px]" style={{ color: ocrStatus === 'done' ? '#059669' : '#2563EB' }}>
                  {ocrStatus === 'done' ? 'check_circle' : 'document_scanner'}
                </span>
              </div>
              <div className="flex-1">
                <span className="font-display text-[12px] font-semibold uppercase tracking-wide" style={{ color: ocrStatus === 'done' ? '#059669' : '#2563EB' }}>
                  Image Preprocessing
                </span>
                <p className="font-sans text-[13px]" style={{ color: '#64748B' }}>
                  {ocrStatus === 'done' ? `Text extracted — ${ocrWords} words ready` : 'Running OCR on scanned pages...'}
                </p>
              </div>
            </div>
          )}

          {/* The 2-agent sequential pipeline */}
          <div className="w-full max-w-5xl flex items-stretch gap-3">
            <StageCard
              state={srceState}
              step="Agent 1 · SRCE"
              title="Evidence Extraction"
              desc="Reads the essay and records structured facts — examples found, paragraph count, language issues, grammar errors. Assigns NO scores."
              icon="frame_inspect"
            />

            {/* JSON receipt connector */}
            <div className="flex flex-col items-center justify-center px-1 shrink-0" style={{ width: '120px' }}>
              <span className="material-symbols-outlined text-[24px]" style={{ color: srceState === 'done' ? '#10B981' : '#cbd5e1' }}>
                arrow_forward
              </span>
              <div className="mt-2 px-3 py-2 rounded-xl text-center transition-all"
                   style={{
                     background: srceState === 'done' ? '#ECFDF5' : '#F8FAFC',
                     border: `1px solid ${srceState === 'done' ? '#A7F3D0' : '#eef2f8'}`,
                   }}>
                <span className="material-symbols-outlined text-[20px]" style={{ color: srceState === 'done' ? '#059669' : '#94A3B8' }}>data_object</span>
                <p className="font-sans text-[9px] font-semibold mt-0.5" style={{ color: srceState === 'done' ? '#059669' : '#94A3B8' }}>
                  {srceState === 'done' ? `${evidenceTraitCount} TRAITS` : 'JSON'}
                </p>
              </div>
              <span className="material-symbols-outlined text-[24px] mt-2" style={{ color: srceState === 'done' ? '#10B981' : '#cbd5e1' }}>
                arrow_forward
              </span>
            </div>

            <StageCard
              state={scoringState}
              step="Agent 2 · Scoring"
              title="Rubric Judgment"
              desc="Reads ONLY the evidence record and applies the rubric — scoring each of 5 traits, then synthesising a holistic score with citations."
              icon="grading"
            />
          </div>

          {/* Overall status */}
          <div className="w-full max-w-5xl mt-4 flex items-center gap-4 p-4 rounded-2xl shadow-card"
               style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
            <div className="w-11 h-11 rounded-full flex items-center justify-center relative"
                 style={{ background: done ? '#D1FAE5' : '#FEF3C7' }}>
              {!done && <div className="absolute inset-0 rounded-full animate-ring" />}
              <span className="material-symbols-outlined text-[22px]" style={{ color: done ? '#059669' : '#D97706' }}>
                {done ? 'task_alt' : 'analytics'}
              </span>
            </div>
            <div>
              <span className="font-display text-[12px] font-semibold uppercase tracking-wide block" style={{ color: done ? '#059669' : '#D97706' }}>
                Holistic Score
              </span>
              <span className="font-sans text-[14px]" style={{ color: '#1A2340' }}>
                {done ? '✓ Score Ready — loading results' : 'Waiting for both agents to complete...'}
              </span>
            </div>
          </div>

          {/* Status bar */}
          <div className="mt-8 text-center">
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
