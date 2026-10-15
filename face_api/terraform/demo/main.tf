terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Rubicon-Demo"
      Environment = "demo"
      ManagedBy   = "Terraform"
    }
  }
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

resource "aws_security_group" "rubicon" {
  name_prefix = "rubicon-demo-"
  description = "Rubicon temporary demo security group"
  vpc_id      = data.aws_vpc.default.id

  tags = {
    Name = "rubicon-demo-sg"
  }
}

resource "aws_vpc_security_group_ingress_rule" "ssh" {
  security_group_id = aws_security_group.rubicon.id

  cidr_ipv4   = var.admin_cidr
  from_port   = 22
  to_port     = 22
  ip_protocol = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "web" {
  for_each = {
    http  = 80
    https = 443
  }

  security_group_id = aws_security_group.rubicon.id

  cidr_ipv4   = "0.0.0.0/0"
  from_port   = each.value
  to_port     = each.value
  ip_protocol = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "outbound" {
  security_group_id = aws_security_group.rubicon.id

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"
}

resource "aws_key_pair" "rubicon" {
  key_name_prefix = "rubicon-demo-"
  public_key      = file(pathexpand(var.ssh_public_key_path))
}

resource "aws_instance" "rubicon" {
  ami                  = data.aws_ami.ubuntu.id
  instance_type        = var.instance_type
  iam_instance_profile = aws_iam_instance_profile.rubicon.name

  subnet_id = sort(data.aws_subnets.default.ids)[0]

  associate_public_ip_address = true

  vpc_security_group_ids = [
    aws_security_group.rubicon.id
  ]

  key_name = aws_key_pair.rubicon.key_name

  user_data = file("${path.module}/bootstrap.sh")

  instance_initiated_shutdown_behavior = "terminate"

  metadata_options {
    http_tokens = "required"
  }

  root_block_device {
    volume_size           = 30
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  tags = {
    Name = "rubicon-aws-demo"
  }
}
