; This is just to test if CPU is working correctly; I don't think
; testing all instructions here is meaningless, since we can just put GB ROM
; inside and run it.
;
; Therefore, we'll just change few data in the RAM.

SECTION "Startup", ROM0
; The starting point of the CPU is $0000.
jp main
db "Hello!", 0

main:
; Zero-fill first 8 bytes using loop
ld hl, $0000
ld a, 8
; loop
.loop
ld [hl], 0
inc hl
dec a
jr nz, .loop
; exit loop
ld hl, $0001
ld [hl], $22 ; $0001 should be 0x22
ld a, $23
ld b, $05
add a, b
ld hl, $0002
ld [hl], a ; $0002 should be 0x28
halt ; This should be enough for our purposes
nop
