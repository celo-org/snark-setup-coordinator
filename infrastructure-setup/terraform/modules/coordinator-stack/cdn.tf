resource "azurerm_cdn_profile" "cdn_nimiq" {
  name                = "CDNNimiq${var.environment}"
  location            = "West US"
  resource_group_name = data.azurerm_resource_group.existing.name
  sku                 = "Standard_Microsoft"
}

resource "azurerm_cdn_endpoint" "cdn_nimiq_endpoint" {
  name                          = "CDNNimiqStorage${var.environment}"
  profile_name                  = azurerm_cdn_profile.cdn_nimiq.name
  location                      = data.azurerm_resource_group.existing.location
  resource_group_name           = data.azurerm_resource_group.existing.name
  querystring_caching_behaviour = "UseQueryString"

  origin {
    name      = "NimiqBlobStorage"
    host_name = azurerm_storage_account.coordinator_storage.primary_blob_host
  }
  origin_host_header = azurerm_storage_account.coordinator_storage.primary_blob_host
}