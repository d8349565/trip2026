import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractPhotoMetadata,
  normalizePhotoMetadataDiagnostics,
} from '../src/server/photoMetadata';
import { createGpsExifJpeg } from './fixtures/exifJpeg';

test('服务端从原始 JPEG 字节解析 GPS EXIF', async () => {
  const result = await extractPhotoMetadata(createGpsExifJpeg(), {
    contentType: 'image/jpeg',
    filename: 'xiaomi-original.jpg',
  });

  assert.equal(result.status, 'found');
  assert.equal(result.parser, 'server-exifr');
  assert.equal(result.source, 'exif');
  assert.ok(Math.abs((result.latitude ?? 0) - 30.2666666667) < 1e-8);
  assert.ok(Math.abs((result.longitude ?? 0) - 120.155) < 1e-8);
});

test('服务端对不支持的文件给出结构化诊断', async () => {
  const result = await extractPhotoMetadata(Buffer.from('not-an-image'), {
    contentType: 'text/plain',
    filename: 'notes.txt',
  });

  assert.deepEqual(result, {
    status: 'unsupported',
    parser: 'server-exifr',
    errorCode: 'UNSUPPORTED_IMAGE_TYPE',
  });
});

test('媒体元数据诊断字段使用白名单', () => {
  assert.deepEqual(normalizePhotoMetadataDiagnostics({
    metadata_status: 'not_found',
    metadata_parser: 'server-exifr',
    metadata_error_code: 'GPS_METADATA_NOT_FOUND',
    ignored: 'value',
  }), {
    metadata_status: 'not_found',
    metadata_parser: 'server-exifr',
    metadata_error_code: 'GPS_METADATA_NOT_FOUND',
  });

  assert.throws(() => normalizePhotoMetadataDiagnostics({
    metadata_status: 'invented',
  }));
});
