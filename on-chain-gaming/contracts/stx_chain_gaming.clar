
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
