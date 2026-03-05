# Terraform Infrastructure for BC Card Shows

This directory contains Infrastructure as Code for deploying the BC Card Shows application to AWS using Terraform.

## Architecture Components

- **DynamoDB**: Three tables for shows, locations, and scraper logs
- **Lambda**: Shows API handler and scraper function
- **API Gateway**: REST API endpoint
- **IAM**: Roles and policies for Lambda execution
- **CloudWatch**: Logging and monitoring
- **EventBridge**: Scheduled scraper invocation

## Cost Optimization

This configuration is optimized for **AWS Free Tier**:

- **DynamoDB**: On-demand billing (dev) / Provisioned with free tier limits (production)
- **Lambda**: Within 1M invocations/month free tier
- **API Gateway**: Within 1M requests/month free tier
- **CloudWatch**: Within 5GB free tier for logs

**Total MVP Cost**: ~$0-5/month (after free tier expires)

## Prerequisites

1. **AWS Account** - With free tier eligibility if new
2. **AWS CLI** - Configured with credentials
   ```bash
   aws configure
   ```
3. **Terraform** - v1.0 or later
   ```bash
   terraform --version
   ```

## Environment Setup

### 1. Initialize Terraform

```bash
cd infrastructure/terraform

# Initialize Terraform (downloads providers, creates .terraform)
terraform init
```

### 2. Create Variables File

```bash
# Copy example to actual file
cp terraform.tfvars.example terraform.tfvars

# Edit with your settings
nano terraform.tfvars
```

### 3. Validate Configuration

```bash
# Check syntax and validate
terraform validate

# See what will be created
terraform plan
```

### 4. Deploy Infrastructure

```bash
# Apply the configuration
terraform apply

# Review the output and type 'yes' to confirm
```

### 5. Capture Outputs

```bash
# View deployment outputs
terraform output

# Save to file for reference
terraform output > deployment.json
```

## Scaling Configuration

### Development Environment

```hcl
dynamodb_billing_mode = "PROVISIONED"
dynamodb_read_capacity = 1
dynamodb_write_capacity = 1
lambda_memory_size = 256
```

**Cost**: ~$1-2/month

### Production Environment

```hcl
dynamodb_billing_mode = "PAY_PER_REQUEST"
lambda_memory_size = 512
# Enable backups and encryption
```

**Cost**: Scales with usage, typically $5-20/month for moderate traffic

## Managing Infrastructure

### Update Configuration

```bash
# Edit variables
nano terraform.tfvars

# Plan changes
terraform plan

# Apply changes
terraform apply
```

### Destroy Infrastructure

```bash
# Destroy all resources (WARNING: irreversible)
terraform destroy

# Confirm deletion
```

## Scaling to Production

To upgrade from development to production:

1. **Create production variables file**:
   ```bash
   cat > terraform.prod.tfvars << EOF
   aws_region = "us-west-2"
   environment = "prod"
   dynamodb_billing_mode = "PAY_PER_REQUEST"
   lambda_memory_size = 512
   EOF
   ```

2. **Apply with prod vars**:
   ```bash
   terraform plan -var-file=terraform.prod.tfvars
   terraform apply -var-file=terraform.prod.tfvars
   ```

## Monitoring

### CloudWatch Dashboards

```bash
# View Lambda metrics
aws cloudwatch get-metric-statistics \
  --metric-name Invocations \
  --namespace AWS/Lambda \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

### API Gateway Metrics

```bash
# View API error rate
aws cloudwatch get-metric-statistics \
  --metric-name 4XXError \
  --namespace AWS/ApiGateway \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

## Backend State Management

For team collaboration, store Terraform state in S3:

```bash
# Create S3 bucket for state
aws s3 mb s3://bcshows-terraform-state --region us-west-2

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket bcshows-terraform-state \
  --versioning-configuration Status=Enabled

# Create DynamoDB table for state locks
aws dynamodb create-table \
  --table-name terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

Then uncomment the `backend` block in `main.tf`.

## Troubleshooting

### Lambda Deployment Issues

If Lambda functions don't update:

```bash
# Force rebuild
rm -rf .terraform/
terraform init
terraform apply
```

### DynamoDB Throttling

If you see throttling errors:

```bash
# Increase capacity for development
terraform apply -var=dynamodb_read_capacity=5 -var=dynamodb_write_capacity=5

# For production, use PAY_PER_REQUEST
terraform apply -var=dynamodb_billing_mode=PAY_PER_REQUEST
```

### API Gateway CORS Errors

CORS is configured in `api_gateway.tf`. To modify:

```hcl
cors_allowed_origins = [
  "https://yourdomain.com",
  "https://www.yourdomain.com"
]
```

## Documentation

- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS DynamoDB Documentation](https://docs.aws.amazon.com/dynamodb/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)
