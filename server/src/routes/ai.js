import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();

function buildDemoStudyGuide(text) {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 8);

  const bullets = lines.length ? lines : [text.slice(0, 200)];

  return `
STUDY GUIDE

Summary
These notes cover ${bullets[0] || 'the main study topic'}. The material includes several important details that should be reviewed before a quiz or exam. Focus on the terms, definitions, examples, and relationships between concepts.

Key Concepts
${bullets.slice(0, 6).map(line => `- ${line}`).join('\n')}

Flashcards
${bullets.slice(0, 3).map((line, i) => `Q: What does this point mean: ${line}?
A: Review this idea and explain it in your own words.`).join('\n\n')}

Practice Questions
1. What is the main idea of these notes?
2. What are the most important terms or definitions?
3. How do the listed concepts connect to each other?
`.trim();
}

router.post('/summarize', async (req, res) => {
  try {
    const text = String(req.body.text || '').slice(0, 12000);

    if (!text.trim()) {
      return res.status(400).json({ error: 'Text required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        summary: buildDemoStudyGuide(text)
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
You are an AI study assistant.

Turn the following student notes into a clear study guide.

Use this exact format:

STUDY GUIDE

Summary
Write a clear 4-6 sentence summary.

Key Concepts
- List 5-8 important concepts.
- Each concept should be short and useful.

Flashcards
Q: Question
A: Answer

Q: Question
A: Answer

Q: Question
A: Answer

Practice Questions
1. Question
2. Question
3. Question

Student notes:
${text}
`;

    const result = await model.generateContent(prompt);

    res.json({
      summary: result.response.text()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI summary failed' });
  }
});

export default router;