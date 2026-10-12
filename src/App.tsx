import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, ArrowUpRight, Bell, BookOpen, BookOpenCheck, CalendarDays, Check,
  ChevronDown, ChevronRight, CircleHelp, Clock3, Languages, LayoutDashboard,
  Lightbulb, Menu, Mic, MoreHorizontal, Play, Plus, Search, Send, Settings2,
  ShieldCheck, Sparkles, Target, TrendingUp, WandSparkles, Zap
} from 'lucide-react'

type Lang = 'en' | 'rw'
const copy = {
  en: {
    greeting: 'Good morning, Aline 👋', subtitle: 'Ready to make today a great learning day?',
    overview: 'Your learning overview', week: 'This week', progress: 'Learning progress',
    continue: 'Continue learning', seeAll: 'See all', daily: 'Daily learning goal',
    minutes: 'of 60 minutes', subjects: 'Your subjects', recommended: 'Picked for you',
    ask: 'Ask Ireme anything...', welcome: 'Your AI learning companion',
    welcomeSub: 'Personalized support for every question, every subject, every step.',
    start: 'Start learning', explore: 'Explore subjects', streak: 'day streak',
    lessons: 'lessons completed', accuracy: 'quiz accuracy', hours: 'learning hours',
    home: 'Overview', learn: 'My learning', library: 'Study library', progressNav: 'My progress',
    schedule: 'Schedule', help: 'Help center', today: 'Today’s plan',
    next: 'Up next', viewPlan: 'View full plan', maths: 'Mathematics', biology: 'Biology',
    english: 'English language', physics: 'Physics', lesson: 'Continue lesson',
    askTitle: 'Let’s figure it out together', askSub: 'Ask a question or choose a prompt to get started.',
    prompt1: 'Explain a difficult topic', prompt2: 'Create a practice quiz', prompt3: 'Help me revise',
    online: 'Ireme AI is ready to help', search: 'Search lessons, subjects, resources…',
  },
  rw: {
    greeting: 'Mwaramutse, Aline 👋', subtitle: 'Witeguye kwiga neza uyu munsi?',
    overview: 'Incamake y’imyigire yawe', week: 'Iki cyumweru', progress: 'Iterambere mu myigire',
    continue: 'Komeza kwiga', seeAll: 'Reba byose', daily: 'Intego ya buri munsi',
    minutes: 'kuri iminota 60', subjects: 'Amasomo yawe', recommended: 'Byagufasha kwiga',
    ask: 'Baza Ireme ikibazo...', welcome: 'Umufasha wawe mu myigire',
    welcomeSub: 'Ubufasha bwihariye kuri buri kibazo, isomo n’intambwe utera.',
    start: 'Tangira kwiga', explore: 'Reba amasomo', streak: 'iminsi wikurikiranya',
    lessons: 'amasomo warangije', accuracy: 'amanota y’ibizamini', hours: 'amasaha yo kwiga',
    home: 'Incamake', learn: 'Kwiga kwanjye', library: 'Isomero', progressNav: 'Iterambere',
    schedule: 'Gahunda', help: 'Ubufasha', today: 'Gahunda y’uyu munsi',
    next: 'Isomo rikurikira', viewPlan: 'Reba gahunda yose', maths: 'Imibare', biology: 'Ubugenge bw’ibinyabuzima',
    english: 'Icyongereza', physics: 'Ubugenge', lesson: 'Komeza isomo',
    askTitle: 'Reka tubisobanukirwe hamwe', askSub: 'Baza ikibazo cyangwa uhitemo urugero kugira ngo dutangire.',
    prompt1: 'Sobanura ingingo igoye', prompt2: 'Nkora ikizamini cy’imyitozo', prompt3: 'Mfasha kwisubiramo',
    online: 'Ireme AI yiteguye kugufasha', search: 'Shakisha amasomo, ibikoresho…',
  }
}

