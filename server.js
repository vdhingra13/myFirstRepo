const express = require("express");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

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

// Email setup
let transporter = null;
if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });
  console.log("✅ Email service configured for", process.env.GMAIL_USER);
} else {
  console.log("⚠️ GMAIL_USER / GMAIL_PASS not set; skipping email.");
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

  // Send email to admin
  if (transporter && process.env.ADMIN_EMAIL) {
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

    transporter.sendMail(
      {
        from: process.env.GMAIL_USER,
        to: process.env.ADMIN_EMAIL,
        subject,
        text: body,
      },
      (err, info) => {
        if (err) console.error("❌ Email send failed:", err.message);
        else console.log("📧 Email sent:", info.response);
      }
    );
  }

  res.json({ score, total: questions.length, percent, detail });
});

// --- START SERVER ---
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
