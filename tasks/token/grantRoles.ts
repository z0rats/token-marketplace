import fs from "fs";
import dotenv from "dotenv";
import { task } from "hardhat/config";

const minter = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
const burner = "0x51f4231475d91734c657e212cfb2e9728a863d53c9057d6ce6ca203d6e5cfd5d";

task("grantRoles", "Grants minter & burner role to Marketplace")
  .addOptionalParam("token", "The address of the Token. By default grab it from .env")
  .addOptionalParam("mp", "The address of the Marketplace. By default grab it from .env")
  .setAction(async (taskArgs, hre) => {
    const network = hre.network.name;
    const envConfig = dotenv.parse(fs.readFileSync(`.env-${network}`));
    for (const parameter in envConfig) {
      process.env[parameter] = envConfig[parameter];
    }

    const token = await hre.ethers.getContractAt(
      process.env.ACDM_TOKEN_NAME as string,
      taskArgs.token || (process.env.ACDM_TOKEN_ADDRESS as string)
    );

    const mpAddrs = taskArgs.mp || (process.env.TOKEN_MARKETPLACE_ADDRESS as string);

    console.log(`\nGranting minter role to ${mpAddrs}...\n`);
    await token.grantRole(minter, mpAddrs);
    console.log(`\nGranting burner role to ${mpAddrs}...\n`);
    await token.grantRole(burner, mpAddrs);
    console.log(`Done!`);
  });
