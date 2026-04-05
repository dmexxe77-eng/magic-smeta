#!/bin/bash
echo "🚀 Magic Studio — setup for Xcode/Simulator"

# Clean everything
rm -rf node_modules .expo package-lock.json

# Install with exact versions that work with new architecture
npm install --legacy-peer-deps

echo ""
echo "✅ Done! Now run:"
echo "   npx expo run:ios"
echo ""
echo "This will open iOS Simulator with Magic Studio"
