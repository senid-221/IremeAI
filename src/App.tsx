import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import AssessmentWorkspace from './AssessmentWorkspace'
import CurriculumWorkspace from './CurriculumWorkspace'
import RoleDashboard from './RoleDashboard'
import {
  ArrowRight, ArrowUpRight, Bell, BookOpen, BookOpenCheck, CalendarDays, Check, ClipboardList,
  ChevronDown, ChevronRight, CircleHelp, Clock3, Languages, LayoutDashboard,
  Lightbulb, Menu, Mic, MoreHorizontal, Play, Plus, Search, Send, Settings2, BrainCircuit,
  ShieldCheck, Target, TrendingUp, Zap
} from 'lucide-react'

type Lang = 'en' | 'rw'
type AccountUser = { id: string; fullName: string; email: string; role: string; preferredLanguage: Lang; gradeLevel?: string | null }
type Conversation = { id: string; title: string; language: Lang; message_count: number; updated_at: string }
type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; created_at: string }
type StudySession = { id: string; title: string; scheduled_for: string | null; duration_minutes: number; status: 'planned' | 'completed' | 'cancelled' }
const copy = {
  en: {
    greeting: 'Good morning', subtitle: 'Ready to make today a great learning day?',
    overview: 'Your learning overview', week: 'This week', progress: 'Learning progress',
    continue: 'Continue learning', seeAll: 'See all', daily: 'Daily learning goal',
    minutes: 'of 60 minutes', subjects: 'Your subjects', recommended: 'Picked for you',
    ask: 'Ask Ireme anything...', welcome: 'Your AI learning companion',
    welcomeSub: 'Personalized support for every question, every subject, every step.',
    start: 'Start learning', explore: 'Explore subjects', streak: 'day streak',
    lessons: 'lessons completed', accuracy: 'quiz accuracy', hours: 'learning hours',
    home: 'Overview', learn: 'My learning', library: 'Study library', progressNav: 'My progress',
    schedule: 'Schedule', exams: 'Exams & quizzes', help: 'Help center', today: 'Today’s plan',
    next: 'Up next', viewPlan: 'View full plan', maths: 'Mathematics', biology: 'Biology',
    english: 'English language', physics: 'Physics', lesson: 'Continue lesson',
    askTitle: 'Let’s figure it out together', askSub: 'Ask a question or choose a prompt to get started.',
    prompt1: 'Explain a difficult topic', prompt2: 'Create a practice quiz', prompt3: 'Help me revise',
    online: 'Ireme AI is ready to help', search: 'Search lessons, subjects, resources…',
  },
  rw: {
    greeting: 'Mwaramutse', subtitle: 'Witeguye kwiga neza uyu munsi?',
    overview: 'Incamake y’imyigire yawe', week: 'Iki cyumweru', progress: 'Iterambere mu myigire',
    continue: 'Komeza kwiga', seeAll: 'Reba byose', daily: 'Intego ya buri munsi',
    minutes: 'kuri iminota 60', subjects: 'Amasomo yawe', recommended: 'Byagufasha kwiga',
    ask: 'Baza Ireme ikibazo...', welcome: 'Umufasha wawe mu myigire',
    welcomeSub: 'Ubufasha bwihariye kuri buri kibazo, isomo n’intambwe utera.',
    start: 'Tangira kwiga', explore: 'Reba amasomo', streak: 'iminsi wikurikiranya',
    lessons: 'amasomo warangije', accuracy: 'amanota y’ibizamini', hours: 'amasaha yo kwiga',
    home: 'Incamake', learn: 'Kwiga kwanjye', library: 'Isomero', progressNav: 'Iterambere',
    schedule: 'Gahunda', exams: 'Ibizamini', help: 'Ubufasha', today: 'Gahunda y’uyu munsi',
    next: 'Isomo rikurikira', viewPlan: 'Reba gahunda yose', maths: 'Imibare', biology: 'Ubugenge bw’ibinyabuzima',
    english: 'Icyongereza', physics: 'Ubugenge', lesson: 'Komeza isomo',
    askTitle: 'Reka tubisobanukirwe hamwe', askSub: 'Baza ikibazo cyangwa uhitemo urugero kugira ngo dutangire.',
    prompt1: 'Sobanura ingingo igoye', prompt2: 'Nkora ikizamini cy’imyitozo', prompt3: 'Mfasha kwisubiramo',
    online: 'Ireme AI yiteguye kugufasha', search: 'Shakisha amasomo, ibikoresho…',
  }
}

const subjects: Array<{name:string;rw:string;category:string;color:string;icon:LucideIcon;progress:number;lessons:string;image:string}> = []

const navItems = [
  { key: 'home', icon: LayoutDashboard }, { key: 'learn', icon: BookOpen },
  { key: 'library', icon: BookOpenCheck }, { key: 'exams', icon: ClipboardList }, { key: 'progressNav', icon: TrendingUp },
  { key: 'schedule', icon: CalendarDays },
] as const

