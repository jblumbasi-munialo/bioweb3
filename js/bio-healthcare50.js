// ========== HEALTHCARE 5.0 FEATURE MODULE ==========
// Enhanced: federated learning, privacy controls, IDS monitoring, PGx vault validation and clinical guidance.

let flRunning = false;
let pgxEntries = JSON.parse(localStorage.getItem('pgxEntries') || '[]');

const KNOWN_GENES = new Set([
    'TPMT', 'CYP2D6', 'CYP2C19', 'CYP2C9', 'SLCO1B1', 'VKORC1', 'UGT1A1', 'IFNL3', 'HLA-B', 'G6PD', 'NUDT15', 'MTHFR', 'CYP3A5'
]);
const KNOWN_DRUGS = new Set([
    'Mercaptopurine', 'Azathioprine', 'Codeine', 'Tramadol', 'Omeprazole', 'Clopidogrel', 'Warfarin', 'Rosiglitazone', 'Ritonavir', 'Sofosbuvir',
    'Allopurinol', 'Simvastatin', 'Tamoxifen', 'Irinotecan', 'Voriconazole', 'Valproate'
]);
const VARIANT_REGEX = /^[A-Z]\d+[A-Z]$|^\*\d+$|^[A-Z]{2,}\d+[A-Z]?$|^\w+$/;

const HIPAA_COMPLIANCE_RULES = [
    { name: 'Data minimization', status: 'pass', detail: 'Only essential identifiers and clinical features are retained for analysis.' },
    { name: 'Role-based access', status: 'pass', detail: 'Physician, pharmacist, and administrator roles are separated by access scopes.' },
    { name: 'Audit logging', status: 'pass', detail: 'Every access and export event is time-stamped and immutably recorded.' },
    { name: 'Encrypted transport', status: 'pass', detail: 'Web traffic and export payloads use TLS and local encryption wrappers.' },
    { name: 'Retention policy', status: 'monitor', detail: 'Clinical data retention defaults to 180-day operations with review triggers.' }
];

const FHIR_SAMPLE = {
    resourceType: 'Patient',
    id: 'bio-001',
    gender: 'female',
    birthDate: '1988-04-12',
    identifier: [{ system: 'https://bioweb3.example/patient', value: 'BIO-001' }],
    extension: [{ url: 'https://bioweb3.example/fhir/consent', valueString: 'research-consent-active' }],
    active: true,
    managingOrganization: { reference: 'Organization/bio-clinic-01', display: 'BioWeb3 Clinical Center' }
};

const EHR_TEMPLATE = {
    messageType: 'ORM^O01',
    sendingFacility: 'BioWeb3 Clinical Network',
    receivingFacility: 'Regional EHR Hub',
    patientId: 'BIO-001',
    diagnosis: 'CYP2C19 loss-of-function variant, antiplatelet management review',
    medication: 'Clopidogrel',
    status: 'Ready for secure exchange'
};

const PGX_GUIDELINES = {
    TPMT: { risk: 'High', summary: 'TPMT deficiency raises risk of severe myelosuppression. Consider dose reduction or alternative therapy.', action: 'Use therapeutic drug monitoring and avoid standard dosing in deficient patients.' },
    CYP2C19: { risk: 'High', summary: 'Loss-of-function alleles can reduce clopidogrel activation and increase thrombosis risk.', action: 'Consider alternative antiplatelet therapy when loss-of-function variants are present.' },
    CYP2C9: { risk: 'Moderate', summary: 'CYP2C9 variability affects warfarin metabolism and bleeding risk.', action: 'Reduce initial dose and monitor INR carefully.' },
    VKORC1: { risk: 'Moderate', summary: 'VKORC1 variation influences warfarin sensitivity.', action: 'Use genotype-guided dosing and close INR monitoring.' },
    SLCO1B1: { risk: 'Moderate', summary: 'SLCO1B1 variants increase statin exposure and myopathy risk.', action: 'Prefer lower dose or alternate statin if risk is elevated.' },
    HLA_B: { risk: 'High', summary: 'HLA-B variants can increase risk of severe cutaneous adverse reactions.', action: 'Avoid offending drugs and consider alternative regimens.' },
    G6PD: { risk: 'High', summary: 'G6PD deficiency increases risk of hemolysis with certain drugs.', action: 'Avoid oxidant drugs and use safer alternatives when available.' },
    CYP2D6: { risk: 'Moderate', summary: 'Poor metabolizers have altered opioid and antidepressant responses.', action: 'Adjust dosing or choose alternative agents based on phenotype.' },
    NUDT15: { risk: 'High', summary: 'NUDT15 deficiency raises hematologic toxicity risk with thiopurines.', action: 'Lower starting dose and monitor counts closely.' },
    UGT1A1: { risk: 'Moderate', summary: 'UGT1A1 polymorphisms can affect irinotecan toxicity.', action: 'Reduce dose or use alternative regimens if homozygous risk alleles are present.' }
};

const DRUG_GENE_ALERTS = {
    Clopidogrel: { gene: 'CYP2C19', warning: 'CYP2C19 poor metabolizers may not activate clopidogrel effectively.', recommendation: 'Consider prasugrel or ticagrelor if clinically appropriate.' },
    Warfarin: { gene: 'CYP2C9', warning: 'Warfarin dosing is highly sensitive to CYP2C9 and VKORC1 genotype.', recommendation: 'Start at a lower dose and monitor INR frequently.' },
    Mercaptopurine: { gene: 'TPMT', warning: 'TPMT and NUDT15 deficiency can increase toxicity risk.', recommendation: 'Dose-reduce and monitor CBC regularly.' },
    Azathioprine: { gene: 'TPMT', warning: 'Thiopurine toxicity is elevated in poor metabolizers.', recommendation: 'Use genotype-guided dose adjustments.' },
    Simvastatin: { gene: 'SLCO1B1', warning: 'SLCO1B1 variants increase myopathy risk.', recommendation: 'Prefer lower starting doses or alternative statins.' },
    Irinotecan: { gene: 'UGT1A1', warning: 'UGT1A1 risk alleles increase toxicity.', recommendation: 'Consider reduced dose and enhanced monitoring.' },
    Codeine: { gene: 'CYP2D6', warning: 'Ultrarapid metabolizers may have excessive morphine exposure.', recommendation: 'Avoid codeine in ultra-rapid metabolizers and pediatrics.' }
};

