#!/bin/sh
# Xcode Cloud: runs right after the repo is cloned, before the build.
# Generates ios/App/App/public, capacitor.config.json and config.xml,
# which are git-ignored (produced by `cap sync`) and so don't exist
# in a fresh Xcode Cloud checkout.
set -e

brew install node@22
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"

cd "$CI_WORKSPACE"
npm install
npm run build

cd mobile
npm install
npx cap sync ios
