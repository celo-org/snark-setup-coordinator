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
  default = "0xc3e855aec16975e8351aba6f8261e2025c3159ca"
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
  type = list(map(string))
  description = "An array of Maps consisting of Verifier Credentials"
  default = [{
    path = "./plumo-verifier-example.keys"
    password = "password"
  }]
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