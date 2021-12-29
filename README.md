# ACDM token marketplace

This projects implements a marketplace for sale and exchange of tokens.

## Marketplace description

Marketplace consists of two rounds following one another:
- Sale round - where users can buy ACDM token from the marketplace at a fixed price (ETH).
- Trade round - where users can buy ACDM tokens from each other by placing trade orders. 

The new token price is calculated at the beginning of each sale round using the following formula:

`oldPrice + 3% + 0.000004 ETH`


### Verified contracts on Polygon testnet:

Token: https://mumbai.polygonscan.com/token/0x72c6482bf061b471a0418dd950dfd0814e01ae63

Marketplace: https://mumbai.polygonscan.com/address/0xadac967b83ab20acc36e62477c51d57f317ac421

### To run:

Requires `.env` file with:
- MNEMONIC
- ALCHEMY_API_KEY
- POLYGONSCAN_API_KEY
- CMC_API_KEY (to use gas-reporter)

`.env-<network_name>` with:
- ACDM_TOKEN_NAME
- ACDM_TOKEN_SYMBOL
- ACDM_TOKEN_DECIMALS
- TOKEN_MARKETPLACE_NAME
- MARKETPLACE_ROUND_TIME
- MARKETPLACE_START_PRICE
- MARKETPLACE_START_VOLUME

Try running some of the following tasks and dont forget to specify network (ex. --network mumbai):

```shell
npx hardhat coverage
npx hardhat test test/market.test.ts
npx hardhat test test/token.test.ts

npx hardhat run scripts/deploy.ts

```