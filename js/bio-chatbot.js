// ========== CHATBOT FEATURE ==========
// AI-powered assistant using Groq/Anthropic API

const SYSTEM_PROMPT = "You are a helpful scientific assistant for BioWeb3. Features: protein sequence analysis, AlphaFold 3D structures, molecular docking, blockchain research ledger, KES drug pricing, CRISPR analysis, drug discovery, GO enrichment, genome browser, DEG pipeline, survival analysis, and Healthcare 5.0. Answer concisely.";

let conversationHistory = [];
let chatbotOpen = false;

function addChatMessage(text, role) {
    const container = document.getElementById('chatbotMessages');
    if (!container) return;
    const clear = document.createElement('div');
    clear.style.clear = 'both';
    container.appendChild(clear);
    const wrap = document.createElement('div');
    wrap.className = 'message-bubble';
    const bubble = document.createElement('div');
    bubble.className = role === 'user' ? 'user-bubble' : 'bot-bubble';
    bubble.textContent = text;
    wrap.appendChild(bubble);
    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;
    return bubble;
}

function addSystemBubble(text) {
    const container = document.getElementById('chatbotMessages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'message-bubble system-bubble';
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
    const input = document.getElementById('chatbotInput');
    const sendBtn = document.getElementById('chatbotSendBtn');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;

    addChatMessage(text, 'user');
    conversationHistory.push({ role: 'user', content: text });

    const typingBubble = addChatMessage('…', 'assistant');

    try {
        const resp = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: conversationHistory, system: SYSTEM_PROMPT })
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${resp.status}`);
        }

        const data = await resp.json();
        const reply = data.content?.[0]?.text || data.reply || 'No response.';
        typingBubble.textContent = reply;

        conversationHistory.push({ role: 'assistant', content: reply });
        if (conversationHistory.length > 20) conversationHistory = conversationHistory.slice(-20);

    } catch (err) {
        typingBubble.textContent = '⚠️ ' + err.message;
        addSystemBubble('Check that /api/chat is deployed.');
        conversationHistory.pop();
    } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
    }
}

function clearChatHistory() {
    conversationHistory = [];
    const container = document.getElementById('chatbotMessages');
    if (container) container.innerHTML = '<div class="message-bubble system-bubble">Chat cleared. Ask me about bioinformatics!</div>';
}

function toggleChatbot() {
    chatbotOpen = !chatbotOpen;
    const win = document.getElementById('chatbotWindow');
    if (win) win.style.display = chatbotOpen ? 'flex' : 'none';
}

function closeChatbot() {
    chatbotOpen = false;
    const win = document.getElementById('chatbotWindow');
    if (win) win.style.display = 'none';
}

function setupChatbotEvents() {
    const input   = document.getElementById('chatbotInput');
    const sendBtn = document.getElementById('chatbotSendBtn');
    const toggle  = document.getElementById('chatbotToggleBtn');
    const close   = document.getElementById('closeChatbotBtn');
    if (input)   input.addEventListener('keypress', e => { if (e.key === 'Enter') sendChatMessage(); });
    if (sendBtn) sendBtn.addEventListener('click', sendChatMessage);
    if (toggle)  toggle.addEventListener('click', toggleChatbot);
    if (close)   close.addEventListener('click', closeChatbot);
}
