import json
import math
from flask import Request, Response
import numpy as np

# Federated Learning with Differential Privacy
class FederatedLearningManager:
    def __init__(self, epsilon=1.0, delta=1e-5, total_fl_rounds=10):
        """Initialize FL with differential privacy budget"""
        self.epsilon = epsilon  # Total privacy budget for the entire FL task
        self.delta = delta      # Probability of privacy failure (usually very small, often 0 for pure DP)
        self.total_fl_rounds = total_fl_rounds # Define total expected rounds for epsilon allocation
        self.privacy_spent = 0
        self.accuracy_history = [0.65, 0.72, 0.78, 0.83, 0.87, 0.90, 0.93, 0.95, 0.96, 0.97]
        self.client_weights = [0.25, 0.25, 0.25, 0.25]  # Equal weights initially
        
    def add_laplace_noise(self, value, sensitivity, epsilon_per_round):
        """
        Add Laplace noise for differential privacy.

        Args:
            value (float): The value to which noise is added (e.g., aggregated accuracy).
            sensitivity (float): The L1 sensitivity of the query. For accuracy (bounded [0,1]),
                                 a common sensitivity is 1.0 (max difference a single record can make).
            epsilon_per_round (float): The privacy budget allocated for this specific round.

        Returns:
            float: The noisy value.
        """
        if epsilon_per_round <= 0:
            # If no privacy budget for the round, return value without noise.
            # In production, this might indicate an error or end of privacy budget.
            return value

        # Scale for Laplace distribution: b = sensitivity / epsilon
        scale = sensitivity / epsilon_per_round
        noise = np.random.laplace(0, scale)
        return value + noise
    
    def aggregate_client_updates(self, client_updates, round_num):
        """Weighted aggregation of client model updates.
        Ensures client_updates is not empty to prevent errors.
        """
        if not client_updates:
            return 0.0 # Return a default safe value if no updates

        weights = [1 / len(client_updates)] * len(client_updates)
        weighted_sum = sum(w * u for w, u in zip(weights, client_updates))
        # In a real FL scenario, aggregation logic would be more complex (e.g., FedAvg)
        return weighted_sum
    
    def compute_convergence_rate(self, current_acc, prev_acc):
        """Compute convergence rate between rounds"""
        if prev_acc == 0:
            return 0
        return (current_acc - prev_acc) / prev_acc
    
    def update_privacy_budget(self, epsilon_used):
        """Track cumulative privacy spent"""
        self.privacy_spent += epsilon_used
        remaining = self.epsilon - self.privacy_spent
        return remaining

# Initialize FL manager with a total epsilon and defined total rounds
fl_manager = FederatedLearningManager(epsilon=1.0, delta=1e-5, total_fl_rounds=10)

def handler(request: Request):
    if request.method != 'POST':
        return Response(status=405)
    
    data = request.get_json(silent=True) or {}

    # Input validation for round_num
    round_num = data.get('round', None)
    if round_num is None or not isinstance(round_num, int) or round_num < 0:
        return Response(json.dumps({'error': 'Invalid or missing "round" parameter'}), status=400, mimetype='application/json')

    clients = data.get('clients', 4)
    if not isinstance(clients, int) or clients < 1 or clients > 32:
        return Response(json.dumps({'error': '"clients" must be an integer between 1 and 32'}), status=400, mimetype='application/json')

    noise_levels = data.get('noise', [0.02, -0.01, 0.03, -0.02])
    if not isinstance(noise_levels, list) or len(noise_levels) != clients:
        return Response(json.dumps({'error': '"noise" must contain one numeric update per client'}), status=400, mimetype='application/json')
    if not all(isinstance(noise, (int, float)) and math.isfinite(noise) for noise in noise_levels):
        return Response(json.dumps({'error': 'Client updates must be finite numbers'}), status=400, mimetype='application/json')
    
    # Base accuracy from history
    base_acc = fl_manager.accuracy_history[min(round_num, len(fl_manager.accuracy_history)-1)]
    
    # Simulate client updates with noise
    client_updates = [base_acc + n for n in noise_levels]
    
    # Weighted aggregation
    aggregated = fl_manager.aggregate_client_updates(client_updates, round_num)
    
    # Apply differential privacy (Laplace mechanism)
    # Distribute epsilon budget across the defined total number of rounds
    if fl_manager.total_fl_rounds > 0:
        epsilon_per_round = fl_manager.epsilon / fl_manager.total_fl_rounds
    else:
        epsilon_per_round = 0 # No privacy if no rounds defined
    private_accuracy = fl_manager.add_laplace_noise(aggregated, sensitivity=1.0, epsilon_per_round=epsilon_per_round)
    private_accuracy = max(0.5, min(1.0, private_accuracy))  # Clamp to [0.5, 1.0]
    
    # Calculate convergence
    prev_acc = fl_manager.accuracy_history[max(0, min(round_num-1, len(fl_manager.accuracy_history)-1))]
    if prev_acc == private_accuracy:
        convergence = 0.0 # Avoid division by zero in very specific edge case
    else:
        convergence = fl_manager.compute_convergence_rate(private_accuracy, prev_acc)
    
    # Update privacy budget
    privacy_remaining = max(0.0, fl_manager.update_privacy_budget(epsilon_per_round))
    
    return Response(
        json.dumps({
            'round': round_num + 1,
            'global_accuracy': float(private_accuracy),
            'clients': clients,
            'convergence_rate': float(convergence),
            'privacy_spent': float(fl_manager.privacy_spent),
            'privacy_remaining': float(privacy_remaining),
            'epsilon_total': float(fl_manager.epsilon),
            'aggregation_method': 'weighted_fedavg'
        }),
        status=200, mimetype='application/json'
    )

