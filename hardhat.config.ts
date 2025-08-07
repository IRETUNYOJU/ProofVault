import '@nomicfoundation/hardhat-toolbox';
import '@typechain/hardhat';
import dotenv from 'dotenv';
import 'hardhat-gas-reporter';
import { HardhatUserConfig } from 'hardhat/config';
import 'solidity-coverage';

dotenv.config();

const baseConfig: HardhatUserConfig = {
  solidity: {
    version: '0.8.22',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  defaultNetwork: 'testnet',
  networks: {
    hardhat: {
      chainId: 31337,
    },
    testnet: {
      url: process.env['RPC_URL'] || 'https://testnet.hashio.io/api',
      accounts: process.env['OPERATOR_KEY'] ? [process.env['OPERATOR_KEY']] : [],
      chainId: 296,
      timeout: 60000,
      gasPrice: 'auto',
    },
    mainnet: {
      url: process.env['MAINNET_RPC_URL'] || 'https://mainnet.hashio.io/api',
      accounts: process.env['MAINNET_OPERATOR_KEY'] ? [process.env['MAINNET_OPERATOR_KEY']] : [],
      chainId: 295,
      timeout: 60000,
      gasPrice: 'auto',
    },
  },
  gasReporter: {
    enabled: process.env['REPORT_GAS'] !== undefined,
    currency: 'USD',
  },
  typechain: {
    outDir: 'typechain-types',
    target: 'ethers-v6',
    alwaysGenerateOverloads: false,
    externalArtifacts: ['externalArtifacts/*.json'],
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  mocha: {
    timeout: 40000,
  },
};

// Add etherscan config if API key is available
if (process.env['ETHERSCAN_API_KEY']) {
  baseConfig.etherscan = {
    apiKey: process.env['ETHERSCAN_API_KEY'],
  };
}

export default baseConfig;