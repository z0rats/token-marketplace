// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "hardhat/console.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

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
    uint256 tokensSold; // eth
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
  event NewRound(uint256 oldPrice, uint256 newPrice);
  event RoundCompleted(bool isSaleRound);

  uint256 public roundTime = 3 days;
  uint256 public tokenPriceRateEth = 0.000004 ether;
  uint256 public tokenPriceRatePct = 300;       // 3 %
  uint256 public refLvlOneRate = 500; // 5 %
  uint256 public refLvlTwoRate = 300; // 3 %
  uint256 public refTradeRate = 250;  // 2.5 %
  uint256 public numRounds;
  bool public isSaleRound;
  address public token;

  mapping(address => address payable) public referrers; // referral => referrer
  mapping(uint256 => Round) public rounds;
  mapping(uint256 => Order[]) public orders;

  constructor(address tokenAddress) {
    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    token = tokenAddress;
  }

  function openMarketplace(uint256 _roundTime, uint256 _price) external onlyRole(DEFAULT_ADMIN_ROLE) {
    roundTime = _roundTime;

    numRounds++;
    Round storage r = rounds[numRounds];
    r.createdAt = block.timestamp;
    r.price = _price;
    r.tokensLeft = IERC20(token).totalSupply();

    isSaleRound = true;

    emit NewRound(0, _price);
  }

  function getCurrentRoundData() public view returns (Round memory) {
    return rounds[numRounds];
  }

  function getRoundData(uint256 id) public view returns (Round memory) {
    return rounds[id];
  }

  function registerUser(address refferer) external {
    require(referrers[msg.sender] == address(0), "Already has a referrer");
    require(refferer != msg.sender, "Can't be self-referrer");
    referrers[msg.sender] = payable(refferer);
    emit UserRegistered(msg.sender, refferer);
  }

  function getUserRefs(address account) public view returns (address payable, address payable) {
    return (referrers[account], referrers[referrers[account]]);
  }

  function buyTokens(uint256 amount) external payable nonReentrant {
    require(isSaleRound, "Can't buy in trade round");
    require(amount > 0, "Amount can't be zero");
    // Check that user send enough ether
    Round memory round = getCurrentRoundData();
    uint256 totalCost = round.price * (amount / 10 ** 18);
    require(msg.value >= totalCost, "Not enough ETH");

    // console.log("how much can buy on this: ", msg.value * (10 ** 18) / round.price);
    
    // Transfer tokens
    IERC20(token).safeTransfer(msg.sender, amount);
    round.tokensLeft -= amount;
    round.tokensSold += amount;
    round.tradeVolume += totalCost;
    // Send rewards to referrers
    payReferrers(msg.sender, totalCost);
    // Transfer excess ETH back to msg.sender
    if (msg.value - totalCost > 0)
      payable(msg.sender).transfer(msg.value - totalCost);

    emit Buy(msg.sender, address(this), amount, round.price, totalCost);
    if (round.tokensLeft == 0) finishRound();
  }

  function buyOrder(uint256 id, uint256 amount) external payable nonReentrant {
    require(id >= 0 && id < rounds[numRounds].orders.length, "Incorrect order id");
    Order storage order = rounds[numRounds].orders[id];
    require(msg.sender != order.account, "Can't buy from yourself");
    require(order.isOpen, "Order already closed");
    require(amount > 0, "Amount can't be zero");
    require(amount <= order.amount, "Order doesn't have enough tokens");
    uint256 totalCost = order.tokenPrice * (amount / 10 ** 18);
    require(msg.value >= totalCost, "Not enough ETH");

    // Transfer tokens
    IERC20(token).safeTransfer(msg.sender, amount);
    order.amount -= amount;
    rounds[numRounds].tokensLeft -= amount;
    rounds[numRounds].tokensSold += amount;
    rounds[numRounds].tradeVolume += totalCost;
    // Transfer ETH to order owner
    payable(order.account).transfer(totalCost);
    // Send rewards to referrers
    payReferrers(order.account, totalCost);
    // Transfer excess ETH back to msg.sender
    if (msg.value - totalCost > 0)
      payable(msg.sender).transfer(msg.value - totalCost);
    // Check if order should be closed
    if (order.amount == 0) _cancelOrder(id);

    emit BuyOrder(numRounds, id, msg.sender, amount, totalCost);
  }

  function payReferrers(address account, uint256 sum) private {
    (address payable ref1, address payable ref2) = getUserRefs(account);
    if (ref1 != address(0)) 
      ref1.transfer(sum * (isSaleRound ? refLvlOneRate : refTradeRate) / 10000);
    if (ref2 != address(0)) 
      ref2.transfer(sum * (isSaleRound ? refLvlTwoRate : refTradeRate) / 10000);
  }

  function placeOrder(uint256 amount, uint256 cost) external nonReentrant {
    require(!isSaleRound, "Can't place order on sale round");
    require(amount > 0, "Amount can't be zero");
    require(cost > 0, "Cost can't be zero");

    IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

    rounds[numRounds].orders.push(Order({
      account: msg.sender,
      amount: amount,
      cost: cost,
      tokenPrice: cost / amount,
      isOpen: true
    }));

    rounds[numRounds].tokensLeft += amount;

    emit PlacedOrder(numRounds, msg.sender, amount, cost);
  }

  function cancelOrder(uint256 id) external {
    Order storage order = rounds[numRounds].orders[id];
    require(msg.sender == order.account, "Not your order");
    require(order.isOpen, "Already canceled");

    _cancelOrder(id);
  }

  function _cancelOrder(uint256 id) private {
    Order storage order = rounds[numRounds].orders[id];
    order.isOpen = false;
    rounds[numRounds].tokensLeft -= order.amount;

    // Return unsold tokens to the msg.sender
    IERC20(token).safeTransfer(order.account, order.amount);

    emit CanceledOrder(numRounds, id, msg.sender);
  }

  function getCurrentRoundOrders() external view returns (Order[] memory) {
    return rounds[numRounds].orders;
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

  function finishRound() public {
    require((rounds[numRounds].createdAt + roundTime) <= block.timestamp, "Need to wait 3 days");

    changeRound(rounds[numRounds].price);
  }

  function changeRound(uint256 oldPrice) private {
    uint256 newPrice = oldPrice + (oldPrice * tokenPriceRatePct / 10000) + tokenPriceRateEth;

    numRounds++;
    rounds[numRounds].createdAt = block.timestamp;
    rounds[numRounds].price = newPrice;

    if (isSaleRound) {
      isSaleRound = false;
      // burn unsold tokens
    } else {
      isSaleRound = true;
      closeOpenOrders(numRounds - 1);
      // mint tokens
      // uint256 amount = rounds[numRounds - 1].tradeVolume / oldPrice;
      // rounds[numRounds].tokensLeft = IERC20(token).totalSupply();
    }
    
    emit NewRound(oldPrice, newPrice);
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