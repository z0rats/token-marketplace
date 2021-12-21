// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/** @title ACDM token. */
contract ACDMToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE  = keccak256("BURNER_ROLE ");

    address public marketplace;
    
    event AddToWhitelist(address indexed caller, address account);
    event RemoveFromWhitelist(address indexed caller, address account);
    event ChangeFeeRate(address indexed caller, uint256 feeRate);
    event ChangeFeeRecipient(address indexed caller, address feeRecipient);

    /** @notice Creates token with custom name, symbol
     * @param name Name of the token.
     * @param symbol Token symbol.
     */
    constructor(
        string memory name,
        string memory symbol
    )
        ERC20(name, symbol)
    {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /** @notice Initializes token with Marketplace contract.
     * @dev Sets DEFAULT_ADMIN_ROLE to Marketplace and revokes it from token owner.
     * @param _marketplace The address of the Marketplace contract.
     */
    function initialize(address _marketplace, uint256 initSupply) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(DEFAULT_ADMIN_ROLE, msg.sender);
        marketplace = _marketplace;
        _setupRole(DEFAULT_ADMIN_ROLE, _marketplace);
        _mint(_marketplace, initSupply);
    }

    /** @notice Calls burn function to "burn" specified amount of tokens.
     * @param from The address to burn tokens on.
     * @param amount The amount of tokens to burn.
     */
    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        _burn(from, amount);
    }

    /** @notice Calls mint function to "mint" specified amount of tokens.
     * @param to The address to mint on.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /** @notice Hook that is called before any transfer of tokens.
     * @dev Charges fee from address `from` in favor of `_feeRecipient` if 
     * he is not in the whitelist.
     *
     * @param from The address of spender.
     * @param to The address of recipient.
     * @param amount The amount of tokens to transfer.
     */
    // function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual override {
        
    // }
}