# AWS Cognito User Pool for Admin Authentication
resource "aws_cognito_user_pool" "admin_users" {
  name                     = "${local.project_name}-admin-pool-${local.environment}"
  alias_attributes         = ["email"]
  auto_verified_attributes = ["email"]

  # Password Policy
  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  # Email Configuration
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # MFA Configuration (Optional for MVP)
  mfa_configuration = "OPTIONAL"

  # Device Configuration
  device_configuration {
    challenge_required_on_new_device      = false
    device_only_remembered_on_user_prompt = false
  }

  # User Attribute Update Settings
  user_attribute_update_settings {
    attributes_require_verification_before_update = ["email"]
  }

  # Account Recovery Settings
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Lambda Triggers (optional - can add custom validation)
  # post_confirmation {
  #   lambda_arn = aws_lambda_function.post_confirm.arn
  # }

  tags = merge(
    var.tags,
    {
      Name = "${local.project_name}-admin-pool-${local.environment}"
    }
  )
}

# Cognito User Pool Domain (for hosted UI if needed)
resource "aws_cognito_user_pool_domain" "admin_domain" {
  domain       = "${local.project_name}-${local.environment}-${data.aws_caller_identity.current.account_id}"
  user_pool_id = aws_cognito_user_pool.admin_users.id
}

# Cognito User Pool Client (for API access)
resource "aws_cognito_user_pool_client" "api_client" {
  name                = "${local.project_name}-api-client-${local.environment}"
  user_pool_id        = aws_cognito_user_pool.admin_users.id
  generate_secret     = false
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_CUSTOM_AUTH"
  ]

  # Token expiration
  access_token_validity           = 1
  id_token_validity               = 1
  refresh_token_validity          = 30
  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # Allowed OAuth flows (for future frontend integration)
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  allowed_oauth_flows_user_pool_client = true
  callback_urls                        = [
    "http://localhost:3000/admin/callback",
    "https://bcshows.vercel.app/admin/callback"
  ]
  logout_urls = [
    "http://localhost:3000/admin/logout",
    "https://bcshows.vercel.app/admin/logout"
  ]

  # Prevent user existence errors (security best practice)
  prevent_user_existence_errors = "ENABLED"
}

# Admin User Group
resource "aws_cognito_user_group" "admin_group" {
  name           = "admin"
  user_pool_id   = aws_cognito_user_pool.admin_users.id
  description    = "Admin users with full access to shows management"
  priority       = 10
}

# Moderator User Group (for future use)
resource "aws_cognito_user_group" "moderator_group" {
  name           = "moderator"
  user_pool_id   = aws_cognito_user_pool.admin_users.id
  description    = "Moderators with limited show approval access"
  priority       = 20
}

# Data source for current AWS account ID
data "aws_caller_identity" "current" {}

# Cognito Identity Pool (for accessing AWS resources directly - optional)
resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "${local.project_name}-identity-${local.environment}"
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    client_id              = aws_cognito_user_pool_client.api_client.id
    provider_name          = aws_cognito_user_pool.admin_users.provider_name
    server_side_token_validation = false
  }

  tags = var.tags
}

# IAM Role for Authenticated Users
resource "aws_iam_role" "cognito_authenticated_role" {
  name = "${local.project_name}-cognito-authenticated-${local.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
          ForAllValues = {
            StringLike = {
              "cognito-identity.amazonaws.com:sub" = "*"
            }
          }
        }
      }
    ]
  })

  tags = var.tags
}

# Attach policy to authenticated role (minimal permissions for API calls)
resource "aws_iam_role_policy" "cognito_authenticated_policy" {
  name = "${local.project_name}-cognito-authenticated-policy"
  role = aws_iam_role.cognito_authenticated_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "apigateway:*"  # Can call API Gateway (when using SigV4 signing)
        ]
        Resource = "*"
      }
    ]
  })
}

# Attach identity pool role
resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.main.id

  roles = {
    authenticated = aws_iam_role.cognito_authenticated_role.arn
  }
}

# CloudWatch Alarms for Cognito
resource "aws_cloudwatch_log_group" "cognito_logs" {
  name              = "/aws/cognito/${local.project_name}-${local.environment}"
  retention_in_days = var.environment == "prod" ? 30 : 7

  tags = var.tags
}
