/**
 * BioWeb3 Smart Contract Framework - Contract ABIs & Addresses
 * Defines contract interfaces (ABIs), addresses on supported networks,
 * and network configuration for blockchain interactions.
 */

// ERC-20 Token Contract ABI (OpenZeppelin standard)
const ERC20_ABI = [
  {
    constant: true,
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "transferFrom",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
    name: "Transfer",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "owner", type: "address" },
      { indexed: true, name: "spender", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
    name: "Approval",
    type: "event",
  },
];

// Staking Contract ABI
const STAKING_ABI = [
  {
    constant: false,
    inputs: [{ name: "amount", type: "uint256" }],
    name: "stake",
    outputs: [],
    type: "function",
  },
  {
    constant: false,
    inputs: [{ name: "amount", type: "uint256" }],
    name: "unstake",
    outputs: [],
    type: "function",
  },
  {
    constant: true,
    inputs: [{ name: "account", type: "address" }],
    name: "getStakedAmount",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [{ name: "account", type: "address" }],
    name: "getPendingRewards",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
  },
  {
    constant: false,
    inputs: [],
    name: "claimRewards",
    outputs: [],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "totalStaked",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "account", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
    name: "Staked",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "account", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
    name: "Unstaked",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "account", type: "address" },
      { indexed: false, name: "reward", type: "uint256" },
    ],
    name: "RewardClaimed",
    type: "event",
  },
];

// Rewards Distribution Contract ABI
const REWARDS_ABI = [
  {
    constant: false,
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "distributeReward",
    outputs: [],
    type: "function",
  },
  {
    constant: true,
    inputs: [{ name: "account", type: "address" }],
    name: "getClaimedRewards",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "totalDistributed",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
  },
  {
    constant: false,
    inputs: [{ name: "amount", type: "uint256" }],
    name: "claimRewards",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "recipient", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
    name: "RewardDistributed",
    type: "event",
  },
];

// Governance/DAO Contract ABI
const GOVERNANCE_ABI = [
  {
    constant: false,
    inputs: [
      { name: "description", type: "string" },
      { name: "duration", type: "uint256" },
    ],
    name: "createProposal",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "support", type: "bool" },
    ],
    name: "vote",
    outputs: [],
    type: "function",
  },
  {
    constant: true,
    inputs: [{ name: "proposalId", type: "uint256" }],
    name: "getProposal",
    outputs: [
      { name: "id", type: "uint256" },
      { name: "description", type: "string" },
      { name: "forVotes", type: "uint256" },
      { name: "againstVotes", type: "uint256" },
      { name: "executed", type: "bool" },
    ],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "proposalCount",
    outputs: [{ name: "", type: "uint256" }],
    type: "function",
  },
  {
    constant: false,
    inputs: [{ name: "proposalId", type: "uint256" }],
    name: "executeProposal",
    outputs: [],
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "proposalId", type: "uint256" },
      { indexed: true, name: "proposer", type: "address" },
    ],
    name: "ProposalCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "proposalId", type: "uint256" },
      { indexed: true, name: "voter", type: "address" },
      { indexed: false, name: "support", type: "bool" },
    ],
    name: "VoteCast",
    type: "event",
  },
];

/**
 * Contract ABIs mapping
 * @type {Object}
 */
const contractABIs = {
  BIOToken: ERC20_ABI,
  BIOStaking: STAKING_ABI,
  BIORewards: REWARDS_ABI,
  BIOGovernance: GOVERNANCE_ABI,
};

/**
 * Network configuration with RPC URLs and chain IDs
 * @type {Object}
 */
const networks = {
  ethereum: {
    chainId: 1,
    name: "Ethereum Mainnet",
    mainnet: true,
    rpcUrl: "https://eth-mainnet.g.alchemy.com/v2/",
    blockExplorer: "https://etherscan.io",
  },
  goerli: {
    chainId: 5,
    name: "Goerli Testnet",
    mainnet: false,
    rpcUrl: "https://eth-goerli.g.alchemy.com/v2/",
    blockExplorer: "https://goerli.etherscan.io",
  },
  polygonMainnet: {
    chainId: 137,
    name: "Polygon Mainnet",
    mainnet: true,
    rpcUrl: "https://polygon-mainnet.g.alchemy.com/v2/",
    blockExplorer: "https://polygonscan.com",
  },
  mumbai: {
    chainId: 80001,
    name: "Mumbai Testnet",
    mainnet: false,
    rpcUrl: "https://polygon-mumbai.g.alchemy.com/v2/",
    blockExplorer: "https://mumbai.polygonscan.com",
  },
  bsc: {
    chainId: 56,
    name: "BSC Mainnet",
    mainnet: true,
    rpcUrl: "https://bsc-dataseed.binance.org",
    blockExplorer: "https://bscscan.com",
  },
  bscTestnet: {
    chainId: 97,
    name: "BSC Testnet",
    mainnet: false,
    rpcUrl: "https://data-seed-prebsc-1-a.binance.org:8545",
    blockExplorer: "https://testnet.bscscan.com",
  },
  arbitrum: {
    chainId: 42161,
    name: "Arbitrum One",
    mainnet: true,
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    blockExplorer: "https://arbiscan.io",
  },
  arbitrumSepolia: {
    chainId: 421614,
    name: "Arbitrum Sepolia",
    mainnet: false,
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    blockExplorer: "https://sepolia-explorer.arbitrum.io",
  },
};

