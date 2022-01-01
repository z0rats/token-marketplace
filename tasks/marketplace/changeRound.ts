import fs from "fs";
import dotenv from "dotenv";
import { task } from "hardhat/config";

task("change", "Changes current round")
  .addOptionalParam("from", "The adddress to send tx from. By default grab first signer")
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

    console.log(`\nChanging round ...\n`);
    await mp.connect(account).changeRound();
    console.log(`Done!`);
  });
