data "azurerm_resource_group" "existing" {
  name = var.resource_group_name
}

resource "azurerm_kubernetes_cluster" "coordinator_cluster" {
  name                = var.cluster_name
  location            = data.azurerm_resource_group.existing.location
  resource_group_name = data.azurerm_resource_group.existing.name
  dns_prefix          = var.cluster_dns_prefix

  default_node_pool {
    name       = replace(substr(var.cluster_name, 0, 12), "-", "")
    node_count = 1
    vm_size    = "Standard_F8"
  }

  identity {
    type = "SystemAssigned"
  }

  tags = {
    Environment = var.environment
  }
}

output "kube_config" {
  value = azurerm_kubernetes_cluster.coordinator_cluster.kube_config
}
