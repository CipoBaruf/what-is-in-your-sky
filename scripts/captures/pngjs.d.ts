/**
 * The slice of `pngjs` (a direct devDependency with no bundled types) that `diff.ts`, `compress.ts`
 * and the capture spec use. Declared here because a task session cannot add `@types/pngjs`.
 */
declare module 'pngjs' {
  export interface PNGOptions {
    width?: number;
    height?: number;
    fill?: boolean;
  }
  export interface WriteOptions {
    /** zlib level, 0..9. */
    deflateLevel?: number;
    deflateStrategy?: number;
    /** -1 tries every filter per line and keeps the smallest. */
    filterType?: number;
    /** 2 is RGB, 6 is RGBA. */
    colorType?: 0 | 2 | 4 | 6;
    inputColorType?: 0 | 2 | 4 | 6;
    inputHasAlpha?: boolean;
    bitDepth?: 8 | 16;
  }
  export class PNG {
    constructor(options?: PNGOptions);
    width: number;
    height: number;
    /** RGBA, 4 bytes a pixel, row-major. */
    data: Buffer;
    static sync: {
      read(buffer: Buffer): PNG;
      write(png: PNG, options?: WriteOptions): Buffer;
    };
  }
}
