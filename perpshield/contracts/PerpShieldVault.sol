// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PerpShieldVault is ReentrancyGuard {

    IERC20 public immutable asset;

    uint256 public totalAssets;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;

    // Positions
    uint256 public longPosition;
    uint256 public shortPosition;

    // Yield
    int256 public fundingAccrued;

    // Bounty (basis points)
    uint256 public constant HARVEST_BOUNTY = 10;
    uint256 public constant REBALANCE_BOUNTY = 5;
    uint256 public constant DELEVERAGE_BOUNTY = 50;

    // Risk
    uint256 public shieldScore;
    uint256 public lastRebalance;
    bool public paused;

    // XP System
    mapping(address => uint256) public xp;

    // Events
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Harvest(address indexed caller, uint256 yield, uint256 bounty);
    event Rebalance(address indexed caller, uint256 bounty);
    event EmergencyDeleverage(address indexed caller, uint256 bounty);
    event Paused(bool status);

    modifier notPaused() {
        require(!paused, "Vault paused");
        _;
    }

    constructor(address _asset) {
        asset = IERC20(_asset);
    }

    // =========================
    // CORE FUNCTIONS
    // =========================

    function deposit(uint256 amount) external nonReentrant notPaused {
        require(amount > 0, "Invalid amount");

        asset.transferFrom(msg.sender, address(this), amount);

        balanceOf[msg.sender] += amount;
        totalSupply += amount;
        totalAssets += amount;

        // Delta neutral setup
        longPosition += amount / 2;
        shortPosition += amount / 2;

        xp[msg.sender] += 10;

        updateShieldScore();

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

        xp[msg.sender] += 5;

        updateShieldScore();

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

        xp[msg.sender] += 25;

        updateShieldScore();

        emit Harvest(msg.sender, uint256(yield), bounty);
    }

    function rebalance() external nonReentrant {
        uint256 delta = _getDelta();

        require(
            delta > totalAssets / 20 || shieldScore < 40,
            "No rebalance needed"
        );

        uint256 bounty = (totalAssets * REBALANCE_BOUNTY) / 10000;

        asset.transfer(msg.sender, bounty);

        longPosition = totalAssets / 2;
        shortPosition = totalAssets / 2;

        lastRebalance = block.timestamp;

        xp[msg.sender] += 20;

        updateShieldScore();

        emit Rebalance(msg.sender, bounty);
    }

    // =========================
    // RISK SYSTEM
    // =========================

    function updateShieldScore() public {
        uint256 delta = _getDelta();

        if (totalAssets == 0) {
            shieldScore = 100;
            return;
        }

        uint256 deltaPercent = (delta * 100) / totalAssets;

        if (deltaPercent < 5) {
            shieldScore = 90;
        } else if (deltaPercent < 10) {
            shieldScore = 70;
        } else {
            shieldScore = 40;
        }

        // Circuit breaker
        if (shieldScore < 30) {
            paused = true;
            emit Paused(true);
        }
    }

    function emergencyDeleverage() external nonReentrant {
        require(shieldScore < 20, "Not critical");

        uint256 bounty = (totalAssets * DELEVERAGE_BOUNTY) / 10000;

        asset.transfer(msg.sender, bounty);

        longPosition = totalAssets / 4;
        shortPosition = totalAssets / 4;

        xp[msg.sender] += 30;

        updateShieldScore();

        emit EmergencyDeleverage(msg.sender, bounty);
    }

    // =========================
    // INTERNAL
    // =========================

    function _getDelta() internal view returns (uint256) {
        return longPosition > shortPosition
            ? longPosition - shortPosition
            : shortPosition - longPosition;
    }

    // =========================
    // TESTING (REMOVE IN PROD)
    // =========================

    function mockAddYield(uint256 amount) external {
        fundingAccrued += int256(amount);
    }

    function mockImbalance(uint256 amount) external {
        longPosition += amount;
    }
}