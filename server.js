const express = require("express");
const fs = require("fs");
const path = require("path");
const https = require("https"); // ✅ For Resend API

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

// --- Helper: send email using Resend API (HTML + Text) ---
async function sendEmail(subject, textBody, htmlBody) {
  if (!RESEND_API_KEY || !ADMIN_EMAIL) {
    console.log("⚠️ Missing RESEND_API_KEY or ADMIN_EMAIL, skipping email.");
    return;
  }

  const data = JSON.stringify({
    from: "C Assessment <onboarding@resend.dev>",
    to: [ADMIN_EMAIL],
    subject,
    text: textBody,
    html: htmlBody
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
  const subject = `Assessment Result: ${score}/${questions.length} (${percent.toFixed(1)}%)`;

  // --- Plain text fallback ---
  const textBody = [
    `Assessment completed.`,
    ``,
    `Score: ${score}/${questions.length} (${percent.toFixed(1)}%)`,
    ``,
    `Detailed results:`,
    ...detail.map(
      (d, i) =>
        `Q${i + 1}. ${d.question}\nYour answer: ${d.user
          .map((x) => d.options[x])
          .join(", ") || "None"}\nCorrect answer: ${d.correct
          .map((x) => d.options[x])
          .join(", ")}\nResult: ${d.isCorrect ? "✅ Correct" : "❌ Incorrect"}\n`
    ),
  ].join("\n");

  // --- Styled HTML version ---
  const htmlBody = `
  <div style="font-family:Arial,Helvetica,sans-serif; color:#1a1a1a;">
    <h2 style="color:#2563eb;">C Concepts Assessment Report</h2>
    <p><strong>Score:</strong> ${score}/${questions.length} 
       (<span style="color:${percent >= 70 ? '#16a34a' : '#dc2626'};">${percent.toFixed(1)}%</span>)</p>
    <hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb;">
    <h3>Detailed Breakdown</h3>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#f3f4f6;text-align:left;">
          <th style="padding:8px;">#</th>
          <th style="padding:8px;">Question</th>
          <th style="padding:8px;">Your Answer</th>
          <th style="padding:8px;">Correct Answer</th>
          <th style="padding:8px;">Result</th>
        </tr>
      </thead>
      <tbody>
        ${detail
          .map(
            (d, i) => `
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding:8px;">${i + 1}</td>
            <td style="padding:8px;">${d.question}</td>
            <td style="padding:8px;">${d.user.map((x) => d.options[x]).join(", ") || "None"}</td>
            <td style="padding:8px;">${d.correct.map((x) => d.options[x]).join(", ")}</td>
            <td style="padding:8px;">
              <span style="color:${d.isCorrect ? "#16a34a" : "#dc2626"};">
                ${d.isCorrect ? "✅ Correct" : "❌ Incorrect"}
              </span>
            </td>
          </tr>
          <tr>
            <td></td>
            <td colspan="4" style="padding:8px;color:#4b5563;font-size:0.9em;">
              💬 ${d.explanation}
            </td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
    <p style="margin-top:24px;font-size:0.9em;color:#6b7280;">
      Sent automatically via <strong>Resend API</strong> • ${new Date().toLocaleString()}
    </p>
  </div>`;

  // ✅ Send via Resend API
  sendEmail(subject, textBody, htmlBody);

  res.json({ score, total: questions.length, percent, detail });
});

// --- START SERVER ---
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
