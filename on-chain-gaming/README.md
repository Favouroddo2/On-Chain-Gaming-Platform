# Gaming Platform - Provably Fair Games on Stacks

A blockchain-based framework for deploying simple games with true asset ownership and verifiable fairness on the Stacks blockchain.

## Overview

This project provides a smart contract infrastructure for creating and managing provably fair games on the Stacks blockchain. The platform supports multiple game types, entry fees, prize pools, and true digital asset ownership, all secured by blockchain technology.

## Features

- **Provably Fair Games**: Uses commit-reveal scheme to ensure verifiable randomness
- **Multiple Game Types**: Flexible framework supporting various game implementations
- **Prize Pools**: Automatic collection and distribution of entry fees to winners
- **Digital Asset Ownership**: In-game assets can be minted, owned, and transferred
- **Full Transparency**: All game states and outcomes are publicly verifiable on-chain
- **Flexible Player Management**: Games can support various player counts and entry fee models

## Smart Contract Functions

### Game Creation and Management

- `create-game`: Create a new game with specified type, entry fee, and player limit
- `start-game`: Transition a game from pending to active state
- `cancel-game`: Cancel a pending game (only available to game creator or admin)
- `resolve-game`: Complete a game by revealing the random seed and declaring winner(s)

### Player Actions

- `join-game`: Join a game by paying the entry fee
- `leave-game`: Leave a pending game and get refunded
- `claim-prize`: Winners can claim their prize from the pool

### Asset Management

- `mint-game-asset`: Create new in-game assets with associated metadata
- `transfer-game-asset`: Transfer ownership of game assets between players

### Read-only Functions

- `get-game-info`: Retrieve details about a specific game
- `get-game-result`: Get the outcome of a completed game
- `get-player-status`: Check if a player has joined a specific game
- `is-player-winner`: Verify if a player is the winner of a specific game
- `get-total-games`: Get the total number of games created on the platform

## Game States

- `STATE_PENDING`: Game created but not yet started
- `STATE_ACTIVE`: Game in progress
- `STATE_COMPLETED`: Game finished with a result
- `STATE_CANCELLED`: Game cancelled before completion

## Provable Fairness Mechanism

This platform implements a commit-reveal scheme to ensure fairness:

1. When creating a game, the creator submits a hash of a secret random seed
2. Players join the game without knowing the seed
3. Once the game concludes, the creator reveals the original seed
4. The contract verifies that the revealed seed matches the initial commitment
5. Game outcome is determined using the verified random seed

This mechanism ensures that neither the game creator nor the players can manipulate the result.

## Getting Started

### Prerequisites

- [Clarinet](https://github.com/hirosystems/clarinet) - Stacks smart contract development environment
- [Stacks Wallet](https://www.hiro.so/wallet) - To interact with the deployed contract

### Deployment

1. Clone this repository
2. Set up Clarinet environment
3. Deploy the contract to the Stacks blockchain using Clarinet

```bash
clarinet deploy
```

### Creating a Game

```clarity
(contract-call? .gaming-platform create-game "dice" u100000 u5 0x8a9d...)
```

This creates a dice game with 100,000 microSTX entry fee, maximum 5 players, and the provided commit hash.

### Joining a Game

```clarity
(contract-call? .gaming-platform join-game u1)
```

This joins game #1, automatically transferring the required entry fee.

## Development

To extend this platform with new game types or features:

1. Fork this repository
2. Add your new game logic in a new Clarity contract that interfaces with the main platform
3. Submit a pull request with your changes

## Security Considerations

- Game creators must securely store their random seeds until game resolution
- Players should verify the reputation of game creators before joining
- The contract includes time constraints on seed reveals to prevent manipulation

## License

[MIT License](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request