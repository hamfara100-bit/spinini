export type Direction = "across" | "down";

export interface CrosswordClue {
  number: number;
  direction: Direction;
  clue: string;
  answer: string;
  row: number;
  col: number;
}

export interface CrosswordCell {
  letter: string;
  isBlack: boolean;
  clueNumber?: number;
  userLetter: string;
  correct?: boolean;
}

export type CrosswordGrid = CrosswordCell[][];

export function buildGrid(size: number): CrosswordGrid {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => ({
      letter: "",
      isBlack: true,
      userLetter: "",
    }))
  );
}

export function placeClues(grid: CrosswordGrid, clues: CrosswordClue[]): CrosswordGrid {
  const g: CrosswordGrid = grid.map(row => row.map(c => ({ ...c })));

  for (const clue of clues) {
    const letters = clue.answer.toUpperCase().split("");
    for (let i = 0; i < letters.length; i++) {
      const r = clue.direction === "across" ? clue.row : clue.row + i;
      const c = clue.direction === "across" ? clue.col + i : clue.col;
      if (g[r] && g[r][c]) {
        g[r][c].letter = letters[i];
        g[r][c].isBlack = false;
        if (i === 0) g[r][c].clueNumber = clue.number;
      }
    }
  }
  return g;
}

export function checkCell(cell: CrosswordCell): CrosswordCell {
  return { ...cell, correct: cell.userLetter.toUpperCase() === cell.letter };
}

export function checkAll(grid: CrosswordGrid): CrosswordGrid {
  return grid.map(row => row.map(checkCell));
}

export function isSolved(grid: CrosswordGrid): boolean {
  return grid.every(row =>
    row.every(cell => cell.isBlack || cell.userLetter.toUpperCase() === cell.letter)
  );
}

export function revealCell(cell: CrosswordCell): CrosswordCell {
  return { ...cell, userLetter: cell.letter, correct: true };
}

// Minimal starter puzzle for demo
export const STARTER_PUZZLE: { clues: CrosswordClue[]; size: number } = {
  size: 7,
  clues: [
    { number: 1, direction: "across", clue: "Opposite of night", answer: "DAY",   row: 0, col: 0 },
    { number: 2, direction: "across", clue: "Feline pet",        answer: "CAT",   row: 2, col: 0 },
    { number: 3, direction: "across", clue: "Colour of sky",     answer: "BLUE",  row: 4, col: 0 },
    { number: 1, direction: "down",   clue: "A canine animal",   answer: "DOG",   row: 0, col: 0 },
    { number: 4, direction: "down",   clue: "We breathe it",     answer: "AIR",   row: 0, col: 2 },
  ],
};
