output "dynamodb_shows_table_name" {
  description = "Name of the CardShows DynamoDB table"
  value       = aws_dynamodb_table.shows.name
}

output "dynamodb_shows_table_arn" {
  description = "ARN of the CardShows DynamoDB table"
  value       = aws_dynamodb_table.shows.arn
}

output "dynamodb_locations_table_name" {
  description = "Name of the Locations DynamoDB table"
  value       = aws_dynamodb_table.locations.name
}

output "dynamodb_scrape_log_table_name" {
  description = "Name of the ScrapeLog DynamoDB table"
  value       = aws_dynamodb_table.scrape_log.name
}

output "api_gateway_endpoint" {
  description = "API Gateway endpoint URL"
  value       = aws_api_gateway_stage.api.invoke_url
}

output "lambda_shows_handler_arn" {
  description = "ARN of the shows Lambda function"
  value       = aws_lambda_function.shows_handler.arn
}

output "lambda_shows_handler_name" {
  description = "Name of the shows Lambda function"
  value       = aws_lambda_function.shows_handler.function_name
}

output "lambda_scraper_arn" {
  description = "ARN of the scraper Lambda function"
  value       = aws_lambda_function.scraper.arn
}

output "lambda_scraper_name" {
  description = "Name of the scraper Lambda function"
  value       = aws_lambda_function.scraper.function_name
}

output "iam_lambda_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_role.arn
}

output "environment_file_content" {
  description = "Environment variables to add to .env"
  value = {
    AWS_REGION                   = var.aws_region
    DYNAMODB_SHOWS_TABLE         = aws_dynamodb_table.shows.name
    DYNAMODB_LOCATIONS_TABLE     = aws_dynamodb_table.locations.name
    DYNAMODB_SCRAPE_LOG_TABLE    = aws_dynamodb_table.scrape_log.name
    LAMBDA_SHOWS_HANDLER_NAME    = aws_lambda_function.shows_handler.function_name
    LAMBDA_SCRAPER_NAME          = aws_lambda_function.scraper.function_name
    API_ENDPOINT                 = aws_api_gateway_stage.api.invoke_url
  }
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.admin_users.id
}

output "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = aws_cognito_user_pool.admin_users.arn
}

output "cognito_user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  value       = aws_cognito_user_pool_client.api_client.id
}

output "cognito_identity_pool_id" {
  description = "Cognito Identity Pool ID"
  value       = aws_cognito_identity_pool.main.id
}

output "cognito_domain" {
  description = "Cognito domain for sign-in URLs"
  value       = aws_cognito_user_pool_domain.admin_domain.domain
}

output "deployment_info" {
  description = "Deployment information"
  value = {
    region      = var.aws_region
    environment = var.environment
    api_url     = aws_api_gateway_stage.api.invoke_url
    dynamodb_tables = [
      aws_dynamodb_table.shows.name,
      aws_dynamodb_table.locations.name,
      aws_dynamodb_table.scrape_log.name
    ]
    cognito_pool_id    = aws_cognito_user_pool.admin_users.id
    cognito_client_id  = aws_cognito_user_pool_client.api_client.id
  }
}
