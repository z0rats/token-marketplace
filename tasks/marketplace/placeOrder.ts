import fs from "fs";
import dotenv from "dotenv";
import { task } from "hardhat/config";

task("placeOrder", "Place a sell order")
  .addParam("amount", "The amount of ACDM to sell")
  .addParam("cost", "Total order value")
  .addOptionalParam(
    "from",
    "The adddress of the order maker. By default grab first signer"
  )
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
    if (taskArgs.to) {
      account = taskArgs.to;
    } else {
      [account] = await hre.ethers.getSigners();
    }

    const amount = hre.ethers.utils.parseUnits(
      taskArgs.amount,
      process.env.ACDM_TOKEN_DECIMALS
    );

    const cost = hre.ethers.utils.parseEther(taskArgs.cost);

    console.log(`\nPlacing order from ${account.address} ...\n`);
    console.log(
      `\nThe amount of tokens: ${taskArgs.amount} Cost: ${taskArgs.cost} ...\n`
    );
    await mp.connect(account).placeOrder(amount, cost);
    console.log(`Done!`);
  });
