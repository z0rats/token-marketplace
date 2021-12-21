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
    uint256 price;
    bool isOpen;
  }

  struct Round {
    uint256 createdAt;
    uint256 tradeVolume; // eth
    uint256 saleVolume; // eth
    uint256 buyVolume; // eth
    uint256 tokensLeft;
    // uint256 tokensToSell;
    uint256 price;
    // mapping(address => Order) orders;
  }

  event UserRegistered(address indexed account, address indexed referrer);
  event Buy(address indexed buyer, address indexed seller, uint256 spent, uint256 price, uint256 amount);
  event PlacedOrder(address indexed account);
  event CanceledOrder(address indexed account);
  event NewRound(uint256 oldPrice, uint256 newPrice);
  event RoundCompleted(bool isSaleRound);

  uint256 public roundTime = 3 days;
  uint256 public ratePct = 300; // 3 %
  uint256 public fixedRate = 0.000004 ether;
  uint256 public refLvlOneRate = 500; // 5 %
  uint256 public refLvlTwoRate = 300; // 3 %
  uint256 public refTradeRate = 250; // 2.5 %
  uint256 public numRounds;
  bool public isSaleRound;
  address public token;

  mapping(address => uint256) public balances;
  mapping(address => address payable) public referrers; // referral => referrer
  mapping(uint256 => Round) public rounds;
  // mapping(uint256 => mapping(address => Order)) public orders;
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
    round.tradeVolume += totalCost;
    // Send rewards to referrals
    payReferrers(msg.sender, totalCost);
    // Transfer excess ETH back to msg.sender
    payable(msg.sender).transfer(msg.value - totalCost);

    emit Buy(msg.sender, address(this), amount, round.price, totalCost);
    if (round.tokensLeft == 0) finishRound();
  }

  function payReferrers(address account, uint256 sum) private {
    (address payable ref1, address payable ref2) = getUserRefs(account);
    if (ref1 != address(0)) 
      ref1.transfer(sum * (isSaleRound ? refLvlOneRate : refTradeRate) / 10000);
    if (ref2 != address(0)) 
      ref2.transfer(sum * (isSaleRound ? refLvlTwoRate : refTradeRate) / 10000);
  }

  function placeOrder(uint256 amount, uint256 price) external {
    require(!isSaleRound, "Can't place order on sale round");
    require(amount > 0, "Amount can't be zero");

    IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

    balances[msg.sender] += amount;
  
    orders[numRounds].push(Order({
      account: msg.sender,
      amount: amount,
      price: price,
      isOpen: true
    }));

    rounds[numRounds].tokensLeft += amount;

    emit PlacedOrder(msg.sender);
  }

  function getUserOrders(address account) external view returns (Order[] memory orders) {
    Order[] memory orders;
    // for (uint i = start; i <= end; i++) {
    //   Proposal memory p = proposals[i];
    //   props[i] = p;
    // }
  }

  function cancelOrder(uint256 orderID) external {
    emit CanceledOrder(msg.sender);
  }

  function finishRound() public {
    require((rounds[numRounds].createdAt + roundTime) <= block.timestamp, "Need to wait 3 days");

    // closeOpenOrders();
    changeRound(rounds[numRounds].price);

    // Return tokens if trade round

    // Decide which event to emit
    // emit SaleRoundCompleted();
    // emit TradeCompleted();
  }

  function changeRound(uint256 oldPrice) private {
    uint256 newPrice = oldPrice + (oldPrice * ratePct / 10000) + fixedRate;

    numRounds++;
    if (isSaleRound) {
      isSaleRound = false;
      rounds[numRounds] = Round({
        createdAt: block.timestamp,
        tradeVolume: 0,
        saleVolume: 0,
        buyVolume: 0,
        price: newPrice,
        tokensLeft: IERC20(token).totalSupply()
      });
    } else {
      isSaleRound = true;
      rounds[numRounds] = Round({
        createdAt: block.timestamp,
        tradeVolume: 0,
        saleVolume: 0,
        buyVolume: 0,
        price: newPrice,
        tokensLeft: IERC20(token).totalSupply()
      });
    }
    
    // console.log("price: ", oldPrice);
    // console.log("newPrice: ", newPrice);
    // console.log("?", newPrice > oldPrice);

    emit NewRound(oldPrice, newPrice);
  }
}