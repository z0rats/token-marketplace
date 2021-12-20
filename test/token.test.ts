import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

// acdmToken metadata
const tokenName = "ACDMToken";
const symbol = "ACDM";
const decimals = 18;
const feeRate = 150; // 1.5% fee in basis points ?
const tenTokens = ethers.utils.parseUnits("10.0", decimals);
const twentyTokens = ethers.utils.parseUnits("20.0", decimals);

// AccessControl roles in bytes32 string
// DEFAULT_ADMIN_ROLE, MINTER_ROLE, BURNER_ROLE
const adminRole = ethers.constants.HashZero;
const minterRole =
  "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
const burnerRole =
  "0x51f4231475d91734c657e212cfb2e9728a863d53c9057d6ce6ca203d6e5cfd5d";

describe("Token", function () {
  let ACDMToken: ContractFactory;
  let owner: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress;
  let acdmToken: Contract;

  before(async () => {
    [owner, alice, bob] = await ethers.getSigners();
    ACDMToken = await ethers.getContractFactory("Token");
  });

  beforeEach(async () => {
    acdmToken = await ACDMToken.deploy(tokenName, symbol, feeRate);
    await acdmToken.deployed();

    // Add owner and Alice to whitelist so they dont have to pay fee
    await acdmToken.addToWhitelist(owner.address);
    await acdmToken.addToWhitelist(alice.address);

    // Grant roles and mint some acdmTokens before transferring admin role to DAO
    await acdmToken.grantRole(minterRole, alice.address);
    await acdmToken.grantRole(burnerRole, bob.address);
    const amount = ethers.utils.parseUnits("1000.0", decimals);
    await acdmToken.connect(alice).mint(owner.address, amount);
    // await acdmToken.connect(alice).mint(alice.address, amount);
    await acdmToken.connect(alice).mint(bob.address, amount);
  });

  describe("Deployment", function () {
    it("Has a name", async () => {
      expect(await acdmToken.name()).to.be.equal(tokenName);
    });

    it("Has a symbol", async () => {
      expect(await acdmToken.symbol()).to.be.equal(symbol);
    });

    it(`Has ${decimals} decimals`, async () => {
      expect(await acdmToken.decimals()).to.be.equal(decimals);
    });

    it(`Has 1.5% fee rate`, async () => {
      expect(await acdmToken.getFeeRate()).to.be.equal(feeRate);
    });

    it("Should set the right admin role", async () => {
      expect(await acdmToken.hasRole(adminRole, owner.address)).to.equal(true);
    });

    it("Should set the right minter role", async () => {
      expect(await acdmToken.hasRole(minterRole, alice.address)).to.equal(true);
    });

    it("Should set the right burner role", async () => {
      expect(await acdmToken.hasRole(burnerRole, bob.address)).to.equal(true);
    });

    it("Should set owner as fee recipient", async () => {
      expect(await acdmToken.getFeeRecipient()).to.be.equal(owner.address);
    });

    it("Should add owner & Alice to whitelist", async () => {
      expect(await acdmToken.isWhitelisted(owner.address)).to.equal(true);
      expect(await acdmToken.isWhitelisted(alice.address)).to.equal(true);
    });
  });

  describe("Ownership", function () {
    it("Only admin can grant roles", async () => {
      await expect(
        acdmToken.connect(alice).grantRole(burnerRole, alice.address)
      ).to.be.revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${adminRole}`
      );
    });
  });

  describe("Whitelist", function () {
    it("Only admin should be able to whitelist", async () => {
      await expect(
        acdmToken.connect(alice).addToWhitelist(alice.address)
      ).to.be.revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${adminRole}`
      );
    });

    it("Adding to whitelist emits event", async () => {
      await expect(acdmToken.addToWhitelist(alice.address))
        .to.emit(acdmToken, "AddToWhitelist")
        .withArgs(owner.address, alice.address);
    });

    it("Removing from whitelist emits event", async () => {
      await expect(acdmToken.removeFromWhitelist(alice.address))
        .to.emit(acdmToken, "RemoveFromWhitelist")
        .withArgs(owner.address, alice.address);
    });

    it("Only admin should be able to remove from whitelist", async () => {
      await expect(
        acdmToken.connect(alice).removeFromWhitelist(owner.address)
      ).to.be.revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${adminRole}`
      );
    });
  });

  describe("Fees", function () {
    it("Should not be able to change fee rate without DEFAULT_ADMIN_ROLE", async () => {
      const newFee = 2;
      await expect(
        acdmToken.connect(alice).changeFeeRate(newFee)
      ).to.be.revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${adminRole}`
      );
    });

    it("Changing fee rate emits event", async () => {
      const newFee = ethers.utils.parseUnits("3.5", decimals);
      await expect(acdmToken.changeFeeRate(newFee))
        .to.emit(acdmToken, "ChangeFeeRate")
        .withArgs(owner.address, newFee);
    });

    it("Changing fee recipient emits event", async () => {
      await expect(acdmToken.changeFeeRecipient(alice.address))
        .to.emit(acdmToken, "ChangeFeeRecipient")
        .withArgs(owner.address, alice.address);
    });

    it("Should not be able to change fee recipient without DEFAULT_ADMIN_ROLE", async () => {
      await expect(
        acdmToken.connect(alice).changeFeeRecipient(alice.address)
      ).to.be.revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${adminRole}`
      );
    });

    it("Admin can change fee recipient", async () => {
      await acdmToken.changeFeeRecipient(alice.address);
      expect(await acdmToken.getFeeRecipient()).to.be.equal(alice.address);
    });

    it("Transfer should not charge fee from whitelisted users", async () => {
      const amount: BigNumber = tenTokens;
      await acdmToken.transfer(alice.address, amount);
      const aliceBalance = await acdmToken.balanceOf(alice.address);
      expect(aliceBalance).to.equal(amount);
    });

    it("Transfer should charge fee from spender in favor of fee recipient", async () => {
      const initBobBalance = await acdmToken.balanceOf(bob.address);
      const fee: BigNumber = tenTokens.mul(feeRate).div(10000);
      await acdmToken.connect(bob).transfer(alice.address, tenTokens);
      const bobBalance = await acdmToken.balanceOf(bob.address);
      expect(bobBalance).to.equal(initBobBalance.sub(tenTokens).sub(fee));
    });

    it("Transfer should fail if sender doesn't have enough acdmTokens to pay fee", async () => {
      const bobBalance = await acdmToken.balanceOf(bob.address);
      // Trying to send all Bob's acdmTokens to Alice
      await expect(
        acdmToken.connect(bob).transfer(alice.address, bobBalance)
      ).to.be.revertedWith("Not enough to pay fee");
    });
  });

  describe("Transfer", function () {
    it("Should transfer acdmTokens between accounts", async () => {
      // Transfer 20 acdmTokens from owner to Alice
      const amount: BigNumber = ethers.utils.parseUnits("20.0", decimals);
      await acdmToken.transfer(alice.address, amount);
      const aliceBalance = await acdmToken.balanceOf(alice.address);
      expect(aliceBalance).to.equal(amount);
    });

    it("Should fail if sender doesn't have enough acdmTokens", async () => {
      // Trying to send 10 acdmTokens from Alice (0 acdmTokens) to owner (1000 acdmTokens)
      await expect(
        acdmToken.connect(alice).transfer(owner.address, tenTokens)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance'");

      // Owner balance shouldn't have changed
      const ownerBalance = await acdmToken.balanceOf(owner.address);
      expect(await acdmToken.balanceOf(owner.address)).to.equal(ownerBalance);
    });

    it("Can not transfer above the amount", async () => {
      await expect(
        acdmToken.transfer(
          alice.address,
          ethers.utils.parseUnits("1000.01", decimals)
        )
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("Transfer should emit event", async () => {
      const from = owner.address;
      const to = alice.address;
      const amount = tenTokens;

      await expect(acdmToken.transfer(to, amount))
        .to.emit(acdmToken, "Transfer")
        .withArgs(from, to, amount);
    });

    it("Should update balances after transfers", async function () {
      const initialOwnerBalance = await acdmToken.balanceOf(owner.address);
      const initialAliceBalance = await acdmToken.balanceOf(alice.address);
      const initialBobBalance = await acdmToken.balanceOf(bob.address);

      // Transfer 10 acdmTokens from owner to Alice
      await acdmToken.transfer(alice.address, tenTokens);
      // Transfer another 10 acdmTokens from owner to Bob
      await acdmToken.transfer(bob.address, tenTokens);

      // Check balances
      const finalOwnerBalance = await acdmToken.balanceOf(owner.address);
      expect(finalOwnerBalance).to.be.equal(
        initialOwnerBalance.sub(twentyTokens)
      );

      const aliceBalance = await acdmToken.balanceOf(alice.address);
      expect(aliceBalance).to.be.equal(initialAliceBalance.add(tenTokens));

      const bobBalance = await acdmToken.balanceOf(bob.address);
      expect(bobBalance).to.be.equal(initialBobBalance.add(tenTokens));
    });
  });

  describe("Allowance", function () {
    it("Approve should emit event", async () => {
      const amount = tenTokens;
      await expect(acdmToken.approve(alice.address, amount))
        .to.emit(acdmToken, "Approval")
        .withArgs(owner.address, alice.address, amount);
    });

    it("Allowance should change after acdmToken approve", async () => {
      await acdmToken.approve(alice.address, tenTokens);
      const allowance = await acdmToken.allowance(owner.address, alice.address);
      expect(allowance).to.be.equal(tenTokens);
    });

    it("TransferFrom should emit event", async () => {
      const amount = tenTokens;
      await acdmToken.approve(alice.address, amount);
      await expect(
        acdmToken
          .connect(alice)
          .transferFrom(owner.address, alice.address, amount)
      )
        .to.emit(acdmToken, "Transfer")
        .withArgs(owner.address, alice.address, amount);
    });

    it("Can not TransferFrom above the approved amount", async () => {
      // Approve 10 acdmTokens to Alice
      await acdmToken.approve(alice.address, tenTokens);
      // Trying to transfer 20 acdmTokens
      await expect(
        acdmToken
          .connect(alice)
          .transferFrom(owner.address, alice.address, twentyTokens)
      ).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
    });

    it("Can not TransferFrom if owner does not have enough acdmTokens", async () => {
      // Approve Alice to use 10 acdmTokens
      await acdmToken.approve(alice.address, tenTokens);

      // Send most of owner acdmTokens to Bob
      await acdmToken.transfer(
        bob.address,
        ethers.utils.parseUnits("995.0", decimals)
      );

      // Check that Alice can't transfer all amount (only 5 left)
      await expect(
        acdmToken
          .connect(alice)
          .transferFrom(owner.address, alice.address, tenTokens)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });
  });

  // In our tests Bob has the BURNER_ROLE
  describe("Burning", function () {
    it("Should not be able to burn acdmTokens without BURNER_ROLE", async () => {
      const burnAmount = tenTokens;
      await expect(
        acdmToken.burn(alice.address, burnAmount)
      ).to.be.revertedWith(
        `AccessControl: account ${owner.address.toLowerCase()} is missing role ${burnerRole}`
      );
    });

    it("Burner should be able to burn acdmTokens", async () => {
      const burnAmount = tenTokens;
      await expect(acdmToken.connect(bob).burn(owner.address, burnAmount))
        .to.emit(acdmToken, "Transfer")
        .withArgs(owner.address, ethers.constants.AddressZero, burnAmount);
    });

    it("Token supply & balance should change after burning", async () => {
      const initialSupply = await acdmToken.totalSupply();
      const initialOwnerBalance = await acdmToken.balanceOf(owner.address);

      const burnAmount = tenTokens;
      await acdmToken.connect(bob).burn(owner.address, burnAmount);

      const currentSupply = await acdmToken.totalSupply();
      expect(currentSupply).to.equal(initialSupply.sub(burnAmount));

      const ownerBalance = await acdmToken.balanceOf(owner.address);
      expect(ownerBalance).to.equal(initialOwnerBalance.sub(burnAmount));
    });

    it("Can not burn above total supply", async () => {
      const initialSupply = await acdmToken.totalSupply();
      await expect(
        acdmToken.connect(bob).burn(owner.address, initialSupply)
      ).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });
  });

  // In out tests Alice has the MINTER_ROLE
  describe("Minting", function () {
    it("Should not be able to mint acdmTokens without MINTER_ROLE", async () => {
      const mintAmount = tenTokens;
      await expect(
        acdmToken.mint(alice.address, mintAmount)
      ).to.be.revertedWith(
        `AccessControl: account ${owner.address.toLowerCase()} is missing role ${minterRole}`
      );
    });

    it("Minter should be able to mint acdmTokens", async () => {
      const mintAmount = tenTokens;
      await expect(acdmToken.connect(alice).mint(owner.address, mintAmount))
        .to.emit(acdmToken, "Transfer")
        .withArgs(ethers.constants.AddressZero, owner.address, mintAmount);
    });

    it("Token supply & balance should change after minting", async () => {
      const initialSupply = await acdmToken.totalSupply();
      const initialOwnerBalance = await acdmToken.balanceOf(owner.address);

      const mintAmount = tenTokens;
      await acdmToken.connect(alice).mint(owner.address, mintAmount);

      const currentSupply = await acdmToken.totalSupply();
      expect(currentSupply).to.equal(initialSupply.add(mintAmount));

      const ownerBalance = await acdmToken.balanceOf(owner.address);
      expect(ownerBalance).to.equal(initialOwnerBalance.add(mintAmount));
    });
  });
});
