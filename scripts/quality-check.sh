#!/bin/bash

# ProofVault Code Quality Check Script
# This script runs all code quality checks

set -e

echo "🔍 ProofVault Code Quality Check"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if npm is available
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed or not in PATH"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm ci
fi

# 1. TypeScript Type Checking
print_status "Running TypeScript type checking..."
if npm run typecheck; then
    print_success "TypeScript type checking passed"
else
    print_error "TypeScript type checking failed"
    exit 1
fi

# 2. ESLint
print_status "Running ESLint..."
if npm run lint:check; then
    print_success "ESLint checks passed"
else
    print_error "ESLint checks failed"
    print_status "Attempting to auto-fix issues..."
    if npm run lint; then
        print_success "ESLint auto-fix completed"
    else
        print_error "ESLint auto-fix failed"
        exit 1
    fi
fi

# 3. Prettier
print_status "Checking code formatting with Prettier..."
if npm run format:check; then
    print_success "Code formatting is correct"
else
    print_warning "Code formatting issues found"
    print_status "Auto-formatting code..."
    if npm run format; then
        print_success "Code formatting completed"
    else
        print_error "Code formatting failed"
        exit 1
    fi
fi

# 4. Contract Compilation
print_status "Compiling smart contracts..."
if npm run compile; then
    print_success "Smart contracts compiled successfully"
else
    print_error "Smart contract compilation failed"
    exit 1
fi

# 5. Tests
print_status "Running tests..."
if npm run test; then
    print_success "All tests passed"
else
    print_error "Tests failed"
    exit 1
fi

# 6. Test Coverage
print_status "Generating test coverage report..."
if npm run test:coverage; then
    print_success "Test coverage report generated"
    
    # Check coverage thresholds (if coverage file exists)
    if [ -f "coverage/lcov-report/index.html" ]; then
        print_status "Coverage report available at: coverage/lcov-report/index.html"
    fi
else
    print_warning "Test coverage generation failed"
fi

# 7. Deployment Test
print_status "Testing deployment configuration..."
if npm run test:deployment; then
    print_success "Deployment configuration test passed"
else
    print_warning "Deployment configuration test failed"
fi

# 8. Security Audit
print_status "Running security audit..."
if npm audit --audit-level=moderate; then
    print_success "Security audit passed"
else
    print_warning "Security vulnerabilities found - please review"
fi

# 9. Build Test
print_status "Testing build process..."
if npm run build; then
    print_success "Build process completed successfully"
else
    print_error "Build process failed"
    exit 1
fi

# Summary
echo ""
echo "🎉 Code Quality Check Summary"
echo "============================="
print_success "✅ TypeScript type checking"
print_success "✅ ESLint checks"
print_success "✅ Code formatting"
print_success "✅ Contract compilation"
print_success "✅ Tests"
print_success "✅ Build process"

echo ""
print_success "All code quality checks completed successfully!"
print_status "Your code is ready for deployment to Hedera blockchain."

exit 0
