import fs from "fs";
import dotenv from "dotenv";
import hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const network = hre.network.name;
const envConfig = dotenv.parse(fs.readFileSync(`.env-${network}`));
for (const parameter in envConfig) {
  process.env[parameter] = envConfig[parameter];
}

async function main() {
  const [owner]: SignerWithAddress[] = await hre.ethers.getSigners();
  console.log("Owner address: ", owner.address);

  const balance = await owner.getBalance();
  console.log(
    `Owner account balance: ${hre.ethers.utils.formatEther(balance).toString()}`
  );

  const ACDMToken = await hre.ethers.getContractFactory("ACDMToken");
  const acdmToken = await ACDMToken.deploy(
    process.env.ACDM_TOKEN_NAME as string,
    process.env.ACDM_TOKEN_SYMBOL as string
  );

  await acdmToken.deployed();
  console.log(`ACDMToken deployed to ${acdmToken.address}`);

  const TokenMarketplace = await hre.ethers.getContractFactory("Marketplace");
  const marketplace = await TokenMarketplace.deploy(
    acdmToken.address as string,
    process.env.MARKETPLACE_ROUND_TIME as string // 3 days
  );

  await marketplace.deployed();
  console.log(`TokenMarketplace deployed to ${marketplace.address}`);

  // Sync env file
  fs.appendFileSync(
    `.env-${network}`,
    `\r\# Deployed at \rACDM_TOKEN_ADDRESS=${acdmToken.address}\r
     \r\# Deployed at \rTOKEN_MARKETPLACE_ADDRESS=${marketplace.address}\r`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
