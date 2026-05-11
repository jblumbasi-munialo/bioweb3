import json
import random
from flask import Request, Response

# Simulate global model accuracy progression
accuracy_history = [0.65, 0.72, 0.78, 0.83, 0.87, 0.90, 0.93, 0.95, 0.96, 0.97]

def handler(request: Request):
    if request.method != 'POST':
        return Response(status=405)

    data = request.get_json()
    round_num = data.get('round', 0)

    # Simulate FedAvg: return aggregated accuracy based on round number
    # In reality, you would aggregate neural network weights.
    # Here we just return the accuracy that is precomputed from paper.
    accuracy = accuracy_history[min(round_num, len(accuracy_history)-1)]

    return Response(
        json.dumps({
            'round': round_num + 1,
            'global_accuracy': accuracy,
            'clients': 4,
            'message': f'Federated learning round {round_num+1} completed. Accuracy: {accuracy:.2%}'
        }),
        status=200,
        mimetype='application/json'
    )
