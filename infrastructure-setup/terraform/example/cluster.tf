resource "random_password" "coordinator_sp_password" {
  length           = 32
  special          = true
  override_special = "_%@"
}

# An application for the coordinator cluster
resource "azuread_application" "coordinator_cluster" {
  name = "NimiqCeremony${local.environment}"
}


# Service Principal Resources 
resource "azuread_service_principal" "coordinator_cluster" {
  application_id               = azuread_application.coordinator_cluster.application_id
  app_role_assignment_required = false

  tags = ["nimiq", local.environment]
}

resource "azurerm_role_assignment" "cluster_networking" {
  scope                = azurerm_resource_group.coordinator_group.id
  role_definition_name = "Network Contributor"
  principal_id         = azuread_service_principal.coordinator_cluster.id
}

# Do not set the description for this 
# Really annoying regression in the terraform provider here
resource "azuread_service_principal_password" "coordinator_cluster" {
  service_principal_id = azuread_service_principal.coordinator_cluster.id
  value                = random_password.coordinator_sp_password.result
  end_date_relative    = "1200h"
}

# This module deploys a Kubernetes cluster and provides outputs
# for the kubectl configuration to be passed to Helm
module "network" {
  source              = "Azure/network/azurerm"
  resource_group_name = azurerm_resource_group.coordinator_group.name
  address_space       = "10.1.0.0/16"
  subnet_prefixes     = ["10.1.1.0/24"]
  subnet_names        = ["private"]
  depends_on          = [azurerm_resource_group.coordinator_group]
}

module "aks" {
  source              = "Azure/aks/azurerm"
  resource_group_name = azurerm_resource_group.coordinator_group.name
  client_id           = azuread_application.coordinator_cluster.application_id
  client_secret       = random_password.coordinator_sp_password.result
  prefix              = local.cluster_prefix
  vnet_subnet_id      = module.network.vnet_subnets[0]
  os_disk_size_gb     = 50
  agents_count        = 3
  depends_on          = [module.network, azuread_service_principal_password.coordinator_cluster]
}