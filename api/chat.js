// api/chat.js
// This is the serverless function that will now call the Groq API.

export default async function handler(req, res) {
    // 1. Allow only POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 2. Get the user's question from the request body
    const { question } = req.body;
    if (!question) {
        return res.status(400).json({ error: 'Question is required' });
    }

    // 3. Get your API key from Vercel's environment variables
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
        return res.status(500).json({ error: 'Server misconfiguration: missing API key' });
    }

    // 4. The system prompt to keep your chatbot focused on science
    const systemPrompt = `You are the scientific AI assistant for a bioinformatics platform called BioWeb3. 
The platform's main features are: protein sequence analysis, AlphaFold structure prediction, molecular docking simulation, a blockchain research ledger, and drug pricing in Kenyan Shillings.

Your job is to answer questions only about bioinformatics, protein structures, drug discovery, molecular docking, genomics, or how to use the BioWeb3 platform. If the user asks about anything unrelated (like sports, politics, or general news), politely state that you specialize in bioinformatics and drug discovery and redirect them to ask a relevant question.
Keep your answers concise, helpful, and focused on science.`;

    try {
        // 5. Call the Groq API
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile', // A powerful, fast free model on Groq
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: question }
                ],
                temperature: 0.7, // Controls randomness. Lower is more focused.
            }),
        });

        const data = await response.json();

        if (data.error) {
            console.error('Groq API error:', data.error);
            return res.status(500).json({ error: `Groq API error: ${data.error.message}` });
        }

        // 6. Extract the text reply from the API's response
        const reply = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";
        return res.status(200).json({ reply });
    } catch (err) {
        console.error('Network error:', err);
        return res.status(500).json({ error: err.message });
    }
}
