#!/bin/sh
cd "$(dirname "$0")"
node server/server.js "${1:-8000}"
