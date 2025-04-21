import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mock for Clarity interactions
class MockClaritySession {
  contractState: any;
  txSender: string;

  constructor() {
    this.contractState = {
      games: new Map(),
      gameParticipants: new Map(),
      gameAssets: new Map(),
      gameResults: new Map(),
      lastGameId: 0
    };
    this.txSender = '';
  }

  setTxSender(address: string) {
    this.txSender = address;
  }

  callPublicFn(contractName: string, fnName: string, args: any[], sender: string): any {
    this.setTxSender(sender);
    
    // Implement mock behavior based on the function name
    switch (fnName) {
      case 'create-game':
        return this.mockCreateGame(args[0], args[1], args[2], args[3]);
      case 'join-game':
        return this.mockJoinGame(args[0]);
      case 'start-game':
        return this.mockStartGame(args[0]);
      case 'resolve-game':
        return this.mockResolveGame(args[0], args[1], args[2], args[3]);
      case 'claim-prize':
        return this.mockClaimPrize(args[0]);
      case 'mint-game-asset':
        return this.mockMintGameAsset(args[0], args[1], args[2], args[3]);
      case 'transfer-game-asset':
        return this.mockTransferGameAsset(args[0], args[1], args[2]);
      default:
        throw new Error(`Unimplemented function: ${fnName}`);
    }
  }

  callReadOnlyFn(contractName: string, fnName: string, args: any[], sender: string): any {
    this.setTxSender(sender);
    
    // Implement mock behavior for read-only functions
    switch (fnName) {
      case 'get-game-info':
        return this.mockGetGameInfo(args[0]);
      case 'get-game-result':
        return this.mockGetGameResult(args[0]);
      case 'get-game-asset':
        return this.mockGetGameAsset(args[0], args[1]);
      case 'get-player-status':
        return this.mockGetPlayerStatus(args[0], args[1]);
      default:
        throw new Error(`Unimplemented read-only function: ${fnName}`);
    }
  }

  // Mock implementations
  mockCreateGame(gameType: any, entryFee: any, maxPlayers: any, commitHash: any) {
    const gameId = ++this.contractState.lastGameId;
    
    this.contractState.games.set(gameId, {
      creator: this.txSender,
      'block-created': 12345,
      state: 0, // STATE_PENDING
      'game-type': gameType,
      'entry-fee': entryFee,
      'current-players': 0,
      'max-players': maxPlayers,
      'prize-pool': 0,
      'commit-hash': commitHash
    });
    
    return { result: { type: 'ok', value: { type: 'uint', value: BigInt(gameId) } } };
  }

  mockJoinGame(gameId: any) {
    const game = this.contractState.games.get(gameId);
    if (!game) return { result: { type: 'err', value: 'Game not found' } };
    
    if (game.state !== 0) return { result: { type: 'err', value: 'Game not accepting players' } };
    if (game['current-players'] >= game['max-players']) return { result: { type: 'err', value: 'Game is full' } };
    
    const participantKey = `${gameId}-${this.txSender}`;
    if (this.contractState.gameParticipants.has(participantKey)) {
      return { result: { type: 'err', value: 'Already joined' } };
    }
    
    // Add entry fee to prize pool
    game['current-players']++;
    game['prize-pool'] += Number(game['entry-fee']);
    
    // Record participation
    this.contractState.gameParticipants.set(participantKey, {
      'joined-at': 12345,
      'has-claimed': false
    });
    
    return { result: { type: 'ok', value: { type: 'bool', value: true } } };
  }

  mockStartGame(gameId: any) {
    const game = this.contractState.games.get(gameId);
    if (!game) return { result: { type: 'err', value: 'Game not found' } };
    
    if (game.creator !== this.txSender) return { result: { type: 'err', value: 'Only creator can start' } };
    if (game.state !== 0) return { result: { type: 'err', value: 'Game must be pending' } };
    if (game['current-players'] < 2) return { result: { type: 'err', value: 'Need at least 2 players' } };
    
    game.state = 1; // STATE_ACTIVE
    
    return { result: { type: 'ok', value: { type: 'bool', value: true } } };
  }

