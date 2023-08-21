# Requirements

No requirements.

## Providers

| Name | Version |
|------|---------|
| azurerm | n/a |
| helm | n/a |
| kubernetes | n/a |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| coordinator\_service\_image | The image to use in the coordinator deployment | `string` | n/a | yes |
| coordinator\_service\_image\_tag | The tag to use in the coordinator deployment | `string` | `"test"` | no |
| environment | The environment this module is being deployed to. | `string` | n/a | yes |
| initial\_verifier | A Nimiq Public Key corresponding to the verifier. | `string` | n/a | yes |
| resource\_group\_name | The name of the resource group to deploy to. | `string` | n/a | yes |

## Outputs

No output.