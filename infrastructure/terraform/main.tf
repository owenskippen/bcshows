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

  table_settings = var.environment == "prod" ? {
    shows = {
      billing_mode                = "PAY_PER_REQUEST"
      stream_specification_enabled = true
    }
    locations = {
      billing_mode                = "PAY_PER_REQUEST"
      stream_specification_enabled = false
    }
    scrape_log = {
      billing_mode                = "PAY_PER_REQUEST"
      stream_specification_enabled = false
    }
  } : {
    shows = {
      billing_mode                = "PROVISIONED"
      read_capacity              = 5
      write_capacity             = 5
      stream_specification_enabled = false
    }
    locations = {
      billing_mode        = "PROVISIONED"
      read_capacity       = 1
      write_capacity      = 1
    }
    scrape_log = {
      billing_mode        = "PROVISIONED"
      read_capacity       = 1
      write_capacity      = 1
    }
  }
}
