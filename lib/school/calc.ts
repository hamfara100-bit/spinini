export type CalcOp = "+" | "-" | "*" | "/" | null;

export interface CalcState {
  display: string;
  prev: number | null;
  op: CalcOp;
  waitingForOperand: boolean;
}

export function calcInitial(): CalcState {
  return { display: "0", prev: null, op: null, waitingForOperand: false };
}

export function calcInput(state: CalcState, key: string): CalcState {
  switch (key) {
    case "0": case "1": case "2": case "3": case "4":
    case "5": case "6": case "7": case "8": case "9": {
      if (state.waitingForOperand) {
        return { ...state, display: key, waitingForOperand: false };
      }
      const display = state.display === "0" ? key : state.display + key;
      return { ...state, display };
    }
    case ".": {
      if (state.waitingForOperand) return { ...state, display: "0.", waitingForOperand: false };
      if (state.display.includes(".")) return state;
      return { ...state, display: state.display + "." };
    }
    case "+": case "-": case "*": case "/": {
      const curr = parseFloat(state.display);
      if (state.prev !== null && !state.waitingForOperand) {
        const result = applyOp(state.prev, curr, state.op);
        return { display: String(result), prev: result, op: key as CalcOp, waitingForOperand: true };
      }
      return { ...state, prev: curr, op: key as CalcOp, waitingForOperand: true };
    }
    case "=": {
      const curr = parseFloat(state.display);
      if (state.prev !== null && state.op) {
        const result = applyOp(state.prev, curr, state.op);
        return { display: String(result), prev: null, op: null, waitingForOperand: true };
      }
      return state;
    }
    case "C":
      return calcInitial();
    case "⌫": {
      if (state.display.length <= 1) return { ...state, display: "0" };
      return { ...state, display: state.display.slice(0, -1) };
    }
    case "+/-": {
      const val = parseFloat(state.display) * -1;
      return { ...state, display: String(val) };
    }
    case "%": {
      const val = parseFloat(state.display) / 100;
      return { ...state, display: String(val) };
    }
    default:
      return state;
  }
}

function applyOp(a: number, b: number, op: CalcOp): number {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "*": return a * b;
    case "/": return b !== 0 ? a / b : 0;
    default: return b;
  }
}

export const CALC_BUTTONS = [
  ["C", "+/-", "%", "/"],
  ["7", "8", "9", "*"],
  ["4", "5", "6", "-"],
  ["1", "2", "3", "+"],
  ["⌫", "0", ".", "="],
];
