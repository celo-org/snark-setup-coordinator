# Create Storage Bucket and Access Key
resource "azurerm_storage_account" "coordinator_storage" {
  name                     = substr(replace("plumo-ceremony-${var.environment}", "-", ""), 1, 24)
  resource_group_name      = data.azurerm_resource_group.existing.name
  location                 = data.azurerm_resource_group.existing.location
  account_tier             = "Standard"
  account_replication_type = "GRS"

  tags = {
    environment = var.environment
  }
}