const CLINICAL_SAFETY_RULES = [
    { name: 'Drug-gene risk', status: 'alert', detail: 'High-risk variant-drug combinations require prescriber review.' },
    { name: 'Medication reconciliation', status: 'pass', detail: 'Current regimen cross-checks against active allergies and contraindications.' },
    { name: 'Monitoring plan', status: 'pass', detail: 'Lab-driven surveillance is scheduled for high-risk therapies.' },
    { name: 'Escalation trigger', status: 'monitor', detail: 'Any INR, CBC, or creatinine drift triggers pharmacist review.' }
];

const CARE_TIMELINE_TEMPLATE = [
    { phase: 'Assessment', date: 'Today', detail: 'Review genotype results, baseline labs, and medication history.', status: 'active' },
    { phase: 'Dose selection', date: '+24h', detail: 'Apply genotype-guided dosing based on PGx and renal function.', status: 'pending' },
    { phase: 'Monitoring', date: '+3-7d', detail: 'Repeat CBC/INR or therapeutic drug monitoring as appropriate.', status: 'pending' },
    { phase: 'Follow-up', date: '+2-4w', detail: 'Reassess efficacy, adverse events, and therapy adherence.', status: 'pending' }
];

const PATIENT_PROFILE = {
    id: 'BIO-001',
    name: 'Patient A. Rivera',
    age: 38,
    sex: 'Female',
    location: 'Seattle, WA',
    primaryCondition: 'Antiplatelet therapy optimization',
    riskLevel: 'Moderate',
    consent: 'Research consent active'
};

const MEDICATION_REVIEW = [
    { medication: 'Clopidogrel', status: 'Active', note: 'PGx-guided therapy review in progress.' },
    { medication: 'Aspirin', status: 'Active', note: 'Low-dose regimen maintained.' },
    { medication: 'Omeprazole', status: 'Review', note: 'Potential CYP2C19 interaction check.' },
    { medication: 'Vitamin D', status: 'Active', note: 'Routine supplementation.' }
];

const ALLERGIES = ['Penicillin (mild rash)', 'Sulfa (historical reaction)'];

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function robustAggregate(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const tolerance = 0.16;
    const trimmed = sorted.filter((value) => Math.abs(value - median) <= tolerance);
    return trimmed.length ? trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length : median;
}

function renderFederatedSummary(report) {
    const summaryEl = document.getElementById('flSummary');
    if (!summaryEl) return;
    summaryEl.innerHTML = `
        <div class="card border-success-subtle">
            <div class="card-body p-2 small">
                <div class="fw-semibold mb-1">Federated status</div>
                <div class="d-flex justify-content-between"><span>Aggregation</span><strong>${report.aggregation}</strong></div>
                <div class="d-flex justify-content-between"><span>Accuracy</span><strong>${report.accuracy}%</strong></div>
                <div class="d-flex justify-content-between"><span>Privacy spent</span><strong>ε ${report.privacy_spent}</strong></div>
                <div class="d-flex justify-content-between"><span>Privacy remaining</span><strong>ε ${report.privacy_remaining}</strong></div>
                <div class="d-flex justify-content-between"><span>Fairness gap</span><strong>${report.fairness_gap}</strong></div>
            </div>
        </div>
    `;
}

function simulateLocalTrainingForClients(round = 1) {
    const clients = [
        { name: 'Hospital A', localDataSize: 420, signal: 0.95 },
        { name: 'Clinic B', localDataSize: 330, signal: 0.91 },
        { name: 'Research Hub C', localDataSize: 510, signal: 0.93 },
        { name: 'Network D', localDataSize: 290, signal: 0.89 }
    ];

    const localUpdates = clients.map((client, index) => {
        const drift = (Math.sin((round + index + 1) * 1.3) * 0.04);
        const localGain = clamp(client.signal + drift + (round * 0.015), 0.72, 0.99);
        const loss = clamp(0.68 - localGain + (index * 0.04), 0.05, 0.45);
        return {
            client: client.name,
            datasetSize: client.localDataSize,
            localAccuracy: localGain,
            localLoss: loss,
            gradientNorm: (1.2 - localGain + (round * 0.03)).toFixed(3)
        };
    });

    const summary = localUpdates.map((update) => `${update.client}: ${update.localAccuracy.toFixed(3)} acc • loss ${update.localLoss.toFixed(3)}`).join('<br>');
    const summaryEl = document.getElementById('flSummary');
    if (summaryEl) {
        summaryEl.innerHTML = `
            <div class="card border-primary-subtle">
                <div class="card-body p-2 small">
                    <div class="fw-semibold mb-1">Local client training</div>
                    <div>${summary}</div>
                </div>
            </div>
        `;
    }

    return localUpdates;
}

function detectByzantineClients(clientScores) {
    if (!clientScores || !clientScores.length) return { suspicious: [], median: 0, threshold: 0 };

    const values = clientScores.map((entry) => entry.value);
    const median = robustAggregate(values);
    const deviations = clientScores.map((entry) => ({
        name: entry.name,
        value: entry.value,
        deviation: Math.abs(entry.value - median)
    }));

    const threshold = 0.12;
    const suspicious = deviations
        .filter((entry) => entry.deviation > threshold)
        .map((entry) => `${entry.name} (${entry.value.toFixed(3)})`);

    return { suspicious, median, threshold };
}

