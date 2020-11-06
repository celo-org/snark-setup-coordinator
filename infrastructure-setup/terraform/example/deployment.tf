provider "azurerm" {
  version = "=2.20.0"
  features {}
}

# Configure the Microsoft Azure Active Directory Provider
provider "azuread" {
  version = "~> 1.0.0"
}

# Local variables that define the deployment, make changes here as-needed
locals {
  environment                   = "example"
  cluster_prefix                = "plumo-${local.environment}"
  resource_group_name           = "plumo-${local.environment}"
  coordinator_service_image_tag = "test"
  coordinator_service_image     = "coordinator-service"
  initial_verifier              = "0x07dfadb3483c474fc0913a232cc3a06483d17060"
}

resource "azurerm_resource_group" "coordinator_group" {
  name     = local.resource_group_name
  location = "West US"
}



# The Helm 3 Provider, you can simply configure this if you need to deploy to an existing cluster.
# Ex. Azure Cluster Data Source: https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/data-sources/kubernetes_cluster
provider helm {
  version = "~> 1.3.2"
  debug   = true
  kubernetes {
    host                   = module.aks.host
    client_certificate     = base64decode(module.aks.client_certificate)
    client_key             = base64decode(module.aks.client_key)
    cluster_ca_certificate = base64decode(module.aks.cluster_ca_certificate)
    username               = module.aks.username
    password               = module.aks.password
    load_config_file       = false
  }
}

# Kubernetes Provider (used for creating namespaces)
provider "kubernetes" {
  version                = "~> 1.13.3"
  host                   = module.aks.host
  client_certificate     = base64decode(module.aks.client_certificate)
  client_key             = base64decode(module.aks.client_key)
  cluster_ca_certificate = base64decode(module.aks.cluster_ca_certificate)
  username               = module.aks.username
  password               = module.aks.password
  load_config_file       = false
}

# The coordinator stack and any other kubernetes resources that are needed
module "deployment" {
  source                        = "../modules/coordinator-stack"
  environment                   = local.environment
  coordinator_service_image_tag = local.coordinator_service_image_tag
  coordinator_service_image     = local.coordinator_service_image
  initial_verifier              = local.initial_verifier
  resource_group_name           = local.resource_group_name
  depends_on                    = [azurerm_resource_group.coordinator_group]
}

output "front_door_hostname" {
  value = module.deployment.front_door_hostname
}
output "cluster_name" {
  value = "${local.cluster_prefix}-aks"
}

output "kube_ctl_command" {
  value = "az aks get-credentials --resource-group ${local.resource_group_name} --name ${local.cluster_prefix}-aks"
}