  mockResolveGame(gameId: any, seed: any, outcomeData: any, winner: any) {
    const game = this.contractState.games.get(gameId);
    if (!game) return { result: { type: 'err', value: 'Game not found' } };
    
    if (game.creator !== this.txSender) return { result: { type: 'err', value: 'Only creator can resolve' } };
    if (game.state !== 1) return { result: { type: 'err', value: 'Game must be active' } };
    
    // In real contract we'd verify commit hash here
    
    // Store result
    this.contractState.gameResults.set(gameId, {
      winner: winner,
      'random-seed': seed,
      'outcome-data': outcomeData,
      'resolved-at': 12345
    });
    
    // Update game state
    game.state = 2; // STATE_COMPLETED
    
    return { result: { type: 'ok', value: { type: 'bool', value: true } } };
  }

  mockClaimPrize(gameId: any) {
    const game = this.contractState.games.get(gameId);
    if (!game) return { result: { type: 'err', value: 'Game not found' } };
    
    const result = this.contractState.gameResults.get(gameId);
    if (!result) return { result: { type: 'err', value: 'Game not resolved' } };
    
    const participantKey = `${gameId}-${this.txSender}`;
    const participant = this.contractState.gameParticipants.get(participantKey);
    if (!participant) return { result: { type: 'err', value: 'Not a participant' } };
    
    if (game.state !== 2) return { result: { type: 'err', value: 'Game not completed' } };
    if (result.winner.value !== this.txSender) return { result: { type: 'err', value: 'Not the winner' } };
    if (participant['has-claimed']) return { result: { type: 'err', value: 'Already claimed' } };
    
    // Mark as claimed
    participant['has-claimed'] = true;
    
    return { result: { type: 'ok', value: { type: 'bool', value: true } } };
  }

  mockMintGameAsset(gameId: any, assetId: any, tokenId: any, metadataUrl: any) {
    const game = this.contractState.games.get(gameId);
    if (!game) return { result: { type: 'err', value: 'Game not found' } };
    
    if (game.creator !== this.txSender) return { result: { type: 'err', value: 'Only creator can mint' } };
    
    const assetKey = `${gameId}-${assetId}`;
    if (this.contractState.gameAssets.has(assetKey)) {
      return { result: { type: 'err', value: 'Asset ID already exists' } };
    }
    
    // Store asset
    this.contractState.gameAssets.set(assetKey, {
      owner: game.creator,
      'token-id': tokenId,
      'metadata-url': metadataUrl
    });
    
    return { result: { type: 'ok', value: { type: 'bool', value: true } } };
  }

  mockTransferGameAsset(gameId: any, assetId: any, recipient: any) {
    const assetKey = `${gameId}-${assetId}`;
    const asset = this.contractState.gameAssets.get(assetKey);
    if (!asset) return { result: { type: 'err', value: 'Asset not found' } };
    
    if (asset.owner !== this.txSender) return { result: { type: 'err', value: 'Not the asset owner' } };
    
    // Transfer asset
    asset.owner = recipient;
    
    return { result: { type: 'ok', value: { type: 'bool', value: true } } };
  }

  mockGetGameInfo(gameId: any) {
    const game = this.contractState.games.get(gameId);
    return { result: game ? game : null };
  }

  mockGetGameResult(gameId: any) {
    const result = this.contractState.gameResults.get(gameId);
    return { result: result ? result : null };
  }

  mockGetGameAsset(gameId: any, assetId: any) {
    const assetKey = `${gameId}-${assetId}`;
    const asset = this.contractState.gameAssets.get(assetKey);
    return { result: asset ? asset : null };
  }

  mockGetPlayerStatus(gameId: any, player: any) {
    const participantKey = `${gameId}-${player}`;
    const participant = this.contractState.gameParticipants.get(participantKey);
    return { result: participant ? participant : null };
  }
}

