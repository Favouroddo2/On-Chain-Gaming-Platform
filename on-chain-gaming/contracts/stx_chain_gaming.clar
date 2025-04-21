
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
