# CardShows Table
resource "aws_dynamodb_table" "shows" {
  name           = "${local.project_name}-shows-${local.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "pk"
  range_key      = "sk"
  stream_enabled = local.table_settings.shows.stream_specification_enabled

  # Attributes
  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  attribute {
    name = "city"
    type = "S"
  }

  attribute {
    name = "date"
    type = "S"
  }

  # Global Secondary Index for City-based queries
  global_secondary_index {
    name            = "CityIndex"
    hash_key        = "city"
    range_key       = "date"
    projection_type = "ALL"
  }

  # Global Secondary Index for Date-based queries
  global_secondary_index {
    name            = "DateIndex"
    hash_key        = "date"
    range_key       = "city"
    projection_type = "ALL"
  }

  # Time to Live for auto-deletion of old shows (after 2 years)
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = var.environment == "prod" ? true : false
  }

  tags = merge(
    var.tags,
    {
      Name = "${local.project_name}-shows-${local.environment}"
    }
  )
}

# Locations Table
resource "aws_dynamodb_table" "locations" {
  name         = "${local.project_name}-locations-${local.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  point_in_time_recovery {
    enabled = var.environment == "prod" ? true : false
  }

  tags = merge(
    var.tags,
    {
      Name = "${local.project_name}-locations-${local.environment}"
    }
  )
}

# Scrape Log Table
resource "aws_dynamodb_table" "scrape_log" {
  name         = "${local.project_name}-scrape-log-${local.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  # TTL: Keep logs for 90 days
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = var.environment == "prod" ? true : false
  }

  tags = merge(
    var.tags,
    {
      Name = "${local.project_name}-scrape-log-${local.environment}"
    }
  )
}
