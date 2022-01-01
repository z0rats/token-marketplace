import fs from "fs";
import dotenv from "dotenv";
import { task } from "hardhat/config";

task("buyTokens", "Buying ACDM in sale round")
  .addParam("amount", "The amount of ACDM to buy")
  .addParam("eth", "The amount of ETH to pay")
  .addOptionalParam("from", "The adddress of the buyer. By default grab first signer")
  .addOptionalParam("mp", "The adddress of the Marketplace. By default grab it from .env")
  .setAction(async (taskArgs, hre) => {
    const network = hre.network.name;
    const envConfig = dotenv.parse(fs.readFileSync(`.env-${network}`));
    for (const parameter in envConfig) {
      process.env[parameter] = envConfig[parameter];
    }

    const mp = await hre.ethers.getContractAt(
      process.env.TOKEN_MARKETPLACE_NAME as string,
      taskArgs.mp || (process.env.TOKEN_MARKETPLACE_ADDRESS as string)
    );

    let account;
    if (taskArgs.from) {
      account = taskArgs.from;
    } else {
      [account] = await hre.ethers.getSigners();
    }

    const amount = hre.ethers.utils.parseUnits(
      taskArgs.amount,
      process.env.ACDM_TOKEN_DECIMALS
    );

    const eth = hre.ethers.utils.parseEther(taskArgs.eth);

    console.log(`\nBuying ${taskArgs.amount} ACDM to ${account.address} ...\n`);
    await mp.connect(account).buyTokens(amount, { value: eth });
    console.log(`Done!`);
  });
