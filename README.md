# ACDM token marketplace
*This is a training project, you should not use any of it's code in production because it's not properly audited and tested.*  

## Marketplace description

This project implements a marketplace for sale and exchange of tokens.

Marketplace consists of two rounds following one another:
- **Sale round** - where users can buy ACDM token from the marketplace at a fixed price (ETH).

  The new token price is calculated at the beginning of each sale round using the following formula:

  `oldPrice + 3% + 0.000004 ETH`

  The amount of tokens to mint in a sale round depends on the volume of trading in the previous round and is calculcated as follows:

  `tradeVolume / tokenPrice`

  The round may end early if all tokens have been sold out.

  At the end of the round unsold tokens are burned.

  The very first round sells tokens worth 1ETH (100,000 ACDM)

- **Trade round** - where users can buy ACDM tokens from each other by placing trade orders.
  
  User places an order to sell ACDM tokens for a certain amount of ETH. User_2 redeems the tokens for ETH. 
  The order may not be redeemed in full. 

  The order can also be canceled and the user will receive back his tokens which have not yet been sold. 

  ETH received are immediately sent to the user in their address.

  At the end of the round, all open orders are closed and the remaining tokens are sent to their owners.

There is also a **referral program**: 
- Any user can specify his referrer.

- When buying ACDM tokens in Sale round, referrer_1 will be sent 5% of his purchase, referrer_2 will be sent 3%, the platform itself will receive 92% in the absence of referrers all get platform.

- When buying in Trade round the user who placed an order to sell ACDM tokens will receive 95% of ETH and 2.5% will be received by the referrers, in their absence the platform takes these percent for itself.

### Verified contracts on Polygon testnet:

Token: https://mumbai.polygonscan.com/token/0xa9b67B7002ab817E2D0E4488371c384868AcD72E

Marketplace: https://mumbai.polygonscan.com/address/0xDaeD864cDfb7BBFdA91Eb7c0f857BFDc4338D5B2

### How to run

Create a `.env` file using the `.env.example` template with the following content
- [ALCHEMY_API_KEY](https://www.alchemy.com/)
- [POLYGONSCAN_API_KEY](https://polygonscan.com/apis)
- [CMC_API_KEY](https://coinmarketcap.com/api/)
- [ETHERSCAN_API_KEY](https://etherscan.io/apis) - optional, polygonscan is used in config
- MNEMONIC

Try running some of the following tasks and don't forget to specify network (ex. `--network mumbai`):

```shell
npx hardhat coverage

npx hardhat run scripts/deploy.ts

```
