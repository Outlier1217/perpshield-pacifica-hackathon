// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PerpShieldVault is ReentrancyGuard {

    IERC20 public immutable asset; // USDC

    uint256 public totalAssets;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;

    // Positions
    uint256 public longPosition;
    uint256 public shortPosition;

    // Funding yield
    int256 public fundingAccrued;

    // Bounty config (basis points)
    uint256 public constant HARVEST_BOUNTY = 10;     // 0.1%
    uint256 public constant REBALANCE_BOUNTY = 5;    // 0.05%

    // Risk
    uint256 public shieldScore;
    uint256 public lastRebalance;

    // Events
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Harvest(address indexed caller, uint256 yield, uint256 bounty);
    event Rebalance(address indexed caller, uint256 bounty);

    constructor(address _asset) {
        asset = IERC20(_asset);
    }

        function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Invalid amount");

        asset.transferFrom(msg.sender, address(this), amount);

        balanceOf[msg.sender] += amount;
        totalSupply += amount;
        totalAssets += amount;

        // Delta-neutral setup (mock)
        longPosition += amount / 2;
        shortPosition += amount / 2;

        emit Deposit(msg.sender, amount);
    }


        function withdraw(uint256 amount) external nonReentrant {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");

        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        totalAssets -= amount;

        longPosition -= amount / 2;
        shortPosition -= amount / 2;

        asset.transfer(msg.sender, amount);

        emit Withdraw(msg.sender, amount);
    }

        function harvest() external nonReentrant {
        require(block.timestamp > lastRebalance + 60, "Cooldown");

        int256 yield = fundingAccrued;
        require(yield > 0, "No yield");

        uint256 bounty = (uint256(yield) * HARVEST_BOUNTY) / 10000;

        asset.transfer(msg.sender, bounty);

        totalAssets += uint256(yield) - bounty;

        fundingAccrued = 0;

        emit Harvest(msg.sender, uint256(yield), bounty);
    }


        function rebalance() external nonReentrant {
        uint256 delta = longPosition > shortPosition
            ? longPosition - shortPosition
            : shortPosition - longPosition;

        require(delta > totalAssets / 20, "Delta too small"); // >5%

        uint256 bounty = (totalAssets * REBALANCE_BOUNTY) / 10000;

        asset.transfer(msg.sender, bounty);

        longPosition = totalAssets / 2;
        shortPosition = totalAssets / 2;

        lastRebalance = block.timestamp;

        emit Rebalance(msg.sender, bounty);
    }
}