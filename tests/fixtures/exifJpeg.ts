function writeRational(buffer: Buffer, offset: number, numerator: number, denominator = 1) {
  buffer.writeUInt32LE(numerator, offset);
  buffer.writeUInt32LE(denominator, offset + 4);
}

/**
 * 生成一张最小 JPEG：EXIF GPS 为 30°16'0"N, 120°9'18"E。
 * 期望十进制度数为 30.266666...、120.155。
 */
export function createGpsExifJpeg(): Buffer {
  const tiff = Buffer.alloc(128);
  tiff.write('II', 0, 'ascii');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);

  // IFD0: one GPSInfo pointer.
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x8825, 10);
  tiff.writeUInt16LE(4, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt32LE(26, 18);
  tiff.writeUInt32LE(0, 22);

  // GPS IFD: LatitudeRef, Latitude, LongitudeRef, Longitude.
  tiff.writeUInt16LE(4, 26);

  tiff.writeUInt16LE(1, 28);
  tiff.writeUInt16LE(2, 30);
  tiff.writeUInt32LE(2, 32);
  tiff.write('N\0', 36, 'ascii');

  tiff.writeUInt16LE(2, 40);
  tiff.writeUInt16LE(5, 42);
  tiff.writeUInt32LE(3, 44);
  tiff.writeUInt32LE(80, 48);

  tiff.writeUInt16LE(3, 52);
  tiff.writeUInt16LE(2, 54);
  tiff.writeUInt32LE(2, 56);
  tiff.write('E\0', 60, 'ascii');

  tiff.writeUInt16LE(4, 64);
  tiff.writeUInt16LE(5, 66);
  tiff.writeUInt32LE(3, 68);
  tiff.writeUInt32LE(104, 72);
  tiff.writeUInt32LE(0, 76);

  writeRational(tiff, 80, 30);
  writeRational(tiff, 88, 16);
  writeRational(tiff, 96, 0);
  writeRational(tiff, 104, 120);
  writeRational(tiff, 112, 9);
  writeRational(tiff, 120, 18);

  const exifPayload = Buffer.concat([Buffer.from('Exif\0\0', 'ascii'), tiff]);
  const app1Length = Buffer.alloc(2);
  app1Length.writeUInt16BE(exifPayload.length + 2);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe1]),
    app1Length,
    exifPayload,
    Buffer.from([0xff, 0xd9]),
  ]);
}
