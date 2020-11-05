data "azurerm_resource_group" "existing" {
  name = var.resource_group_name
}

locals {
  coordinator_vars = {
    environment = var.environment
    coordinator = {
      enabled = true
      image = {
        image = var.coordinator_service_image
        tag   = var.coordinator_service_image_tag
      }
      storageAccount      = replace("plumo-ceremony-${var.environment}", "-", "")
      azureAccessKey      = azurerm_storage_account.coordinator_storage.primary_access_key
      azureLoadBalancerIP = azurerm_public_ip.coordinator.ip_address
      azureResourceGroup  = data.azurerm_resource_group.existing.name
      initialVerifier     = var.initial_verifier
    }
  }
}

resource "kubernetes_namespace" "coordinator_namespace" {
  metadata {
    name = var.environment
  }
}


# Deploy to cluster with Helm 
resource "helm_release" "coordinator-service" {
  name      = "coordinator-service-${var.environment}"
  chart     = "../../../helm/coordinator-service"
  version   = "0.1.1"
  namespace = kubernetes_namespace.coordinator_namespace.metadata[0].name
  values = [
    yamlencode(local.coordinator_vars)
  ]
  wait = true
}
