# ProofVault - Hedera Blockchain Legal Evidence Management System

[![CI/CD Pipeline](https://github.com/IRETUNYOJU/ProofVault/actions/workflows/ci.yml/badge.svg)](https://github.com/IRETUNYOJU/ProofVault/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-blue.svg)](https://www.typescriptlang.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.22-red.svg)](https://soliditylang.org/)
[![Hedera](https://img.shields.io/badge/Hedera-SDK%202.49.2-green.svg)](https://hedera.com/)
[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

ProofVault is a comprehensive decentralized legal evidence management system built on the Hedera blockchain network. It provides secure, immutable, and transparent handling of legal evidence with advanced access controls and identity verification.

## 🌟 Features

### Core Functionality
- **Evidence Management**: Secure submission, storage, and retrieval of digital evidence
- **Identity Verification**: Multi-level identity attestation system for legal professionals
- **Case Management**: Complete legal case lifecycle management with participant tracking
- **Access Control**: Role-based permissions with fine-grained access controls
- **Evidence Integrity**: Cryptographic verification and chain of custody tracking
- **Court Orders**: Digital court order issuance and management

### Hedera Integration
- **Native Hedera SDK**: Built using official Hedera SDK for optimal performance
- **Smart Contract Service**: Deployed on Hedera's efficient smart contract platform
- **Low Transaction Costs**: Leverages Hedera's predictable and low-cost fee structure
- **High Throughput**: Benefits from Hedera's high-performance consensus mechanism
- **Environmental Sustainability**: Carbon-negative blockchain technology

### Technical Excellence
- **TypeScript First**: Fully typed codebase with strict compiler settings
- **Comprehensive Testing**: 100% test coverage with integration tests
- **Code Quality**: ESLint, Prettier, and automated quality checks
- **CI/CD Pipeline**: Automated testing, building, and deployment
- **Security Audited**: Comprehensive security analysis and best practices

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 8+
- Hedera testnet account with HBAR balance
- Git for version control

### Installation

```bash
# Clone the repository
git clone https://github.com/IRETUNYOJU/ProofVault.git
cd ProofVault

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Configure your Hedera credentials in .env
# OPERATOR_KEY=your_private_key_here
# OPERATOR_ID=0.0.your_account_id
```

### Configuration

Edit the `.env` file with your Hedera credentials:

```env
# Network Configuration
NETWORK=testnet

# Testnet Configuration
RPC_URL=https://testnet.hashio.io/api
OPERATOR_KEY=your_testnet_private_key_here
OPERATOR_ID=0.0.your_testnet_account_id

# Optional: Enable contract verification
VERIFY_CONTRACTS=true
```

### Deployment

```bash
# Run pre-deployment checks
npm run quality:check

# Deploy to Hedera testnet
npm run deploy:testnet

# Deploy to Hedera mainnet (production)
npm run deploy:mainnet
```

## 📖 Documentation

### Quick Links
- [Deployment Guide](docs/DEPLOYMENT.md) - Complete deployment instructions
- [API Reference](docs/API.md) - Smart contract interfaces and methods
- [Architecture](docs/ARCHITECTURE.md) - System design and components
- [Security](docs/SECURITY.md) - Security considerations and best practices
- [Contributing](docs/CONTRIBUTING.md) - Development guidelines and contribution process

### Smart Contracts

#### ProofVault Contract
The core evidence management contract providing:
- Evidence submission and storage
- Access control and permissions
- Evidence integrity verification
- Chain of custody tracking

#### LegalCaseManager Contract
Comprehensive case management including:
- Case creation and lifecycle management
- Participant management
- Evidence association
- Court order issuance

#### IdentityAttestation Contract
Professional identity verification featuring:
- Multi-level verification process
- Professional type classification
- Identity revocation and updates
- Fee management

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run build          # Build TypeScript
npm run compile        # Compile smart contracts
npm run typecheck      # TypeScript type checking

# Testing
npm run test           # Run all tests
npm run test:coverage  # Generate coverage report
npm run test:deployment # Test deployment configuration

# Code Quality
npm run lint           # Run ESLint
npm run format         # Format code with Prettier
npm run quality:check  # Run all quality checks

# Deployment
npm run deploy         # Deploy to configured network
npm run deploy:testnet # Deploy to Hedera testnet
npm run deploy:mainnet # Deploy to Hedera mainnet
```

### Project Structure

```
ProofVault/
├── contracts/              # Solidity smart contracts
│   ├── ProofVault.sol      # Core evidence management
│   ├── LegalCaseManager.sol # Case management
│   └── IdentityAttestation.sol # Identity verification
├── src/                    # TypeScript source code
│   ├── scripts/           # Deployment and utility scripts
│   ├── types/             # Type definitions
│   ├── utils/             # Utility functions
│   └── config/            # Configuration management
├── test/                   # Test suite
│   ├── helpers/           # Test utilities
│   └── *.test.ts          # Contract tests
├── docs/                   # Documentation
└── deployments/           # Deployment artifacts
```

## 🔒 Security

ProofVault implements multiple layers of security:

- **Access Control**: Role-based permissions using OpenZeppelin's AccessControl
- **Reentrancy Protection**: Guards against reentrancy attacks
- **Input Validation**: Comprehensive validation of all inputs
- **Cryptographic Integrity**: Hash-based evidence verification
- **Audit Trail**: Complete chain of custody tracking

For detailed security information, see [SECURITY.md](docs/SECURITY.md).

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:coverage

# Run specific test file
npx hardhat test test/ProofVault.test.ts
```

Test coverage includes:
- Unit tests for all contract functions
- Integration tests for cross-contract interactions
- Access control and security tests
- Gas optimization tests

## 📊 Gas Optimization

ProofVault is optimized for Hedera's gas model:

- Efficient storage patterns
- Minimal external calls
- Optimized data structures
- Batch operations where possible

Typical gas costs:
- Evidence submission: ~200,000 gas
- Case creation: ~150,000 gas
- Identity verification: ~100,000 gas

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run quality checks: `npm run quality:check`
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Hedera Hashgraph](https://hedera.com/) for the blockchain platform
- [OpenZeppelin](https://openzeppelin.com/) for security contracts
- [Hardhat](https://hardhat.org/) for development framework

## 📞 Support

- Documentation: [docs/](docs/)
- Issues: [GitHub Issues](https://github.com/IRETUNYOJU/ProofVault/issues)
- Discussions: [GitHub Discussions](https://github.com/IRETUNYOJU/ProofVault/discussions)

---

**Built with ❤️ for the legal industry on Hedera blockchain**