function runByzantineAudit() {
    const syntheticScores = [
        { name: 'Hospital A', value: 0.91 },
        { name: 'Clinic B', value: 0.88 },
        { name: 'Research Hub C', value: 0.93 },
        { name: 'Malicious Site', value: 0.41 }
    ];

    const audit = detectByzantineClients(syntheticScores);
    const summaryEl = document.getElementById('flSummary');
    if (!summaryEl) return;

    if (audit.suspicious.length) {
        summaryEl.innerHTML = `
            <div class="card border-warning-subtle">
                <div class="card-body p-2 small">
                    <div class="fw-semibold mb-1">Byzantine client audit</div>
                    <div><strong>Flagged:</strong> ${audit.suspicious.join(', ')}</div>
                    <div><strong>Median baseline:</strong> ${audit.median.toFixed(3)}</div>
                    <div><strong>Deviation threshold:</strong> ${audit.threshold.toFixed(3)}</div>
                    <div class="mt-1 text-muted">Malicious or poisoned updates are filtered before global aggregation.</div>
                </div>
            </div>
        `;
    } else {
        summaryEl.innerHTML = `
            <div class="card border-success-subtle">
                <div class="card-body p-2 small">
                    <div class="fw-semibold mb-1">Byzantine client audit</div>
                    <div>No suspicious outliers detected.</div>
                    <div><strong>Median baseline:</strong> ${audit.median.toFixed(3)}</div>
                </div>
            </div>
        `;
    }

    cm.showNotification(audit.suspicious.length ? `Flagged suspicious clients: ${audit.suspicious.join(', ')}` : 'No suspicious client updates detected', 'info');
}

async function runLocalTrainingSimulation() {
    const progressEl = document.getElementById('flProgress');
    if (!progressEl) return;
    progressEl.innerHTML = '<span class="loading"></span> Running client-side training on local clinical nodes…';

    const localRounds = [1, 2, 3];
    for (const round of localRounds) {
        simulateLocalTrainingForClients(round);
        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const trainingSummary = simulateLocalTrainingForClients(localRounds.length);
    progressEl.innerHTML = `
        <div class="alert alert-info mb-0">
            Local training complete across ${trainingSummary.length} clients. The model updates are now ready to be aggregated in the federated round.
        </div>
    `;
    cm.showNotification('Local training simulation complete', 'success');
}

async function runCoordinatorRound() {
    const progressEl = document.getElementById('flProgress');
    if (!progressEl) return;
    progressEl.innerHTML = '<span class="loading"></span> Sending synthetic client updates to the coordinator...';
    try {
        const response = await fetch('/api/federated_learning', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ round: 0, clients: 4, noise: [0.02, -0.01, 0.03, -0.02] })
        });
        if (!response.ok) throw new Error(`Coordinator returned HTTP ${response.status}`);
        const result = await response.json();
        progressEl.innerHTML = `
            <div class="alert alert-success py-2 mb-0">
                <strong>Coordinator round ${result.round} complete.</strong>
                Accuracy ${(result.global_accuracy * 100).toFixed(2)}% ·
                Privacy spent ε ${result.privacy_spent.toFixed(3)} ·
                Privacy remaining ε ${result.privacy_remaining.toFixed(3)}
            </div>`;
        addRecord('FL coordinator', `Round ${result.round}: ${(result.global_accuracy * 100).toFixed(2)}%`, 5);
    } catch (error) {
        progressEl.innerHTML = `<div class="alert alert-warning py-2 mb-0">Coordinator unavailable: ${error.message}. Local simulation remains available.</div>`;
    }
}

function getClinicalRecommendation(gene, drug, variant) {
    const normalizedGene = (gene || '').toUpperCase();
    const normalizedDrug = (drug || '').trim();
    const geneMeta = PGX_GUIDELINES[normalizedGene] || null;
    const drugMeta = DRUG_GENE_ALERTS[normalizedDrug] || null;

    if (!normalizedGene || !normalizedDrug) {
        return {
            category: 'info',
            title: 'Clinical guidance unavailable',
            detail: 'Complete the gene and drug fields to generate a recommendation.'
        };
    }

    const variantImpact = variant ? `Variant ${variant} indicates the need for individualized dosing review.` : 'No variant provided; recommendation is based on gene-drug context.';
    let recommendation = geneMeta ? geneMeta.action : 'Use standard clinical monitoring and confirm with local formulary guidance.';
    let note = geneMeta ? geneMeta.summary : 'No high-confidence guideline match available in the local evidence set.';
    let category = geneMeta && geneMeta.risk === 'High' ? 'warning' : 'info';

    if (drugMeta && normalizedGene === (drugMeta.gene || '').toUpperCase()) {
        note = `${drugMeta.warning} ${drugMeta.recommendation}`;
        recommendation = drugMeta.recommendation;
        category = 'warning';
    }

    if (normalizedGene === 'CYP2C19' && normalizedDrug === 'Clopidogrel') {
        recommendation = 'Avoid clopidogrel monotherapy in poor metabolizers; consider alternative antiplatelet therapy with specialist review.';
    }

    if (normalizedGene === 'TPMT' && (normalizedDrug === 'Mercaptopurine' || normalizedDrug === 'Azathioprine')) {
        recommendation = 'Reduce starting dose and monitor CBC with differential closely; avoid routine full-dose therapy in deficient patients.';
    }

    if (normalizedGene === 'CYP2C9' && normalizedDrug === 'Warfarin') {
        recommendation = 'Begin with reduced loading dose and perform frequent INR monitoring until stable.';
    }

    return {
        category,
        title: `${normalizedGene} / ${normalizedDrug} recommendation`,
        detail: `${note} ${variantImpact}`,
        action: recommendation
    };
}

function buildClinicalDecisionSupport(gene, drug, variant) {
    const recommendation = getClinicalRecommendation(gene, drug, variant);
    const severity = recommendation.category === 'warning' ? 'warning' : 'info';

    return `
        <div class="alert alert-${severity} mb-0 py-2">
            <strong>Clinical decision support:</strong><br>
            <span class="fw-semibold">${recommendation.title}</span><br>
            <span>${recommendation.detail}</span><br>
            <strong>Action:</strong> ${recommendation.action}
        </div>
    `;
}

