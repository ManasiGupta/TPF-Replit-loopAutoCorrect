#!/bin/bash
set -e
pnpm install --frozen-lockfile
uv sync --frozen
cd artifacts/api-server
python -m loop_api.apply_dev_schema
