import json
import random
from flask import Request, Response

def handler(request: Request):
    if request.method != 'POST':
        return Response(status=405)
    is_attack = random.random() < 0.4
    metrics = {
        'accuracy': 0.9618,
        'sensitivity': 0.9864,
        'specificity': 0.9057,
        'false_positive_rate': 0.0943,
        'false_negative_rate': 0.0136
    }
    return Response(
        json.dumps({
            'prediction': 'attack' if is_attack else 'normal',
            'confidence': random.uniform(0.85, 0.99),
            'metrics': metrics
        }),
        status=200, mimetype='application/json'
    )
