#!/bin/sh
# Xcode Cloud: runs right after the repo is cloned, before the build.
# Generates ios/App/App/public, capacitor.config.json and config.xml,
# which are git-ignored (produced by `cap sync`) and so don't exist
# in a fresh Xcode Cloud checkout.
set -ex

if ! command -v node >/dev/null 2>&1; then
  brew install node@22
  export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
fi
node -v
npm -v

# Resolve the repo root relative to this script's own location instead of
# relying on $CI_WORKSPACE, which is empty during ci_post_clone and left
# npm install climbing up to mobile/package.json (no "build" script there).
REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"

cd "$REPO_ROOT"
npm install
npm run build

cd "$REPO_ROOT/mobile"
npm install
npx cap sync ios
