# Infrastructure Setup 

The infrastructure for the SNARK Ceremony is designed to be deployed with Terraform and Helm 3, you will need the binaries for both of these installed before proceeding with a Deployment. 

- Terraform: https://learn.hashicorp.com/tutorials/terraform/install-cli
- Helm 3: https://helm.sh/docs/intro/install/

This deployment also relies exclusively on Azure resources, and will require the machine you are deploying from to be properly authenticated via the Azure CLI. 

`az login`

For more details see: https://docs.microsoft.com/en-us/cli/azure/authenticate-azure-cli

{{ Insert permissions that are required here. }}

## Create Your Environment

An example deployment is available in `/terraform/example`. Depending on the available infrastructure, you may want to deploy the Ceremony to an existing Kubernetes cluster, however an Azure Kuberentes module has been provided that creates the required resources. 

You may use the example deployment for testing purposes, but it is recommended that you modify the variables to suit your setup. At minimum, change the variable `local.e


Note: All of the following `terraform` commands must be run from within your environment folder (`/infrastructure-setup/terraform/example` if you are using the example)
## Seeing What Will Be Deployed 

Running `terraform plan` will have Terraform resolve the dependency graph of what will be deployed, but stop short of deploying it. 

## Creating the Infrastructure

Running `terraform apply` in the example directory will get you the following: 

- An Azure Resource Group
- An Azure Kubernetes Cluster
- Helm releases consisting of: 
  - Ceremony Coordinator Service API 
  - Ceremony Verifiers (ToDo)
  - Prometheus (ToDo)
- An Azure Front Door pointed at the Coordinator Service API
- An Azure Storage Account for the Coordinator Service API 

Note: The deploy from scratch will take between 4-8 minutes, primarily due to deploying the cluster. To speed up deployments, specify an existing K8s cluster in your environment.

## Cleaning Up 

Running `terraform destroy` will clean up your environment and any resources that were created.


