/**
 * Detox E2E Test: Vitals Recording
 */
import { by, device, element, expect, waitFor } from 'detox';

describe('Vitals Recording', () => {
  beforeAll(async () => {
    await device.launchApp();
    
    // Login as patient
    await element(by.id('email-input')).typeText('patient@chemocare.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.text('Sign In')).tap();
    
    await waitFor(element(by.text('Welcome')))
      .toBeVisible()
      .withTimeout(5000);
    
    // Navigate to vitals
    await element(by.id('tab-vitals')).tap();
  });

  it('should display vitals screen', async () => {
    await expect(element(by.text('My Vitals'))).toBeVisible();
  });

  it('should show vitals history', async () => {
    await expect(element(by.id('vitals-history'))).toBeVisible();
  });

  it('should open add vitals modal', async () => {
    await element(by.text('Add Reading')).tap();
    
    await expect(element(by.text('Record Vitals'))).toBeVisible();
    await expect(element(by.id('systolic-input'))).toBeVisible();
  });

  it('should record new vitals successfully', async () => {
    // Fill blood pressure
    await element(by.id('systolic-input')).typeText('120');
    await element(by.id('diastolic-input')).typeText('80');
    
    // Fill heart rate
    await element(by.id('heart-rate-input')).typeText('72');
    
    // Fill temperature
    await element(by.id('temperature-input')).typeText('36.8');
    
    // Fill oxygen saturation
    await element(by.id('oxygen-input')).typeText('98');
    
    // Submit
    await element(by.text('Save')).tap();
    
    // Verify success
    await waitFor(element(by.text('Vitals recorded successfully')))
      .toBeVisible()
      .withTimeout(3000);
  });

  it('should show validation errors for invalid values', async () => {
    await element(by.text('Add Reading')).tap();
    
    // Enter invalid blood pressure
    await element(by.id('systolic-input')).typeText('300');
    await element(by.id('diastolic-input')).typeText('200');
    
    await element(by.text('Save')).tap();
    
    // Should show validation error
    await expect(element(by.text(/invalid|out of range/i))).toBeVisible();
  });
});
