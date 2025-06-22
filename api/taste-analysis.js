import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Your Firebase service account JSON as an env var
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { uid } = req.body;
  if (!uid) return res.status(400).json({ error: 'Missing uid' });

  // 1. Fetch the user’s ratings from Firestore
  const userDoc = await db.collection('users').doc(uid).get();
  const ratings = userDoc.exists ? userDoc.data().ratings || {} : {};

  // 2. Build your prompt
  const prompt = `
Analyze the following user ratings and write a friendly summary of their taste in movies and TV shows.
Include: favorite genres, overall sentiment, and end with one recommendation.
User ratings JSON:
${JSON.stringify(ratings, null, 2)}
`;

  // 3. Call Ollama’s generate endpoint
  const ollamaRes = await fetch(
    `${process.env.OLLAMA_HOST}/v1/generate`, // adjust path to your Ollama API 
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama2',
        prompt,
        max_tokens: 512,
      }),
    }
  );
  if (!ollamaRes.ok) {
    const text = await ollamaRes.text();
    return res.status(500).json({ error: 'Ollama error', details: text });
  }
  const { choices } = await ollamaRes.json();

  // 4. Return the analysis
  res.status(200).json({ analysis: choices[0].text.trim() });
}
