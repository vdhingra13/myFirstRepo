const express = require("express");
const fs = require("fs");
const path = require("path");
const https = require("https"); // ✅ used for Resend API

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Load questions
const questionsPath = path.join(__dirname, "questions.json");
let questions = [];
try {
  const data = fs.readFileSync(questionsPath, "utf-8");
  questions = JSON.parse(data);
  console.log(`✅ Loaded ${questions.length} questions`);
} catch (err) {
  console.error("⚠️ Could not load questions.json:", err.message);
}

// --- RESEND EMAIL SETUP ---
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
if (RESEND_API_KEY) {
  console.log(`✅ Resend email service configured → will send results to ${ADMIN_EMAIL}`);
} else {
  console.log("⚠️ RESEND_API_KEY not set; skipping email.");
}

// Helper: send email using Resend API
async function sendEmail(subject, body) {
  if (!RESEND_API_KEY || !ADMIN_EMAIL) {
    console.log("⚠️ Missing RESEND_API_KEY or ADMIN_EMAIL, skipping email.");
    return;
  }

  const data = JSON.stringify({
    from: "C Assessment <onboarding@resend.dev>",
    to: [ADMIN_EMAIL],
    subject,
    text: body
  });

  const options = {
    hostname: "api.resend.com",
    path: "/emails",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Length": Buffer.byteLength(data)
    }
  };

  const req = https.request(options, (res) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log("📧 Email sent successfully via Resend API");
    } else {
      console.error("❌ Email send failed with status:", res.statusCode);
    }
  });

  req.on("error", (err) => console.error("❌ Email send failed:", err.message));
  req.write(data);
  req.end();
}

// --- ROUTES ---

// Get all questions (without correct answers)
app.get("/api/questions", (req, res) => {
  const safeQuestions = questions.map((q) => ({
    text: q.text,
    topic: q.topic,
    options: q.options,
    multiple: q.multiple,
    code: q.code || "",
  }));
  res.json({ questions: safeQuestions });
});

// Submit answers
app.post("/api/submit", (req, res) => {
  const userAnswers = req.body.answers || [];
  let score = 0;
  const detail = questions.map((q, i) => {
    const correct = q.correct.sort();
    const user = (userAnswers[i] || []).sort();
    const isCorrect =
      correct.length === user.length && correct.every((v, j) => v === user[j]);
    if (isCorrect) score++;

    return {
      question: q.text,
      code: q.code || "",
      options: q.options,
      user,
      correct,
      isCorrect,
      explanation: q.explanation,
    };
  });

  const percent = (score / questions.length) * 100;

  // Build email summary
  const subject = `Assessment Result: ${score}/${questions.length} (${percent.toFixed(1)}%)`;
  const summaryLines = detail
    .map(
      (d, i) =>
        `Q${i + 1}. ${d.question}\nYour answer: ${d.user
          .map((x) => d.options[x])
          .join(", ") || "None"}\nCorrect answer: ${d.correct
          .map((x) => d.options[x])
          .join(", ")}\nResult: ${d.isCorrect ? "✅ Correct" : "❌ Incorrect"}\n`
    )
    .join("\n");

  const body = `
Assessment completed:

Score: ${score}/${questions.length} (${percent.toFixed(1)}%)

Detailed results:
${summaryLines}
`;

  // ✅ Send email via Resend
  sendEmail(subject, body);

  res.json({ score, total: questions.length, percent, detail });
});

// --- START SERVER ---
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
