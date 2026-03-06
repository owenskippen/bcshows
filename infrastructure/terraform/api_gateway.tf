# API Gateway REST API
resource "aws_api_gateway_rest_api" "bcshows" {
  name        = "${local.project_name}-api-${local.environment}"
  description = "BC Card Shows API"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = var.tags
}

# CloudWatch Role for API Gateway logging
resource "aws_iam_role" "api_gateway_logs" {
  name = "${local.project_name}-api-gateway-logs-${local.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "apigateway.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "api_gateway_logs" {
  role       = aws_iam_role.api_gateway_logs.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess"
}

# API Gateway Account for logging
resource "aws_api_gateway_account" "bcshows" {
  cloudwatch_role_arn = aws_iam_role.api_gateway_logs.arn
}

# Root resource
resource "aws_api_gateway_resource" "api_root" {
  rest_api_id = aws_api_gateway_rest_api.bcshows.id
  parent_id   = aws_api_gateway_rest_api.bcshows.root_resource_id
  path_part   = "api"
}

# /shows resource
resource "aws_api_gateway_resource" "shows" {
  rest_api_id = aws_api_gateway_rest_api.bcshows.id
  parent_id   = aws_api_gateway_resource.api_root.id
  path_part   = "shows"
}

# GET /api/shows
resource "aws_api_gateway_method" "get_shows" {
  rest_api_id      = aws_api_gateway_rest_api.bcshows.id
  resource_id      = aws_api_gateway_resource.shows.id
  http_method      = "GET"
  authorization    = "NONE"
  request_parameters = {
    "method.request.querystring.startDate" = false
    "method.request.querystring.endDate"   = false
    "method.request.querystring.city"      = false
    "method.request.querystring.tags"      = false
    "method.request.querystring.search"    = false
  }
}

# Integration with Lambda
resource "aws_api_gateway_integration" "get_shows" {
  rest_api_id             = aws_api_gateway_rest_api.bcshows.id
  resource_id             = aws_api_gateway_resource.shows.id
  http_method             = aws_api_gateway_method.get_shows.http_method
  type                    = "AWS_PROXY"
  integration_http_method = "POST"
  uri                     = aws_lambda_function.shows_handler.invoke_arn
}

# POST /api/shows (admin only)
resource "aws_api_gateway_method" "post_shows" {
  rest_api_id      = aws_api_gateway_rest_api.bcshows.id
  resource_id      = aws_api_gateway_resource.shows.id
  http_method      = "POST"
  authorization    = "AWS_IAM" # Protected - requires AWS credentials
  request_parameters = {
    "method.request.header.Authorization" = true
  }
}

resource "aws_api_gateway_integration" "post_shows" {
  rest_api_id             = aws_api_gateway_rest_api.bcshows.id
  resource_id             = aws_api_gateway_resource.shows.id
  http_method             = aws_api_gateway_method.post_shows.http_method
  type                    = "AWS_PROXY"
  integration_http_method = "POST"
  uri                     = aws_lambda_function.shows_handler.invoke_arn
}

# CORS configuration
resource "aws_api_gateway_method" "shows_options" {
  rest_api_id      = aws_api_gateway_rest_api.bcshows.id
  resource_id      = aws_api_gateway_resource.shows.id
  http_method      = "OPTIONS"
  authorization    = "NONE"
}

resource "aws_api_gateway_integration" "shows_options" {
  rest_api_id      = aws_api_gateway_rest_api.bcshows.id
  resource_id      = aws_api_gateway_resource.shows.id
  http_method      = aws_api_gateway_method.shows_options.http_method
  type             = "MOCK"
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_integration_response" "shows_options_response" {
  rest_api_id      = aws_api_gateway_rest_api.bcshows.id
  resource_id      = aws_api_gateway_resource.shows.id
  http_method      = aws_api_gateway_method.shows_options.http_method
  status_code      = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,PUT,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_method_response.shows_options_response]
}

resource "aws_api_gateway_method_response" "shows_options_response" {
  rest_api_id      = aws_api_gateway_rest_api.bcshows.id
  resource_id      = aws_api_gateway_resource.shows.id
  http_method      = aws_api_gateway_method.shows_options.http_method
  status_code      = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

# API Deployment
resource "aws_api_gateway_deployment" "bcshows" {
  rest_api_id = aws_api_gateway_rest_api.bcshows.id

  depends_on = [
    aws_api_gateway_integration.get_shows,
    aws_api_gateway_integration.post_shows,
    aws_api_gateway_integration.shows_options,
  ]
}

# API Stage
resource "aws_api_gateway_stage" "api" {
  deployment_id = aws_api_gateway_deployment.bcshows.id
  rest_api_id   = aws_api_gateway_rest_api.bcshows.id
  stage_name    = var.api_stage

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_logs.arn
    format          = "$context.requestId $context.error.messageString $context.error.type $context.stage $context.accountId $context.identity.sourceIp $context.requestTime $context.routeKey $context.status $context.integration.latency"
  }

  tags = var.tags
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_logs" {
  name              = "/aws/apigateway/${local.project_name}-${local.environment}"
  retention_in_days = var.environment == "prod" ? 30 : 7

  tags = var.tags
}

# CloudWatch Alarms for API Gateway
resource "aws_cloudwatch_metric_alarm" "api_4xx_errors" {
  alarm_name          = "${local.project_name}-api-4xx-errors-${local.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "4XXError"
  namespace           = "AWS/ApiGateway"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "Alert when API returns 4XX errors"

  dimensions = {
    ApiName = aws_api_gateway_rest_api.bcshows.name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "api_5xx_errors" {
  alarm_name          = "${local.project_name}-api-5xx-errors-${local.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "Alert when API returns 5XX errors"

  dimensions = {
    ApiName = aws_api_gateway_rest_api.bcshows.name
  }

  tags = var.tags
}
