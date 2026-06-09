#!/bin/bash
NODE=/opt/homebrew/opt/node@22/bin/node
NPM="$NODE /opt/homebrew/Cellar/node@22/22.22.3/lib/node_modules/npm/bin/npm-cli.js"

$NODE node_modules/.bin/concurrently \
  -n web,api \
  -c blue,green \
  "$NPM --workspace apps/web run dev" \
  "$NPM --workspace apps/api run dev"
