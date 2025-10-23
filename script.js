// Minimal, mobile-friendly one-question-per-page assessment
// Fetch questions (without answers), record responses locally, submit to server for scoring

const state = {
  questions: [],
  current: 0,
  answers: [], // each element is an array of selected option indices
};

const els = {
  welcome: document.getElementById('welcome-screen'),
  quiz: document.getElementById('quiz-screen'),
  results: document.getElementById('results-screen'),
  startBtn: document.getElementById('start-btn'),
  prevBtn: document.getElementById('prev-btn'),
  nextBtn: document.getElementById('next-btn'),
  submitBtn: document.getElementById('submit-btn'),
  progress: document.getElementById('progress'),
  topic: document.getElementById('topic'),
  questionText: document.getElementById('question-text'),
  questionCode: document.getElementById('question-code'),
  optionsForm: document.getElementById('options-form'),
  scoreline: document.getElementById('scoreline'),
  resultsDetail: document.getElementById('results-detail'),
  retryBtn: document.getElementById('retry-btn')
};

async function fetchQuestions() {
  const res = await fetch('/api/questions');
  if (!res.ok) throw new Error('Failed to load questions');
  const data = await res.json();
  return data.questions;
}

function start() {
  els.welcome.classList.add('hidden');
  els.quiz.classList.remove('hidden');
  renderQuestion();
}

function renderQuestion() {
  const q = state.questions[state.current];
  els.progress.textContent = `Question ${state.current+1} of ${state.questions.length}`;
  els.topic.textContent = q.topic ? `Topic: ${q.topic}` : '';
  els.questionText.textContent = q.text;

  if (q.code) {
    els.questionCode.textContent = q.code;
    els.questionCode.classList.remove('hidden');
  } else {
    els.questionCode.classList.add('hidden');
  }

  els.optionsForm.innerHTML = '';
  const currentAns = state.answers[state.current] || [];
  // single or multiple select
  const inputType = q.multiple ? 'checkbox' : 'radio';
  q.options.forEach((opt, idx) => {
    const id = `q${state.current}_opt${idx}`;
    const wrapper = document.createElement('label');
    wrapper.className = 'option';
    const input = document.createElement('input');
    input.type = inputType;
    input.name = `q_${state.current}`;
    input.value = idx;
    input.id = id;
    if (currentAns.includes(idx)) input.checked = true;
    input.addEventListener('change', onSelectChange);
    const span = document.createElement('span');
    span.textContent = opt;
    wrapper.appendChild(input);
    wrapper.appendChild(span);
    els.optionsForm.appendChild(wrapper);
  });

  // nav buttons
  els.prevBtn.disabled = state.current === 0;
  if (state.current === state.questions.length - 1) {
    els.nextBtn.classList.add('hidden');
    els.submitBtn.classList.remove('hidden');
  } else {
    els.nextBtn.classList.remove('hidden');
    els.submitBtn.classList.add('hidden');
  }
}

function onSelectChange() {
  const q = state.questions[state.current];
  const inputs = [...els.optionsForm.querySelectorAll('input')];
  if (!state.answers[state.current]) state.answers[state.current] = [];
  if (q.multiple) {
    state.answers[state.current] = inputs.filter(i => i.checked).map(i => Number(i.value));
  } else {
    const checked = inputs.find(i => i.checked);
    state.answers[state.current] = checked ? [Number(checked.value)] : [];
  }
}

function next() {
  // require at least one selection? optional—skipped for flexibility
  if (state.current < state.questions.length - 1) {
    state.current++;
    renderQuestion();
  }
}

function prev() {
  if (state.current > 0) {
    state.current--;
    renderQuestion();
  }
}

async function submit() {
  // normalize: ensure length matches
  const normalized = state.questions.map((q, i)=> Array.isArray(state.answers[i]) ? state.answers[i] : []);
  const res = await fetch('/api/submit', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ answers: normalized })
  });
  if (!res.ok) {
    alert('Submission failed. Please try again later.');
    return;
  }
  const data = await res.json();
  showResults(data);
}

function showResults(data) {
  els.quiz.classList.add('hidden');
  els.results.classList.remove('hidden');
  els.scoreline.textContent = `🎯 Your Score: ${data.score} / ${data.total} (${Math.round(data.percent)}%)`;
  els.resultsDetail.innerHTML = '';

  data.detail.forEach((d, i) => {
    const item = document.createElement('div');
    item.className = 'result-item';
    const h = document.createElement('h4');
    h.textContent = `Q${i+1}. ${d.question}`;
    const meta = document.createElement('div');
    meta.className = 'result-meta';
    const badge = document.createElement('span');
    badge.className = `badge ${d.isCorrect ? 'ok':'no'}`;
    badge.textContent = d.isCorrect ? 'Correct' : 'Incorrect';
    meta.appendChild(badge);

    const pUser = document.createElement('div');
    pUser.className = 'user-ans';
    pUser.innerHTML = `<strong>Your answer:</strong> ${formatAnswers(d.options, d.user)}`;

    const pCorr = document.createElement('div');
    pCorr.className = 'correct';
    pCorr.innerHTML = `<strong>Correct answer:</strong> ${formatAnswers(d.options, d.correct)}`;

    const pExpl = document.createElement('div');
    pExpl.className = 'expl';
    pExpl.innerHTML = `💬 ${d.explanation}`;

    item.appendChild(h);
    if (d.code) {
      const pre = document.createElement('pre');
      pre.className='code';
      pre.textContent = d.code;
      item.appendChild(pre);
    }
    item.appendChild(meta);
    item.appendChild(pUser);
    item.appendChild(pCorr);
    item.appendChild(pExpl);
    els.resultsDetail.appendChild(item);
  });
}

function formatAnswers(options, indices) {
  if (!indices || !indices.length) return '<em>None selected</em>';
  return indices.map(i => `${String.fromCharCode(65+i)}) ${escapeHtml(options[i])}`).join('; ');
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[s]));
}

// Event bindings
els.startBtn.addEventListener('click', async () => {
  try {
    state.questions = await fetchQuestions();
    state.current = 0;
    state.answers = [];
    start();
  } catch (e) {
    alert('Could not load questions. Please try again later.');
  }
});

els.nextBtn.addEventListener('click', next);
els.prevBtn.addEventListener('click', prev);
els.submitBtn.addEventListener('click', submit);
els.retryBtn.addEventListener('click', ()=>{
  // go back to welcome
  els.results.classList.add('hidden');
  els.welcome.classList.remove('hidden');
});