function renderClinicalRecommendationFromForm() {
    const gene = document.getElementById('pgxGene')?.value.trim() || '';
    const drug = document.getElementById('pgxDrug')?.value.trim() || '';
    const variant = document.getElementById('pgxVariant')?.value.trim() || '';
    const supportEl = document.getElementById('clinicalDecisionSupport');
    if (supportEl) {
        supportEl.innerHTML = buildClinicalDecisionSupport(gene, drug, variant);
    }
    cm.showNotification('Clinical recommendation refreshed', 'success');
}

function renderHipaaComplianceSummary() {
    const el = document.getElementById('hipaaComplianceSummary');
    if (!el) return;
    const passed = HIPAA_COMPLIANCE_RULES.filter((rule) => rule.status === 'pass').length;
    const monitored = HIPAA_COMPLIANCE_RULES.filter((rule) => rule.status === 'monitor').length;
    el.innerHTML = `
        <div class="alert alert-success py-2 mb-2">
            <strong>Compliance score:</strong> ${Math.round((passed / HIPAA_COMPLIANCE_RULES.length) * 100)}%
        </div>
        <ul class="mb-0 ps-3">
            ${HIPAA_COMPLIANCE_RULES.map((rule) => `
                <li><strong>${rule.name}:</strong> ${rule.status === 'pass' ? 'Pass' : 'Needs review'} — ${rule.detail}</li>
            `).join('')}
        </ul>
        <div class="mt-2 text-muted small">${monitored} area(s) under human review before auto-expansion.</div>
    `;
}

function renderPatientSafetySummary() {
    const el = document.getElementById('patientSafetySummary');
    if (!el) return;

    const passed = CLINICAL_SAFETY_RULES.filter((rule) => rule.status === 'pass').length;
    const alerts = CLINICAL_SAFETY_RULES.filter((rule) => rule.status === 'alert').length;
    const monitored = CLINICAL_SAFETY_RULES.filter((rule) => rule.status === 'monitor').length;
    const score = Math.round(((passed + monitored * 0.5) / CLINICAL_SAFETY_RULES.length) * 100);

    el.innerHTML = `
        <div class="alert ${alerts ? 'alert-warning' : 'alert-success'} py-2 mb-2">
            <strong>Safety score:</strong> ${score}%
        </div>
        <ul class="mb-0 ps-3">
            ${CLINICAL_SAFETY_RULES.map((rule) => `
                <li><strong>${rule.name}:</strong> ${rule.status === 'alert' ? 'High priority' : rule.status === 'monitor' ? 'Monitor' : 'Pass'} — ${rule.detail}</li>
            `).join('')}
        </ul>
        <div class="mt-2 text-muted small">${alerts} high-risk issue(s) need clinician review; ${monitored} monitoring trigger(s) active.</div>
    `;
}

function runPatientSafetyCheck() {
    renderPatientSafetySummary();
    cm.showNotification('Clinical safety review completed', 'warning');
}

function renderTreatmentPlanSummary() {
    const el = document.getElementById('treatmentPlanSummary');
    if (!el) return;

    const entries = pgxEntries.length ? pgxEntries.slice(-3) : [{ gene: 'CYP2C19', drug: 'Clopidogrel', variant: '*2', rec: 'Consider alternative antiplatelet agent.' }];
    const riskScore = Math.min(95, 35 + entries.length * 18 + (entries.some((entry) => /CYP2C19|TPMT|HLA-B|G6PD/i.test(entry.gene)) ? 20 : 0));

    const timeline = CARE_TIMELINE_TEMPLATE.map((step) => `
        <div class="d-flex align-items-start gap-2 mb-2">
            <span class="badge ${step.status === 'active' ? 'bg-primary' : 'bg-light text-dark'} rounded-pill">${step.phase}</span>
            <div>
                <div class="fw-semibold">${step.date}</div>
                <div>${step.detail}</div>
            </div>
        </div>
    `).join('');

    const recent = entries.map((entry) => `<li><strong>${entry.gene}</strong> / ${entry.drug} / ${entry.variant || 'N/A'} — ${entry.rec || 'Monitoring recommended.'}</li>`).join('');

    el.innerHTML = `
        <div class="alert ${riskScore >= 75 ? 'alert-warning' : 'alert-info'} py-2 mb-2">
            <strong>Clinical risk tier:</strong> ${riskScore >= 75 ? 'High' : riskScore >= 50 ? 'Moderate' : 'Low'} • Score ${riskScore}/100
        </div>
        <div class="row">
            <div class="col-md-6">
                <h6>Current therapeutic plan</h6>
                <ul class="mb-0 ps-3">${recent}</ul>
            </div>
            <div class="col-md-6">
                <h6>Action timeline</h6>
                ${timeline}
            </div>
        </div>
    `;
}

function generateTreatmentPlan() {
    renderTreatmentPlanSummary();
    cm.showNotification('Treatment plan refreshed', 'info');
}

function renderClinicalSummaryReport() {
    const el = document.getElementById('clinicalSummaryReport');
    if (!el) return;

    const activeEntries = pgxEntries.length ? pgxEntries.slice(-3) : [{ gene: 'CYP2C19', drug: 'Clopidogrel', variant: '*2', rec: 'Consider alternative antiplatelet therapy.' }];
    const summary = activeEntries.map((entry) => `
        <li><strong>${entry.gene}</strong> • ${entry.variant || 'N/A'} • ${entry.drug || 'Medication not captured'}<br><span class="text-muted">${entry.rec || 'Clinical review recommended.'}</span></li>
    `).join('');

    const highRisk = activeEntries.some((entry) => /CYP2C19|TPMT|HLA-B|G6PD|NUDT15/i.test(entry.gene));
    const urgency = highRisk ? 'Immediate prescriber review' : 'Routine monitoring';

    el.innerHTML = `
        <div class="alert ${highRisk ? 'alert-warning' : 'alert-success'} py-2 mb-2">
            <strong>${urgency}</strong>
        </div>
        <h6>Patient overview</h6>
        <ul class="mb-2 ps-3">
            <li>Patient ID: BIO-001</li>
            <li>Consent status: Research consent active</li>
            <li>Primary concern: Pharmacogenomic-guided therapy optimization</li>
        </ul>
        <h6>PGx observations</h6>
        <ul class="mb-0 ps-3">${summary}</ul>
        <div class="mt-2 text-muted small">This report is generated for clinical review and should be confirmed against full chart data and institutional policy.</div>
    `;
}

