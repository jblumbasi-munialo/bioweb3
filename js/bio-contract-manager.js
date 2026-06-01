/**
 * BioWeb3 Smart Contract Manager
 * Handles contract interactions, transactions, gas estimation, and event listening
 * Works with ethers.js and Web3.js providers
 */

/**
 * ContractManager class for managing blockchain contract interactions
 */
class ContractManager {
  /**
   * Initialize ContractManager
   * @param {Object} provider - Web3/ethers provider instance
   * @param {number} chainId - Current blockchain chain ID
   * @param {Object} contractAddresses - Mapping of contract names to addresses
   * @param {Object} contractABIs - Mapping of contract names to ABIs
   */
  constructor(provider, chainId, contractAddresses, contractABIs) {
    this.provider = provider;
    this.chainId = chainId;
    this.contractAddresses = contractAddresses;
    this.contractABIs = contractABIs;
    this.contracts = {};
    this.eventListeners = {};
    this.transactionQueue = [];
    this.pendingTransactions = new Map();

    if (!provider) {
      console.warn(
        "ContractManager initialized without provider. Read-only mode only."
      );
    }
  }

  /**
   * Validate Ethereum address format
   * @param {string} address - Address to validate
   * @returns {boolean} True if valid address
   */
  validateAddress(address) {
    if (!address) return false;
    return /^0x[a-fA-F0-9]{40}$/.test(address.toLowerCase());
  }

  /**
   * Get or create contract instance using web3.js
   * @param {string} contractName - Name of contract (BIOToken, BIOStaking, etc)
   * @returns {Object} Contract instance or error object
   */
  async getContract(contractName) {
    // Return cached contract if exists
    if (this.contracts[contractName]) {
      return this.contracts[contractName];
    }

    try {
      const address = this.contractAddresses[contractName];
      const abi = this.contractABIs[contractName];

      if (!address || !abi) {
        return {
          error: `Contract ${contractName} not found in configuration`,
        };
      }

      if (!this.validateAddress(address)) {
        return { error: `Invalid contract address for ${contractName}` };
      }

      // Using web3.js approach (already installed)
      if (this.provider && this.provider.eth) {
        const contract = new this.provider.eth.Contract(abi, address);
        this.contracts[contractName] = contract;
        return contract;
      } else {
        // Fallback for providers without eth property
        this.contracts[contractName] = {
          _abi: abi,
          _address: address,
          _provider: this.provider,
          error: null,
        };
        return this.contracts[contractName];
      }
    } catch (error) {
      console.error(`Error getting contract ${contractName}:`, error);
      return { error: error.message };
    }
  }

