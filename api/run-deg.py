import json
import csv
import io
import math
from flask import Request, Response

def handler(request: Request):
    if request.method != 'POST':
        return Response(status=405)

    file = request.files.get('file')
    if not file:
        return Response(json.dumps({'error': 'No file uploaded'}), status=400, mimetype='application/json')

    # Read CSV content
    content = file.stream.read().decode('utf-8')
    reader = csv.reader(io.StringIO(content))
    rows = list(reader)
    if len(rows) < 2:
        return Response(json.dumps({'error': 'Empty or invalid CSV'}), status=400, mimetype='application/json')

    headers = rows[0]
    gene_names = [row[0] for row in rows[1:]]
    data = [row[1:] for row in rows[1:]]

    n_samples = len(data[0])
    n_control = n_samples // 2
    if n_control < 2 or (n_samples - n_control) < 2:
        return Response(json.dumps({'error': 'Need at least 2 control and 2 treatment samples'}), status=400, mimetype='application/json')

    # Convert to numeric
    matrix = []
    for row in data:
        try:
            nums = [float(x) for x in row]
            matrix.append(nums)
        except:
            matrix.append([0.0] * n_samples)

    log2fc = []
    pvals = []
    for row in matrix:
        control = row[:n_control]
        treatment = row[n_control:n_control*2] if n_control*2 <= n_samples else row[-n_control:]
        if len(control) < 2 or len(treatment) < 2:
            log2fc.append(0.0)
            pvals.append(1.0)
            continue

        mean_c = sum(control) / len(control)
        mean_t = sum(treatment) / len(treatment)
        var_c = sum((x - mean_c)**2 for x in control) / (len(control)-1) if len(control)>1 else 0
        var_t = sum((x - mean_t)**2 for x in treatment) / (len(treatment)-1) if len(treatment)>1 else 0
        se = math.sqrt(var_c/len(control) + var_t/len(treatment))
        if se == 0:
            t_stat = 0
        else:
            t_stat = (mean_t - mean_c) / se

        # approximate p-value using normal distribution (faster, no external libs)
        from math import erf, sqrt
        def norm_cdf(x):
            return (1.0 + erf(x / sqrt(2.0))) / 2.0
        p = 2 * (1 - norm_cdf(abs(t_stat)))
        pvals.append(min(p, 1.0))

        fc = (mean_t + 1e-8) / (mean_c + 1e-8)
        log2fc.append(math.log2(fc))

    # FDR (Benjamini-Hochberg)
    def fdr(pvals):
        n = len(pvals)
        indexed = list(enumerate(pvals))
        indexed.sort(key=lambda x: x[1])
        fdr_values = [0.0] * n
        cumulative_min = 1.0
        for i in range(n-1, -1, -1):
            orig_idx, p = indexed[i]
            fdr_values[orig_idx] = min(cumulative_min, p * n / (i+1))
            cumulative_min = min(cumulative_min, fdr_values[orig_idx])
        return fdr_values

    padj = fdr(pvals)
    is_sig = [p < 0.05 for p in padj]
    deg_count = sum(is_sig)

    volcano = {
        'log2fc': log2fc,
        'neg_log10_padj': [-math.log10(p+1e-300) for p in padj],
        'is_significant': is_sig,
        'gene_names': gene_names
    }

    # Top up/down
    res = [(gene_names[i], log2fc[i], padj[i]) for i in range(len(gene_names))]
    up = sorted([r for r in res if r[1] > 0], key=lambda x: x[1], reverse=True)[:10]
    down = sorted([r for r in res if r[1] < 0], key=lambda x: x[1])[:10]

    top_up = [{'gene': g, 'log2fc': l, 'padj': p} for g,l,p in up]
    top_down = [{'gene': g, 'log2fc': l, 'padj': p} for g,l,p in down]

    return Response(json.dumps({
        'deg_count': deg_count,
        'volcano': volcano,
        'top_up': top_up,
        'top_down': top_down
    }), mimetype='application/json')
