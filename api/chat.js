export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { question } = req.body;
    if (!question) {
        return res.status(400).json({ error: 'Question is required' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Server misconfiguration: missing API key' });
    }

    const systemPrompt = `You are a helpful scientific assistant for a bioinformatics and drug discovery platform called BioWeb3. 
The platform offers: 
- Protein sequence analysis (GC%, reverse complement)
- AlphaFold structure prediction via UniProt search
- Molecular docking simulation
- Blockchain recording of research (BIO tokens)
- Drug pricing in Kenyan Shillings

Answer only questions related to bioinformatics, protein structure, drug discovery, molecular docking, genomics, and the features of this website. 
If the user asks something completely unrelated (e.g., weather, politics, sports), politely redirect them: "I'm specialized in bioinformatics and drug discovery. Could you ask a question related to proteins, genes, docking, or our platform?".
Keep answers concise and scientific.`;

    try {
        // CORRECT MODEL NAME for Gemini 1.5 Flash (free tier)
        const modelName = "gemini-1.5-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt + "\n\nUser question: " + question }] }]
            })
        });

        const data = await response.json();
        if (data.error) {
            console.error('Gemini API error:', data.error);
            return res.status(500).json({ error: `Gemini error: ${data.error.message}` });
        }
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";
        return res.status(200).json({ reply });
    } catch (err) {
        console.error('Network error:', err);
        return res.status(500).json({ error: err.message });
    }
}
