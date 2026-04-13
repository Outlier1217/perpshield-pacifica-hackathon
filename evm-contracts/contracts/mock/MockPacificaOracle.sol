// contracts/mock/MockPacificaOracle.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockPacificaOracle {
    function getPrice(address market) external view returns (uint256) {
        return 1e18;
    }
    
    function getPriceFeed(address market) external view returns (int256, uint256) {
        return (1e18, block.timestamp);
    }
    
    function isHealthy(address market) external view returns (bool) {
        return true;
    }
    
    function getTimestamp() external view returns (uint256) {
        return block.timestamp;
    }
}