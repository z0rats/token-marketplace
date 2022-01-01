import fs from "fs";
import dotenv from "dotenv";
import { task } from "hardhat/config";

task("withdraw", "Withdraw ETH from Marketplace")
  .addParam("amount", "The amount of ETH to withdraw")
  .addOptionalParam("to", "The adddress to withdraw to. By default grab first signer")
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
      const [signer] = await hre.ethers.getSigners();
      account = signer.address;
    }

    const amount = hre.ethers.utils.parseUnits(
      taskArgs.amount,
      process.env.ACDM_TOKEN_DECIMALS
    );

    console.log(`\nWithdrawing ETH to ${account} ...\n`);
    await mp.withdraw(account, amount);
    console.log(`Done!`);
  });
