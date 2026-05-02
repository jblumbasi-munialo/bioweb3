export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Messages array is required' });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
        return res.status(500).json({ error: 'Server misconfiguration: missing API key' });
    }

    // Limit history to avoid token overflow (keep last 20 messages + system)
    let conversation = messages;
    if (conversation.length > 21) {
        conversation = [conversation[0], ...conversation.slice(-20)];
    }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: conversation,
                temperature: 0.7,
            }),
        });

        const data = await response.json();
        if (data.error) {
            console.error('Groq API error:', data.error);
            return res.status(500).json({ error: `Groq API error: ${data.error.message}` });
        }

        const reply = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";
        return res.status(200).json({ reply });
    } catch (err) {
        console.error('Network error:', err);
        return res.status(500).json({ error: err.message });
    }
}