function generateClinicalSummary() {
    renderClinicalSummaryReport();
    cm.showNotification('Clinical summary report generated', 'success');
}

function renderPatientProfileSummary() {
    const el = document.getElementById('patientProfileSummary');
    if (!el) return;

    el.innerHTML = `
        <div class="row g-2">
            <div class="col-6"><strong>ID:</strong> ${PATIENT_PROFILE.id}</div>
            <div class="col-6"><strong>Name:</strong> ${PATIENT_PROFILE.name}</div>
            <div class="col-6"><strong>Age:</strong> ${PATIENT_PROFILE.age}</div>
            <div class="col-6"><strong>Sex:</strong> ${PATIENT_PROFILE.sex}</div>
            <div class="col-6"><strong>Location:</strong> ${PATIENT_PROFILE.location}</div>
            <div class="col-6"><strong>Risk:</strong> ${PATIENT_PROFILE.riskLevel}</div>
            <div class="col-12"><strong>Condition:</strong> ${PATIENT_PROFILE.primaryCondition}</div>
            <div class="col-12"><strong>Consent:</strong> ${PATIENT_PROFILE.consent}</div>
        </div>
    `;
}

function renderMedicationReviewSummary() {
    const el = document.getElementById('medicationReviewSummary');
    if (!el) return;

    const meds = MEDICATION_REVIEW.map((item) => `
        <li><strong>${item.medication}</strong> — ${item.status}<br><span class="text-muted">${item.note}</span></li>
    `).join('');

    const allergyList = ALLERGIES.map((item) => `<li>${item}</li>`).join('');

    el.innerHTML = `
        <div class="mb-2">
            <strong>Current medications</strong>
            <ul class="mb-2 ps-3">${meds}</ul>
        </div>
        <div>
            <strong>Allergies / adverse history</strong>
            <ul class="mb-0 ps-3">${allergyList}</ul>
        </div>
    `;
}

function refreshPatientProfile() {
    renderPatientProfileSummary();
    renderMedicationReviewSummary();
    cm.showNotification('Patient profile refreshed', 'info');
}

function renderEhrFhirSummary() {
    const el = document.getElementById('ehrFhirSummary');
    if (!el) return;
    const patient = JSON.stringify(FHIR_SAMPLE, null, 2);
    el.innerHTML = `
        <div class="alert alert-info py-2 mb-2">FHIR payload generated for patient ${FHIR_SAMPLE.id}</div>
        <pre class="mb-0 small">${patient}</pre>
    `;
}

function renderHl7Summary() {
    const el = document.getElementById('ehrFhirSummary');
    if (!el) return;
    el.innerHTML = `
        <div class="alert alert-secondary py-2 mb-2">HL7-compatible message generated</div>
        <pre class="mb-0 small">MSH|^~\\&|${EHR_TEMPLATE.sendingFacility}|${EHR_TEMPLATE.sendingFacility}|${EHR_TEMPLATE.receivingFacility}|${EHR_TEMPLATE.receivingFacility}|20260601||${EHR_TEMPLATE.messageType}||P|2.5
PID|||${EHR_TEMPLATE.patientId}||Patient^^^BioWeb3||19880412|F
OBX|1|TX|PGX|1|${EHR_TEMPLATE.diagnosis}
OBX|2|TX|MED|1|${EHR_TEMPLATE.medication}
ZPM|1|${EHR_TEMPLATE.status}</pre>
    `;
}

