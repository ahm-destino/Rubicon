output "instance_id" {
  value = aws_instance.rubicon.id
}

output "public_ip" {
  value = aws_instance.rubicon.public_ip
}

output "api_hostname" {
  value = "${replace(aws_instance.rubicon.public_ip, ".", "-")}.sslip.io"
}

output "ssh_command" {
  value = "ssh -i ~/.ssh/rubicon-demo-terraform ubuntu@${aws_instance.rubicon.public_ip}"
}
