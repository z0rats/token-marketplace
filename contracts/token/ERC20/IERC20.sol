// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.10;

/** @title Standard ERC-20 contract interface as described in EIP. */
interface IERC20 {
    /// @notice Returns total amount of tokens in existance.
    function totalSupply() external view returns (uint256);

    /** @notice Returns amount of tokens owned by `account`.
     * @param account The address of the token holder.
     * @return The amount of tokens in uint.
     */
    function balanceOf(address account) external view returns (uint256);

    /** @notice Transfers `amount` of tokens to specified address.
     * @param to The address of recipient.
     * @param amount The amount of tokens to transfer.
     * @return True if transfer was successfull.
     */
    function transfer(address to, uint256 amount) external returns (bool);

    /** @notice Returns the number of tokens 
     * approved by an `owner` to a `spender`.
     * @param owner Address of the owner of approved tokens.
     * @param spender The approved address.
     * @return The amount of tokens in uint.
     */
    function allowance(
        address owner, address spender
    ) external view returns (uint256);

    /** @notice Approves `spender` to use `amount` of function caller tokens.
     * @param spender The address of recipient.
     * @param amount The amount of tokens to approve.
     * @return True if approved successfully.
     */
    function approve(
        address spender, uint256 amount
    ) external returns (bool);

    /** @notice Allows a spender to spend an allowance.
     * @param sender The address of spender.
     * @param recipient The address of recipient.
     * @param amount The amount of tokens to transfer.
     * @return True if transfer was successfull.
     */
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    /** @notice Mints `amount` of tokens to specified address.
     * @dev Increases `_totalSupply` and `_balances[msg.sender]` 
     * on specified `amount`. Emits `Transfer` event.
     * @param to The address to mint tokens on.
     * @param amount The amount of tokens to mint.
     */
    function _mint(address to, uint256 amount) external;

    /** @notice Burns `amount` of tokens.
     * @dev Decreases `_totalSupply` and `_balances[msg.sender]` 
     * on specified `amount`. Emits `Transfer` event.
     * @param account The account to burn tokens from.
     * @param amount The amount of tokens to burn.
     */
    function _burn(address account, uint256 amount) external;

    /** @notice Emitted when a token transfer occurs.
     * @param from Sender`s address.
     * @param to Recipient`s address.
     * @param value The amount of transferred tokens.
     */
    event Transfer(
        address indexed from, address indexed to, uint256 value
    );

    /** @notice Emitted when a token approval occurs.
     * @param owner The source account.
     * @param spender The address of spender.
     * @param value The amount of tokens.
     */
    event Approval(
        address indexed owner, address indexed spender, uint256 value
    );
}