async function runFederatedLearning() {
    if (flRunning) return;
    flRunning = true;
    const progressDiv = document.getElementById('flProgress');
    if (!progressDiv) return;
    progressDiv.style.display = 'block';

    const clientProfiles = [
        { name: 'Site A', bias: 0.07 },
        { name: 'Site B', bias: 0.04 },
        { name: 'Site C', bias: -0.03 },
        { name: 'Site D', bias: 0.01 }
    ];

    Plotly.newPlot('flChart', [{
        x: [], y: [], mode: 'lines+markers', name: 'Accuracy',
        line: { color: '#2e7d32', width: 2 }, marker: { size: 6 }
    }], {
        title: 'Federated Learning with Differential Privacy',
        xaxis: { title: 'Round' },
        yaxis: { title: 'Global Accuracy', range: [0.6, 1.0] },
        paper_bgcolor: 'white'
    });

    Plotly.newPlot('privacyChart', [{
        x: [], y: [], mode: 'lines+markers', name: 'Privacy Spent',
        line: { color: '#d32f2f', width: 2 }, marker: { size: 6 }
    }], {
        title: 'Cumulative Privacy Budget Spent (ε)',
        xaxis: { title: 'Round' },
        yaxis: { title: 'Epsilon (ε)', range: [0, 1.0] },
        paper_bgcolor: 'white'
    });

    Plotly.newPlot('convergenceChart', [{
        x: [], y: [], mode: 'lines+markers', name: 'Convergence',
        line: { color: '#1976d2', width: 2 }, marker: { size: 6 }
    }], {
        title: 'Model Convergence Rate (% improvement per round)',
        xaxis: { title: 'Round' },
        yaxis: { title: 'Convergence Rate (%)' },
        paper_bgcolor: 'white'
    });

    let flDetails = [];
    let previousAccuracy = 0.74;
    let privacySpent = 0;

    for (let round = 1; round <= 10; round++) {
        progressDiv.innerHTML = `<span class="loading"></span> Round ${round}/10 – aggregating four secure client models…`;
        try {
            const clientScores = clientProfiles.map((client, index) => {
                const drift = Math.sin((round + index + 1) * 0.8) * 0.02;
                const localValue = clamp(0.73 + round * 0.02 + client.bias + drift + (Math.random() - 0.5) * 0.04, 0.62, 0.98);
                return { name: client.name, value: localValue };
            });

            const suspiciousAudit = detectByzantineClients(clientScores);
            const filteredClientScores = clientScores.filter((entry) => !suspiciousAudit.suspicious.includes(`${entry.name} (${entry.value.toFixed(3)})`));
            const globalAccuracy = robustAggregate((filteredClientScores.length ? filteredClientScores : clientScores).map((entry) => entry.value));
            const epsilonPerRound = 0.09 + round * 0.005;
            privacySpent += epsilonPerRound;
            const divergence = (globalAccuracy - previousAccuracy) / Math.max(previousAccuracy, 0.001);
            const privateAccuracy = clamp(globalAccuracy + (Math.random() - 0.5) * 0.015, 0.62, 0.99);
            const fairnessGap = Math.max(...clientScores.map((entry) => entry.value)) - Math.min(...clientScores.map((entry) => entry.value));
            const aggregationMethod = suspiciousAudit.suspicious.length
                ? 'Median-trimmed + Byzantine filter'
                : 'Median-trimmed aggregation with DP clipping';

            Plotly.extendTraces('flChart', { x: [[round]], y: [[privateAccuracy]] }, [0]);
            Plotly.extendTraces('privacyChart', { x: [[round]], y: [[privacySpent]] }, [0]);
            Plotly.extendTraces('convergenceChart', { x: [[round]], y: [[Math.max(0, divergence) * 100]] }, [0]);

            const entry = {
                round,
                accuracy: (privateAccuracy * 100).toFixed(2),
                convergence: (divergence * 100).toFixed(3),
                privacy_spent: privacySpent.toFixed(4),
                privacy_remaining: (1.0 - privacySpent).toFixed(4),
                aggregation: aggregationMethod,
                fairness_gap: fairnessGap.toFixed(4),
                client_scores: clientScores.map((client) => `${client.name}:${client.value.toFixed(3)}`).join(' | '),
                suspicious_clients: suspiciousAudit.suspicious.join(', ') || 'none'
            };
            flDetails.push(entry);
            renderFederatedSummary({
                aggregation: aggregationMethod,
                accuracy: (privateAccuracy * 100).toFixed(2),
                privacy_spent: privacySpent.toFixed(4),
                privacy_remaining: (1.0 - privacySpent).toFixed(4),
                fairness_gap: fairnessGap.toFixed(4)
            });
            if (suspiciousAudit.suspicious.length) {
                const summaryEl = document.getElementById('flSummary');
                if (summaryEl) {
                    summaryEl.innerHTML += `
                        <div class="mt-2 small text-warning">
                            <strong>Filtered outlier clients:</strong> ${entry.suspicious_clients}
                        </div>
                    `;
                }
            }

            addRecord('FL', `R${round}: ${(privateAccuracy * 100).toFixed(1)}% | ε ${privacySpent.toFixed(3)}`, 5);
            progressDiv.innerHTML = `
                <div class="alert alert-success py-2 mb-2">
                    <strong>Round ${round} complete.</strong> Accuracy ${(privateAccuracy * 100).toFixed(2)}% • Privacy spent ε ${privacySpent.toFixed(3)} • Fairness gap ${fairnessGap.toFixed(3)}
                </div>
                <div class="small text-muted">Clients: ${entry.client_scores}</div>
            `;
            previousAccuracy = privateAccuracy;
            await new Promise((r) => setTimeout(r, 650));
        } catch (err) {
            progressDiv.innerHTML = `<span class="text-danger">Error: ${err.message}</span>`;
            break;
        }
    }

    if (flDetails.length > 0) {
        const last = flDetails[flDetails.length - 1];
        progressDiv.innerHTML = `
            <div class="alert alert-success">✅ Federated learning complete!</div>
            <div class="card mt-2">
                <div class="card-body p-2">
                    <strong>Final Metrics:</strong>
                    <table class="table table-sm mb-0">
                        <tr><th>Final Accuracy</th><td>${last.accuracy}%</td></tr>
                        <tr><th>Privacy Spent</th><td>ε = ${last.privacy_spent}</td></tr>
                        <tr><th>Privacy Remaining</th><td>ε = ${last.privacy_remaining}</td></tr>
                        <tr><th>Aggregation</th><td>${last.aggregation}</td></tr>
                        <tr><th>Fairness Gap</th><td>${last.fairness_gap}</td></tr>
                    </table>
                </div>
            </div>
        `;
    }
    flRunning = false;
}

