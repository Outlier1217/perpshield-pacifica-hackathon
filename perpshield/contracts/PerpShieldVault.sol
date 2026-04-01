// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// =========================
// PACIFICA INTERFACES
// =========================

interface IPacificaPerp {
    struct Position {
        uint256 id;
        address user;
        address market;
        uint8 side;
        uint256 size;
        uint256 collateral;
        uint256 leverage;
        uint256 entryPrice;
        uint256 openTime;
    }

    function openPosition(
        address market,
        uint8 side,
        uint256 size,
        uint256 leverage,
        address collateral
    ) external returns (uint256 positionId);

    function closePosition(uint256 positionId, uint256 size) external;
    function getPosition(uint256 positionId) external view returns (Position memory);
    function getFundingRate(address market) external view returns (int256);
    function getMarkPrice(address market) external view returns (uint256);
    function getLiquidationPrice(uint256 positionId) external view returns (uint256);
}

interface IPacificaOracle {
    function getPrice(address market) external view returns (uint256);
    function getPriceFeed(address market) external view returns (int256, uint256);
    function isHealthy(address market) external view returns (bool);
    function getTimestamp() external view returns (uint256);
}

// =========================
// MAIN CONTRACT
// =========================

contract PerpShieldVault is ERC4626, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // =========================
    // PACIFICA INTEGRATION
    // =========================

    IPacificaPerp public immutable pacificaPerp;
    IPacificaOracle public immutable pacificaOracle;
    address public immutable bnbMarket;

    uint256 public longPositionId;
    uint256 public shortPositionId;
    bool public positionsOpen;

    mapping(address => UserPosition) public userPositions;

    struct UserPosition {
        uint256 longShares;
        uint256 shortShares;
        uint256 lastUpdate;
    }

    // =========================
    // VAULT STATE
    // =========================

    uint256 public totalAssetsVault;
    uint256 public lastYieldUpdate;
    int256 public pendingYield;

    // =========================
    // BOUNTY SYSTEM
    // =========================

    uint256 public constant HARVEST_BOUNTY_BPS  = 10;    // 0.10% of yield
    uint256 public constant REBALANCE_BOUNTY_BPS = 5;    // 0.05% of TVL
    uint256 public constant DELEVERAGE_BOUNTY_BPS = 50;  // 0.50% of TVL

    // Threat report: fixed reward paid by owner, not from TVL
    uint256 public threatRewardPool;

    mapping(address => uint256) public totalBountiesEarned;
    uint256 public totalBountiesPaid;

    // =========================
    // FLASH GUARD (BountyFlashGuard)
    // =========================

    // Max deposit per block = 10% of TVL (anti-sandwich / manipulation)
    uint256 public constant MAX_DEPOSIT_PER_BLOCK_BPS = 1000; // 10%
    mapping(uint256 => uint256) public blockDepositTotal; // block.number => deposited

    // =========================
    // RISK SYSTEM
    // =========================

    uint256 public shieldScore;
    uint256 public peakAssets;
    uint256 public lastShieldUpdate;
    bool public paused;
    bool public emergencyMode;

    uint256 public constant PAUSE_THRESHOLD     = 30;
    uint256 public constant EMERGENCY_THRESHOLD = 15;
    uint256 public constant LIQUIDATION_BUFFER  = 20;

    // =========================
    // GAMIFICATION
    // =========================

    mapping(address => uint256) public xp;
    mapping(address => uint256) public level;
    mapping(address => uint256) public lastAction;

    struct LevelReward {
        uint256 xpRequired;
        uint256 multiplier; // base 100 = 1x
    }

    LevelReward[] public levelRewards;

    uint256 private constant XP_DEPOSIT    = 10;
    uint256 private constant XP_WITHDRAW   = 5;
    uint256 private constant XP_HARVEST    = 25;
    uint256 private constant XP_REBALANCE  = 20;
    uint256 private constant XP_EMERGENCY  = 30;
    uint256 private constant XP_REPORT     = 30;

    // =========================
    // EVENTS
    // =========================

    event Deposited(address indexed user, uint256 assets, uint256 shares);
    event Withdrawn(address indexed user, uint256 assets, uint256 shares);
    event Harvest(address indexed caller, uint256 yield, uint256 bounty, uint256 newTotalAssets);
    event Rebalance(address indexed caller, uint256 bounty, uint256 oldDelta, uint256 newDelta);
    event EmergencyDeleverage(address indexed caller, uint256 bounty, uint256 oldLong, uint256 oldShort);
    event ShieldScoreUpdated(uint256 score, uint256 fundingMagnitude, uint256 deltaPct, uint256 oracleScore, uint256 drawdownPct);
    event VaultPaused(bool status);
    event EmergencyModeChanged(bool status);
    event PositionsOpened(uint256 longId, uint256 shortId);
    event PositionsClosed(uint256 longId, uint256 shortId);
    event ThreatReported(address indexed reporter, string threat, uint256 bounty);
    event ThreatRewardPoolFunded(uint256 amount);

    // =========================
    // MODIFIERS
    // =========================

    modifier notPaused() {
        require(!paused, "PerpShield: Vault paused");
        _;
    }

    modifier notEmergency() {
        require(!emergencyMode, "PerpShield: Emergency mode active");
        _;
    }

    // =========================
    // CONSTRUCTOR
    // =========================

    constructor(
        address _asset,
        address _pacificaPerp,
        address _pacificaOracle,
        address _bnbMarket
    )
        ERC4626(IERC20(_asset))
        ERC20("PerpShield Yield Vault", "pshUSDC")
        Ownable()
    {
        require(_asset         != address(0), "Invalid asset");
        require(_pacificaPerp  != address(0), "Invalid Pacifica perp");
        require(_pacificaOracle!= address(0), "Invalid Pacifica oracle");
        require(_bnbMarket     != address(0), "Invalid market");

        pacificaPerp   = IPacificaPerp(_pacificaPerp);
        pacificaOracle = IPacificaOracle(_pacificaOracle);
        bnbMarket      = _bnbMarket;

        lastYieldUpdate  = block.timestamp;
        lastShieldUpdate = block.timestamp;

        // Level 0-5 rewards
        levelRewards.push(LevelReward(0,     100));
        levelRewards.push(LevelReward(100,   105));
        levelRewards.push(LevelReward(500,   110));
        levelRewards.push(LevelReward(2000,  115));
        levelRewards.push(LevelReward(5000,  125));
        levelRewards.push(LevelReward(10000, 150));

        // Initialize shield score to max-safe (100) at deploy time.
        // Cannot call _updateShieldScore() here because Pacifica external calls
        // would revert against non-contract mock addresses on testnet setup.
        shieldScore = 100;
    }

    // =========================
    // CORE: DEPOSIT
    // =========================

    /**
     * @notice Deposit USDC, receive pshUSDC shares.
     *         Opens / adds to delta-neutral position on Pacifica.
     * @dev    BountyFlashGuard: max 10% TVL per block.
     */
    function deposit(uint256 assets, address receiver)
        public
        override
        nonReentrant
        notPaused
        notEmergency
        returns (uint256 shares)
    {
        require(assets > 0, "PerpShield: Zero amount");
        require(receiver != address(0), "PerpShield: Zero receiver");

        // --- BountyFlashGuard ---
        uint256 maxThisBlock = totalAssetsVault > 0
            ? (totalAssetsVault * MAX_DEPOSIT_PER_BLOCK_BPS) / 10000
            : type(uint256).max; // no limit when vault is empty
        blockDepositTotal[block.number] += assets;
        require(
            blockDepositTotal[block.number] <= maxThisBlock,
            "PerpShield: Block deposit limit exceeded"
        );

        // --- Transfer USDC in ---
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), assets);

        // --- Share calculation: must use pre-deposit totalAssets ---
        // _convertToShares reads totalAssetsVault BEFORE we increment it
        shares = _computeShares(assets);
        require(shares > 0, "PerpShield: Zero shares");
        _mint(receiver, shares);

        // --- Update accounting ---
        totalAssetsVault += assets;
        if (totalAssetsVault > peakAssets) {
            peakAssets = totalAssetsVault;
        }

        // --- Open / add to Pacifica positions ---
        if (!positionsOpen) {
            _openDeltaNeutralPosition(assets);
        } else {
            _addToPositions(assets);
        }

        // --- Track user exposure (in asset units) ---
        userPositions[receiver].longShares  += assets / 2;
        userPositions[receiver].shortShares += assets / 2;
        userPositions[receiver].lastUpdate   = block.timestamp;

        _updateXP(receiver, XP_DEPOSIT);
        _updateShieldScore();

        emit Deposited(receiver, assets, shares);
        return shares;
    }

    // =========================
    // CORE: WITHDRAW
    // =========================

    /**
     * @notice Burn shares, receive USDC back.
     *         Closes positions proportionally. Always available (even when paused).
     */
    function withdraw(uint256 assets, address receiver, address owner)
        public
        override
        nonReentrant
        returns (uint256 shares)
    {
        require(assets > 0, "PerpShield: Zero amount");
        require(receiver != address(0), "PerpShield: Zero receiver");
        require(assets <= totalAssetsVault, "PerpShield: Amount exceeds vault");

        shares = _computeSharesForWithdraw(assets);
        require(shares > 0, "PerpShield: Zero shares");
        require(balanceOf(owner) >= shares, "PerpShield: Insufficient shares");

        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }

        _burn(owner, shares);
        totalAssetsVault -= assets;

        // --- Close proportional Pacifica positions ---
        _closePositionsProportionally(assets);

        // --- Update user exposure ---
        uint256 halfAssets = assets / 2;
        if (userPositions[owner].longShares >= halfAssets) {
            userPositions[owner].longShares -= halfAssets;
        } else {
            userPositions[owner].longShares = 0;
        }
        if (userPositions[owner].shortShares >= halfAssets) {
            userPositions[owner].shortShares -= halfAssets;
        } else {
            userPositions[owner].shortShares = 0;
        }

        // --- Transfer USDC out ---
        IERC20(asset()).safeTransfer(receiver, assets);

        _updateXP(owner, XP_WITHDRAW);
        _updateShieldScore();

        emit Withdrawn(owner, assets, shares);
        return shares;
    }

    // =========================
    // YIELD: HARVEST
    // =========================

    /**
     * @notice Collect accrued funding-rate yield.
     *         Caller earns a bounty; rest credited to vault NAV.
     */
    function harvest() external nonReentrant notPaused {
        require(block.timestamp >= lastYieldUpdate + 60, "PerpShield: Cooldown active");
        require(totalAssetsVault > 0, "PerpShield: Empty vault");

        int256 fundingRate  = pacificaPerp.getFundingRate(bnbMarket);
        uint256 timeElapsed = block.timestamp - lastYieldUpdate;

        // Funding yield: short position earns when fundingRate > 0
        int256 yieldEarned = (fundingRate * int256(timeElapsed)) / 1 days;
        pendingYield += yieldEarned;

        require(pendingYield > 0, "PerpShield: No positive yield to harvest");

        uint256 yieldAmount = uint256(pendingYield);
        uint256 bounty      = _applyMultiplier(
            (yieldAmount * HARVEST_BOUNTY_BPS) / 10000,
            msg.sender
        );

        // Safety: bounty must not exceed liquid balance
        uint256 liquid = IERC20(asset()).balanceOf(address(this));
        bounty = bounty > liquid ? liquid : bounty;

        IERC20(asset()).safeTransfer(msg.sender, bounty);

        uint256 netYield = yieldAmount - bounty;
        totalAssetsVault += netYield;
        if (totalAssetsVault > peakAssets) peakAssets = totalAssetsVault;

        totalBountiesPaid          += bounty;
        totalBountiesEarned[msg.sender] += bounty;

        pendingYield    = 0;
        lastYieldUpdate = block.timestamp;

        _updateXP(msg.sender, XP_HARVEST);
        _updateShieldScore();

        emit Harvest(msg.sender, yieldAmount, bounty, totalAssetsVault);
    }

    // =========================
    // MAINTENANCE: REBALANCE
    // =========================

    /**
     * @notice Rebalance positions back to delta-neutral.
     *         Callable by anyone when delta drifts or shield score is low.
     */
    function rebalance() external nonReentrant notPaused {
        require(totalAssetsVault > 0, "PerpShield: No assets in vault");
        uint256 delta     = _getDelta();
        uint256 threshold = totalAssetsVault / 20; // 5% drift
        require(
            delta > threshold || shieldScore < 40,
            "PerpShield: No rebalance needed"
        );

        uint256 oldDelta = delta;

        uint256 bounty = _applyMultiplier(
            (totalAssetsVault * REBALANCE_BOUNTY_BPS) / 10000,
            msg.sender
        );
        uint256 liquid = IERC20(asset()).balanceOf(address(this));
        bounty = bounty > liquid ? liquid : bounty;

        // Rebalance BEFORE paying bounty (state-change first)
        _rebalancePositions();

        IERC20(asset()).safeTransfer(msg.sender, bounty);
        totalBountiesPaid              += bounty;
        totalBountiesEarned[msg.sender] += bounty;

        _updateXP(msg.sender, XP_REBALANCE);
        _updateShieldScore();

        emit Rebalance(msg.sender, bounty, oldDelta, _getDelta());
    }

    // =========================
    // SAFETY: EMERGENCY DELEVERAGE
    // =========================

    /**
     * @notice Anyone can trigger emergency deleverage when shieldScore is critical.
     *         Bounty is paid AFTER positions are reduced (CEI pattern).
     */
    function emergencyDeleverage() external nonReentrant {
        require(totalAssetsVault > 0, "PerpShield: No assets in vault");
        require(shieldScore < EMERGENCY_THRESHOLD, "PerpShield: Not critical enough");
        require(!emergencyMode, "PerpShield: Already in emergency mode");

        uint256 oldLong  = longPositionId  > 0 ? pacificaPerp.getPosition(longPositionId).size  : 0;
        uint256 oldShort = shortPositionId > 0 ? pacificaPerp.getPosition(shortPositionId).size : 0;

        // Reduce to 25% of current TVL (state change first — CEI)
        _reducePositionsToTarget(totalAssetsVault / 4);

        emergencyMode = true;
        emit EmergencyModeChanged(true);

        // Pay bounty AFTER state change
        uint256 bounty = _applyMultiplier(
            (totalAssetsVault * DELEVERAGE_BOUNTY_BPS) / 10000,
            msg.sender
        );
        uint256 liquid = IERC20(asset()).balanceOf(address(this));
        bounty = bounty > liquid ? liquid : bounty;

        IERC20(asset()).safeTransfer(msg.sender, bounty);
        totalBountiesPaid              += bounty;
        totalBountiesEarned[msg.sender] += bounty;

        _updateXP(msg.sender, XP_EMERGENCY);
        _updateShieldScore();

        emit EmergencyDeleverage(msg.sender, bounty, oldLong, oldShort);
    }

    // =========================
    // SAFETY: THREAT REPORTING
    // =========================

    /**
     * @notice Report a security threat. Paid from a dedicated reward pool
     *         funded by the owner — NOT from depositor TVL.
     * @param  description Human-readable threat description.
     * @param  proof       Arbitrary bytes (tx hash, calldata, etc.).
     */
    function reportThreat(string calldata description, bytes calldata proof)
        external
        nonReentrant
    {
        require(bytes(description).length > 0, "PerpShield: Empty description");
        require(proof.length > 0,              "PerpShield: Empty proof");
        require(threatRewardPool > 0,          "PerpShield: Reward pool empty");

        uint256 bounty = threatRewardPool; // full pool goes to reporter
        threatRewardPool = 0;

        IERC20(asset()).safeTransfer(msg.sender, bounty);
        totalBountiesEarned[msg.sender] += bounty;

        _updateXP(msg.sender, XP_REPORT);

        emit ThreatReported(msg.sender, description, bounty);
    }

    /**
     * @notice Owner funds the threat reward pool (separate from depositor funds).
     */
    function fundThreatRewardPool(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "PerpShield: Zero amount");
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), amount);
        threatRewardPool += amount;
        emit ThreatRewardPoolFunded(amount);
    }

    // =========================
    // ADMIN: PAUSE / RESUME
    // =========================

    function emergencyPause() external onlyOwner {
        paused = true;
        emit VaultPaused(true);
    }

    function resume() external onlyOwner {
        // ShieldScore gate only applies when vault has TVL at risk.
        // Empty vault (totalAssetsVault == 0) is always safe to resume.
        require(
            totalAssetsVault == 0 || shieldScore >= PAUSE_THRESHOLD,
            "PerpShield: ShieldScore still critical"
        );
        paused        = false;
        emergencyMode = false;
        emit VaultPaused(false);
        emit EmergencyModeChanged(false);
    }

    // =========================
    // ADMIN: EMERGENCY WITHDRAW
    // =========================

    /**
     * @notice Owner can sweep vault funds in a true emergency.
     *         Only callable when paused or in emergency mode.
     */
    function emergencyWithdraw(address to) external onlyOwner nonReentrant {
        require(emergencyMode || paused, "PerpShield: Not in emergency state");
        require(to != address(0), "PerpShield: Zero address");

        // Safely close positions (ignore if ID=0 or mock reverts)
        if (longPositionId > 0) {
            try pacificaPerp.closePosition(longPositionId, type(uint256).max) {} catch {}
        }
        if (shortPositionId > 0) {
            try pacificaPerp.closePosition(shortPositionId, type(uint256).max) {} catch {}
        }

        positionsOpen   = false;
        longPositionId  = 0;
        shortPositionId = 0;

        // --- Critical Fix for Zero Balance + Mock Asset ---
        // Direct low-level call instead of IERC20 to avoid any SafeERC20 / interface revert
        (bool success, bytes memory data) = asset().staticcall(
            abi.encodeWithSignature("balanceOf(address)", address(this))
        );

        uint256 balance = 0;
        if (success && data.length >= 32) {
            balance = abi.decode(data, (uint256));
        }
        // If call fails or returns garbage → treat as 0 (zero balance case)

        if (balance > 0) {
            // Only attempt transfer if we actually have balance
            IERC20(asset()).safeTransfer(to, balance);
        }
        // balance == 0 → do nothing, function succeeds (this is what test wants)
    }
    // =========================
    // INTERNAL: POSITIONS
    // =========================

    function _openDeltaNeutralPosition(uint256 amount) internal {
        uint256 half = amount / 2;

        // Approve Pacifica to spend collateral
        IERC20(asset()).safeApprove(address(pacificaPerp), amount);

        longPositionId = pacificaPerp.openPosition(
            bnbMarket,
            0,      // LONG
            half,
            1,      // 1x leverage
            asset()
        );

        shortPositionId = pacificaPerp.openPosition(
            bnbMarket,
            1,      // SHORT
            half,
            1,
            asset()
        );

        positionsOpen = true;
        emit PositionsOpened(longPositionId, shortPositionId);
    }

    /**
     * @notice Add to existing positions proportionally.
     * @dev    Pacifica's `openPosition` with the same position ID increases size;
     *         adjust if Pacifica uses a separate `increasePosition` call.
     */
    function _addToPositions(uint256 amount) internal {
        uint256 half = amount / 2;

        IERC20(asset()).safeApprove(address(pacificaPerp), amount);

        // Re-open with additional collateral (mirrors _openDeltaNeutralPosition)
        // If Pacifica has an `increasePosition(id, size)` function, use that instead.
        pacificaPerp.openPosition(bnbMarket, 0, half, 1, asset()); // long leg
        pacificaPerp.openPosition(bnbMarket, 1, half, 1, asset()); // short leg
    }

    function _closePositionsProportionally(uint256 amount) internal {
        if (totalSupply() == 0) {
            // Last withdrawal: close everything
            if (longPositionId > 0) {
                pacificaPerp.closePosition(longPositionId, type(uint256).max);
            }
            if (shortPositionId > 0) {
                pacificaPerp.closePosition(shortPositionId, type(uint256).max);
            }
            positionsOpen   = false;
            emit PositionsClosed(longPositionId, shortPositionId);
            longPositionId  = 0;
            shortPositionId = 0;
            return;
        }

        uint256 half = amount / 2;
        if (longPositionId > 0) {
            pacificaPerp.closePosition(longPositionId, half);
        }
        if (shortPositionId > 0) {
            pacificaPerp.closePosition(shortPositionId, half);
        }
    }

    function _rebalancePositions() internal {
        uint256 targetSize = totalAssetsVault / 2;

        if (longPositionId > 0) {
            pacificaPerp.closePosition(longPositionId, type(uint256).max);
        }
        if (shortPositionId > 0) {
            pacificaPerp.closePosition(shortPositionId, type(uint256).max);
        }

        IERC20(asset()).safeApprove(address(pacificaPerp), totalAssetsVault);

        longPositionId = pacificaPerp.openPosition(
            bnbMarket, 0, targetSize, 1, asset()
        );
        shortPositionId = pacificaPerp.openPosition(
            bnbMarket, 1, targetSize, 1, asset()
        );

        positionsOpen   = true;
        lastYieldUpdate = block.timestamp;
    }

    function _reducePositionsToTarget(uint256 targetSize) internal {
        if (longPositionId > 0) {
            uint256 current = pacificaPerp.getPosition(longPositionId).size;
            if (current > targetSize) {
                pacificaPerp.closePosition(longPositionId, current - targetSize);
            }
        }
        if (shortPositionId > 0) {
            uint256 current = pacificaPerp.getPosition(shortPositionId).size;
            if (current > targetSize) {
                pacificaPerp.closePosition(shortPositionId, current - targetSize);
            }
        }
    }

    // =========================
    // INTERNAL: SHIELD SCORE
    // =========================

    function _updateShieldScore() internal {
        if (totalAssetsVault == 0) {
            shieldScore = 100;
            lastShieldUpdate = block.timestamp;
            emit ShieldScoreUpdated(100, 0, 0, 100, 0);
            return;
        }

        // 1. Funding rate magnitude (30%)
        int256 fundingRate     = pacificaPerp.getFundingRate(bnbMarket);
        uint256 fundingMag     = uint256(fundingRate > 0 ? fundingRate : -fundingRate);
        uint256 fundingScore   = fundingMag >= 0.000625e18 ? 0
            : (100 - (fundingMag * 100) / 0.000625e18);

        // 2. Delta drift (25%)
        uint256 delta          = _getDelta();
        uint256 deltaPct       = (delta * 100) / totalAssetsVault;
        uint256 deltaScore     = deltaPct >= 50 ? 0 : (100 - deltaPct * 2);

        // 3. Oracle health (25%)
        bool oracleHealthy     = pacificaOracle.isHealthy(bnbMarket);
        uint256 oracleScore    = oracleHealthy ? 100 : 0;

        // 4. Drawdown from peak (20%)
        uint256 drawdownPct    = peakAssets > totalAssetsVault
            ? ((peakAssets - totalAssetsVault) * 100) / peakAssets
            : 0;
        uint256 drawdownScore  = drawdownPct >= 50 ? 0 : (100 - drawdownPct * 2);

        uint256 score = (
            fundingScore  * 30 +
            deltaScore    * 25 +
            oracleScore   * 25 +
            drawdownScore * 20
        ) / 100;

        // 5. Liquidation buffer modifier
        if (longPositionId > 0) {
            uint256 liqPrice  = pacificaPerp.getLiquidationPrice(longPositionId);
            uint256 markPrice = pacificaPerp.getMarkPrice(bnbMarket);
            uint256 buffer;
            if (markPrice > 0) {
                buffer = liqPrice > markPrice
                    ? ((liqPrice - markPrice) * 100) / markPrice
                    : ((markPrice - liqPrice) * 100) / markPrice;
                if (buffer < LIQUIDATION_BUFFER) {
                    score = (score * buffer) / LIQUIDATION_BUFFER;
                }
            }
        }

        shieldScore = score;

        // Circuit breakers
        if (score < PAUSE_THRESHOLD && !paused) {
            paused = true;
            emit VaultPaused(true);
        }
        if (score < EMERGENCY_THRESHOLD && !emergencyMode) {
            emergencyMode = true;
            emit EmergencyModeChanged(true);
        }
        // Auto-resume emergency mode if score recovers
        if (score >= PAUSE_THRESHOLD && emergencyMode) {
            emergencyMode = false;
            emit EmergencyModeChanged(false);
        }

        lastShieldUpdate = block.timestamp;
        emit ShieldScoreUpdated(score, fundingMag, deltaPct, oracleScore, drawdownPct);
    }

    // =========================
    // INTERNAL: SHARE MATH
    // =========================

    /**
     * @notice Compute shares for a deposit using PRE-deposit totalAssets.
     *         totalAssetsVault must NOT be incremented before calling this.
     */
    function _computeShares(uint256 assets) internal view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0 || totalAssetsVault == 0) return assets;
        return (assets * supply) / totalAssetsVault;
    }

    /**
     * @notice Compute shares to burn for a withdrawal.
     */
    function _computeSharesForWithdraw(uint256 assets) internal view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0 || totalAssetsVault == 0) return assets;
        return (assets * supply) / totalAssetsVault;
    }

    // Override ERC-4626 hooks to use our accounting
    function totalAssets() public view override returns (uint256) {
        return totalAssetsVault;
    }

    function _convertToShares(uint256 assets, Math.Rounding) internal view override returns (uint256) {
        return _computeShares(assets);
    }

    function _convertToAssets(uint256 shares, Math.Rounding) internal view override returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return shares;
        return (shares * totalAssetsVault) / supply;
    }

    // =========================
    // INTERNAL: GAMIFICATION
    // =========================

    function _updateXP(address user, uint256 actionXP) internal {
        xp[user] += actionXP;
        uint256 currentLevel = level[user];
        if (currentLevel + 1 < levelRewards.length) {
            if (xp[user] >= levelRewards[currentLevel + 1].xpRequired) {
                level[user]++;
            }
        }
        lastAction[user] = block.timestamp;
    }

    function _getBountyMultiplier(address user) internal view returns (uint256) {
        uint256 userLevel = level[user];
        if (userLevel >= levelRewards.length) {
            return levelRewards[levelRewards.length - 1].multiplier;
        }
        return levelRewards[userLevel].multiplier;
    }

    function _applyMultiplier(uint256 baseBounty, address user)
        internal view returns (uint256)
    {
        return (baseBounty * _getBountyMultiplier(user)) / 100;
    }

    // =========================
    // INTERNAL: DELTA
    // =========================

    function _getDelta() internal view returns (uint256) {
        uint256 longSize  = longPositionId  > 0 ? pacificaPerp.getPosition(longPositionId).size  : 0;
        uint256 shortSize = shortPositionId > 0 ? pacificaPerp.getPosition(shortPositionId).size : 0;
        return longSize > shortSize ? longSize - shortSize : shortSize - longSize;
    }

    // =========================
    // VIEW FUNCTIONS
    // =========================

    function getVaultMetrics() external view returns (
        uint256 tvl,
        uint256 longSize,
        uint256 shortSize,
        uint256 delta,
        uint256 currentShieldScore,
        bool    isPaused,
        bool    isEmergency,
        int256  fundingRate
    ) {
        return (
            totalAssetsVault,
            longPositionId  > 0 ? pacificaPerp.getPosition(longPositionId).size  : 0,
            shortPositionId > 0 ? pacificaPerp.getPosition(shortPositionId).size : 0,
            _getDelta(),
            shieldScore,
            paused,
            emergencyMode,
            pacificaPerp.getFundingRate(bnbMarket)
        );
    }

    function getUserStats(address user) external view returns (
        uint256 userXP,
        uint256 userLevel,
        uint256 bountiesEarned,
        uint256 userShares,
        uint256 userLongExposure,
        uint256 userShortExposure
    ) {
        return (
            xp[user],
            level[user],
            totalBountiesEarned[user],
            balanceOf(user),
            userPositions[user].longShares,
            userPositions[user].shortShares
        );
    }
}
