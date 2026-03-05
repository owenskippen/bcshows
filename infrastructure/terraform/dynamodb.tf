# CardShows Table
resource "aws_dynamodb_table" "shows" {
  name           = "${local.project_name}-shows-${local.environment}"
  billing_mode   = local.table_settings.shows.billing_mode
  hash_key       = "pk"
  range_key      = "sk"
  stream_enabled = local.table_settings.shows.stream_specification_enabled

  # Billing mode: PROVISIONED
  dynamic "attribute" {
    for_each = var.environment != "prod" ? [1] : []
    content {
      read_capacity_units  = local.table_settings.shows.read_capacity
      write_capacity_units = local.table_settings.shows.write_capacity
    }
  }

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

    dynamic "provisioned_throughput" {
      for_each = var.environment != "prod" ? [1] : []
      content {
        read_capacity_units  = 5
        write_capacity_units = 5
      }
    }
  }

  # Global Secondary Index for Date-based queries
  global_secondary_index {
    name            = "DateIndex"
    hash_key        = "date"
    range_key       = "city"
    projection_type = "ALL"

    dynamic "provisioned_throughput" {
      for_each = var.environment != "prod" ? [1] : []
      content {
        read_capacity_units  = 5
        write_capacity_units = 5
      }
    }
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
  name           = "${local.project_name}-locations-${local.environment}"
  billing_mode   = local.table_settings.locations.billing_mode
  hash_key       = "pk"
  range_key      = "sk"
  stream_enabled = local.table_settings.locations.stream_specification_enabled

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  dynamic "provisioned_throughput" {
    for_each = var.environment != "prod" ? [1] : []
    content {
      read_capacity_units  = local.table_settings.locations.read_capacity
      write_capacity_units = local.table_settings.locations.write_capacity
    }
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
  name           = "${local.project_name}-scrape-log-${local.environment}"
  billing_mode   = local.table_settings.scrape_log.billing_mode
  hash_key       = "pk"
  range_key      = "sk"
  stream_enabled = local.table_settings.scrape_log.stream_specification_enabled

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

  dynamic "provisioned_throughput" {
    for_each = var.environment != "prod" ? [1] : []
    content {
      read_capacity_units  = local.table_settings.scrape_log.read_capacity
      write_capacity_units = local.table_settings.scrape_log.write_capacity
    }
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
