# mayolo infra

Terraform that provisions the Cloudflare R2 bucket mayolo writes datasets to.

R2 access keys are user-provisioned (Cloudflare dashboard → R2 → API tokens).
Drop the credential dump at repo root in `cloudlfare-r2.txt` (the typo'd
filename is intentional — matches the existing file). The
`scripts/tf-outputs-to-env.sh` script reads access key + secret from that
dump and writes them to `.env.local` alongside the bucket/endpoint outputs
from Terraform.

State is local for now (`terraform.tfstate`). Move to an S3 backend if anyone
else needs to run this.

## Apply

```bash
cd infra
terraform init
TF_VAR_cloudflare_api_token="$(grep '^cfat_' ../cloudlfare-r2.txt | head -1 | tr -d '[:space:]')" \
  terraform apply -auto-approve

# Capture outputs and the R2 access keys into .env.local
../scripts/tf-outputs-to-env.sh
```

## Destroy

```bash
cd infra
TF_VAR_cloudflare_api_token="$(grep '^cfat_' ../cloudlfare-r2.txt | head -1 | tr -d '[:space:]')" \
  terraform destroy -auto-approve
```

## History

- 2026-05-11: AWS S3 + IAM removed in favor of Cloudflare R2 (free egress on
  read-heavy workloads; DuckDB scans every query). Code uses the AWS S3 SDK
  with a custom endpoint, so swapping back is one-env-var.
