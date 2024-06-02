variable "environment" {
  type        = string
  description = "The environment this module is being deployed to."
}

variable "resource_group_name" {
  type        = string
  description = "The name of the resource group to deploy to."
}

variable "coordinator_service_image" {
  type        = string
  description = "The image to use in the coordinator deployment"
}

variable "coordinator_service_image_tag" {
  type        = string
  description = "The tag to use in the coordinator deployment"
  default     = "test"
}

variable "initial_verifier_addresses" {
  type        = string
  description = "A space-delimited list of Celo Public Keys corresponding to one or more cLabs verifiers."
  default     = "0xc3e855aec16975e8351aba6f8261e2025c3159ca"
}

variable "phase" {
  type        = string
  description = "The setup phase."
  default     = "phase1"
}

variable "verifier_image" {
  type        = string
  description = "The image to use in the verifier deployment"
}

variable "verifier_image_tag" {
  type        = string
  description = "The tag to use in the verifier deployment"
  default     = "test"
}

variable "verifier_credentials" {
  type        = list(map(string))
  description = "An array of Maps consisting of Verifier Credentials"
  default = [{
    path     = "./plumo-verifier-example.keys"
    password = "password"
  }]
}

variable "verifier_count" {
  type        = number
  description = "The number of verifiers to deploy, must be less than or equal to number of keys passed."
}

variable "monitor_image" {
  type        = string
  description = "The image to use in the monitor deployment"
}

variable "monitor_image_tag" {
  type        = string
  description = "The tag to use in the monitor deployment"
  default     = "test"
}

variable "monitor_polling_interval" {
  type        = number
  description = "The number of minutes the monitor will wait in-between requests."
  default     = 1
}

variable "monitor_replicas" {
  type        = number
  description = "The number of monitor instances to deploy."
  default     = 1
}

variable "log_analytics_workspace_name" {
  type = string
  description = "The name of the log analytics workspace to Alert on."
}

variable "azure_monitor_alerts_webhook_uri" {
  type = string
  description = "A webhook URL for Azure Monitor to send alerts to, like VictorOps or Slack."
}
