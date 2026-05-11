import json
from flask import Request, Response

accuracy_history = [0.65, 0.72, 0.78, 0.83, 0.87, 0.90, 0.93, 0.95, 0.96, 0.97]

def handler(request: Request):
    if request.method != 'POST':
        return Response(status=405)
    data = request.get_json()
    round_num = data.get('round', 0)
    acc = accuracy_history[min(round_num, len(accuracy_history)-1)]
    return Response(
        json.dumps({'round': round_num+1, 'global_accuracy': acc, 'clients': 4}),
        status=200, mimetype='application/json'
    )
