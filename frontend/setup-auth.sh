#!/bin/bash

# Setup script for Aparoid Authentication Frontend

set -e

echo "🚀 Setting up Aparoid Authentication Frontend..."

# Check if we're in the frontend directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the frontend directory"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Please run the deploy script first:"
    echo "   ./scripts/deploy-cognito.sh"
    echo ""
    echo "Or create a .env file manually with your Cognito configuration."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if installation was successful
if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully!"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Create a simple start script
echo "🔧 Creating start script..."
cat > start-auth.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting Aparoid Authentication Frontend..."
echo "📱 App will be available at: http://localhost:3000"
echo "🔐 Make sure your Cognito configuration is set up in .env"
echo ""
npm run dev
EOF

chmod +x start-auth.sh

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Configure Google OAuth in AWS Cognito Console"
echo "2. Start the development server: ./start-auth.sh"
echo "3. Test authentication flows at http://localhost:3000"
echo ""
echo "📚 For more information, see README-AUTH.md" 