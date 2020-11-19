resource "azurerm_cdn_profile" "cdn_plumo" {
  name                = "CDNPlumo${var.environment}"
  location            = "West US"
  resource_group_name = data.azurerm_resource_group.existing.name
  sku                 = "Standard_Microsoft"
}

resource "azurerm_cdn_endpoint" "cdn_plumo_endpoint" {
  name                          = "CDNPlumoStorage${var.environment}"
  profile_name                  = azurerm_cdn_profile.cdn_plumo.name
  location                      = data.azurerm_resource_group.existing.location
  resource_group_name           = data.azurerm_resource_group.existing.name
  querystring_caching_behaviour = "UseQueryString"

  origin {
    name      = "PlumoBlobStorage"
    host_name = azurerm_storage_account.coordinator_storage.primary_blob_host
  }
  origin_host_header = azurerm_storage_account.coordinator_storage.primary_blob_host
}