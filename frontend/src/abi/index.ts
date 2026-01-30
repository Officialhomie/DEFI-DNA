/**
 * Contract ABIs for DeFi DNA Platform
 *
 * These ABIs are automatically extracted from compiled contracts.
 * Update them by running: forge build in the contracts directory,
 * then re-extract using: jq '.abi' contracts/out/{Contract}.sol/{Contract}.json > frontend/src/abi/{Contract}.json
 */

import dsAbi from './DNASubscriber.json';
import drAbi from './DNAReader.json';
import apmAbi from './AdvancedPositionManager.json';

export const DNASubscriber = dsAbi;
export const DNAReader = drAbi;
export const AdvancedPositionManager = apmAbi;

export const ABIs = {
  DNASubscriber: dsAbi,
  DNAReader: drAbi,
  AdvancedPositionManager: apmAbi,
} as const;

export type DNASubscriberABI = typeof dsAbi;
export type DNAReaderABI = typeof drAbi;
export type AdvancedPositionManagerABI = typeof apmAbi;
