#!/bin/bash
echo "🧹 Cleaning..."
rm -rf node_modules .expo package-lock.json

echo "📦 Installing..."
npm install --legacy-peer-deps

echo "🔧 Installing missing peer deps..."
npm install react-native-worklets react-native-reanimated babel-preset-expo --legacy-peer-deps

echo "✅ Done! Run: npx expo start --clear"