  /**
   * Call contract function (read-only, no state change)
   * @param {string} contractName - Name of contract
   * @param {string} functionName - Function name to call
   * @param {Array} params - Function parameters
   * @returns {Promise<any>} Function result
   */
  async callFunction(contractName, functionName, params = []) {
    try {
      const contract = await this.getContract(contractName);

      if (contract.error) {
        throw new Error(contract.error);
      }

      // Check if contract has the function
      if (!contract[functionName]) {
        throw new Error(
          `Function ${functionName} not found in contract ${contractName}`
        );
      }

      // Call the function
      const result = await contract.methods[functionName](...params).call();
      return { success: true, data: result };
    } catch (error) {
      console.error(`Error calling ${contractName}.${functionName}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Estimate gas for a transaction
   * @param {string} contractName - Name of contract
   * @param {string} functionName - Function name
   * @param {Array} params - Function parameters
   * @param {string} account - Sender account address
   * @returns {Promise<Object>} Gas estimation result
   */
  async estimateGas(contractName, functionName, params = [], account) {
    try {
      const contract = await this.getContract(contractName);

      if (contract.error || !contract.methods) {
        // Return default gas estimate as fallback
        console.warn(`Using default gas estimate for ${contractName}`);
        return {
          success: true,
          gasEstimate: "200000",
          gasPrice: "20",
          fallback: true,
        };
      }

      if (!this.validateAddress(account)) {
        throw new Error("Invalid sender address");
      }

      // Estimate gas
      const gasEstimate = await contract.methods[functionName](...params).estimateGas({
        from: account,
      });

      // Get current gas price
      let gasPrice = "20000000000"; // Default 20 Gwei
      if (this.provider && this.provider.eth) {
        try {
          gasPrice = await this.provider.eth.getGasPrice();
        } catch (e) {
          console.warn("Failed to get gas price, using default");
        }
      }

      return {
        success: true,
        gasEstimate: gasEstimate.toString(),
        gasPrice: gasPrice.toString(),
        estimatedCost: this._calculateGasCost(gasEstimate, gasPrice),
      };
    } catch (error) {
      console.error(
        `Error estimating gas for ${contractName}.${functionName}:`,
        error
      );

      // Return fallback gas estimate
      return {
        success: true,
        gasEstimate: "200000",
        gasPrice: "20000000000",
        fallback: true,
        warning: error.message,
      };
    }
  }

  /**
   * Calculate total gas cost
   * @private
   * @param {number|string} gasAmount - Amount of gas
   * @param {number|string} gasPrice - Price per gas unit
   * @returns {string} Total cost in wei
   */
  _calculateGasCost(gasAmount, gasPrice) {
    try {
      const amount = BigInt(gasAmount.toString());
      const price = BigInt(gasPrice.toString());
      return (amount * price).toString();
    } catch (e) {
      console.warn("Gas cost calculation failed:", e.message);
      return "0";
    }
  }

  /**
   * Send a transaction to the blockchain
   * @param {string} contractName - Name of contract
   * @param {string} functionName - Function name
   * @param {Array} params - Function parameters
   * @param {string} account - Sender account address
   * @param {Object} options - Transaction options (gasPrice, gasLimit, value)
   * @returns {Promise<Object>} Transaction result with hash
   */
  async sendTransaction(contractName, functionName, params = [], account, options = {}) {
    try {
      const contract = await this.getContract(contractName);

      if (contract.error || !contract.methods) {
        throw new Error(
          `Cannot send transaction: ${contract.error || "Contract not ready"}`
        );
      }

      if (!this.validateAddress(account)) {
        throw new Error("Invalid sender address");
      }

      // Prepare transaction object
      const txData = contract.methods[functionName](...params).encodeABI();
      const txObject = {
        to: contract._address,
        data: txData,
        from: account,
        ...options,
      };

      // Estimate gas if not provided
      if (!txObject.gas && !txObject.gasLimit) {
        const gasEstimate = await this.estimateGas(
          contractName,
          functionName,
          params,
          account
        );
        if (gasEstimate.success) {
          txObject.gas = parseInt(gasEstimate.gasEstimate) + 50000; // Add buffer
        }
      }

      // Send transaction
      const txHash = await this.provider.eth.sendTransaction(txObject);
      const txId = `${contractName}-${functionName}-${Date.now()}`;

      // Track transaction
      this.pendingTransactions.set(txId, {
        hash: txHash,
        contractName,
        functionName,
        account,
        startTime: Date.now(),
      });

      this._emitEvent("transactionSent", {
        txHash,
        contractName,
        functionName,
        account,
      });

      return {
        success: true,
        txHash,
        txId,
        message: "Transaction sent successfully",
      };
    } catch (error) {
      console.error(
        `Error sending transaction to ${contractName}.${functionName}:`,
        error
      );

      // Queue failed transaction for retry
      this.transactionQueue.push({
        contractName,
        functionName,
        params,
        account,
        options,
        timestamp: Date.now(),
      });

      return {
        success: false,
        error: error.message,
        queued: true,
      };
    }
  }

  /**
   * Wait for transaction confirmation
   * @param {string} txHash - Transaction hash
   * @param {number} confirmations - Number of blocks to wait (default 1)
   * @param {number} timeoutMs - Timeout in milliseconds (default 300000 = 5 min)
   * @returns {Promise<Object>} Transaction receipt
   */
  async waitForConfirmation(txHash, confirmations = 1, timeoutMs = 300000) {
    try {
      if (!txHash || typeof txHash !== "string") {
        throw new Error("Invalid transaction hash");
      }

      const startTime = Date.now();
      const checkInterval = 2000; // Check every 2 seconds

      return new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
          try {
            const receipt = await this.provider.eth.getTransactionReceipt(txHash);

            if (receipt) {
              const currentBlock = await this.provider.eth.getBlockNumber();
              const txBlock = receipt.blockNumber;
              const confirmationCount = currentBlock - txBlock + 1;

              if (confirmationCount >= confirmations) {
                clearInterval(interval);

                this._emitEvent("transactionConfirmed", {
                  txHash,
                  receipt,
                  confirmations: confirmationCount,
                });

                resolve({
                  success: true,
                  receipt,
                  confirmations: confirmationCount,
                });
              }
            }

            // Check timeout
            if (Date.now() - startTime > timeoutMs) {
              clearInterval(interval);
              reject(new Error("Transaction confirmation timeout"));
            }
          } catch (error) {
            clearInterval(interval);
            reject(error);
          }
        }, checkInterval);
      });
    } catch (error) {
      console.error("Error waiting for transaction confirmation:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Listen to contract events
   * @param {string} contractName - Name of contract
   * @param {string} eventName - Event name to listen to
   * @param {Function} callback - Callback function when event fires
   * @param {Object} filter - Event filter options
   * @returns {string} Listener ID for unsubscribing
   */
  onContractEvent(contractName, eventName, callback, filter = {}) {
    try {
      const contract = this.getContractSync(contractName);

      if (!contract || !contract.events || !contract.events[eventName]) {
        console.error(`Event ${eventName} not found in contract ${contractName}`);
        return null;
      }

      const listenerId = `${contractName}-${eventName}-${Date.now()}`;

      // Subscribe to events
      contract.events[eventName](filter).on("data", (event) => {
        callback({
          type: "data",
          event,
          contractName,
          eventName,
        });
      });

      contract.events[eventName](filter).on("error", (error) => {
        callback({
          type: "error",
          error,
          contractName,
          eventName,
        });
      });

      // Store listener reference
      if (!this.eventListeners[contractName]) {
        this.eventListeners[contractName] = {};
      }
      this.eventListeners[contractName][listenerId] = {
        eventName,
        callback,
      };

      return listenerId;
    } catch (error) {
      console.error(
        `Error listening to event ${eventName} on ${contractName}:`,
        error
      );
      return null;
    }
  }

  /**
   * Get contract synchronously (from cache)
   * @private
   * @param {string} contractName - Contract name
   * @returns {Object|null} Contract instance or null
   */
  getContractSync(contractName) {
    return this.contracts[contractName] || null;
  }

  /**
   * Get contract state variable
   * @param {string} contractName - Name of contract
   * @param {string} stateVarName - State variable name (usually a function)
   * @returns {Promise<Object>} State variable value
   */
  async getState(contractName, stateVarName) {
    try {
      const result = await this.callFunction(contractName, stateVarName, []);
      return result;
    } catch (error) {
      console.error(
        `Error getting state ${stateVarName} from ${contractName}:`,
        error
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Get pending transactions in retry queue
   * @returns {Array} Array of queued transactions
   */
  getPendingQueue() {
    return this.transactionQueue;
  }

  /**
   * Retry failed transactions from queue
   * @returns {Promise<Object>} Retry results
   */
  async retryQueue() {
    const results = [];

    while (this.transactionQueue.length > 0) {
      const tx = this.transactionQueue.shift();
      const result = await this.sendTransaction(
        tx.contractName,
        tx.functionName,
        tx.params,
        tx.account,
        tx.options
      );
      results.push({
        ...tx,
        result,
      });
    }

    return {
      retried: results.length,
      results,
    };
  }

  /**
   * Emit custom events for transaction status changes
   * @private
   * @param {string} eventType - Type of event
   * @param {Object} eventData - Event data
   */
  _emitEvent(eventType, eventData) {
    // Simple event emitter for transaction status
    if (typeof window !== "undefined" && window.CustomEvent) {
      const event = new CustomEvent("contractEvent", {
        detail: { type: eventType, data: eventData },
      });
      window.dispatchEvent(event);
    }
  }

  /**
   * Switch to different chain/network
   * @param {number} newChainId - New chain ID to switch to
   * @returns {boolean} True if switch successful
   */
  switchChain(newChainId) {
    if (!Number.isInteger(newChainId) || newChainId < 1) {
      console.error("Invalid chain ID");
      return false;
    }

    this.chainId = newChainId;
    this._emitEvent("chainSwitched", { newChainId });
    console.log(`Switched to chain ${newChainId}`);
    return true;
  }

  /**
   * Get current chain ID
   * @returns {number} Current chain ID
   */
  getChainId() {
    return this.chainId;
  }

  /**
   * Clear cached contracts
   */
  clearCache() {
    this.contracts = {};
    this.eventListeners = {};
  }
}

// Export for module systems
if (typeof module !== "undefined" && module.exports) {
  module.exports = ContractManager;
}
