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
      storageAccount      = azurerm_storage_account.coordinator_storage.name
      azureAccessKey      = azurerm_storage_account.coordinator_storage.primary_access_key
      azureLoadBalancerIP = azurerm_public_ip.coordinator.ip_address
      azureResourceGroup  = data.azurerm_resource_group.existing.name
      initialVerifierAddresses    = var.initial_verifier_addresses
    }
  }
  verifier_vars = {
    environment = var.environment
    coordinator = {
      enabled = false
    }
    participant = {
      enabled = true
      participationMode = "verify"
      image = {
        image = var.verifier_image
        tag   = var.verifier_image_tag
      }
      plumoKeys = [ for pair in var.verifier_credentials: {
        key = file(pair.path), 
        password = pair.password
      }]
      coordinatorUri = "https://plumo-setup-${var.environment}.azurefd.net"
    }
  }
  monitor_vars = {
    environment = var.environment
    coordinator = {
      enabled = false
    }
    participant = {
      enabled = false
    }
    monitor = {
      enabled = true
      image = {
        image = var.monitor_image
        tag   = var.monitor_image_tag
      }
      pollingInterval = var.monitor_polling_interval
      coordinatorUri = "https://plumo-setup-${var.environment}.azurefd.net"
    }
  }
}

resource "kubernetes_namespace" "coordinator_namespace" {
  metadata {
    name = var.environment
  }
}


# Deploy Coordinator to cluster with Helm 
resource "helm_release" "coordinator_service" {
  name      = "coordinator-service-${var.environment}"
  chart     = "../../../helm/coordinator-service"
  version   = "0.1.1"
  namespace = kubernetes_namespace.coordinator_namespace.metadata[0].name
  values = [
    yamlencode(local.coordinator_vars)
  ]
  wait = true
}

# Deploy Verifiers to cluster with Helm 
resource "helm_release" "verifiers" {
  name      = "verifiers-${var.environment}"
  chart     = "../../../helm/coordinator-service"
  version   = "0.1.1"
  namespace = kubernetes_namespace.coordinator_namespace.metadata[0].name
  values = [
    yamlencode(local.verifier_vars)
  ]
  wait = true
  depends_on = [helm_release.coordinator_service]
}

# Deploy Monitors to cluster with Helm 
resource "helm_release" "monitors" {
  name      = "monitors-${var.environment}"
  chart     = "../../../helm/coordinator-service"
  version   = "0.1.1"
  namespace = kubernetes_namespace.coordinator_namespace.metadata[0].name
  values = [
    yamlencode(local.monitor_vars)
  ]
  wait = true
  depends_on = [helm_release.coordinator_service]
}
