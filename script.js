const state = {
  questions: [],
  current: 0,
  answers: [],
  codeTheme: 'dark'
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
  retryBtn: document.getElementById('retry-btn'),
  codeToolbar: document.getElementById('code-toolbar'),
  themeToggle: document.getElementById('theme-toggle'),
  copyBtn: document.getElementById('copy-btn'),
  toast: document.getElementById('toast')
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

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[s]));
}

function highlightC(code) {
  let html = escapeHtml(code);
  html = html.replace(/(^|\n)(\s*\/\/.*)/g, (_, p1, p2) => p1 + `<span class="com">${p2}</span>`);
  html = html.replace(/"([^"\\]|\\.)*"/g, (m)=>`<span class="str">${m}</span>`);
  html = html.replace(/\b(int|char|float|double|void|return|if|else|while|for|do|switch|case|break|continue|sizeof|typedef|struct|printf|scanf|main|include)\b/g, '<span class="kw">$1</span>');
  html = html.replace(/\b\d+\b/g, '<span class="num">$&</span>');
  return html;
}

function renderCode(codeText) {
  const lines = codeText.replace(/\r\n/g, '\n').split('\n');
  const lnHtml = lines.map((_, i) => `<div>${i+1}</div>`).join('');
  const highlighted = highlightC(codeText);
  els.questionCode.classList.toggle('code-light', state.codeTheme === 'light');
  els.questionCode.innerHTML = `<div class="ln">${lnHtml}</div><code>${highlighted}</code>`;
}

async function copyCodeRaw(codeText){
  try{
    await navigator.clipboard.writeText(codeText);
    showToast('✅ Code copied!');
  }catch(e){
    showToast('❌ Copy failed');
  }
}

let currentRawCode = '';

function renderQuestion() {
  const q = state.questions[state.current];
  els.progress.textContent = `Question ${state.current+1} of ${state.questions.length}`;
  els.topic.textContent = q.topic ? `Topic: ${q.topic}` : '';
  els.questionText.textContent = q.text;

  if (q.code && q.code.trim().length){
    currentRawCode = q.code;
    els.codeToolbar.classList.remove('hidden');
    els.questionCode.classList.remove('hidden');
    renderCode(q.code);
    els.themeToggle.textContent = state.codeTheme === 'dark' ? '🌙 Dark' : '☀️ Light';
  } else {
    currentRawCode = '';
    els.codeToolbar.classList.add('hidden');
    els.questionCode.classList.add('hidden');
    els.questionCode.innerHTML = '';
  }

  els.optionsForm.innerHTML = '';
  const currentAns = state.answers[state.current] || [];
  const inputType = q.multiple ? 'checkbox' : 'radio';
  q.options.forEach((opt, idx) => {
    const wrapper = document.createElement('label');
    wrapper.className = 'option';
    const input = document.createElement('input');
    input.type = inputType;
    input.name = `q_${state.current}`;
    input.value = idx;
    if (currentAns.includes(idx)) input.checked = true;
    input.addEventListener('change', onSelectChange);
    const span = document.createElement('span');
    span.textContent = opt;
    wrapper.appendChild(input);
    wrapper.appendChild(span);
    els.optionsForm.appendChild(wrapper);
  });

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
  const normalized = state.questions.map((q, i)=> Array.isArray(state.answers[i]) ? state.answers[i] : []);
  const res = await fetch('/api/submit', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ answers: normalized })
  });
  if (!res.ok) { alert('Submission failed. Please try again later.'); return; }
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
    item.appendChild(h);
    if (d.code) {
      const pre = document.createElement('pre');
      pre.className = 'code' + (state.codeTheme === 'light' ? ' code-light' : '');
      const lines = d.code.replace(/\r\n/g, '\n').split('\n');
      const lnHtml = lines.map((_, j) => `<div>${j+1}</div>`).join('');
      pre.innerHTML = `<div class="ln">${lnHtml}</div><code>${highlightC(d.code)}</code>`;
      item.appendChild(pre);
    }

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
    pExpl.innerHTML = `💬 ${escapeHtml(d.explanation)}`;

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

let toastTimer = null;
function showToast(msg){
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> els.toast.classList.remove('show'), 1800);
}

els.startBtn.addEventListener('click', async () => {
  try {
    state.questions = await fetchQuestions();
    state.current = 0;
    state.answers = [];
    state.codeTheme = 'dark';
    start();
  } catch (e) {
    alert('Could not load questions. Please try again later.');
  }
});

els.nextBtn.addEventListener('click', next);
els.prevBtn.addEventListener('click', prev);
els.submitBtn.addEventListener('click', submit);
els.retryBtn.addEventListener('click', ()=>{
  els.results.classList.add('hidden');
  els.welcome.classList.remove('hidden');
});

els.themeToggle.addEventListener('click', ()=>{
  state.codeTheme = (state.codeTheme === 'dark') ? 'light' : 'dark';
  els.themeToggle.textContent = state.codeTheme === 'dark' ? '🌙 Dark' : '☀️ Light';
  if (currentRawCode) renderCode(currentRawCode);
});

els.copyBtn.addEventListener('click', ()=>{
  if (currentRawCode) copyCodeRaw(currentRawCode);
});
