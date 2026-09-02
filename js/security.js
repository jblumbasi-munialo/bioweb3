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
        if (!window.account) {
            setStatus(status, 'Connect your wallet first.', 'warning');
            return;
        }
        if (!window.supabaseClient) {
            setStatus(status, 'Secure data sharing is not configured.', 'warning');
            return;
        }

        const { data, error } = await window.supabaseClient
            .from('user_variants')
            .select('chromosome')
            .eq('wallet_address', window.account);
        if (error || !data || data.length === 0) {
            setStatus(status, 'No variants available to share.', 'danger');
            return;
        }

        const counts = data.reduce((result, variant) => {
            const chromosome = String(variant.chromosome || '').slice(0, 32);
            if (chromosome) result[chromosome] = (result[chromosome] || 0) + 1;
            return result;
        }, {});
        const { error: insertError } = await window.supabaseClient
            .from('aggregated_counts')
            .insert({
                chromosome: Object.keys(counts),
                count: Object.values(counts),
                submitted_by: window.account
            });
        if (insertError) {
            setStatus(status, 'The de-identified contribution could not be saved.', 'danger');
            return;
        }

        if (typeof window.addRecord === 'function') {
            window.addRecord('Research Contribution', 'Shared de-identified variant counts', 5);
        }
        setStatus(status, 'Thank you. De-identified counts shared and +5 BIO earned.', 'success');
    };
})();
