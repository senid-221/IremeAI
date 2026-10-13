import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, ClipboardList, Clock3, Plus, RotateCcw, Send, Trash2, Upload } from 'lucide-react'

type Lang = 'en' | 'rw'
type Assessment = { id: string; title: string; instructions: string; grade_level: string | null; language: Lang; duration_minutes: number; subject_name: string | null; subject_name_rw: string | null; teacher_name: string; question_count: number; is_published?: boolean }
type Question = { id: string; question_order: number; prompt: string; options: string[]; points: number }
type DraftQuestion = { prompt: string; options: string[]; correctOption: number; explanation: string; points: number }
type Review = { questionId: string; questionOrder: number; prompt: string; options: string[]; selectedOption: number | null; correctOption: number; isCorrect: boolean; pointsAwarded: number; points: number; explanation: string }
type AttemptState = { assessment: Assessment; attempt: { id: string; started_at: string }; questions: Question[] }

const newQuestion = (): DraftQuestion => ({ prompt: '', options: ['', '', '', ''], correctOption: 0, explanation: '', points: 1 })

export default function AssessmentWorkspace({ lang, signedIn, onSignIn }: { lang: Lang; signedIn: boolean; onSignIn: () => void }) {
  const rw = lang === 'rw'
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [current, setCurrent] = useState<AttemptState | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ score: number; maxScore: number; percentage: number; review: Review[] } | null>(null)
  const [canManage, setCanManage] = useState(false)
  const [showCreator, setShowCreator] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [gradeLevel, setGradeLevel] = useState('S3')
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [assessmentLanguage, setAssessmentLanguage] = useState<Lang>(lang)
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([newQuestion()])

  async function loadAssessments() {
    if (!signedIn) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/assessments', { credentials: 'same-origin' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not load assessments.')
      setAssessments(Array.isArray(payload.assessments) ? payload.assessments : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load assessments.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    if (!signedIn) { setCanManage(false); return }
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(async response => response.ok ? response.json() : null)
      .then(payload => {
        if (!cancelled) setCanManage(['teacher', 'school_admin', 'platform_admin'].includes(payload?.user?.role))
      })
      .catch(() => { if (!cancelled) setCanManage(false) })
    return () => { cancelled = true }
  }, [signedIn])

  useEffect(() => { void loadAssessments() }, [signedIn])

  async function startAssessment(item: Assessment) {
    setError('')
    setNotice('')
    setResult(null)
    setAnswers({})
    try {
      const response = await fetch('/api/assessments/' + encodeURIComponent(item.id) + '/attempts', { method: 'POST', credentials: 'same-origin' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not start this assessment.')
      setCurrent(payload)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start this assessment.')
    }
  }

  async function submitAssessment() {
    if (!current || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/assessment-attempts/' + encodeURIComponent(current.attempt.id) + '/submit', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: current.questions.map(q => ({ questionId: q.id, selectedOption: answers[q.id] ?? null })) }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not submit your answers.')
      setResult(payload)
      setCurrent(null)
      void loadAssessments()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit your answers.')
    } finally {
      setSubmitting(false)
    }
  }

  function updateQuestion(index: number, patch: Partial<DraftQuestion>) {
    setDraftQuestions(previous => previous.map((question, i) => i === index ? { ...question, ...patch } : question))
  }

  async function createAssessment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (savingDraft) return
    setSavingDraft(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/assessments', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(), instructions: instructions.trim(), gradeLevel, language: assessmentLanguage, durationMinutes,
          questions: draftQuestions.map(question => ({ ...question, prompt: question.prompt.trim(), options: question.options.map(option => option.trim()) })),
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.assessment?.id) throw new Error(payload.error || 'Could not save this assessment.')
      const publishResponse = await fetch('/api/assessments/' + encodeURIComponent(payload.assessment.id) + '/publish', { method: 'POST', credentials: 'same-origin' })
      const publishPayload = await publishResponse.json().catch(() => ({}))
      if (!publishResponse.ok) {
        setNotice((rw ? 'Ikizamini cyabitswe nka draft, ariko nticyatangajwe. ' : 'Assessment saved as a draft, but it could not be published. ') + (typeof publishPayload?.error === 'string' ? publishPayload.error : (rw ? 'Reba uburenganzira bwa konti.' : 'Check your account permissions.')))
      } else {
        setNotice(rw ? 'Ikizamini cyashyizweho kandi kiragaragara ku banyeshuri.' : 'Assessment created and published for learners.')
        setTitle('')
        setInstructions('')
        setGradeLevel('S3')
        setDurationMinutes(30)
        setDraftQuestions([newQuestion()])
        setShowCreator(false)
      }
      await loadAssessments()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create assessment.')
    } finally {
      setSavingDraft(false)
    }
  }

  if (!signedIn) return <section className="panel learning-tip"><span className="tip-icon"><ClipboardList size={20}/></span><div><b>{rw ? 'Injira kugira ngo ukore ibizamini' : 'Sign in to take assessments'}</b><p>{rw ? 'Injira muri konti yawe kugira ngo ukore ibizamini, ubone amanota kandi ukurikirane iterambere ryawe.' : 'Sign in to take quizzes, receive your score and keep your assessment history.'}</p><button className="button button-primary" onClick={onSignIn}>{rw ? 'Injira' : 'Sign in'} <ArrowRight size={15}/></button></div></section>

  if (current) return <section className="panel assessment-take">
    <div className="page-heading"><div><span className="section-kicker">{rw ? 'IKIZAMINI' : 'ASSESSMENT IN PROGRESS'}</span><h2>{current.assessment?.title || (rw ? 'Ikizamini' : 'Assessment')}</h2><p>{current.assessment?.instructions || (rw ? 'Hitamo igisubizo kuri buri kibazo, hanyuma wohereze ibisubizo.' : 'Choose an answer for each question, then submit your work.')}</p></div><span className="page-chip"><Clock3 size={15}/>{current.assessment?.duration_minutes} min</span></div>
    {current.questions.map((q, index) => <fieldset className="assessment-question" key={q.id}><legend>{index + 1}. {q.prompt}</legend><small>{q.points} {rw ? 'amanota' : 'points'}</small>{q.options.map((option, optionIndex) => <label className={'assessment-option ' + (answers[q.id] === optionIndex ? 'selected' : '')} key={optionIndex}><input type="radio" name={q.id} checked={answers[q.id] === optionIndex} onChange={() => setAnswers(previous => ({ ...previous, [q.id]: optionIndex }))}/><span>{option}</span></label>)}</fieldset>)}
    {error && <p className="account-error" role="alert">{error}</p>}<div className="assessment-actions"><button className="button button-secondary" onClick={() => {setCurrent(null);setAnswers({});setError('')}}>{rw ? 'Subira inyuma' : 'Cancel'}</button><button className="button button-primary" onClick={submitAssessment} disabled={submitting}>{submitting ? (rw ? 'Biroherezwa…' : 'Submitting…') : (rw ? 'Ohereza ibisubizo' : 'Submit answers')} <Send size={15}/></button></div>
  </section>

  if (result) return <section className="panel assessment-result"><span className="tip-icon"><CheckCircle2 size={22}/></span><span className="section-kicker">{rw ? 'IBISUBIZO BY’IKIZAMINI' : 'ASSESSMENT RESULTS'}</span><h2>{rw ? 'Wabonye amanota' : 'Your score'}</h2><div className="assessment-score">{result.percentage}<small>%</small></div><p>{result.score} / {result.maxScore} {rw ? 'amanota' : 'points'} · {result.review.filter(item => item.isCorrect).length}/{result.review.length} {rw ? 'byakosowe' : 'correct answers'}</p><div className="assessment-review">{result.review.map(item => <article className="assessment-review-item" key={item.questionId}><b>{item.questionOrder}. {item.prompt}</b><p className={item.isCorrect ? 'assessment-correct' : 'assessment-incorrect'}>{item.isCorrect ? (rw ? 'Igisubizo ni cyo' : 'Correct') : (rw ? 'Igisubizo si cyo' : 'Not correct')} · {rw ? 'Igisubizo nyacyo' : 'Correct answer'}: {item.options[item.correctOption]}</p>{item.explanation && <p>{item.explanation}</p>}</article>)}</div><div className="assessment-actions"><button className="button button-secondary" onClick={() => {setResult(null);void loadAssessments()}}><RotateCcw size={15}/>{rw ? 'Ibindi bizamini' : 'Back to assessments'}</button></div></section>

  return <>
    <div className="page-heading"><div><span className="section-kicker">{rw ? 'IMYITOZO N’IBIZAMINI' : 'PRACTICE & ASSESSMENT'}</span><h2>{rw ? 'Ibizamini n’imyitozo' : 'Quizzes & assessments'}</h2><p>{rw ? 'Kora ibizamini byateguwe n’abarimu, uhite ubona amanota n’ibisobanuro.' : 'Take teacher-published quizzes, get your score and review explanations after submitting.'}</p></div><span className="page-chip"><ClipboardList size={15}/>{assessments.length} {rw ? 'ibizamini' : 'assessments'}</span></div>
    {canManage && <section className="panel assessment-create-panel">
      <div className="section-heading"><div><span className="section-kicker">{rw ? 'IBIKORESHO BY’UMWARIMU' : 'TEACHER TOOLS'}</span><h3>{rw ? 'Tegura ikizamini gishya' : 'Create an assessment'}</h3></div><button type="button" className="button button-secondary" onClick={() => {setShowCreator(value => !value);setError('');setNotice('')}}>{showCreator ? (rw ? 'Funga' : 'Close') : <><Plus size={15}/>{rw ? 'Ikizamini gishya' : 'New assessment'}</>}</button></div>
      {showCreator && <form className="assessment-create-form" onSubmit={createAssessment}>
        <label>{rw ? 'Umutwe w’ikizamini' : 'Assessment title'}<input value={title} onChange={event => setTitle(event.target.value)} minLength={3} maxLength={180} required placeholder={rw ? 'Urugero: Imibare — S3' : 'e.g. Mathematics — S3'} /></label>
        <label>{rw ? 'Amabwiriza' : 'Instructions'}<textarea value={instructions} onChange={event => setInstructions(event.target.value)} maxLength={4000} rows={3} placeholder={rw ? 'Sobanura icyo abanyeshuri bagomba gukora…' : 'Tell learners what they should do…'} /></label>
        <div className="assessment-form-grid">
          <label>{rw ? 'Urwego' : 'Grade / level'}<select value={gradeLevel} onChange={event => setGradeLevel(event.target.value)}>{['P1','P2','P3','P4','P5','P6','S1','S2','S3','S4','S5','S6','TVET Level 1','TVET Level 2','TVET Level 3','TVET Level 4','TVET Level 5'].map(level => <option key={level} value={level}>{level}</option>)}</select></label>
          <label>{rw ? 'Ururimi' : 'Language'}<select value={assessmentLanguage} onChange={event => setAssessmentLanguage(event.target.value as Lang)}><option value="en">English</option><option value="rw">Ikinyarwanda</option></select></label>
          <label>{rw ? 'Iminota' : 'Duration (minutes)'}<input type="number" min={1} max={360} value={durationMinutes} onChange={event => setDurationMinutes(Number(event.target.value))} required /></label>
        </div>
        <div className="assessment-builder-heading"><h4>{rw ? 'Ibibazo' : 'Questions'}</h4><span>{draftQuestions.length}/100</span></div>
        {draftQuestions.map((question, index) => <fieldset className="assessment-question assessment-builder-question" key={index}>
          <legend>{rw ? 'Ikibazo' : 'Question'} {index + 1}</legend>
          <label>{rw ? 'Andika ikibazo' : 'Question prompt'}<textarea value={question.prompt} onChange={event => updateQuestion(index, { prompt: event.target.value })} minLength={3} maxLength={3000} rows={2} required /></label>
          <div className="assessment-builder-options">{question.options.map((option, optionIndex) => <label key={optionIndex}><span>{String.fromCharCode(65 + optionIndex)}.</span><input value={option} onChange={event => updateQuestion(index, { options: question.options.map((item, i) => i === optionIndex ? event.target.value : item) })} maxLength={500} required placeholder={rw ? 'Igisubizo' : 'Answer option'} /></label>)}</div>
          <div className="assessment-form-grid">
            <label>{rw ? 'Igisubizo nyacyo' : 'Correct answer'}<select value={question.correctOption} onChange={event => updateQuestion(index, { correctOption: Number(event.target.value) })}>{question.options.map((_, optionIndex) => <option key={optionIndex} value={optionIndex}>{String.fromCharCode(65 + optionIndex)}</option>)}</select></label>
            <label>{rw ? 'Amanota' : 'Points'}<input type="number" min={1} max={100} value={question.points} onChange={event => updateQuestion(index, { points: Number(event.target.value) })} required /></label>
          </div>
          <label>{rw ? 'Ibisobanuro (si ngombwa)' : 'Explanation (optional)'}<textarea value={question.explanation} onChange={event => updateQuestion(index, { explanation: event.target.value })} maxLength={3000} rows={2} /></label>
          {draftQuestions.length > 1 && <button type="button" className="text-link assessment-remove-question" onClick={() => setDraftQuestions(previous => previous.filter((_, i) => i !== index))}><Trash2 size={14}/>{rw ? 'Siba iki kibazo' : 'Remove question'}</button>}
        </fieldset>)}
        <div className="assessment-actions"><button type="button" className="button button-secondary" disabled={draftQuestions.length >= 100} onClick={() => setDraftQuestions(previous => [...previous, newQuestion()])}><Plus size={15}/>{rw ? 'Ongeraho ikibazo' : 'Add question'}</button><button type="submit" className="button button-primary" disabled={savingDraft}>{savingDraft ? (rw ? 'Birabikwa…' : 'Saving…') : <><Upload size={15}/>{rw ? 'Bika kandi utangaze' : 'Save & publish'}</>}</button></div>
      </form>}
    </section>}
    {notice && <p className="profile-feedback" role="status">{notice}</p>}
    {error && <p className="account-error" role="alert">{error}</p>}
    {loading ? <div className="panel"><p>{rw ? 'Turimo gushaka ibizamini…' : 'Loading assessments…'}</p></div> : assessments.length === 0 ? <div className="panel learning-tip"><span className="tip-icon"><ClipboardList size={20}/></span><div><b>{rw ? 'Nta kizamini cyasohowe kiraboneka' : 'No published assessments yet'}</b><p>{rw ? 'Ibizamini bizagaragara hano igihe abarimu cyangwa ubuyobozi bazaba bamaze kubishyiraho no kubitangaza.' : 'Assessments will appear here after a teacher or school administrator creates and publishes them.'}</p><button className="button button-secondary" onClick={loadAssessments}>{rw ? 'Ongera urebe' : 'Refresh list'} <RotateCcw size={14}/></button></div></div> : <div className="assessment-list">{assessments.map(item => <article className="panel assessment-card" key={item.id}><span className="tip-icon"><ClipboardList size={20}/></span><div className="assessment-card-copy"><span className="resource-tag">{rw ? item.subject_name_rw || item.subject_name || 'Isomo' : item.subject_name || 'Subject'}{item.grade_level ? ' · ' + item.grade_level : ''}</span><h3>{item.title}</h3><p>{item.instructions || (rw ? 'Ikizamini cyo kwisuzuma.' : 'Practice assessment.')}</p><div className="assessment-meta"><span><ClipboardList size={14}/>{item.question_count} {rw ? 'ibibazo' : 'questions'}</span><span><Clock3 size={14}/>{item.duration_minutes} min</span></div></div><button className="button button-primary" onClick={() => startAssessment(item)}>{rw ? 'Tangira' : 'Start'} <ArrowRight size={14}/></button></article>)}</div>}
  </>
}
