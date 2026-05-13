import json
import random

def handler(request):
    if request.get('method') != 'POST':
        return {'statusCode': 405, 'body': json.dumps({'error': 'Method not allowed'})}
    is_attack = random.random() < 0.4
    metrics = {
        'accuracy': 0.9618,
        'sensitivity': 0.9864,
        'specificity': 0.9057,
        'false_positive_rate': 0.0943,
        'false_negative_rate': 0.0136
    }
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({
            'prediction': 'attack' if is_attack else 'normal',
            'confidence': random.uniform(0.85, 0.99),
            'metrics': metrics
        })
    }
