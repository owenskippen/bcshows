terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment to use S3 backend (after first apply)
  # backend "s3" {
  #   bucket         = "bcshows-terraform-state"
  #   key            = "prod/terraform.tfstate"
  #   region         = "us-west-2"
  #   encrypt        = true
  #   dynamodb_table = "terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "bcshows"
      Environment = var.environment
      ManagedBy   = "Terraform"
      CreatedAt   = timestamp()
    }
  }
}

# Local variables
locals {
  project_name = "bcshows"
  environment  = var.environment
  aws_region   = var.aws_region

  table_settings = {
    shows = {
      billing_mode                = "PAY_PER_REQUEST"
      stream_specification_enabled = var.environment == "prod" ? true : false
    }
    locations = {
      billing_mode                = "PAY_PER_REQUEST"
      stream_specification_enabled = false
    }
    scrape_log = {
      billing_mode                = "PAY_PER_REQUEST"
      stream_specification_enabled = false
    }
  }
}
