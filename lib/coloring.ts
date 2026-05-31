import { generateColoringSVG } from "./ai";

export { generateColoringSVG };

export function isValidSVG(text: string): boolean {
  return /<svg[\s\S]*<\/svg>/i.test(text);
}

export function fallbackSVG(): string {
  return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="400" fill="white" stroke="black" stroke-width="2"/>
    <text x="200" y="200" text-anchor="middle" fill="#999" font-size="18">Draw something!</text>
  </svg>`;
}
