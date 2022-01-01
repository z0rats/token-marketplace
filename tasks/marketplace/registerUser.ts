import fs from "fs";
import dotenv from "dotenv";
import { task } from "hardhat/config";

task("regUser", "Register user referral")
  .addParam("user", "The address of the referral")
  .addParam("refer", "The adddress of the referrer")
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

    const account = await hre.ethers.getSigner(taskArgs.user);

    console.log(
      `\nRegistering user ${taskArgs.user} with referrer ${taskArgs.refer}...\n`
    );
    await mp.connect(account).registerUser(taskArgs.refer);
    console.log(`Done!`);
  });
