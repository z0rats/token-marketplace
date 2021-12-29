# ACDM token marketplace

This projects implements a marketplace for selling and exchanging tokens.

Verified contracts on Polygonscan:

token: https://mumbai.polygonscan.com/token/0x72c6482bf061b471a0418dd950dfd0814e01ae63
marketplace: https://mumbai.polygonscan.com/address/0xadac967b83ab20acc36e62477c51d57f317ac421


Requires `.env` file with:
- MNEMONIC
- ALCHEMY_API_KEY
- ETHERSCAN_API_KEY
- CMC_API_KEY (to use gas-reporter)

`.env-<network_name>` with:


Try running some of the following tasks and dont forget to specify network (ex. --network mumbai):

```shell
npx hardhat coverage
npx hardhat test test/market.test.ts
npx hardhat test test/token.test.ts

npx hardhat run scripts/deploy.ts

```