export default function App() {
  const [lang, setLang] = useState<Lang>('en')
  const [active, setActive] = useState('home')
  const [query, setQuery] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [savedResources, setSavedResources] = useState<string[]>([])
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [sessionTitle, setSessionTitle] = useState('')
  const [customSessions, setCustomSessions] = useState<StudySession[]>([])
  const [scheduleError, setScheduleError] = useState('')
  const [user, setUser] = useState<AccountUser | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authName, setAuthName] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileGrade, setProfileGrade] = useState('')
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileFeedback, setProfileFeedback] = useState('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [progressRecords, setProgressRecords] = useState<any[]>([])
  const t = copy[lang]

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(async response => response.ok ? response.json() : null)
      .then(payload => {
        if (!cancelled && payload?.user) {
          setUser(payload.user)
          setLang(payload.user.preferredLanguage === 'rw' ? 'rw' : lang)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!user) {
      setConversations([])
      setProgressRecords([])
      setSavedResources([])
      setCustomSessions([])
      setConversationId(null)
      setChatMessages([])
      return
    }
    let cancelled = false
    Promise.all([
      fetch('/api/conversations', { credentials: 'same-origin' }),
      fetch('/api/progress', { credentials: 'same-origin' }),
      fetch('/api/saved-resources', { credentials: 'same-origin' }),
      fetch('/api/study-sessions', { credentials: 'same-origin' }),
    ]).then(async ([conversationResponse, progressResponse, savedResponse, sessionsResponse]) => {
      const conversationPayload = conversationResponse.ok ? await conversationResponse.json() : { conversations: [] }
      const progressPayload = progressResponse.ok ? await progressResponse.json() : { progress: [] }
      const savedPayload = savedResponse.ok ? await savedResponse.json() : { savedResources: [] }
      const sessionsPayload = sessionsResponse.ok ? await sessionsResponse.json() : { sessions: [] }
      if (!cancelled) {
        setConversations(Array.isArray(conversationPayload.conversations) ? conversationPayload.conversations : [])
        setProgressRecords(Array.isArray(progressPayload.progress) ? progressPayload.progress : [])
        setSavedResources(Array.isArray(savedPayload.savedResources) ? savedPayload.savedResources.map((item: {resource_key:string}) => item.resource_key) : [])
        setCustomSessions(Array.isArray(sessionsPayload.sessions) ? sessionsPayload.sessions : [])
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [user])
  
  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthBusy(true)
    setAuthError('')
    try {
      const response = await fetch('/api/auth/' + authMode, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(authMode === 'register' ? { fullName: authName.trim(), preferredLanguage: lang } : {}),
          email: authEmail.trim(),
          password: authPassword,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.user) {
        setAuthError(typeof payload?.error === 'string' ? payload.error : (lang === 'rw' ? 'Konti ntiyafunguwe. Ongera ugerageze.' : 'Account request failed. Please try again.'))
        return
      }
      setUser(payload.user)
      setAuthPassword('')
      setAuthOpen(false)
      setAuthError('')
    } catch {
      setAuthError(lang === 'rw' ? 'Ntitwashoboye kugera kuri seriveri.' : 'Could not reach the Ireme server.')
    } finally {
      setAuthBusy(false)
    }
  }


  async function saveStudySession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) {
      setAuthMode('login')
      setAuthOpen(true)
      setScheduleError(lang === 'rw' ? 'Injira kugira ngo ubike gahunda yawe.' : 'Sign in to save your study schedule.')
      return
    }
    const title = sessionTitle.trim()
    if (!title) return
    setScheduleError('')
    try {
      const response = await fetch('/api/study-sessions', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, durationMinutes: 45 }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.session) throw new Error(payload?.error || 'Could not save your study session.')
      setCustomSessions(previous => [...previous, payload.session])
      setSessionTitle('')
      setShowSessionForm(false)
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : 'Could not save your study session.')
    }
  }

  async function removeStudySession(id: string) {
    setScheduleError('')
    try {
      const response = await fetch('/api/study-sessions/' + encodeURIComponent(id), { method: 'DELETE', credentials: 'same-origin' })
      if (!response.ok && response.status !== 204) throw new Error('Could not remove this study session.')
      setCustomSessions(previous => previous.filter(item => item.id !== id))
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : 'Could not remove this study session.')
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    setProfileBusy(true)
    setProfileFeedback('')
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: profileName.trim(), gradeLevel: profileGrade.trim(), preferredLanguage: lang }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.user) throw new Error(payload?.error || 'Could not save your profile.')
      setUser(payload.user)
      setProfileFeedback(lang === 'rw' ? 'Amakuru yawe yabitswe neza.' : 'Your profile has been saved.')
    } catch (error) {
      setProfileFeedback(error instanceof Error ? error.message : 'Could not save your profile.')
    } finally { setProfileBusy(false) }
  }

  async function signOut() {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }) } catch {}
    setUser(null)
    setAuthOpen(false)
    setAnswer('')
    setConversationId(null)
    setChatMessages([])
  }

  async function openConversation(id: string) {
    try {
      const response = await fetch('/api/conversations/' + encodeURIComponent(id) + '/messages', { credentials: 'same-origin' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'Could not load conversation.')
      setConversationId(id)
      setChatMessages(Array.isArray(payload.messages) ? payload.messages : [])
      const lastAssistant = [...(payload.messages || [])].reverse().find((message: ChatMessage) => message.role === 'assistant')
      setAnswer(lastAssistant?.content || '')
      setHistoryOpen(false)
      setActive('home')
      document.getElementById('ask-ireme')?.focus()
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not load conversation.')
      setAuthOpen(true)
    }
  }
  const localizedSubjects = useMemo(() => subjects.map(s => ({ ...s, displayName: lang === 'rw' ? s.rw : s.name })).filter(s => s.displayName.toLowerCase().includes(query.toLowerCase())), [lang, query])

  async function askAI(value = question) {
    const q = value.trim()
    if (!q || isAsking) return
    setQuestion(q)
    setAnswer('')
    setIsAsking(true)
    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, language: lang, ...(user && conversationId ? { conversationId } : {}) }),
      })
      const contentType = response.headers.get('content-type') || ''
      const payload = contentType.includes('application/json')
        ? await response.json().catch(() => ({}))
        : {}
      if (!response.ok) {
        const message = typeof payload?.error === 'string'
          ? payload.error
          : response.status === 404
            ? (lang === 'rw'
                ? 'Seriveri ya Ireme API ntibonetse (404). Ongera ushyireho deployment ya Node.js ukoresheje npm start.'
                : 'Ireme API route was not found (404). Redeploy the Node.js app with the npm start command.')
            : response.status >= 500
              ? (lang === 'rw'
                  ? 'Seriveri ya Ireme yahuye n’ikibazo. Reba application logs za Hostinger.'
                  : 'The Ireme server returned an error. Check the Hostinger application logs.')
              : (lang === 'rw' ? 'Ireme AI ntishoboye gusubiza ubu. Ongera ugerageze.' : 'Ireme AI could not answer right now. Please try again.')
        setAnswer(lang === 'rw' && payload?.code === 'AI_NOT_CONFIGURED' ? 'Serivisi ya AI ntirashyirwaho. Shyira OPENAI_API_KEY mu mabanga ya server kugira ngo utangire.' : message)
        return
      }
      if (!contentType.includes('application/json')) {
        setAnswer(lang === 'rw'
          ? 'Seriveri yasubije page aho gusubiza JSON ya API. Reba ko Node.js backend ikora kandi ko npm start ikoresha server.js.'
          : 'The server returned a webpage instead of API JSON. Check that the Node.js backend is running and npm start launches server.js.')
        return
      }
      setAnswer(typeof payload?.answer === 'string' ? payload.answer : (lang === 'rw' ? 'Nta gisubizo cyabonetse. Ongera ugerageze.' : 'No answer was returned. Please try again.'))
      if (typeof payload?.conversationId === 'string') setConversationId(payload.conversationId)
      if (user) {
        const [historyResponse, progressResponse] = await Promise.all([fetch('/api/conversations', { credentials: 'same-origin' }), fetch('/api/progress', { credentials: 'same-origin' })])
        const historyPayload = historyResponse.ok ? await historyResponse.json() : { conversations: [] }
        const progressPayload = progressResponse.ok ? await progressResponse.json() : { progress: [] }
        setConversations(Array.isArray(historyPayload.conversations) ? historyPayload.conversations : [])
        setProgressRecords(Array.isArray(progressPayload.progress) ? progressPayload.progress : [])
      }
    } catch {
      setAnswer(lang === 'rw' ? 'Ntabwo twabashije kugera kuri serivisi ya AI. Reba ko server ikora, hanyuma wongere ugerageze.' : 'Could not reach the AI service. Check that the Ireme server is running, then try again.')
    } finally {
      setIsAsking(false)
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#" aria-label="Ireme AI home">
          <span className="brand-mark" aria-hidden="true"><img src="/ireme-mark.svg" alt="" /></span>
          <span className="brand-copy"><strong>Ireme<span>AI</span></strong><small>LEARN WITHOUT LIMITS</small></span>
        </a>
        <div className="school-chip"><span className="school-avatar"><BookOpen size={17}/></span><span><b>{user?.fullName || (lang === 'rw' ? 'Umwanya w’umunyeshuri' : 'Student workspace')}</b><small>{user?.gradeLevel || (lang === 'rw' ? 'Ireme AI' : 'Ireme AI')}</small></span></div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav">
          {navItems.map(({key, icon: Icon}) => <button key={key} className={`nav-item ${active === key ? 'active' : ''}`} onClick={() => {setActive(key); setMenuOpen(false)}}><Icon size={18}/><span>{t[key]}</span>{key === 'progressNav' && <span className="nav-dot"/>}</button>)}
          {user && ['teacher','school_admin','platform_admin'].includes(user.role) && <button className={`nav-item ${active === 'roleDashboard' ? 'active' : ''}`} onClick={() => {setActive('roleDashboard');setMenuOpen(false)}}><LayoutDashboard size={18}/><span>{user.role === 'teacher' ? (lang === 'rw' ? 'Umwarimu' : 'Teacher dashboard') : (lang === 'rw' ? 'Ubuyobozi' : 'Admin dashboard')}</span></button>}
        </nav>
        
        <div className="nav-label bottom-label">SUPPORT</div>
        <button className="nav-item" onClick={() => setActive('help')}><CircleHelp size={18}/><span>{t.help}</span></button>
        <button className={'nav-item ' + (active === 'settings' ? 'active' : '')} onClick={() => {setActive('settings');setMenuOpen(false);setProfileFeedback('');if(user){setProfileName(user.fullName);setProfileGrade(user.gradeLevel || '')}else{setAuthOpen(true);setAuthMode('login')}}}><Settings2 size={18}/><span>{lang === 'rw' ? 'Igenamiterere' : 'Settings'}</span></button>
        <div className="profile-mini"><span className="school-avatar"><Settings2 size={17}/></span><span><b>{user?.fullName || (lang === "rw" ? "Umushyitsi" : "Guest")}</b><small>{user?.gradeLevel || (lang === "rw" ? "Injira kugira ngo ubike amakuru" : "Sign in to save your learning")}</small></span><MoreHorizontal size={18}/></div>
      </aside>
      {menuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)}/>}
      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu size={21}/></button>
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14}/><b>{t[active as keyof typeof t] || 'Help center'}</b></div>
          <div className="top-actions">
            <label className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t.search}/></label>
            <button className="language-switch" onClick={() => setLang(lang === 'en' ? 'rw' : 'en')}><Languages size={16}/>{lang === 'en' ? 'EN' : 'RW'}<ChevronDown size={13}/></button>
            <button className="icon-button notification" aria-label="Notifications"><Bell size={19}/><i/></button>
            {user ? <button className="account-button" onClick={() => {setActive('settings');setProfileName(user.fullName);setProfileGrade(user.gradeLevel || '');setProfileFeedback('')}} title={lang === 'rw' ? 'Igenamiterere rya konti' : 'Account settings'}><span className="account-avatar">{user.fullName.slice(0,1).toUpperCase()}</span><span className="account-name">{user.fullName.split(' ')[0]}</span><span className="account-logout">{lang === 'rw' ? 'Sohoka' : 'Sign out'}</span></button> : <button className="account-button" onClick={() => {setAuthOpen(v => !v);setAuthError('')}}><span className="account-avatar"><ShieldCheck size={16}/></span><span className="account-name">{lang === 'rw' ? 'Injira' : 'Sign in'}</span></button>}
          </div>
        </header>
        {authOpen && <section className="account-panel" aria-label={lang === 'rw' ? 'Konti' : 'Account'}><div className="account-panel-heading"><div><span className="section-kicker">IREME AI ACCOUNT</span><h3>{authMode === 'login' ? (lang === 'rw' ? 'Injira muri konti yawe' : 'Welcome back') : (lang === 'rw' ? 'Fungura konti y’umunyeshuri' : 'Create your student account')}</h3><p>{lang === 'rw' ? 'Bika ibiganiro byawe n’iterambere mu myigire.' : 'Save your tutor conversations and learning progress.'}</p></div><button className="tiny-more" onClick={() => setAuthOpen(false)} aria-label="Close account panel"><Plus size={18} style={{transform:'rotate(45deg)'}}/></button></div><form className="account-form" onSubmit={submitAuth}>{authMode === 'register' && <label>{lang === 'rw' ? 'Amazina yawe' : 'Full name'}<input value={authName} onChange={e=>setAuthName(e.target.value)} minLength={2} maxLength={160} autoComplete="name" required/></label>}<label>Email<input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} autoComplete="email" maxLength={254} required/></label><label>{lang === 'rw' ? 'Ijambo ry’ibanga' : 'Password'}<input type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} minLength={authMode === 'register' ? 10 : 1} maxLength={72} autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} required/><small>{authMode === 'register' ? (lang === 'rw' ? 'Nibura inyuguti 10.' : 'At least 10 characters.') : (lang === 'rw' ? 'Andika ijambo ry’ibanga ryawe.' : 'Enter your account password.')}</small></label>{authError && <p className="account-error" role="alert">{authError}</p>}<button className="button button-primary" type="submit" disabled={authBusy}>{authBusy ? (lang === 'rw' ? 'Tegereza…' : 'Please wait…') : authMode === 'login' ? (lang === 'rw' ? 'Injira' : 'Sign in') : (lang === 'rw' ? 'Fungura konti' : 'Create account')} <ArrowRight size={15}/></button></form><p className="account-switch">{authMode === 'login' ? (lang === 'rw' ? 'Nta konti ufite?' : 'New to Ireme AI?') : (lang === 'rw' ? 'Usanzwe ufite konti?' : 'Already have an account?')} <button onClick={() => {setAuthMode(authMode === 'login' ? 'register' : 'login');setAuthError('')}}>{authMode === 'login' ? (lang === 'rw' ? 'Fungura konti' : 'Create account') : (lang === 'rw' ? 'Injira' : 'Sign in')}</button></p></section>}
        <div className="content-wrap" data-active={active}>
          <motion.section className="welcome-row" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.45}}>
            <div><div className="eyebrow"><span className="eyebrow-line"/> YOUR PERSONAL LEARNING SPACE</div><h1>{t.greeting}</h1><p>{t.subtitle}</p></div>
            <button className="date-pill"><CalendarDays size={16}/> Monday, 12 October <ChevronDown size={14}/></button>
          </motion.section>

          <motion.section className="hero-banner" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:.08,duration:.5}}>
            <div className="hero-copy"><div className="hero-pill"><BrainCircuit size={13}/> YOUR AI STUDY PARTNER</div><h2>{t.welcome}</h2><p>{t.welcomeSub}</p><div className="hero-actions"><button className="button button-white" onClick={() => document.getElementById('ask-ireme')?.focus()}>{t.start}<ArrowRight size={16}/></button><button className="button button-glass" onClick={() => {setActive('learn');window.scrollTo({top:0,behavior:'smooth'})}}><Play size={15} fill="currentColor"/> {t.explore}</button></div><div className="hero-trust"><span><ShieldCheck size={14}/> Curriculum-aware</span><span><Zap size={14}/> Personalized learning</span></div></div>
            <div className="hero-art brand-hero-art" aria-label="Ireme AI learning"><img className="hero-brand-logo" src="/ireme-logo.svg" alt="Ireme — Inclusive Education for a Brighter Tomorrow" /></div>
          </motion.section>

          <section className="stats-grid">
            {[{label:lang === 'rw' ? 'Ibikoresho wabikije' : 'Saved resources',value:String(savedResources.length),unit:lang === 'rw' ? 'ibikoresho' : 'resources',icon:BookOpenCheck,style:'stat-purple'},{label:lang === 'rw' ? 'Amasomo warangije' : 'Lessons completed',value:String(progressRecords.filter(record => Number(record.progress_percent) >= 100).length),unit:lang === 'rw' ? 'amasomo' : 'lessons',icon:Check,style:'stat-green'},{label:lang === 'rw' ? 'Ibiganiro' : 'AI conversations',value:String(conversations.length),unit:lang === 'rw' ? 'ibiganiro' : 'chats',icon:Mic,style:'stat-orange'},{label:lang === 'rw' ? 'Gahunda zo kwiga' : 'Study sessions',value:String(customSessions.length),unit:lang === 'rw' ? 'gahunda' : 'sessions',icon:CalendarDays,style:'stat-blue'}].map((s,i)=><motion.div className={`stat-card ${s.style}`} key={s.label} initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay:.1+i*.06}}><div className="stat-icon"><s.icon size={19}/></div><span className="stat-label">{s.label}</span><div className="stat-number">{s.value}<small>{s.unit}</small></div></motion.div>)}
          </section>

          <div className="dashboard-grid">
            <section className="panel subjects-panel">
              <div className="section-heading"><div><span className="section-kicker">KEEP THE MOMENTUM</span><h3>{t.subjects}</h3></div><button className="text-link" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show less' : t.seeAll}<ArrowRight size={15}/></button></div>
              <div className="subject-list">{(localizedSubjects).map(s=><motion.article className="subject-card" key={s.name} whileHover={{y:-3}} transition={{duration:.2}}><div className={`subject-art ${s.color}`}><img src={s.image} alt="" loading="lazy"/><span className="subject-symbol" aria-hidden="true"><s.icon size={22} strokeWidth={2} /></span><span className="subject-category">{s.category}</span></div><div className="subject-info"><div className="subject-title-row"><h4>{s.displayName}</h4><button className="tiny-more" aria-label={`More about ${s.displayName}`}><MoreHorizontal size={17}/></button></div><p>{s.lessons}</p><div className="progress-track"><span style={{width:`${s.progress}%`}}/></div><div className="progress-foot"><span>{s.progress}% complete</span><button onClick={() => {setQuestion(lang==='rw' ? 'Mfasha kwiga '+s.rw : 'Help me study '+s.name); document.getElementById('ask-ireme')?.focus()}}>{t.lesson}<ArrowUpRight size={14}/></button></div></div></motion.article>)}</div>
            </section>

            <section className="panel progress-panel">
              <div className="section-heading"><div><span className="section-kicker">YOUR ACHIEVEMENTS</span><h3>{t.progress}</h3></div><button className="tiny-more"><MoreHorizontal size={18}/></button></div>
              <div className="progress-summary"><div className="ring-chart"><svg viewBox="0 0 120 120"><circle className="ring-bg" cx="60" cy="60" r="49"/><circle className="ring-value" cx="60" cy="60" r="49"/></svg><div><b>74<span>%</span></b><small>overall</small></div></div><div className="summary-copy"><b>You're on the right track!</b><p>You've learned more than last week. Keep your streak going.</p><span><TrendingUp size={14}/> +12% this month</span></div></div>
              <div className="chart-head"><b>Weekly activity</b><span>{t.week}<ChevronDown size={13}/></span></div><div className="bar-chart">{[{d:'M',v:42},{d:'T',v:66},{d:'W',v:50},{d:'T',v:86},{d:'F',v:58},{d:'S',v:100},{d:'S',v:32}].map((b,i)=><div className="bar-column" key={i}><div className={`bar ${i===5?'bar-active':''}`} style={{height:`${b.v}%`}}/><span>{b.d}</span></div>)}</div>
            </section>
          </div>

          <div className="lower-grid">
            <section className="panel ask-panel" id="ask-panel">
              <div className="ask-heading"><div className="ask-logo" aria-hidden="true"><BrainCircuit size={23} strokeWidth={1.8}/></div><div><h3>{t.askTitle}</h3><p>{t.askSub}</p></div><span className="online-badge"><i/>{t.online}</span></div>
              <div className="suggestion-row">{[t.prompt1,t.prompt2,t.prompt3].map((p,i)=><button key={p} onClick={() => {setQuestion(p);document.getElementById('ask-ireme')?.focus()}}><span>{[<Lightbulb size={15}/>,<Target size={15}/>,<BookOpen size={15}/>][i]}</span>{p}<ArrowUpRight size={13}/></button>)}</div>
              {(answer || isAsking) && <AnimatePresence><motion.div className="answer-box" initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}}><div className="answer-avatar" aria-hidden="true"><BrainCircuit size={17} strokeWidth={1.8}/></div><p>{isAsking ? (lang === 'rw' ? 'Tegereza gato, ndimo gutegura igisubizo…' : 'One moment, I’m preparing your answer…') : answer}</p></motion.div></AnimatePresence>}
              <form className="ask-input" onSubmit={e => {e.preventDefault();askAI()}}><button type="button" className="attach-button" aria-label="Add attachment"><Plus size={19}/></button><input id="ask-ireme" value={question} onChange={e=>setQuestion(e.target.value)} placeholder={t.ask}/><button type="button" className="mic-button" aria-label="Voice input"><Mic size={18}/></button><button className="send-button" type="submit" aria-label="Send question" disabled={isAsking}><Send size={17}/></button></form><div className="privacy-note"><ShieldCheck size={13}/> {lang === 'rw' ? 'Ibiganiro byawe bibikwa mu mutekano iyo winjiye muri konti.' : 'Your conversations are saved securely when you sign in.'}</div>
              {user && <div className="conversation-history"><div className="history-heading"><b>{lang === 'rw' ? 'Ibiganiro wabanje' : 'Saved conversations'}</b><button className="text-link" onClick={() => setHistoryOpen(v => !v)}>{historyOpen ? (lang === 'rw' ? 'Hisha' : 'Hide') : (lang === 'rw' ? 'Reba byose' : 'View history')} <ChevronDown size={13}/></button><button className="text-link" onClick={() => {setConversationId(null);setChatMessages([]);setAnswer('');setQuestion('')}}>{lang === 'rw' ? 'Ikiganiro gishya' : 'New chat'} <Plus size={13}/></button></div>
              {historyOpen && <div className="history-list">{conversations.length === 0 ? <p className="history-empty">{lang === 'rw' ? 'Nta kiganiro kirabikwa.' : 'Your saved conversations will appear here.'}</p> : conversations.map(item => <button className={`history-item ${conversationId === item.id ? 'selected' : ''}`} key={item.id} onClick={() => openConversation(item.id)}><span><b>{item.title || (lang === 'rw' ? 'Ikiganiro gishya' : 'New conversation')}</b><small>{item.message_count} {lang === 'rw' ? 'ubutumwa' : 'messages'} · {new Date(item.updated_at).toLocaleDateString(lang === 'rw' ? 'rw-RW' : 'en-GB')}</small></span><ChevronRight size={15}/></button>)}</div>}</div>}
              {user && chatMessages.length > 0 && <div className="chat-transcript" aria-label={lang === 'rw' ? 'Ubutumwa bw’ikiganiro' : 'Conversation messages'}>{chatMessages.map(message => <div className={`transcript-message ${message.role === 'user' ? 'from-user' : 'from-ai'}`} key={message.id}><b>{message.role === 'user' ? (lang === 'rw' ? 'Wowe' : 'You') : 'Ireme AI'}</b><p>{message.content}</p></div>)}</div>}
            </section>
            <section className="panel today-panel"><div className="section-heading"><div><span className="section-kicker">STAY ORGANIZED</span><h3>{t.today}</h3></div><button className="text-link" onClick={() => setActive('schedule')}>{t.viewPlan}<ArrowRight size={15}/></button></div><div className="timeline"><div className="timeline-item done"><span className="timeline-dot"><Check size={12}/></span><div><small>08:30 – 09:15 AM</small><b>Algebra: Linear equations</b><span className="task-tag completed-tag">Completed</span></div></div><div className="timeline-item current"><span className="timeline-dot"><Play size={11} fill="currentColor"/></span><div><small>10:00 – 10:45 AM</small><b>Cell biology &amp; genetics</b><span className="task-tag current-tag">In progress</span></div></div><div className="timeline-item"><span className="timeline-dot"><Clock3 size={12}/></span><div><small>02:00 – 02:30 PM</small><b>English: Essay writing</b><span className="task-tag">Upcoming</span></div></div></div><button className="add-task" onClick={() => setActive('schedule')}><Plus size={16}/> Add study session</button></section>
          </div>

          {active !== 'home' && <motion.section className="workspace-page" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:.25}}>
            {active === 'roleDashboard' && user && ['teacher','school_admin','platform_admin'].includes(user.role) && <RoleDashboard lang={lang} role={user.role} />}
            {active === 'exams' && <AssessmentWorkspace lang={lang} signedIn={Boolean(user)} onSignIn={() => { setAuthMode('login'); setAuthOpen(true); setAuthError('') }} />}
            {active === 'learn' && <CurriculumWorkspace lang={lang} />}
            {active === 'library' && <><div className="page-heading"><div><span className="section-kicker">{lang === 'rw' ? 'IBIKORESHO BYO KWIGA' : 'RWANDA OFFICIAL LEARNING RESOURCES'}</span><h2>{lang === 'rw' ? 'Isomero ry’amasomo' : 'Study library'}</h2><p>{lang === 'rw' ? 'Amasomo, ibitabo, integanyanyigisho n’amabwiriza ava ku mbuga zemewe za REB na NESA.' : 'Curriculum, textbooks, assessment guides and learning materials from official REB and NESA sources.'}</p></div><span className="page-chip"><BookOpenCheck size={15}/> {savedResources.length} saved</span></div><div className="resource-grid">
<article className="panel learning-tip"><img className="resource-photo" src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=720&q=80" alt="REB E-Learning: Textbooks and lessons" loading="lazy" referrerPolicy="no-referrer"/><span className="tip-icon"><BookOpen size={20}/></span><div><b>{lang === 'rw' ? 'REB E-Learning: Ibitabo n’amasomo' : 'REB E-Learning: Textbooks and lessons'}</b><p>{lang === 'rw' ? 'Ibitabo n’ibikoresho by’amashuri abanza n’ayisumbuye.' : 'Textbooks and learning materials for primary and secondary school.'}</p><a href="https://elearning.reb.rw/" target="_blank" rel="noreferrer">{lang === 'rw' ? 'Fungura REB E-Learning' : 'Open REB E-Learning'} <ArrowUpRight size={14}/></a></div></article>
<article className="panel learning-tip"><img className="resource-photo" src="https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=720&q=80" alt="REB curriculum and teaching resources" loading="lazy" referrerPolicy="no-referrer"/><span className="tip-icon"><BookOpenCheck size={20}/></span><div><b>{lang === 'rw' ? 'Integanyanyigisho za REB' : 'REB curriculum and teaching resources'}</b><p>{lang === 'rw' ? 'Integanyanyigisho, ibitabo, n’imfashanyigisho z’abarimu.' : 'Competence-based curricula, textbooks and teacher guides.'}</p><a href="https://www.reb.gov.rw/curriculum-teaching-learning-resources-department" target="_blank" rel="noreferrer">{lang === 'rw' ? 'Reba ibikoresho bya REB' : 'Browse REB resources'} <ArrowUpRight size={14}/></a></div></article>
<article className="panel learning-tip"><img className="resource-photo" src="https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=720&q=80" alt="NESA: Assessment and examinations" loading="lazy" referrerPolicy="no-referrer"/><span className="tip-icon"><Target size={20}/></span><div><b>{lang === 'rw' ? 'NESA: Isuzuma n’ibizamini' : 'NESA: Assessment and examinations'}</b><p>{lang === 'rw' ? 'Ibipimo by’isuzuma, amabwiriza y’ibizamini n’ibibazo by’icyitegererezo.' : 'Assessment standards, exam guidance and official model questions.'}</p><a href="https://www.nesa.gov.rw/1/resources" target="_blank" rel="noreferrer">{lang === 'rw' ? 'Fungura ibikoresho bya NESA' : 'Browse NESA resources'} <ArrowUpRight size={14}/></a></div></article>
<article className="panel learning-tip"><img className="resource-photo" src="https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=720&q=80" alt="NESA timetables and notices" loading="lazy" referrerPolicy="no-referrer"/><span className="tip-icon"><CalendarDays size={20}/></span><div><b>{lang === 'rw' ? 'Ingengabihe ya NESA' : 'NESA timetables and notices'}</b><p>{lang === 'rw' ? 'Emeza ingengabihe n’amatangazo by’umwaka w’amashuri uriho ku rubuga rwemewe.' : 'Verify the current school-year timetable and notices on the official website.'}</p><a href="https://www.nesa.gov.rw/" target="_blank" rel="noreferrer">{lang === 'rw' ? 'Fungura NESA' : 'Visit NESA'} <ArrowUpRight size={14}/></a></div></article>
<article className="panel learning-tip"><img className="resource-photo" src="https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=720&q=80" alt="TVET: Technical and vocational courses" loading="lazy" referrerPolicy="no-referrer"/><span className="tip-icon"><Settings2 size={20}/></span><div><b>{lang === 'rw' ? 'TVET: Amasomo y’imyuga n’ubumenyi ngiro' : 'TVET: Technical and vocational courses'}</b><p>{lang === 'rw' ? 'Reba amasomo n’amamoduli kuva kuri Level 1 kugeza kuri Level 5, harimo ICT, ubwubatsi, ingufu, ubukerarugendo n’ubukorikori.' : 'Explore Level 1–5 modules in ICT, construction, energy, hospitality, agriculture, manufacturing and creative trades.'}</p><a href="https://tvetmanagement.rtb.gov.rw/curricula" target="_blank" rel="noreferrer">{lang === 'rw' ? 'Reba amasomo ya TVET' : 'Browse TVET curricula'} <ArrowUpRight size={14}/></a></div></article>
<article className="panel learning-tip"><img className="resource-photo" src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=720&q=80" alt="TVET E-Learning courses" loading="lazy" referrerPolicy="no-referrer"/><span className="tip-icon"><BookOpen size={20}/></span><div><b>{lang === 'rw' ? 'TVET E-Learning' : 'TVET E-Learning courses'}</b><p>{lang === 'rw' ? 'Amasomo y’imyuga arimo computer applications, computer systems, graphic art, multimedia, welding, solar energy n’andi.' : 'Vocational courses include computer applications, computer systems, graphic art, multimedia, welding, solar energy and more.'}</p><a href="https://www.elearning.rtb.gov.rw/course/index.php?categoryid=4" target="_blank" rel="noreferrer">{lang === 'rw' ? 'Shakisha amasomo ya TVET' : 'Explore TVET courses'} <ArrowUpRight size={14}/></a></div></article>
<article className="panel learning-tip"><img className="resource-photo" src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=720&q=80" alt="IT, coding and computer science" loading="lazy" referrerPolicy="no-referrer"/><span className="tip-icon"><BrainCircuit size={20}/></span><div><b>{lang === 'rw' ? 'IT, Coding na Computer Science' : 'IT, coding and computer science'}</b><p>{lang === 'rw' ? 'Kwiga programming, computer systems, software, networks, cybersecurity, data na digital skills. Urutonde rw’amasomo ruterwa n’urwego n’ikigo.' : 'Learn programming, computer systems, software, networks, cybersecurity, data and digital skills; exact modules depend on level and institution.'}</p><a href="https://www.rtb.gov.rw/" target="_blank" rel="noreferrer">{lang === 'rw' ? 'Reba ibikoresho bya RTB' : 'Explore RTB resources'} <ArrowUpRight size={14}/></a></div></article>
<article className="panel learning-tip"><img className="resource-photo" src="https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=720&q=80" alt="Arts, music and creative skills" loading="lazy" referrerPolicy="no-referrer"/><span className="tip-icon"><Target size={20}/></span><div><b>{lang === 'rw' ? 'Arts, Music na Creative Skills' : 'Arts, music and creative skills'}</b><p>{lang === 'rw' ? 'Fine art, graphic art, fashion design, multimedia production, music, performing arts n’ubundi bukorikori.' : 'Fine art, graphic art, fashion design, multimedia production, music, performing arts and other creative trades.'}</p><a href="https://www.rtb.gov.rw/" target="_blank" rel="noreferrer">{lang === 'rw' ? 'Reba amasomo y’ubukorikori' : 'Explore creative courses'} <ArrowUpRight size={14}/></a></div></article>
</div><p className="demo-disclaimer"><ShieldCheck size={14}/> {lang === 'rw' ? 'Ireme AI igomba gutandukanya amakuru yemejwe n’amakuru ataragenzurwa. Ibi bitabo n’inyandiko biboneka ku mbuga z’ababifitiye uburenganzira.' : 'Ireme AI must distinguish verified official information from unverified content. Materials remain hosted by their official publishers.'}</p></>}
            {active === 'progressNav' && <><div className="page-heading"><div><span className="section-kicker">{lang === 'rw' ? 'ITERAMBERE RYAWE' : 'YOUR ACHIEVEMENTS'}</span><h2>{lang === 'rw' ? 'Iterambere mu myigire' : 'Learning progress'}</h2><p>{lang === 'rw' ? 'Reba ibyo umaze kugeraho n’aho wakongera imbaraga.' : 'See what is going well and where a little more practice could help.'}</p></div><span className="page-chip"><TrendingUp size={15}/> +12% this month</span></div><div className="progress-detail-grid"><div className="panel progress-detail"><span className="section-kicker">OVERALL MASTERY</span><div className="large-progress-number">{progressRecords.length ? Math.round(progressRecords.reduce((sum, record) => sum + Number(record.progress_percent || 0), 0) / progressRecords.length) : 0}<small>%</small></div><div className="progress-track"><span style={{width:`${progressRecords.length ? Math.round(progressRecords.reduce((sum, record) => sum + Number(record.progress_percent || 0), 0) / progressRecords.length) : 0}%`}}/></div><p>{progressRecords.length ? (lang === 'rw' ? 'Impuzandengo y’iterambere ibitswe kuri konti yawe.' : 'Average progress across your saved learning records.') : (lang === 'rw' ? 'Tangira kwiga kandi ubike iterambere ryawe winjiye muri konti.' : 'Sign in and start saving progress to see your real learning data here.')}</p></div><div className="panel progress-detail"><span className="section-kicker">LESSONS COMPLETED</span><div className="large-progress-number">{progressRecords.filter(record => Number(record.progress_percent) >= 100).length}<small> {lang === 'rw' ? 'amasomo arangiye' : 'completed'}</small></div><p>{lang === 'rw' ? 'Amasomo agaragazwa nk’arangiye iyo iterambere rigeze kuri 100%.' : 'A learning record counts as complete when progress reaches 100%.'}</p><span className="insight-line"><TrendingUp size={16}/> Consistency builds confidence.</span></div><div className="panel progress-detail"><span className="section-kicker">SAVED RESOURCES</span><div className="large-progress-number">{progressRecords.length}<small> {lang === 'rw' ? 'ibipimo' : 'records'}</small></div><p>{lang === 'rw' ? 'Umubare w’amasomo n’ibikoresho ufite amakuru y’iterambere yabitswe' : 'Saved subject and resource progress records linked to your account.'}</p><button className="text-link" onClick={() => setActive('library')}>Open study library <ArrowRight size={14}/></button></div></div><div className="panel learning-tip"><span className="tip-icon"><Target size={20}/></span><div><b>Suggested next step</b><p>Review one topic with progress below 60%, then answer a few practice questions to check your understanding.</p><button className="button button-primary" onClick={() => {setActive('learn');setShowAll(true)}}>Choose a subject <ArrowRight size={14}/></button></div></div></>}
            {active === 'schedule' && <><div className="page-heading"><div><span className="section-kicker">{lang === 'rw' ? 'GUTEGURA IGIHE' : 'MAKE TIME TO LEARN'}</span><h2>{lang === 'rw' ? 'Gahunda yo kwiga' : 'Study schedule'}</h2><p>{lang === 'rw' ? 'Tegura igihe gito cyo kwiga buri munsi.' : 'Plan focused study sessions that fit your day.'}</p></div><button className="button button-primary" onClick={() => setShowSessionForm(v => !v)}><Plus size={15}/> {lang === 'rw' ? 'Ongeraho isomo' : 'Add session'}</button></div>{showSessionForm && <form className="session-form" onSubmit={saveStudySession}><label htmlFor="session-title">{lang === 'rw' ? 'Izina ry’isomo' : 'Study session title'}</label><input id="session-title" value={sessionTitle} onChange={e => setSessionTitle(e.target.value)} maxLength={160} placeholder={lang === 'rw' ? 'Urugero: Gusubiramo imibare' : 'e.g. Revise algebra'} required/><button className="button button-primary" type="submit"><Check size={15}/> {lang === 'rw' ? 'Bika gahunda' : 'Save session'}</button></form>}{scheduleError && <p className="account-error" role="alert">{scheduleError}</p>}<div className="panel schedule-detail"><div className="schedule-date"><CalendarDays size={19}/><div><b>{lang === 'rw' ? 'Gahunda yanjye yo kwiga' : 'My study plan'}</b><small>{user ? (lang === 'rw' ? 'Ibikwa kuri konti yawe' : 'Saved to your account') : (lang === 'rw' ? 'Injira kugira ngo ubike gahunda' : 'Sign in to save your schedule')}</small></div></div>{customSessions.length === 0 ? <p className="history-empty">{lang === 'rw' ? 'Nta gahunda wabitse. Ongeraho isomo ryo kwiga.' : 'No saved sessions yet. Add a session to build your study plan.'}</p> : customSessions.map(item => <div className="schedule-row" key={item.id}><span className={'schedule-status status-' + (item.status === 'completed' ? 'done' : 'next')}>{item.status === 'completed' ? <Check size={14}/> : <Clock3 size={14}/>}</span><div><b>{item.title}</b><small>{item.scheduled_for ? new Date(item.scheduled_for).toLocaleString() : (lang === 'rw' ? 'Igihe uzahitamo' : 'Time to be decided')} · {item.duration_minutes} min</small></div><span className="task-tag">{item.status}</span><button className="tiny-more" type="button" aria-label={lang === 'rw' ? 'Siba gahunda' : 'Delete session'} onClick={() => removeStudySession(item.id)}><Plus size={15} style={{transform:'rotate(45deg)'}}/></button></div>)}</div></>}
            {active === 'settings' && <><div className="page-heading"><div><span className="section-kicker">{lang === 'rw' ? 'KONTI YAWE' : 'YOUR ACCOUNT'}</span><h2>{lang === 'rw' ? 'Igenamiterere rya konti' : 'Profile & settings'}</h2><p>{lang === 'rw' ? 'Hindura amazina yawe, icyiciro wiga n’ururimi ukunda.' : 'Keep your student details and learning language up to date.'}</p></div><span className="page-chip"><ShieldCheck size={15}/>{user ? (lang === 'rw' ? 'Konti irinzwe' : 'Account secured') : (lang === 'rw' ? 'Nta konti winjiyemo' : 'Not signed in')}</span></div>{user ? <form className="profile-settings-form panel" onSubmit={saveProfile}><div className="profile-settings-intro"><span className="account-avatar profile-large-avatar">{user.fullName.slice(0,1).toUpperCase()}</span><div><h3>{user.fullName}</h3><p>{user.email}</p><small>{user.role.replace('_',' ')}</small></div></div><label>{lang === 'rw' ? 'Amazina yuzuye' : 'Full name'}<input value={profileName} onChange={e => setProfileName(e.target.value)} minLength={2} maxLength={160} autoComplete="name" required /></label><label>Email<input value={user.email} readOnly aria-readonly="true"/><small>{lang === 'rw' ? 'Email ntihindurwa muri iyi paji.' : 'Email address is read-only here.'}</small></label><label>{lang === 'rw' ? 'Icyiciro wiga' : 'Grade level'}<select value={profileGrade} onChange={e => setProfileGrade(e.target.value)}><option value="">{lang === 'rw' ? 'Hitamo icyiciro' : 'Select your grade'}</option>{['Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6','Senior 1','Senior 2','Senior 3','Senior 4','Senior 5','Senior 6','TVET','University','Other'].map(grade => <option key={grade} value={grade}>{grade}</option>)}</select></label><label>{lang === 'rw' ? 'Ururimi ukunda' : 'Preferred language'}<select value={lang} onChange={e => setLang(e.target.value as Lang)}><option value="en">English</option><option value="rw">Ikinyarwanda</option></select></label>{profileFeedback && <p className={'profile-feedback ' + (profileFeedback.includes('saved') || profileFeedback.includes('yabitswe') ? 'success' : '')} role="status">{profileFeedback}</p>}<div className="profile-settings-actions"><button className="button button-primary" type="submit" disabled={profileBusy}>{profileBusy ? (lang === 'rw' ? 'Birabikwa…' : 'Saving…') : (lang === 'rw' ? 'Bika impinduka' : 'Save changes')} <Check size={15}/></button><button className="button button-secondary" type="button" onClick={signOut}>{lang === 'rw' ? 'Sohoka muri konti' : 'Sign out'} <ArrowRight size={15}/></button></div></form> : <div className="panel profile-signin-prompt"><p>{lang === 'rw' ? 'Injira cyangwa ufungure konti kugira ngo uhindure amakuru yawe.' : 'Sign in or create a student account to manage your profile.'}</p><button className="button button-primary" onClick={() => {setAuthMode('login');setAuthOpen(true)}}>{lang === 'rw' ? 'Injira' : 'Sign in'} <ArrowRight size={15}/></button></div>}</>}
            {active === 'help' && <><div className="page-heading"><div><span className="section-kicker">{lang === 'rw' ? 'UBUFASHA' : 'WE ARE HERE TO HELP'}</span><h2>{lang === 'rw' ? 'Ubufasha n’ibibazo bikunze kubazwa' : 'Help center'}</h2><p>{lang === 'rw' ? 'Menya uko wakoresha Ireme AI.' : 'Learn how to get the most out of your Ireme AI workspace.'}</p></div></div><div className="help-grid">{[{q:'How does Ireme AI help me learn?',a:'Ask a question, choose a subject, and request a step-by-step explanation. The assistant answers questions when the AI service is configured.'},{q:'Can I switch to Kinyarwanda?',a:'Yes. Use the language control in the top bar to switch between English and Kinyarwanda.'},{q:'Are these my real school results?',a:'The dashboard displays learning records saved to your account. New accounts may have no records until you begin learning.'},{q:'Where do verified curriculum materials come from?',a:'Approved curriculum sources will be identified when published. Only approved materials should be used for official learning answers.'}].map(item=><details className="help-item" key={item.q}><summary>{item.q}<ChevronDown size={16}/></summary><p>{item.a}</p></details>)}</div></>}
          </motion.section>}
          <footer className="footer"><span>© 2026 Ireme AI · Made for brighter futures in Rwanda.</span><span><a href="#privacy">Privacy</a><a href="#support">Support</a><span className="footer-status"><i/> Ireme AI</span></span></footer>
        </div>
      </main>
    </div>
  )
}
