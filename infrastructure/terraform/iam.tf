# Lambda Execution Role
resource "aws_iam_role" "lambda_role" {
  name = "${local.project_name}-lambda-role-${local.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# Basic Lambda execution policy (CloudWatch logs)
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# VPC access policy (if needed for Lambda in VPC)
resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  count      = var.environment == "prod" ? 1 : 0
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# DynamoDB Access Policy
resource "aws_iam_role_policy" "lambda_dynamodb" {
  name = "${local.project_name}-lambda-dynamodb-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          aws_dynamodb_table.shows.arn,
          "${aws_dynamodb_table.shows.arn}/index/CityIndex",
          "${aws_dynamodb_table.shows.arn}/index/DateIndex",
          aws_dynamodb_table.locations.arn,
          aws_dynamodb_table.scrape_log.arn
        ]
      }
    ]
  })
}

# S3 Access Policy (for future image uploads)
resource "aws_iam_role_policy" "lambda_s3" {
  count = 0 # Disabled for MVP, enable in Phase 2
  name  = "${local.project_name}-lambda-s3-policy"
  role  = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "arn:aws:s3:::${local.project_name}-images-${local.environment}/*"
      }
    ]
  })
}

# Cognito Policy (for JWT verification)
resource "aws_iam_role_policy" "lambda_cognito" {
  count = 0 # Disabled for MVP, enable when Cognito is added
  name  = "${local.project_name}-lambda-cognito-policy"
  role  = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:GetUser",
          "cognito-idp:AdminGetUser"
        ]
        Resource = "arn:aws:cognito-idp:${var.aws_region}:*:userpool/*"
      }
    ]
  })
}

# Secrets Manager Policy (for storing API keys, etc.)
resource "aws_iam_role_policy" "lambda_secrets" {
  count = 0 # Disabled for MVP
  name  = "${local.project_name}-lambda-secrets-policy"
  role  = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = "arn:aws:secretsmanager:${var.aws_region}:*:secret:${local.project_name}/*"
      }
    ]
  })
}

# EventBridge (CloudWatch Events) for scheduled scraper
resource "aws_iam_role" "eventbridge_role" {
  name = "${local.project_name}-eventbridge-role-${local.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# EventBridge policy to invoke Lambda
resource "aws_iam_role_policy" "eventbridge_lambda" {
  name = "${local.project_name}-eventbridge-lambda-policy"
  role = aws_iam_role.eventbridge_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = aws_lambda_function.scraper.arn
      }
    ]
  })
}
