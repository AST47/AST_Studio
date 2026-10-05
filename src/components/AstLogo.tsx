import React from "react";

interface AstLogoProps {
  className?: string;
  showStudioText?: boolean;
}

export const AstLogo: React.FC<AstLogoProps> = ({
  className = "h-8 sm:h-9 w-auto",
  showStudioText = true,
}) => {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <svg
        viewBox="0 0 1024 430"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${className} shrink-0 drop-shadow-[0_2px_12px_rgba(99,102,241,0.3)]`}
      >
        <defs>
          {/* Mixed colors gradient: Indigo -> Violet -> Purple -> Pink */}
          <linearGradient
            id="astMixedColorsGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="30%" stopColor="#8b5cf6" />
            <stop offset="65%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>

          {/* Secondary highlight gradient for the upper ribbon */}
          <linearGradient
            id="astRibbonUpper"
            x1="20%"
            y1="0%"
            x2="80%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>

          <filter id="astGlowEffect" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="1"
              stdDeviation="6"
              floodColor="#a855f7"
              floodOpacity="0.45"
            />
          </filter>
        </defs>

        {/* ============================================================ */}
        {/* WHITE PORTIONS (Originally Black in logo-icon.png):          */}
        {/* Letter A, S-Wings, and Letter T                              */}
        {/* ============================================================ */}
        <g fill="#FFFFFF">
          {/* Letter 'A' */}
          <path
            d="M 282 12
               L 16 414
               L 118 414
               L 174 278
               L 348 278
               L 378 350
               C 362 376 352 396 346 414
               L 454 414
               L 282 12 Z
               M 261 74
               L 194 212
               L 322 212
               Z"
            fillRule="evenodd"
          />

          {/* Lower black curl of 'S' (sweeping under S from bottom of A) */}
          <path
            d="M 342 322
               C 346 364 382 402 438 412
               C 506 424 598 402 662 344
               C 670 336 676 324 676 312
               C 644 338 584 374 496 374
               C 424 374 372 344 354 302
               C 348 288 344 266 348 248
               C 340 272 338 298 342 322 Z"
          />

          {/* Upper black curl of 'S' (sweeping over top into crossbar of T) */}
          <path
            d="M 524 12
               C 478 12 438 34 416 68
               C 438 42 476 34 522 34
               C 604 34 664 64 682 112
               C 688 128 692 148 688 168
               C 700 134 698 96 686 72
               C 670 36 618 12 524 12 Z"
          />

          {/* Letter 'T' (crossbar connected seamlessly with top sweep of S) */}
          <path
            d="M 468 12
               L 1008 12
               L 1008 84
               L 828 84
               L 828 414
               L 732 414
               L 732 84
               L 542 84
               C 518 84 492 80 468 70
               L 468 12 Z"
          />
        </g>

        {/* ============================================================ */}
        {/* MIXED COLORS GRADIENT (Originally Maroon in logo-icon.png):   */}
        {/* Central Dynamic Ribbon Swirls                                */}
        {/* ============================================================ */}
        <g filter="url(#astGlowEffect)">
          {/* Upper Maroon Ribbon -> Mixed Colors Gradient */}
          <path
            d="M 548 28
               C 502 28 462 52 434 94
               C 402 144 378 202 370 256
               C 384 206 414 148 458 104
               C 492 68 530 48 572 44
               C 594 42 622 44 646 52
               C 660 38 634 28 588 28
               C 574 28 560 28 548 28 Z"
            fill="url(#astRibbonUpper)"
          />

          {/* Lower Maroon Ribbon -> Mixed Colors Gradient */}
          <path
            d="M 372 198
               C 376 150 404 104 446 70
               C 434 92 412 128 404 168
               C 394 222 420 280 472 322
               C 524 366 596 390 672 406
               C 688 410 710 412 724 408
               C 700 396 672 374 648 348
               C 594 290 560 242 518 198
               C 468 142 402 164 372 198 Z"
            fill="url(#astMixedColorsGradient)"
          />

          {/* Diagonal Speed Slice / Central Accent Glow */}
          <path
            d="M 432 82
               C 406 130 388 182 384 232
               C 396 186 422 136 458 98
               C 480 76 508 60 538 52
               C 508 58 474 68 444 80
               L 432 82 Z"
            fill="url(#astRibbonUpper)"
            opacity="0.9"
          />

          <path
            d="M 420 248
               C 450 292 502 334 558 360
               C 606 382 658 396 694 400
               C 664 390 628 370 592 346
               C 540 312 494 270 460 228
               C 438 234 426 240 420 248 Z"
            fill="url(#astMixedColorsGradient)"
            opacity="0.9"
          />
        </g>
      </svg>

      {showStudioText && (
        <span className="text-xl sm:text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
          Studio
        </span>
      )}
    </div>
  );
};
