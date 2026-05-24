#!/bin/bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
/opt/homebrew/opt/node@22/bin/node node_modules/.bin/concurrently \
  -n web,api,ngrok \
  -c blue,green,yellow \
  "npm --workspace apps/web run dev" \
  "npm --workspace apps/api run dev" \
  "./ngrok-start.sh"
