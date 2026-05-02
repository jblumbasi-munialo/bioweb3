// ========== AI CHATBOT (Gemini) ==========
let geminiApiKey = localStorage.getItem('geminiApiKey') || '';

function saveApiKey() {
    const keyInput = document.getElementById('geminiApiKey');
    if (keyInput) {
        geminiApiKey = keyInput.value.trim();
        localStorage.setItem('geminiApiKey', geminiApiKey);
        addChatMessage('System', 'API key saved. You can now chat about science topics.', 'info');
    }
}

function addChatMessage(sender, text, type = 'user') {
    const chatBox = document.getElementById('chatBox');
    const messageDiv = document.createElement('div');
    messageDiv.className = `mb-2 p-2 rounded ${type === 'user' ? 'bg-primary text-white text-end' : (type === 'bot' ? 'bg-light border' : 'bg-secondary text-white')}`;
    messageDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const question = input.value.trim();
    if (!question) return;
    input.value = '';

    addChatMessage('You', question, 'user');

    if (!geminiApiKey) {
        addChatMessage('Bot', 'Please enter your Gemini API key in the field above and click Save.', 'bot');
        return;
    }

    // System prompt to keep the bot focused on bioinformatics & platform topics
    const systemPrompt = `You are a helpful scientific assistant for a bioinformatics and drug discovery platform called BioWeb3. 
The platform offers: 
- Protein sequence analysis (GC%, reverse complement)
- AlphaFold structure prediction via UniProt search
- Molecular docking simulation
- Blockchain recording of research (BIO tokens)
- Drug pricing in Kenyan Shillings

Answer only questions related to bioinformatics, protein structure, drug discovery, molecular docking, genomics, and the features of this website. 
If the user asks something completely unrelated (e.g., weather, politics, general knowledge not related to science), politely redirect them: "I'm specialized in bioinformatics and drug discovery. Could you ask a question related to proteins, genes, docking, or our platform?".
Keep answers concise and scientific.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: systemPrompt + "\n\nUser question: " + question }]
                }]
            })
        });
        const data = await response.json();
        if (data.error) {
            addChatMessage('Bot', `API error: ${data.error.message}. Please check your key.`, 'bot');
        } else {
            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";
            addChatMessage('Bot', reply, 'bot');
        }
    } catch (err) {
        addChatMessage('Bot', 'Network error. Please try again.', 'bot');
        console.error(err);
    }
}

// Load saved API key on startup
window.addEventListener('DOMContentLoaded', () => {
    if (geminiApiKey && document.getElementById('geminiApiKey')) {
        document.getElementById('geminiApiKey').value = geminiApiKey;
    }
});
