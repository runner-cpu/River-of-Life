/** Editorial diagrams identify the observation task; they are not fossil tracings. */
export function inquiryArt(speciesId: string) {
  const drawing = speciesId === 'archaeopteryx'
    ? `<path d="M61 115Q99 69 158 24Q167 72 116 105Q83 123 61 115Z" fill="#d2dcc4"/><path d="M60 126L158 24M76 105L77 75M89 93L91 61M102 80L107 48M115 66L125 35M81 103L115 99M95 90L131 86M108 77L143 72M122 63L153 55"/><path d="M176 93q31-16 66-3l-3 13q-31 10-61 1Z" fill="#d9ceb6"/><path d="m182 100 4-8 5 8 6-8 5 8 6-8 6 8 5-7 6 7"/><path d="M213 84V54h47M130 104v22h43" stroke-dasharray="3 3"/><text x="219" y="48">有齿颌</text><text x="135" y="143">羽毛</text>`
    : speciesId === 'mosasaurus'
    ? `<path d="M41 75q18-18 51-17l43 8q38 2 64 15l39-14 27-24-11 34 13 26-30-12-39 6q-48 12-87-2L58 92Z" fill="#c5d5cd"/><path d="m105 91-14 30 29-22m50-4 11 21 7-20M58 81l39 1M74 70h3"/><path d="M61 69V38h41M143 77V25h57" stroke-dasharray="3 3"/><text x="42" y="29">头骨特征</text><text x="159" y="20">游泳形态</text><path d="M40 135q30-11 60 0t60 0t60 0t60 0" opacity=".35"/>`
    : `<path d="M43 76q11-22 35-23l35 10q55-4 89 15l52-7 21 14-24 14-53-8q-36 18-87 7l-37 8q-23-7-31-30Z" fill="#ccd5ba"/><path d="m103 88-13 37 41-25m45-7 15 21 14-24M58 70h3m10-7h3M51 86q19 9 35 3M118 72l8 6m10-7 8 6m10-5 8 7m10-4 8 7m-58 8 8 7m11-6 8 7"/><path d="M105 114v25h43M155 70V38h72" stroke-dasharray="3 3"/><text x="112" y="154">鳍与附肢</text><text x="174" y="31">鳞片</text>`;
  return `<svg viewBox="0 0 300 165" aria-hidden="true"><g fill="none" stroke="#526d50" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${drawing.replaceAll('<text ', '<text font-family="sans-serif" font-size="10" fill="#556e4b" stroke="none" ')}</g></svg>`;
}