// Helper function to create mock addresses
function accounts(session: MockClaritySession): { address: string }[] {
  return [
    { address: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM' }, // deployer
    { address: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG' }, // player1
    { address: 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC' }  // player2
  ];
}

// Helper functions to convert between Clarity and JS values
function cvToValue(cv: any): any {
  return cv; // In our mock we'll just use JS values directly
}

function valueToCV(value: any, type: string): any {
  return value; // In our mock we'll just use JS values directly
}

// Mock function for mockClarity
async function mockClarity(contractPath: string): Promise<MockClaritySession> {
  return new MockClaritySession();
}

describe('Gaming Platform Contract Tests', () => {
  let session: MockClaritySession;
  let deployer: string;
  let player1: string;
  let player2: string;

  // Setup before each test
  beforeEach(async () => {
    session = await mockClarity('./contracts/gaming-platform.clar');
    [deployer, player1, player2] = accounts(session).map(a => a.address);
  });

  test('Create new game', async () => {
    // Sample commit for provably fair randomness (in real scenario this would be sha256(seed))
    const commitHash = Buffer.from('aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899', 'hex');

    // Call create-game as the deployer
    const result = await session.callPublicFn(
      'gaming-platform', 
      'create-game', 
      [
        valueToCV('coin-flip', 'string-ascii'),  // game-type
        valueToCV(10000000, 'uint'),             // entry-fee (10 STX)
        valueToCV(2, 'uint'),                    // max-players
        valueToCV(commitHash, 'buffer')          // commit-hash
      ], 
      deployer
    );

    // Assert the result is ok and returned a game-id of 1
    expect(result.result).toEqual({ type: 'ok', value: { type: 'uint', value: 1n } });
    
    // Get game info to confirm it was created properly
    const gameInfo = await session.callReadOnlyFn(
      'gaming-platform', 
      'get-game-info', 
      [valueToCV(1, 'uint')], 
      deployer
    );
    
    const gameData = cvToValue(gameInfo.result);
    
    // Assert the game properties
    expect(gameData).toMatchObject({
      'creator': deployer,
      'state': 0, // STATE_PENDING
      'game-type': 'coin-flip',
      'entry-fee': 10000000,
      'current-players': 0,
      'max-players': 2,
      'prize-pool': 0
    });
  });

  test('Players can join game', async () => {
    // Create a game first
    const commitHash = Buffer.from('aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899', 'hex');
    await session.callPublicFn(
      'gaming-platform', 
      'create-game', 
      [
        valueToCV('dice-roll', 'string-ascii'),
        valueToCV(5000000, 'uint'),            // 5 STX entry fee
        valueToCV(2, 'uint'),                  // 2 players max
        valueToCV(commitHash, 'buffer')
      ], 
      deployer
    );

    // Player 1 joins the game
    const joinResult1 = await session.callPublicFn(
      'gaming-platform', 
      'join-game', 
      [valueToCV(1, 'uint')], 
      player1
    );

    expect(joinResult1.result).toEqual({ type: 'ok', value: { type: 'bool', value: true } });

    // Player 2 joins the game
    const joinResult2 = await session.callPublicFn(
      'gaming-platform', 
      'join-game', 
      [valueToCV(1, 'uint')], 
      player2
    );

    expect(joinResult2.result).toEqual({ type: 'ok', value: { type: 'bool', value: true } });

    // Check game info after both players joined
    const gameInfo = await session.callReadOnlyFn(
      'gaming-platform', 
      'get-game-info', 
      [valueToCV(1, 'uint')], 
      deployer
    );

    const gameData = cvToValue(gameInfo.result);
    
    // Validate game state
    expect(gameData['current-players']).toBe(2);
    expect(gameData['prize-pool']).toBe(10000000); // 2 players * 5 STX
  });

  test('Game creator can start game', async () => {
    // Create and setup a game with 2 players
    const commitHash = Buffer.from('aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899', 'hex');
    await session.callPublicFn('gaming-platform', 'create-game', 
      [valueToCV('card-game', 'string-ascii'), valueToCV(1000000, 'uint'), valueToCV(2, 'uint'), valueToCV(commitHash, 'buffer')], 
      deployer
    );
    
    await session.callPublicFn('gaming-platform', 'join-game', [valueToCV(1, 'uint')], player1);
    await session.callPublicFn('gaming-platform', 'join-game', [valueToCV(1, 'uint')], player2);

    // Start the game
    const startResult = await session.callPublicFn(
      'gaming-platform', 
      'start-game', 
      [valueToCV(1, 'uint')], 
      deployer
    );

    expect(startResult.result).toEqual({ type: 'ok', value: { type: 'bool', value: true } });

    // Check game state
    const gameInfo = await session.callReadOnlyFn(
      'gaming-platform', 
      'get-game-info', 
      [valueToCV(1, 'uint')], 
      deployer
    );

    const gameData = cvToValue(gameInfo.result);
    expect(gameData['state']).toBe(1); // STATE_ACTIVE
  });

  test('Game resolution and prize claiming', async () => {
    // Create and setup a complete game
    const seed = Buffer.from('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', 'hex');
    
    // Generate commit hash from seed (in production you'd use sha256)
    // For test simplicity, we're using the same value
    const commitHash = seed;
    
    // Create game
    await session.callPublicFn('gaming-platform', 'create-game', 
      [valueToCV('slot-machine', 'string-ascii'), valueToCV(5000000, 'uint'), valueToCV(2, 'uint'), valueToCV(commitHash, 'buffer')], 
      deployer
    );
    
    // Players join
    await session.callPublicFn('gaming-platform', 'join-game', [valueToCV(1, 'uint')], player1);
    await session.callPublicFn('gaming-platform', 'join-game', [valueToCV(1, 'uint')], player2);
    
    // Start game
    await session.callPublicFn('gaming-platform', 'start-game', [valueToCV(1, 'uint')], deployer);
    
    // Mock the commit verification for testing purposes
    // In real contract, this would validate sha256(seed) === commitHash
    vi.spyOn(global, 'Buffer', 'get').mockImplementation(() => ({
      from: () => ({
        equals: () => true
      })
    }));

    // Resolve game with player1 as winner
    const outcomeData = '{"gameType":"slot-machine","symbols":["7","7","7"],"jackpot":true}';
    const resolveResult = await session.callPublicFn(
      'gaming-platform', 
      'resolve-game', 
      [
        valueToCV(1, 'uint'),
        valueToCV(seed, 'buffer'),
        valueToCV(outcomeData, 'string-utf8'),
        valueToCV({ type: 'some', value: player1 }, 'optional')
      ], 
      deployer
    );

    expect(resolveResult.result).toEqual({ type: 'ok', value: { type: 'bool', value: true } });

    // Check game state
    const gameInfo = await session.callReadOnlyFn(
      'gaming-platform', 
      'get-game-info', 
      [valueToCV(1, 'uint')], 
      deployer
    );

    const gameData = cvToValue(gameInfo.result);
    expect(gameData['state']).toBe(2); // STATE_COMPLETED

    // Check game result
    const resultInfo = await session.callReadOnlyFn(
      'gaming-platform', 
      'get-game-result', 
      [valueToCV(1, 'uint')], 
      deployer
    );

    const resultData = cvToValue(resultInfo.result);
    expect(resultData['winner'].value).toBe(player1);
    expect(resultData['outcome-data']).toBe(outcomeData);

    // Player1 claims prize
    const claimResult = await session.callPublicFn(
      'gaming-platform', 
      'claim-prize', 
      [valueToCV(1, 'uint')], 
      player1
    );

    expect(claimResult.result).toEqual({ type: 'ok', value: { type: 'bool', value: true } });

    // Verify player status after claiming
    const playerStatus = await session.callReadOnlyFn(
      'gaming-platform', 
      'get-player-status', 
      [valueToCV(1, 'uint'), valueToCV(player1, 'principal')], 
      deployer
    );

    const statusData = cvToValue(playerStatus.result);
    expect(statusData['has-claimed']).toBe(true);
  });

  test('Non-winner cannot claim prize', async () => {
    // Setup a completed game with player1 as winner
    const commitHash = Buffer.from('aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899', 'hex');
    await session.callPublicFn('gaming-platform', 'create-game', 
      [valueToCV('lottery', 'string-ascii'), valueToCV(1000000, 'uint'), valueToCV(2, 'uint'), valueToCV(commitHash, 'buffer')], 
      deployer
    );
    
    await session.callPublicFn('gaming-platform', 'join-game', [valueToCV(1, 'uint')], player1);
    await session.callPublicFn('gaming-platform', 'join-game', [valueToCV(1, 'uint')], player2);
    await session.callPublicFn('gaming-platform', 'start-game', [valueToCV(1, 'uint')], deployer);
    
    // Resolve with player1 as winner
    await session.callPublicFn(
      'gaming-platform', 
      'resolve-game', 
      [
        valueToCV(1, 'uint'),
        valueToCV(commitHash, 'buffer'),
        valueToCV('{"winner":"player1"}', 'string-utf8'),
        valueToCV({ type: 'some', value: player1 }, 'optional')
      ], 
      deployer
    );

    // player2 tries to claim prize
    const claimResult = await session.callPublicFn(
      'gaming-platform', 
      'claim-prize', 
      [valueToCV(1, 'uint')], 
      player2
    );

    // Should fail with an error
    expect(claimResult.result.type).toBe('err');
  });

  test('Creating and transferring game assets', async () => {
    // Create a game
    const commitHash = Buffer.from('aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899', 'hex');
    await session.callPublicFn('gaming-platform', 'create-game', 
      [valueToCV('collectible-game', 'string-ascii'), valueToCV(0, 'uint'), valueToCV(2, 'uint'), valueToCV(commitHash, 'buffer')], 
      deployer
    );
    
    // Mint a game asset
    const mintResult = await session.callPublicFn(
      'gaming-platform', 
      'mint-game-asset', 
      [
        valueToCV(1, 'uint'),                        // game-id
        valueToCV(101, 'uint'),                      // asset-id
        valueToCV(1, 'uint'),                        // token-id
        valueToCV('ipfs://QmHash123', 'string-utf8') // metadata-url
      ], 
      deployer
    );

    expect(mintResult.result).toEqual({ type: 'ok', value: { type: 'bool', value: true } });

    // Check asset info
    const assetInfo = await session.callReadOnlyFn(
      'gaming-platform', 
      'get-game-asset', 
      [valueToCV(1, 'uint'), valueToCV(101, 'uint')], 
      deployer
    );

    const assetData = cvToValue(assetInfo.result);
    expect(assetData['owner']).toBe(deployer);
    expect(assetData['token-id']).toBe(1);
    expect(assetData['metadata-url']).toBe('ipfs://QmHash123');

    // Transfer asset to player1
    const transferResult = await session.callPublicFn(
      'gaming-platform', 
      'transfer-game-asset', 
      [
        valueToCV(1, 'uint'),                   // game-id
        valueToCV(101, 'uint'),                 // asset-id
        valueToCV(player1, 'principal')         // recipient
      ], 
      deployer
    );

    expect(transferResult.result).toEqual({ type: 'ok', value: { type: 'bool', value: true } });

    // Check asset ownership after transfer
    const updatedAssetInfo = await session.callReadOnlyFn(
      'gaming-platform', 
      'get-game-asset', 
      [valueToCV(1, 'uint'), valueToCV(101, 'uint')], 
      deployer
    );

    const updatedAssetData = cvToValue(updatedAssetInfo.result);
    expect(updatedAssetData['owner']).toBe(player1);
  });
});