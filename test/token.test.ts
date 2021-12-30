import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

// ACDMToken metadata
const tokenName = "ACDMToken";
const symbol = "ACDM";
const decimals = 18;
const initialSupply = ethers.utils.parseUnits("1000.0", decimals);
const tenTokens = ethers.utils.parseUnits("10.0", decimals);
const twentyTokens = ethers.utils.parseUnits("20.0", decimals);

// AccessControl roles in bytes32 string
// DEFAULT_ADMIN_ROLE, MINTER_ROLE, BURNER_ROLE
const adminRole = ethers.constants.HashZero;
const minterRole = ethers.utils.solidityKeccak256(["string"], ["MINTER_ROLE"]);
const burnerRole = ethers.utils.solidityKeccak256(["string"], ["BURNER_ROLE"]);

describe("Token", function () {
  let ACDMToken: ContractFactory,
    owner: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    acdmToken: Contract;

  before(async () => {
    [owner, alice, bob] = await ethers.getSigners();
    ACDMToken = await ethers.getContractFactory("ACDMToken");
  });

  beforeEach(async () => {
    acdmToken = await ACDMToken.deploy(tokenName, symbol);
    await acdmToken.deployed();

    // Grant roles and mint some acdmTokens
    await acdmToken.grantRole(minterRole, alice.address);
    await acdmToken.grantRole(burnerRole, bob.address);
    await acdmToken.connect(alice).mint(owner.address, initialSupply);
    await acdmToken.connect(alice).mint(bob.address, initialSupply);
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

    it("Should set the right admin role", async () => {
      expect(await acdmToken.hasRole(adminRole, owner.address)).to.equal(true);
    });

    it("Should set the right minter role", async () => {
      expect(await acdmToken.hasRole(minterRole, alice.address)).to.equal(true);
    });

    it("Should set the right burner role", async () => {
      expect(await acdmToken.hasRole(burnerRole, bob.address)).to.equal(true);
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
        acdmToken.transfer(alice.address, ethers.utils.parseUnits("1000.01", decimals))
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
      expect(finalOwnerBalance).to.be.equal(initialOwnerBalance.sub(twentyTokens));

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
        acdmToken.connect(alice).transferFrom(owner.address, alice.address, amount)
      )
        .to.emit(acdmToken, "Transfer")
        .withArgs(owner.address, alice.address, amount);
    });

    it("Can not TransferFrom above the approved amount", async () => {
      // Approve 10 acdmTokens to Alice
      await acdmToken.approve(alice.address, tenTokens);
      // Trying to transfer 20 acdmTokens
      await expect(
        acdmToken.connect(alice).transferFrom(owner.address, alice.address, twentyTokens)
      ).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
    });

    it("Can not TransferFrom if owner does not have enough acdmTokens", async () => {
      // Approve Alice to use 10 acdmTokens
      await acdmToken.approve(alice.address, tenTokens);

      // Send most of owner acdmTokens to Bob
      await acdmToken.transfer(bob.address, ethers.utils.parseUnits("995.0", decimals));

      // Check that Alice can't transfer all amount (only 5 left)
      await expect(
        acdmToken.connect(alice).transferFrom(owner.address, alice.address, tenTokens)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });
  });

  // In our tests Bob has the BURNER_ROLE
  describe("Burning", function () {
    it("Should not be able to burn acdmTokens without BURNER_ROLE", async () => {
      const burnAmount = tenTokens;
      await expect(acdmToken.burn(alice.address, burnAmount)).to.be.revertedWith(
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
      await expect(acdmToken.mint(alice.address, mintAmount)).to.be.revertedWith(
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
