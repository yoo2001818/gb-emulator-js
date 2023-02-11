export function generateLUTSingle<T>(
  pattern: string,
  generator: (vars: Record<string, number>) => T,
  output: T[] = []
): T[] {
  // Pattern is something like "01aaabbb"
  // 0 / 1 is constraints, and "a", "b" is variables
  // We'll simply use recursion to implement this
  const letters = pattern.split('');
  function visit(
    index: number,
    prev: number,
    prevVar: number,
    vars: Record<string, number>
  ): void {
    const letter = letters[index];
    let currentVars = vars;
    let currentPrevVar = prevVar;
    if (
      index === letters.length ||
      (index > 0 && letters[index - 1] !== letter)
    ) {
      const prevLetter = letters[index - 1];
      if (prevLetter !== '1' && prevLetter !== '0') {
        currentVars = { ...vars, [prevLetter]: prevVar };
        currentPrevVar = 0;
      }
    }
    if (index === letters.length) {
      output[prev] = generator(currentVars);
      return;
    }
    let current = prev << 1;
    if (letter === '1') {
      current |= 1;
      return visit(index + 1, current, currentPrevVar, currentVars);
    } else if (letter === '0') {
      return visit(index + 1, current, currentPrevVar, currentVars);
    } else {
      currentPrevVar = currentPrevVar << 1;
      visit(index + 1, current, currentPrevVar, currentVars);
      return visit(index + 1, current | 1, currentPrevVar | 1, currentVars);
    }
  }
  visit(0, 0, 0, {});
  return output;
}

export function generateLUTRules<T>(
  size: number,
  patterns: [string, (vars: Record<string, number>) => T][]
): T[] {
  const output: T[] = new Array(size);
  patterns.forEach(([pattern, generator]) => {
    generateLUTSingle(pattern, generator, output);
  });
  return output;
}
