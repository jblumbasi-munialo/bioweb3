// ========== CONTENT & CONFIG MANAGER ==========
// Extracted from bio-core.js

class ContentManager {
    constructor() { this.config = null; }

    async loadConfig() {
        try {
            let resp = await fetch('./data/config.json');
            if (!resp.ok) resp = await fetch('./config.json');
            this.config = await resp.json();
        } catch (err) {
            console.error('Could not load config.json:', err);
            this.config = { drugs: {}, exchangeRate: 130 };
        }

        try {
            const fx = await fetch('https://api.frankfurter.app/latest?from=USD&to=KES');
            if (fx.ok) {
                const fxData = await fx.json();
                if (fxData.rates && fxData.rates.KES) {
                    this.config.exchangeRate = fxData.rates.KES;
                    console.log(`✅ Live KES rate: ${this.config.exchangeRate.toFixed(2)}`);
                }
            }
        } catch (err) {
            console.warn('FX API unavailable, using config rate:', this.config.exchangeRate);
        }

        this.applyPrices();
    }

    applyPrices() {
        let tbody = document.querySelector('#priceTable tbody');
        if (!tbody || !this.config) return;
        tbody.innerHTML = '';
        const note = document.getElementById('exchangeRateNote');
        if (note) note.textContent = `Live rate: 1 USD = ${(this.config.exchangeRate || 130).toFixed(2)} KES`;

        for (let [drug, price] of Object.entries(this.config.drugs || {})) {
            let row = tbody.insertRow();
            row.insertCell(0).innerText = drug;
            row.insertCell(1).innerText = `$${(price.usdPrice || 0).toLocaleString()}`;
            let kes = Math.round((price.usdPrice || 0) * (this.config.exchangeRate || 130));
            row.insertCell(2).innerHTML = `<span class="price-tag">KES ${kes.toLocaleString()}</span>`;
        }
    }

    showNotification(msg) {
        let div = document.createElement('div');
        div.innerHTML = `<i class="fas fa-info-circle"></i> ${msg}`;
        div.style.cssText = 'position:fixed;top:80px;right:20px;background:white;padding:12px 20px;border-radius:12px;box-shadow:0 5px 15px rgba(0,0,0,0.2);z-index:3000';
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }
}

const cm = new ContentManager();
