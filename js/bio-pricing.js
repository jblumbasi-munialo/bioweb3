// ========== PRICING & DRUG INFORMATION ==========
// Feature module: Pricing tab

async function refreshPrices() {
    await cm.loadConfig();
    cm.showNotification("Prices updated with live rate");
}

// Initialize pricing on module load
document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.querySelector('[data-bs-target="#pricing"] ~ * button, [onclick="refreshPrices()"]');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshPrices);
    }
});
