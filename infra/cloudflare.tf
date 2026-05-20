variable "cloudflare_api_token" {
  description = "Cloudflare API token with R2 write permissions. Set via TF_VAR_cloudflare_api_token."
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID (the prefix on the R2 endpoint URL)."
  type        = string
  default     = "078503c3fcf44357c3c2971e0ab95ac1"
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

resource "cloudflare_r2_bucket" "data" {
  account_id = var.cloudflare_account_id
  name       = "${var.project}-data"
  location   = "WNAM"
}

output "R2_BUCKET" {
  value = cloudflare_r2_bucket.data.name
}

output "R2_ACCOUNT_ID" {
  value = var.cloudflare_account_id
}

output "R2_ENDPOINT" {
  value = "https://${var.cloudflare_account_id}.r2.cloudflarestorage.com"
}
