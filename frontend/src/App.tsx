import { useCallback, useEffect, useState } from 'react';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import './App.css';

type Step = 'MAIN_ACTIVITY' | 'THEORY' | 'REINFORCEMENT' | 'COMPLETED';
interface Pathway {
  topics: { id: number; title: string; status: 'COMPLETED' | 'IN_PROGRESS' | 'LOCKED' }[];
  progress: { currentTopicId: number; currentStep: Step; completed: boolean; theoryViewed: boolean };
  activity: { id: string; type: string; prompt: string; options: { id: string; text: string }[] } | null;
  theory: string | null;
  attempts: { activityId: string; selectedOptionId: string; isCorrect: number; createdAt: string }[];
}
interface Student { id: number; name: string }
const API = '/api';
const math = /\$(.+?)\$/g;

function RichText({ text }: { text: string }) {
  return <>{text.split(math).map((part, index) => index % 2 ? <InlineMath key={index} math={part} /> : <span key={index}>{part}</span>)}</>;
}

function App() {
  const [users, setUsers] = useState<Student[]>([]);
  const [userId, setUserId] = useState(() => {
    const saved = Number(window.localStorage.getItem('learning-user-id'));
    return saved === 1 || saved === 2 ? saved : 1;
  });
  const [data, setData] = useState<Pathway | null>(null);
  const [selected, setSelected] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    const response = await fetch(`${API}/progress/${userId}`);
    if (!response.ok) throw new Error('No se pudo cargar tu ruta de aprendizaje.');
    const pathway = await response.json() as Pathway;
    if (Number(window.localStorage.getItem('learning-user-id') ?? 1) === userId) setData(pathway);
  }, [userId]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetch(`${API}/users`).then(response => {
        if (!response.ok) throw new Error('No se pudo cargar la lista de estudiantes.');
        return response.json() as Promise<Student[]>;
      }),
      refresh(),
    ]).then(([students]) => {
      if (active) setUsers(students);
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'No se pudo conectar con el servidor.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [refresh]);

  function changeUser(value: string) {
    const nextUserId = Number(value);
    if (nextUserId !== 1 && nextUserId !== 2) return;
    window.localStorage.setItem('learning-user-id', String(nextUserId));
    setSelected('');
    setFeedback('');
    setError('');
    setUserId(nextUserId);
  }

  async function send(path: string, body?: object) {
    setLoading(true);
    setError('');
    try {
      const payload = path === 'attempts'
        ? { ...body, userId, activityId: data?.activity?.id }
        : { ...body, userId };
      const response = await fetch(`${API}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string; feedback?: string };
      if (!response.ok) throw new Error(result.error ?? 'Ocurrió un error.');
      setSelected('');
      setFeedback(result.feedback === 'correct' ? '¡Muy bien! Respuesta correcta.' : result.feedback === 'incorrect' ? 'No es correcto. Revisemos la explicación y vuelve a intentarlo.' : result.feedback === 'theory_required' ? 'Aún no. Repasa la teoría antes de volver a intentarlo.' : '');
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ocurrió un error.'); }
    finally { setLoading(false); }
  }

  if (loading && !data) return <main className="shell"><p className="loading">Preparando tu espacio de aprendizaje…</p></main>;
  return <main className="shell">
    <header className="topbar"><a className="brand" href="#" aria-label="Álgebra, inicio"><span className="brand-icon">∑</span> álgebra<span className="brand-dot">.</span></a><span className="top-label">TU ESPACIO DE APRENDIZAJE</span><label className="student-select-label">Estudiante actual<select className="student-select" value={userId} onChange={event => changeUser(event.target.value)} aria-label="Estudiante actual">{users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label></header>
    <section className="hero"><div className="eyebrow"><span className="spark">✳</span> TU RUTA, A TU RITMO</div><h1>Aprender matemáticas<br /><em>puede sentirse distinto.</em></h1><p>Un paso a la vez. Si algo cuesta, aquí tienes una nueva forma de verlo.</p><div className="progress-caption"><span>Tu recorrido</span><span>{data?.topics.filter(t => t.status === 'COMPLETED').length ?? 0} de {data?.topics.length ?? 3} temas</span></div><div className="progress-track"><span style={{ width: `${((data?.topics.filter(t => t.status === 'COMPLETED').length ?? 0) / (data?.topics.length || 3)) * 100}%` }} /></div></section>
    <div className="layout">
      <aside className="path-card"><div className="card-heading"><div><span className="section-kicker">EL RECORRIDO</span><h2>Tu ruta de aprendizaje</h2></div><span className="topic-count">0{data?.topics.length ?? 3} temas</span></div><div className="topic-list">{data?.topics.map((topic, index) => <div className={`topic ${topic.status.toLowerCase()}`} key={topic.id}><div className="topic-marker">{topic.status === 'COMPLETED' ? '✓' : topic.status === 'LOCKED' ? '·' : `0${index + 1}`}</div><div className="topic-copy"><strong>{topic.title}</strong><span>{topic.status === 'COMPLETED' ? 'Tema completado' : topic.status === 'LOCKED' ? 'Se desbloquea al avanzar' : 'Estás aquí'}</span></div><span className="topic-status">{topic.status === 'COMPLETED' ? 'LISTO' : topic.status === 'IN_PROGRESS' ? 'AHORA' : 'PRONTO'}</span></div>)}</div><div className="aside-note"><span>✳</span><p>Cada paso cuenta. <strong>Avanza a tu manera.</strong></p></div></aside>
      <section className="activity-card" aria-live="polite">
        {error && <div className="error-banner" role="alert">{error}<button onClick={() => refresh().catch(() => setError('No se pudo conectar con el servidor.'))}>Reintentar</button></div>}
        {feedback && <p className={`feedback ${feedback.startsWith('¡') ? 'good' : 'incorrect'}`} role="status">{feedback}</p>}
        {data?.progress.completed ? <div className="complete-state"><span className="activity-icon">✦</span><span className="section-kicker">RECORRIDO COMPLETADO</span><h2>¡Lo lograste!</h2><p>Has completado todos los temas de tu ruta. Cada problema que resolviste te trajo hasta aquí.</p></div>
          : data?.progress.currentStep === 'THEORY' ? <><div className="activity-top"><div className="activity-icon theory-icon">T</div><span className="section-kicker">UN MOMENTO PARA ENTENDER</span><span className="step-count">TEORÍA · T{data.progress.currentTopicId}</span></div><h2>Volvamos a la idea, sin prisa.</h2><p className="subcopy">Una explicación puede hacer que todo encaje.</p><div className="theory-box"><span className="theory-label">LA IDEA CLAVE</span><p><RichText text={data.theory ?? ''} /></p></div><div className="hint"><span>✳</span> Cuando estés listo, prueba una actividad más.</div><button className="primary-btn" disabled={loading} onClick={() => send('theory/consult')}>Entendido, continuar <span>→</span></button></>
          : <><div className="activity-top"><div className="activity-icon">{data?.progress.currentStep === 'REINFORCEMENT' ? 'R' : 'A'}</div><span className="section-kicker">{data?.progress.currentStep === 'REINFORCEMENT' ? 'UN POCO MÁS DE PRÁCTICA' : 'TU SIGUIENTE PASO'}</span><span className="step-count">{data?.progress.currentStep === 'REINFORCEMENT' ? 'REFUERZO' : 'ACTIVIDAD'} · {data?.progress.currentStep === 'REINFORCEMENT' ? 'R' : 'A'}{data?.progress.currentTopicId}</span></div><h2>{data?.progress.currentStep === 'REINFORCEMENT' ? 'Inténtalo con este ejercicio.' : 'Empecemos con algo concreto.'}</h2><p className="question"><RichText text={data?.activity?.prompt ?? ''} /></p><p className="select-label">ELIGE UNA RESPUESTA</p><div className="options">{data?.activity?.options.map((option, index) => <button key={option.id} className={`option ${selected === option.id ? 'selected' : ''}`} onClick={() => { setSelected(option.id); setFeedback(''); }}><span className="option-letter">{String.fromCharCode(65 + index)}</span><span className="option-text"><RichText text={option.text} /></span><span className="radio">{selected === option.id && <span />}</span></button>)}</div><button className="primary-btn" disabled={!selected || loading} onClick={() => send('attempts', { optionId: selected })}>{loading ? 'Guardando…' : 'Comprobar respuesta'} <span>→</span></button><p className="privacy-note"><span>⌁</span> Tu progreso se guarda automáticamente.</p></>}
      </section>
    </div>
    <footer><span>ÁLGEBRA <span className="brand-dot">.</span> · APRENDER, A TU RITMO</span><span>UN PASO A LA VEZ <span className="spark">✳</span></span></footer>
  </main>;
}
export default App;
