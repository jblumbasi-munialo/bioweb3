import json
import random
from flask import Request, Response

def handler(request: Request):
    if request.method != 'POST':
        return Response(status=405)

    data = request.get_json()
    # If no features provided, pick a random test case from pre-defined patterns
    # We'll simulate detection based on protocol_type, service, flag, etc.
    # For demonstration, we return metrics similar to paper's Table 5.
    # Real implementation would use a trained ML model.

    # Simulate with high accuracy (96%)
    accuracy = 0.9618
    sensitivity = 0.9864
    specificity = 0.9057

    # Randomly decide prediction (weighted to match accuracy)
    is_attack = random.random() < 0.4  # ~40% attack rate in this demo

    return Response(
        json.dumps({
            'prediction': 'attack' if is_attack else 'normal',
            'confidence': random.uniform(0.85, 0.99),
            'metrics': {
                'accuracy': accuracy,
                'sensitivity': sensitivity,
                'specificity': specificity,
                'false_positive_rate': 1 - specificity,
                'false_negative_rate': 1 - sensitivity
            }
        }),
        status=200,
        mimetype='application/json'
    )
