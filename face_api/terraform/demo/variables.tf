variable "aws_region" {
  type    = string
  default = "eu-north-1"
}

variable "instance_type" {
  type    = string
  default = "c7i-flex.large"
}

variable "admin_cidr" {
  description = "Administrator public IPv4 address in CIDR format"
  type        = string
}

variable "ssh_public_key_path" {
  type    = string
  default = "~/.ssh/rubicon-demo-terraform.pub"
}
