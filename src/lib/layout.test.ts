import { homeColumns } from './layout';

// The tablet in the report was 1280×800 in landscape: it must not get the phone column.
test('tablets in landscape and wide windows split the home screen, phones and upright tablets do not', () => {
  expect(homeColumns(1280, 800)).toBe(2);
  expect(homeColumns(1024, 768)).toBe(2);
  expect(homeColumns(800, 1280)).toBe(1);
  expect(homeColumns(412, 915)).toBe(1);
  expect(homeColumns(915, 412)).toBe(2);
  expect(homeColumns(460, 860)).toBe(1);
});
