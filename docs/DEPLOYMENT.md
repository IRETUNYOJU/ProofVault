# ProofVault Deployment Guide

This guide provides comprehensive instructions for deploying ProofVault to the Hedera blockchain network.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Configuration](#configuration)
- [Deployment Process](#deployment-process)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Post-Deployment](#post-deployment)

## Prerequisites

### System Requirements

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher
- **Git**: For version control
- **Operating System**: Windows, macOS, or Linux

### Hedera Account Setup

1. **Create Hedera Account**:
   - For testnet: Use [Hedera Portal](https://portal.hedera.com/)
   - For mainnet: Set up through official Hedera partners

2. **Fund Your Account**:
   - Testnet: Get free HBAR from [Hedera faucet](https://portal.hedera.com/faucet)
   - Mainnet: Purchase HBAR from exchanges

3. **Obtain Credentials**:
   - Account ID (format: 0.0.123456)
   - Private key (64-character hex string)

### Required Tools

```bash
# Verify Node.js installation
node --version  # Should be 18.0.0+

# Verify npm installation
npm --version   # Should be 8.0.0+

# Install global dependencies (optional)
npm install -g typescript
npm install -g @hashgraph/sdk
```

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/IRETUNYOJU/ProofVault.git
cd ProofVault
```

### 2. Install Dependencies

```bash
# Install all dependencies
npm install

# Verify installation
npm run typecheck
```

### 3. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env  # or use your preferred editor
```

## Configuration

### Environment Variables

Edit `.env` file with your specific configuration:

```env
# Network Configuration
NETWORK=testnet  # or 'mainnet' for production

# Testnet Configuration
RPC_URL=https://testnet.hashio.io/api
OPERATOR_KEY=your_testnet_private_key_here
OPERATOR_ID=0.0.your_testnet_account_id

# Mainnet Configuration (for production)
MAINNET_RPC_URL=https://mainnet.hashio.io/api
MAINNET_OPERATOR_KEY=your_mainnet_private_key_here
MAINNET_OPERATOR_ID=0.0.your_mainnet_account_id

# Gas Configuration
GAS_PRICE=auto
GAS_LIMIT=8000000

# Contract Verification
VERIFY_CONTRACTS=true
VERIFICATION_DELAY=30000

# Deployment Configuration
DEPLOYMENT_OUTPUT_DIR=./deployments
LOG_LEVEL=info
```

### Network-Specific Settings

#### Testnet Configuration
```env
NETWORK=testnet
RPC_URL=https://testnet.hashio.io/api
OPERATOR_KEY=302e020100300506032b657004220420[your-private-key]
OPERATOR_ID=0.0.123456
```

#### Mainnet Configuration
```env
NETWORK=mainnet
MAINNET_RPC_URL=https://mainnet.hashio.io/api
MAINNET_OPERATOR_KEY=302e020100300506032b657004220420[your-private-key]
MAINNET_OPERATOR_ID=0.0.123456
```

## Deployment Process

### Pre-Deployment Checks

```bash
# Run comprehensive quality checks
npm run quality:check

# Test deployment configuration
npm run test:deployment

# Verify contract compilation
npm run compile
```

### Single-Command Deployment

#### Deploy to Testnet
```bash
npm run deploy:testnet
```

#### Deploy to Mainnet
```bash
npm run deploy:mainnet
```

### Step-by-Step Deployment

#### 1. Build Project
```bash
npm run build
```

#### 2. Compile Contracts
```bash
npm run compile
```

#### 3. Run Tests
```bash
npm run test
```

#### 4. Deploy Contracts
```bash
# For testnet
NETWORK=testnet npm run deploy

# For mainnet
NETWORK=mainnet npm run deploy
```

### Deployment Output

Successful deployment will produce:

```
🌟 ProofVault Hedera Deployment Script
======================================

🏗️  Starting contract deployment...
Network: testnet
Deployer: 0.0.123456
Hedera Network: testnet

📁 Uploading IdentityAttestation bytecode to Hedera File Service...
File created with ID: 0.0.789012
✅ Bytecode uploaded successfully to file 0.0.789012

🚀 Deploying IdentityAttestation...
Creating contract on Hedera...
✅ IdentityAttestation deployed successfully!
   Contract ID: 0.0.789013
   EVM Address: 0x000000000000000000000000000000000000c0d5
   Transaction ID: 0.0.123456@1234567890.123456789

[Similar output for ProofVault and LegalCaseManager]

🎉 All contracts deployed successfully!
Total gas used: 8,500,000

🎊 Deployment Summary:
======================
IdentityAttestation: 0x000000000000000000000000000000000000c0d5
ProofVault: 0x000000000000000000000000000000000000c0d6
LegalCaseManager: 0x000000000000000000000000000000000000c0d7

Total gas used: 8,500,000
```

## Verification

### Contract Verification

```bash
# Verify all deployed contracts
npm run verify

# Verify specific contract
npm run verify -- testnet 0x[contract-address] ContractName
```

### Deployment Verification

```bash
# Check deployment status
npm run test:deployment

# Verify contract interactions
npm run test
```

### Manual Verification

1. **Check Contract Addresses**:
   ```bash
   # View deployment artifacts
   cat deployments/latest-testnet.json
   ```

2. **Verify on Block Explorer**:
   - Testnet: [HashScan Testnet](https://hashscan.io/testnet)
   - Mainnet: [HashScan Mainnet](https://hashscan.io/mainnet)

3. **Test Contract Functions**:
   ```bash
   # Run integration tests
   npm run test test/Integration.test.ts
   ```

## Troubleshooting

### Common Issues

#### 1. Insufficient Balance
```
Error: Insufficient balance for deployment
```
**Solution**: Fund your Hedera account with more HBAR.

#### 2. Invalid Private Key
```
Error: Invalid operator key format
```
**Solution**: Ensure private key is in correct format (64-character hex).

#### 3. Network Connection Issues
```
Error: Failed to connect to Hedera network
```
**Solution**: Check RPC URL and network connectivity.

#### 4. Gas Limit Exceeded
```
Error: Transaction gas limit exceeded
```
**Solution**: Increase `GAS_LIMIT` in `.env` file.

#### 5. Contract Compilation Errors
```
Error: Contract compilation failed
```
**Solution**: Check Solidity syntax and dependencies.

### Debug Mode

Enable debug logging:

```bash
# Set debug log level
LOG_LEVEL=debug npm run deploy:testnet

# View detailed logs
npm run deploy:testnet 2>&1 | tee deployment.log
```

### Recovery Procedures

#### Failed Deployment Recovery
```bash
# Clean build artifacts
npm run clean

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Retry deployment
npm run deploy:testnet
```

#### Partial Deployment Recovery
```bash
# Check deployment status
cat deployments/latest-testnet.json

# Resume deployment from specific contract
# (Manual process - contact support)
```

## Post-Deployment

### Save Deployment Information

```bash
# Deployment artifacts are automatically saved to:
# - deployments/deployment-[network]-[timestamp].json
# - deployments/latest-[network].json

# Backup deployment files
cp -r deployments/ backup-deployments-$(date +%Y%m%d)/
```

### Configure Frontend/Client

Update your client application with deployed contract addresses:

```typescript
// config/contracts.ts
export const CONTRACTS = {
  IDENTITY_ATTESTATION: '0x000000000000000000000000000000000000c0d5',
  PROOF_VAULT: '0x000000000000000000000000000000000000c0d6',
  LEGAL_CASE_MANAGER: '0x000000000000000000000000000000000000c0d7',
};
```

### Set Up Monitoring

1. **Transaction Monitoring**: Monitor contract interactions
2. **Error Tracking**: Set up error logging and alerts
3. **Performance Monitoring**: Track gas usage and response times

### Security Considerations

1. **Private Key Security**: Store private keys securely
2. **Access Control**: Configure proper role-based permissions
3. **Regular Audits**: Schedule periodic security audits
4. **Backup Strategy**: Implement comprehensive backup procedures

## Next Steps

After successful deployment:

1. **Test Contract Functions**: Run comprehensive integration tests
2. **Configure Access Controls**: Set up proper roles and permissions
3. **Deploy Frontend**: Deploy client applications
4. **User Training**: Train users on the system
5. **Monitoring Setup**: Implement monitoring and alerting

## Support

For deployment issues:

- Check [Troubleshooting](#troubleshooting) section
- Review [GitHub Issues](https://github.com/IRETUNYOJU/ProofVault/issues)
- Contact support team

---

**Deployment completed successfully! 🎉**

## Quick Reference

### Essential Commands
```bash
# Complete deployment workflow
npm run quality:check && npm run deploy:testnet

# Emergency deployment (skip checks)
npm run deploy:testnet

# Verify deployment
npm run test:deployment
```

### Environment Templates

#### Minimal Testnet .env
```env
NETWORK=testnet
OPERATOR_KEY=your_private_key
OPERATOR_ID=0.0.123456
```

#### Production Mainnet .env
```env
NETWORK=mainnet
MAINNET_OPERATOR_KEY=your_private_key
MAINNET_OPERATOR_ID=0.0.123456
VERIFY_CONTRACTS=true
```
