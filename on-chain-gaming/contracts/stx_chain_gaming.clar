
;; title: Gaming Platform - Provably Fair Games on Stacks
;; version:
;; summary:
;; description: A framework for deploying simple games with true asset ownership


;; Define game states
(define-constant STATE_PENDING 0)
(define-constant STATE_ACTIVE 1)
(define-constant STATE_COMPLETED 2)
(define-constant STATE_CANCELLED 3)


;; Define constants for provable fairness
(define-constant MAX_ENTROPY_AGE 144) ;; ~24 hours in blocks
(define-constant GAMES_ADMIN tx-sender)



;; Main storage maps
(define-map games
  { game-id: uint }
  {
    creator: principal,
    block-created: uint,
    state: uint,
    game-type: (string-ascii 20),
    entry-fee: uint,
    current-players: uint,
    max-players: uint,
    prize-pool: uint,
    commit-hash: (buff 32)
  }
)


(define-map game-participants
  { game-id: uint, player: principal }
  {
    joined-at: uint,
    has-claimed: bool
  }
)

(define-map game-assets
  { game-id: uint, asset-id: uint }
  {
    owner: principal,
    token-id: uint,
    metadata-url: (string-utf8 256)
  }
)


(define-map game-results
  { game-id: uint }
  {
    winner: (optional principal),
    random-seed: (buff 32),
    outcome-data: (string-utf8 1024),
    resolved-at: uint
  }
)

(define-data-var last-game-id uint 0)


(define-private (generate-next-game-id)
  (let ((next-id (+ (var-get last-game-id) 1)))
    (var-set last-game-id next-id)
    next-id
  )
)

(define-private (is-game-admin)
  (is-eq tx-sender GAMES_ADMIN)
)

(define-private (get-entry-fee (game-id uint))
  (default-to 0 (get entry-fee (map-get? games { game-id: game-id })))
)

(define-private (calculate-prize-pool (game-id uint))
  (let (
    (game-data (unwrap! (map-get? games { game-id: game-id }) (err "Game not found")))
    (entry-fee (get entry-fee game-data))
    (current-players (get current-players game-data))
  )
    (* entry-fee current-players)
  )
)

(define-private (verify-commit (seed (buff 32)) (commit-hash (buff 32)))
  (is-eq (sha256 seed) commit-hash)
)

(define-public (create-game 
  (game-type (string-ascii 20))
  (entry-fee uint)
  (max-players uint)
  (commit-hash (buff 32))
)
  (let (
    (game-id (generate-next-game-id))
    (current-block (get-block-info? block-height 0))
  )
    (asserts! (> max-players 1) (err "Game must allow at least 2 players"))
    (asserts! (is-some current-block) (err "Failed to get current block"))
    
    (map-set games
      { game-id: game-id }
      {
        creator: tx-sender,
        block-created: (unwrap-panic current-block),
        state: STATE_PENDING,
        game-type: game-type,
        entry-fee: entry-fee,
        current-players: 0,
        max-players: max-players,
        prize-pool: 0,
        commit-hash: commit-hash
      }
    )
    (ok game-id)
  )
)

(define-public (start-game (game-id uint))
  (let (
    (game-data (unwrap! (map-get? games { game-id: game-id }) (err "Game not found")))
  )
    (asserts! (is-eq (get creator game-data) tx-sender) (err "Only the creator can start the game"))
    (asserts! (is-eq (get state game-data) STATE_PENDING) (err "Game must be in pending state"))
    (asserts! (> (get current-players game-data) 1) (err "Need at least 2 players to start"))
    
    (map-set games
      { game-id: game-id }
      (merge game-data { state: STATE_ACTIVE })
    )
    (ok true)
  )
)

