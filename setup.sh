#!/bin/bash
echo "🧹 Cleaning old modules..."
rm -rf node_modules .expo package-lock.json

echo "📦 Installing (this takes 2-3 minutes)..."
npm install --legacy-peer-deps

echo ""
echo "✅ Done! Now run: npx expo start --clear"
echo "📱 Then scan the QR code with Expo Go on your iPhone"