/**
 * Contract addresses on supported networks
 * Placeholder addresses - to be updated after deployment
 * @type {Object}
 */
const contractAddresses = {
  ethereum: {
    mainnet: {
      BIOToken: "0x0000000000000000000000000000000000000001",
      BIOStaking: "0x0000000000000000000000000000000000000002",
      BIORewards: "0x0000000000000000000000000000000000000003",
      BIOGovernance: "0x0000000000000000000000000000000000000004",
    },
    goerli: {
      BIOToken: "0x0000000000000000000000000000000000000005",
      BIOStaking: "0x0000000000000000000000000000000000000006",
      BIORewards: "0x0000000000000000000000000000000000000007",
      BIOGovernance: "0x0000000000000000000000000000000000000008",
    },
  },
  polygon: {
    mainnet: {
      BIOToken: "0x0000000000000000000000000000000000000009",
      BIOStaking: "0x000000000000000000000000000000000000000a",
      BIORewards: "0x000000000000000000000000000000000000000b",
      BIOGovernance: "0x000000000000000000000000000000000000000c",
    },
    mumbai: {
      BIOToken: "0x000000000000000000000000000000000000000d",
      BIOStaking: "0x000000000000000000000000000000000000000e",
      BIORewards: "0x000000000000000000000000000000000000000f",
      BIOGovernance: "0x0000000000000000000000000000000000000010",
    },
  },
  bsc: {
    mainnet: {
      BIOToken: "0x0000000000000000000000000000000000000011",
      BIOStaking: "0x0000000000000000000000000000000000000012",
      BIORewards: "0x0000000000000000000000000000000000000013",
      BIOGovernance: "0x0000000000000000000000000000000000000014",
    },
    testnet: {
      BIOToken: "0x0000000000000000000000000000000000000015",
      BIOStaking: "0x0000000000000000000000000000000000000016",
      BIORewards: "0x0000000000000000000000000000000000000017",
      BIOGovernance: "0x0000000000000000000000000000000000000018",
    },
  },
  arbitrum: {
    mainnet: {
      BIOToken: "0x0000000000000000000000000000000000000019",
      BIOStaking: "0x000000000000000000000000000000000000001a",
      BIORewards: "0x000000000000000000000000000000000000001b",
      BIOGovernance: "0x000000000000000000000000000000000000001c",
    },
    sepolia: {
      BIOToken: "0x000000000000000000000000000000000000001d",
      BIOStaking: "0x000000000000000000000000000000000000001e",
      BIORewards: "0x000000000000000000000000000000000000001f",
      BIOGovernance: "0x0000000000000000000000000000000000000020",
    },
  },
};

/**
 * Map chain IDs to network keys for easy lookup
 * @type {Object}
 */
const chainIdToNetwork = {
  1: "ethereum",
  5: "goerli",
  56: "bsc",
  97: "bscTestnet",
  137: "polygonMainnet",
  80001: "mumbai",
  42161: "arbitrum",
  421614: "arbitrumSepolia",
};

/**
 * Get network info by chain ID
 * @param {number} chainId - The blockchain chain ID
 * @returns {Object|null} Network configuration or null if not found
 */
function getNetworkByChainId(chainId) {
  const networkKey = chainIdToNetwork[chainId];
  return networkKey ? networks[networkKey] : null;
}

/**
 * Get contract address on specific network
 * @param {string} contractName - Name of the contract (BIOToken, BIOStaking, etc)
 * @param {string} networkKey - Network key (ethereum, polygon, bsc, arbitrum)
 * @param {string} environment - Environment (mainnet, testnet, goerli, mumbai, sepolia)
 * @returns {string|null} Contract address or null if not found
 */
function getContractAddress(contractName, networkKey, environment) {
  const network = contractAddresses[networkKey];
  if (!network) return null;

  const env = network[environment];
  return env ? env[contractName] : null;
}

/**
 * Get contract ABI by name
 * @param {string} contractName - Name of the contract
 * @returns {Array|null} Contract ABI or null if not found
 */
function getContractABI(contractName) {
  return contractABIs[contractName] || null;
}

/**
 * Validate if an address is a valid Ethereum address
 * @param {string} address - Address to validate
 * @returns {boolean} True if valid address format
 */
function isValidAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Export for module systems
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    contractABIs,
    contractAddresses,
    networks,
    chainIdToNetwork,
    getNetworkByChainId,
    getContractAddress,
    getContractABI,
    isValidAddress,
  };
}
