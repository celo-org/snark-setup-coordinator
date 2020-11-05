resource "random_password" "coordinator_sp_password" {
  length           = 32
  special          = true
  override_special = "_%@"
}

# An application for the coordinator cluster
resource "azuread_application" "coordinator_cluster" {
  name = "PlumoCeremony${var.environment}"
}


# Service Principal Resources 
resource "azuread_service_principal" "coordinator_cluster" {
  application_id               = azuread_application.coordinator_cluster.application_id
  app_role_assignment_required = false

  tags = ["plumo", var.environment]
}

resource "azurerm_role_assignment" "cluster_networking" {
  scope                = data.azurerm_resource_group.existing.id
  role_definition_name = "Network Contributor"
  principal_id         = azuread_service_principal.coordinator_cluster.id
}

# Do not set the description for this 
resource "azuread_service_principal_password" "coordinator_cluster" {
  service_principal_id = azuread_service_principal.coordinator_cluster.id
  value                = random_password.coordinator_sp_password.result
  end_date_relative    = "1200h"
}