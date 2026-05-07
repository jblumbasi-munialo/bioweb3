from flask import Request, Response
import json

def handler(request: Request):
    if request.method == 'POST':
        return Response(
            json.dumps({"message": "Python function works", "status": "ok"}),
            status=200,
            mimetype='application/json'
        )
    return Response(status=405)
