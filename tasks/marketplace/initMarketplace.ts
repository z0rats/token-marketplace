import fs from "fs";
import dotenv from "dotenv";
import { task } from "hardhat/config";

task("initMarketplace", "Initialize Marketplace and start first sale round")
  .addOptionalParam("price", "Starting price per token. By default grab it from .env")
  .addOptionalParam("volume", "Starting trade volume. By default grab it from .env")
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

    const startPrice = taskArgs.price
      ? hre.ethers.utils.parseEther(taskArgs.price)
      : hre.ethers.utils.parseEther(process.env.MARKETPLACE_START_PRICE as string);
    const startVolume = taskArgs.volume
      ? hre.ethers.utils.parseEther(taskArgs.volume)
      : hre.ethers.utils.parseEther(process.env.MARKETPLACE_START_VOLUME as string);

    console.log(`\nInitializing Marketplace at ${mp.address} ...\n`);
    await mp.initMarketplace(startPrice, startVolume);
    console.log(`Done!`);
  });
