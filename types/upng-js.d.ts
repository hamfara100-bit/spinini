declare module "upng-js" {
  interface UPNGImage {
    width: number;
    height: number;
    depth: number;
    ctype: number;
    frames: any[];
    tabs: any;
    data: Uint8Array;
  }
  const UPNG: {
    decode(buffer: ArrayBuffer): UPNGImage;
    toRGBA8(img: UPNGImage): ArrayBuffer[];
    encode(imgs: ArrayBuffer[], w: number, h: number, cnum: number): ArrayBuffer;
  };
  export default UPNG;
}
