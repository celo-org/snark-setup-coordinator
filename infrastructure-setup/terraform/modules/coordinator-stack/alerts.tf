data "azurerm_log_analytics_workspace" "coordinator_workspace" {
  name                = var.log_analytics_workspace_name
  resource_group_name = data.azurerm_resource_group.existing.name
}

resource "azurerm_monitor_action_group" "victorops_group" {
  name                = "CoordinatorVictorOps"
  resource_group_name = data.azurerm_resource_group.existing.name
  short_name          = "PlumoVO"

  webhook_receiver {
    name                    = "victorops"
    service_uri             = var.azure_monitor_alerts_webhook_uri
    use_common_alert_schema = true
  }
}



resource "azurerm_monitor_scheduled_query_rules_alert" "coordinator_errors" {
  name                = "coordinator-${var.environment}-queryrule"
  location            = data.azurerm_resource_group.existing.location
  resource_group_name = data.azurerm_resource_group.existing.name

  action {
    action_group           = [azurerm_monitor_action_group.victorops_group.id]
  }

  data_source_id = data.azurerm_log_analytics_workspace.coordinator_workspace.id
  description    = "Alert when nErrors > 1 in a 30 minute period."
  enabled        = true

  query       = <<-QUERY
    let podPrefix = "coordinator";
    // NOTE: set the start time
    let startTimestamp = ago(1d);
    KubePodInventory
    | where TimeGenerated > startTimestamp
    | project ContainerID, PodName=Name, PodLabel
    | where PodName hasprefix podPrefix
    | distinct ContainerID, PodName, PodLabel
    | join
    (
        ContainerLog
        | where TimeGenerated > startTimestamp
        | where LogEntry contains "ERROR"
    )
    on ContainerID
    QUERY
  
  severity    = 1
  frequency   = 5
  time_window = 30
  
  trigger {
    operator  = "GreaterThan"
    threshold = 1
  }
}
