# Create Storage Bucket and Access Key
resource "azurerm_storage_account" "coordinator_storage" {
  name                     = replace("plumo-ceremony-${var.environment}", "-", "")
  resource_group_name      = data.azurerm_resource_group.existing.name
  location                 = data.azurerm_resource_group.existing.location
  account_tier             = "Standard"
  account_replication_type = "GRS"

  tags = {
    environment = var.environment
  }
}