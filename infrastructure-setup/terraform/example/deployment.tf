provider "azurerm" {
  version = "=2.20.0"
  features {}
}

# Configure the Microsoft Azure Active Directory Provider
provider "azuread" {
  version = "~> 1.0.0"
}

locals {
  environment = "development"
  cluster_name = "plumo-ceremony-${local.environment}"
  cluster_dns_prefix = "plumoceremony${local.environment}"
  resource_group_name = "coordinator-ceremony-${local.environment}"
  coordinator_service_image_tag = "test"
  coordinator_service_image = "coordinator-service"
  initial_verifier = "0x07dfadb3483c474fc0913a232cc3a06483d17060"
}

resource "azurerm_resource_group" "coordinator_group" {
  name     = "coordinator-ceremony-${local.environment}"
  location = "West US"
}

module "cluster" {
  source = "../modules/cluster"
  environment = local.environment
  cluster_name = local.cluster_name
  cluster_dns_prefix = local.cluster_dns_prefix
  resource_group_name = local.resource_group_name
  depends_on = [azurerm_resource_group.coordinator_group]
}


provider helm {
  debug = true
  kubernetes {
    host                   = module.cluster.kube_config.0.host
    client_certificate     = base64decode(module.cluster.kube_config.0.client_certificate)
    client_key             = base64decode(module.cluster.kube_config.0.client_key)
    cluster_ca_certificate = base64decode(module.cluster.kube_config.0.cluster_ca_certificate)
    username               = module.cluster.kube_config.0.username
    password               = module.cluster.kube_config.0.password
    load_config_file       = false
  }
}

provider "kubernetes" {
  host                   = module.cluster.kube_config[0].host
  client_certificate     = base64decode(module.cluster.kube_config[0].client_certificate)
  client_key             = base64decode(module.cluster.kube_config[0].client_key)
  cluster_ca_certificate = base64decode(module.cluster.kube_config[0].cluster_ca_certificate)
  username               = module.cluster.kube_config[0].username
  password               = module.cluster.kube_config[0].password
  load_config_file       = false
}


module "deployment" {
  source = "../modules/coordinator-stack"
  environment = local.environment
  coordinator_service_image_tag = local.coordinator_service_image_tag
  coordinator_service_image = local.coordinator_service_image
  initial_verifier = local.initial_verifier
  resource_group_name = local.resource_group_name
  depends_on = [azurerm_resource_group.coordinator_group, module.cluster]
}