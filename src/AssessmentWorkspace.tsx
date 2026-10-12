import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, ClipboardList, Clock3, RotateCcw, Send } from 'lucide-react'

type Lang = 'en' | 'rw'
type Assessment = { id: string; title: string; instructions: string; grade_level: string | null; language: Lang; duration_minutes: number; subject_name: string | null; subject_name_rw: string | null; teacher_name: string; question_count: number }
type Question = { id: string; question_order: number; prompt: string; options: string[]; points: number }
type Review = { questionId: string; questionOrder: number; prompt: string; options: string[]; selectedOption: number | null; correctOption: number; isCorrect: boolean; pointsAwarded: number; points: number; explanation: string }
type AttemptState = { assessment: Assessment; attempt: { id: string; started_at: string }; questions: Question[] }

export default function AssessmentWorkspace({ lang, signedIn, onSignIn }: { lang: Lang; signedIn: boolean; onSignIn: () => void }) {
  const rw = lang === 'rw'
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [current, setCurrent] = useState<AttemptState | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ score: number; maxScore: number; percentage: number; review: Review[] } | null>(null)

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

  useEffect(() => { void loadAssessments() }, [signedIn])

  async function startAssessment(item: Assessment) {
    setError('')
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

  if (!signedIn) return <section className="panel learning-tip"><span className="tip-icon"><ClipboardList size={20}/></span><div><b>{rw ? 'Injira kugira ngo ukore ibizamini' : 'Sign in to take assessments'}</b><p>{rw ? 'Injira muri konti yawe kugira ngo ukore ibizamini, ubone amanota kandi ukurikirane iterambere ryawe.' : 'Sign in to take quizzes, receive your score and keep your assessment history.'}</p><button className="button button-primary" onClick={onSignIn}>{rw ? 'Injira' : 'Sign in'} <ArrowRight size={15}/></button></div></section>

  if (current) return <section className="panel assessment-take">
    <div className="page-heading"><div><span className="section-kicker">{rw ? 'IKIZAMINI' : 'ASSESSMENT IN PROGRESS'}</span><h2>{current.assessment?.title || (rw ? 'Ikizamini' : 'Assessment')}</h2><p>{current.assessment?.instructions || (rw ? 'Hitamo igisubizo kuri buri kibazo, hanyuma wohereze ibisubizo.' : 'Choose an answer for each question, then submit your work.')}</p></div><span className="page-chip"><Clock3 size={15}/>{current.assessment?.duration_minutes} min</span></div>
    {current.questions.map((q, index) => <fieldset className="assessment-question" key={q.id}><legend>{index + 1}. {q.prompt}</legend><small>{q.points} {rw ? 'amanota' : 'points'}</small>{q.options.map((option, optionIndex) => <label className={'assessment-option ' + (answers[q.id] === optionIndex ? 'selected' : '')} key={optionIndex}><input type="radio" name={q.id} checked={answers[q.id] === optionIndex} onChange={() => setAnswers(previous => ({ ...previous, [q.id]: optionIndex }))}/><span>{option}</span></label>)}</fieldset>)}
    {error && <p className="account-error" role="alert">{error}</p>}<div className="assessment-actions"><button className="button button-secondary" onClick={() => {setCurrent(null);setAnswers({});setError('')}}>{rw ? 'Subira inyuma' : 'Cancel'}</button><button className="button button-primary" onClick={submitAssessment} disabled={submitting}>{submitting ? (rw ? 'Biroherezwa…' : 'Submitting…') : (rw ? 'Ohereza ibisubizo' : 'Submit answers')} <Send size={15}/></button></div>
  </section>

  if (result) return <section className="panel assessment-result"><span className="tip-icon"><CheckCircle2 size={22}/></span><span className="section-kicker">{rw ? 'IBISUBIZO BY’IKIZAMINI' : 'ASSESSMENT RESULTS'}</span><h2>{rw ? 'Wabonye amanota' : 'Your score'}</h2><div className="assessment-score">{result.percentage}<small>%</small></div><p>{result.score} / {result.maxScore} {rw ? 'amanota' : 'points'} · {result.review.filter(item => item.isCorrect).length}/{result.review.length} {rw ? 'byakosowe' : 'correct answers'}</p><div className="assessment-review">{result.review.map(item => <article className="assessment-review-item" key={item.questionId}><b>{item.questionOrder}. {item.prompt}</b><p className={item.isCorrect ? 'assessment-correct' : 'assessment-incorrect'}>{item.isCorrect ? (rw ? 'Igisubizo ni cyo' : 'Correct') : (rw ? 'Igisubizo si cyo' : 'Not correct')} · {rw ? 'Igisubizo nyacyo' : 'Correct answer'}: {item.options[item.correctOption]}</p>{item.explanation && <p>{item.explanation}</p>}</article>)}</div><div className="assessment-actions"><button className="button button-secondary" onClick={() => {setResult(null);void loadAssessments()}}><RotateCcw size={15}/>{rw ? 'Ibindi bizamini' : 'Back to assessments'}</button></div></section>

  return <><div className="page-heading"><div><span className="section-kicker">{rw ? 'IMYITOZO N’IBIZAMINI' : 'PRACTICE & ASSESSMENT'}</span><h2>{rw ? 'Ibizamini n’imyitozo' : 'Quizzes & assessments'}</h2><p>{rw ? 'Kora ibizamini byateguwe n’abarimu, uhite ubona amanota n’ibisobanuro.' : 'Take teacher-published quizzes, get your score and review explanations after submitting.'}</p></div><span className="page-chip"><ClipboardList size={15}/>{assessments.length} {rw ? 'ibizamini' : 'assessments'}</span></div>
    {error && <p className="account-error" role="alert">{error}</p>}
    {loading ? <div className="panel"><p>{rw ? 'Turimo gushaka ibizamini…' : 'Loading assessments…'}</p></div> : assessments.length === 0 ? <div className="panel learning-tip"><span className="tip-icon"><ClipboardList size={20}/></span><div><b>{rw ? 'Nta kizamini cyasohowe kiraboneka' : 'No published assessments yet'}</b><p>{rw ? 'Ibizamini bizagaragara hano igihe abarimu cyangwa ubuyobozi bazaba bamaze kubishyiraho no kubitangaza.' : 'Assessments will appear here after a teacher or school administrator creates and publishes them.'}</p><button className="button button-secondary" onClick={loadAssessments}>{rw ? 'Ongera urebe' : 'Refresh list'} <RotateCcw size={14}/></button></div></div> : <div className="assessment-list">{assessments.map(item => <article className="panel assessment-card" key={item.id}><span className="tip-icon"><ClipboardList size={20}/></span><div className="assessment-card-copy"><span className="resource-tag">{rw ? item.subject_name_rw || item.subject_name || 'Isomo' : item.subject_name || 'Subject'}{item.grade_level ? ' · ' + item.grade_level : ''}</span><h3>{item.title}</h3><p>{item.instructions || (rw ? 'Ikizamini cyo kwisuzuma.' : 'Practice assessment.')}</p><div className="assessment-meta"><span><ClipboardList size={14}/>{item.question_count} {rw ? 'ibibazo' : 'questions'}</span><span><Clock3 size={14}/>{item.duration_minutes} min</span></div></div><button className="button button-primary" onClick={() => startAssessment(item)}>{rw ? 'Tangira' : 'Start'} <ArrowRight size={14}/></button></article>)}</div>}</>
}
