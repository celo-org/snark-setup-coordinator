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

variable "initial_verifier" {
  type        = string
  description = "A Celo Public Key corresponding to the cLabs verifier."
}

