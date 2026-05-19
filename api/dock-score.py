import json
import numpy as np
from flask import Request, Response

# Simulate a simple ML score based on molecular properties (in real use, load a model)
def ml_score(smiles, pdb_id):
    # Placeholder: use length of SMILES as proxy
    score = -7.5 - (len(smiles) / 100) + np.random.normal(0, 0.5)
    return max(-12, min(-4, round(score, 2)))

def handler(request: Request):
    if request.method != 'POST':
        return Response(status=405)
    data = request.get_json()
    smiles = data.get('smiles', '')
    pdb_id = data.get('pdb_id', '')
    score = ml_score(smiles, pdb_id)
    return Response(json.dumps({'score': score}), status=200, mimetype='application/json')
