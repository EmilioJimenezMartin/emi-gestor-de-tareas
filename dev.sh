#!/bin/bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
/opt/homebrew/opt/node@22/bin/node node_modules/.bin/concurrently \
  -n web,api \
  -c blue,green \
  "npm --workspace apps/web run dev" \
  "npm --workspace apps/api run dev"
