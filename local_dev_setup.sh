#!/bin/bash

# 1. Install dependencies
if ! npm install; then
  echo "npm install failed. Check the npm log for details."
  exit 1
fi

# 2. Install Supabase CLI via Homebrew if not present
if ! command -v supabase &> /dev/null
then
  if command -v brew &> /dev/null; then
    brew install supabase/tap/supabase
  else
    echo "Homebrew not found. Please install Homebrew or install Supabase CLI manually: https://supabase.com/docs/guides/cli"
    exit 1
  fi
  if ! command -v supabase &> /dev/null; then
    echo "Supabase CLI installation failed."
    exit 1
  fi
fi

# 3. Start Supabase local stack
supabase start

# 4. Copy environment variables if .env.local does not exist
if [ ! -f .env.local ]; then
  if [ -f .env.local.example ]; then
    cp .env.local.example .env.local
    echo ".env.local created from .env.local.example."
  else
    echo ".env.local.example not found. Please create it or check your directory."
  fi
else
  echo ".env.local already exists. Skipping copy."
fi

echo "Update .env.local with values from 'supabase status', e.g.:"
echo "NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321"