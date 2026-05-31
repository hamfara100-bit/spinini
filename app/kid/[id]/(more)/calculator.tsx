import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Vibration } from "react-native";
import { ScreenContainer } from "../../../../components/screen-container";

// ─── Math expression parser (safe, no eval) ───────────────────────────────────

class MathParser {
  private pos = 0;
  private expr = "";

  evaluate(raw: string): number {
    this.expr = raw
      .replace(/π/g, "(3.141592653589793)")
      .replace(/e(?![a-z])/g, "(2.718281828459045)")
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/−/g, "-")
      .trim();
    this.pos = 0;
    const result = this.parseAddSub();
    if (this.pos < this.expr.length) throw new Error("Unexpected character");
    return result;
  }

  private parseAddSub(): number {
    let left = this.parseMulDiv();
    while (this.pos < this.expr.length) {
      this.skipSpace();
      const op = this.expr[this.pos];
      if (op !== "+" && op !== "-") break;
      this.pos++;
      const right = this.parseMulDiv();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  private parseMulDiv(): number {
    let left = this.parsePow();
    while (this.pos < this.expr.length) {
      this.skipSpace();
      const op = this.expr[this.pos];
      if (op !== "*" && op !== "/") break;
      this.pos++;
      const right = this.parsePow();
      left = op === "*" ? left * right : left / right;
    }
    return left;
  }

  private parsePow(): number {
    const base = this.parseUnary();
    this.skipSpace();
    if (this.pos < this.expr.length && this.expr[this.pos] === "^") {
      this.pos++;
      const exp = this.parseUnary();
      return Math.pow(base, exp);
    }
    return base;
  }

  private parseUnary(): number {
    this.skipSpace();
    if (this.pos < this.expr.length && this.expr[this.pos] === "-") {
      this.pos++;
      return -this.parsePrimary();
    }
    if (this.pos < this.expr.length && this.expr[this.pos] === "+") {
      this.pos++;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    this.skipSpace();
    if (this.pos >= this.expr.length) throw new Error("Unexpected end");

    // Parenthesized expression
    if (this.expr[this.pos] === "(") {
      this.pos++;
      const val = this.parseAddSub();
      this.skipSpace();
      if (this.expr[this.pos] === ")") this.pos++;
      return val;
    }

    // Number literal
    if (this.isDigit(this.expr[this.pos]) || this.expr[this.pos] === ".") {
      return this.parseNumber();
    }

    // Named function or constant
    const name = this.parseName();
    if (!name) throw new Error("Unexpected token at " + this.pos);

    // Constants
    if (name === "pi") return Math.PI;
    if (name === "e")  return Math.E;

    // Functions — expect parenthesized argument next
    const arg = this.parseArgParen();
    const deg = (arg * Math.PI) / 180;
    switch (name) {
      case "sin":  return Math.sin(deg);
      case "cos":  return Math.cos(deg);
      case "tan":  return Math.tan(deg);
      case "asin": return (Math.asin(arg) * 180) / Math.PI;
      case "acos": return (Math.acos(arg) * 180) / Math.PI;
      case "atan": return (Math.atan(arg) * 180) / Math.PI;
      case "log":  return Math.log10(arg);
      case "ln":   return Math.log(arg);
      case "sqrt": return Math.sqrt(arg);
      case "abs":  return Math.abs(arg);
      case "cbrt": return Math.cbrt(arg);
      case "ceil": return Math.ceil(arg);
      case "floor":return Math.floor(arg);
      default: throw new Error("Unknown function: " + name);
    }
  }

  private parseArgParen(): number {
    this.skipSpace();
    if (this.expr[this.pos] === "(") {
      this.pos++;
      const val = this.parseAddSub();
      this.skipSpace();
      if (this.expr[this.pos] === ")") this.pos++;
      return val;
    }
    return this.parsePrimary();
  }

  private parseNumber(): number {
    const start = this.pos;
    while (this.pos < this.expr.length && (this.isDigit(this.expr[this.pos]) || this.expr[this.pos] === ".")) this.pos++;
    // scientific notation e.g. 1.5e10
    if (this.pos < this.expr.length && this.expr[this.pos] === "e" &&
        this.pos + 1 < this.expr.length && (this.isDigit(this.expr[this.pos + 1]) || this.expr[this.pos + 1] === "-")) {
      this.pos++;
      if (this.expr[this.pos] === "-") this.pos++;
      while (this.pos < this.expr.length && this.isDigit(this.expr[this.pos])) this.pos++;
    }
    return parseFloat(this.expr.slice(start, this.pos));
  }

  private parseName(): string {
    const start = this.pos;
    while (this.pos < this.expr.length && /[a-zA-Z]/.test(this.expr[this.pos])) this.pos++;
    return this.expr.slice(start, this.pos);
  }

  private isDigit(c: string) { return c >= "0" && c <= "9"; }
  private skipSpace() { while (this.pos < this.expr.length && this.expr[this.pos] === " ") this.pos++; }
}

const parser = new MathParser();

function safeEval(expr: string): string {
  try {
    const result = parser.evaluate(expr);
    if (!isFinite(result)) return "Error";
    if (isNaN(result)) return "Error";
    // Format: avoid floating point noise
    const fixed = parseFloat(result.toPrecision(12));
    return String(fixed);
  } catch {
    return "Error";
  }
}

function formatDisplay(val: string) {
  if (val.length <= 12) return val;
  const n = parseFloat(val);
  if (isNaN(n)) return val.slice(0, 16) + "…";
  return n.toExponential(6);
}

// ─── Button definitions ───────────────────────────────────────────────────────

type BtnKind = "fn" | "op" | "num" | "eq" | "action";

interface Btn {
  label: string;
  display?: string;   // what gets inserted into expression
  kind: BtnKind;
  wide?: boolean;
}

const ROW_SCI: Btn[][] = [
  [
    { label: "sin",   display: "sin(",  kind: "fn" },
    { label: "cos",   display: "cos(",  kind: "fn" },
    { label: "tan",   display: "tan(",  kind: "fn" },
    { label: "log",   display: "log(",  kind: "fn" },
    { label: "ln",    display: "ln(",   kind: "fn" },
  ],
  [
    { label: "sin⁻¹", display: "asin(", kind: "fn" },
    { label: "cos⁻¹", display: "acos(", kind: "fn" },
    { label: "tan⁻¹", display: "atan(", kind: "fn" },
    { label: "√",     display: "sqrt(", kind: "fn" },
    { label: "∛",     display: "cbrt(", kind: "fn" },
  ],
  [
    { label: "x²",    display: "^2",    kind: "fn" },
    { label: "xʸ",    display: "^",     kind: "fn" },
    { label: "π",     display: "π",     kind: "fn" },
    { label: "e",     display: "e",     kind: "fn" },
    { label: "|x|",   display: "abs(",  kind: "fn" },
  ],
];

const ROW_MAIN: Btn[][] = [
  [
    { label: "AC",    kind: "action" },
    { label: "DEL",   kind: "action" },
    { label: "(",     kind: "op" },
    { label: ")",     kind: "op" },
    { label: "÷",     display: "÷", kind: "op" },
  ],
  [
    { label: "7", kind: "num" },
    { label: "8", kind: "num" },
    { label: "9", kind: "num" },
    { label: "%", kind: "op" },
    { label: "×", display: "×", kind: "op" },
  ],
  [
    { label: "4", kind: "num" },
    { label: "5", kind: "num" },
    { label: "6", kind: "num" },
    { label: "+/-", kind: "action" },
    { label: "−", display: "-", kind: "op" },
  ],
  [
    { label: "1", kind: "num" },
    { label: "2", kind: "num" },
    { label: "3", kind: "num" },
    { label: ".", kind: "num" },
    { label: "+", kind: "op" },
  ],
  [
    { label: "0", kind: "num", wide: true },
    { label: "EXP", display: "×10^", kind: "op" },
    { label: "=", kind: "eq" },
  ],
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalculatorScreen() {
  const [expr, setExpr]     = useState("");
  const [result, setResult] = useState("");
  const [prevExpr, setPrevExpr] = useState("");
  const [justEvaled, setJustEvaled] = useState(false);

  const liveResult = expr.length > 0 ? safeEval(expr) : "";

  const press = useCallback((btn: Btn) => {
    Vibration.vibrate(18);

    if (btn.label === "AC") {
      setExpr(""); setResult(""); setPrevExpr(""); setJustEvaled(false);
      return;
    }

    if (btn.label === "DEL") {
      if (justEvaled) { setExpr(""); setResult(""); setJustEvaled(false); return; }
      setExpr(e => e.slice(0, -1));
      return;
    }

    if (btn.label === "=") {
      if (!expr) return;
      const res = safeEval(expr);
      setPrevExpr(expr);
      setResult(res);
      setExpr(res === "Error" ? "" : res);
      setJustEvaled(true);
      return;
    }

    if (btn.label === "+/-") {
      if (justEvaled && result) {
        const n = parseFloat(result);
        if (!isNaN(n)) { const neg = String(-n); setExpr(neg); setResult(""); setJustEvaled(false); }
        return;
      }
      setExpr(e => e.startsWith("-") ? e.slice(1) : "-" + e);
      return;
    }

    if (btn.label === "%") {
      const cur = safeEval(expr);
      if (cur !== "Error") { setExpr(String(parseFloat(cur) / 100)); setResult(""); setJustEvaled(false); }
      return;
    }

    // If just evaluated and user presses a number — start fresh
    if (justEvaled && btn.kind === "num") {
      setExpr(btn.display ?? btn.label);
      setResult(""); setPrevExpr(""); setJustEvaled(false);
      return;
    }
    // If just evaluated and user presses an operator — continue from result
    if (justEvaled && (btn.kind === "op" || btn.kind === "fn")) {
      setJustEvaled(false);
      // expr is already set to result value — just append
    }

    setJustEvaled(false);
    setExpr(e => e + (btn.display ?? btn.label));
  }, [expr, result, justEvaled]);

  // Colour per kind
  function btnStyle(btn: Btn) {
    if (btn.label === "=")   return [bs.btn, bs.btnEq];
    if (btn.kind === "action") return [bs.btn, btn.label === "AC" ? bs.btnClear : bs.btnAction];
    if (btn.kind === "fn")   return [bs.btn, bs.btnFn];
    if (btn.kind === "op")   return [bs.btn, bs.btnOp];
    return [bs.btn, bs.btnNum];
  }

  function btnTextStyle(btn: Btn) {
    if (btn.label === "=")     return [bs.btnTxt, bs.btnTxtEq];
    if (btn.kind === "fn")     return [bs.btnTxt, bs.btnTxtFn];
    if (btn.kind === "op")     return [bs.btnTxt, bs.btnTxtOp];
    if (btn.kind === "action") return [bs.btnTxt, btn.label === "AC" ? bs.btnTxtClear : bs.btnTxtAction];
    return [bs.btnTxt, bs.btnTxtNum];
  }

  function renderRow(row: Btn[], i: number) {
    return (
      <View key={i} style={bs.row}>
        {row.map((btn, j) => (
          <TouchableOpacity
            key={j}
            style={[...btnStyle(btn), btn.wide && bs.btnWide]}
            onPress={() => press(btn)}
            activeOpacity={0.7}
          >
            <Text style={btnTextStyle(btn)} numberOfLines={1} adjustsFontSizeToFit>
              {btn.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <View style={calc.root}>
      {/* Display */}
      <View style={calc.display}>
        <Text style={calc.prevExpr} numberOfLines={1} ellipsizeMode="head">
          {justEvaled ? prevExpr : ""}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
          <Text style={calc.exprText} numberOfLines={1}>
            {expr || "0"}
          </Text>
        </ScrollView>
        {!justEvaled && liveResult && liveResult !== expr && liveResult !== "Error" && (
          <Text style={calc.liveResult} numberOfLines={1}>= {formatDisplay(liveResult)}</Text>
        )}
        {justEvaled && (
          <Text style={calc.resultText} numberOfLines={1} adjustsFontSizeToFit>
            {formatDisplay(result)}
          </Text>
        )}
        <Text style={calc.modeBadge}>DEG</Text>
      </View>

      {/* Scientific rows */}
      <View style={calc.sciBg}>
        {ROW_SCI.map(renderRow)}
      </View>

      {/* Main pad */}
      <View style={calc.mainBg}>
        {ROW_MAIN.map(renderRow)}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const DARK   = "#1A1A2E";
const MID    = "#16213E";
const CARD   = "#0F3460";
const ACCENT = "#7C5CFF";
const OP_CLR = "#E94560";
const FN_CLR = "#2A9D8F";
const NUM_CLR = "#264653";
const EQ_CLR  = "#7C5CFF";

const calc = StyleSheet.create({
  root: { flex: 1, backgroundColor: DARK },
  display: {
    backgroundColor: MID, paddingHorizontal: 20, paddingTop: 44, paddingBottom: 16,
    minHeight: 180, justifyContent: "flex-end", gap: 4,
  },
  prevExpr: { fontSize: 14, color: "rgba(255,255,255,0.35)", textAlign: "right" },
  exprText: { fontSize: 32, fontWeight: "300", color: "#fff", textAlign: "right", letterSpacing: 1 },
  liveResult: { fontSize: 18, color: "rgba(255,255,255,0.45)", textAlign: "right" },
  resultText: { fontSize: 48, fontWeight: "700", color: EQ_CLR, textAlign: "right" },
  modeBadge: { position: "absolute", top: 52, left: 20, fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.3)", backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  sciBg: { backgroundColor: "#101025", paddingHorizontal: 8, paddingTop: 8, paddingBottom: 4, gap: 4 },
  mainBg: { flex: 1, backgroundColor: DARK, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 16, gap: 5 },
});

const bs = StyleSheet.create({
  row: { flexDirection: "row", gap: 5 },
  btn: { flex: 1, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnWide: { flex: 2 },
  btnNum:    { backgroundColor: NUM_CLR },
  btnOp:     { backgroundColor: OP_CLR },
  btnFn:     { backgroundColor: FN_CLR },
  btnEq:     { backgroundColor: EQ_CLR },
  btnAction: { backgroundColor: "#2E3A4E" },
  btnClear:  { backgroundColor: "#7F1D1D" },
  btnTxt:    { fontSize: 15, fontWeight: "600" },
  btnTxtNum:    { color: "#fff" },
  btnTxtOp:     { color: "#fff" },
  btnTxtFn:     { color: "#fff", fontSize: 12 },
  btnTxtEq:     { color: "#fff", fontSize: 22, fontWeight: "800" },
  btnTxtAction: { color: "#CBD5E1", fontSize: 13 },
  btnTxtClear:  { color: "#FCA5A5", fontWeight: "800" },
});
