// ========== PUBMED RESEARCH SEARCH ==========

(function () {
    'use strict';

    const apiBase = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
    const contactEmail = 'bioweb3.research@example.com';

    function setStatus(message, type = 'muted') {
        const status = document.getElementById('pubmedStatus');
        if (!status) return;
        status.textContent = message;
        status.className = `mt-2 text-${type}`;
    }

    function renderResults(results) {
        const container = document.getElementById('pubmedResults');
        if (!container) return;
        container.replaceChildren();

        if (!results.length) {
            setStatus('No PubMed articles matched that search.', 'muted');
            return;
        }

        const list = document.createElement('div');
        list.className = 'list-group';
        results.forEach(article => {
            const item = document.createElement('article');
            item.className = 'list-group-item';

            const title = document.createElement('h6');
            title.className = 'mb-1';
            title.textContent = article.title || 'Untitled article';

            const meta = document.createElement('p');
            meta.className = 'small text-muted mb-2';
            meta.textContent = `${article.source || 'PubMed'} · ${article.pubDate || 'Date unavailable'} · PMID ${article.uid}`;

            const link = document.createElement('a');
            link.href = `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(article.uid)}/`;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = 'Open article on PubMed';

            item.append(title, meta, link);
            list.appendChild(item);
        });
        container.appendChild(list);
        setStatus(`${results.length} PubMed article${results.length === 1 ? '' : 's'} found.`, 'success');
    }

    async function searchPubMed(query) {
        const searchUrl = new URL(`${apiBase}/esearch.fcgi`);
        searchUrl.search = new URLSearchParams({
            db: 'pubmed',
            term: query,
            retmode: 'json',
            retmax: '8',
            tool: 'BioWeb3',
            email: contactEmail
        });
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) throw new Error('PubMed search failed');
        const searchData = await searchResponse.json();
        const ids = searchData.esearchresult?.idlist || [];
        if (!ids.length) return [];

        const summaryUrl = new URL(`${apiBase}/esummary.fcgi`);
        summaryUrl.search = new URLSearchParams({
            db: 'pubmed',
            id: ids.join(','),
            retmode: 'json',
            tool: 'BioWeb3',
            email: contactEmail
        });
        const summaryResponse = await fetch(summaryUrl);
        if (!summaryResponse.ok) throw new Error('PubMed article lookup failed');
        const summaryData = await summaryResponse.json();
        return ids.map(id => summaryData.result?.[id]).filter(Boolean);
    }

    async function handleSubmit(event) {
        event.preventDefault();
        const input = document.getElementById('pubmedQuery');
        const button = document.getElementById('pubmedSearchBtn');
        const query = input?.value.trim();
        if (!query) return;

        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        setStatus('Searching PubMed...', 'muted');
        document.getElementById('pubmedResults')?.replaceChildren();
        try {
            renderResults(await searchPubMed(query));
        } catch (error) {
            setStatus('PubMed is temporarily unavailable. Please try again later.', 'danger');
        } finally {
            button.disabled = false;
            button.removeAttribute('aria-busy');
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('pubmedSearchForm')?.addEventListener('submit', handleSubmit);
    });
})();
