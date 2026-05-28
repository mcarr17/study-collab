import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();

router.post('/summarize', async (req, res) => {
  const text = String(req.body.text || '').slice(0, 12000);
  if (!text) return res.status(400).json({ error: 'Text required' });
  if (!process.env.GEMINI_API_KEY) {
    return res.json({ summary: `Demo summary: ${text.slice(0, 300)}${text.length > 300 ? '...' : ''}`, quiz: ['What is the main idea?', 'What are two key details?'] });
  }
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent(`Summarize these study notes and create 3 quiz questions:\n\n${text}`);
  res.json({ summary: result.response.text() });
});

export default router;
