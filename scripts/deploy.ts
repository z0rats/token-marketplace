import fs from "fs";
import dotenv from "dotenv";
import hre, { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const network = hre.network.name;
const envConfig = dotenv.parse(fs.readFileSync(`.env-${network}`));
for (const parameter in envConfig) {
  process.env[parameter] = envConfig[parameter];
}

async function main() {
  const [owner]: SignerWithAddress[] = await ethers.getSigners();
  console.log("Owner address: ", owner.address);

  const balance = await owner.getBalance();
  console.log(
    `Owner account balance: ${ethers.utils.formatEther(balance).toString()}`
  );

  const ACDMToken = await ethers.getContractFactory("Token");
  const acdmToken = await ACDMToken.deploy(
    process.env.TOKEN_NAME as string,
    process.env.TOKEN_SYMBOL as string,
    process.env.TOKEN_MINT as string
  );

  await acdmToken.deployed();
  console.log(`Token deployed to ${acdmToken.address}`);

  // Sync env file
  fs.appendFileSync(
    `.env-${network}`,
    `\r\# Deployed at \rTOKEN_ADDRESS=${acdmToken.address}\r`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
