## Requirements

No requirements.

## Providers

| Name | Version |
|------|---------|
| azuread | n/a |
| azurerm | n/a |
| random | n/a |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| cluster\_dns\_prefix | DNS Prefix, no punctuation. | `string` | n/a | yes |
| cluster\_name | Name of the cluster. | `string` | n/a | yes |
| environment | The name of the environment this cluster is being deployed to. | `string` | n/a | yes |
| resource\_group\_name | The name of the resource group the cluster should be deployed to. | `string` | n/a | yes |

## Outputs

| Name | Description |
|------|-------------|
| kube\_config | n/a |