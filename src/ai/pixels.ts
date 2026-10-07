/** What the pixel tools read and write: an `ImageData`, or anything shaped like one. */
export type Pixels = Pick<ImageData, 'data' | 'width' | 'height'>
