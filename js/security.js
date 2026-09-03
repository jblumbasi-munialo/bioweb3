// ========== CLIENT SECURITY HELPERS ==========

(function () {
    'use strict';

    function escapeHtml(value) {
        const element = document.createElement('span');
        element.textContent = value == null ? '' : String(value);
        return element.innerHTML;
    }

    function setStatus(element, message, type) {
        if (!element) return;
        element.textContent = message;
        element.className = `mt-2 text-${type}`;
    }

    window.BioSecurity = Object.freeze({
        escapeHtml,
        setStatus,
        getStorageItem(key) {
            try {
                return window.localStorage.getItem(key);
            } catch (error) {
                console.warn('Secure storage unavailable:', error);
                return null;
            }
        },
        setStorageItem(key, value) {
            try {
                window.localStorage.setItem(key, value);
                return true;
            } catch (error) {
                console.warn('Secure storage unavailable:', error);
                return false;
            }
        }
    });

    window.optInAndShare = async function optInAndShare() {
        const status = document.getElementById('aggStatus');
        const button = document.getElementById('optInBtn');
        const walletAccount = typeof account !== 'undefined' ? account : null;
        const database = typeof supabaseClient !== 'undefined' ? supabaseClient : null;
        if (!walletAccount) {
            setStatus(status, 'Connect your wallet first.', 'warning');
            return;
        }
        if (!database) {
            setStatus(status, 'Secure data sharing is not configured.', 'warning');
            return;
        }

        if (button) {
            button.disabled = true;
            button.setAttribute('aria-busy', 'true');
            button.innerHTML = '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span> Preparing secure contribution...';
        }
        setStatus(status, 'Checking your private variant counts...', 'muted');

        try {
            const { data, error } = await database
                .from('user_variants')
                .select('chromosome')
                .eq('wallet_address', walletAccount);
            if (error || !data || data.length === 0) {
                setStatus(status, 'No variants available to share.', 'danger');
                return;
            }

            const counts = data.reduce((result, variant) => {
                const chromosome = String(variant.chromosome || '').slice(0, 32);
                if (chromosome) result[chromosome] = (result[chromosome] || 0) + 1;
                return result;
            }, {});
            const { error: insertError } = await database
                .from('aggregated_counts')
                .insert({
                    chromosome: Object.keys(counts),
                    count: Object.values(counts),
                    submitted_by: walletAccount
                });
            if (insertError) {
                setStatus(status, 'The de-identified contribution could not be saved.', 'danger');
                return;
            }

            if (typeof addRecord === 'function') {
                addRecord('Research Contribution', 'Shared de-identified variant counts', 5);
            }
            setStatus(status, 'Thank you. De-identified counts shared and +5 BIO earned.', 'success');
        } catch (error) {
            setStatus(status, 'Secure contribution failed. Please try again.', 'danger');
        } finally {
            if (button) {
                button.disabled = false;
                button.removeAttribute('aria-busy');
                button.innerHTML = '<i class="fas fa-shield-alt me-1"></i> Opt In & Share My Data';
            }
        }
    };
})();
