terraform {
  required_version = ">= 1.5"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.40"
    }
  }
}

variable "project" {
  description = "Project name, used as a resource prefix"
  type        = string
  default     = "mayolo"
}
