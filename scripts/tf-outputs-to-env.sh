#!/usr/bin/env bash
# Read terraform outputs from infra/ and write S3 env vars into .env.local.
# Storage now lives on Cloudflare R2 (S3-compatible). The R2 access key and
# secret are user-provisioned outside Terraform — drop them in
# cloudlfare-r2.txt at repo root (the typo'd filename is intentional, matches
# the existing user file) and this script extracts them.
#
# Idempotent: replaces existing lines for the same keys.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"
TF_DIR="$ROOT/infra"
KEYS_FILE="$ROOT/cloudlfare-r2.txt"

cd "$TF_DIR"

outputs_json="$(terraform output -json)"

upsert() {
  local key="$1"
  local val="$2"
  touch "$ENV_FILE"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i '' "/^${key}=/d" "$ENV_FILE"
  fi
  printf '%s=%s\n' "$key" "$val" >> "$ENV_FILE"
}

read_tf() {
  printf '%s' "$outputs_json" | node -e "
    const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    process.stdout.write(String(data['$1'].value));
  "
}

# Map TF outputs → app env names
S3_BUCKET="$(read_tf R2_BUCKET)"
S3_ENDPOINT="$(read_tf R2_ENDPOINT)"
S3_REGION="auto"

upsert S3_BUCKET "$S3_BUCKET"
upsert S3_REGION "$S3_REGION"
upsert S3_ENDPOINT "$S3_ENDPOINT"
echo "wrote S3_BUCKET=$S3_BUCKET"
echo "wrote S3_REGION=$S3_REGION"
echo "wrote S3_ENDPOINT=$S3_ENDPOINT"

# Extract R2 access key / secret from the user-provided credential dump.
if [[ -f "$KEYS_FILE" ]]; then
  KEY_ID="$(awk '/Access Key ID/{getline; print}' "$KEYS_FILE" | tr -d '[:space:]')"
  SECRET="$(awk '/Secret Access Key/{getline; print}' "$KEYS_FILE" | tr -d '[:space:]')"
  if [[ -n "$KEY_ID" && -n "$SECRET" ]]; then
    upsert AWS_ACCESS_KEY_ID "$KEY_ID"
    upsert AWS_SECRET_ACCESS_KEY "$SECRET"
    echo "wrote AWS_ACCESS_KEY_ID=••• (redacted, len=${#KEY_ID})"
    echo "wrote AWS_SECRET_ACCESS_KEY=••• (redacted, len=${#SECRET})"
  else
    echo "WARN: could not parse R2 access key/secret out of $KEYS_FILE — set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY manually"
  fi
else
  echo "WARN: $KEYS_FILE not found — set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY manually"
fi