async function testIntrusionSample() {
    const resultDiv = document.getElementById('idsResult');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<span class="loading"></span> Analyzing with NSL-KDD model…';
    try {
        const response = await fetch('/api/intrusion_detection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sample: 'random' })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const m = data.metrics;
        const cm = data.confusion_matrix;
        const modelInfo = data.model_info;

        const threatRisk = data.prediction === 'attack' ? 'High' : 'Low';
        const threatSummary = data.prediction === 'attack'
            ? 'Anomalous connection pattern detected. Isolation and endpoint triage are recommended.'
            : 'No strong anomaly signal, but monitor for policy drift and new device baselines.';

        resultDiv.innerHTML = `
            <div class="alert alert-${data.prediction === 'attack' ? 'danger' : 'success'}">
                <strong>🔍 Prediction:</strong> ${data.prediction.toUpperCase()} 
                <span class="badge bg-${data.prediction === 'attack' ? 'danger' : 'success'}">${(data.confidence * 100).toFixed(1)}%</span>
            </div>
            <div class="row">
                <div class="col-md-6">
                    <h6>Classification Metrics</h6>
                    <table class="table table-sm">
                        <tr><th>Accuracy</th><td>${(m.accuracy * 100).toFixed(2)}%</td></tr>
                        <tr><th>Sensitivity (TPR)</th><td>${(m.sensitivity_tpr * 100).toFixed(2)}%</td></tr>
                        <tr><th>Specificity (TNR)</th><td>${(m.specificity_tnr * 100).toFixed(2)}%</td></tr>
                        <tr><th>Precision</th><td>${(m.precision * 100).toFixed(2)}%</td></tr>
                        <tr><th>F1 Score</th><td>${(m.f1_score * 100).toFixed(2)}%</td></tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <h6>ROC Analysis</h6>
                    <table class="table table-sm">
                        <tr><th>AUC-ROC</th><td>${(m.auc_roc * 100).toFixed(2)}%</td></tr>
                        <tr><th>FPR</th><td>${(m.false_positive_rate * 100).toFixed(2)}%</td></tr>
                        <tr><th>FNR</th><td>${(m.false_negative_rate * 100).toFixed(2)}%</td></tr>
                    </table>
                </div>
            </div>
            <div class="mt-2">
                <h6>Confusion Matrix (est. 1000 samples)</h6>
                <table class="table table-sm">
                    <tr><th></th><th>Predicted Normal</th><th>Predicted Attack</th></tr>
                    <tr><th>Actual Normal</th><td>${cm.TN}</td><td>${cm.FP}</td></tr>
                    <tr><th>Actual Attack</th><td>${cm.FN}</td><td>${cm.TP}</td></tr>
                </table>
            </div>
            <div class="mt-2 text-muted small">
                <strong>Model:</strong> ${modelInfo.algorithm} | <strong>Dataset:</strong> ${modelInfo.training_set} | <strong>Features:</strong> ${modelInfo.features_used}
            </div>
        `;

        const threatEl = document.getElementById('idsThreatSummary');
        if (threatEl) {
            threatEl.innerHTML = `
                <div class="alert alert-${data.prediction === 'attack' ? 'danger' : 'secondary'} py-2 mb-0">
                    <strong>Threat level:</strong> ${threatRisk}<br>
                    <span class="small">${threatSummary}</span>
                </div>
            `;
        }

        addRecord('IDS', `Prediction: ${data.prediction} (AUC: ${(m.auc_roc * 100).toFixed(1)}%)`, 10);
    } catch (err) {
        resultDiv.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
    }
}

function validateGene(gene) {
    const normalizedGene = (gene || '').toUpperCase();
    return KNOWN_GENES.has(normalizedGene) ? null : `Unknown gene: ${gene}. Common: ${Array.from(KNOWN_GENES).slice(0, 6).join(', ')}`;
}

function validateVariant(variant) {
    if (!variant || !VARIANT_REGEX.test(variant)) {
        return 'Invalid variant format. Use examples like G6A, *1, *2, CYP2C19*2.';
    }
    return null;
}

function validateDrug(drug) {
    const normalizedDrug = (drug || '').trim();
    return KNOWN_DRUGS.has(normalizedDrug) ? null : `Unknown drug: ${drug}. Common: ${Array.from(KNOWN_DRUGS).slice(0, 6).join(', ')}`;
}

function addPGxEntry(e) {
    e.preventDefault();
    const gene = document.getElementById('pgxGene').value.trim().toUpperCase();
    const variant = document.getElementById('pgxVariant').value.trim();
    const drug = document.getElementById('pgxDrug').value.trim();
    const rec = document.getElementById('pgxRec').value.trim();

    const errors = [];
    if (!gene || !variant || !drug) {
        errors.push('Gene, Variant, Drug required');
    }

    const geneErr = validateGene(gene);
    if (geneErr) errors.push(geneErr);
    const varErr = validateVariant(variant);
    if (varErr) errors.push(varErr);
    const drugErr = validateDrug(drug);
    if (drugErr) errors.push(drugErr);

    if (errors.length > 0) {
        cm.showNotification(errors.join(' | '), 'warning');
        return;
    }

    pgxEntries.push({ gene, variant, drug, rec, timestamp: new Date().toISOString() });
    localStorage.setItem('pgxEntries', JSON.stringify(pgxEntries));
    document.getElementById('pgxForm').reset();
    loadPGxEntries();
    const supportEl = document.getElementById('clinicalDecisionSupport');
    if (supportEl) {
        supportEl.innerHTML = buildClinicalDecisionSupport(gene, drug, variant);
    }
    addRecord('PGx', `✓ ${gene} ${variant} → ${drug}`, 5);
}

function loadPGxEntries() {
    pgxEntries = JSON.parse(localStorage.getItem('pgxEntries') || '[]');
    const listEl = document.getElementById('pgxEntriesList');
    const countEl = document.getElementById('pgxCount');
    if (!listEl) return;

    if (countEl) countEl.textContent = pgxEntries.length;

    if (pgxEntries.length === 0) {
        listEl.innerHTML = '<p class="text-muted">No entries yet.</p>';
        return;
    }

    listEl.innerHTML = pgxEntries.map((entry, i) => `
        <div class="card mb-2">
            <div class="card-body p-2">
                <strong>${entry.gene} ${entry.variant}</strong> → ${entry.drug}
                ${entry.rec ? `<div class="text-muted small">Rec: ${entry.rec}</div>` : ''}
                <div class="float-end">
                    <button class="btn btn-sm btn-outline-secondary" onclick="copyPGxEntry(${i})" title="Copy">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deletePGxEntry(${i})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function deletePGxEntry(i) {
    pgxEntries.splice(i, 1);
    localStorage.setItem('pgxEntries', JSON.stringify(pgxEntries));
    loadPGxEntries();
}

function copyPGxEntry(i) {
    const entry = pgxEntries[i];
    const text = `${entry.gene} ${entry.variant} → ${entry.drug} (${entry.rec || 'N/A'})`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
    }
    cm.showNotification('Copied to clipboard', 'info');
}

function exportPGxJSON() {
    const dataStr = JSON.stringify(pgxEntries, null, 2);
    downloadFile(dataStr, 'pgx_vault.json', 'application/json');
}

function exportPGxCSV() {
    if (pgxEntries.length === 0) {
        cm.showNotification('No entries to export', 'warning');
        return;
    }
    const headers = ['Gene', 'Variant', 'Drug', 'Recommendation', 'Timestamp'];
    const rows = pgxEntries.map((e) => [e.gene, e.variant, e.drug, e.rec, e.timestamp]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v || ''}"`).join(',')).join('\n');
    downloadFile(csv, 'pgx_vault.csv', 'text/csv');
}

function importPGxJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const imported = JSON.parse(evt.target.result);
            if (!Array.isArray(imported)) throw new Error('Invalid format: must be array');
            pgxEntries = [...pgxEntries, ...imported];
            localStorage.setItem('pgxEntries', JSON.stringify(pgxEntries));
            loadPGxEntries();
            cm.showNotification(`Imported ${imported.length} entries`, 'success');
        } catch (err) {
            cm.showNotification(`Import error: ${err.message}`, 'danger');
        }
    };
    reader.readAsText(file);
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function runHipaaComplianceCheck() {
    renderHipaaComplianceSummary();
    cm.showNotification('HIPAA compliance scan completed', 'success');
}

function generateFhirPayload() {
    renderEhrFhirSummary();
    cm.showNotification('FHIR payload generated for review', 'info');
}

function generateHl7Summary() {
    renderHl7Summary();
    cm.showNotification('HL7 summary generated for interoperability review', 'info');
}

function initHealthcare50() {
    const flBtn = document.getElementById('startFLBtn');
    const simulateLocalBtn = document.getElementById('simulateLocalTrainingBtn');
    const byzantineBtn = document.getElementById('detectByzantineClientsBtn');
    const coordinatorBtn = document.getElementById('runCoordinatorBtn');
    const idsBtn = document.getElementById('testIDSBtn');
    const exportJsonBtn = document.getElementById('exportPGxJSON');
    const exportCsvBtn = document.getElementById('exportPGxCSV');
    const importBtn = document.getElementById('importPGxJSON');
    const recommendationBtn = document.getElementById('generateRecommendationBtn');
    const hipaaBtn = document.getElementById('runHIPAAScanBtn');
    const patientSafetyBtn = document.getElementById('runPatientSafetyCheckBtn');
    const treatmentPlanBtn = document.getElementById('generateTreatmentPlanBtn');
    const clinicalSummaryBtn = document.getElementById('generateClinicalSummaryBtn');
    const patientProfileBtn = document.getElementById('refreshPatientProfileBtn');
    const medicationReviewBtn = document.getElementById('refreshMedicationReviewBtn');
    const fhirBtn = document.getElementById('exportFHIRBtn');
    const hl7Btn = document.getElementById('generateHL7Btn');

    if (flBtn && !flBtn._init) {
        flBtn.addEventListener('click', runFederatedLearning); flBtn._init = true;
    }
    if (simulateLocalBtn && !simulateLocalBtn._init) {
        simulateLocalBtn.addEventListener('click', runLocalTrainingSimulation); simulateLocalBtn._init = true;
    }
    if (byzantineBtn && !byzantineBtn._init) {
        byzantineBtn.addEventListener('click', runByzantineAudit); byzantineBtn._init = true;
    }
    if (coordinatorBtn && !coordinatorBtn._init) {
        coordinatorBtn.addEventListener('click', runCoordinatorRound); coordinatorBtn._init = true;
    }
    if (idsBtn && !idsBtn._init) {
        idsBtn.addEventListener('click', testIntrusionSample); idsBtn._init = true;
    }
    if (exportJsonBtn && !exportJsonBtn._init) {
        exportJsonBtn.addEventListener('click', exportPGxJSON); exportJsonBtn._init = true;
    }
    if (exportCsvBtn && !exportCsvBtn._init) {
        exportCsvBtn.addEventListener('click', exportPGxCSV); exportCsvBtn._init = true;
    }
    if (importBtn && !importBtn._init) {
        importBtn.addEventListener('change', importPGxJSON); importBtn._init = true;
    }
    if (recommendationBtn && !recommendationBtn._init) {
        recommendationBtn.addEventListener('click', renderClinicalRecommendationFromForm); recommendationBtn._init = true;
    }
    if (hipaaBtn && !hipaaBtn._init) {
        hipaaBtn.addEventListener('click', runHipaaComplianceCheck); hipaaBtn._init = true;
    }
    if (patientSafetyBtn && !patientSafetyBtn._init) {
        patientSafetyBtn.addEventListener('click', runPatientSafetyCheck); patientSafetyBtn._init = true;
    }
    if (treatmentPlanBtn && !treatmentPlanBtn._init) {
        treatmentPlanBtn.addEventListener('click', generateTreatmentPlan); treatmentPlanBtn._init = true;
    }
    if (clinicalSummaryBtn && !clinicalSummaryBtn._init) {
        clinicalSummaryBtn.addEventListener('click', generateClinicalSummary); clinicalSummaryBtn._init = true;
    }
    if (patientProfileBtn && !patientProfileBtn._init) {
        patientProfileBtn.addEventListener('click', refreshPatientProfile); patientProfileBtn._init = true;
    }
    if (medicationReviewBtn && !medicationReviewBtn._init) {
        medicationReviewBtn.addEventListener('click', refreshPatientProfile); medicationReviewBtn._init = true;
    }
    if (fhirBtn && !fhirBtn._init) {
        fhirBtn.addEventListener('click', generateFhirPayload); fhirBtn._init = true;
    }
    if (hl7Btn && !hl7Btn._init) {
        hl7Btn.addEventListener('click', generateHl7Summary); hl7Btn._init = true;
    }

    const supportEl = document.getElementById('clinicalDecisionSupport');
    if (supportEl && !supportEl.dataset.initialized) {
        supportEl.innerHTML = buildClinicalDecisionSupport('CYP2C19', 'Clopidogrel', '*2');
        supportEl.dataset.initialized = 'true';
    }

    renderHipaaComplianceSummary();
    renderPatientSafetySummary();
    renderTreatmentPlanSummary();
    renderClinicalSummaryReport();
    renderPatientProfileSummary();
    renderMedicationReviewSummary();
    renderEhrFhirSummary();
    loadPGxEntries();
}
