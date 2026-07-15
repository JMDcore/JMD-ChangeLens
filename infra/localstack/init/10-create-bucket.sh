#!/usr/bin/env sh
set -eu

awslocal s3api head-bucket --bucket changelens-screenshots 2>/dev/null || \
  awslocal s3api create-bucket \
    --bucket changelens-screenshots \
    --region eu-west-1 \
    --create-bucket-configuration LocationConstraint=eu-west-1

awslocal s3api put-public-access-block \
  --bucket changelens-screenshots \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
