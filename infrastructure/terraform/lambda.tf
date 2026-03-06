# Archive the Lambda function code
# Note: In production, you'd use proper build/packaging steps
data "archive_file" "lambda_placeholder" {
  type        = "zip"
  output_path = "${path.module}/.terraform/lambda_placeholder.zip"

  source {
    content  = "module.exports.handler = async () => ({ statusCode: 200, body: 'Lambda initialized' })"
    filename = "index.js"
  }
}

# Shows Handler Lambda Function
resource "aws_lambda_function" "shows_handler" {
  filename         = data.archive_file.lambda_placeholder.output_path
  function_name   = "${local.project_name}-shows-handler-${local.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = var.lambda_timeout
  memory_size     = var.lambda_memory_size
  source_code_hash = data.archive_file.lambda_placeholder.output_base64sha256

  environment {
    variables = {
      ENVIRONMENT              = var.environment
      DYNAMODB_SHOWS_TABLE     = aws_dynamodb_table.shows.name
      DYNAMODB_LOCATIONS_TABLE = aws_dynamodb_table.locations.name
    }
  }

  tags = merge(
    var.tags,
    {
      Name = "${local.project_name}-shows-handler-${local.environment}"
    }
  )

  depends_on = [
    aws_iam_role_policy.lambda_dynamodb,
    aws_iam_role_policy_attachment.lambda_basic
  ]
}

# Scraper Lambda Function
resource "aws_lambda_function" "scraper" {
  filename         = data.archive_file.lambda_placeholder.output_path
  function_name   = "${local.project_name}-scraper-${local.environment}"
  role            = aws_iam_role.lambda_role.arn
  handler         = "index.handler"
  runtime         = "nodejs20.x"
  timeout         = 300 # 5 minutes for scraper
  memory_size     = 1024  # Need more memory for Puppeteer
  source_code_hash = data.archive_file.lambda_placeholder.output_base64sha256

  environment {
    variables = {
      ENVIRONMENT              = var.environment
      DYNAMODB_SHOWS_TABLE     = aws_dynamodb_table.shows.name
      DYNAMODB_SCRAPE_LOG_TABLE = aws_dynamodb_table.scrape_log.name
      TCDB_SCRAPER_ENABLED     = "true"
    }
  }

  # Note: Real deployment requires:
  # - Lambda Layer for Puppeteer & Chrome
  # - Proper package bundling
  # - Architecture considerations (chromium in Lambda)

  tags = merge(
    var.tags,
    {
      Name = "${local.project_name}-scraper-${local.environment}"
    }
  )

  depends_on = [
    aws_iam_role_policy.lambda_dynamodb,
    aws_iam_role_policy_attachment.lambda_basic
  ]
}

# Lambda permission for API Gateway to invoke shows handler
resource "aws_lambda_permission" "api_gateway_shows" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.shows_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.bcshows.execution_arn}/*/*"
}

# Lambda permission for EventBridge to invoke scraper
resource "aws_lambda_permission" "eventbridge_scraper" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.scraper.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.scraper_schedule.arn
}

# CloudWatch Log Group for shows handler
resource "aws_cloudwatch_log_group" "shows_handler_logs" {
  name              = "/aws/lambda/${aws_lambda_function.shows_handler.function_name}"
  retention_in_days = var.environment == "prod" ? 30 : 7

  tags = var.tags
}

# CloudWatch Log Group for scraper
resource "aws_cloudwatch_log_group" "scraper_logs" {
  name              = "/aws/lambda/${aws_lambda_function.scraper.function_name}"
  retention_in_days = var.environment == "prod" ? 30 : 7

  tags = var.tags
}

# EventBridge Rule for scheduled scraper
resource "aws_cloudwatch_event_rule" "scraper_schedule" {
  name                = "${local.project_name}-scraper-schedule-${local.environment}"
  description         = "Trigger ${local.project_name} scraper on schedule"
  schedule_expression = var.scraper_schedule
  is_enabled          = var.scraper_enabled

  tags = var.tags
}

# EventBridge Target (invoke Lambda)
resource "aws_cloudwatch_event_target" "scraper_target" {
  rule      = aws_cloudwatch_event_rule.scraper_schedule.name
  target_id = "ScraperLambdaTarget"
  arn       = aws_lambda_function.scraper.arn
  role_arn  = aws_iam_role.eventbridge_role.arn
}
