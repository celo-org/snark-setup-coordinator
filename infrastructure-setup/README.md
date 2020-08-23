# Infrastructure setup

## Setup storage account and container

```
# Existing subscription to create storage account in
SUBSCRIPTION=celo-testnet
# Existing resource group to create storage account in
GROUP=...
# Name to create storage account with
STORAGE_ACCOUNT_NAME=...
```

Create storage account and containers:

```
az deployment group create \
  --name contribution-storage \
  --subscription $SUBSCRIPTION \
  --resource-group $GROUP \
  --parameters storageAccountName=$STORAGE_ACCOUNT_NAME \
  --template-file template.json
```
