/**
 * Detox E2E Test: Patient Home Flow
 */
import { by, device, element, expect, waitFor } from 'detox';

describe('Patient Home', () => {
  beforeAll(async () => {
    await device.launchApp();
    
    // Login as patient
    await element(by.id('email-input')).typeText('patient@chemocare.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.text('Sign In')).tap();
    
    await waitFor(element(by.text('Welcome')))
      .toBeVisible()
      .withTimeout(5000);
  });

  beforeEach(async () => {
    // Navigate back to home if needed
    try {
      await element(by.id('tab-home')).tap();
    } catch {
      // Already on home
    }
  });

  it('should display patient greeting', async () => {
    await expect(element(by.text(/Good (Morning|Afternoon|Evening)/))).toBeVisible();
  });

  it('should display upcoming appointments section', async () => {
    await expect(element(by.text('Upcoming Appointments'))).toBeVisible();
  });

  it('should display quick actions', async () => {
    await expect(element(by.text('Record Vitals'))).toBeVisible();
    await expect(element(by.text('Report Symptoms'))).toBeVisible();
  });

  it('should navigate to vitals when tapping Record Vitals', async () => {
    await element(by.text('Record Vitals')).tap();
    
    await expect(element(by.text('My Vitals'))).toBeVisible();
  });

  it('should navigate to symptoms when tapping Report Symptoms', async () => {
    await element(by.text('Report Symptoms')).tap();
    
    await expect(element(by.text('Report Symptoms'))).toBeVisible();
  });

  it('should refresh on pull down', async () => {
    await element(by.id('home-scroll-view')).swipe('down', 'slow');
    
    // Wait for refresh to complete
    await waitFor(element(by.text('Upcoming Appointments')))
      .toBeVisible()
      .withTimeout(3000);
  });
});
