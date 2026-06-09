import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar  from '../components/TopBar'
import SideNav from '../components/SideNav'

const BACKEND = 'http://localhost:8000'

const CRITERIA = [
  { color: '#10B981', icon: 'track_changes',       title: 'Task Response',            desc: 'Evaluation of how completely and accurately the prompt is addressed.' },
  { color: '#2563EB', icon: 'account_tree',         title: 'Argument Quality',         desc: 'Assessment of logical flow, evidence utilization, and strength of the central thesis.' },
  { color: '#F59E0B', icon: 'format_list_numbered', title: 'Organisation',             desc: 'Analysis of paragraph structure, coherence, transitions, and structural integrity.' },
  { color: '#D97706', icon: 'draw',                 title: 'Language & Style',         desc: 'Measurement of vocabulary richness, tone appropriateness, and syntactic variety.' },
  { color: '#E11D48', icon: 'spellcheck',           title: 'Grammar & Mechanics',      desc: 'Detection of syntactical errors, punctuation accuracy, and standard conventions.' },
  { color: '#2563EB', icon: 'stars',                title: 'Overall Score Prediction', desc: 'A composite metric projecting performance aligned with standardized academic rubrics.', highlight: true },
]

export default function SubmitPage() {
  const navigate = useNavigate()
  const [essay,      setEssay]      = useState('')
  const [question,   setQuestion]   = useState('')
  const [tab,        setTab]        = useState('type')
  const [pipeline,   setPipeline]   = useState('magic')   // 'magic' | 'autoscore'
  const [loading,    setLoading]    = useState(false)
  const [scanFiles,  setScanFiles]  = useState([])    // [{file, preview}]
  const [error,      setError]      = useState('')
  const fileRef = useRef()


  const wordCount = essay.trim() === '' ? 0 : essay.trim().split(/\s+/).length

  function handleTextFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { setEssay(ev.target.result); setTab('type') }
    reader.readAsText(file)
  }

  function handleScanFile(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    const newPages = files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))
    setScanFiles(prev => [...prev, ...newPages])
    e.target.value = ''   // allow re-selecting same file
  }

  function removePage(idx) {
    setScanFiles(prev => prev.filter((_, i) => i !== idx))
  }

  function movePageUp(idx) {
    if (idx === 0) return
    setScanFiles(prev => { const a = [...prev]; [a[idx-1], a[idx]] = [a[idx], a[idx-1]]; return a })
  }

  function movePageDown(idx) {
    setScanFiles(prev => {
      if (idx >= prev.length - 1) return prev
      const a = [...prev]; [a[idx], a[idx+1]] = [a[idx+1], a[idx]]; return a
    })
  }


  async function handleEvaluate() {
    setError('')

    // Validation
    if (tab === 'type' && wordCount < 10) {
      setError('Please enter at least 10 words.'); return
    }
    if (tab === 'scan' && scanFiles.length === 0) {
      setError('Please select at least one image or PDF to scan.'); return
    }

    if (!question.trim()) {
      setError('Please enter the essay question/prompt.'); return
    }

    setLoading(true)

    // Build and store the request in window (can't pass via navigate)
    if (tab === 'type' || tab === 'upload') {
      // Text mode → /evaluate-text
      window.__essayiq_payload = {
        mode:     'text',
        pipeline: pipeline,
        essay:    essay.trim(),
        prompt:   question.trim(),
      }
    } else {
      // Scan mode → /evaluate (multi-page images/PDFs)
      window.__essayiq_payload = {
        mode:     'scan',
        pipeline: pipeline,
        pages:    scanFiles.map(p => p.file),   // array of File objects in page order
        prompt:   question.trim(),
      }
    }


    setTimeout(() => navigate('/loading'), 300)
  }

  return (
    <div className="bg-app min-h-screen flex">
      <SideNav />

      <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden">
        <TopBar />

        <main className="flex-1 p-6 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">

          {/* LEFT: Submission */}
          <section className="lg:col-span-7 flex flex-col h-full rounded-2xl overflow-hidden animate-fadein shadow-card"
                   style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}>

            <div className="flex-1 p-7 flex flex-col gap-5 overflow-y-auto">

              {/* Hero */}
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="font-display text-[22px] font-bold" style={{ color: '#1A2340' }}>
                    Submit Your Essay
                  </h1>
                  <p className="font-sans text-[13px] mt-1" style={{ color: '#64748B' }}>
                    Paste your essay below for instant AI-powered feedback across 5 specialist dimensions.
                  </p>
                </div>
                <span className="font-sans text-[10px] px-2.5 py-1 rounded-full" style={{ background: '#EFF6FF', color: '#2563EB' }}>INPUT_STREAM_01</span>
              </div>

              {/* Pipeline selector */}
              <div className="flex flex-col gap-2">
                <label className="font-sans text-[12px] font-semibold uppercase tracking-wide" style={{ color: '#475569' }}>
                  Evaluation Pipeline
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: 'magic',     name: 'MAGIC',     tag: '5 parallel agents',   desc: 'Rich per-dimension feedback', icon: 'hub' },
                    { id: 'autoscore', name: 'AutoScore', tag: '2 sequential agents', desc: 'Auditable evidence trail',    icon: 'fact_check' },
                  ].map(p => {
                    const active = pipeline === p.id
                    return (
                      <button key={p.id} onClick={() => setPipeline(p.id)}
                        className="flex items-start gap-3 p-3.5 rounded-xl text-left transition-all"
                        style={{
                          background: active ? '#EFF6FF' : '#ffffff',
                          border: `1.5px solid ${active ? '#2563EB' : '#e2e8f0'}`,
                          boxShadow: active ? '0 0 0 3px rgba(37,99,235,0.08)' : 'none',
                        }}>
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                             style={{ background: active ? '#2563EB' : '#F1F5FB', color: active ? '#fff' : '#64748B' }}>
                          <span className="material-symbols-outlined text-[19px]">{p.icon}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-display text-[14px] font-bold" style={{ color: active ? '#2563EB' : '#1A2340' }}>{p.name}</span>
                            <span className="font-sans text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: active ? '#DBEAFE' : '#F1F5FB', color: active ? '#2563EB' : '#8A96AA' }}>{p.tag}</span>
                          </div>
                          <p className="font-sans text-[11.5px] mt-0.5" style={{ color: '#64748B' }}>{p.desc}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Question */}
              <div className="flex flex-col gap-2">
                <label className="font-sans text-[12px] font-semibold uppercase tracking-wide" style={{ color: '#475569' }}>
                  Essay Question / Prompt <span style={{ color: '#E11D48' }}>*</span>
                </label>
                <textarea rows={3} value={question} onChange={e => setQuestion(e.target.value)}
                  placeholder="Enter the prompt or question your essay addresses..."
                  className="w-full p-3.5 rounded-xl resize-none font-sans text-[15px] leading-relaxed outline-none transition-all"
                  style={{ background: '#F8FAFC', border: '1px solid #e2e8f0', color: '#1A2340' }}
                  onFocus={e => { e.target.style.borderColor='#2563EB'; e.target.style.background='#fff'; e.target.style.boxShadow='0 0 0 3px rgba(37,99,235,0.10)' }}
                  onBlur={e => { e.target.style.borderColor='#e2e8f0'; e.target.style.background='#F8FAFC'; e.target.style.boxShadow='none' }} />
              </div>

              {/* Tabs */}
              <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#F1F5FB' }}>
                {[['type','Type / Paste'],['upload','Upload .txt'],['scan','Scan Image / PDF']].map(([id, label]) => (
                  <button key={id} onClick={() => setTab(id)}
                    className="px-4 py-1.5 rounded-lg font-sans text-[13px] font-medium transition-all"
                    style={tab === id
                      ? { background: '#ffffff', color: '#2563EB', boxShadow: '0 1px 2px rgba(16,24,40,0.08)' }
                      : { background: 'transparent', color: '#64748B' }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Type Panel */}
              {tab === 'type' && (
                <div className="flex-1 flex flex-col min-h-[180px]">
                  <textarea value={essay} onChange={e => setEssay(e.target.value)}
                    placeholder="Begin typing or paste your essay here..."
                    className="flex-1 min-h-[180px] w-full p-5 rounded-xl resize-none font-sans text-[15px] leading-[1.7] outline-none transition-all"
                    style={{ background: '#F8FAFC', border: '1px solid #e2e8f0', color: '#1A2340' }}
                    onFocus={e => { e.target.style.borderColor='#2563EB'; e.target.style.background='#fff'; e.target.style.boxShadow='0 0 0 3px rgba(37,99,235,0.10)' }}
                    onBlur={e => { e.target.style.borderColor='#e2e8f0'; e.target.style.background='#F8FAFC'; e.target.style.boxShadow='none' }} />
                  <div className="flex justify-between py-2 px-1 font-sans text-[12px]" style={{ color: '#8A96AA' }}>
                    <span>Words: {wordCount}</span><span>Charset: UTF-8</span>
                  </div>
                </div>
              )}

              {/* Upload .txt Panel */}
              {tab === 'upload' && (
                <div className="flex-1 flex flex-col items-center justify-center min-h-[180px] gap-4 text-center p-8 rounded-xl border-2 border-dashed"
                     style={{ borderColor: '#cbd5e1', background: '#F8FAFC' }}>
                  <span className="material-symbols-outlined text-[48px]" style={{ color: '#64748B' }}>upload_file</span>
                  <p className="font-sans text-[14px] font-medium" style={{ color: '#475569' }}>Drop a .txt file here</p>
                  <label className="cursor-pointer px-4 py-2 rounded-lg font-sans text-[13px] font-medium transition-opacity hover:opacity-80"
                         style={{ background: '#2563EB', color: '#ffffff' }}>
                    Browse Files
                    <input type="file" accept=".txt" className="hidden" onChange={handleTextFile} />
                  </label>
                </div>
              )}

              {/* Scan Panel — multi-page */}
              {tab === 'scan' && (
                <div className="flex-1 flex flex-col gap-3 min-h-[180px]">

                  {/* Drop zone / Add pages button */}
                  <div className="flex flex-col items-center justify-center gap-3 p-5 rounded-xl border-2 border-dashed text-center"
                       style={{ borderColor: '#cbd5e1', background: '#F8FAFC' }}>
                    <span className="material-symbols-outlined text-[40px]" style={{ color: '#64748B' }}>document_scanner</span>
                    <div>
                      <p className="font-display text-[14px] font-semibold" style={{ color: '#475569' }}>
                        Upload scanned essay pages
                      </p>
                      <p className="font-sans text-[12px] mt-1" style={{ color: '#8A96AA' }}>
                        JPG · PNG · PDF · Multiple pages supported · Best at 300 DPI
                      </p>
                    </div>
                    <label className="cursor-pointer px-4 py-2 rounded-lg font-sans text-[13px] font-medium transition-opacity hover:opacity-80 flex items-center gap-2"
                           style={{ background: '#2563EB', color: '#ffffff' }}>
                      <span className="material-symbols-outlined text-[18px]">add</span>
                      {scanFiles.length === 0 ? 'Add Pages' : 'Add More Pages'}
                      <input ref={fileRef} type="file" multiple
                             accept=".jpg,.jpeg,.png,.pdf,.bmp,.tiff,.webp"
                             className="hidden" onChange={handleScanFile} />
                    </label>
                  </div>

                  {/* Page thumbnails */}
                  {scanFiles.length > 0 && (() => {
                    const pdfCount = scanFiles.filter(p => p.file.name.toLowerCase().endsWith('.pdf')).length
                    const imgCount = scanFiles.length - pdfCount
                    const badgeText = [
                      pdfCount > 0 ? `${pdfCount} PDF${pdfCount > 1 ? 's' : ''}` : '',
                      imgCount > 0 ? `${imgCount} IMAGE${imgCount > 1 ? 'S' : ''}` : '',
                    ].filter(Boolean).join(' + ')
                    return (
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center font-sans text-[11px]" style={{ color: '#8A96AA' }}>
                          <span>Page order (drag or reorder)</span>
                          <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                            {badgeText}
                          </span>
                        </div>

                        {/* PDF auto-expand notice */}
                        {pdfCount > 0 && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg font-sans text-[11px]"
                               style={{ background: '#FEFCE8', border: '1px solid #FDE047', color: '#92400e' }}>
                            <span className="material-symbols-outlined text-[15px]">info</span>
                            PDF pages are automatically extracted by the server — all pages will be OCR'd in order.
                          </div>
                        )}

                        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                          {scanFiles.map((p, i) => {
                            const isPdf = p.file.name.toLowerCase().endsWith('.pdf')
                            return (
                              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl"
                                   style={{ background: '#F8FAFC', border: '1px solid #eef2f8' }}>

                                {/* Thumbnail: PDF gets icon, image gets preview */}
                                {isPdf ? (
                                  <div className="w-10 h-12 shrink-0 flex flex-col items-center justify-center rounded-lg"
                                       style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                                    <span className="material-symbols-outlined text-[20px]" style={{ color: '#EA580C' }}>picture_as_pdf</span>
                                    <span className="font-sans text-[8px] mt-0.5" style={{ color: '#EA580C' }}>PDF</span>
                                  </div>
                                ) : (
                                  <img src={p.preview} alt={`Page ${i+1}`}
                                       className="w-10 h-12 object-cover shrink-0 rounded-lg"
                                       style={{ border: '1px solid #e2e8f0' }} />
                                )}

                                {/* Label */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <p className="font-display text-[12px] font-semibold" style={{ color: '#2563EB' }}>
                                      {isPdf ? 'PDF File' : `Page ${i + 1}`}
                                    </p>
                                    {isPdf && (
                                      <span className="font-sans text-[9px] px-1.5 py-0.5 rounded-full"
                                            style={{ background: '#FFF7ED', color: '#EA580C', border: '1px solid #FED7AA' }}>
                                        ALL PAGES AUTO-EXTRACTED
                                      </span>
                                    )}
                                  </div>
                                  <p className="font-sans text-[11px] truncate" style={{ color: '#8A96AA' }}>
                                    {p.file.name} · {(p.file.size / 1024).toFixed(0)} KB
                                  </p>
                                </div>

                                {/* Controls */}
                                <div className="flex gap-1 shrink-0">
                                  <button onClick={() => movePageUp(i)} disabled={i === 0}
                                          className="p-1.5 rounded-lg transition-colors hover:bg-white disabled:opacity-20"
                                          title="Move up" style={{ color: '#64748B' }}>
                                    <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                                  </button>
                                  <button onClick={() => movePageDown(i)} disabled={i === scanFiles.length - 1}
                                          className="p-1.5 rounded-lg transition-colors hover:bg-white disabled:opacity-20"
                                          title="Move down" style={{ color: '#64748B' }}>
                                    <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
                                  </button>
                                  <button onClick={() => removePage(i)}
                                          className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                                          title="Remove" style={{ color: '#E11D48' }}>
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}

                </div>
              )}


              {/* Error */}
              {error && (
                <p className="font-sans text-[13px] flex items-center gap-2 px-3 py-2 rounded-lg" style={{ color: '#E11D48', background: '#FEF2F2' }}>
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  {error}
                </p>
              )}

              {/* CTA */}
              <button onClick={handleEvaluate} disabled={loading}
                className="w-full py-4 mt-1 rounded-xl flex justify-center items-center gap-2.5 font-sans text-[15px] font-semibold transition-all hover:opacity-90 active:scale-[0.99] flex-shrink-0 group shadow-soft"
                style={{ background: '#2563EB', color: '#ffffff', opacity: loading ? 0.7 : 1 }}>
                {loading
                  ? <><span className="material-symbols-outlined animate-spin-slow text-[20px]">sync</span> Initialising...</>
                  : <><span className="material-symbols-outlined text-[20px] group-hover:translate-x-0.5 transition-transform">bolt</span> Evaluate My Essay</>
                }
              </button>
            </div>
          </section>

          {/* RIGHT: Criteria */}
          <section className="lg:col-span-5 flex flex-col h-full rounded-2xl overflow-hidden relative animate-fadein shadow-card"
                   style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}>
            <div className="p-7 flex-shrink-0 relative z-10" style={{ borderBottom: '1px solid #f1f5fb' }}>
              <h2 className="font-display text-[18px] font-bold flex items-center gap-2" style={{ color: '#1A2340' }}>
                <span className="material-symbols-outlined text-[20px]" style={{ color: '#2563EB' }}>model_training</span>
                What We Evaluate
              </h2>
              <p className="font-sans text-[13px] mt-1.5 leading-relaxed" style={{ color: '#64748B' }}>
                {pipeline === 'magic'
                  ? 'Each essay is evaluated by 5 specialist AI agents in parallel, then synthesised by an orchestrator into a single holistic score.'
                  : 'An evidence-extraction agent first records what the essay contains, then a scoring agent grades from that auditable evidence record.'}
              </p>
            </div>
            <div className="flex-1 p-5 overflow-y-auto relative z-10 flex flex-col gap-2.5">
              {CRITERIA.map(c => (
                <div key={c.title}
                     className="p-4 flex items-start gap-3.5 rounded-xl lift cursor-default"
                     style={{ background: c.highlight ? '#EFF6FF' : '#ffffff', border: `1px solid ${c.highlight ? '#bfdbfe' : '#eef2f8'}` }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: c.color+'1A', color: c.color }}>
                    <span className="material-symbols-outlined text-[20px]">{c.icon}</span>
                  </div>
                  <div>
                    <h3 className="font-display text-[14px] font-semibold mb-0.5"
                        style={{ color: c.highlight ? c.color : '#1A2340' }}>{c.title}</h3>
                    <p className="font-sans text-[12.5px] leading-relaxed" style={{ color: '#64748B' }}>{c.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 flex-shrink-0 relative z-10" style={{ borderTop: '1px solid #f1f5fb', background: '#F8FAFC' }}>
              <p className="font-sans text-[11.5px] flex items-center gap-2" style={{ color: '#8A96AA' }}>
                <span className="material-symbols-outlined text-[14px]">info</span>
                Metrics calibrated against GRE® Analytical Writing benchmarks (v4.2).
              </p>
            </div>
          </section>

        </div>
        </main>
      </div>
    </div>
  )
}
