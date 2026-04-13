// contracts/mock/MockPacificaPerp.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockPacificaPerp {
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
    
    mapping(uint256 => Position) public positions;
    uint256 public positionCount;
    
    event PositionOpened(uint256 indexed id, address indexed user, uint8 side, uint256 size);
    event PositionClosed(uint256 indexed id, uint256 size);
    
    function openPosition(
        address market,
        uint8 side,
        uint256 size,
        uint256 leverage,
        address collateral
    ) external returns (uint256 positionId) {
        require(size > 0, "Size must be > 0");
        require(leverage == 1, "Only 1x leverage supported in mock");
        
        positionId = ++positionCount;
        positions[positionId] = Position({
            id: positionId,
            user: msg.sender,
            market: market,
            side: side,
            size: size,
            collateral: size,
            leverage: leverage,
            entryPrice: 1e18,
            openTime: block.timestamp
        });
        
        emit PositionOpened(positionId, msg.sender, side, size);
        return positionId;
    }
    
    function closePosition(uint256 positionId, uint256 size) external {
        Position storage pos = positions[positionId];
        require(pos.user == msg.sender, "Not position owner");
        require(size > 0, "Size must be > 0");
        
        if (size >= pos.size) {
            delete positions[positionId];
            emit PositionClosed(positionId, pos.size);
        } else {
            pos.size -= size;
            emit PositionClosed(positionId, size);
        }
    }
    
    function getPosition(uint256 positionId) external view returns (Position memory) {
        return positions[positionId];
    }
    
    function getFundingRate(address market) external view returns (int256) {
        // Return a small positive funding rate (0.01% per day)
        return 0.0001e18;
    }
    
    function getMarkPrice(address market) external view returns (uint256) {
        return 1e18;
    }
    
    function getLiquidationPrice(uint256 positionId) external view returns (uint256) {
        Position storage pos = positions[positionId];
        if (pos.size == 0) return 0;
        // 50% liquidation threshold for mock
        return pos.entryPrice * 50 / 100;
    }
}