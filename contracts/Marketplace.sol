// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "hardhat/console.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./utils/structs/EnumerableMap.sol";
import "./token/ERC20/SafeERC20.sol";
import "./access/AccessControl.sol";

contract Marketplace is AccessControl, ReentrancyGuard {
  using SafeERC20 for IERC20;

  struct Order {
    address account;
    uint256 amount;
    uint256 cost;
    uint256 tokenPrice;
    bool isOpen;
  }

  struct Round {
    uint256 createdAt;
    uint256 tradeVolume; // eth
    uint256 tokensLeft;
    uint256 price;
    Order[] orders;
    // mapping(address => Order[]) orders; // orders by user ?
  }

  event UserRegistered(address indexed account, address indexed referrer);
  event Buy(address indexed buyer, address indexed seller, uint256 spent, uint256 price, uint256 amount);
  event PlacedOrder(uint256 indexed roundID, address indexed account, uint256 amount, uint256 cost);
  event CanceledOrder(uint256 indexed roundID, uint256 indexed orderID, address indexed account);
  event BuyOrder(uint256 indexed roundID, uint256 indexed orderID, address indexed buyer, uint256 amount, uint256 cost);
  event StartedSaleRound(uint256 indexed roundID, uint256 newPrice, uint256 oldPrice, uint256 minted);
  event FinishedSaleRound(uint256 indexed roundID, uint256 oldPrice, uint256 burned);
  event StartedTradeRound(uint256 indexed roundID);
  event FinishedTradeRound(uint256 indexed roundID, uint256 tradeVolume);

  uint256 public constant START_PRICE = 0.00001 ether;
  uint256 public roundTime = 3 days;
  uint256 public tokenPriceRateEth = 0.000004 ether;
  uint256 public tokenPriceRatePct = 300; // 3 %
  uint256 public refLvlOneRate = 500;     // 5 %
  uint256 public refLvlTwoRate = 300;     // 3 %
  uint256 public refTradeRate = 250;      // 2.5 %
  uint256 public tradeFee = 500;          // 5 %
  uint256 public numRounds;
  address public token;
  bool public isSaleRound;

  mapping(address => address) public referrers; // referral => referrer
  mapping(uint256 => Round) public rounds;
  mapping(uint256 => Order[]) public orders;

  constructor(address _token, uint256 _roundTime) {
    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    token = _token;
    roundTime = _roundTime;

    startSaleRound(0, 1 ether);
  }

  function registerUser(address refferer) external {
    require(referrers[msg.sender] == address(0), "Already has a referrer");
    require(refferer != msg.sender, "Can't be self-referrer");
    referrers[msg.sender] = refferer;
    emit UserRegistered(msg.sender, refferer);
  }

  function placeOrder(uint256 amount, uint256 cost) external {
    require(!isSaleRound, "Can't place order on sale round");
    require(amount > 0, "Amount can't be zero");
    require(cost > 0, "Cost can't be zero");

    IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

    uint256 tokenPrice = cost / (amount / 10 ** 18);
    Round storage round = rounds[numRounds];
    round.orders.push(Order({
      account: msg.sender,
      amount: amount,
      cost: cost,
      tokenPrice: tokenPrice,
      isOpen: true
    }));

    round.tokensLeft += amount;

    emit PlacedOrder(numRounds, msg.sender, amount, cost);
  }

  function cancelOrder(uint256 id) external {
    Order storage order = rounds[numRounds].orders[id];
    require(msg.sender == order.account, "Not your order");
    require(order.isOpen, "Already canceled");

    _cancelOrder(id);
  }

  function changeRound() external onlyRole(DEFAULT_ADMIN_ROLE) {
    require((rounds[numRounds].createdAt + roundTime) <= block.timestamp, "Need to wait 3 days");

    isSaleRound ? startTradeRound(rounds[numRounds].price, rounds[numRounds].tokensLeft)
      : startSaleRound(rounds[numRounds].price, rounds[numRounds].tradeVolume);
  }

  function buyTokens(uint256 amount) external payable nonReentrant {
    require(isSaleRound, "Can't buy in trade round");
    require(amount > 0, "Amount can't be zero");
    // Check that user send enough ether
    Round storage round = rounds[numRounds];
    uint256 totalCost = round.price * (amount / 10 ** 18);
    require(msg.value >= totalCost, "Not enough ETH");

    // console.log("how much can buy on this: ", msg.value * (10 ** 18) / round.price);
    
    // Transfer tokens
    IERC20(token).safeTransfer(msg.sender, amount);

    round.tokensLeft -= amount;
    round.tradeVolume += totalCost;

    // Send rewards to referrers
    if (hasReferrer(msg.sender)) payReferrers(msg.sender, totalCost);

    // Transfer excess ETH back to msg.sender
    if (msg.value - totalCost > 0) {
      (bool sent,) = msg.sender.call{value: msg.value - totalCost}("");
      require(sent, "Failed to send Ether");
    }

    emit Buy(msg.sender, address(this), amount, round.price, totalCost);
    if (round.tokensLeft == 0) startTradeRound(round.price, round.tokensLeft);
  }

  function buyOrder(uint256 id, uint256 amount) external payable nonReentrant {
    Round storage round = rounds[numRounds];
    require(id >= 0 && id < round.orders.length, "Incorrect order id");
    Order storage order = round.orders[id];
    require(msg.sender != order.account, "Can't buy from yourself");
    require(order.isOpen, "Order already closed");
    require(amount > 0, "Amount can't be zero");
    require(amount <= order.amount, "Order doesn't have enough tokens");
    uint256 totalCost = order.tokenPrice * (amount / 10 ** 18);
    require(msg.value >= totalCost, "Not enough ETH");

    // Transfer tokens
    IERC20(token).safeTransfer(msg.sender, amount);

    order.amount -= amount;
    round.tokensLeft -= amount;
    round.tradeVolume += totalCost;

    // Transfer 95% ETH to order owner
    (bool sent,) = order.account.call{value: totalCost - (totalCost * tradeFee / 10000)}("");
    require(sent, "Failed to send Ether");

    // Send rewards to referrers
    if (hasReferrer(order.account)) payReferrers(order.account, totalCost);

    // Transfer excess ETH back to msg.sender
    if (msg.value - totalCost > 0) {
      (bool sent,) = msg.sender.call{value: msg.value - totalCost}("");
      require(sent, "Failed to send Ether");
    }
    // Check if order should be closed
    // if (order.amount == 0) _cancelOrder(id);

    emit BuyOrder(numRounds, id, msg.sender, amount, totalCost);
  }

  function getCurrentRoundData() external view returns (Round memory) {
    return rounds[numRounds];
  }

  function getRoundData(uint256 id) external view returns (Round memory) {
    return rounds[id];
  }

  function getCurrentRoundOrders() external view returns (Order[] memory) {
    return rounds[numRounds].orders;
  }

  function getPastRoundOrders(uint256 roundID) external view returns (Order[] memory) {
    return rounds[roundID].orders;
  }

  function getOrderData(uint256 roundID, uint256 id) external view returns (Order memory) {
    return rounds[roundID].orders[id];
  }

  // function getUserOrders(address account) external view returns (Order[] memory orders) {
  //   Order[] memory orders;
  //   // for (uint i = start; i <= end; i++) {
  //   //   Proposal memory p = proposals[i];
  //   //   props[i] = p;
  //   // }
  // }

  function getUserReferrers(address account) public view returns (address, address) {
    return (referrers[account], referrers[referrers[account]]);
  }

  function hasReferrer(address account) public view returns (bool) {
    return referrers[account] != address(0);
  }

  function payReferrers(address account, uint256 sum) private {
    (address ref1, address ref2) = getUserReferrers(account);
    // Reward ref 1
    (bool sent,) = ref1.call{value: (sum * (isSaleRound ? refLvlOneRate : refTradeRate) / 10000)}("");
    require(sent, "Failed to send Ether");
    // Reward ref 2 (if exists)
    if (ref2 != address(0)) {
      (bool sent,) = ref2.call{value: (sum * (isSaleRound ? refLvlTwoRate : refTradeRate) / 10000)}("");
      require(sent, "Failed to send Ether");
    }
  }

  function _cancelOrder(uint256 id) private {
    Order storage order = rounds[numRounds].orders[id];
    order.isOpen = false;
    rounds[numRounds].tokensLeft -= order.amount;

    // Return unsold tokens to the msg.sender
    IERC20(token).safeTransfer(order.account, order.amount);

    emit CanceledOrder(numRounds, id, msg.sender);
  }

  function startSaleRound(uint256 oldPrice, uint256 tradeVolume) private {
    // Closing orders
    closeOpenOrders(numRounds);
    // Calc new price
    uint256 newPrice = oldPrice + (oldPrice * tokenPriceRatePct / 10000) + tokenPriceRateEth;
    
    numRounds++;
    Round storage newRound = rounds[numRounds];
    newRound.createdAt = block.timestamp;
    newRound.price = numRounds == 1 ? START_PRICE : newPrice;

    uint256 mintAmount = tradeVolume * (10 ** 18) / (numRounds == 1 ? START_PRICE : newPrice);
    IERC20(token)._mint(address(this), mintAmount);

    newRound.tokensLeft = mintAmount;

    isSaleRound = true;

    emit FinishedTradeRound(numRounds - 1, tradeVolume);
    emit StartedSaleRound(numRounds, newPrice, oldPrice, mintAmount);
  }

  function startTradeRound(uint256 oldPrice, uint256 tokensLeft) private {
    // Burn unsold tokens
    if (tokensLeft > 0) IERC20(token)._burn(address(this), tokensLeft);
  
    numRounds++;
    Round storage newRound = rounds[numRounds];
    newRound.createdAt = block.timestamp;
    newRound.price = oldPrice;

    isSaleRound = false;
    emit FinishedSaleRound(numRounds - 1, oldPrice, tokensLeft);
    emit StartedTradeRound(numRounds);
  }

  function closeOpenOrders(uint256 roundID) private {
    Round storage round = rounds[roundID];
    for (uint256 i = 0; i < round.orders.length; i++) {
      if (round.orders[i].isOpen) {
        round.orders[i].isOpen = false;
        IERC20(token).safeTransfer(round.orders[i].account, round.orders[i].amount);
      }
    }
  }
}