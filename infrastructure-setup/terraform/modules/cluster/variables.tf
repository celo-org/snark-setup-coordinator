variable "environment" {
    type = string
    description = "The name of the environment this cluster is being deployed to."
}

variable "resource_group_name" {
    type = string
    description = "The name of the resource group the cluster should be deployed to."
}

variable "cluster_name" {
    type = string
    description = "Name of the cluster."
}

variable "cluster_dns_prefix" {
    type = string
    description = "DNS Prefix, no punctuation."
}