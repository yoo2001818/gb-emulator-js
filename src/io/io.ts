// ### I/O Control ###
// FF00 - Joy pad info, system type
// FF01 - Serial transfer data
// FF02 - Serial IO Control

// ### Timer Subsystem ###
// FF04 - DIV - Incremented 16384 times a second, writing resets
// FF05 - TIMA - Incremented by frequency of TAC register. Generates interrupt
//        when overflown
// FF06 - TMA - TIMA overflow modulo
// FF07 - TAC - Timer control

// FF0F - IF - Interrupt flag

// ### Sound Subsystem ###
// FF10 - NR 10 - Sound Mode 1, Sweep Register
// FF11 - NR 11 - Sound Mode 1, Sound length / Wave pattern duty 
// FF12 - NR 12 - Sound Mode 1, Envelope
// FF13 - NR 13 - Sound Mode 1, Frequency low
// FF14 - NR 14 - Sound Mode 1, Frequency high
// FF16 - NR 21 - Sound Mode 2, Sound length / Wave pattern duty
// FF17 - NR 22 - Sound Mode 2, Envelope
// FF18 - NR 23 - Sound Mode 2, Frequency low
// FF19 - NR 24 - Sound Mode 2, Frequency high
// FF1A - NR 30 - Sound Mode 3, Sound on/off
// FF1B - NR 31 - Sound Mode 3, Sound length
// FF1C - NR 32 - Sound Mode 3, Select output 
// FF1D - NR 33 - Sound Mode 3, lower data
// FF1E - NR 34 - Sound Mode 3, higher data
// FF20 - NR 41 - Sound Mode 4, Sound length
// FF21 - NR 42 - Sound Mode 4, Envelope
// FF22 - NR 43 - Sound Mode 4, Polynomial counter
// FF23 - NR 44 - Sound Mode 4, Counter/consecutive; initial
// FF24 - NR 50 - Channel control / ON-OFF / Volume
// FF25 - NR 51 - Sound output terminal select
// FF26 - NR 52 - Sound on/off
// FF30 .. FF3F - Wave pattern RAM

// ### Video Subsystem ###
// FF40 - LCDC - LCD Control Register
// FF41 - STAT - LCDC Status
// FF42 - SCY - Scroll Y
// FF43 - SCX - Scroll X
// FF44 - LY - LCDC Y coordinate (144~153 is VBlank)
// FF45 - LYC - LY Compare - LY == LYC -> coincident flag
// FF46 - DMA - DMA Transfer and Start Address
// FF47 - BGP - BG & Window Palette Data
// FF48 - OBP0 - Object Palette 0 Data
// FF49 - OBP1 - Object Palette 1 Data
// FF4A - WY - Window Y position
// FF4B - WX - Window X position

// FFFF - IE - Interrupt Enable
