
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

(define-public (cancel-game (game-id uint))
  (let (
    (game-data (unwrap! (map-get? games { game-id: game-id }) (err "Game not found")))
  )
    (asserts! (or (is-eq (get creator game-data) tx-sender) (is-game-admin)) (err "Unauthorized"))
    (asserts! (is-eq (get state game-data) STATE_PENDING) (err "Can only cancel pending games"))
    
    (map-set games
      { game-id: game-id }
      (merge game-data { state: STATE_CANCELLED })
    )
    (ok true)
  )
)

(define-public (join-game (game-id uint))
  (let (
    (game-data (unwrap! (map-get? games { game-id: game-id }) (err "Game not found")))
    (current-block (get-block-info? block-height 0))
    (entry-fee (get entry-fee game-data))
    (current-players (get current-players game-data))
    (max-players (get max-players game-data))
  )
    (asserts! (is-eq (get state game-data) STATE_PENDING) (err "Game is not accepting players"))
    (asserts! (< current-players max-players) (err "Game is full"))
    (asserts! (is-none (map-get? game-participants { game-id: game-id, player: tx-sender })) (err "Already joined"))
    (asserts! (is-some current-block) (err "Failed to get current block"))
    
    ;; Handle payment
    (if (> entry-fee 0)
      (begin
        (try! (stx-transfer? entry-fee tx-sender (as-contract tx-sender)))
        (map-set games
          { game-id: game-id }
          (merge game-data {
            current-players: (+ current-players 1),
            prize-pool: (+ (get prize-pool game-data) entry-fee)
          })
        )
      )
      (map-set games
        { game-id: game-id }
        (merge game-data {
          current-players: (+ current-players 1)
        })
      )
    )
    
    ;; Record participation
    (map-set game-participants
      { game-id: game-id, player: tx-sender }
      { 
        joined-at: (unwrap-panic current-block),
        has-claimed: false
      }
    )
    
    (ok true)
  )
)

(define-public (leave-game (game-id uint))
  (let (
    (game-data (unwrap! (map-get? games { game-id: game-id }) (err "Game not found")))
    (player-data (unwrap! (map-get? game-participants { game-id: game-id, player: tx-sender }) (err "Not a participant")))
    (entry-fee (get entry-fee game-data))
  )
    (asserts! (is-eq (get state game-data) STATE_PENDING) (err "Can only leave pending games"))
    
    ;; Refund entry fee
    (if (> entry-fee 0)
      (begin
        (try! (as-contract (stx-transfer? entry-fee (as-contract tx-sender) tx-sender)))
        (map-set games
          { game-id: game-id }
          (merge game-data {
            current-players: (- (get current-players game-data) 1),
            prize-pool: (- (get prize-pool game-data) entry-fee)
          })
        )
      )
      (map-set games
        { game-id: game-id }
        (merge game-data {
          current-players: (- (get current-players game-data) 1)
        })
      )
    )
    
    ;; Remove participation record
    (map-delete game-participants { game-id: game-id, player: tx-sender })
    
    (ok true)
  )
)

(define-public (resolve-game (game-id uint) (seed (buff 32)) (outcome-data (string-utf8 1024)) (winner (optional principal)))
  (let (
    (game-data (unwrap! (map-get? games { game-id: game-id }) (err "Game not found")))
    (current-block (get-block-info? block-height 0))
  )
    (asserts! (is-eq (get creator game-data) tx-sender) (err "Only creator can resolve"))
    (asserts! (is-eq (get state game-data) STATE_ACTIVE) (err "Game must be active"))
    (asserts! (verify-commit seed (get commit-hash game-data)) (err "Invalid seed for commit"))
    (asserts! (is-some current-block) (err "Failed to get current block"))
    
    ;; Store result
    (map-set game-results
      { game-id: game-id }
      {
        winner: winner,
        random-seed: seed,
        outcome-data: outcome-data,
        resolved-at: (unwrap-panic current-block)
      }
    )
    
    ;; Update game state
    (map-set games
      { game-id: game-id }
      (merge game-data { state: STATE_COMPLETED })
    )
    
    (ok true)
  )
)

(define-public (claim-prize (game-id uint))
  (let (
    (game-data (unwrap! (map-get? games { game-id: game-id }) (err "Game not found")))
    (result-data (unwrap! (map-get? game-results { game-id: game-id }) (err "Game not resolved")))
    (player-data (unwrap! (map-get? game-participants { game-id: game-id, player: tx-sender }) (err "Not a participant")))
    (winner (unwrap! (get winner result-data) (err "No winner declared")))
  )
    (asserts! (is-eq (get state game-data) STATE_COMPLETED) (err "Game not completed"))
    (asserts! (is-eq winner tx-sender) (err "Not the winner"))
    (asserts! (not (get has-claimed player-data)) (err "Already claimed"))
    
    ;; Transfer prize
    (try! (as-contract (stx-transfer? (get prize-pool game-data) (as-contract tx-sender) tx-sender)))
    
    ;; Mark as claimed
    (map-set game-participants
      { game-id: game-id, player: tx-sender }
      (merge player-data { has-claimed: true })
    )
    
    (ok true)
  )
)

(define-public (mint-game-asset (game-id uint) (asset-id uint) (token-id uint) (metadata-url (string-utf8 256)))
  (let (
    (game-data (unwrap! (map-get? games { game-id: game-id }) (err "Game not found")))
  )
    (asserts! (is-eq (get creator game-data) tx-sender) (err "Only creator can mint assets"))
    (asserts! (is-none (map-get? game-assets { game-id: game-id, asset-id: asset-id })) (err "Asset ID already exists"))
    
    ;; Store the asset
    (map-set game-assets
      { game-id: game-id, asset-id: asset-id }
      {
        owner: (get creator game-data),
        token-id: token-id,
        metadata-url: metadata-url
      }
    )
    
    (ok true)
  )
)
