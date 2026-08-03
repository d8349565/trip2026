import assert from 'node:assert/strict';
import test from 'node:test';
import { pickLatestPhoto, pickPlaceCover } from '../src/utils/placeCover';

test('cover_image 为非空字符串时优先返回，不看照片', () => {
  const cover = pickPlaceCover({ cover_image: '/covers/manual.jpg' }, [
    { file_path: '/uploads/newer.jpg', created_at: '2026-08-01T00:00:00.000Z' },
  ]);
  assert.equal(cover, '/covers/manual.jpg');
  assert.equal(pickPlaceCover({ cover_image: '/covers/manual.jpg' }, []), '/covers/manual.jpg');
});

test('cover_image 为空字符串、null 或缺失时回退到最新照片', () => {
  const photos = [{ file_path: '/uploads/a.jpg', created_at: '2026-07-01T00:00:00.000Z' }];
  assert.equal(pickPlaceCover({ cover_image: '' }, photos), '/uploads/a.jpg');
  assert.equal(pickPlaceCover({ cover_image: null }, photos), '/uploads/a.jpg');
  assert.equal(pickPlaceCover({}, photos), '/uploads/a.jpg');
});

test('回退选择 created_at 最新的照片，与数组顺序无关', () => {
  const cover = pickPlaceCover({}, [
    { file_path: '/uploads/old.jpg', created_at: '2026-07-04T08:00:00.000Z' },
    { file_path: '/uploads/new.jpg', created_at: '2026-07-11T08:00:00.000Z' },
    { file_path: '/uploads/mid.jpg', created_at: '2026-07-05T08:00:00.000Z' },
  ]);
  assert.equal(cover, '/uploads/new.jpg');
});

test('created_at 缺失或非法时视为最旧，全部由它组成时稳定取首个', () => {
  assert.equal(
    pickPlaceCover({}, [
      { file_path: '/uploads/undated.jpg' },
      { file_path: '/uploads/dated.jpg', created_at: '2026-07-01T00:00:00.000Z' },
    ]),
    '/uploads/dated.jpg',
  );
  assert.equal(
    pickPlaceCover({}, [
      { file_path: '/uploads/bad-date.jpg', created_at: 'not-a-date' },
      { file_path: '/uploads/dated.jpg', created_at: '2026-07-01T00:00:00.000Z' },
    ]),
    '/uploads/dated.jpg',
  );
  assert.equal(
    pickPlaceCover({}, [
      { file_path: '/uploads/first.jpg' },
      { file_path: '/uploads/second.jpg', created_at: 'garbage' },
    ]),
    '/uploads/first.jpg',
  );
});

test('created_at 相等时保持数组顺序稳定（取首个）', () => {
  const same = '2026-07-26T00:00:00.000Z';
  const cover = pickPlaceCover({}, [
    { file_path: '/uploads/a.jpg', created_at: same },
    { file_path: '/uploads/b.jpg', created_at: same },
  ]);
  assert.equal(cover, '/uploads/a.jpg');
});

test('空照片数组回退为 undefined', () => {
  assert.equal(pickPlaceCover({}, []), undefined);
  assert.equal(pickPlaceCover({ cover_image: '' }, []), undefined);
});

test('file_path 为空或缺失的照片被跳过，全部为空时为 undefined', () => {
  assert.equal(
    pickPlaceCover({}, [
      { file_path: '', created_at: '2026-08-01T00:00:00.000Z' },
      { file_path: null, created_at: '2026-07-31T00:00:00.000Z' },
      { file_path: '/uploads/valid.jpg', created_at: '2026-07-01T00:00:00.000Z' },
    ]),
    '/uploads/valid.jpg',
  );
  assert.equal(pickPlaceCover({}, [{ file_path: '' }, {}]), undefined);
});

test('返回的 file_path 原样返回，不做任何 URL 转换', () => {
  const raw = '/api/media/abc123/file?x=1#frag';
  assert.equal(pickPlaceCover({}, [{ file_path: raw, created_at: '2026-07-01T00:00:00.000Z' }]), raw);
});

test('pickLatestPhoto 与 mapClusters 共用同一最新照片选择语义', () => {
  const photos = [
    { id: 'b1', created_at: '2026-07-23T00:00:00.000Z' },
    { id: 'b2', created_at: '2026-07-25T00:00:00.000Z' },
  ];
  assert.equal(pickLatestPhoto(photos)?.id, 'b2');
  assert.equal(pickLatestPhoto([]), undefined);
  const same = '2026-07-25T00:00:00.000Z';
  assert.equal(pickLatestPhoto([{ id: 'x', created_at: same }, { id: 'y', created_at: same }])?.id, 'x');
});
