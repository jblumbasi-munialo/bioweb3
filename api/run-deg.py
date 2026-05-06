import os
import tempfile
import pandas as pd
import numpy as np
from scipy import stats
from statsmodels.stats.multitest import multipletests
import json
from flask import Request, Response

def handler(request: Request):
    if request.method != 'POST':
        return Response(status=405)

    file = request.files.get('file')
    if not file:
        return Response(json.dumps({'error': 'No file uploaded'}), status=400, mimetype='application/json')

    # Read CSV
    try:
        df = pd.read_csv(file.stream, index_col=0)
    except Exception as e:
        return Response(json.dumps({'error': f'Could not read CSV: {str(e)}'}), status=400, mimetype='application/json')

    cols = df.columns.tolist()
    if len(cols) < 4:
        return Response(json.dumps({'error': 'Need at least 4 samples (2 control, 2 treatment)'}), status=400, mimetype='application/json')

    # Assume first half control, second half treatment
    n_control = len(cols) // 2
    control_cols = cols[:n_control]
    treatment_cols = cols[n_control:n_control*2] if n_control*2 <= len(cols) else cols[-(len(cols)-n_control):]

    if len(control_cols) < 2 or len(treatment_cols) < 2:
        return Response(json.dumps({'error': 'Need at least 2 control and 2 treatment samples'}), status=400, mimetype='application/json')

    log2fc = []
    pvals = []
    gene_names = df.index.tolist()

    for gene in df.index:
        c = df.loc[gene, control_cols].values.astype(float)
        t = df.loc[gene, treatment_cols].values.astype(float)
        c_mean = np.mean(c) + 1e-8
        t_mean = np.mean(t) + 1e-8
        fc = t_mean / c_mean
        log2fc.append(np.log2(fc))
        _, p = stats.ttest_ind(t, c)
        pvals.append(p)

    reject, padj, _, _ = multipletests(pvals, method='fdr_bh')
    is_sig = padj < 0.05
    deg_count = np.sum(is_sig)

    volcano = {
        'log2fc': log2fc,
        'neg_log10_padj': (-np.log10(padj + 1e-300)).tolist(),
        'is_significant': is_sig.tolist(),
        'gene_names': gene_names
    }

    res_df = pd.DataFrame({'gene': gene_names, 'log2fc': log2fc, 'padj': padj, 'significant': is_sig})
    sig_df = res_df[res_df['significant']]
    top_up = sig_df.nlargest(10, 'log2fc')[['gene','log2fc','padj']].to_dict(orient='records')
    top_down = sig_df.nsmallest(10, 'log2fc')[['gene','log2fc','padj']].to_dict(orient='records')

    return Response(json.dumps({
        'deg_count': int(deg_count),
        'volcano': volcano,
        'top_up': top_up,
        'top_down': top_down
    }), mimetype='application/json')
