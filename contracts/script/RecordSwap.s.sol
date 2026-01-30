// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {DNASubscriber} from "../src/DNASubscriber.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

contract RecordSwap is Script {
    using PoolIdLibrary for PoolKey;
    
    // Base Mainnet DNASubscriber
    DNASubscriber constant dnaSubscriber = DNASubscriber(0xeac0cccaf338264f74d6bb7e033a24df8b201884);
    
    // Base Mainnet token addresses
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    
    function run() external {
        // Create PoolKey for WETH/USDC 0.3% pool
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(WETH),
            currency1: Currency.wrap(USDC),
            fee: 3000,        // 0.3%
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
        
        PoolId poolId = poolKey.toId();
        
        // Exact values to use
        address user = 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb;
        uint128 volumeUsd = 1000 * 1e18; // $1,000
        
        console.log("=== recordSwap Call ===");
        console.log("Contract:", address(dnaSubscriber));
        console.log("User:", user);
        console.log("PoolId:", vm.toString(PoolId.unwrap(poolId)));
        console.log("Volume:", volumeUsd, "($1,000 USD)");
        console.log("");
        
        vm.startBroadcast();
        
        // Call recordSwap
        dnaSubscriber.recordSwap(user, poolId, volumeUsd);
        
        console.log("✅ Swap recorded successfully!");
        
        vm.stopBroadcast();
    }
}
