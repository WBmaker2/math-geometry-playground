import { expect, test } from '@playwright/test';

test('home loads and unfolds net', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Math Geometry Playground/ })).toBeVisible();
  await page.getByRole('button', { name: '전개도 펴기' }).click();
  await expect(page.getByText('전개도가 펼쳐졌습니다')).toBeVisible();
});

test('8 solids picker + slice hexagon + function vertex', async ({ page }) => {
  await page.goto('/');
  // 8 solids
  for (const name of ['정육면체', '직육면체', '삼각기둥', '사각뿔', '정사면체', '원기둥', '원뿔', '구']) {
    await expect(page.getByRole('button', { name: new RegExp(name) }).first()).toBeVisible();
  }
  // surface readout exists
  await expect(page.getByTestId('surface-value')).toBeVisible();

  // slice tab → diagonal → hexagon
  await page.getByRole('tab', { name: '단면 자르기' }).click();
  await page.getByLabel('대각선으로 자르기').check();
  await expect(page.getByTestId('slice-name')).toContainText('육각형');

  // function tab → vertex + sliders
  await page.getByRole('tab', { name: '함수 그래프' }).click();
  await expect(page.getByTestId('vertex-value')).toContainText('x=');
  await page.getByTestId('func-a').fill('2');

  // print tab → SVG 6 faces
  await page.getByRole('tab', { name: '인쇄 학습지' }).click();
  // ensure cube selected for 6-face assertion
  await page.getByRole('button', { name: /정육면체/ }).first().click();
  const faces = await page.locator('[data-testid="net-svg"] polygon[data-face]').count();
  expect(faces).toBe(6);
});