const subjects = [
  { name: 'Mathematics', rw: 'Imibare', category: 'STEM', color: 'violet', icon: '∑', progress: 72, lessons: '12 of 16 lessons', image: 'https://cdn.pixabay.com/photo/2016/11/30/20/58/programming-1873854_1280.png' },
  { name: 'Biology', rw: 'Ubugenge bw’ibinyabuzima', category: 'SCIENCE', color: 'mint', icon: '✳', progress: 48, lessons: '8 of 17 lessons', image: 'https://cdn.pixabay.com/photo/2017/02/01/13/53/analysis-2030265_1280.jpg' },
  { name: 'English language', rw: 'Icyongereza', category: 'LANGUAGE', color: 'peach', icon: 'Aa', progress: 86, lessons: '18 of 21 lessons', image: 'https://cdn.pixabay.com/photo/2016/03/27/22/22/education-1280962_1280.jpg' },
]
const navItems = [
  { key: 'home', icon: LayoutDashboard }, { key: 'learn', icon: BookOpen },
  { key: 'library', icon: BookOpenCheck }, { key: 'progressNav', icon: TrendingUp },
  { key: 'schedule', icon: CalendarDays },
] as const

export default function App() {
  const [lang, setLang] = useState<Lang>('en')
  const [active, setActive] = useState('home')
  const [query, setQuery] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [completedLessons, setCompletedLessons] = useState<string[]>([])
  const [savedResources, setSavedResources] = useState<string[]>([])
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [sessionTitle, setSessionTitle] = useState('')
  const [customSessions, setCustomSessions] = useState<string[]>([])
  const t = copy[lang]
  const localizedSubjects = useMemo(() => subjects.map(s => ({ ...s, displayName: lang === 'rw' ? s.rw : s.name })).filter(s => s.displayName.toLowerCase().includes(query.toLowerCase())), [lang, query])

  function askAI(value = question) {
    const q = value.trim()
    if (!q) return
    setQuestion(q)
    setAnswer(lang === 'rw'
      ? 'Murakoze kubaza! Iyi ni demo ya Ireme AI. Uko turimo kubaka sisitemu, tuzahuza umufasha n’amasomo yemejwe kugira ngo aguhe igisubizo gifite amasoko yizewe. Ikibazo cyawe: ' + q
      : 'Great question! This is the Ireme AI interface preview. Once the education knowledge base and AI provider are connected, I’ll explain this step by step using trusted learning materials. Your question: ' + q)
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#" aria-label="Ireme AI home">
          <span className="brand-mark"><Sparkles size={22} strokeWidth={2.4}/></span>
          <span className="brand-copy"><strong>Ireme<span>AI</span></strong><small>LEARN WITHOUT LIMITS</small></span>
        </a>
        <div className="school-chip"><span className="school-avatar">A</span><span><b>Akagera Academy</b><small>Student workspace</small></span><ChevronDown size={15}/></div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav">
          {navItems.map(({key, icon: Icon}) => <button key={key} className={`nav-item ${active === key ? 'active' : ''}`} onClick={() => {setActive(key); setMenuOpen(false)}}><Icon size={18}/><span>{t[key]}</span>{key === 'progressNav' && <span className="nav-dot"/>}</button>)}
        </nav>
        <div className="sidebar-card">
          <div className="sidebar-card-icon"><WandSparkles size={17}/></div>
          <b>Learning, your way</b>
          <p>Small steps every day add up to big things.</p>
          <div className="mini-progress"><span/></div><small>72% weekly goal</small>
        </div>
        <div className="nav-label bottom-label">SUPPORT</div>
        <button className="nav-item" onClick={() => setActive('help')}><CircleHelp size={18}/><span>{t.help}</span></button>
        <button className="nav-item"><Settings2 size={18}/><span>Settings</span></button>
        <div className="profile-mini"><img src="https://cdn.pixabay.com/photo/2016/11/21/12/42/beard-1845166_1280.jpg" alt="Student profile"/><span><b>Aline Mukamana</b><small>Senior 4 student</small></span><MoreHorizontal size={18}/></div>
      </aside>
      {menuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)}/>}
      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu size={21}/></button>
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14}/><b>{t[active as keyof typeof t] || 'Help center'}</b></div>
          <div className="top-actions">
            <label className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t.search}/><kbd>⌘ K</kbd></label>
            <button className="language-switch" onClick={() => setLang(lang === 'en' ? 'rw' : 'en')}><Languages size={16}/>{lang === 'en' ? 'EN' : 'RW'}<ChevronDown size={13}/></button>
            <button className="icon-button notification" aria-label="Notifications"><Bell size={19}/><i/></button>
            <img className="top-avatar" src="https://cdn.pixabay.com/photo/2016/11/21/12/42/beard-1845166_1280.jpg" alt="Aline Mukamana"/>
          </div>
        </header>
        <div className="content-wrap" data-active={active}>
          <motion.section className="welcome-row" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.45}}>
            <div><div className="eyebrow"><span className="eyebrow-line"/> YOUR PERSONAL LEARNING SPACE</div><h1>{t.greeting}</h1><p>{t.subtitle}</p></div>
            <button className="date-pill"><CalendarDays size={16}/> Monday, 12 October <ChevronDown size={14}/></button>
          </motion.section>

          <motion.section className="hero-banner" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:.08,duration:.5}}>
            <div className="hero-copy"><div className="hero-pill"><Sparkles size={13}/> YOUR AI STUDY PARTNER</div><h2>{t.welcome}</h2><p>{t.welcomeSub}</p><div className="hero-actions"><button className="button button-white" onClick={() => document.getElementById('ask-ireme')?.focus()}>{t.start}<ArrowRight size={16}/></button><button className="button button-glass" onClick={() => {setActive('learn');window.scrollTo({top:0,behavior:'smooth'})}}><Play size={15} fill="currentColor"/> {t.explore}</button></div><div className="hero-trust"><span><ShieldCheck size={14}/> Curriculum-aware</span><span><Zap size={14}/> Personalized learning</span></div></div>
            <div className="hero-art" aria-label="Students learning together"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="hero-image"><img src="https://cdn.pixabay.com/photo/2016/11/29/09/32/architecture-1868667_1280.jpg" alt="Bright modern learning space"/></div><div className="floating-note note-top"><span className="note-icon purple"><Lightbulb size={17}/></span><span><b>Smart insights</b><small>Learn at your pace</small></span></div><div className="floating-note note-bottom"><span className="note-icon green"><Check size={17}/></span><span><b>Goal completed!</b><small>You're doing great</small></span></div><div className="sparkle sparkle-a">✦</div><div className="sparkle sparkle-b">✧</div></div>
          </motion.section>

          <section className="stats-grid">
            {[{label:'Learning streak',value:'08',unit:'days',icon:Zap,style:'stat-purple',trend:'+2 days'},{label:'Lessons completed',value:'24',unit:'lessons',icon:BookOpenCheck,style:'stat-green',trend:'+6 this week'},{label:'Quiz average',value:'87',unit:'%',icon:Target,style:'stat-orange',trend:'+5.4%'},{label:'Study time',value:'12.5',unit:'hours',icon:Clock3,style:'stat-blue',trend:'+18%'}].map((s,i)=><motion.div className="stat-card" key={s.label} initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay:.1+i*.06}}><div className={`stat-icon ${s.style}`}><s.icon size={19}/></div><span className="stat-label">{s.label}</span><div className="stat-number">{s.value}<small>{s.unit}</small></div><div className="stat-trend"><ArrowUpRight size={13}/>{s.trend}<span> this week</span></div></motion.div>)}
          </section>

          <div className="dashboard-grid">
            <section className="panel subjects-panel">
              <div className="section-heading"><div><span className="section-kicker">KEEP THE MOMENTUM</span><h3>{t.subjects}</h3></div><button className="text-link" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show less' : t.seeAll}<ArrowRight size={15}/></button></div>
              <div className="subject-list">{(showAll ? [...localizedSubjects,{...subjects[0],name:'Physics',rw:'Ubugenge',category:'SCIENCE',color:'blue',icon:'Φ',progress:34,lessons:'5 of 15 lessons',displayName:lang==='rw'?'Ubugenge':'Physics'}] : localizedSubjects).map(s=><motion.article className="subject-card" key={s.name} whileHover={{y:-3}} transition={{duration:.2}}><div className={`subject-art ${s.color}`}><img src={s.image} alt="" loading="lazy"/><span className="subject-symbol">{s.icon}</span><span className="subject-category">{s.category}</span></div><div className="subject-info"><div className="subject-title-row"><h4>{s.displayName}</h4><button className="tiny-more" aria-label={`More about ${s.displayName}`}><MoreHorizontal size={17}/></button></div><p>{s.lessons}</p><div className="progress-track"><span style={{width:`${s.progress}%`}}/></div><div className="progress-foot"><span>{s.progress}% complete</span><button onClick={() => {setQuestion(lang==='rw' ? 'Mfasha kwiga '+s.rw : 'Help me study '+s.name); document.getElementById('ask-ireme')?.focus()}}>{t.lesson}<ArrowUpRight size={14}/></button></div></div></motion.article>)}</div>
            </section>

            <section className="panel progress-panel">
              <div className="section-heading"><div><span className="section-kicker">YOUR ACHIEVEMENTS</span><h3>{t.progress}</h3></div><button className="tiny-more"><MoreHorizontal size={18}/></button></div>
              <div className="progress-summary"><div className="ring-chart"><svg viewBox="0 0 120 120"><circle className="ring-bg" cx="60" cy="60" r="49"/><circle className="ring-value" cx="60" cy="60" r="49"/></svg><div><b>74<span>%</span></b><small>overall</small></div></div><div className="summary-copy"><b>You're on the right track!</b><p>You've learned more than last week. Keep your streak going.</p><span><TrendingUp size={14}/> +12% this month</span></div></div>
              <div className="chart-head"><b>Weekly activity</b><span>{t.week}<ChevronDown size={13}/></span></div><div className="bar-chart">{[{d:'M',v:42},{d:'T',v:66},{d:'W',v:50},{d:'T',v:86},{d:'F',v:58},{d:'S',v:100},{d:'S',v:32}].map((b,i)=><div className="bar-column" key={i}><div className={`bar ${i===5?'bar-active':''}`} style={{height:`${b.v}%`}}/><span>{b.d}</span></div>)}</div>
            </section>
          </div>

          <div className="lower-grid">
            <section className="panel ask-panel" id="ask-panel">
              <div className="ask-heading"><div className="ask-logo"><Sparkles size={19}/></div><div><h3>{t.askTitle}</h3><p>{t.askSub}</p></div><span className="online-badge"><i/>{t.online}</span></div>
              <div className="suggestion-row">{[t.prompt1,t.prompt2,t.prompt3].map((p,i)=><button key={p} onClick={() => {setQuestion(p);document.getElementById('ask-ireme')?.focus()}}><span>{[<Lightbulb size={15}/>,<Target size={15}/>,<BookOpen size={15}/>][i]}</span>{p}<ArrowUpRight size={13}/></button>)}</div>
              {answer && <AnimatePresence><motion.div className="answer-box" initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}}><div className="answer-avatar"><Sparkles size={15}/></div><p>{answer}</p></motion.div></AnimatePresence>}
              <form className="ask-input" onSubmit={e => {e.preventDefault();askAI()}}><button type="button" className="attach-button" aria-label="Add attachment"><Plus size={19}/></button><input id="ask-ireme" value={question} onChange={e=>setQuestion(e.target.value)} placeholder={t.ask}/><button type="button" className="mic-button" aria-label="Voice input"><Mic size={18}/></button><button className="send-button" type="submit" aria-label="Send question"><Send size={17}/></button></form><div className="privacy-note"><ShieldCheck size={13}/> Your learning conversations stay private and secure.</div>
            </section>
            <section className="panel today-panel"><div className="section-heading"><div><span className="section-kicker">STAY ORGANIZED</span><h3>{t.today}</h3></div><button className="text-link" onClick={() => setActive('schedule')}>{t.viewPlan}<ArrowRight size={15}/></button></div><div className="timeline"><div className="timeline-item done"><span className="timeline-dot"><Check size={12}/></span><div><small>08:30 – 09:15 AM</small><b>Algebra: Linear equations</b><span className="task-tag completed-tag">Completed</span></div></div><div className="timeline-item current"><span className="timeline-dot"><Play size={11} fill="currentColor"/></span><div><small>10:00 – 10:45 AM</small><b>Cell biology &amp; genetics</b><span className="task-tag current-tag">In progress</span></div></div><div className="timeline-item"><span className="timeline-dot"><Clock3 size={12}/></span><div><small>02:00 – 02:30 PM</small><b>English: Essay writing</b><span className="task-tag">Upcoming</span></div></div></div><button className="add-task" onClick={() => setActive('schedule')}><Plus size={16}/> Add study session</button></section>
          </div>

          {active !== 'home' && <motion.section className="workspace-page" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:.25}}>
            {active === 'learn' && <><div className="page-heading"><div><span className="section-kicker">{lang === 'rw' ? 'GUKOMEZA ITERAMBERE' : 'YOUR LEARNING PATH'}</span><h2>{lang === 'rw' ? 'Amasomo yanjye' : 'My learning'}</h2><p>{lang === 'rw' ? 'Hitamo isomo ukomeze kwiga ku muvuduko wawe.' : 'Choose a subject and continue learning at your own pace.'}</p></div><span className="page-chip"><BookOpen size={15}/> {localizedSubjects.length} subjects</span></div><div className="learning-grid">{localizedSubjects.map(s => <article className="learning-card" key={s.name}><img src={s.image} alt="" loading="lazy"/><div className="learning-card-body"><span className="resource-tag">{s.category}</span><h3>{s.displayName}</h3><p>{s.lessons}</p><div className="progress-track"><span style={{width:`${s.progress}%`}}/></div><div className="learning-card-foot"><span>{s.progress}% complete</span><button className="button button-primary" onClick={() => {setQuestion(lang === 'rw' ? 'Mfasha kwiga ' + s.rw : 'Teach me ' + s.name);setActive('home');setTimeout(() => document.getElementById('ask-ireme')?.focus(),50)}}>{lang === 'rw' ? 'Komeza' : 'Continue'} <ArrowRight size={14}/></button></div></div></article>)}</div><div className="panel learning-tip"><span className="tip-icon"><Lightbulb size={20}/></span><div><b>{lang === 'rw' ? 'Inama y’imyigire' : 'A smarter way to study'}</b><p>{lang === 'rw' ? 'Gabanya isomo mo uduce duto, ukore imyitozo, hanyuma usubiremo ibyo wize.' : 'Break a topic into small steps, practice what you learned, then revisit anything that felt difficult.'}</p></div></div></>}
            {active === 'library' && <><div className="page-heading"><div><span className="section-kicker">{lang === 'rw' ? 'IBIKORESHO BYO KWIGA' : 'YOUR STUDY MATERIALS'}</span><h2>{lang === 'rw' ? 'Isomero ry’amasomo' : 'Study library'}</h2><p>{lang === 'rw' ? 'Ibikoresho byagufasha gusubiramo amasomo.' : 'A focused collection of resources to support your revision.'}</p></div><span className="page-chip"><BookOpenCheck size={15}/> {savedResources.length} saved</span></div><div className="library-toolbar"><div className="library-search"><Search size={17}/><span>{lang === 'rw' ? 'Shakisha ibikoresho by’amasomo' : 'Search learning resources'}</span></div><span className="page-chip">{lang === 'rw' ? 'Ibyiciro byose' : 'All subjects'} <ChevronDown size={14}/></span></div><div className="resource-grid">{[{title:'Algebra essentials',subject:'Mathematics',type:'Study guide',duration:'12 min read',icon:'∑'},{title:'Cell structure & function',subject:'Biology',type:'Lesson notes',duration:'18 min read',icon:'✳'},{title:'Essay writing framework',subject:'English language',type:'Writing guide',duration:'8 min read',icon:'Aa'},{title:'Practice questions: equations',subject:'Mathematics',type:'Practice set',duration:'10 questions',icon:'✓'}].map((r,i)=><article className="resource-card" key={r.title}><div className={`resource-icon resource-${i}`}>{r.icon}</div><div className="resource-content"><span className="resource-tag">{r.type}</span><h3>{r.title}</h3><p>{r.subject} · {r.duration}</p><div className="resource-actions"><button className="text-link" onClick={() => {setQuestion(lang === 'rw' ? 'Nsobanurira: ' + r.title : 'Explain ' + r.title);setActive('home');setTimeout(() => document.getElementById('ask-ireme')?.focus(),50)}}>{lang === 'rw' ? 'Iga ubu' : 'Study now'} <ArrowRight size={14}/></button><button className={`save-button ${savedResources.includes(r.title) ? 'is-saved' : ''}`} onClick={() => setSavedResources(prev => prev.includes(r.title) ? prev.filter(x => x !== r.title) : [...prev,r.title])}>{savedResources.includes(r.title) ? <Check size={15}/> : <Plus size={15}/>} {savedResources.includes(r.title) ? (lang === 'rw' ? 'Byabitswe' : 'Saved') : (lang === 'rw' ? 'Bika' : 'Save')}</button></div></div></article>)}</div><p className="demo-disclaimer"><ShieldCheck size={14}/> {lang === 'rw' ? 'Ibi ni urugero rw’imiterere. Inyandiko zemejwe z’amasomo zizongerwamo.' : 'Preview resources are illustrative. Verified curriculum documents and source citations will be connected in the next stage.'}</p></>}
            {active === 'progressNav' && <><div className="page-heading"><div><span className="section-kicker">{lang === 'rw' ? 'ITERAMBERE RYAWE' : 'YOUR ACHIEVEMENTS'}</span><h2>{lang === 'rw' ? 'Iterambere mu myigire' : 'Learning progress'}</h2><p>{lang === 'rw' ? 'Reba ibyo umaze kugeraho n’aho wakongera imbaraga.' : 'See what is going well and where a little more practice could help.'}</p></div><span className="page-chip"><TrendingUp size={15}/> +12% this month</span></div><div className="progress-detail-grid"><div className="panel progress-detail"><span className="section-kicker">OVERALL MASTERY</span><div className="large-progress-number">74<small>%</small></div><div className="progress-track"><span style={{width:'74%'}}/></div><p>Your learning profile combines lesson completion, practice activity and quiz results in this preview.</p></div><div className="panel progress-detail"><span className="section-kicker">LESSONS COMPLETED</span><div className="large-progress-number">{24 + completedLessons.length}<small> lessons</small></div><p>Keep moving forward with short, regular study sessions.</p><span className="insight-line"><TrendingUp size={16}/> Consistency builds confidence.</span></div><div className="panel progress-detail"><span className="section-kicker">SAVED RESOURCES</span><div className="large-progress-number">{savedResources.length}<small> saved</small></div><p>Your saved study guides stay available in your library during this session.</p><button className="text-link" onClick={() => setActive('library')}>Open study library <ArrowRight size={14}/></button></div></div><div className="panel learning-tip"><span className="tip-icon"><Target size={20}/></span><div><b>Suggested next step</b><p>Review one topic with progress below 60%, then answer a few practice questions to check your understanding.</p><button className="button button-primary" onClick={() => {setActive('learn');setShowAll(true)}}>Choose a subject <ArrowRight size={14}/></button></div></div></>}
            {active === 'schedule' && <><div className="page-heading"><div><span className="section-kicker">{lang === 'rw' ? 'GUTEGURA IGIHE' : 'MAKE TIME TO LEARN'}</span><h2>{lang === 'rw' ? 'Gahunda yo kwiga' : 'Study schedule'}</h2><p>{lang === 'rw' ? 'Tegura igihe gito cyo kwiga buri munsi.' : 'Plan focused study sessions that fit your day.'}</p></div><button className="button button-primary" onClick={() => setShowSessionForm(v => !v)}><Plus size={15}/> {lang === 'rw' ? 'Ongeraho isomo' : 'Add session'}</button></div>{showSessionForm && <form className="session-form" onSubmit={e => {e.preventDefault();if(sessionTitle.trim()){setCustomSessions(prev => [...prev,sessionTitle.trim()]);setSessionTitle('');setShowSessionForm(false)}}}><label htmlFor="session-title">{lang === 'rw' ? 'Izina ry’isomo' : 'Study session title'}</label><input id="session-title" value={sessionTitle} onChange={e => setSessionTitle(e.target.value)} placeholder={lang === 'rw' ? 'Urugero: Gusubiramo imibare' : 'e.g. Revise algebra'} required/><button className="button button-primary" type="submit"><Check size={15}/> {lang === 'rw' ? 'Bika gahunda' : 'Save session'}</button></form>}<div className="panel schedule-detail"><div className="schedule-date"><CalendarDays size={19}/><div><b>Monday, 12 October</b><small>Personal study plan · Local preview</small></div></div>{[{time:'08:30 – 09:15',title:'Algebra: Linear equations',status:'Completed'},{time:'10:00 – 10:45',title:'Cell biology & genetics',status:'In progress'},{time:'14:00 – 14:30',title:'English: Essay writing',status:'Upcoming'},...customSessions.map(title => ({time:'Flexible time',title,status:'Planned'}))].map((item,i)=><div className="schedule-row" key={item.title}><span className={`schedule-status status-${i===0?'done':i===1?'current':'next'}`}>{i===0?<Check size={14}/>:<Clock3 size={14}/>}</span><div><b>{item.title}</b><small>{item.time}</small></div><span className="task-tag">{item.status}</span></div>)}</div></>}
            {active === 'help' && <><div className="page-heading"><div><span className="section-kicker">{lang === 'rw' ? 'UBUFASHA' : 'WE ARE HERE TO HELP'}</span><h2>{lang === 'rw' ? 'Ubufasha n’ibibazo bikunze kubazwa' : 'Help center'}</h2><p>{lang === 'rw' ? 'Menya uko wakoresha Ireme AI.' : 'Learn how to get the most out of your Ireme AI workspace.'}</p></div></div><div className="help-grid">{[{q:'How does Ireme AI help me learn?',a:'Ask a question, choose a subject, and request a step-by-step explanation. The current assistant is a demo until the secure AI service is connected.'},{q:'Can I switch to Kinyarwanda?',a:'Yes. Use the language control in the top bar to switch between English and Kinyarwanda.'},{q:'Are these my real school results?',a:'No. The dashboard currently contains sample learning statistics. Connect an authenticated school account before using real student records.'},{q:'Where do verified curriculum materials come from?',a:'The curriculum library and document citations are planned next. Only approved materials should be used for official learning answers.'}].map(item=><details className="help-item" key={item.q}><summary>{item.q}<ChevronDown size={16}/></summary><p>{item.a}</p></details>)}</div></>}
          </motion.section>}
          <footer className="footer"><span>© 2026 Ireme AI · Made for brighter futures in Rwanda.</span><span><a href="#privacy">Privacy</a><a href="#support">Support</a><span className="footer-status"><i/> All systems operational</span></span></footer>
        </div>
      </main>
    </div>
  )
}
