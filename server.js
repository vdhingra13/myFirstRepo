// Simple Node.js server for assessment
// - Serves the static front-end
// - Exposes /api/questions without answers
// - Accepts /api/submit with user's answers
// - Grades server-side using questions.json and emails the detailed results

const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');

const PORT = process.env.PORT || 3000;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'vdhingra@yahoo.com';
const GMAIL_USER = process.env.GMAIL_USER;     // set on host
const GMAIL_PASS = process.env.GMAIL_PASS;     // app password

const app = express();
app.use(bodyParser.json({limit:'1mb'}));
app.use(express.static(path.join(__dirname)));

// Load questions (with answers) from disk
const raw = fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf8');
const FULL_QUESTIONS = JSON.parse(raw);

// Sanitize questions for client: remove correct answers and explanations
function sanitize(questions){
  return questions.map(q => ({
    id: q.id,
    topic: q.topic,
    text: q.text,
    code: q.code || '',
    options: q.options,
    multiple: !!q.multiple
  }));
}

app.get('/api/health', (req,res)=>{
  res.json({ok:true, time:new Date().toISOString()});
});

app.get('/api/questions', (req, res) => {
  res.json({ questions: sanitize(FULL_QUESTIONS) });
});

app.post('/api/submit', async (req, res) => {
  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  const details = [];
  let score = 0;

  for (let i = 0; i < FULL_QUESTIONS.length; i++) {
    const q = FULL_QUESTIONS[i];
    const userAns = Array.isArray(answers[i]) ? answers[i].map(Number).filter(Number.isInteger) : [];
    const corr = q.correct; // array of indices
    // sort for comparison
    const sortArr = (arr) => [...arr].sort((a,b)=>a-b);
    const isCorrect = JSON.stringify(sortArr(userAns)) === JSON.stringify(sortArr(corr));

    if (isCorrect) score++;

    details.push({
      question: q.text,
      code: q.code || '',
      options: q.options,
      user: userAns,
      correct: corr,
      explanation: q.explanation,
      topic: q.topic,
      isCorrect
    });
  }

  const total = FULL_QUESTIONS.length;
  const percent = (score / total) * 100;

  // Fire-and-forget email (do not block response if email fails)
  sendEmail({
    admin: ADMIN_EMAIL,
    score, total, percent,
    details,
    ip: getIp(req),
    ua: req.headers['user-agent'] || 'unknown'
  }).catch(err => {
    console.error('Email send failed:', err.message);
  });

  res.json({ score, total, percent, detail: details });
});

function getIp(req){
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
}

async function sendEmail(payload){
  if (!GMAIL_USER || !GMAIL_PASS) {
    console.warn('GMAIL_USER / GMAIL_PASS not set; skipping email.');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_PASS }
  });

  const html = renderHtmlEmail(payload);
  const subject = `Assessment Result – ${payload.score}/${payload.total} (${Math.round(payload.percent)}%)`;

  await transporter.sendMail({
    from: `"C Assessment" <${GMAIL_USER}>`,
    to: payload.admin,
    subject,
    html
  });
}

function renderHtmlEmail({score, total, percent, details, ip, ua}){
  const rows = details.map((d, i) => {
    const fmt = (indices) => indices.map(x => String.fromCharCode(65+x)).join(', ') || '—';
    const cls = d.isCorrect ? 'ok' : 'no';
    return `
      <tr>
        <td>${i+1}</td>
        <td>${escapeHtml(d.topic || '')}</td>
        <td>${escapeHtml(d.question)}</td>
        <td>${fmt(d.user)}</td>
        <td>${fmt(d.correct)}</td>
        <td>${d.isCorrect ? '✅' : '❌'}</td>
        <td>${escapeHtml(d.explanation)}</td>
      </tr>
    `;
  }).join('');

  return `
  <div style="font-family:system-ui,Segoe UI,Roboto,Arial;line-height:1.4;">
    <h2 style="margin:0 0 8px;">C Concepts Assessment – Submission</h2>
    <p style="margin:0 0 10px;">
      <strong>Score:</strong> ${score} / ${total} (${Math.round(percent)}%)<br/>
      <strong>Time:</strong> ${new Date().toLocaleString()}<br/>
      <strong>Client:</strong> IP ${escapeHtml(ip||'')}, UA ${escapeHtml(ua||'')}
    </p>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; width:100%; font-size:14px;">
      <thead style="background:#f3f4f6;">
        <tr>
          <th>#</th>
          <th>Topic</th>
          <th>Question</th>
          <th>User</th>
          <th>Correct</th>
          <th>✓</th>
          <th>Explanation</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[s]));
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
